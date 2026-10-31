import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ErroApi,
  agruparVencimentosPorFrota,
  type AlertaDeVencimento,
  type ItemEmAlerta,
} from '@guinchei/api';
import { prazoDoVencimento } from './telas/Homologacao';
import { apiFalsa, frotasDeHomologacao } from './teste/apiFalsa';
import { renderEm as renderizar } from './teste/renderizar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const CAPITAL = 'f0000000-0000-4000-8000-000000000003';
const SUL = 'f0000000-0000-4000-8000-000000000004';
const PLANALTO = 'f0000000-0000-4000-8000-000000000001';

function alerta(campos: Partial<ItemEmAlerta> & Pick<ItemEmAlerta, 'itemId'>): ItemEmAlerta {
  return {
    frotaId: CAPITAL,
    frotaNome: 'Guincho Capital',
    alvo: 'frota',
    alvoId: CAPITAL,
    tipo: 'apolice_rc',
    estado: 'aprovado',
    validade: '2026-11-10',
    diasRestantes: 10,
    guincheiro: null,
    podeReenviar: false,
    ...campos,
  };
}

/** Em ordem de urgência, como o banco devolve: a CNH da Capital venceu há 31 dias. */
function vencimentosDeExemplo(): AlertaDeVencimento {
  return {
    prazoDias: 30,
    itens: [
      alerta({
        itemId: 'i-cnh',
        tipo: 'cnh',
        alvo: 'guincheiro',
        estado: 'vencido',
        validade: '2026-09-30',
        diasRestantes: -31,
        guincheiro: 'Paulo Mendes',
      }),
      alerta({
        itemId: 'i-plan-apolice',
        frotaId: PLANALTO,
        frotaNome: 'Reboque Planalto',
        alvoId: PLANALTO,
        estado: 'vencido',
        validade: '2026-10-29',
        diasRestantes: -2,
      }),
      alerta({
        itemId: 'i-sul-apolice',
        frotaId: SUL,
        frotaNome: 'Rebocadora Sul',
        alvoId: SUL,
        validade: '2026-11-03',
        diasRestantes: 3,
      }),
      alerta({
        itemId: 'i-antecedentes',
        tipo: 'antecedentes',
        alvo: 'guincheiro',
        validade: '2026-11-10',
        diasRestantes: 10,
        guincheiro: 'Paulo Mendes',
      }),
    ],
  };
}

/** Frotas de exemplo, com a apólice da Rebocadora Sul já aprovada (é a que está vencendo). */
function frotasComApoliceDaSul() {
  const frotas = frotasDeHomologacao();
  frotas[1]!.itens.push({
    id: 'i-sul-apolice',
    alvo: 'frota',
    alvoId: SUL,
    tipo: 'apolice_rc',
    estado: 'aprovado',
    motivo: null,
    validade: '2026-11-03',
    enviadoEm: '2026-10-17T08:05:00Z',
  });
  return frotas;
}

async function abrir(api = apiFalsa({ sessao: true, vencimentos: vencimentosDeExemplo() })) {
  renderizar('/homologacao', api);
  await screen.findByRole('navigation', { name: 'Painel de operação' });
  return api;
}

const lateral = () => screen.getByRole('navigation', { name: 'Painel de operação' });
const abaVencendo = () => screen.findByRole('tab', { name: /Vencendo/ });
const listaVencendo = () => screen.getByRole('complementary', { name: 'Vencendo' });

describe('Painel: alerta de vencimento', () => {
  it('o contador da lateral soma as Frotas pendentes e as Frotas vencendo', async () => {
    await abrir();
    // 2 Frotas com item pendente (Capital e Sul) + 3 com documento vencendo ou vencido.
    await waitFor(() =>
      expect(within(lateral()).getByRole('link', { name: /Homologação/ }).textContent).toBe(
        'Homologação5',
      ),
    );
  });

  it('sem nada pendente nem vencendo, o contador some', async () => {
    await abrir(
      apiFalsa({ sessao: true, frotas: [frotasDeHomologacao()[2]!], vencimentos: undefined }),
    );
    await screen.findByText('Nenhuma Frota aguardando homologação.');
    expect(within(lateral()).getByRole('link', { name: /Homologação/ }).textContent).toBe(
      'Homologação',
    );
  });

  it('só vencimentos já contam na lateral mesmo com a fila vazia', async () => {
    await abrir(
      apiFalsa({
        sessao: true,
        frotas: [frotasDeHomologacao()[2]!],
        vencimentos: { prazoDias: 30, itens: [vencimentosDeExemplo().itens[1]!] },
      }),
    );
    await screen.findByText('Nenhuma Frota aguardando homologação.');
    await waitFor(() =>
      expect(within(lateral()).getByRole('link', { name: /Homologação/ }).textContent).toBe(
        'Homologação1',
      ),
    );
  });

  it('a aba Vencendo lista por Frota, a mais urgente primeiro, vencidos e a vencer', async () => {
    await abrir();
    fireEvent.click(await abaVencendo());

    const botoes = within(listaVencendo()).getAllByRole('button');
    expect(botoes.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Guincho Capital: 2 documentos vencendo',
      'Reboque Planalto: 1 documento vencendo',
      'Rebocadora Sul: 1 documento vencendo',
    ]);

    // Dentro da Frota, o mais urgente também vem primeiro.
    const capital = botoes[0]!;
    expect(capital.textContent).toContain('CNH · Paulo Mendes');
    expect(capital.textContent).toContain('Venceu há 31 dias');
    expect(capital.textContent).toContain('Certidão de antecedentes · Paulo Mendes');
    expect(capital.textContent).toContain('Vence em 10 dias');
    expect(capital.textContent!.indexOf('Venceu há 31 dias')).toBeLessThan(
      capital.textContent!.indexOf('Vence em 10 dias'),
    );
    expect(botoes[1]!.textContent).toContain('Apólice de RC');
    expect(botoes[1]!.textContent).toContain('Venceu há 2 dias');
    expect(botoes[2]!.textContent).toContain('Vence em 3 dias');
  });

  it('marca o vencido como alerta e o a vencer como atenção', async () => {
    await abrir();
    fireEvent.click(await abaVencendo());
    const lista = listaVencendo();
    expect(within(lista).getByText('Venceu há 2 dias').className).toContain('etiqueta--alerta');
    expect(within(lista).getByText('Vence em 3 dias').className).toContain('etiqueta--atencao');
  });

  it('mostra a contagem de Frotas em cada aba', async () => {
    await abrir();
    const vencendo = await abaVencendo();
    expect(vencendo.textContent).toBe('Vencendo3');
    expect(screen.getByRole('tab', { name: /Pendentes/ }).textContent).toBe('Pendentes2');
  });

  it('escolher a Frota na lista abre o detalhe dela, com o prazo no item que vence', async () => {
    const api = await abrir(
      apiFalsa({
        sessao: true,
        frotas: frotasComApoliceDaSul(),
        vencimentos: vencimentosDeExemplo(),
      }),
    );
    fireEvent.click(await abaVencendo());
    fireEvent.click(within(listaVencendo()).getByRole('button', { name: /Rebocadora Sul/ }));

    expect(await screen.findByRole('heading', { name: 'Rebocadora Sul' })).toBeTruthy();
    expect(api.buscarFrotaHomologacao).toHaveBeenCalledWith(SUL);
    const apolice = await screen.findByRole('listitem', { name: 'Apólice de RC por avaria' });
    expect(within(apolice).getByText(/Vence em 3 dias \(03\/11\/2026\)/)).toBeTruthy();
  });

  it('abre a primeira Frota da lista Vencendo, mesmo sem pendência, e o vencido pede novo envio', async () => {
    await abrir();
    fireEvent.click(await abaVencendo());
    expect(await screen.findByRole('heading', { name: 'Guincho Capital' })).toBeTruthy();
    const cnh = screen.getByRole('listitem', { name: 'CNH do Guincheiro' });
    expect(within(cnh).getByText('Vencido').className).toContain('etiqueta--alerta');
    expect(within(cnh).getByText('Aguardando novo envio do documento.')).toBeTruthy();
  });

  it('sem nada vencendo, diz que está tudo em dia e cita o prazo do banco', async () => {
    await abrir(apiFalsa({ sessao: true, vencimentos: { prazoDias: 45, itens: [] } }));
    const aba = await abaVencendo();
    expect(aba.textContent).toBe('Vencendo');
    fireEvent.click(aba);
    expect(
      await screen.findByText(
        'Nenhuma apólice, certidão ou CNH vence nos próximos 45 dias, e nenhuma está vencida.',
      ),
    ).toBeTruthy();
  });

  it('se os vencimentos não carregam, avisa e deixa tentar de novo, sem dizer que está tudo em dia', async () => {
    const api = apiFalsa({ sessao: true, vencimentos: vencimentosDeExemplo() });
    api.listarVencimentos.mockRejectedValueOnce(new ErroApi('falha', 'Não foi possível ler'));
    await abrir(api);
    fireEvent.click(await abaVencendo());
    expect(await screen.findByText('Não foi possível carregar os vencimentos.')).toBeTruthy();
    expect(screen.queryByText(/Nenhuma apólice, certidão ou CNH vence/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Guincho Capital' })).toBeTruthy();
    expect(api.listarVencimentos).toHaveBeenCalledTimes(2);
  });
});

describe('prazoDoVencimento', () => {
  it('escreve o prazo em palavras', () => {
    expect(prazoDoVencimento(30)).toBe('Vence em 30 dias');
    expect(prazoDoVencimento(2)).toBe('Vence em 2 dias');
    expect(prazoDoVencimento(1)).toBe('Vence amanhã');
    expect(prazoDoVencimento(0)).toBe('Vence hoje');
    expect(prazoDoVencimento(-1)).toBe('Venceu há 1 dia');
    expect(prazoDoVencimento(-12)).toBe('Venceu há 12 dias');
  });
});

describe('agruparVencimentosPorFrota', () => {
  it('ordena as Frotas pelo item mais urgente, e os itens de cada Frota pela urgência', () => {
    const itens = vencimentosDeExemplo().itens;
    const frotas = agruparVencimentosPorFrota([...itens].reverse());
    expect(frotas.map((f) => f.nome)).toEqual([
      'Guincho Capital',
      'Reboque Planalto',
      'Rebocadora Sul',
    ]);
    expect(frotas[0]!.itens.map((i) => i.itemId)).toEqual(['i-cnh', 'i-antecedentes']);
  });

  it('sem itens, devolve lista vazia', () => {
    expect(agruparVencimentosPorFrota([])).toEqual([]);
  });
});
