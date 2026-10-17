// Motor do Preço fechado (ADR-0003, ADR-0009). TS puro, sem I/O.
// Todos os valores monetários são inteiros em centavos.

/** Tabela de preços versionada. Frações (adicionais, comissão) vão de 0 a 1. */
export interface TabelaPrecos {
  versao: number;
  /** Centavos, inteiro. */
  taxaBase: number;
  /** Centavos por km do Guincheiro até o veículo. */
  porKmAteVeiculo: number;
  /** Centavos por km rebocado. */
  porKmRebocado: number;
  /** Fração sobre o subtotal, ex.: 0.15. */
  adicionalNoturno: number;
  /** Hora (0–23, Brasília) em que o período noturno começa. */
  noturnoDas: number;
  /** Hora (0–23, Brasília) em que o período noturno termina, exclusiva. */
  noturnoAte: number;
  /** Fração sobre o subtotal, ex.: 0.2. */
  adicionalFeriado: number;
  /** Preço fechado mínimo em centavos, aplicado depois dos adicionais. */
  precoMinimo: number;
  /** Comissão da plataforma, fração do Preço fechado (RN09). */
  comissao: number;
}

/**
 * Valores iniciais do ADR-0009 (provisórios, revisar no piloto): taxa base R$ 110,00;
 * R$ 5,00/km até o veículo; R$ 6,00/km rebocado; +15% das 20h às 6h; +20% em feriado;
 * Preço fechado mínimo R$ 180,00; Comissão 20%.
 */
export const TABELA_PADRAO: Readonly<TabelaPrecos> = Object.freeze({
  versao: 1,
  taxaBase: 11000,
  porKmAteVeiculo: 500,
  porKmRebocado: 600,
  adicionalNoturno: 0.15,
  noturnoDas: 20,
  noturnoAte: 6,
  adicionalFeriado: 0.2,
  precoMinimo: 18000,
  comissao: 0.2,
});

export interface Cotacao {
  /** Distância do Guincheiro até o veículo. */
  kmAteVeiculo: number;
  kmRebocado: number;
  /** Momento da cotação: `Date` ou string ISO 8601. Noturno e feriado são decididos em Brasília. */
  instante: Date | string;
  /** Feriados no formato YYYY-MM-DD (data de Brasília). */
  feriados: readonly string[];
}

/** Decomposição do Preço fechado em centavos; as parcelas somam exatamente o `total`. */
export interface PrecoFechado {
  taxaBase: number;
  deslocamento: number;
  reboque: number;
  adicionalNoturno: number;
  adicionalFeriado: number;
  ajustePiso: number;
  total: number;
}

const relogioDeBrasilia = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Data (YYYY-MM-DD) e hora (0–23) do instante no fuso de Brasília, independente do TZ do processo. */
function emBrasilia(instante: Date): { data: string; hora: number } {
  const partes: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const { type, value } of relogioDeBrasilia.formatToParts(instante)) partes[type] = value;
  return { data: `${partes.year}-${partes.month}-${partes.day}`, hora: Number(partes.hour) };
}

function ehNoturno(hora: number, tabela: TabelaPrecos): boolean {
  return tabela.noturnoDas > tabela.noturnoAte
    ? hora >= tabela.noturnoDas || hora < tabela.noturnoAte
    : hora >= tabela.noturnoDas && hora < tabela.noturnoAte;
}

function exigirNaoNegativo(nome: string, valor: number): void {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(`${nome} deve ser um número finito e não negativo (recebido: ${valor})`);
  }
}

function exigirCentavos(nome: string, valor: number): void {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new RangeError(
      `${nome} deve ser um valor inteiro e não negativo em centavos (recebido: ${valor})`,
    );
  }
}

function exigirFracao(nome: string, valor: number): void {
  if (!Number.isFinite(valor) || valor < 0 || valor > 1) {
    throw new RangeError(`${nome} deve ser uma fração entre 0 e 1 (recebido: ${valor})`);
  }
}

function exigirHora(nome: string, valor: number): void {
  if (!Number.isInteger(valor) || valor < 0 || valor > 23) {
    throw new RangeError(`${nome} deve ser uma hora inteira de 0 a 23 (recebido: ${valor})`);
  }
}

function validarTabela(tabela: TabelaPrecos): void {
  exigirCentavos('taxaBase', tabela.taxaBase);
  exigirNaoNegativo('porKmAteVeiculo', tabela.porKmAteVeiculo);
  exigirNaoNegativo('porKmRebocado', tabela.porKmRebocado);
  exigirCentavos('precoMinimo', tabela.precoMinimo);
  exigirFracao('adicionalNoturno', tabela.adicionalNoturno);
  exigirFracao('adicionalFeriado', tabela.adicionalFeriado);
  exigirFracao('comissao', tabela.comissao);
  exigirHora('noturnoDas', tabela.noturnoDas);
  exigirHora('noturnoAte', tabela.noturnoAte);
}

// Uma string sem fuso explícito seria lida no fuso do processo; exigimos `Z` ou `±hh:mm`.
const COM_FUSO = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function lerInstante(instante: Date | string): Date {
  const data = new Date(instante);
  if (Number.isNaN(data.getTime()) || (typeof instante === 'string' && !COM_FUSO.test(instante))) {
    throw new RangeError(
      `instante deve ser um Date válido ou ISO 8601 com fuso, ex.: 2026-10-13T20:00:00-03:00 (recebido: ${String(instante)})`,
    );
  }
  return data;
}

function validarFeriados(feriados: readonly string[]): void {
  const invalido = feriados.find((feriado) => !DATA_ISO.test(feriado));
  if (invalido !== undefined) {
    throw new RangeError(`feriados devem estar no formato YYYY-MM-DD (recebido: ${invalido})`);
  }
}

export function calcularPrecoFechado(cotacao: Cotacao, tabela: TabelaPrecos): PrecoFechado {
  validarTabela(tabela);
  exigirNaoNegativo('kmAteVeiculo', cotacao.kmAteVeiculo);
  exigirNaoNegativo('kmRebocado', cotacao.kmRebocado);
  validarFeriados(cotacao.feriados);
  const { data, hora } = emBrasilia(lerInstante(cotacao.instante));
  const deslocamento = Math.round(cotacao.kmAteVeiculo * tabela.porKmAteVeiculo);
  const reboque = Math.round(cotacao.kmRebocado * tabela.porKmRebocado);
  const subtotal = tabela.taxaBase + deslocamento + reboque;
  const adicionalNoturno = ehNoturno(hora, tabela)
    ? Math.round(subtotal * tabela.adicionalNoturno)
    : 0;
  const adicionalFeriado = cotacao.feriados.includes(data)
    ? Math.round(subtotal * tabela.adicionalFeriado)
    : 0;
  const comAdicionais = subtotal + adicionalNoturno + adicionalFeriado;
  const ajustePiso = Math.max(0, tabela.precoMinimo - comAdicionais);
  return {
    taxaBase: tabela.taxaBase,
    deslocamento,
    reboque,
    adicionalNoturno,
    adicionalFeriado,
    ajustePiso,
    total: comAdicionais + ajustePiso,
  };
}

export interface Repasse {
  comissao: number;
  repasse: number;
}

export function calcularRepasse(precoFechado: number, tabela: TabelaPrecos): Repasse {
  validarTabela(tabela);
  exigirCentavos('precoFechado', precoFechado);
  const comissao = Math.round(precoFechado * tabela.comissao);
  return { comissao, repasse: precoFechado - comissao };
}

export interface OfertaAoGuincheiro {
  /** Repasse ao candidato: preço recalculado com a distância dele, menos a Comissão. */
  repasse: number;
  /**
   * Quanto a plataforma tira da própria Comissão: repasse do candidato menos o repasse do
   * Preço fechado travado. Negativo quando o candidato está mais perto que o da cotação.
   */
  absorcao: number;
  /** Falso quando a absorção passa da Comissão inteira da Corrida (teto do ADR-0009). */
  oferecer: boolean;
}

/**
 * Avalia a oferta de um Pedido a um Guincheiro candidato no Match (ADR-0009, opção A).
 * O Cliente paga o Preço fechado travado; o candidato recebe pela própria distância.
 */
export function avaliarOfertaAoGuincheiro(
  precoTravado: number,
  precoDoCandidato: number,
  tabela: TabelaPrecos,
): OfertaAoGuincheiro {
  const travado = calcularRepasse(precoTravado, tabela);
  const { repasse } = calcularRepasse(precoDoCandidato, tabela);
  const absorcao = repasse - travado.repasse;
  return { repasse, absorcao, oferecer: absorcao <= travado.comissao };
}
