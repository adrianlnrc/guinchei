// Garante que TS e banco aplicam a mesma regra CNH × PBT. O pgTAP
// (supabase/tests/cnh_pbt.test.sql) prova que a função `categoria_cnh_cobre_pbt` responde a
// tabela de verdade que ele traz entre `-- inicio:casos` e `-- fim:casos`; este teste lê a
// mesma tabela e confere que `categoriaCobrePbt` responde igual. Se uma migração nova mudar a
// regra, aponte os imports para ela e atualize a tabela nos dois lugares.
import { describe, expect, it } from 'vitest';
import migracao from '../../../supabase/migrations/20261018190000_cnh_pbt.sql?raw';
import testeDoBanco from '../../../supabase/tests/cnh_pbt.test.sql?raw';
import { CATEGORIAS_CNH, LIMITE_PBT_CATEGORIA_B_KG, categoriaCobrePbt } from './index';

interface Caso {
  categoria: string;
  pbtKg: number;
  esperado: boolean | null;
}

/** Linhas `('<categoria>', <pbt_kg>, <true|false|null>)` entre `-- inicio:casos` e `-- fim:casos`. */
function casosDoTesteDoBanco(): Caso[] {
  const bloco = /-- inicio:casos\n([\s\S]*?)-- fim:casos/.exec(testeDoBanco);
  if (!bloco?.[1]) throw new Error('Bloco de casos não encontrado no teste do banco');
  return [...bloco[1].matchAll(/\('([^']*)', (\S+), (true|false|null)\)/g)].map(
    ([, categoria, pbt, esperado]) => ({
      categoria: categoria!,
      pbtKg: Number(pbt),
      esperado: esperado === 'null' ? null : esperado === 'true',
    }),
  );
}

function comoNoBanco(categoria: string, pbtKg: number): boolean | null {
  const { situacao } = categoriaCobrePbt(categoria, pbtKg);
  return situacao === 'erro' ? null : situacao === 'coberto';
}

describe('CNH × PBT: TS e SQL não divergem', () => {
  const casos = casosDoTesteDoBanco();

  it('o pgTAP cobre toda categoria, as duas bandas de PBT e as fronteiras', () => {
    for (const categoria of CATEGORIAS_CNH) {
      for (const pbtKg of [LIMITE_PBT_CATEGORIA_B_KG, LIMITE_PBT_CATEGORIA_B_KG + 1]) {
        expect(casos, `${categoria} com ${pbtKg} kg`).toContainEqual(
          expect.objectContaining({ categoria, pbtKg }),
        );
      }
    }
    expect(casos.some((c) => c.esperado === null)).toBe(true);
  });

  it.each(casosDoTesteDoBanco())(
    'categoria $categoria com PBT $pbtKg kg: $esperado',
    ({ categoria, pbtKg, esperado }) => {
      expect(comoNoBanco(categoria, pbtKg)).toBe(esperado);
    },
  );

  it('a migração usa o mesmo limite e as mesmas categorias do TS', () => {
    expect(migracao).toContain(`<= ${LIMITE_PBT_CATEGORIA_B_KG}`);
    for (const categoria of CATEGORIAS_CNH) expect(migracao).toContain(`'${categoria}'`);
  });
});
