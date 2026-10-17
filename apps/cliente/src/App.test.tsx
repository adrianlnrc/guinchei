import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

function renderEm(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App />
    </MemoryRouter>,
  );
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
});
