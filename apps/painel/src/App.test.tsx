import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { COTACAO } from '@guinchei/mock';
import { TABELA_PADRAO, calcularPrecoFechado, calcularRepasse } from '@guinchei/preco';
import { formatarReais, partesReais } from '@guinchei/ui';
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
  it('o monitor mostra os Pedidos em Match e sem Guincheiro, só para leitura', () => {
    renderEm('/');
    const semGuincheiro = screen.getByText('2318').closest('.linha-tabela') as HTMLElement;
    expect(within(semGuincheiro).getByText('Sem Guincheiro')).toBeTruthy();
    expect(screen.getByText('Aguardando o Cliente: tentar de novo ou estornar')).toBeTruthy();
    expect(screen.getByText('Procurando Guincheiro')).toBeTruthy();
    expect(screen.getByText('Tentativa 2 · há 1 min')).toBeTruthy();
    expect(
      screen.getByText('1 Pedido procurando Guincheiro · 1 sem Guincheiro, aguardando o Cliente'),
    ).toBeTruthy();
    expect(screen.getByText('O Match atribui o Guincheiro sozinho.')).toBeTruthy();
  });

  it('o monitor não tem atribuição manual nem broadcast', () => {
    const { container } = renderEm('/');
    expect(screen.queryByRole('button', { name: /Atribuir/ })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.textContent).not.toMatch(/atribuição manual|broadcast|Precisa de ação/i);
  });

  it('o simulador mostra o Preço fechado e o repasse calculados por @guinchei/preco', () => {
    renderEm('/precos');
    const preco = calcularPrecoFechado(COTACAO, TABELA_PADRAO);
    const repasse = calcularRepasse(preco.total, TABELA_PADRAO);
    expect(screen.getByText(partesReais(preco.total).inteiro)).toBeTruthy();
    expect(screen.getByText(formatarReais(repasse.repasse))).toBeTruthy();
    expect(screen.getByText(formatarReais(repasse.comissao))).toBeTruthy();
    expect(screen.queryByText('Ajuste para o Preço fechado mínimo')).toBeNull();
  });

  it('o Preço fechado mínimo é editável e o simulador mostra o ajuste do piso', () => {
    renderEm('/precos');
    const campo = screen.getByLabelText('Preço fechado mínimo');
    expect((campo as HTMLInputElement).value).toBe('180,00');
    fireEvent.change(campo, { target: { value: '400,00' } });
    const preco = calcularPrecoFechado(COTACAO, { ...TABELA_PADRAO, precoMinimo: 40000 });
    expect(screen.getByText(partesReais(preco.total).inteiro)).toBeTruthy();
    expect(screen.getByText('Ajuste para o Preço fechado mínimo')).toBeTruthy();
    expect(screen.getByText(formatarReais(preco.ajustePiso))).toBeTruthy();
    fireEvent.change(campo, { target: { value: '4o0' } });
    expect(campo.getAttribute('aria-invalid')).toBe('true');
  });

  it('recusa adicional acima de 100% sem derrubar o simulador', () => {
    renderEm('/precos');
    const campo = screen.getByLabelText('Multiplicador noturno');
    fireEvent.change(campo, { target: { value: '150' } });
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Use um número de 0 a 100, como 15')).toBeTruthy();
    expect(screen.getByText('R$ 297')).toBeTruthy();
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
