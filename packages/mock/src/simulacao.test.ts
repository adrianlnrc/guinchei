import { describe, expect, it } from 'vitest';
import { TransicaoInvalida, taxaDeCancelamento, transitarCorrida } from './simulacao';

const semFotos = { antes: 0, depois: 0 };
const comFotos = { antes: 4, depois: 4 };

describe('transitarCorrida', () => {
  it('segue a ordem aceita → a_caminho → no_local → carregado → entregue', () => {
    let estado = transitarCorrida('aceita', 'a_caminho', comFotos);
    estado = transitarCorrida(estado, 'no_local', comFotos);
    estado = transitarCorrida(estado, 'carregado', comFotos);
    estado = transitarCorrida(estado, 'entregue', comFotos);
    expect(estado).toBe('entregue');
  });

  it('não pula etapas', () => {
    expect(() => transitarCorrida('a_caminho', 'carregado', comFotos)).toThrow(TransicaoInvalida);
  });

  it('exige Fotos antes para carregar', () => {
    expect(() => transitarCorrida('no_local', 'carregado', semFotos)).toThrow(/antes de carregar/);
  });

  it('exige Fotos depois para entregar', () => {
    expect(() => transitarCorrida('carregado', 'entregue', { antes: 4, depois: 0 })).toThrow(
      /depois de entregar/,
    );
  });

  it('entregue é terminal', () => {
    expect(() => transitarCorrida('entregue', 'aceita', comFotos)).toThrow(TransicaoInvalida);
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
