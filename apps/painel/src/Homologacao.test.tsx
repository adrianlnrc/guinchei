import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, type FrotaEmHomologacao, type ItemHomologacao } from '@guinchei/api';
import { apiFalsa, frotasDeHomologacao } from './teste/apiFalsa';
import { renderEm as renderizar } from './teste/renderizar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Abre a Homologação já com a operação logada, esperando a fila carregar. */
async function abrir(api = apiFalsa({ sessao: true })) {
  renderizar('/homologacao', api);
  await screen.findByRole('navigation', { name: 'Painel de operação' });
  return api;
}

const fila = () => screen.getByRole('complementary', { name: 'Fila de homologação' });
const itemDe = (nome: string) => screen.getByRole('listitem', { name: nome });

describe('Homologação: fila de pendências', () => {
  it('lista só as Frotas com item pendente, a de envio mais antigo primeiro', async () => {
    await abrir();
    const botoes = await within(fila()).findAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Guincho Capital'),
      expect.stringContaining('Rebocadora Sul'),
    ]);
    expect(within(fila()).queryByText(/Reboque Planalto/)).toBeNull();
    expect(botoes[0]!.textContent).toContain('2 itens pendentes');
    expect(botoes[1]!.textContent).toContain('1 item pendente');
  });

  it('mostra a contagem de Frotas na fila ao lado de Homologação, na lateral', async () => {
    await abrir();
    const lateral = screen.getByRole('navigation', { name: 'Painel de operação' });
    await waitFor(() =>
      expect(within(lateral).getByRole('link', { name: /Homologação/ }).textContent).toBe(
        'Homologação2',
      ),
    );
  });

  it('sem Frota pendente, diz que a fila está vazia', async () => {
    await abrir(apiFalsa({ sessao: true, frotas: [frotasDeHomologacao()[2]!] }));
    expect(await screen.findByText('Nenhuma Frota aguardando homologação.')).toBeTruthy();
    const lateral = screen.getByRole('navigation', { name: 'Painel de operação' });
    expect(within(lateral).getByRole('link', { name: /Homologação/ }).textContent).toBe(
      'Homologação',
    );
  });

  it('se a fila não carrega, avisa em vez de mostrar fila vazia', async () => {
    const api = apiFalsa({ sessao: true });
    api.listarFilaHomologacao.mockRejectedValue(
      new ErroApi('falha', 'Não foi possível ler a fila'),
    );
    await abrir(api);
    expect(await screen.findByText('Não foi possível carregar a fila.')).toBeTruthy();
    expect(screen.queryByText('Nenhuma Frota aguardando homologação.')).toBeNull();
  });
});

describe('Homologação: detalhe da Frota', () => {
  it('abre a primeira Frota da fila com os itens, o estado e a validade', async () => {
    await abrir();
    expect(await screen.findByRole('heading', { name: 'Guincho Capital' })).toBeTruthy();
    expect(screen.getByText(/CNPJ 11444777000161/)).toBeTruthy();

    const apolice = itemDe('Apólice de RC por avaria');
    expect(within(apolice).getByText('Pendente')).toBeTruthy();
    expect(within(apolice).getByText(/Validade 15\/10\/2027/)).toBeTruthy();
    expect(within(itemDe('Alvará')).getByText('Aprovado')).toBeTruthy();
    expect(within(itemDe('CRLV do veículo PBX-1D23')).getByText(/Veículo/)).toBeTruthy();
  });

  it('destaca o item vencido e não oferece aprovar sem reenvio', async () => {
    await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    const cnh = itemDe('CNH do Guincheiro');
    const estado = within(cnh).getByText('Vencido');
    expect(estado.className).toContain('etiqueta--alerta');
    expect(within(cnh).getByText(/Validade 30\/09\/2026/)).toBeTruthy();
    expect(within(cnh).getByText('Aguardando novo envio do documento.')).toBeTruthy();
    expect(within(cnh).queryByRole('button', { name: /^Aprovar/ })).toBeNull();
    expect(within(cnh).queryByRole('button', { name: /^Recusar/ })).toBeNull();
  });

  it('escolher outra Frota da fila abre o detalhe dela', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(within(fila()).getByRole('button', { name: /Rebocadora Sul/ }));
    expect(await screen.findByRole('heading', { name: 'Rebocadora Sul' })).toBeTruthy();
    expect(screen.getByText(/CPF 45678912364/)).toBeTruthy();
    expect(api.buscarFrotaHomologacao).toHaveBeenCalledWith('f0000000-0000-4000-8000-000000000004');
  });
});

describe('Homologação: decidir item', () => {
  it('aprova o item pendente e ele passa a Aprovado', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar Apólice de RC por avaria' }));

    await waitFor(() =>
      expect(within(itemDe('Apólice de RC por avaria')).getByText('Aprovado')).toBeTruthy(),
    );
    expect(api.aprovarItem).toHaveBeenCalledWith('i-apolice');
    expect(
      within(itemDe('Apólice de RC por avaria')).queryByRole('button', { name: /^Aprovar/ }),
    ).toBeNull();
    // A fila continua com a Frota: ainda falta o CRLV.
    expect(within(fila()).getByRole('button', { name: /Guincho Capital/ }).textContent).toContain(
      '1 item pendente',
    );
  });

  it('recusar pede o motivo e só confirma com ele preenchido', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Recusar CRLV do veículo PBX-1D23' }));

    const confirmar = screen.getByRole('button', { name: 'Confirmar recusa' }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    const campo = screen.getByLabelText('Motivo da recusa');
    fireEvent.change(campo, { target: { value: '   ' } });
    expect(confirmar.disabled).toBe(true);
    fireEvent.change(campo, { target: { value: 'Foto cortada, placa ilegível' } });
    expect(confirmar.disabled).toBe(false);
    fireEvent.click(confirmar);

    await waitFor(() =>
      expect(within(itemDe('CRLV do veículo PBX-1D23')).getByText('Recusado')).toBeTruthy(),
    );
    expect(api.recusarItem).toHaveBeenCalledWith('i-crlv', 'Foto cortada, placa ilegível');
    expect(
      within(itemDe('CRLV do veículo PBX-1D23')).getByText(/Foto cortada, placa ilegível/),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Motivo da recusa')).toBeNull();
  });

  it('cancelar a recusa fecha o motivo sem chamar a API', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Recusar CRLV do veículo PBX-1D23' }));
    fireEvent.change(screen.getByLabelText('Motivo da recusa'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Motivo da recusa')).toBeNull();
    expect(api.recusarItem).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Aprovar CRLV do veículo PBX-1D23' })).toBeTruthy();
  });

  it('a Frota sai da fila quando o último item pendente é decidido', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(within(fila()).getByRole('button', { name: /Rebocadora Sul/ }));
    await screen.findByRole('heading', { name: 'Rebocadora Sul' });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar Alvará' }));

    await waitFor(() => expect(within(fila()).queryByText(/Rebocadora Sul/)).toBeNull());
    expect(api.listarFilaHomologacao.mock.calls.length).toBeGreaterThan(1);
    expect(await screen.findByRole('heading', { name: 'Guincho Capital' })).toBeTruthy();
    const lateral = screen.getByRole('navigation', { name: 'Painel de operação' });
    expect(within(lateral).getByRole('link', { name: /Homologação/ }).textContent).toBe(
      'Homologação1',
    );
  });

  it('mostra o erro da API sem mudar o item', async () => {
    const api = apiFalsa({ sessao: true });
    api.aprovarItem.mockRejectedValue(
      new ErroApi('transicao_invalida', 'Este item já foi decidido ou aguarda reenvio'),
    );
    await abrir(api);
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar Apólice de RC por avaria' }));

    expect((await screen.findByRole('status')).textContent).toContain(
      'Este item já foi decidido ou aguarda reenvio',
    );
    expect(within(itemDe('Apólice de RC por avaria')).getByText('Pendente')).toBeTruthy();
  });
});

describe('Homologação: documento', () => {
  it('abre o documento pela URL assinada numa aba nova', async () => {
    const janela = { location: { href: '' }, close: vi.fn(), opener: {} };
    const abrirJanela = vi.spyOn(window, 'open').mockReturnValue(janela as unknown as Window);
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver documento: Apólice de RC por avaria' }),
    );

    await waitFor(() =>
      expect(janela.location.href).toBe('https://documentos.exemplo/i-apolice?token=x'),
    );
    expect(api.urlDoDocumento).toHaveBeenCalledWith('i-apolice');
    expect(abrirJanela).toHaveBeenCalledTimes(1);
    expect(janela.opener).toBeNull();
    expect(janela.close).not.toHaveBeenCalled();
  });

  it('se o documento não abre, fecha a aba e avisa', async () => {
    const janela = { location: { href: '' }, close: vi.fn(), opener: {} };
    vi.spyOn(window, 'open').mockReturnValue(janela as unknown as Window);
    const api = apiFalsa({ sessao: true });
    api.urlDoDocumento.mockRejectedValue(new ErroApi('falha', 'Documento indisponível'));
    await abrir(api);
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver documento: Alvará' }));

    expect((await screen.findByRole('status')).textContent).toContain('Documento indisponível');
    expect(janela.close).toHaveBeenCalled();
  });
});

describe('Homologação: documentos do Guincheiro (#47)', () => {
  const FROTA = 'f0000000-0000-4000-8000-000000000010';
  const doGuincheiro = (
    id: string,
    tipo: ItemHomologacao['tipo'],
    extra: Partial<ItemHomologacao> = {},
  ): ItemHomologacao => ({
    id,
    alvo: 'guincheiro',
    alvoId: 'c1000000-0000-4000-8000-000000000001',
    tipo,
    estado: 'pendente',
    motivo: null,
    validade: null,
    enviadoEm: '2026-10-23T12:00:00Z',
    guincheiro: 'Carla Dias',
    ...extra,
  });
  const frotaComGuincheiro = (): FrotaEmHomologacao => ({
    id: FROTA,
    nome: 'Reboque Planalto',
    tipo: 'empresa',
    documento: '11222333000181',
    veiculos: [],
    vinculos: [],
    itens: [
      doGuincheiro('g-cnh', 'cnh', {
        validade: '2030-05-20',
        cnh: { numero: '04512398765', categoria: 'C', validade: '2030-05-20', ear: true },
      }),
      doGuincheiro('g-ant', 'antecedentes', {
        validade: '2027-03-10',
        antecedentesEmissao: '2026-03-10',
      }),
      doGuincheiro('g-selfie', 'selfie'),
      doGuincheiro('o-cnh', 'cnh', {
        guincheiro: 'Otávio Reis',
        validade: '2029-01-02',
        cnh: null,
      }),
    ],
  });

  it('a Frota com documento de Guincheiro pendente aparece na fila com a contagem', async () => {
    await abrir(apiFalsa({ sessao: true, frotas: [frotaComGuincheiro()] }));
    const botao = await within(fila()).findByRole('button', { name: /Reboque Planalto/ });
    expect(botao.textContent).toContain('4 itens pendentes');
  });

  it('a CNH mostra número, categoria, validade e EAR; a certidão, a emissão e os 12 meses', async () => {
    await abrir(apiFalsa({ sessao: true, frotas: [frotaComGuincheiro()] }));
    await screen.findByRole('heading', { name: 'Reboque Planalto' });

    const cnh = itemDe('CNH do Guincheiro · Carla Dias');
    expect(within(cnh).getByText(/Guincheiro Carla Dias/)).toBeTruthy();
    expect(within(cnh).getByLabelText('Dados da CNH').textContent).toBe(
      'Número04512398765CategoriaCValidade20/05/2030Observação EARSim',
    );

    const ant = itemDe('Certidão de antecedentes · Carla Dias');
    expect(within(ant).getByLabelText('Dados da certidão').textContent).toBe(
      'Emissão10/03/2026Vale 12 meses, até10/03/2027',
    );
  });

  it('CNH sem dados em colunas (item de fora do app) manda conferir na foto', async () => {
    await abrir(apiFalsa({ sessao: true, frotas: [frotaComGuincheiro()] }));
    await screen.findByRole('heading', { name: 'Reboque Planalto' });
    expect(
      within(itemDe('CNH do Guincheiro · Otávio Reis')).getByText(
        'Dados da CNH não informados: confira na foto.',
      ),
    ).toBeTruthy();
  });

  it('aprova a CNH e recusa a selfie com motivo, cada um do seu Guincheiro', async () => {
    const api = apiFalsa({ sessao: true, frotas: [frotaComGuincheiro()] });
    await abrir(api);
    await screen.findByRole('heading', { name: 'Reboque Planalto' });

    fireEvent.click(screen.getByRole('button', { name: 'Aprovar CNH do Guincheiro · Carla Dias' }));
    await waitFor(() =>
      expect(within(itemDe('CNH do Guincheiro · Carla Dias')).getByText('Aprovado')).toBeTruthy(),
    );
    expect(api.aprovarItem).toHaveBeenCalledWith('g-cnh');
    expect(within(itemDe('CNH do Guincheiro · Otávio Reis')).getByText('Pendente')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Recusar Selfie do Guincheiro · Carla Dias' }),
    );
    fireEvent.change(screen.getByLabelText('Motivo da recusa'), {
      target: { value: 'Rosto de boné' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recusa' }));
    await waitFor(() =>
      expect(
        within(itemDe('Selfie do Guincheiro · Carla Dias')).getByText('Recusado'),
      ).toBeTruthy(),
    );
    expect(api.recusarItem).toHaveBeenCalledWith('g-selfie', 'Rosto de boné');
  });

  it('a certidão recusa com motivo como os outros itens', async () => {
    const api = apiFalsa({ sessao: true, frotas: [frotaComGuincheiro()] });
    await abrir(api);
    await screen.findByRole('heading', { name: 'Reboque Planalto' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Recusar Certidão de antecedentes · Carla Dias' }),
    );
    fireEvent.change(screen.getByLabelText('Motivo da recusa'), {
      target: { value: 'Falta a certidão da PF' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recusa' }));
    await waitFor(() =>
      expect(api.recusarItem).toHaveBeenCalledWith('g-ant', 'Falta a certidão da PF'),
    );
  });
});

describe('Homologação: veículos da Frota (#45)', () => {
  it('mostra os itens do veículo com a placa, o tipo e o PBT', async () => {
    await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });

    const crlv = itemDe('CRLV do veículo PBX-1D23');
    expect(within(crlv).getByText('Pendente')).toBeTruthy();
    expect(
      within(crlv).getByText(/Veículo PBX-1D23 \(Plataforma, PBT 4\.500 kg\) · Sem validade/),
    ).toBeTruthy();
    // A operação confere o registro como reboque no DETRAN (invariante 3).
    expect(within(crlv).getByText(/registro do veículo como reboque no DETRAN/)).toBeTruthy();

    expect(within(itemDe('Foto 1 do veículo PBX-1D23')).getByText('Aprovado')).toBeTruthy();
    const recusada = itemDe('Foto 2 do veículo PBX-1D23');
    expect(within(recusada).getByText('Recusado')).toBeTruthy();
    expect(within(recusada).getByText(/Motivo: Foto escura/)).toBeTruthy();
  });

  it('aprova o CRLV do veículo pendente', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar CRLV do veículo PBX-1D23' }));

    await waitFor(() =>
      expect(within(itemDe('CRLV do veículo PBX-1D23')).getByText('Aprovado')).toBeTruthy(),
    );
    expect(api.aprovarItem).toHaveBeenCalledWith('i-crlv');
    expect((await screen.findByRole('status')).textContent).toContain(
      'CRLV do veículo PBX-1D23 aprovado.',
    );
  });

  it('abre o CRLV do veículo pela URL assinada', async () => {
    const janela = { location: { href: '' }, close: vi.fn(), opener: {} };
    vi.spyOn(window, 'open').mockReturnValue(janela as unknown as Window);
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver documento: CRLV do veículo PBX-1D23' }),
    );
    await waitFor(() =>
      expect(janela.location.href).toBe('https://documentos.exemplo/i-crlv?token=x'),
    );
    expect(api.urlDoDocumento).toHaveBeenCalledWith('i-crlv');
  });
});

describe('Homologação: aviso CNH × PBT ao aprovar a CNH (#48)', () => {
  const CARLA = 'c1000000-0000-4000-8000-000000000001';
  const LEVE = 'b2000000-0000-4000-8000-000000000001';
  const PESADO = 'b2000000-0000-4000-8000-000000000002';
  const frotaCom = (
    categoria: string,
    vinculos: FrotaEmHomologacao['vinculos'],
    veiculos: FrotaEmHomologacao['veiculos'] = [
      { id: LEVE, placa: 'ZQK3F55', tipo: 'lanca', pbtKg: 3500 },
      { id: PESADO, placa: 'ZQK4G66', tipo: 'plataforma', pbtKg: 4200 },
    ],
  ): FrotaEmHomologacao => ({
    id: 'f0000000-0000-4000-8000-000000000020',
    nome: 'Guinchos do Planalto',
    tipo: 'empresa',
    documento: '11222333000181',
    veiculos,
    vinculos,
    itens: [
      {
        id: 'c-cnh',
        alvo: 'guincheiro',
        alvoId: CARLA,
        tipo: 'cnh',
        estado: 'pendente',
        motivo: null,
        validade: '2030-05-20',
        enviadoEm: '2026-10-24T12:00:00Z',
        guincheiro: 'Carla Dias',
        cnh: { numero: '04512398765', categoria, validade: '2030-05-20', ear: true },
      },
    ],
  });
  const aviso = () =>
    within(itemDe('CNH do Guincheiro · Carla Dias')).queryByRole('note', {
      name: 'Aviso CNH × PBT',
    });

  it('CNH B: mostra o que cobre, o que não cobre e o vínculo que a aprovação derrubaria', async () => {
    await abrir(
      apiFalsa({
        sessao: true,
        frotas: [
          frotaCom('B', [
            { id: 'v1', veiculoId: PESADO, guincheiroId: CARLA, situacao: 'pendente' },
          ]),
        ],
      }),
    );
    await screen.findByRole('heading', { name: 'Guinchos do Planalto' });
    const caixa = within(aviso()!);
    expect(caixa.getByText('CNH × PBT · categoria B')).toBeTruthy();
    expect(caixa.getByText(/ZQK-3F55 \(PBT 3\.500 kg\): a categoria cobre/)).toBeTruthy();
    expect(
      caixa.getByText(
        /ZQK-4G66 \(PBT 4\.200 kg\): a categoria não cobre · vinculado a este Guincheiro/,
      ),
    ).toBeTruthy();
    expect(caixa.getByRole('alert').textContent).toContain(
      'Aprovar derruba o vínculo deste Guincheiro com ZQK-4G66',
    );
  });

  it('CNH C cobre a Frota inteira: nada cai e o aviso diz que o vínculo se mantém', async () => {
    await abrir(
      apiFalsa({
        sessao: true,
        frotas: [
          frotaCom('C', [
            { id: 'v1', veiculoId: PESADO, guincheiroId: CARLA, situacao: 'pendente' },
          ]),
        ],
      }),
    );
    await screen.findByRole('heading', { name: 'Guinchos do Planalto' });
    const caixa = within(aviso()!);
    expect(caixa.queryByRole('alert')).toBeNull();
    expect(caixa.getAllByText(/a categoria cobre/)).toHaveLength(2);
    expect(caixa.getByText('Aprovar mantém os vínculos existentes deste Guincheiro.')).toBeTruthy();
  });

  it('sem vínculo do Guincheiro, só informa a cobertura', async () => {
    await abrir(apiFalsa({ sessao: true, frotas: [frotaCom('B', [])] }));
    await screen.findByRole('heading', { name: 'Guinchos do Planalto' });
    const caixa = within(aviso()!);
    expect(caixa.queryByRole('alert')).toBeNull();
    expect(
      caixa.getByText('Este Guincheiro ainda não está vinculado a nenhum veículo.'),
    ).toBeTruthy();
  });

  it('Frota sem veículos: diz que não há o que conferir', async () => {
    await abrir(apiFalsa({ sessao: true, frotas: [frotaCom('B', [], [])] }));
    await screen.findByRole('heading', { name: 'Guinchos do Planalto' });
    expect(
      within(aviso()!).getByText(/não tem veículos cadastrados: não há o que conferir/),
    ).toBeTruthy();
  });

  it('vínculo de outro Guincheiro não entra na conta, e CNH já decidida não mostra o aviso', async () => {
    const frota = frotaCom('B', [
      { id: 'v9', veiculoId: PESADO, guincheiroId: 'outro-guincheiro', situacao: 'ativo' },
    ]);
    await abrir(apiFalsa({ sessao: true, frotas: [frota] }));
    await screen.findByRole('heading', { name: 'Guinchos do Planalto' });
    expect(within(aviso()!).queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Aprovar CNH do Guincheiro · Carla Dias' }));
    await waitFor(() => expect(screen.queryByRole('note', { name: 'Aviso CNH × PBT' })).toBeNull());
  });
});
