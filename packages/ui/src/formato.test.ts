import { describe, expect, it } from 'vitest';
import { formatarKm, formatarReais, partesReais } from './formato';

describe('formato', () => {
  it('formata reais em pt-BR', () => {
    expect(formatarReais(29762)).toBe('R$ 297,62');
    expect(formatarReais(128400)).toBe('R$ 1.284,00');
  });

  it('separa centavos para o número-herói', () => {
    expect(partesReais(29762)).toEqual({ inteiro: 'R$ 297', centavos: ',62' });
  });

  it('formata km com uma casa', () => {
    expect(formatarKm(21.3)).toBe('21,3 km');
  });
});
