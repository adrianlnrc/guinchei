import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CODIGO_CERTO, PERFIL_RAFAEL, apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const pedido = 'Oi, Rafael. Qual veículo precisa de reboque?';

function pedirCodigo(celular: string) {
  fireEvent.change(screen.getByLabelText('Celular com DDD'), { target: { value: celular } });
  fireEvent.click(screen.getByRole('button', { name: 'Receber código' }));
}

async function digitarCodigo(codigo: string) {
  fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), {
    target: { value: codigo },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
}

describe('Entrada por telefone e código', () => {
  it('o Cliente com perfil entra com o código e vai direto ao Pedido', async () => {
    const api = apiFalsa({ perfil: PERFIL_RAFAEL });
    renderEm('/entrar', api);
    pedirCodigo('(61) 90000-0001');
    await digitarCodigo(CODIGO_CERTO);

    expect(await screen.findByRole('heading', { name: pedido })).toBeTruthy();
    expect(api.enviarCodigo).toHaveBeenCalledWith('+5561900000001');
    expect(api.confirmarCodigo).toHaveBeenCalledWith('+5561900000001', CODIGO_CERTO);
  });

  it('o número sem perfil vai para o cadastro urgente', async () => {
    renderEm('/entrar', apiFalsa());
    pedirCodigo('61900000006');
    await digitarCodigo(CODIGO_CERTO);
    expect(await screen.findByLabelText('Nome completo')).toBeTruthy();
  });

  it('código errado avisa e fica na tela do código', async () => {
    renderEm('/entrar', apiFalsa({ perfil: PERFIL_RAFAEL }));
    pedirCodigo('61900000001');
    await digitarCodigo('000000');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Código incorreto/);
    expect(screen.getByRole('heading', { name: 'Digite o código' })).toBeTruthy();
  });

  it('se o código não sai, avisa e fica no celular', async () => {
    const api = apiFalsa();
    api.enviarCodigo.mockRejectedValueOnce(new Error('rede'));
    renderEm('/entrar', api);
    pedirCodigo('61900000001');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível enviar/);
    expect(screen.getByRole('heading', { name: 'Qual é o seu celular?' })).toBeTruthy();
  });

  it('com sessão e perfil guardados, abrir o app vai direto ao Pedido', async () => {
    renderEm('/', apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL }));
    expect(await screen.findByRole('heading', { name: pedido })).toBeTruthy();
  });

  it('sem sessão, abrir o app mostra as boas-vindas', async () => {
    renderEm('/', apiFalsa());
    expect(await screen.findByRole('heading', { name: /Carro parou\? Respira/ })).toBeTruthy();
  });
});
