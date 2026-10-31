// Máquinas de estado do Pedido e da Corrida (ADR-0008, com a nota de revisão de 2026-10-17).
//
// As tabelas de transição abaixo são a fonte da verdade. O banco reforça exatamente as
// mesmas (tabelas `transicoes_pedido` e `transicoes_corrida`, migração
// `supabase/migrations/*_transicoes_de_estado.sql`); `sincronia-sql.test.ts` falha se
// as duas divergirem.

export const ESTADOS_PEDIDO = [
  'cotado',
  'confirmado',
  'em_match',
  'atribuido',
  'sem_guincheiro',
  'estornado',
  'aguardando_aprovacao_preco',
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const ESTADOS_CORRIDA = [
  'aceita',
  'a_caminho',
  'no_local',
  'carregado',
  'entregue',
] as const;
export type EstadoCorrida = (typeof ESTADOS_CORRIDA)[number];

export type Transicao<E> = readonly [de: E, para: E];

/**
 * Pedido: `cotado → confirmado → em_match → atribuido | sem_guincheiro`.
 * De `sem_guincheiro` o Cliente tenta de novo (nova rodada de Match, mesmo Preço fechado)
 * ou estorna o pagamento (`estornado`, terminal). `atribuido` é terminal para o Pedido: a
 * partir dali quem anda é a Corrida. Cancelamento (RF14) fica fora do skeleton.
 *
 * ADR-0013: se o Match passa o Pedido a outra Frota por um preço maior, `em_match` vai a
 * `aguardando_aprovacao_preco`; o Cliente aprova (volta a `em_match`) ou desiste, ou o prazo
 * vence (`estornado`, com estorno integral).
 */
export const TRANSICOES_PEDIDO: readonly Transicao<EstadoPedido>[] = [
  ['cotado', 'confirmado'],
  ['confirmado', 'em_match'],
  ['em_match', 'atribuido'],
  ['em_match', 'sem_guincheiro'],
  ['sem_guincheiro', 'em_match'],
  ['sem_guincheiro', 'estornado'],
  ['em_match', 'aguardando_aprovacao_preco'],
  ['aguardando_aprovacao_preco', 'em_match'],
  ['aguardando_aprovacao_preco', 'estornado'],
];

/**
 * Corrida: `aceita → a_caminho → no_local → carregado → entregue`. `aceita → a_caminho`
 * é a ação "Saí para o local" do Guincheiro. Sem guarda de Fotos de estado (ADR-0011).
 */
export const TRANSICOES_CORRIDA: readonly Transicao<EstadoCorrida>[] = [
  ['aceita', 'a_caminho'],
  ['a_caminho', 'no_local'],
  ['no_local', 'carregado'],
  ['carregado', 'entregue'],
];

export type Maquina = 'pedido' | 'corrida';
export type EstadoDe<M extends Maquina> = M extends 'pedido' ? EstadoPedido : EstadoCorrida;

const TRANSICOES: { [M in Maquina]: readonly Transicao<EstadoDe<M>>[] } = {
  pedido: TRANSICOES_PEDIDO,
  corrida: TRANSICOES_CORRIDA,
};

export function podeTransitar<M extends Maquina>(
  maquina: M,
  de: EstadoDe<M>,
  para: EstadoDe<M>,
): boolean {
  const transicoes: readonly Transicao<string>[] = TRANSICOES[maquina];
  return transicoes.some(([d, p]) => d === de && p === para);
}

const NOME_DA_MAQUINA: Record<Maquina, string> = { pedido: 'Pedido', corrida: 'Corrida' };

export class TransicaoInvalida extends Error {
  constructor(maquina: Maquina, de: string, para: string) {
    super(`${NOME_DA_MAQUINA[maquina]} não pode ir de ${de} para ${para}`);
    this.name = 'TransicaoInvalida';
  }
}

/** Devolve `para` se a transição é permitida; senão lança `TransicaoInvalida`. */
export function transitar<M extends Maquina>(
  maquina: M,
  de: EstadoDe<M>,
  para: EstadoDe<M>,
): EstadoDe<M> {
  if (!podeTransitar(maquina, de, para)) throw new TransicaoInvalida(maquina, de, para);
  return para;
}

export type EtapaFoto = 'antes' | 'depois';

/**
 * Etapa das Fotos de estado registradas com a Corrida neste estado (ADR-0011): "antes" até o
 * Guincheiro tocar em "Carreguei" (`aceita`, `a_caminho` e `no_local`) e "depois" de
 * `carregado` em diante. O banco deriva a mesma etapa do estado da Corrida ao gravar
 * (`fotos_estado_preencher`, migração `*_fotos_de_estado_etapa_e_limite.sql`).
 */
export function etapaDaFoto(estado: EstadoCorrida): EtapaFoto {
  return estado === 'carregado' || estado === 'entregue' ? 'depois' : 'antes';
}
