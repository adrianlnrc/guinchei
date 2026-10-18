import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PERFIL_RAFAEL, apiFalsa } from './teste/apiFalsa';
import { renderEm as renderComApi } from './teste/renderizar';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let navegar: NavigateFunction;
function Navegador() {
  const ir = useNavigate();
  useEffect(() => {
    navegar = ir;
  }, [ir]);
  return null;
}

/** O Rafael logado; sem VITE_MAPBOX_TOKEN, a tela de local usa o mapa do protótipo. */
function renderEm(rota: string) {
  return renderComApi(rota, apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL }), <Navegador />);
}

const passar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

/** Minutos de "Chega em N min" na tela do guincho a caminho. */
function etaNaTela() {
  const texto = screen.getByText(/^Chega em \d+ min$/).textContent!;
  return Number(texto.match(/\d+/)![0]);
}

/** Abre a Corrida e deixa o guincho a meio caminho do Cliente. */
function guinchoAMeioCaminho() {
  vi.useFakeTimers();
  renderEm('/corrida');
  passar(4000); // Match
  passar(5000); // metade do trajeto até o Cliente
}

describe('App cliente', () => {
  it('"Pedir" a partir do Histórico começa um Pedido sem as respostas anteriores', async () => {
    renderEm('/pedido/1');
    fireEvent.click(await screen.findByRole('button', { name: 'Carro de passeio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Parou e não liga' }));
    fireEvent.click(screen.getByRole('button', { name: 'Não sei' }));
    act(() => void navegar('/historico'));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir' }));
    const carro = screen.getByRole('button', { name: 'Carro de passeio' });
    expect(carro.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('Acompanhamento da Corrida', () => {
  it('a folha de cancelamento mostra o mesmo tempo de chegada da tela', () => {
    guinchoAMeioCaminho();
    const eta = etaNaTela();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar Pedido' }));
    const folha = screen.getByRole('dialog', { name: 'Quer mesmo cancelar?' });
    expect(folha.textContent).toContain(`está a ${eta} minutos de você`);
  });

  it('abrir e fechar a folha de cancelamento não faz o guincho saltar adiante', () => {
    guinchoAMeioCaminho();
    const eta = etaNaTela();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar Pedido' }));
    passar(60_000);
    fireEvent.click(screen.getByRole('button', { name: 'Manter o guincho' }));
    passar(500);
    expect(etaNaTela()).toBeGreaterThanOrEqual(eta - 1);
  });
});
