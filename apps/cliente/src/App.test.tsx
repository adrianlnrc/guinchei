import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

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

function renderEm(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App />
      <Navegador />
    </MemoryRouter>,
  );
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
  it('abre nas boas-vindas', () => {
    renderEm('/');
    expect(screen.getByRole('heading', { name: /Carro parou\? Respira/ })).toBeTruthy();
  });

  it('mostra o Preço fechado com a conta detalhada', () => {
    renderEm('/preco');
    expect(screen.getByText('Taxa base')).toBeTruthy();
    expect(screen.getByText('R$ 38,82')).toBeTruthy();
  });

  it('o Pedido em três toques só libera o mapa depois da última resposta', () => {
    renderEm('/pedido/1');
    fireEvent.click(screen.getByRole('button', { name: 'Carro de passeio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Parou e não liga' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar local no mapa' });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Não sei' }));
    expect((confirmar as HTMLButtonElement).disabled).toBe(false);
  });

  it('"Pedir" a partir do Histórico começa um Pedido sem as respostas anteriores', () => {
    renderEm('/pedido/1');
    fireEvent.click(screen.getByRole('button', { name: 'Carro de passeio' }));
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
