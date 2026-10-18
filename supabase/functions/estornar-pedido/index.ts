// POST /functions/v1/estornar-pedido  { pedido_id }
//
// O Cliente desiste do Pedido em `sem_guincheiro` (nota de revisão do ADR-0008): estorna no
// GatewayPagamento (adaptador mock no skeleton) a autorização do Pedido e registra o
// estorno; pagamento e Pedido vão a `estornado`.
//
// Resposta: { estado: 'estornado', valor } (valor em centavos).
import { criarGatewayMock } from '../../../packages/pagamento/src/index.ts';
import {
  ErroServidor,
  pedidoIdDoCorpo,
  rpc,
  servir,
  type ErroBanco,
} from '../_compartilhado/servidor.ts';

// O PSP real (RF12) troca só esta linha.
const gateway = criarGatewayMock();

const SEM_ESTORNO = new ErroServidor(
  404,
  'pedido_indisponivel',
  'Este Pedido não está aguardando um Guincheiro para ser estornado',
);

function traduzir(erro: ErroBanco): ErroServidor | null {
  // P0002: não é do Cliente ou não está em `sem_guincheiro`; GPG03: sem autorização viva.
  return erro.code === 'P0002' || erro.code === 'GPG03' ? SEM_ESTORNO : null;
}

servir(async ({ clienteId, corpo }) => {
  const pedidoId = pedidoIdDoCorpo(corpo);
  const autorizacao = await rpc<{ referencia_externa: string; valor: number }>(
    'pagamento_para_estornar',
    { pedido_id: pedidoId, cliente_id: clienteId },
  );
  // Provisório: se o Cliente pedir "tentar de novo" entre o estorno no provedor e o
  // registro, o registro falha com o valor já estornado. Com o PSP real (RF12), conciliar.
  const estorno = await gateway.estornar({
    referenciaExterna: autorizacao.referencia_externa,
    valor: autorizacao.valor,
  });
  await rpc('registrar_estorno', {
    pedido_id: pedidoId,
    cliente_id: clienteId,
    referencia_externa: estorno.referenciaExterna,
  });
  return { estado: 'estornado', valor: estorno.valor };
}, traduzir);
