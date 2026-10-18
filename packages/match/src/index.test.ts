import { describe, expect, it } from 'vitest';
import { LIMITE_TENTATIVAS_PADRAO, decidirProximo } from './index';

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
