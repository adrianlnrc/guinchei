import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PERFIL_RAFAEL, apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const logado = () => apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });

describe('Pedido em três toques', () => {
  it('cumprimenta o Cliente pelo primeiro nome do perfil', async () => {
    renderEm('/pedido/1', logado());
    expect(
      await screen.findByRole('heading', { name: 'Oi, Rafael. Qual veículo precisa de reboque?' }),
    ).toBeTruthy();
  });

  it('abre o Pedido com as três respostas e segue para o mapa', async () => {
    const api = logado();
    renderEm('/pedido/1', api);
    fireEvent.click(await screen.findByRole('button', { name: 'SUV ou picape' }));
    fireEvent.click(screen.getByRole('button', { name: 'Batida ou acidente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Não' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar local no mapa' }));

    expect(await screen.findByRole('main', { name: 'Origem e destino' })).toBeTruthy();
    expect(api.abrirPedido).toHaveBeenCalledTimes(1);
    expect(api.abrirPedido).toHaveBeenCalledWith({
      tipoVeiculo: 'suv',
      situacao: 'batida',
      rodasGiram: 'nao',
    });
  });

  it('só libera a confirmação depois da terceira resposta', async () => {
    renderEm('/pedido/1', logado());
    fireEvent.click(await screen.findByRole('button', { name: 'Carro de passeio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Parou e não liga' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar local no mapa' });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Não sei' }));
    expect((confirmar as HTMLButtonElement).disabled).toBe(false);
  });

  it('se o Pedido não abre, avisa e fica na pergunta', async () => {
    const api = logado();
    api.abrirPedido.mockRejectedValueOnce(new Error('rede'));
    renderEm('/pedido/1', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Moto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Superaqueceu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar local no mapa' }));

    expect((await screen.findByRole('status')).textContent).toMatch(/Não foi possível abrir/);
    expect(screen.getByRole('heading', { name: 'As 4 rodas giram?' })).toBeTruthy();
  });

  it('sem sessão, o Pedido manda entrar com o celular', async () => {
    renderEm('/pedido/1', apiFalsa());
    expect(await screen.findByRole('heading', { name: 'Qual é o seu celular?' })).toBeTruthy();
  });

  it('logado sem perfil, o Pedido manda para o cadastro urgente', async () => {
    renderEm('/pedido/1', apiFalsa({ sessao: true }));
    expect(await screen.findByLabelText('Nome completo')).toBeTruthy();
  });
});
