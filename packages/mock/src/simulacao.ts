// Dublês das regras de Corrida para o protótipo navegável.
// O Preço fechado já vem de @guinchei/preco; as transições virão de
// @guinchei/estados (F2, #6) e, quando chegarem, os apps passam a usá-las e
// este arquivo sai.
import type { EstadoCorrida, EstadoPedido } from '@guinchei/estados';

/** Taxa de cancelamento após "a caminho", em centavos, repassada ao Guincheiro (CONTEXT, regra 7). */
export const TAXA_CANCELAMENTO = 3000;

export const TRANSICOES_CORRIDA: Record<EstadoCorrida, readonly EstadoCorrida[]> = {
  aceita: ['a_caminho'],
  a_caminho: ['no_local'],
  no_local: ['carregado'],
  carregado: ['entregue'],
  entregue: [],
};

export const FOTOS_MIN_POR_ETAPA = 1;
export const FOTOS_MAX_POR_ETAPA = 6;

export interface FotosDaCorrida {
  antes: number;
  depois: number;
}

export class TransicaoInvalida extends Error {}

/** `carregado` exige Fotos de estado "antes"; `entregue` exige Fotos "depois" (RN04). */
export function transitarCorrida(
  de: EstadoCorrida,
  para: EstadoCorrida,
  fotos: FotosDaCorrida,
): EstadoCorrida {
  if (!TRANSICOES_CORRIDA[de].includes(para)) {
    throw new TransicaoInvalida(`Corrida não vai de ${de} para ${para}`);
  }
  if (para === 'carregado' && fotos.antes < FOTOS_MIN_POR_ETAPA) {
    throw new TransicaoInvalida('Faltam as Fotos de estado antes de carregar');
  }
  if (para === 'entregue' && fotos.depois < FOTOS_MIN_POR_ETAPA) {
    throw new TransicaoInvalida('Faltam as Fotos de estado depois de entregar');
  }
  return para;
}

/**
 * Taxa cobrada se o Cliente cancelar agora. Até o Guincheiro sair é grátis;
 * depois de "a caminho" cobra a taxa, repassada ao Guincheiro. Com o carro
 * carregado não há cancelamento.
 */
export function taxaDeCancelamento(estado: EstadoPedido | EstadoCorrida): number | null {
  if (estado === 'carregado' || estado === 'entregue') return null;
  if (estado === 'a_caminho' || estado === 'no_local') return TAXA_CANCELAMENTO;
  return 0;
}
