import { describe, expect, it } from 'vitest';
import { TransicaoInvalida, taxaDeCancelamento, transitarCorrida } from './simulacao';

describe('transitarCorrida', () => {
  it('segue a ordem aceita → a_caminho → no_local → carregado → entregue', () => {
    let estado = transitarCorrida('aceita', 'a_caminho');
    estado = transitarCorrida(estado, 'no_local');
    estado = transitarCorrida(estado, 'carregado');
    estado = transitarCorrida(estado, 'entregue');
    expect(estado).toBe('entregue');
  });

  it('não pula etapas', () => {
    expect(() => transitarCorrida('a_caminho', 'carregado')).toThrow(TransicaoInvalida);
  });

  it('carrega e entrega sem exigir Fotos de estado (ADR-0011)', () => {
    expect(transitarCorrida('no_local', 'carregado')).toBe('carregado');
    expect(transitarCorrida('carregado', 'entregue')).toBe('entregue');
  });

  it('entregue é terminal', () => {
    expect(() => transitarCorrida('entregue', 'aceita')).toThrow(TransicaoInvalida);
  });
});

describe('taxaDeCancelamento', () => {
  it('é grátis até o Guincheiro sair', () => {
    expect(taxaDeCancelamento('em_match')).toBe(0);
    expect(taxaDeCancelamento('aceita')).toBe(0);
  });

  it('cobra R$ 30 depois de a caminho', () => {
    expect(taxaDeCancelamento('a_caminho')).toBe(3000);
    expect(taxaDeCancelamento('no_local')).toBe(3000);
  });

  it('não permite cancelar com o carro carregado', () => {
    expect(taxaDeCancelamento('carregado')).toBeNull();
  });
});
