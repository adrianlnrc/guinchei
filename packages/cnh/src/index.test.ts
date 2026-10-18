import { describe, expect, it } from 'vitest';
import { categoriaCobrePbt, cnhHabilitaConduzir } from './index';

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
  ['B', 0, 'erro'],
  ['B', -10, 'erro'],
  ['B', Number.NaN, 'erro'],
  ['B', Number.POSITIVE_INFINITY, 'erro'],
  ['C', 0, 'erro'],
  ['X', 3000, 'erro'],
  ['AB', 3000, 'erro'],
  ['b', 3000, 'erro'],
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
