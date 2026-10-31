import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ErroApi,
  type AlertaDeVencimento,
  type ItemEmAlerta,
  type MinhaFrota,
} from '@guinchei/api';
import { ITEM_ALVARA, ITEM_APOLICE, PERFIL_AURORA, apiFalsa } from '../../teste/apiFalsa';
import { renderEm } from '../../teste/renderizar';
import { prazoDoAviso } from './AvisosDeVencimento';

afterEach(cleanup);

/** AAAA-MM-DD de hoje mais `dias`, pelo calendário do aparelho (o mesmo que o formulário usa). */
function emDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

const tocar = (nome: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nome }));
const preencher = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const escolher = (rotulo: string, nome = 'documento.pdf', tipo = 'application/pdf') =>
  fireEvent.change(screen.getByLabelText(rotulo), {
    target: { files: [new File(['x'], nome, { type: tipo })] },
  });
const tela = (nome: string) => screen.findByRole('main', { name: nome });

const APOLICE_VENCIDA: MinhaFrota['itens'][number] = {
  ...ITEM_APOLICE,
  estado: 'vencido',
  validade: '2026-09-30',
};

const FROTA: MinhaFrota = {
  id: 'frota-nova',
  tipo: 'empresa',
  documento: '11444777000161',
  nome: 'Aurora Guinchos',
  ativa: true,
  baseCep: '70000000',
  baseEndereco: 'SQN 308',
  baseBairro: 'Asa Norte',
  chavePix: 'x',
  apoliceValidade: '2026-09-30',
  termosPrestadorVersao: 'v',
  itens: [{ ...ITEM_ALVARA, estado: 'aprovado' }, APOLICE_VENCIDA],
};

function alerta(campos: Partial<ItemEmAlerta> = {}): ItemEmAlerta {
  return {
    itemId: 'item-apolice',
    frotaId: 'frota-nova',
    frotaNome: 'Aurora Guinchos',
    alvo: 'frota',
    alvoId: 'frota-nova',
    tipo: 'apolice_rc',
    estado: 'vencido',
    validade: '2026-09-30',
    diasRestantes: -31,
    guincheiro: null,
    podeReenviar: true,
    ...campos,
  };
}

const vencimentos = (...itens: ItemEmAlerta[]): AlertaDeVencimento => ({ prazoDias: 30, itens });

/** O representante, na Frota dele, com a apólice vencida e a CNH de uma Guincheira vencendo. */
const representante = (extra: Parameters<typeof apiFalsa>[0] = {}) =>
  apiFalsa({
    sessao: true,
    perfil: PERFIL_AURORA,
    frota: FROTA,
    vencimentos: vencimentos(
      alerta(),
      alerta({
        itemId: 'item-cnh-carla',
        alvo: 'guincheiro',
        alvoId: 'carla',
        tipo: 'cnh',
        estado: 'aprovado',
        validade: '2026-11-10',
        diasRestantes: 10,
        guincheiro: 'Carla Dias',
        podeReenviar: false,
      }),
    ),
    ...extra,
  });

describe('Aviso de vencimento: representante', () => {
  it('na Frota, avisa da apólice vencida e da CNH de uma Guincheira que vence em breve', async () => {
    renderEm('/frota', representante());
    const aviso = await screen.findByRole('region', { name: 'Documentos vencendo' });

    expect(within(aviso).getByText('Documento vencido')).toBeTruthy();
    expect(within(aviso).getByText(/Documento vencido não vale para a homologação/)).toBeTruthy();

    const apolice = within(aviso).getByRole('listitem', {
      name: 'Apólice de responsabilidade civil',
    });
    expect(within(apolice).getByText('Venceu há 31 dias, em 30/09/2026')).toBeTruthy();
    expect(within(apolice).getByRole('button', { name: /Enviar documento novo/ })).toBeTruthy();

    const cnh = within(aviso).getByRole('listitem', { name: 'CNH de Carla Dias' });
    expect(within(cnh).getByText('Vence em 10 dias, em 10/11/2026')).toBeTruthy();
    expect(within(cnh).getByText(/Avise Carla Dias para providenciar/)).toBeTruthy();
    // Quem não é dono do documento não tem botão de envio.
    expect(within(cnh).queryByRole('button')).toBeNull();
  });

  it('o aviso vem do documento mais urgente: o vencido antes do que vence', async () => {
    renderEm('/frota', representante());
    const aviso = await screen.findByRole('region', { name: 'Documentos vencendo' });
    const itens = within(aviso).getAllByRole('listitem');
    expect(itens.map((i) => i.getAttribute('aria-label'))).toEqual([
      'Apólice de responsabilidade civil',
      'CNH de Carla Dias',
    ]);
  });

  it('o reenvio da apólice volta o item a pendente e some o aviso', async () => {
    const api = representante({
      vencimentos: vencimentos(alerta()),
    });
    renderEm('/frota', api);
    await screen.findByRole('region', { name: 'Documentos vencendo' });
    tocar(/Enviar documento novo/);

    expect(await tela('Reenviar apólice')).toBeTruthy();
    await screen.findByLabelText('Validade da apólice nova');
    expect(screen.getByText(/A apólice anterior venceu em 30\/09\/2026/)).toBeTruthy();

    const validade = emDias(365);
    preencher('Validade da apólice nova', validade);
    escolher('Arquivo da apólice nova');
    tocar('Enviar apólice');

    await tela('Minha Frota');
    expect(await screen.findByText('Apólice enviada. A operação vai conferir.')).toBeTruthy();
    expect(api.enviarDocumentoDaFrota).toHaveBeenCalledTimes(1);
    expect(api.reenviarItemDaFrota).toHaveBeenCalledWith(
      'item-apolice',
      expect.stringContaining('/'),
      validade,
    );

    // O item voltou a pendente ("Em análise") e o aviso saiu.
    const itens = within(screen.getByRole('list', { name: 'Documentos da Frota' }));
    expect(itens.getAllByText('Em análise').length).toBe(1);
    expect(itens.queryByText('Vencido')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Documentos vencendo' })).toBeNull();
  });

  it.each([
    ['sem validade', () => {}, 'Informe até quando a apólice nova vale.'],
    [
      'validade passada',
      () => preencher('Validade da apólice nova', emDias(-3)),
      'A apólice está vencida.',
    ],
    [
      'vence em menos de 30 dias',
      () => preencher('Validade da apólice nova', emDias(10)),
      'A apólice vence em menos de 30 dias.',
    ],
    [
      'sem arquivo',
      () => preencher('Validade da apólice nova', emDias(365)),
      'Anexe a apólice nova.',
    ],
  ])('recusa o formulário %s, sem chamar a API', async (_caso, preparar, mensagem) => {
    const api = representante({ vencimentos: vencimentos(alerta()) });
    renderEm('/frota', api);
    await screen.findByRole('region', { name: 'Documentos vencendo' });
    tocar(/Enviar documento novo/);
    await tela('Reenviar apólice');
    await screen.findByLabelText('Validade da apólice nova');

    preparar();
    tocar('Enviar apólice');

    expect((await screen.findByRole('alert')).textContent).toContain(mensagem);
    expect(api.enviarDocumentoDaFrota).not.toHaveBeenCalled();
    expect(api.reenviarItemDaFrota).not.toHaveBeenCalled();
  });

  it('se o servidor recusa o reenvio, mostra a mensagem e deixa tentar de novo', async () => {
    const api = representante({ vencimentos: vencimentos(alerta()) });
    api.reenviarItemDaFrota.mockRejectedValueOnce(new ErroApi('falha', 'Falhou'));
    renderEm('/frota', api);
    await screen.findByRole('region', { name: 'Documentos vencendo' });
    tocar(/Enviar documento novo/);
    await tela('Reenviar apólice');
    await screen.findByLabelText('Validade da apólice nova');

    preencher('Validade da apólice nova', emDias(365));
    escolher('Arquivo da apólice nova');
    tocar('Enviar apólice');
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Não foi possível enviar a apólice',
    );

    tocar('Enviar apólice');
    await tela('Minha Frota');
    // O arquivo já tinha subido: a segunda tentativa só repete o reenvio.
    expect(api.enviarDocumentoDaFrota).toHaveBeenCalledTimes(1);
    expect(api.reenviarItemDaFrota).toHaveBeenCalledTimes(2);
  });

  it('apólice que ainda vale não abre o formulário de reenvio', async () => {
    const frota: MinhaFrota = {
      ...FROTA,
      itens: [ITEM_ALVARA, { ...ITEM_APOLICE, estado: 'aprovado', validade: emDias(20) }],
    };
    renderEm(
      '/frota/apolice/item-apolice',
      apiFalsa({ sessao: true, perfil: PERFIL_AURORA, frota }),
    );
    await tela('Reenviar apólice');
    expect(await screen.findByText(/Esta apólice ainda vale/)).toBeTruthy();
    expect(screen.queryByLabelText('Arquivo da apólice nova')).toBeNull();
  });

  it('sem nada vencendo, a Frota não mostra o aviso', async () => {
    renderEm('/frota', representante({ vencimentos: vencimentos() }));
    await tela('Minha Frota');
    await screen.findByRole('list', { name: 'Documentos da Frota' });
    expect(screen.queryByRole('region', { name: 'Documentos vencendo' })).toBeNull();
  });
});

describe('Aviso de vencimento: Guincheiro', () => {
  const cnhVencida = alerta({
    itemId: 'item-cnh',
    frotaNome: 'Reboque Planalto',
    alvo: 'guincheiro',
    alvoId: '22222222-2222-4222-8222-222222222201',
    tipo: 'cnh',
    validade: '2026-10-20',
    diasRestantes: -11,
    guincheiro: 'Marcos Alves',
  });

  it('no plantão, avisa da CNH vencida e leva ao envio da nova', async () => {
    renderEm('/', apiFalsa({ sessao: true, vencimentos: vencimentos(cnhVencida) }));
    const aviso = await screen.findByRole('region', { name: 'Documentos vencendo' });
    expect(within(aviso).getByText('Venceu há 11 dias, em 20/10/2026')).toBeTruthy();
    // É o dono: não repete o próprio nome no cartão.
    expect(within(aviso).getByRole('listitem', { name: 'CNH' })).toBeTruthy();

    fireEvent.click(within(aviso).getByRole('button', { name: 'Enviar documento novo: CNH' }));
    expect(await tela('CNH')).toBeTruthy();
  });

  it('o reenvio da CNH nova tira o aviso do plantão', async () => {
    const api = apiFalsa({ sessao: true, vencimentos: vencimentos(cnhVencida) });
    renderEm('/', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar documento novo: CNH' }));
    await tela('CNH');
    await screen.findByLabelText('Número da CNH');

    preencher('Número da CNH', '04512398765');
    preencher('Categoria', 'C');
    preencher('Validade da CNH', emDias(400));
    fireEvent.click(screen.getByLabelText(/A minha CNH tem a observação EAR/));
    escolher('Foto da CNH', 'cnh.jpg', 'image/jpeg');
    tocar('Enviar CNH');

    await tela('Documentos');
    expect(await screen.findByText('CNH enviada. A operação vai conferir.')).toBeTruthy();
    expect(api.enviarCnh).toHaveBeenCalledTimes(1);
    expect((await api.listarAvisosDeVencimento()).itens).toEqual([]);
  });

  it('documento que só está vencendo avisa, mas ainda não oferece o envio', async () => {
    renderEm(
      '/',
      apiFalsa({
        sessao: true,
        vencimentos: vencimentos({
          ...cnhVencida,
          estado: 'aprovado',
          validade: '2026-11-20',
          diasRestantes: 20,
        }),
      }),
    );
    const aviso = await screen.findByRole('region', { name: 'Documentos vencendo' });
    expect(within(aviso).getByText('Documento perto de vencer')).toBeTruthy();
    expect(within(aviso).getByText(/Avisamos 30 dias antes do vencimento/)).toBeTruthy();
    expect(within(aviso).getByText('Vence em 20 dias, em 20/11/2026')).toBeTruthy();
    expect(within(aviso).getByText(/O envio abre aqui quando a validade passar/)).toBeTruthy();
    expect(within(aviso).queryByRole('button')).toBeNull();
  });

  it('sem nada vencendo, o plantão não mostra aviso', async () => {
    renderEm('/', apiFalsa({ sessao: true }));
    await screen.findByRole('switch', { name: 'Disponível para chamados' });
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Documentos vencendo' })).toBeNull(),
    );
  });

  it('se a leitura do aviso falha, o plantão segue sem ele', async () => {
    const api = apiFalsa({ sessao: true, vencimentos: vencimentos(cnhVencida) });
    api.listarAvisosDeVencimento.mockRejectedValue(new Error('sem rede'));
    renderEm('/', api);
    expect(await screen.findByRole('switch', { name: 'Disponível para chamados' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Documentos vencendo' })).toBeNull();
  });
});

describe('prazoDoAviso', () => {
  it('escreve o prazo e a data', () => {
    const base = alerta({ validade: '2026-11-05' });
    expect(prazoDoAviso({ ...base, diasRestantes: 12 })).toBe('Vence em 12 dias, em 05/11/2026');
    expect(prazoDoAviso({ ...base, diasRestantes: 1 })).toBe('Vence amanhã, 05/11/2026');
    expect(prazoDoAviso({ ...base, diasRestantes: 0 })).toBe('Vence hoje, 05/11/2026');
    expect(prazoDoAviso({ ...base, diasRestantes: -1 })).toBe('Venceu há 1 dia, em 05/11/2026');
    expect(prazoDoAviso({ ...base, diasRestantes: -3 })).toBe('Venceu há 3 dias, em 05/11/2026');
  });
});
