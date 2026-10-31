// Um passo do Match (ADR-0002, ADR-0009): oferta o Pedido ao próximo Guincheiro ou encerra a
// rodada. Usado pela Edge Function `ofertar-proximo` (chamada pelo banco depois de recusa,
// expiração ou "tentar de novo") e pela `confirmar-pedido` (primeira oferta).
//
// A decisão é de @guinchei/match; o preço e o repasse de cada candidato, de
// @guinchei/preco, com a tabela, os feriados e o instante da cotação. O banco confere na
// gravação que nada mudou desde a leitura (GMT03); se mudou, relê e decide de novo. Assim
// execuções simultâneas para o mesmo Pedido não abrem duas ofertas.
//
// Candidato de outra Frota que a cotada (ADR-0013): o preço já é recalculado com a distância
// dele; `decidirRecotacao` diz se o Pedido passa a valer o novo preço (menor ou igual) ou se o
// Match pausa até o Cliente aprovar (maior). Nesse caso nenhuma oferta sai.
import {
  decidirProximo,
  decidirRecotacao,
  type Tentativa,
} from '../../../packages/match/src/index.ts';
import {
  avaliarOfertaAoGuincheiro,
  calcularPrecoFechado,
} from '../../../packages/preco/src/index.ts';
import { tabelaDoBanco, type LinhaTabelaPrecos } from './precos.ts';
import { ErroBanco, rpc } from './servidor.ts';

/** O que `dados_do_match` devolve; fora de `em_match`, só o estado. */
interface DadosDoMatch {
  estado: string;
  rodada: number;
  limite_tentativas: number;
  preco_total: number;
  km_rebocado: number;
  instante: string;
  /** Frota com quem o preço em vigor foi cotado; `null` em Pedido anterior ao ADR-0013. */
  frota_cotada_id: string | null;
  tabela: LinhaTabelaPrecos;
  feriados: string[];
  tentativas: { guincheiro_id: string; resultado: Tentativa['resultado'] }[];
  candidatos: { guincheiro_id: string; frota_id: string; km: number }[];
}

export type PassoDoMatch =
  | { tipo: 'ofertado'; tentativaId: number; guincheiroId: string }
  | { tipo: 'aguardando' }
  /** O candidato é de outra Frota por um preço maior: o Match pausa até o Cliente aprovar. */
  | { tipo: 'aguardando_aprovacao'; guincheiroId: string; precoAnterior: number; precoNovo: number }
  | { tipo: 'sem_guincheiro' }
  /** O Pedido não está em `em_match` (atribuído, estornado...): nada a fazer. */
  | { tipo: 'fora_do_match'; estado: string };

/** Releituras quando outra execução grava antes (GMT03). */
const MAXIMO_DE_RELEITURAS = 5;

async function passo(pedidoId: string): Promise<PassoDoMatch> {
  const dados = await rpc<DadosDoMatch>('dados_do_match', { pedido_id: pedidoId });
  if (dados.estado !== 'em_match') return { tipo: 'fora_do_match', estado: dados.estado };

  const tabela = tabelaDoBanco(dados.tabela);
  const kmRebocado = Number(dados.km_rebocado);
  const candidatos = dados.candidatos.map((c) => ({
    guincheiroId: c.guincheiro_id,
    frotaId: c.frota_id,
    km: Number(c.km),
  }));
  const tentativas: Tentativa[] = dados.tentativas.map((t) => ({
    guincheiroId: t.guincheiro_id,
    resultado: t.resultado,
  }));

  // O preço em vigor e a Frota cotada mudam quando uma recotação é aplicada nesta leitura.
  let precoEmVigor = dados.preco_total;
  let frotaCotadaId = dados.frota_cotada_id;

  // Cada candidato pulado pelo teto é gravado e a decisão segue com ele na lista.
  for (;;) {
    const decisao = decidirProximo({
      candidatos,
      tentativasDaRodada: tentativas,
      limiteTentativas: dados.limite_tentativas,
    });
    if (decisao.tipo === 'aguardar') return { tipo: 'aguardando' };
    if (decisao.tipo === 'esgotado') {
      await rpc('encerrar_rodada_sem_guincheiro', {
        pedido_id: pedidoId,
        rodada: dados.rodada,
        tentativas_lidas: tentativas.length,
      });
      return { tipo: 'sem_guincheiro' };
    }

    const { candidato } = decisao;
    const precoDoCandidato = calcularPrecoFechado(
      {
        kmAteVeiculo: candidato.km,
        kmRebocado,
        instante: dados.instante,
        feriados: dados.feriados,
      },
      tabela,
    );

    // Outra Frota que a cotada: o preço é refeito (ADR-0013), sem teto de absorção.
    const recotacao = decidirRecotacao({
      frotaCotadaId,
      frotaDoCandidatoId: candidato.frotaId,
      precoAtual: precoEmVigor,
      precoNovo: precoDoCandidato.total,
    });
    if (recotacao.tipo !== 'manter') {
      const exigeAprovacao = recotacao.tipo === 'pedir_aprovacao';
      await rpc('registrar_recotacao', {
        pedido_id: pedidoId,
        rodada: dados.rodada,
        tentativas_lidas: tentativas.length,
        guincheiro_id: candidato.guincheiroId,
        km_ate_veiculo: candidato.km,
        preco_taxa_base: precoDoCandidato.taxaBase,
        preco_ate_veiculo: precoDoCandidato.deslocamento,
        preco_rebocado: precoDoCandidato.reboque,
        preco_adicional_noturno: precoDoCandidato.adicionalNoturno,
        preco_adicional_feriado: precoDoCandidato.adicionalFeriado,
        preco_ajuste_minimo: precoDoCandidato.ajustePiso,
        preco_total: precoDoCandidato.total,
        exige_aprovacao: exigeAprovacao,
      });
      if (recotacao.tipo === 'pedir_aprovacao') {
        return {
          tipo: 'aguardando_aprovacao',
          guincheiroId: candidato.guincheiroId,
          precoAnterior: recotacao.precoAnterior,
          precoNovo: recotacao.precoNovo,
        };
      }
      precoEmVigor = recotacao.precoNovo;
      frotaCotadaId = candidato.frotaId;
    }

    const oferta = avaliarOfertaAoGuincheiro(precoEmVigor, precoDoCandidato.total, tabela);
    const resultado = oferta.oferecer ? 'oferecida' : 'pulada_teto';
    const tentativaId = await rpc<number>('registrar_tentativa', {
      pedido_id: pedidoId,
      rodada: dados.rodada,
      guincheiro_id: candidato.guincheiroId,
      ordem: tentativas.length + 1,
      resultado,
      km_ate_veiculo: candidato.km,
      preco_recalculado: precoDoCandidato.total,
      repasse_oferecido: oferta.repasse,
    });
    if (resultado === 'oferecida') {
      return { tipo: 'ofertado', tentativaId, guincheiroId: candidato.guincheiroId };
    }
    tentativas.push({ guincheiroId: candidato.guincheiroId, resultado });
  }
}

/** Avança o Match do Pedido um passo. Idempotente: chamar de novo não abre outra oferta. */
export async function ofertarProximo(pedidoId: string): Promise<PassoDoMatch> {
  for (let leitura = 1; ; leitura++) {
    try {
      return await passo(pedidoId);
    } catch (e) {
      if (!(e instanceof ErroBanco && e.code === 'GMT03') || leitura >= MAXIMO_DE_RELEITURAS) {
        throw e;
      }
    }
  }
}
