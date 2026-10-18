// POST /functions/v1/cotar-pedido  { pedido_id }
//
// Calcula o Preço fechado do Pedido do Cliente logado com @guinchei/preco (a mesma regra dos
// apps) e o grava no Pedido, que continua em `cotado` (RF05, ADR-0003, ADR-0009). O banco
// fornece a distância do Guincheiro elegível mais próximo até a origem (linha reta,
// provisório), o km rebocado do trajeto, a tabela vigente, os feriados e a hora do
// servidor; a gravação confere que o trajeto não mudou desde a leitura.
//
// Resposta: a cotação gravada (km, versão da tabela, frações dos adicionais e a
// decomposição em centavos). Erros: { erro, mensagem } (ver _compartilhado/servidor.ts).
import { calcularPrecoFechado, type TabelaPrecos } from '../../../packages/preco/src/index.ts';
import {
  ErroServidor,
  PEDIDO_INDISPONIVEL,
  pedidoIdDoCorpo,
  rpc,
  servir,
  type ErroBanco,
} from '../_compartilhado/servidor.ts';

/** Linha de `tabela_precos`, como `dados_da_cotacao` devolve. */
interface LinhaTabelaPrecos {
  versao: number;
  taxa_base: number;
  por_km_ate_veiculo: number;
  por_km_rebocado: number;
  adicional_noturno: number;
  noturno_das: number;
  noturno_ate: number;
  adicional_feriado: number;
  preco_minimo: number;
  comissao: number;
}

interface DadosDaCotacao {
  instante: string;
  km_ate_veiculo: number;
  km_rebocado: number;
  /** Assinatura do trajeto lido; a gravação confere que ele não mudou. */
  trajeto: string;
  tabela: LinhaTabelaPrecos;
  feriados: string[];
}

function tabelaDoBanco(linha: LinhaTabelaPrecos): TabelaPrecos {
  return {
    versao: linha.versao,
    taxaBase: linha.taxa_base,
    porKmAteVeiculo: linha.por_km_ate_veiculo,
    porKmRebocado: linha.por_km_rebocado,
    adicionalNoturno: Number(linha.adicional_noturno),
    noturnoDas: linha.noturno_das,
    noturnoAte: linha.noturno_ate,
    adicionalFeriado: Number(linha.adicional_feriado),
    precoMinimo: linha.preco_minimo,
    comissao: Number(linha.comissao),
  };
}

function traduzir(erro: ErroBanco): ErroServidor | null {
  switch (erro.code) {
    case 'P0002':
      return PEDIDO_INDISPONIVEL;
    case 'GCT01':
      return new ErroServidor(409, 'sem_guincheiro', 'Nenhum guincho disponível agora');
    case 'GCT02':
      return new ErroServidor(409, 'sem_trajeto', 'Marque origem e destino antes de ver o preço');
    case 'GCT03':
      return new ErroServidor(409, 'falha', 'O trajeto mudou durante a cotação. Tente de novo.');
    default:
      return null;
  }
}

/** Lê os dados, calcula e grava; devolve a cotação gravada. */
async function cotar(pedidoId: string, clienteId: string) {
  const dados = await rpc<DadosDaCotacao>('dados_da_cotacao', {
    pedido_id: pedidoId,
    cliente_id: clienteId,
  });
  const tabela = tabelaDoBanco(dados.tabela);
  const kmAteVeiculo = Number(dados.km_ate_veiculo);
  const kmRebocado = Number(dados.km_rebocado);
  const preco = calcularPrecoFechado(
    { kmAteVeiculo, kmRebocado, instante: dados.instante, feriados: dados.feriados },
    tabela,
  );

  await rpc('gravar_cotacao', {
    pedido_id: pedidoId,
    cliente_id: clienteId,
    trajeto: dados.trajeto,
    km_ate_veiculo: kmAteVeiculo,
    tabela_precos_versao: tabela.versao,
    preco_taxa_base: preco.taxaBase,
    preco_ate_veiculo: preco.deslocamento,
    preco_rebocado: preco.reboque,
    preco_adicional_noturno: preco.adicionalNoturno,
    preco_adicional_feriado: preco.adicionalFeriado,
    preco_ajuste_minimo: preco.ajustePiso,
    preco_total: preco.total,
  });

  return {
    kmAteVeiculo,
    kmRebocado,
    tabelaPrecosVersao: tabela.versao,
    adicionalNoturno: tabela.adicionalNoturno,
    adicionalFeriado: tabela.adicionalFeriado,
    preco,
  };
}

servir(async ({ clienteId, corpo }) => cotar(pedidoIdDoCorpo(corpo), clienteId), traduzir);
