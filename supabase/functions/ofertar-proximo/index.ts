// POST /functions/v1/ofertar-proximo  { pedido_id }   (só o backend: service_role)
//
// Avança o Match do Pedido um passo (RF07, ADR-0002): oferta ao Guincheiro elegível mais
// próximo que ainda não recebeu o Pedido nesta rodada, com o repasse pela distância dele
// (ADR-0009), ou leva o Pedido a `sem_guincheiro` quando a rodada se esgota. Quem chama é o
// banco, pelo pg_net (`disparar_ofertar_proximo`): depois de uma recusa, de um "tentar de
// novo" e na varredura do pg_cron que expira as ofertas vencidas. Idempotente.
//
// Resposta: o passo dado ({ tipo: 'ofertado' | 'aguardando' | 'sem_guincheiro' |
// 'fora_do_match', ... }).
import { ofertarProximo } from '../_compartilhado/match.ts';
import {
  PEDIDO_INDISPONIVEL,
  pedidoIdDoCorpo,
  servirInterno,
  type ErroBanco,
} from '../_compartilhado/servidor.ts';

servirInterno(
  async (corpo) => ofertarProximo(pedidoIdDoCorpo(corpo)),
  (erro: ErroBanco) => (erro.code === 'P0002' ? PEDIDO_INDISPONIVEL : null),
);
