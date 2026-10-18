import { describe, expect, it } from 'vitest';
import { dentroDoDF } from './index';
import { PONTOS_DE_REFERENCIA } from './pontosDeReferencia';

describe('dentroDoDF', () => {
  it.each(PONTOS_DE_REFERENCIA.map((p) => [p.nome, p] as const))('%s', (_nome, ponto) => {
    expect(dentroDoDF(ponto)).toBe(ponto.noDF);
  });

  it('recusa coordenada inválida', () => {
    expect(dentroDoDF({ lat: Number.NaN, lng: -47.8641 })).toBe(false);
  });
});
