import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi } from '@guinchei/api';
import {
  apiFalsa,
  CODIGO_CERTO,
  PERFIL_CLIENTE,
  PERFIL_GUINCHEIRO,
  PERFIL_OPERACAO,
} from './teste/apiFalsa';
import { renderEm } from './teste/renderizar';

afterEach(cleanup);

const AVISO_NAO_E_OPERACAO = 'Este número não está cadastrado como operação';

function digitarCelular(celular: string) {
  fireEvent.change(screen.getByLabelText('Celular com DDD'), { target: { value: celular } });
  fireEvent.click(screen.getByRole('button', { name: 'Receber código' }));
}

async function digitarCodigo(codigo: string) {
  const campo = await screen.findByLabelText('Código de 6 dígitos');
  fireEvent.change(campo, { target: { value: codigo } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
}

describe('Entrada da operação no Painel', () => {
  it('sem sessão, pede o celular em qualquer rota', async () => {
    renderEm('/precos', apiFalsa());
    expect(await screen.findByLabelText('Celular com DDD')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Painel de operação' })).toBeNull();
  });

  it('só libera o botão com o celular completo', async () => {
    renderEm('/entrar', apiFalsa());
    const botao = (await screen.findByRole('button', {
      name: 'Receber código',
    })) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Celular com DDD'), {
      target: { value: '61900000005' },
    });
    expect(botao.disabled).toBe(false);
  });

  it('a operação pede o código, confirma e entra com o nome vindo do perfil', async () => {
    const api = apiFalsa();
    renderEm('/entrar', api);
    await screen.findByLabelText('Celular com DDD');
    digitarCelular('61900000005');
    await digitarCodigo(CODIGO_CERTO);

    const lateral = await screen.findByRole('navigation', { name: 'Painel de operação' });
    expect(lateral.textContent).toContain('Operação Guinchei');
    expect(api.enviarCodigo).toHaveBeenCalledWith('+5561900000005');
    expect(api.confirmarCodigo).toHaveBeenCalledWith('+5561900000005', CODIGO_CERTO);
    expect(
      await screen.findByText('Monitor de Corridas', { selector: '.topo__titulo' }),
    ).toBeTruthy();
  });

  it('código errado avisa e deixa tentar de novo, sem entrar', async () => {
    const api = apiFalsa();
    renderEm('/entrar', api);
    await screen.findByLabelText('Celular com DDD');
    digitarCelular('61900000005');
    await digitarCodigo('000000');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Código incorreto ou expirado. Confira e tente de novo.',
    );
    expect(screen.queryByRole('navigation', { name: 'Painel de operação' })).toBeNull();
    expect(api.sair).not.toHaveBeenCalled();
  });

  it.each([
    ['Cliente', PERFIL_CLIENTE],
    ['Guincheiro', PERFIL_GUINCHEIRO],
  ])('número de %s: encerra a sessão e avisa que não é da operação', async (_papel, perfil) => {
    const api = apiFalsa({ perfil });
    renderEm('/entrar', api);
    await screen.findByLabelText('Celular com DDD');
    digitarCelular('61900000001');
    await digitarCodigo(CODIGO_CERTO);

    expect((await screen.findByRole('alert')).textContent).toBe(AVISO_NAO_E_OPERACAO);
    expect(api.sair).toHaveBeenCalledTimes(1);
    expect(await api.temSessao()).toBe(false);
    expect(screen.queryByRole('navigation', { name: 'Painel de operação' })).toBeNull();
  });

  it('número sem perfil também não entra', async () => {
    const api = apiFalsa({ perfil: null });
    renderEm('/entrar', api);
    await screen.findByLabelText('Celular com DDD');
    digitarCelular('61900000006');
    await digitarCodigo(CODIGO_CERTO);
    expect((await screen.findByRole('alert')).textContent).toBe(AVISO_NAO_E_OPERACAO);
    expect(api.sair).toHaveBeenCalledTimes(1);
  });

  it('sessão guardada de quem não é da operação é encerrada ao abrir', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_CLIENTE });
    renderEm('/monitor', api);
    await waitFor(() => expect(api.sair).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole('alert')).textContent).toBe(AVISO_NAO_E_OPERACAO);
    expect(screen.getByLabelText('Celular com DDD')).toBeTruthy();
  });

  it('sessão guardada da operação abre direto o Painel, com o nome do perfil', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_OPERACAO });
    renderEm('/', api);
    const lateral = await screen.findByRole('navigation', { name: 'Painel de operação' });
    expect(lateral.textContent).toContain('Operação Guinchei');
    expect(api.enviarCodigo).not.toHaveBeenCalled();
  });
});

describe('Sair do Painel', () => {
  it('o botão Sair da lateral encerra a sessão e volta para a entrada', async () => {
    const api = apiFalsa({ sessao: true });
    renderEm('/monitor', api);
    const lateral = await screen.findByRole('navigation', { name: 'Painel de operação' });
    fireEvent.click(within(lateral).getByRole('button', { name: 'Sair' }));

    expect(await screen.findByLabelText('Celular com DDD')).toBeTruthy();
    expect(api.sair).toHaveBeenCalledTimes(1);
    expect(await api.temSessao()).toBe(false);
    expect(screen.queryByRole('navigation', { name: 'Painel de operação' })).toBeNull();
  });

  it('depois de sair, as rotas do Painel pedem o celular de novo', async () => {
    const api = apiFalsa({ sessao: true });
    renderEm('/homologacao', api);
    const lateral = await screen.findByRole('navigation', { name: 'Painel de operação' });
    fireEvent.click(within(lateral).getByRole('button', { name: 'Sair' }));
    await screen.findByLabelText('Celular com DDD');
    expect(screen.queryByRole('heading', { name: 'Guincho Capital' })).toBeNull();
  });

  it('se não conseguir sair, avisa e continua no Painel', async () => {
    const api = apiFalsa({ sessao: true });
    api.sair.mockRejectedValueOnce(new ErroApi('falha', 'Não foi possível sair'));
    renderEm('/monitor', api);
    const lateral = await screen.findByRole('navigation', { name: 'Painel de operação' });
    fireEvent.click(within(lateral).getByRole('button', { name: 'Sair' }));

    expect((await screen.findByRole('status')).textContent).toContain('Não foi possível sair');
    expect(screen.getByRole('navigation', { name: 'Painel de operação' })).toBeTruthy();
  });
});
