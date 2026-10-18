// Decisão do próximo Guincheiro no Match (ADR-0002, ADR-0008, ADR-0009). TS puro, sem I/O
// nem imports: a Edge Function (Deno) importa este arquivo direto, como faz com
// @guinchei/preco.
//
// Regras de uma rodada:
// - oferta ao candidato elegível mais próximo que ainda não recebeu o Pedido nesta rodada;
// - recusa e expiração passam ao próximo e contam no teto de tentativas;
// - pulado pelo teto da Comissão (`pulada_teto`, ADR-0009) não chegou a receber a oferta:
//   segue para o próximo e não conta no teto;
// - com uma oferta aberta (ou aceita), ninguém mais recebe;
// - no teto, ou sem candidato novo, a rodada está esgotada (o Pedido vai a `sem_guincheiro`).
// Cada "tentar de novo" do Cliente abre uma rodada nova, com as tentativas zeradas.

/** Teto de tentativas por rodada (ADR-0008). O banco guarda o valor em uso. */
export const LIMITE_TENTATIVAS_PADRAO = 3;

export interface Candidato {
  guincheiroId: string;
  /** Distância até o veículo. */
  km: number;
}

/** Espelho do enum `resultado_tentativa` do banco. */
export type ResultadoTentativa = 'oferecida' | 'aceita' | 'recusada' | 'expirada' | 'pulada_teto';

export interface Tentativa {
  guincheiroId: string;
  resultado: ResultadoTentativa;
}

export interface EntradaDecisao {
  /** Guincheiros elegíveis agora, do mais perto ao mais longe. */
  candidatos: readonly Candidato[];
  tentativasDaRodada: readonly Tentativa[];
  limiteTentativas: number;
}

export type Decisao =
  | { tipo: 'ofertar'; candidato: Candidato }
  /** Há uma oferta aberta (ou já aceita) na rodada: nada a fazer agora. */
  | { tipo: 'aguardar' }
  | { tipo: 'esgotado' };

export function decidirProximo({
  candidatos,
  tentativasDaRodada,
  limiteTentativas,
}: EntradaDecisao): Decisao {
  if (!Number.isInteger(limiteTentativas) || limiteTentativas < 1) {
    throw new RangeError(
      `limiteTentativas deve ser um inteiro maior que 0 (recebido: ${limiteTentativas})`,
    );
  }
  if (tentativasDaRodada.some((t) => t.resultado === 'oferecida' || t.resultado === 'aceita')) {
    return { tipo: 'aguardar' };
  }
  const ofertas = tentativasDaRodada.filter((t) => t.resultado !== 'pulada_teto');
  if (ofertas.length >= limiteTentativas) return { tipo: 'esgotado' };
  const jaVistos = new Set(tentativasDaRodada.map((t) => t.guincheiroId));
  const candidato = candidatos.find((c) => !jaVistos.has(c.guincheiroId));
  return candidato ? { tipo: 'ofertar', candidato } : { tipo: 'esgotado' };
}
