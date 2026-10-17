import { describe, expect, it } from 'vitest';
import {
  TABELA_PADRAO,
  TransicaoInvalida,
  calcularPrecoFechado,
  calcularRepasse,
  ehNoturno,
  taxaDeCancelamento,
  transitarCorrida,
} from './simulacao';

const terca2147 = new Date(2026, 9, 13, 21, 47);
const terca1400 = new Date(2026, 9, 13, 14, 0);

describe('calcularPrecoFechado', () => {
  it('reproduz o cenário do Rafael: R$ 297,62', () => {
    const preco = calcularPrecoFechado({ kmDeslocamento: 4.2, kmReboque: 21.3, quando: terca2147 });
    expect(preco).toEqual({
      taxaBase: 11000,
      deslocamento: 2100,
      reboque: 12780,
      adicionalNoturno: 3882,
      adicionalFeriado: 0,
      total: 29762,
    });
  });

  it('não aplica adicional noturno de dia', () => {
    const preco = calcularPrecoFechado({ kmDeslocamento: 4.2, kmReboque: 21.3, quando: terca1400 });
    expect(preco.adicionalNoturno).toBe(0);
    expect(preco.total).toBe(25880);
  });

  it('soma o adicional de feriado sobre o subtotal, sem compor com o noturno', () => {
    const preco = calcularPrecoFechado({
      kmDeslocamento: 0,
      kmReboque: 0,
      quando: terca2147,
      feriado: true,
    });
    expect(preco.adicionalNoturno).toBe(1650);
    expect(preco.adicionalFeriado).toBe(2200);
    expect(preco.total).toBe(11000 + 1650 + 2200);
  });

  it('recusa distância negativa', () => {
    expect(() =>
      calcularPrecoFechado({ kmDeslocamento: -1, kmReboque: 2, quando: terca1400 }),
    ).toThrow(RangeError);
  });
});

describe('ehNoturno', () => {
  it.each([
    [19, false],
    [20, true],
    [23, true],
    [0, true],
    [5, true],
    [6, false],
  ])('às %ih → %s', (hora, esperado) => {
    expect(ehNoturno(new Date(2026, 9, 13, hora, 0))).toBe(esperado);
  });
});

describe('calcularRepasse', () => {
  it('retém 20% de Comissão: R$ 297,62 → R$ 238,10 ao Guincheiro', () => {
    expect(calcularRepasse(29762)).toEqual({ comissao: 5952, repasse: 23810 });
  });

  it('fecha a conta: comissão + repasse = preço', () => {
    const { comissao, repasse } = calcularRepasse(24690, TABELA_PADRAO);
    expect(comissao + repasse).toBe(24690);
  });
});

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
