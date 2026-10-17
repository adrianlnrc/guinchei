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

describe('App guincheiro', () => {
  it('abre no plantão com os repasses do dia', () => {
    renderEm('/');
    expect(screen.getByText('Disponível')).toBeTruthy();
    expect(screen.getByText('R$ 412')).toBeTruthy();
  });

  it('não encerra a Corrida sem as Fotos de estado', () => {
    renderEm('/entrega');
    const encerrar = screen.getByRole('button', { name: 'Encerrar Corrida' }) as HTMLButtonElement;
    expect(encerrar.disabled).toBe(true);
  });

  it('o interruptor tira o Guincheiro do plantão', () => {
    renderEm('/');
    fireEvent.click(screen.getByRole('switch', { name: 'Disponível para chamados' }));
    expect(screen.getByText('Fora do plantão')).toBeTruthy();
  });
});
