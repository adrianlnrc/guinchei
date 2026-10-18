// Garante que TS e banco aplicam a mesma regra do DF:
// 1. a função `limite_df()` da migração tem exatamente os vértices de LIMITE_DF;
// 2. o pgTAP (supabase/tests/trajeto_do_pedido.test.sql) confere no banco os mesmos pontos de
//    referência, com a mesma resposta, que index.test.ts confere aqui.
// Se uma migração nova trocar o polígono, aponte o import para ela.
import { describe, expect, it } from 'vitest';
import migracao from '../../../supabase/migrations/20261018120000_trajeto_do_pedido.sql?raw';
import testeDoBanco from '../../../supabase/tests/trajeto_do_pedido.test.sql?raw';
import { LIMITE_DF } from './limiteDF';
import { PONTOS_DE_REFERENCIA } from './pontosDeReferencia';

function verticesDaMigracao(): [number, number][] {
  const wkt = /POLYGON\(\(([^)]*)\)\)/.exec(migracao);
  if (!wkt?.[1]) throw new Error('POLYGON do limite_df não encontrado na migração');
  return wkt[1].split(',').map((par) => {
    const [lng, lat] = par.trim().split(/\s+/).map(Number);
    return [lng!, lat!];
  });
}

/** Linhas `('<nome>', <lat>, <lng>, <true|false>)` entre `-- inicio:pontos` e `-- fim:pontos`. */
function pontosDoTesteDoBanco() {
  const bloco = /-- inicio:pontos\n([\s\S]*?)-- fim:pontos/.exec(testeDoBanco);
  if (!bloco?.[1]) throw new Error('Bloco de pontos não encontrado no teste do banco');
  return [...bloco[1].matchAll(/\('(.+?)', (\S+), (\S+), (true|false)\)/g)].map(
    ([, nome, lat, lng, noDF]) => ({
      nome,
      lat: Number(lat),
      lng: Number(lng),
      noDF: noDF === 'true',
    }),
  );
}

describe('limite do DF: TS e SQL não divergem', () => {
  it('mesmos vértices', () => {
    expect(verticesDaMigracao()).toEqual(LIMITE_DF);
  });

  it('o pgTAP confere os mesmos pontos de referência', () => {
    expect(pontosDoTesteDoBanco()).toEqual(PONTOS_DE_REFERENCIA);
  });
});
