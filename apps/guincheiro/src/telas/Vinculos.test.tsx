import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  CnhDoGuincheiro,
  GuincheiroDaFrota,
  MeuVeiculo,
  MinhaFrota,
  VeiculoDaFrota,
} from '@guinchei/api';
import {
  ITEM_ALVARA,
  ITEM_APOLICE,
  PERFIL_AURORA,
  PERFIL_MARCOS,
  VEICULO_APROVADO,
  VEICULO_RECUSADO,
  apiFalsa,
} from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const tocar = (nome: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nome }));
const tela = (nome: string) => screen.findByRole('main', { name: nome });

const FROTA: MinhaFrota = {
  id: 'f1',
  tipo: 'empresa',
  documento: '12345678000195',
  nome: 'Aurora Guinchos',
  ativa: true,
  pendenciasDeAtivacao: [],
  baseCep: '70000000',
  baseEndereco: 'SQN 308',
  baseBairro: 'Asa Norte',
  chavePix: 'x',
  apoliceValidade: '2027-11-17',
  termosPrestadorVersao: 'v',
  itens: [ITEM_ALVARA, ITEM_APOLICE],
};

const guincheiro = (id: string, nome: string): GuincheiroDaFrota => ({
  id,
  nome,
  telefone: '5561999990000',
  disponivel: false,
  criadoEm: '2026-10-20T12:00:00Z',
});

const CARLA = guincheiro('g-carla', 'Carla Dias');
const DANIEL = guincheiro('g-daniel', 'Daniel Reis');
const OTAVIO = guincheiro('g-otavio', 'Otávio Reis');

const CNH: Record<string, CnhDoGuincheiro> = {
  carlaB: { guincheiroId: CARLA.id, categoria: 'B', estado: 'aprovado' },
  danielC: { guincheiroId: DANIEL.id, categoria: 'C', estado: 'aprovado' },
  otavioEmAnalise: { guincheiroId: OTAVIO.id, categoria: 'B', estado: 'pendente' },
};

// VEICULO_APROVADO: 4.500 kg. VEICULO_RECUSADO: 3.200 kg. O terceiro está no limite da categoria B.
const NO_LIMITE: VeiculoDaFrota = {
  ...VEICULO_RECUSADO,
  id: 'veiculo-3',
  placa: 'KLM3500',
  pbtKg: 3500,
};

const representante = (extra: Parameters<typeof apiFalsa>[0] = {}) =>
  apiFalsa({
    sessao: true,
    perfil: PERFIL_AURORA,
    frota: FROTA,
    veiculos: [VEICULO_APROVADO, VEICULO_RECUSADO, NO_LIMITE],
    guincheirosDaFrota: [CARLA, DANIEL, OTAVIO],
    cnhs: [CNH.carlaB!, CNH.danielC!, CNH.otavioEmAnalise!],
    ...extra,
  });

const cartaoDe = (nome: string) =>
  within(screen.getByRole('listitem', { name: `Guincheiro ${nome}` }));
const escolher = (nome: string, veiculoId: string) =>
  fireEvent.change(cartaoDe(nome).getByLabelText(`Veículo de ${nome}`), {
    target: { value: veiculoId },
  });

describe('Vínculos: bloqueio CNH × PBT no app', () => {
  it('CNH B em veículo de 4.500 kg: recusa antes de confirmar, explica o motivo e a saída', async () => {
    const api = representante();
    renderEm('/frota/vinculos', api);
    await tela('Vínculos');
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    escolher('Carla Dias', 'veiculo-1');

    const alerta = cartaoDe('Carla Dias').getByRole('alert', {
      name: 'Vínculo não permitido para Carla Dias',
    });
    expect(alerta.textContent).toContain('Não é possível vincular Carla Dias a este veículo');
    expect(alerta.textContent).toContain('CNH B não cobre guincho de 4.500 kg');
    expect(alerta.textContent).toContain('exige categoria C ou superior');
    expect(alerta.textContent).toContain('O que fazer:');
    expect(alerta.textContent).toContain('um Guincheiro com CNH C ou superior');
    expect(alerta.textContent).toContain('um veículo de até 3.500 kg');
    // Sem botão de confirmar: o vínculo nem é tentado.
    expect(cartaoDe('Carla Dias').queryByRole('button', { name: /Confirmar vínculo/ })).toBeNull();
    expect(api.vincularGuincheiro).not.toHaveBeenCalled();
  });

  it('CNH C no mesmo veículo é aceita e o vínculo fica ativo', async () => {
    const api = representante();
    renderEm('/frota/vinculos', api);
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    escolher('Daniel Reis', 'veiculo-1');
    expect(cartaoDe('Daniel Reis').getByText(/CNH C cobre guincho de 4\.500 kg/)).toBeTruthy();
    expect(cartaoDe('Daniel Reis').queryByRole('alert')).toBeNull();

    tocar('Confirmar vínculo de Daniel Reis com ABC-1D23');
    expect(await screen.findByText('Daniel Reis vinculado ao veículo ABC-1D23.')).toBeTruthy();
    expect(api.vincularGuincheiro).toHaveBeenCalledWith('g-daniel', 'veiculo-1');
    await waitFor(() => expect(cartaoDe('Daniel Reis').getByText('Vínculo ativo')).toBeTruthy());
    expect(
      cartaoDe('Daniel Reis').getByText(/Veículo: ABC-1D23 · Plataforma · 4\.500 kg/),
    ).toBeTruthy();
  });

  it('CNH B em veículo de exatamente 3.500 kg é aceita; em 3.200 kg também', async () => {
    const api = representante();
    renderEm('/frota/vinculos', api);
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    escolher('Carla Dias', 'veiculo-3');
    expect(cartaoDe('Carla Dias').queryByRole('alert')).toBeNull();
    tocar('Confirmar vínculo de Carla Dias com KLM-3500');
    await waitFor(() => expect(cartaoDe('Carla Dias').getByText('Vínculo ativo')).toBeTruthy());
    expect(api.vincularGuincheiro).toHaveBeenCalledWith('g-carla', 'veiculo-3');

    // Veículo de 3.200 kg para outro Guincheiro de CNH B (aprovada).
    const outra = representante({ cnhs: [{ ...CNH.carlaB!, guincheiroId: DANIEL.id }] });
    cleanup();
    renderEm('/frota/vinculos', outra);
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    escolher('Daniel Reis', 'veiculo-2');
    expect(cartaoDe('Daniel Reis').queryByRole('alert')).toBeNull();
    expect(cartaoDe('Daniel Reis').getByText(/CNH B cobre guincho de 3\.200 kg/)).toBeTruthy();
  });

  it('CNH A (que não conduz guincho) é recusada em qualquer veículo e pede outro Guincheiro', async () => {
    renderEm(
      '/frota/vinculos',
      representante({ cnhs: [{ guincheiroId: CARLA.id, categoria: 'A', estado: 'aprovado' }] }),
    );
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    escolher('Carla Dias', 'veiculo-2');
    const alerta = cartaoDe('Carla Dias').getByRole('alert');
    expect(alerta.textContent).toContain('CNH A não habilita conduzir guincho');
    expect(alerta.textContent).toContain('outro Guincheiro, com CNH B ou superior');
  });

  it('CNH em análise: o vínculo é permitido como pendente, com a explicação', async () => {
    const api = representante();
    renderEm('/frota/vinculos', api);
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    expect(cartaoDe('Otávio Reis').getByText('CNH B · em análise pela operação')).toBeTruthy();
    escolher('Otávio Reis', 'veiculo-1');
    const aviso = cartaoDe('Otávio Reis').getByRole('status');
    expect(aviso.textContent).toContain('O vínculo ficará pendente');
    expect(aviso.textContent).toContain('o vínculo é desfeito na aprovação');

    tocar('Confirmar vínculo de Otávio Reis com ABC-1D23');
    await waitFor(() =>
      expect(
        cartaoDe('Otávio Reis').getByText('Vínculo pendente: aguardando a aprovação da CNH'),
      ).toBeTruthy(),
    );
    expect(api.vincularGuincheiro).toHaveBeenCalledWith('g-otavio', 'veiculo-1');
  });

  it('Guincheiro que ainda não enviou a CNH também fica pendente', async () => {
    renderEm('/frota/vinculos', representante({ cnhs: [] }));
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    expect(cartaoDe('Carla Dias').getByText('CNH ainda não enviada')).toBeTruthy();
    escolher('Carla Dias', 'veiculo-1');
    expect(cartaoDe('Carla Dias').getByRole('status').textContent).toContain(
      'ainda não enviou a CNH',
    );
    expect(
      cartaoDe('Carla Dias').getByRole('button', { name: /Confirmar vínculo de Carla Dias/ })
        .textContent,
    ).toBe('Confirmar vínculo pendente');
  });

  it('se a CNH mudou com a tela aberta, o banco recusa e a tela passa a mostrar o aviso', async () => {
    const api = representante();
    renderEm('/frota/vinculos', api);
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    escolher('Daniel Reis', 'veiculo-1');
    // A operação aprova outra CNH (B) depois de a tela abrir: o app não decide, o servidor sim.
    api.mudarCnh(DANIEL.id, { categoria: 'B', estado: 'aprovado' });
    tocar('Confirmar vínculo de Daniel Reis com ABC-1D23');

    expect(
      await screen.findByText(
        'O vínculo foi recusado: a CNH de Daniel Reis não cobre o PBT deste veículo. Atualizamos a tela.',
      ),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        cartaoDe('Daniel Reis').getByRole('alert', {
          name: 'Vínculo não permitido para Daniel Reis',
        }),
      ).toBeTruthy(),
    );
  });
});

describe('Vínculos: ver e desfazer', () => {
  const comVinculos = () =>
    representante({
      vinculos: [
        { id: 'vinculo-a', veiculoId: 'veiculo-1', guincheiroId: DANIEL.id, situacao: 'ativo' },
        { id: 'vinculo-b', veiculoId: 'veiculo-3', guincheiroId: OTAVIO.id, situacao: 'pendente' },
      ],
    });

  it('mostra em qual veículo cada Guincheiro está e a situação do vínculo', async () => {
    renderEm('/frota/vinculos', comVinculos());
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    expect(cartaoDe('Daniel Reis').getByText('Vínculo ativo')).toBeTruthy();
    expect(cartaoDe('Otávio Reis').getByText(/Veículo: KLM-3500 · Lança · 3\.500 kg/)).toBeTruthy();
    expect(
      cartaoDe('Otávio Reis').getByText('Vínculo pendente: aguardando a aprovação da CNH'),
    ).toBeTruthy();
    // Quem já tem veículo não escolhe outro sem desfazer; quem não tem, escolhe.
    expect(cartaoDe('Daniel Reis').queryByLabelText('Veículo de Daniel Reis')).toBeNull();
    expect(cartaoDe('Carla Dias').getByLabelText('Veículo de Carla Dias')).toBeTruthy();
  });

  it('desfaz o vínculo depois de confirmar, e o Guincheiro volta a poder escolher', async () => {
    const api = comVinculos();
    renderEm('/frota/vinculos', api);
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    tocar('Desfazer vínculo de Daniel Reis');
    expect(
      cartaoDe('Daniel Reis').getByText(
        /Desfazer o vínculo de Daniel Reis com o veículo ABC-1D23\?/,
      ),
    ).toBeTruthy();
    expect(api.desfazerVinculo).not.toHaveBeenCalled();

    tocar('Confirmar: desfazer vínculo de Daniel Reis');
    expect((await screen.findByRole('status')).textContent).toBe(
      'Vínculo de Daniel Reis desfeito.',
    );
    expect(api.desfazerVinculo).toHaveBeenCalledWith('vinculo-a');
    await waitFor(() =>
      expect(cartaoDe('Daniel Reis').getByLabelText('Veículo de Daniel Reis')).toBeTruthy(),
    );
  });

  it('"Manter" desiste de desfazer', async () => {
    const api = comVinculos();
    renderEm('/frota/vinculos', api);
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    tocar('Desfazer vínculo de Daniel Reis');
    tocar('Manter');
    expect(api.desfazerVinculo).not.toHaveBeenCalled();
    expect(cartaoDe('Daniel Reis').getByText('Vínculo ativo')).toBeTruthy();
  });

  it('avisa quais vínculos a conferência da CNH desfez, com o motivo', async () => {
    renderEm(
      '/frota/vinculos',
      representante({
        encerrados: [
          {
            id: 1,
            guincheiroId: CARLA.id,
            veiculoId: 'veiculo-1',
            placa: 'ABC1D23',
            motivo: 'cnh_nao_cobre',
            detalhe: 'CNH B não cobre o PBT de 4500 kg',
            encerradoEm: '2026-10-24T12:00:00Z',
          },
          {
            id: 2,
            guincheiroId: DANIEL.id,
            veiculoId: 'veiculo-3',
            placa: 'KLM3500',
            motivo: 'desfeito_pelo_representante',
            detalhe: null,
            encerradoEm: '2026-10-24T13:00:00Z',
          },
        ],
      }),
    );
    const secao = within(
      await screen.findByRole('region', { name: 'Vínculos desfeitos pela conferência da CNH' }),
    );
    expect(
      secao.getByText(/Carla Dias saiu do veículo ABC-1D23: CNH B não cobre o PBT de 4500 kg/),
    ).toBeTruthy();
    // O que o próprio representante desfez não vira aviso.
    expect(secao.queryByText(/KLM-3500/)).toBeNull();
  });
});

describe('Vínculos: estados vazios e acesso', () => {
  it('sem Guincheiros na Frota, convida para convidar', async () => {
    renderEm('/frota/vinculos', representante({ guincheirosDaFrota: [], cnhs: [] }));
    expect(await screen.findByText('A Frota ainda não tem Guincheiros')).toBeTruthy();
    tocar('Convidar o primeiro Guincheiro');
    expect(await tela('Convites')).toBeTruthy();
  });

  it('com Guincheiros mas sem veículos, convida para cadastrar o veículo', async () => {
    renderEm('/frota/vinculos', representante({ veiculos: [] }));
    expect(await screen.findByText('Cadastre um veículo para vincular')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Guincheiros e veículos' })).toBeNull();
    tocar('Cadastrar veículo');
    expect(await tela('Veículo: dados')).toBeTruthy();
  });

  it('quem não representa uma Frota (Guincheiro de empresa) volta ao plantão', async () => {
    renderEm('/frota/vinculos', apiFalsa({ sessao: true, perfil: PERFIL_MARCOS }));
    expect(await tela('Em plantão')).toBeTruthy();
  });

  it('sem sessão, manda entrar', async () => {
    renderEm('/frota/vinculos', apiFalsa());
    expect(await screen.findByRole('textbox')).toBeTruthy();
  });

  it('a Frota tem o caminho para os vínculos', async () => {
    renderEm('/frota', representante());
    await tela('Minha Frota');
    tocar('Vincular Guincheiros a veículos');
    expect(await tela('Vínculos')).toBeTruthy();
  });

  it('o autônomo, que também é Guincheiro, gere o próprio vínculo', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_AURORA,
      frota: { ...FROTA, tipo: 'autonomo' },
      guincheiroDaPropriaFrota: true,
      veiculos: [VEICULO_APROVADO],
      guincheirosDaFrota: [guincheiro(PERFIL_AURORA.id, 'Aurora Lima')],
      cnhs: [{ guincheiroId: PERFIL_AURORA.id, categoria: 'C', estado: 'aprovado' }],
    });
    renderEm('/frota/vinculos', api);
    await screen.findByRole('list', { name: 'Guincheiros e veículos' });
    escolher('Aurora Lima', 'veiculo-1');
    tocar('Confirmar vínculo de Aurora Lima com ABC-1D23');
    await waitFor(() => expect(cartaoDe('Aurora Lima').getByText('Vínculo ativo')).toBeTruthy());
  });

  it('se a leitura falha, avisa em vez de mostrar uma lista vazia', async () => {
    const api = representante();
    api.listarVinculos.mockRejectedValue(new Error('rede'));
    renderEm('/frota/vinculos', api);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Não foi possível ler os vínculos',
    );
  });
});

describe('O Guincheiro vê o próprio veículo', () => {
  const MEU: MeuVeiculo = {
    vinculoId: 'vinculo-a',
    situacao: 'ativo',
    veiculoId: 'veiculo-1',
    placa: 'ABC1D23',
    tipo: 'plataforma',
    pbtKg: 4500,
  };
  const guincheiroLogado = (extra: Parameters<typeof apiFalsa>[0] = {}) =>
    apiFalsa({ sessao: true, perfil: PERFIL_MARCOS, ...extra });

  it('mostra a placa, o tipo, o PBT e o vínculo ativo no plantão', async () => {
    renderEm('/', guincheiroLogado({ meuVeiculo: MEU }));
    const cartao = within(await screen.findByRole('region', { name: 'Meu veículo' }));
    expect(cartao.getByText('ABC-1D23')).toBeTruthy();
    expect(cartao.getByText('Plataforma · 4.500 kg')).toBeTruthy();
    expect(cartao.getByText('Vínculo ativo')).toBeTruthy();
  });

  it('vínculo pendente diz que vale quando a CNH for aprovada', async () => {
    renderEm('/', guincheiroLogado({ meuVeiculo: { ...MEU, situacao: 'pendente' } }));
    const cartao = within(await screen.findByRole('region', { name: 'Meu veículo' }));
    expect(
      cartao.getByText(/Vínculo pendente: vale quando a operação aprovar a sua CNH/),
    ).toBeTruthy();
  });

  it('sem veículo, explica a quem pedir', async () => {
    renderEm('/', guincheiroLogado());
    const cartao = within(await screen.findByRole('region', { name: 'Meu veículo' }));
    expect(cartao.getByText('Nenhum veículo vinculado a você')).toBeTruthy();
    expect(cartao.getByText(/Peça ao representante da sua Frota/)).toBeTruthy();
    expect(cartao.queryByRole('button')).toBeNull();
  });

  it('se o vínculo caiu porque a CNH não cobre o PBT, diz isso', async () => {
    renderEm(
      '/',
      guincheiroLogado({
        encerrados: [
          {
            id: 1,
            guincheiroId: PERFIL_MARCOS.id,
            veiculoId: 'veiculo-1',
            placa: 'ABC1D23',
            motivo: 'cnh_nao_cobre',
            detalhe: 'CNH B não cobre o PBT de 4500 kg',
            encerradoEm: '2026-10-24T12:00:00Z',
          },
          // De outro Guincheiro da Frota: não é dele.
          {
            id: 2,
            guincheiroId: 'outro',
            veiculoId: 'veiculo-3',
            placa: 'KLM3500',
            motivo: 'cnh_nao_cobre',
            detalhe: 'CNH A não cobre o PBT de 3500 kg',
            encerradoEm: '2026-10-24T13:00:00Z',
          },
        ],
      }),
    );
    const cartao = within(await screen.findByRole('region', { name: 'Meu veículo' }));
    expect(
      cartao.getByText(
        'O vínculo com o veículo ABC-1D23 foi desfeito: CNH B não cobre o PBT de 4500 kg.',
      ),
    ).toBeTruthy();
    expect(cartao.queryByText(/KLM-3500/)).toBeNull();
  });

  it('o autônomo sem veículo tem o caminho para escolher o próprio', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_AURORA,
      frota: { ...FROTA, tipo: 'autonomo' },
      guincheiroDaPropriaFrota: true,
    });
    renderEm('/', api);
    const cartao = within(await screen.findByRole('region', { name: 'Meu veículo' }));
    fireEvent.click(cartao.getByRole('button', { name: 'Escolher meu veículo' }));
    expect(await tela('Vínculos')).toBeTruthy();
  });
});
