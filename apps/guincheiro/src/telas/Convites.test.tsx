import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi, type ConviteGuincheiro, type MinhaFrota } from '@guinchei/api';
import { ITEM_ALVARA, ITEM_APOLICE, PERFIL_AURORA, apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const tocar = (nome: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nome }));
const tela = (nome: string) => screen.findByRole('main', { name: nome });

const FROTA: MinhaFrota = {
  id: 'f1',
  tipo: 'autonomo',
  documento: '52998224725',
  nome: 'Aurora Guinchos',
  ativa: false,
  pendenciasDeAtivacao: [],
  baseCep: '70000000',
  baseEndereco: 'SQN 308',
  baseBairro: 'Asa Norte',
  chavePix: 'x',
  apoliceValidade: '2026-11-17',
  termosPrestadorVersao: 'v',
  itens: [ITEM_ALVARA, ITEM_APOLICE],
};

const CONVITE: ConviteGuincheiro = {
  id: 'convite-0',
  telefone: '5561999990001',
  criadoEm: '2026-10-21T12:00:00Z',
  validoAte: '2026-10-28T12:00:00Z',
  vencido: false,
};

const representante = (extra: Parameters<typeof apiFalsa>[0] = {}) =>
  apiFalsa({ sessao: true, perfil: PERFIL_AURORA, frota: FROTA, ...extra });

describe('Convites da Frota', () => {
  it('a Frota do representante tem o caminho para convidar Guincheiros', async () => {
    renderEm('/frota', representante());
    await tela('Minha Frota');
    tocar('Convidar Guincheiros');
    expect(await tela('Convites')).toBeTruthy();
    tocar('Voltar');
    expect(await tela('Minha Frota')).toBeTruthy();
  });

  it('lista os convites pendentes e os Guincheiros já vinculados', async () => {
    renderEm(
      '/frota/convites',
      representante({
        convites: [
          CONVITE,
          { ...CONVITE, id: 'convite-1', telefone: '5561999990002', vencido: true },
        ],
        guincheirosDaFrota: [
          {
            id: 'g1',
            nome: 'Carla Dias',
            telefone: '5561999990003',
            disponivel: false,
            criadoEm: '2026-10-20T12:00:00Z',
          },
        ],
      }),
    );
    const pendentes = within(await screen.findByRole('list', { name: 'Convites pendentes' }));
    expect(pendentes.getByText('(61) 99999-0001')).toBeTruthy();
    expect(pendentes.getByText('Vale até 28/10/2026')).toBeTruthy();
    expect(pendentes.getByText('(61) 99999-0002')).toBeTruthy();
    expect(pendentes.getByText('Vencido: convide de novo')).toBeTruthy();

    const vinculados = within(screen.getByRole('list', { name: 'Guincheiros da Frota' }));
    expect(vinculados.getByText('Carla Dias')).toBeTruthy();
    expect(vinculados.getByText('(61) 99999-0003')).toBeTruthy();
  });

  it('sem convites nem Guincheiros, diz que não há', async () => {
    renderEm('/frota/convites', representante());
    expect(await screen.findByText('Nenhum convite pendente.')).toBeTruthy();
    expect(screen.getByText('Nenhum Guincheiro vinculado ainda.')).toBeTruthy();
  });

  it('convida pelo celular em E.164 e o convite aparece na lista', async () => {
    const api = representante();
    renderEm('/frota/convites', api);
    await screen.findByText('Nenhum convite pendente.');
    const convidar = screen.getByRole<HTMLButtonElement>('button', { name: 'Convidar' });
    expect(convidar.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Celular com DDD'), {
      target: { value: '61999990001' },
    });
    expect((screen.getByLabelText('Celular com DDD') as HTMLInputElement).value).toBe(
      '(61) 99999-0001',
    );
    fireEvent.click(convidar);

    const pendentes = within(await screen.findByRole('list', { name: 'Convites pendentes' }));
    expect(pendentes.getByText('(61) 99999-0001')).toBeTruthy();
    expect(api.convidarGuincheiro).toHaveBeenCalledWith('+5561999990001');
    expect((screen.getByLabelText('Celular com DDD') as HTMLInputElement).value).toBe('');
  });

  it('cada recusa do servidor tem a sua mensagem', async () => {
    const api = representante();
    renderEm('/frota/convites', api);
    await screen.findByText('Nenhum convite pendente.');
    const casos: [ErroApi, string][] = [
      [
        new ErroApi('convite_repetido', 'x'),
        'Este número já tem um convite pendente na sua Frota.',
      ],
      [
        new ErroApi('convidado_por_outra_frota', 'x'),
        'Este número já foi convidado por outra Frota.',
      ],
      [new ErroApi('numero_ja_tem_conta', 'x'), 'Este número já tem conta no Guinchei.'],
      [new ErroApi('falha', 'x'), 'Não foi possível enviar o convite. Tente de novo.'],
    ];
    fireEvent.change(screen.getByLabelText('Celular com DDD'), {
      target: { value: '61999990001' },
    });
    for (const [erro, mensagem] of casos) {
      api.convidarGuincheiro.mockRejectedValueOnce(erro);
      tocar('Convidar');
      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(mensagem));
    }
    // O número digitado fica para corrigir.
    expect((screen.getByLabelText('Celular com DDD') as HTMLInputElement).value).toBe(
      '(61) 99999-0001',
    );
  });

  it('cancela um convite pendente', async () => {
    const api = representante({ convites: [CONVITE] });
    renderEm('/frota/convites', api);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancelar o convite de (61) 99999-0001' }),
    );
    expect(await screen.findByText('Nenhum convite pendente.')).toBeTruthy();
    expect(api.cancelarConvite).toHaveBeenCalledWith('convite-0');
  });

  it('convite que já foi decidido em outro lugar avisa e relê a lista', async () => {
    const api = representante({ convites: [CONVITE] });
    renderEm('/frota/convites', api);
    const cancelar = await screen.findByRole('button', {
      name: 'Cancelar o convite de (61) 99999-0001',
    });
    api.cancelarConvite.mockRejectedValueOnce(
      new ErroApi('convite_indisponivel', 'O convite não está mais pendente'),
    );
    api.listarConvites.mockResolvedValueOnce([]);
    fireEvent.click(cancelar);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Este convite já não está pendente.',
    );
    expect(await screen.findByText('Nenhum convite pendente.')).toBeTruthy();
  });

  it('avisa quando não consegue ler os convites', async () => {
    const api = representante();
    api.listarConvites.mockRejectedValueOnce(new ErroApi('falha', 'x'));
    renderEm('/frota/convites', api);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não foi possível ler os convites. Tente de novo.',
    );
  });

  it('o autônomo (Guincheiro da própria Frota) abre os convites em vez de cair no plantão', async () => {
    renderEm('/frota/convites', apiFalsa({ sessao: true, frota: FROTA }));
    expect(await tela('Convites')).toBeTruthy();
  });

  it('só o representante gerencia convites: sem sessão, entra; Guincheiro, volta ao plantão', async () => {
    renderEm('/frota/convites', apiFalsa());
    expect(await screen.findByLabelText('Celular com DDD')).toBeTruthy();
    cleanup();

    renderEm('/frota/convites', apiFalsa({ sessao: true }));
    expect(await screen.findByRole('main', { name: 'Em plantão' })).toBeTruthy();
  });
});
