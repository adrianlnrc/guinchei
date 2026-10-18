import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TABELA_PADRAO, calcularPrecoFechado } from '@guinchei/preco';
import { formatarReais, partesReais } from '@guinchei/ui';
import { apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

// Um trecho curto, de dia, fica abaixo do piso: o cenário do mock é trocado só aqui.
const COTACAO_CURTA = vi.hoisted(() => ({
  kmAteVeiculo: 1,
  kmRebocado: 2,
  instante: '2026-10-13T14:00:00-03:00',
  feriados: [],
}));

vi.mock('@guinchei/mock', async (original) => {
  const mock = await original<typeof import('@guinchei/mock')>();
  const preco = await import('@guinchei/preco');
  return {
    ...mock,
    TRECHO: { ...mock.TRECHO, kmDeslocamento: 1, kmReboque: 2 },
    PRECO: preco.calcularPrecoFechado(COTACAO_CURTA, preco.TABELA_PADRAO),
  };
});

afterEach(cleanup);

describe('Preço fechado abaixo do piso', () => {
  it('mostra a linha de ajuste para o Preço fechado mínimo', () => {
    renderEm('/preco', apiFalsa());
    const preco = calcularPrecoFechado(COTACAO_CURTA, TABELA_PADRAO);
    expect(preco.ajustePiso).toBeGreaterThan(0);
    expect(screen.getByText(partesReais(preco.total).inteiro)).toBeTruthy();
    expect(screen.getByText('Ajuste para o Preço fechado mínimo')).toBeTruthy();
    expect(screen.getByText(formatarReais(preco.ajustePiso))).toBeTruthy();
  });
});
