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

  it('a Disputa mostra as Fotos de estado do lado escolhido', () => {
    renderEm('/disputas');
    fireEvent.click(screen.getByRole('button', { name: 'Frente' }));
    expect(screen.getByText('antes de carregar · frente')).toBeTruthy();
    expect(screen.getByText('Antes · 15/10 19:41')).toBeTruthy();
    expect(screen.queryByText('Antes · 15/10 19:42')).toBeNull();
  });

  it('a Disputa só registra uma decisão escolhida pela operação', () => {
    renderEm('/disputas');
    const registrar = () =>
      screen.getByRole('button', { name: 'Registrar decisão e avisar as partes' });
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect((registrar() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /^Procedente/ }));
    fireEvent.click(registrar());
    expect(screen.getByRole('status').textContent).toContain('Procedente');
    expect(screen.getByRole('radio', { checked: true }).textContent).toMatch(/^Procedente/);
  });

  it('lê o ponto como separador decimal', () => {
    renderEm('/precos');
    fireEvent.change(screen.getByLabelText('Reboque'), { target: { value: '7.00' } });
    expect(screen.getByText('R$ 322')).toBeTruthy();
  });

  it('recusa valor sem dígitos e não deixa publicar', () => {
    renderEm('/precos');
    const campo = screen.getByLabelText('Reboque');
    fireEvent.change(campo, { target: { value: '7,00' } });
    fireEvent.change(campo, { target: { value: 'abc' } });
    expect(screen.getByText('R$ 322')).toBeTruthy();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Use só números, como 7,50')).toBeTruthy();
    const publicar = screen.getByRole('button', { name: /^Publicar versão/ }) as HTMLButtonElement;
    expect(publicar.disabled).toBe(true);
  });
});
