// Pagamento do Pedido atrás de uma interface (ADR-0004, ADR-0008). O PSP real (RF12) entra
// como outro adaptador; no skeleton, só o mock, que não chama ninguém.
// Valores em centavos, inteiros. Sem imports: a Edge Function (Deno) importa este arquivo
// direto, como faz com @guinchei/preco.

/** Só informativo no mock; o PSP real usa para escolher o meio. */
export type MetodoPagamento = 'pix' | 'cartao';

export interface PedidoDeAutorizacao {
  pedidoId: string;
  /** Centavos: o Preço fechado gravado no Pedido. */
  valor: number;
  metodo: MetodoPagamento;
}

export interface Autorizacao {
  estado: 'autorizado' | 'recusado';
  /** Identificador do pagamento no provedor. */
  referenciaExterna: string;
  valor: number;
}

export interface OperacaoSobreAutorizacao {
  referenciaExterna: string;
  /** Centavos. */
  valor: number;
}

export interface ResultadoOperacao {
  estado: 'capturado' | 'estornado';
  referenciaExterna: string;
  valor: number;
}

export interface GatewayPagamento {
  /** Gravado em `pagamentos.provedor`. */
  readonly provedor: string;
  /** Reserva o valor no meio de pagamento do Cliente, sem cobrar ainda. */
  autorizar(pedido: PedidoDeAutorizacao): Promise<Autorizacao>;
  /** Cobra o valor autorizado (fim da Corrida, #14). */
  capturar(operacao: OperacaoSobreAutorizacao): Promise<ResultadoOperacao>;
  /** Devolve o valor ao Cliente (sem Guincheiro, #11). */
  estornar(operacao: OperacaoSobreAutorizacao): Promise<ResultadoOperacao>;
}

// lib ES2022 sem DOM: Node 22, navegadores e Deno têm `crypto.randomUUID`.
declare const crypto: { randomUUID(): string };

const PREFIXO_MOCK = 'mock_';

function exigirCentavos(valor: number): void {
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw new RangeError(`valor deve ser inteiro e positivo em centavos (recebido: ${valor})`);
  }
}

function exigirReferenciaDoMock(referenciaExterna: string): void {
  if (!referenciaExterna.startsWith(PREFIXO_MOCK)) {
    throw new Error(`referência ${referenciaExterna} não é do provedor mock`);
  }
}

export interface OpcoesGatewayMock {
  /**
   * Cenário de teste da recusa: recusa os valores terminados em 99 centavos. Desligado por
   * padrão, para nunca recusar um Preço fechado real; só os testes ligam.
   */
  recusarValoresTerminadosEm99?: boolean;
}

/**
 * Adaptador mock: autoriza sempre (com a recusa de teste ligada, recusa os valores
 * terminados em 99 centavos). Sem estado próprio: quem guarda o estado do pagamento é a
 * tabela `pagamentos`, como seria com o PSP real. Capturar e estornar só conferem que a
 * referência é do mock.
 */
export function criarGatewayMock({
  recusarValoresTerminadosEm99 = false,
}: OpcoesGatewayMock = {}): GatewayPagamento {
  return {
    provedor: 'mock',

    async autorizar({ valor }) {
      exigirCentavos(valor);
      const referenciaExterna = `${PREFIXO_MOCK}${crypto.randomUUID()}`;
      const estado = recusarValoresTerminadosEm99 && valor % 100 === 99 ? 'recusado' : 'autorizado';
      return { estado, referenciaExterna, valor };
    },

    async capturar({ referenciaExterna, valor }) {
      exigirReferenciaDoMock(referenciaExterna);
      exigirCentavos(valor);
      return { estado: 'capturado', referenciaExterna, valor };
    },

    async estornar({ referenciaExterna, valor }) {
      exigirReferenciaDoMock(referenciaExterna);
      exigirCentavos(valor);
      return { estado: 'estornado', referenciaExterna, valor };
    },
  };
}
