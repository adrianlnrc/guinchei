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
//
// Recotação (ADR-0013): quando o próximo candidato é de outra Frota que a cotada, o preço é
// refeito e `decidirRecotacao` diz se o Cliente precisa aprovar.

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

export interface EntradaDecisao<C extends Candidato = Candidato> {
  /** Guincheiros elegíveis agora, do mais perto ao mais longe. */
  candidatos: readonly C[];
  tentativasDaRodada: readonly Tentativa[];
  limiteTentativas: number;
}

export type Decisao<C extends Candidato = Candidato> =
  | { tipo: 'ofertar'; candidato: C }
  /** Há uma oferta aberta (ou já aceita) na rodada: nada a fazer agora. */
  | { tipo: 'aguardar' }
  | { tipo: 'esgotado' };

export function decidirProximo<C extends Candidato>({
  candidatos,
  tentativasDaRodada,
  limiteTentativas,
}: EntradaDecisao<C>): Decisao<C> {
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

export interface EntradaRecotacao {
  /** Frota do Guincheiro com quem o Preço fechado foi cotado; `null` em Pedido anterior ao ADR-0013. */
  frotaCotadaId: string | null;
  frotaDoCandidatoId: string;
  /** Centavos: o Preço fechado em vigor no Pedido. */
  precoAtual: number;
  /** Centavos: o preço recalculado com a distância do candidato (mesma tabela e mesmo trajeto). */
  precoNovo: number;
}

export type DecisaoRecotacao =
  /** Mesma Frota cotada: nada muda para o Cliente (repasse pela distância, ADR-0009). */
  | { tipo: 'manter' }
  /** Outra Frota, preço menor ou igual: segue sem pausa; a diferença é estornada. */
  | { tipo: 'aplicar'; precoAnterior: number; precoNovo: number; diferenca: number }
  /** Outra Frota, preço maior: a oferta pausa até o Cliente aprovar ou desistir. */
  | { tipo: 'pedir_aprovacao'; precoAnterior: number; precoNovo: number; acrescimo: number };

function exigirCentavos(nome: string, valor: number): void {
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw new RangeError(`${nome} deve ser inteiro e positivo em centavos (recebido: ${valor})`);
  }
}

/** Decide se o Preço fechado é refeito ao passar o Pedido a um candidato de outra Frota (ADR-0013). */
export function decidirRecotacao({
  frotaCotadaId,
  frotaDoCandidatoId,
  precoAtual,
  precoNovo,
}: EntradaRecotacao): DecisaoRecotacao {
  exigirCentavos('precoAtual', precoAtual);
  exigirCentavos('precoNovo', precoNovo);
  if (frotaCotadaId === null || frotaCotadaId === frotaDoCandidatoId) return { tipo: 'manter' };
  if (precoNovo <= precoAtual) {
    return {
      tipo: 'aplicar',
      precoAnterior: precoAtual,
      precoNovo,
      diferenca: precoAtual - precoNovo,
    };
  }
  return {
    tipo: 'pedir_aprovacao',
    precoAnterior: precoAtual,
    precoNovo,
    acrescimo: precoNovo - precoAtual,
  };
}
