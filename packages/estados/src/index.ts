// Estados fixados no ADR-0008. As transições permitidas entram junto com o schema (F2, #6).

export const ESTADOS_PEDIDO = [
  'cotado',
  'confirmado',
  'em_match',
  'atribuido',
  'sem_guincheiro',
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
