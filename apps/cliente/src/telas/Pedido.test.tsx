import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { PERFIL_RAFAEL, apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const logado = () => apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });

let navegar: NavigateFunction;
function Navegador() {
  const ir = useNavigate();
  useEffect(() => {
    navegar = ir;
  }, [ir]);
  return null;
}

async function responder(veiculo: string, situacao: string, rodas: string) {
  fireEvent.click(await screen.findByRole('button', { name: veiculo }));
  fireEvent.click(screen.getByRole('button', { name: situacao }));
  fireEvent.click(screen.getByRole('button', { name: rodas }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar local no mapa' }));
  await screen.findByRole('main', { name: 'Origem e destino' });
}

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

  it('voltar e confirmar de novo atualiza o mesmo Pedido em vez de abrir outro', async () => {
    const api = logado();
    renderEm('/pedido/1', api, <Navegador />);
    await responder('Carro de passeio', 'Parou e não liga', 'Sim');
    act(() => void navegar('/pedido/1'));
    await responder('Moto', 'Superaqueceu', 'Não sei');

    expect(api.abrirPedido).toHaveBeenCalledTimes(1);
    expect(api.atualizarPedido).toHaveBeenCalledWith('pedido-novo', {
      tipoVeiculo: 'moto',
      situacao: 'superaqueceu',
      rodasGiram: 'nao_sei',
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
