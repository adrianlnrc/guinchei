// Regra geográfica do MVP (ADR-0001, trava 1 do ADR-0007): origem e destino dentro do DF.
// TS puro, sem I/O. O banco reforça a mesma regra com o mesmo polígono (limite_df).
import { LIMITE_DF } from './limiteDF';

export interface Ponto {
  lat: number;
  lng: number;
}

/**
 * Ponto dentro do limite do DF (ou sobre ele). Cálculo plano em graus (ray casting), como o
 * `ST_Covers` com `geometry` do banco: para pontos fora da divisa os dois respondem igual.
 */
export function dentroDoDF({ lat, lng }: Ponto): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  let dentro = false;
  for (let i = 0, j = LIMITE_DF.length - 1; i < LIMITE_DF.length; j = i++) {
    const [x1, y1] = LIMITE_DF[i]!;
    const [x2, y2] = LIMITE_DF[j]!;
    if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) {
      dentro = !dentro;
    }
  }
  return dentro;
}

/** Retângulo envolvente do DF: [oeste, sul, leste, norte], como o `bbox` do Mapbox. */
export const BBOX_DF: readonly [number, number, number, number] = [
  Math.min(...LIMITE_DF.map(([lng]) => lng)),
  Math.min(...LIMITE_DF.map(([, lat]) => lat)),
  Math.max(...LIMITE_DF.map(([lng]) => lng)),
  Math.max(...LIMITE_DF.map(([, lat]) => lat)),
];

/** Esplanada dos Ministérios: centro do mapa quando ainda não há origem. */
export const CENTRO_DF: Ponto = { lat: -15.7975, lng: -47.8641 };

// ---------------------------------------------------------------------------
// ServicoMapas: o que os apps usam de mapa, sem saber do provedor (ADR-0008: Mapbox).
// ---------------------------------------------------------------------------

export interface Endereco {
  ponto: Ponto;
  /** Endereço completo para mostrar e gravar no Pedido. */
  rotulo: string;
}

export interface Rota {
  km: number;
  minutos: number;
  /** Traçado como [longitude, latitude], para desenhar no mapa. */
  linha: [number, number][];
}

export type MotivoErroMapas = 'rede' | 'sem_rota' | 'falha';

export class ErroMapas extends Error {
  constructor(
    readonly motivo: MotivoErroMapas,
    mensagem: string,
    options?: { cause?: unknown },
  ) {
    super(mensagem, options);
    this.name = 'ErroMapas';
  }
}

export interface ServicoMapas {
  /** Sugestões de endereço para o texto digitado; só devolve endereços dentro do DF. */
  buscarEnderecos(texto: string, perto?: Ponto): Promise<Endereco[]>;
  /** Endereço mais próximo do ponto (geocoding reverso); `null` se não houver. */
  enderecoDoPonto(ponto: Ponto): Promise<Endereco | null>;
  /** Rota de carro entre os dois pontos. Lança `ErroMapas('sem_rota')` se não houver. */
  rota(origem: Ponto, destino: Ponto): Promise<Rota>;
}
