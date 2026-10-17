import { describe, expect, it } from 'vitest';
import {
  TABELA_PADRAO,
  avaliarOfertaAoGuincheiro,
  calcularPrecoFechado,
  calcularRepasse,
} from './index';

// Terça-feira, 13/10/2026, dia útil. Instantes com offset de Brasília (-03:00).
const terca = (hora: string) => `2026-10-13T${hora}:00-03:00`;

describe('calcularPrecoFechado', () => {
  it('cobra taxa base + deslocamento + reboque de dia, sem adicionais', () => {
    const preco = calcularPrecoFechado(
      { kmAteVeiculo: 4.2, kmRebocado: 21.3, instante: terca('14:00'), feriados: [] },
      TABELA_PADRAO,
    );
    expect(preco).toEqual({
      taxaBase: 11000,
      deslocamento: 2100,
      reboque: 12780,
      adicionalNoturno: 0,
      adicionalFeriado: 0,
      ajustePiso: 0,
      total: 25880,
    });
  });

  it.each([
    ['19:59', 0, 25880],
    ['20:00', 3882, 29762],
    ['23:30', 3882, 29762],
    ['05:59', 3882, 29762],
    ['06:00', 0, 25880],
  ])('às %s de Brasília o adicional noturno é %i (total %i)', (hora, noturno, total) => {
    const preco = calcularPrecoFechado(
      { kmAteVeiculo: 4.2, kmRebocado: 21.3, instante: terca(hora), feriados: [] },
      TABELA_PADRAO,
    );
    expect(preco.adicionalNoturno).toBe(noturno);
    expect(preco.total).toBe(total);
  });

  it('aplica o adicional de feriado quando a data de Brasília está na lista de feriados', () => {
    const preco = calcularPrecoFechado(
      {
        kmAteVeiculo: 4.2,
        kmRebocado: 21.3,
        instante: '2026-11-20T14:00:00-03:00',
        feriados: ['2026-11-15', '2026-11-20'],
      },
      TABELA_PADRAO,
    );
    expect(preco.adicionalFeriado).toBe(5176);
    expect(preco.adicionalNoturno).toBe(0);
    expect(preco.total).toBe(31056);
  });

  it('não aplica o adicional de feriado em dia fora da lista', () => {
    const preco = calcularPrecoFechado(
      { kmAteVeiculo: 4.2, kmRebocado: 21.3, instante: terca('14:00'), feriados: ['2026-11-20'] },
      TABELA_PADRAO,
    );
    expect(preco.adicionalFeriado).toBe(0);
  });

  it('soma noturno e feriado sobre o mesmo subtotal, sem cascata', () => {
    // 23:30 de Brasília em 20/11 já é 21/11 em UTC: o feriado vale pela data de Brasília.
    const preco = calcularPrecoFechado(
      {
        kmAteVeiculo: 4.2,
        kmRebocado: 21.3,
        instante: '2026-11-20T23:30:00-03:00',
        feriados: ['2026-11-20'],
      },
      TABELA_PADRAO,
    );
    expect(preco.adicionalNoturno).toBe(3882);
    expect(preco.adicionalFeriado).toBe(5176);
    expect(preco.total).toBe(34938);
  });

  it('aplica o Preço fechado mínimo depois dos adicionais e mostra o ajuste', () => {
    // Subtotal 15.800: de dia fica abaixo do piso; à noite, 15.800 + 2.370 já passa dele.
    const cotacao = { kmAteVeiculo: 0, kmRebocado: 8, feriados: [] };
    const dia = calcularPrecoFechado({ ...cotacao, instante: terca('14:00') }, TABELA_PADRAO);
    const noite = calcularPrecoFechado({ ...cotacao, instante: terca('22:00') }, TABELA_PADRAO);
    expect(dia).toMatchObject({ ajustePiso: 2200, total: 18000 });
    expect(noite).toMatchObject({ adicionalNoturno: 2370, ajustePiso: 0, total: 18170 });
  });

  it('com distância zero cobra só a taxa base, completada até o piso', () => {
    const preco = calcularPrecoFechado(
      { kmAteVeiculo: 0, kmRebocado: 0, instante: terca('14:00'), feriados: [] },
      TABELA_PADRAO,
    );
    expect(preco).toEqual({
      taxaBase: 11000,
      deslocamento: 0,
      reboque: 0,
      adicionalNoturno: 0,
      adicionalFeriado: 0,
      ajustePiso: 7000,
      total: 18000,
    });
  });

  it('arredonda cada parcela ao centavo e a decomposição soma exatamente o total', () => {
    // 13,371 km × 600 = 8.022,6 → 8.023; subtotal 20.373; ×15% = 3.055,95 → 3.056; ×20% = 4.074,6 → 4.075.
    const preco = calcularPrecoFechado(
      {
        kmAteVeiculo: 2.7,
        kmRebocado: 13.371,
        instante: '2026-11-20T21:00:00-03:00',
        feriados: ['2026-11-20'],
      },
      TABELA_PADRAO,
    );
    expect(preco).toEqual({
      taxaBase: 11000,
      deslocamento: 1350,
      reboque: 8023,
      adicionalNoturno: 3056,
      adicionalFeriado: 4075,
      ajustePiso: 0,
      total: 27504,
    });
    const { total, ...parcelas } = preco;
    expect(Object.values(parcelas).reduce((soma, parcela) => soma + parcela, 0)).toBe(total);
  });

  it.each([
    // 21:30 UTC = 18:30 em Brasília: dia, embora seja noite em UTC.
    [new Date(Date.UTC(2026, 9, 13, 21, 30)), 0],
    // 08:30 UTC = 05:30 em Brasília: noite, embora seja dia em UTC.
    [new Date(Date.UTC(2026, 9, 14, 8, 30)), 3882],
  ])('decide o noturno de %o pelo relógio de Brasília', (instante, noturno) => {
    const preco = calcularPrecoFechado(
      { kmAteVeiculo: 4.2, kmRebocado: 21.3, instante, feriados: [] },
      TABELA_PADRAO,
    );
    expect(preco.adicionalNoturno).toBe(noturno);
  });

  const cotacaoValida = {
    kmAteVeiculo: 4.2,
    kmRebocado: 21.3,
    instante: terca('14:00'),
    feriados: [],
  };

  it.each([
    ['km até o veículo negativo', { kmAteVeiculo: -1 }, /kmAteVeiculo/],
    ['km rebocado negativo', { kmRebocado: -0.1 }, /kmRebocado/],
    ['km NaN', { kmAteVeiculo: Number.NaN }, /kmAteVeiculo/],
    ['km infinito', { kmRebocado: Number.POSITIVE_INFINITY }, /kmRebocado/],
    ['instante inválido', { instante: 'ontem à noite' }, /instante/],
    // Sem offset, o JS leria a string no fuso do processo.
    ['instante ISO sem fuso', { instante: '2026-10-13T20:00:00' }, /instante/],
    ['feriado fora do formato YYYY-MM-DD', { feriados: ['20/11/2026'] }, /feriados/],
  ])('rejeita cotação com %s', (_caso, alteracao, mensagem) => {
    expect(() => calcularPrecoFechado({ ...cotacaoValida, ...alteracao }, TABELA_PADRAO)).toThrow(
      mensagem,
    );
  });

  it.each([
    ['taxa base negativa', { taxaBase: -100 }, /taxaBase/],
    ['R$/km negativo', { porKmRebocado: -600 }, /porKmRebocado/],
    ['preço mínimo negativo', { precoMinimo: -1 }, /precoMinimo/],
    ['taxa base em fração de centavo', { taxaBase: 110.5 }, /taxaBase/],
    ['adicional noturno acima de 1', { adicionalNoturno: 15 }, /adicionalNoturno/],
    ['adicional de feriado negativo', { adicionalFeriado: -0.2 }, /adicionalFeriado/],
    ['comissão acima de 1', { comissao: 20 }, /comissao/],
    ['hora noturna fora de 0–23', { noturnoDas: 24 }, /noturnoDas/],
  ])('rejeita tabela com %s', (_caso, alteracao, mensagem) => {
    expect(() => calcularPrecoFechado(cotacaoValida, { ...TABELA_PADRAO, ...alteracao })).toThrow(
      mensagem,
    );
  });
});

describe('calcularRepasse', () => {
  it.each([
    [18000, 3600, 14400],
    [29762, 5952, 23810],
  ])('de um Preço fechado de %i retém %i de Comissão e repassa %i', (preco, comissao, repasse) => {
    expect(calcularRepasse(preco, TABELA_PADRAO)).toEqual({ comissao, repasse });
  });

  it.each([[-1], [100.5], [Number.NaN]])('rejeita Preço fechado %s', (preco) => {
    expect(() => calcularRepasse(preco, TABELA_PADRAO)).toThrow(/precoFechado/);
  });
});

describe('avaliarOfertaAoGuincheiro', () => {
  // Preço fechado travado do Cliente: R$ 297,62 → Comissão R$ 59,52, repasse R$ 238,10.
  const travado = 29762;

  it('repassa 80% do preço recalculado e a plataforma absorve a diferença', () => {
    expect(avaliarOfertaAoGuincheiro(travado, 33000, TABELA_PADRAO)).toEqual({
      repasse: 26400,
      absorcao: 2590,
      oferecer: true,
    });
  });

  it('oferece quando a absorção consome exatamente a Comissão inteira', () => {
    expect(avaliarOfertaAoGuincheiro(travado, 37202, TABELA_PADRAO)).toEqual({
      repasse: 29762,
      absorcao: 5952,
      oferecer: true,
    });
  });

  it('não oferece quando a absorção passa da Comissão inteira da Corrida', () => {
    expect(avaliarOfertaAoGuincheiro(travado, 37204, TABELA_PADRAO)).toEqual({
      repasse: 29763,
      absorcao: 5953,
      oferecer: false,
    });
  });

  it('com Guincheiro mais próximo que o da cotação, o repasse cai e a absorção fica negativa', () => {
    expect(avaliarOfertaAoGuincheiro(travado, 25880, TABELA_PADRAO)).toEqual({
      repasse: 20704,
      absorcao: -3106,
      oferecer: true,
    });
  });
});
