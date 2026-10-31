import { describe, expect, it } from 'vitest';
import {
  avaliarVinculo,
  categoriaCobrePbt,
  cnhHabilitaConduzir,
  resumoDaAprovacaoDaCnh,
} from './index';

type Esperado = 'coberto' | 'nao_coberto' | 'erro';

// Tabela de verdade (categoria × PBT em kg), escrita a partir do ADR-0012 (CTB art. 143):
// B até 3.500 kg, C ou superior (D, E) acima; A e ACC não cobrem nenhum reboque.
const CASOS: readonly [categoria: string, pbtKg: number, esperado: Esperado][] = [
  ['B', 1, 'coberto'],
  ['B', 3499, 'coberto'],
  ['B', 3500, 'coberto'],
  ['B', 3501, 'nao_coberto'],
  ['B', 4200, 'nao_coberto'],
  ['C', 3500, 'coberto'],
  ['C', 3501, 'coberto'],
  ['C', 16000, 'coberto'],
  ['D', 3500, 'coberto'],
  ['D', 3501, 'coberto'],
  ['E', 3500, 'coberto'],
  ['E', 3501, 'coberto'],
  ['A', 1, 'nao_coberto'],
  ['A', 3500, 'nao_coberto'],
  ['A', 3501, 'nao_coberto'],
  ['ACC', 1, 'nao_coberto'],
  ['ACC', 3500, 'nao_coberto'],
  ['ACC', 3501, 'nao_coberto'],
  ['AB', 3500, 'coberto'],
  ['AB', 3501, 'nao_coberto'],
  ['AC', 3501, 'coberto'],
  ['AC', 16000, 'coberto'],
  ['AD', 3501, 'coberto'],
  ['AE', 3501, 'coberto'],
  ['b', 3501, 'nao_coberto'],
  ['ac ', 3501, 'coberto'],
  [' acc', 3000, 'nao_coberto'],
  ['B', 0, 'erro'],
  ['B', -10, 'erro'],
  ['B', Number.NaN, 'erro'],
  ['B', Number.POSITIVE_INFINITY, 'erro'],
  ['C', 0, 'erro'],
  ['X', 3000, 'erro'],
  ['BC', 3000, 'erro'],
  ['CD', 3000, 'erro'],
  ['', 3000, 'erro'],
];

describe('categoriaCobrePbt', () => {
  it.each(CASOS)('categoria %s com PBT %s kg: %s', (categoria, pbtKg, esperado) => {
    expect(categoriaCobrePbt(categoria, pbtKg).situacao).toBe(esperado);
  });

  it('CNH B em guincho de 4.200 kg explica a exigência em linguagem do domínio', () => {
    expect(categoriaCobrePbt('B', 4200)).toEqual({
      situacao: 'nao_coberto',
      categoriaMinima: 'C',
      motivo: 'CNH B não cobre guincho de 4.200 kg: exige categoria C ou superior',
    });
  });

  it('A e ACC explicam que não conduzem reboque de carga', () => {
    expect(categoriaCobrePbt('A', 2000)).toEqual({
      situacao: 'nao_coberto',
      categoriaMinima: 'B',
      motivo:
        'CNH A não habilita conduzir guincho (reboque de carga): exige categoria B (até 3.500 kg) ou superior',
    });
    expect(categoriaCobrePbt('ACC', 5000)).toEqual({
      situacao: 'nao_coberto',
      categoriaMinima: 'C',
      motivo:
        'CNH ACC não habilita conduzir guincho (reboque de carga): exige categoria C ou superior',
    });
  });

  it('combinada vale pela parte B–E e a entrada é normalizada', () => {
    expect(categoriaCobrePbt('AB', 4200)).toEqual({
      situacao: 'nao_coberto',
      categoriaMinima: 'C',
      motivo: 'CNH AB não cobre guincho de 4.200 kg: exige categoria C ou superior',
    });
    expect(categoriaCobrePbt('ac ', 9000)).toEqual({
      situacao: 'coberto',
      motivo: 'CNH AC cobre guincho de 9.000 kg',
    });
  });

  it('cobertura traz motivo e não traz categoria mínima', () => {
    expect(categoriaCobrePbt('B', 3500)).toEqual({
      situacao: 'coberto',
      motivo: 'CNH B cobre guincho de 3.500 kg',
    });
  });

  it('entradas inválidas viram resultado de erro, sem exceção', () => {
    expect(categoriaCobrePbt('B', -1)).toEqual({
      situacao: 'erro',
      motivo: 'PBT inválido: informe um peso em kg maior que zero',
    });
    expect(categoriaCobrePbt('Z', 3000)).toEqual({
      situacao: 'erro',
      motivo: 'Categoria de CNH desconhecida: Z',
    });
  });
});

describe('cnhHabilitaConduzir (categoria e EAR são pré-condições separadas)', () => {
  it('B com EAR e PBT até 3.500 kg: apto, sem pendências', () => {
    expect(cnhHabilitaConduzir({ categoria: 'B', ear: true }, 3500)).toEqual({
      apto: true,
      pendencias: [],
    });
  });

  it('categoria cobre mas falta EAR: só a pendência de EAR', () => {
    const r = cnhHabilitaConduzir({ categoria: 'C', ear: false }, 9000);
    expect(r.apto).toBe(false);
    expect(r.pendencias.map((p) => p.tipo)).toEqual(['ear']);
  });

  it('EAR presente mas categoria não cobre: só a pendência de categoria, com o motivo', () => {
    const r = cnhHabilitaConduzir({ categoria: 'B', ear: true }, 4200);
    expect(r.apto).toBe(false);
    expect(r.pendencias).toEqual([
      {
        tipo: 'categoria',
        motivo: 'CNH B não cobre guincho de 4.200 kg: exige categoria C ou superior',
      },
    ]);
  });

  it('sem EAR e sem categoria suficiente: as duas pendências', () => {
    const r = cnhHabilitaConduzir({ categoria: 'A', ear: false }, 3000);
    expect(r.apto).toBe(false);
    expect(r.pendencias.map((p) => p.tipo)).toEqual(['categoria', 'ear']);
  });

  it('entrada inválida também é pendência de categoria, não exceção', () => {
    const r = cnhHabilitaConduzir({ categoria: 'Z', ear: true }, 3000);
    expect(r.apto).toBe(false);
    expect(r.pendencias.map((p) => p.tipo)).toEqual(['categoria']);
  });
});

describe('avaliarVinculo (espelho de avaliar_vinculo no banco)', () => {
  it('CNH B em veículo de 4.200 kg aprovada: bloqueado, pede C e explica', () => {
    const r = avaliarVinculo({ categoria: 'B', aprovada: true }, 4200);
    expect(r.situacao).toBe('bloqueado');
    expect(r.categoriaMinima).toBe('C');
    expect(r.motivo).toContain('exige categoria C ou superior');
  });

  it('CNH C no mesmo veículo é aceita; B em 3.500 kg também', () => {
    expect(avaliarVinculo({ categoria: 'C', aprovada: true }, 4200).situacao).toBe('ativo');
    expect(avaliarVinculo({ categoria: 'B', aprovada: true }, 3500).situacao).toBe('ativo');
    expect(avaliarVinculo({ categoria: 'B', aprovada: true }, 3501).situacao).toBe('bloqueado');
  });

  it('A e ACC aprovadas nunca cobrem', () => {
    expect(avaliarVinculo({ categoria: 'A', aprovada: true }, 1000).situacao).toBe('bloqueado');
    expect(avaliarVinculo({ categoria: 'ACC', aprovada: true }, 1000).situacao).toBe('bloqueado');
  });

  it('CNH não aprovada deixa o vínculo pendente, qualquer que seja a categoria', () => {
    expect(avaliarVinculo({ categoria: 'B', aprovada: false }, 4200).situacao).toBe('pendente');
    expect(avaliarVinculo({ categoria: null, aprovada: false }, 4200).situacao).toBe('pendente');
    expect(avaliarVinculo({ categoria: null, aprovada: false }, 4200).motivo).toContain(
      'ainda não enviou a CNH',
    );
  });

  it('CNH aprovada sem categoria, ou PBT inválido, bloqueia (só a cobertura confirmada libera)', () => {
    expect(avaliarVinculo({ categoria: null, aprovada: true }, 3000).situacao).toBe('bloqueado');
    expect(avaliarVinculo({ categoria: 'C', aprovada: true }, 0).situacao).toBe('bloqueado');
  });
});

describe('resumoDaAprovacaoDaCnh', () => {
  const frota = [
    { id: 'leve', pbtKg: 3000 },
    { id: 'limite', pbtKg: 3500 },
    { id: 'pesado', pbtKg: 4200 },
  ];

  it('B cobre até 3.500 kg e derruba só o vínculo do veículo pesado', () => {
    expect(resumoDaAprovacaoDaCnh('B', frota, ['pesado', 'leve'])).toEqual({
      cobertos: ['leve', 'limite'],
      naoCobertos: ['pesado'],
      derrubaria: ['pesado'],
    });
  });

  it('C cobre a Frota inteira e não derruba nada', () => {
    expect(resumoDaAprovacaoDaCnh('C', frota, ['pesado'])).toEqual({
      cobertos: ['leve', 'limite', 'pesado'],
      naoCobertos: [],
      derrubaria: [],
    });
  });

  it('sem vínculo, nada cai; sem veículos, listas vazias', () => {
    expect(resumoDaAprovacaoDaCnh('B', frota, []).derrubaria).toEqual([]);
    expect(resumoDaAprovacaoDaCnh('B', [], [])).toEqual({
      cobertos: [],
      naoCobertos: [],
      derrubaria: [],
    });
  });
});
