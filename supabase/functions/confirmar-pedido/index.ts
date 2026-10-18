// POST /functions/v1/confirmar-pedido  { pedido_id, metodo: 'pix' | 'cartao' }
//
// Confirma o Pedido do Cliente logado (RF06): lê o Preço fechado gravado, autoriza esse
// mesmo valor no GatewayPagamento (adaptador mock no skeleton, sem PSP real) e registra o
// resultado. Autorizado: o Pedido vai de `cotado` a `confirmado`. Recusado: o pagamento
// fica registrado, o Pedido continua `cotado` e a resposta é 402 `pagamento_recusado`.
//
// Resposta: { id, estado: 'autorizado', valor } (valor em centavos).
import {
  criarGatewayMock,
  type MetodoPagamento,
} from '../../../packages/pagamento/src/index.ts';
import {
  ErroServidor,
  PEDIDO_INDISPONIVEL,
  pedidoIdDoCorpo,
  rpc,
  servir,
  type ErroBanco,
} from '../_compartilhado/servidor.ts';

// O PSP real (RF12) troca só esta linha.
const gateway = criarGatewayMock();

const SEM_COTACAO = new ErroServidor(
  409,
  'sem_cotacao',
  'O preço mudou ou ainda não foi calculado. Veja o preço de novo.',
);

function traduzir(erro: ErroBanco): ErroServidor | null {
  switch (erro.code) {
    case 'P0002':
      return PEDIDO_INDISPONIVEL;
    // Sem Preço fechado, ou ele mudou entre a leitura e o registro (trajeto trocado).
    case 'GPG01':
    case 'GPG02':
      return SEM_COTACAO;
    default:
      return null;
  }
}

function metodoDoCorpo(corpo: Record<string, unknown>): MetodoPagamento {
  if (corpo.metodo === 'pix' || corpo.metodo === 'cartao') return corpo.metodo;
  throw new ErroServidor(400, 'falha', 'metodo deve ser pix ou cartao');
}

servir(async ({ clienteId, corpo }) => {
  const pedidoId = pedidoIdDoCorpo(corpo);
  const metodo = metodoDoCorpo(corpo);

  const valor = await rpc<number>('preco_para_confirmar', {
    pedido_id: pedidoId,
    cliente_id: clienteId,
  });
  const autorizacao = await gateway.autorizar({ pedidoId, valor, metodo });
  const id = await rpc<string>('registrar_pagamento', {
    pedido_id: pedidoId,
    cliente_id: clienteId,
    valor: autorizacao.valor,
    estado: autorizacao.estado,
    metodo,
    provedor: gateway.provedor,
    referencia_externa: autorizacao.referenciaExterna,
  });

  if (autorizacao.estado === 'recusado') {
    throw new ErroServidor(
      402,
      'pagamento_recusado',
      'Pagamento recusado. Tente de novo ou use outro meio de pagamento.',
    );
  }
  return { id, estado: 'autorizado', valor: autorizacao.valor };
}, traduzir);
