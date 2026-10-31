import { describe, expect, it } from 'vitest';
import { LIMITE_TENTATIVAS_PADRAO, decidirProximo, decidirRecotacao } from './index';

// Guincheiros do seed, do mais perto ao mais longe do Eixo Monumental.
const MARCOS = { guincheiroId: 'marcos', km: 4.21 };
const WAGNER = { guincheiroId: 'wagner', km: 4.87 };
const RITA = { guincheiroId: 'rita', km: 9.6 };
const CANDIDATOS = [MARCOS, WAGNER, RITA];

describe('decidirProximo', () => {
  it('sem candidatos, a rodada está esgotada', () => {
    expect(decidirProximo({ candidatos: [], tentativasDaRodada: [], limiteTentativas: 3 })).toEqual(
      { tipo: 'esgotado' },
    );
  });

  it('no começo da rodada, oferta ao mais próximo', () => {
    expect(
      decidirProximo({ candidatos: CANDIDATOS, tentativasDaRodada: [], limiteTentativas: 3 }),
    ).toEqual({ tipo: 'ofertar', candidato: MARCOS });
  });

  it('depois da recusa do mais próximo, oferta ao seguinte', () => {
    expect(
      decidirProximo({
        candidatos: CANDIDATOS,
        tentativasDaRodada: [{ guincheiroId: 'marcos', resultado: 'recusada' }],
        limiteTentativas: 3,
      }),
    ).toEqual({ tipo: 'ofertar', candidato: WAGNER });
  });

  it('recusas e expirações contam no teto de tentativas: no teto, esgota mesmo com candidatos', () => {
    const quarto = { guincheiroId: 'quarto', km: 12 };
    expect(
      decidirProximo({
        candidatos: [...CANDIDATOS, quarto],
        tentativasDaRodada: [
          { guincheiroId: 'marcos', resultado: 'recusada' },
          { guincheiroId: 'wagner', resultado: 'expirada' },
          { guincheiroId: 'rita', resultado: 'expirada' },
        ],
        limiteTentativas: 3,
      }),
    ).toEqual({ tipo: 'esgotado' });
  });

  it('pulado pelo teto da Comissão não volta na rodada e não conta como tentativa', () => {
    const quarto = { guincheiroId: 'quarto', km: 12 };
    expect(
      decidirProximo({
        candidatos: [...CANDIDATOS, quarto],
        tentativasDaRodada: [
          { guincheiroId: 'marcos', resultado: 'pulada_teto' },
          { guincheiroId: 'wagner', resultado: 'recusada' },
          { guincheiroId: 'rita', resultado: 'expirada' },
        ],
        limiteTentativas: 3,
      }),
    ).toEqual({ tipo: 'ofertar', candidato: quarto });
  });

  it.each(['oferecida', 'aceita'] as const)(
    'com uma tentativa %s na rodada, não oferta a mais ninguém',
    (resultado) => {
      expect(
        decidirProximo({
          candidatos: CANDIDATOS,
          tentativasDaRodada: [
            { guincheiroId: 'marcos', resultado: 'recusada' },
            { guincheiroId: 'wagner', resultado },
          ],
          limiteTentativas: 3,
        }),
      ).toEqual({ tipo: 'aguardar' });
    },
  );

  it('quem já recebeu na rodada e saiu da lista de elegíveis não muda a ordem dos demais', () => {
    expect(
      decidirProximo({
        candidatos: [RITA],
        tentativasDaRodada: [{ guincheiroId: 'marcos', resultado: 'expirada' }],
        limiteTentativas: 3,
      }),
    ).toEqual({ tipo: 'ofertar', candidato: RITA });
  });

  it('todos os elegíveis já receberam na rodada, abaixo do teto: esgotado', () => {
    expect(
      decidirProximo({
        candidatos: [MARCOS, WAGNER],
        tentativasDaRodada: [
          { guincheiroId: 'marcos', resultado: 'recusada' },
          { guincheiroId: 'wagner', resultado: 'expirada' },
        ],
        limiteTentativas: 3,
      }),
    ).toEqual({ tipo: 'esgotado' });
  });

  it('o teto é configurável', () => {
    expect(
      decidirProximo({
        candidatos: CANDIDATOS,
        tentativasDaRodada: [{ guincheiroId: 'marcos', resultado: 'recusada' }],
        limiteTentativas: 1,
      }),
    ).toEqual({ tipo: 'esgotado' });
    expect(LIMITE_TENTATIVAS_PADRAO).toBe(3);
  });

  it('recusa teto menor que 1', () => {
    expect(() =>
      decidirProximo({ candidatos: CANDIDATOS, tentativasDaRodada: [], limiteTentativas: 0 }),
    ).toThrow(RangeError);
  });
});

describe('decidirRecotacao (ADR-0013)', () => {
  const PLANALTO = 'frota-planalto';
  const AUTONOMA = 'frota-rita';

  it('mesma Frota cotada: nada muda para o Cliente, qualquer que seja a distância', () => {
    expect(
      decidirRecotacao({
        frotaCotadaId: PLANALTO,
        frotaDoCandidatoId: PLANALTO,
        precoAtual: 25915,
        precoNovo: 27000,
      }),
    ).toEqual({ tipo: 'manter' });
  });

  it('outra Frota e preço menor: aplica sem pausa e informa a diferença a estornar', () => {
    expect(
      decidirRecotacao({
        frotaCotadaId: PLANALTO,
        frotaDoCandidatoId: AUTONOMA,
        precoAtual: 25915,
        precoNovo: 24000,
      }),
    ).toEqual({ tipo: 'aplicar', precoAnterior: 25915, precoNovo: 24000, diferenca: 1915 });
  });

  it('outra Frota e preço igual: aplica sem pausa, sem diferença a estornar', () => {
    expect(
      decidirRecotacao({
        frotaCotadaId: PLANALTO,
        frotaDoCandidatoId: AUTONOMA,
        precoAtual: 25915,
        precoNovo: 25915,
      }),
    ).toEqual({ tipo: 'aplicar', precoAnterior: 25915, precoNovo: 25915, diferenca: 0 });
  });

  it('outra Frota e preço maior: pede a aprovação do Cliente antes de ofertar', () => {
    expect(
      decidirRecotacao({
        frotaCotadaId: PLANALTO,
        frotaDoCandidatoId: AUTONOMA,
        precoAtual: 25915,
        precoNovo: 28000,
      }),
    ).toEqual({ tipo: 'pedir_aprovacao', precoAnterior: 25915, precoNovo: 28000, acrescimo: 2085 });
  });

  it('Pedido sem Frota cotada (cotado antes do ADR-0013): mantém o preço', () => {
    expect(
      decidirRecotacao({
        frotaCotadaId: null,
        frotaDoCandidatoId: AUTONOMA,
        precoAtual: 25915,
        precoNovo: 28000,
      }),
    ).toEqual({ tipo: 'manter' });
  });

  it('recusa preço que não seja inteiro positivo em centavos', () => {
    for (const ruim of [0, -1, 10.5, Number.NaN]) {
      expect(() =>
        decidirRecotacao({
          frotaCotadaId: PLANALTO,
          frotaDoCandidatoId: AUTONOMA,
          precoAtual: ruim,
          precoNovo: 100,
        }),
      ).toThrow(RangeError);
      expect(() =>
        decidirRecotacao({
          frotaCotadaId: PLANALTO,
          frotaDoCandidatoId: AUTONOMA,
          precoAtual: 100,
          precoNovo: ruim,
        }),
      ).toThrow(RangeError);
    }
  });
});
