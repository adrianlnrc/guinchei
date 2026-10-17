// Dublês das regras de negócio para o protótipo navegável.
// O motor real do Preço fechado vem de @guinchei/preco (F3, #7) e as transições
// de @guinchei/estados (F2, #6); quando chegarem, os apps passam a usá-los e
// este arquivo sai. Os valores da tabela são de exemplo.
import type { EstadoCorrida, EstadoPedido } from '@guinchei/estados';

// Valores em centavos para não acumular erro de ponto flutuante.

export interface TabelaPrecos {
  versao: number;
  taxaBase: number;
  deslocamentoPorKm: number;
  reboquePorKm: number;
  /** Fração sobre o subtotal, ex.: 0.15 */
  adicionalNoturno: number;
  adicionalFeriado: number;
  /** Hora de início e fim (exclusivo) do período noturno */
  noturnoDas: number;
  noturnoAte: number;
  taxaCancelamento: number;
  /** Fixa no MVP (RN09) */
  comissao: number;
}

export const TABELA_PADRAO: TabelaPrecos = {
  versao: 4,
  taxaBase: 11000,
  deslocamentoPorKm: 500,
  reboquePorKm: 600,
  adicionalNoturno: 0.15,
  adicionalFeriado: 0.2,
  noturnoDas: 20,
  noturnoAte: 6,
  taxaCancelamento: 3000,
  comissao: 0.2,
};

export interface Cotacao {
  /** Distância do Guincheiro disponível mais próximo até o veículo */
  kmDeslocamento: number;
  kmReboque: number;
  quando: Date;
  feriado?: boolean;
}

export interface PrecoFechado {
  taxaBase: number;
  deslocamento: number;
  reboque: number;
  adicionalNoturno: number;
  adicionalFeriado: number;
  total: number;
}

export function ehNoturno(quando: Date, tabela: TabelaPrecos = TABELA_PADRAO): boolean {
  const hora = quando.getHours();
  return tabela.noturnoDas > tabela.noturnoAte
    ? hora >= tabela.noturnoDas || hora < tabela.noturnoAte
    : hora >= tabela.noturnoDas && hora < tabela.noturnoAte;
}

export function calcularPrecoFechado(
  cotacao: Cotacao,
  tabela: TabelaPrecos = TABELA_PADRAO,
): PrecoFechado {
  if (cotacao.kmDeslocamento < 0 || cotacao.kmReboque < 0) {
    throw new RangeError('Distância negativa');
  }
  const deslocamento = Math.round(cotacao.kmDeslocamento * tabela.deslocamentoPorKm);
  const reboque = Math.round(cotacao.kmReboque * tabela.reboquePorKm);
  const subtotal = tabela.taxaBase + deslocamento + reboque;
  // Os adicionais incidem sobre o subtotal, sem efeito composto entre si.
  const adicionalNoturno = ehNoturno(cotacao.quando, tabela)
    ? Math.round(subtotal * tabela.adicionalNoturno)
    : 0;
  const adicionalFeriado = cotacao.feriado ? Math.round(subtotal * tabela.adicionalFeriado) : 0;
  return {
    taxaBase: tabela.taxaBase,
    deslocamento,
    reboque,
    adicionalNoturno,
    adicionalFeriado,
    total: subtotal + adicionalNoturno + adicionalFeriado,
  };
}

export interface Repasse {
  comissao: number;
  repasse: number;
}

export function calcularRepasse(
  precoFechado: number,
  tabela: TabelaPrecos = TABELA_PADRAO,
): Repasse {
  const comissao = Math.round(precoFechado * tabela.comissao);
  return { comissao, repasse: precoFechado - comissao };
}

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
export function taxaDeCancelamento(
  estado: EstadoPedido | EstadoCorrida,
  tabela: TabelaPrecos = TABELA_PADRAO,
): number | null {
  if (estado === 'carregado' || estado === 'entregue') return null;
  if (estado === 'a_caminho' || estado === 'no_local') return tabela.taxaCancelamento;
  return 0;
}
