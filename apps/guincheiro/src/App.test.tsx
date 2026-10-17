import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { COTACAO } from '@guinchei/mock';
import { TABELA_PADRAO, calcularPrecoFechado, calcularRepasse } from '@guinchei/preco';
import { partesReais } from '@guinchei/ui';
import { App } from './App';

afterEach(cleanup);

// Dá ao teste o controle da navegação, como o "voltar" do navegador ou do Android.
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

const ir = (rota: string) => act(() => void navegar(rota));
const tocar = (nome: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nome }));

function fotografarAntes() {
  for (let i = 0; i < 4; i++) {
    tocar(/^Tirar foto da /);
    tocar('Tirar foto');
  }
}

function fotografarDepois() {
  for (let i = 0; i < 4; i++) {
    fireEvent.click(screen.getAllByRole('button', { name: /^Fotografar / })[0]!);
    tocar('Tirar foto');
  }
}

function ateOTransporte() {
  renderEm('/chamado');
  tocar('Aceitar Corrida');
  tocar('Cheguei no local');
  fotografarAntes();
  tocar('Veículo carregado');
}

describe('App guincheiro', () => {
  it('abre no plantão com os repasses do dia', () => {
    renderEm('/');
    expect(screen.getByText('Disponível')).toBeTruthy();
    expect(screen.getByText('R$ 412')).toBeTruthy();
  });

  it('o Chamado oferece o repasse calculado por @guinchei/preco', () => {
    renderEm('/chamado');
    const preco = calcularPrecoFechado(COTACAO, TABELA_PADRAO);
    const { repasse } = calcularRepasse(preco.total, TABELA_PADRAO);
    expect(screen.getByText(partesReais(repasse).inteiro)).toBeTruthy();
    expect(screen.getByText(partesReais(repasse).centavos)).toBeTruthy();
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

  it('a aba Conta aparece desabilitada, em breve', () => {
    renderEm('/');
    const conta = screen.getByRole('button', { name: 'Conta, em breve' });
    expect(conta.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Corrida do Guincheiro', () => {
  it('vai do aceite ao encerramento e entra no histórico', () => {
    ateOTransporte();
    tocar('Cheguei no destino');
    fotografarDepois();
    tocar('Encerrar Corrida');
    expect(screen.getByText('Seu repasse')).toBeTruthy();
    tocar('5');
    tocar('Voltar ao plantão');
    expect(screen.getByText('Disponível')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('voltar até a entrega depois de encerrar não deixa encerrar de novo', () => {
    ateOTransporte();
    tocar('Cheguei no destino');
    fotografarDepois();
    tocar('Encerrar Corrida');
    tocar('5');
    tocar('Voltar ao plantão');
    ir('/entrega');
    const encerrar = screen.getByRole('button', { name: 'Encerrar Corrida' }) as HTMLButtonElement;
    expect(encerrar.disabled).toBe(true);
  });

  it('voltar do transporte ao checklist e tocar "Veículo carregado" retoma o transporte', () => {
    ateOTransporte();
    ir('/fotos/antes');
    tocar('Veículo carregado');
    expect(screen.getByRole('button', { name: 'Cheguei no destino' })).toBeTruthy();
  });

  it('pular uma etapa avisa e volta para a tela da etapa atual', () => {
    renderEm('/chamado');
    tocar('Aceitar Corrida');
    ir('/fotos/antes');
    fotografarAntes();
    tocar('Veículo carregado');
    expect(screen.getByRole('status').textContent).toBe(
      'A Corrida está em outra etapa. Voltamos para ela.',
    );
    expect(screen.getByRole('button', { name: 'Cheguei no local' })).toBeTruthy();
  });

  it('sem Corrida em andamento, completar o checklist avisa e volta ao plantão', () => {
    renderEm('/fotos/antes');
    fotografarAntes();
    tocar('Veículo carregado');
    expect(screen.getByRole('status').textContent).toBe('Nenhuma Corrida em andamento.');
    expect(screen.getByText('Disponível')).toBeTruthy();
  });
});
