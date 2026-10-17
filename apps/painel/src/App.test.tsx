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

describe('App painel', () => {
  it('abre no monitor de Corridas', () => {
    renderEm('/');
    expect(screen.getByText('Pedido 2318 precisa de atribuição manual')).toBeTruthy();
  });

  it('o simulador recalcula o Preço fechado ao editar a tabela', () => {
    renderEm('/precos');
    expect(screen.getByText('R$ 297')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Reboque'), { target: { value: '7,00' } });
    expect(screen.getByText('R$ 322')).toBeTruthy();
  });
});
