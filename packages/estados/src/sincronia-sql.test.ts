// Garante que o banco tem os mesmos estados e reforça exatamente as transições desta
// biblioteca. Os estados vêm dos enums gerados em @guinchei/tipos. Lê os blocos `-- inicio:<tabela>` … `-- fim:<tabela>` da migração de transições e compara
// os pares com TRANSICOES_PEDIDO e TRANSICOES_CORRIDA. O pgTAP
// (supabase/tests/transicoes.test.sql) completa a prova: o trigger aceita exatamente os
// pares dessas tabelas. Se uma migração nova mudar as transições, aponte este import para ela.
import { describe, expect, it } from 'vitest';
import migracaoInicial from '../../../supabase/migrations/20261017233246_transicoes_de_estado.sql?raw';
import migracaoRecotacao from '../../../supabase/migrations/20261022193100_recotacao_do_preco.sql?raw';
import { Constants } from '@guinchei/tipos';
import {
  ESTADOS_CORRIDA,
  ESTADOS_PEDIDO,
  TRANSICOES_CORRIDA,
  TRANSICOES_PEDIDO,
  type Transicao,
} from './index';

function paresDoBloco(migracao: string, bloco: string): string[] {
  const achado = new RegExp(`-- inicio:${bloco}\\n([\\s\\S]*?)-- fim:${bloco}`).exec(migracao);
  if (!achado?.[1]) throw new Error(`Bloco ${bloco} não encontrado na migração`);
  return [...achado[1].matchAll(/\('(\w+)', '(\w+)'\)/g)].map(([, de, para]) => `${de}→${para}`);
}

// As transições do Pedido são as da migração inicial mais as que a migração da recotação
// (ADR-0013) acrescentou.
function paresDaMigracao(tabela: string): string[] {
  const inicial = paresDoBloco(migracaoInicial, tabela);
  return tabela === 'transicoes_pedido'
    ? [...inicial, ...paresDoBloco(migracaoRecotacao, 'transicoes_pedido_recotacao')]
    : inicial;
}

function pares(transicoes: readonly Transicao<string>[]): string[] {
  return transicoes.map(([de, para]) => `${de}→${para}`);
}

describe('estados: TS e enums do banco não divergem', () => {
  it('Pedido', () => {
    expect(ESTADOS_PEDIDO).toEqual(Constants.public.Enums.estado_pedido);
  });

  it('Corrida', () => {
    expect(ESTADOS_CORRIDA).toEqual(Constants.public.Enums.estado_corrida);
  });
});

describe('transições: TS e SQL não divergem', () => {
  it('Pedido', () => {
    expect(paresDaMigracao('transicoes_pedido').sort()).toEqual(pares(TRANSICOES_PEDIDO).sort());
  });

  it('Corrida', () => {
    expect(paresDaMigracao('transicoes_corrida').sort()).toEqual(pares(TRANSICOES_CORRIDA).sort());
  });
});
