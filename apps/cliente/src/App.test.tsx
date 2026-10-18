import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COTACAO } from '@guinchei/mock';
import { TABELA_PADRAO, calcularPrecoFechado } from '@guinchei/preco';
import { formatarReais, partesReais } from '@guinchei/ui';
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

/** O Rafael logado; as telas do mapa em diante ainda usam o mock. */
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
  it('mostra o Preço fechado e a decomposição calculados por @guinchei/preco', () => {
    renderEm('/preco');
    const preco = calcularPrecoFechado(COTACAO, TABELA_PADRAO);
    expect(screen.getByText(partesReais(preco.total).inteiro)).toBeTruthy();
    expect(screen.getByText(partesReais(preco.total).centavos)).toBeTruthy();
    expect(screen.getByText('Taxa base')).toBeTruthy();
    for (const parcela of [preco.taxaBase, preco.deslocamento, preco.reboque]) {
      expect(screen.getByText(formatarReais(parcela))).toBeTruthy();
    }
    expect(screen.getByText('Adicional noturno · 15%')).toBeTruthy();
    expect(screen.getByText(formatarReais(preco.adicionalNoturno))).toBeTruthy();
    expect(screen.queryByText(/Preço fechado mínimo/)).toBeNull();
  });

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
