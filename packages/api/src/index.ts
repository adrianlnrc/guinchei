import {
  createClient,
  FunctionsHttpError,
  isAuthApiError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { Endereco } from '@guinchei/geo';
import type { MetodoPagamento } from '@guinchei/pagamento';
import type { PrecoFechado } from '@guinchei/preco';
import type { Database, Enums, Tables, TablesInsert } from '@guinchei/tipos';

// O pacote compila só com a lib ES2022 (sem DOM); `crypto` existe em todo navegador e no Node 22.
declare const crypto: { randomUUID(): string };

export interface ConfigApi {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export type ClienteSupabase = SupabaseClient<Database>;
export type Perfil = Tables<'perfis'>;

/** As três respostas do Pedido (RF03). */
export interface RespostasPedido {
  tipoVeiculo: Enums<'tipo_veiculo'>;
  situacao: Enums<'situacao_veiculo'>;
  rodasGiram: Enums<'rodas_giram'>;
}

/** Origem e destino escolhidos no mapa, com a distância da rota (RF04). */
export interface TrajetoPedido {
  origem: Endereco;
  destino: Endereco;
  /**
   * Distância da rota de carro entre origem e destino. Provisório: vem da rota calculada no
   * app e a cotação usa esse valor; recalcular no servidor depende do token de servidor do
   * Mapbox.
   */
  kmRebocado: number;
}

/** Cadastro urgente do Cliente (ADR-0010). O telefone vem do login. */
export interface CadastroUrgente {
  nome: string;
  /** 11 dígitos, sem máscara. */
  cpf: string;
  /** Versão dos termos de uso aceita. */
  termosVersao: string;
}

/** Dias que a apólice precisa valer, a contar do envio do cadastro (ADR-0007). */
export const DIAS_MINIMOS_VALIDADE_APOLICE = 30;
/** Tamanho máximo de um documento de prestador (o limite do bucket `documentos-prestadores`). */
export const TAMANHO_MAXIMO_DOCUMENTO_BYTES = 10_485_760;

/**
 * Dados do cadastro de Frota, todos opcionais enquanto é rascunho: o envio valida tudo no
 * servidor. CPF, CNPJ e CEP vão só com dígitos (o CNPJ alfanumérico, com letras maiúsculas).
 */
export interface DadosCadastroFrota {
  /** CPF ou CNPJ do MEI do autônomo. */
  documento?: string;
  nome?: string;
  representanteNome?: string;
  representanteCpf?: string;
  baseCep?: string;
  baseEndereco?: string;
  baseBairro?: string;
  chavePix?: string;
  /** Último dia de validade da apólice (AAAA-MM-DD). */
  apoliceValidade?: string;
  /** Versão dos termos para prestadores aceita. A hora do aceite é do servidor. */
  termosVersao?: string;
  /** Caminho do alvará no bucket, devolvido por `enviarDocumentoDaFrota`. */
  alvaraArquivo?: string;
  /** Caminho da apólice no bucket. */
  apoliceArquivo?: string;
}

/** Etapas do cadastro: 1 dados, 2 endereço, 3 documentos, 4 Pix, 5 termos. */
export type EtapaCadastroFrota = 1 | 2 | 3 | 4 | 5;

/** O cadastro em andamento, guardado no banco para retomar em qualquer aparelho. */
export interface RascunhoFrota {
  etapa: EtapaCadastroFrota;
  dados: DadosCadastroFrota;
}

/** A Frota de quem a cadastrou (representante), com o estado de cada item de homologação. */
/**
 * Uma coisa que falta para a Frota poder ser ativada (regra de homologação, issue #50): um
 * documento a aprovar, um veículo, um Guincheiro ou o vínculo entre os dois. É a lista do
 * "faltam N itens" do Painel.
 */
export interface PendenciaDeAtivacao {
  categoria: 'frota' | 'veiculo' | 'guincheiro' | 'vinculo';
  /** Em português, pronta para a tela: "Apólice de RC por avaria: vencido em 12/10/2026". */
  descricao: string;
  /** O tipo do documento, quando a pendência é de um documento. */
  tipo: Enums<'tipo_item_homologacao'> | null;
  /** O veículo ou o Guincheiro a que a pendência se refere, quando há. */
  alvoId: string | null;
}

interface LinhaDePendencia {
  categoria: string;
  descricao: string;
  tipo: Enums<'tipo_item_homologacao'> | null;
  alvo_id: string | null;
}

function pendenciaDeAtivacao(l: LinhaDePendencia): PendenciaDeAtivacao {
  return {
    categoria: l.categoria as PendenciaDeAtivacao['categoria'],
    descricao: l.descricao,
    tipo: l.tipo,
    alvoId: l.alvo_id,
  };
}

export interface MinhaFrota {
  id: string;
  tipo: Enums<'tipo_frota'>;
  documento: string;
  nome: string;
  /** `false` até a operação ativar, depois da homologação (veja `PendenciaDeAtivacao`). */
  ativa: boolean;
  baseCep: string | null;
  baseEndereco: string | null;
  baseBairro: string | null;
  chavePix: string | null;
  /** Último dia de validade da apólice (AAAA-MM-DD). */
  apoliceValidade: string | null;
  termosPrestadorVersao: string | null;
  itens: ItemHomologacao[];
  /**
   * O que falta para a operação poder ativar a Frota; vazio quando ela está ativa ou já cumpre a
   * regra e espera a operação.
   */
  pendenciasDeAtivacao: PendenciaDeAtivacao[];
}

/** Convite pendente da Frota do representante: o número convidado e até quando vale. */
export interface ConviteGuincheiro {
  id: string;
  /** Só dígitos, com o 55. */
  telefone: string;
  criadoEm: string;
  validoAte: string;
  /** Passou da validade: não vincula mais; convidar o número de novo o substitui. */
  vencido: boolean;
}

/** Guincheiro já vinculado à Frota (sem CPF: o perfil dele não é legível pela Frota). */
export interface GuincheiroDaFrota {
  id: string;
  nome: string;
  telefone: string;
  /** `false` até o Guincheiro ser homologado e ligar o plantão. */
  disponivel: boolean;
  criadoEm: string;
}

/** O convite que espera quem acabou de entrar sem perfil. */
export interface MeuConvite {
  frotaNome: string;
}

/** Primeiro acesso do convidado: o telefone vem do login, a Frota, do convite. */
export interface CadastroGuincheiroConvidado {
  nome: string;
  /** 11 dígitos, sem máscara. */
  cpf: string;
  /** Versão dos termos de uso aceita (ADR-0010). */
  termosVersao: string;
}

/** Dados da CNH, em colunas consultáveis (a regra CNH × PBT e o alerta de vencimento leem daqui). */
export interface DadosCnh {
  /** 11 dígitos. */
  numero: string;
  /** ACC, A, B, C, D, E, AB, AC, AD ou AE. */
  categoria: string;
  /** Último dia de validade (AAAA-MM-DD). */
  validade: string;
  /** Observação EAR (exerce atividade remunerada). */
  ear: boolean;
}

/** O que o Guincheiro envia na etapa da CNH. O arquivo é o caminho devolvido pelo envio. */
export interface EnvioDeCnh extends DadosCnh {
  arquivo: string;
}

/** O que o Guincheiro envia na etapa dos antecedentes. */
export interface EnvioDeAntecedentes {
  /** Dia da emissão da certidão (AAAA-MM-DD); vale 12 meses a partir dele. */
  emissao: string;
  arquivo: string;
}

/**
 * Os documentos do Guincheiro logado, um item de homologação por tipo (`null` = ainda não
 * enviado). Os dados da CNH e a emissão da certidão podem faltar em item criado fora do app.
 */
export interface MeusDocumentos {
  cnh: (ItemHomologacao & { dados: DadosCnh | null }) | null;
  antecedentes: (ItemHomologacao & { emissao: string | null }) | null;
  selfie: ItemHomologacao | null;
}

export type TipoVeiculoGuincho = Enums<'tipo_veiculo_guincho'>;

/** Quantas fotos o veículo leva (de 1 a este número), cada uma um item de homologação. */
export const LIMITE_FOTOS_VEICULO = 6;
/** PBT aceito, em kg (o mesmo `check` de `veiculos.pbt_kg`). */
export const PBT_MINIMO_KG = 500;
export const PBT_MAXIMO_KG = 60_000;

/**
 * Cadastro de um veículo de guincho. Placa e RENAVAM podem ir com máscara: o servidor
 * normaliza (RENAVAM de 9 ou 10 dígitos entra com zeros à esquerda). Os arquivos já estão no
 * bucket (`enviarArquivoDoVeiculo`).
 */
export interface DadosVeiculo {
  placa: string;
  renavam: string;
  tipo: TipoVeiculoGuincho;
  /** Peso bruto total em kg: a regra CNH × PBT depende deste número. */
  pbtKg: number;
  /** Caminho do CRLV no bucket. */
  crlvArquivo: string;
  /** Caminhos das fotos no bucket (de 1 a `LIMITE_FOTOS_VEICULO`). */
  fotosArquivos: string[];
}

/**
 * Estado do veículo na homologação, resumido dos itens: `recusado` se algum foi recusado,
 * senão `vencido` se algum venceu, senão `pendente` se algum aguarda a operação, senão
 * `aprovado` (todos os itens aprovados).
 */
export type EstadoDoVeiculo = EstadoHomologacao;

/** Veículo de guincho da Frota, com o estado da homologação de cada item. */
export interface VeiculoDaFrota {
  id: string;
  /** Sem hífen, em maiúsculas. */
  placa: string;
  renavam: string;
  tipo: TipoVeiculoGuincho;
  pbtKg: number;
  estado: EstadoDoVeiculo;
  /** CRLV e fotos, do mais antigo ao mais novo. */
  itens: ItemHomologacao[];
}

/** Resumo do estado de um veículo a partir dos seus itens de homologação. */
export function estadoDoVeiculo(
  itens: readonly Pick<ItemHomologacao, 'estado'>[],
): EstadoDoVeiculo {
  for (const estado of ['recusado', 'vencido', 'pendente'] as const) {
    if (itens.some((i) => i.estado === estado)) return estado;
  }
  return itens.length > 0 ? 'aprovado' : 'pendente';
}

/**
 * Situação do vínculo Guincheiro × veículo, calculada pelo banco: `ativo` (CNH aprovada que
 * cobre o PBT) ou `pendente` (CNH ainda não aprovada; revalidado na aprovação).
 */
export type SituacaoVinculo = Enums<'situacao_vinculo'>;

/** Vínculo Guincheiro × veículo da Frota do representante. */
export interface VinculoDaFrota {
  id: string;
  veiculoId: string;
  guincheiroId: string;
  situacao: SituacaoVinculo;
}

/**
 * O que o representante pode saber da CNH de um Guincheiro da Frota para avisar do vínculo:
 * a categoria enviada e o estado da homologação (`null` se ainda não enviou). Sem número nem foto.
 */
export interface CnhDoGuincheiro {
  guincheiroId: string;
  categoria: string | null;
  estado: EstadoHomologacao | null;
}

/** O veículo em que o Guincheiro logado está vinculado. */
export interface MeuVeiculo {
  vinculoId: string;
  situacao: SituacaoVinculo;
  veiculoId: string;
  placa: string;
  tipo: TipoVeiculoGuincho;
  pbtKg: number;
}

/** Vínculo que acabou: derrubado pela revalidação CNH × PBT ou desfeito pelo representante. */
export interface VinculoEncerrado {
  id: number;
  guincheiroId: string;
  veiculoId: string;
  placa: string;
  motivo: 'cnh_nao_cobre' | 'desfeito_pelo_representante';
  /** Em `cnh_nao_cobre`: o que a revalidação encontrou ("CNH B não cobre o PBT de 4200 kg"). */
  detalhe: string | null;
  /** ISO 8601, hora do servidor. */
  encerradoEm: string;
}

/** Preço fechado calculado e gravado pelo servidor (Edge Function `cotar-pedido`). */
export interface CotacaoPedido {
  /** Distância em linha reta do Guincheiro elegível mais próximo até a origem (provisório). */
  kmAteVeiculo: number;
  kmRebocado: number;
  tabelaPrecosVersao: number;
  /** Frações da tabela usada, para o rótulo dos adicionais (ex.: 0.15). */
  adicionalNoturno: number;
  adicionalFeriado: number;
  /** Decomposição em centavos, igual à gravada no Pedido. */
  preco: PrecoFechado;
}

/** Autorização do Preço fechado no pagamento (Edge Function `confirmar-pedido`). */
export interface PagamentoAutorizado {
  id: string;
  estado: 'autorizado';
  /** Centavos: o Preço fechado gravado. */
  valor: number;
}

/** Estorno da autorização do Pedido sem Guincheiro (Edge Function `estornar-pedido`). */
export interface PagamentoEstornado {
  estado: 'estornado';
  /** Centavos: o valor autorizado. */
  valor: number;
}

/** Oferta do Match aberta para o Guincheiro logado (ADR-0002, ADR-0009). */
export interface OfertaAberta {
  tentativaId: number;
  pedidoId: string;
  rodada: number;
  /** Distância deste Guincheiro até o veículo. */
  kmAteVeiculo: number;
  /** Centavos: Preço fechado recalculado com a distância dele. */
  precoRecalculado: number;
  /** Centavos: o que ele recebe se aceitar (o recalculado menos a Comissão). */
  repasse: number;
  /** Prazo para aceitar (ISO 8601, hora do servidor). */
  expiraEm: string;
  pedido: {
    origemEndereco: string | null;
    destinoEndereco: string | null;
    kmRebocado: number | null;
    tipoVeiculo: Enums<'tipo_veiculo'>;
    situacao: Enums<'situacao_veiculo'>;
    rodasGiram: Enums<'rodas_giram'>;
  };
}

/**
 * Em que ponto o Cliente está, do Pedido pago até a entrega. `em_match` cobre `confirmado`
 * (o Pedido pago entra no Match na mesma transação); `atribuido` vira o estado da Corrida.
 */
export type EtapaDoAcompanhamento =
  | 'cotado'
  | 'em_match'
  /** O Match pausou: outra Frota atenderia por um preço maior e o Cliente precisa aprovar (ADR-0013). */
  | 'aguardando_aprovacao_preco'
  | 'sem_guincheiro'
  | 'estornado'
  | Enums<'estado_corrida'>;

/** Decomposição de um Preço fechado, em centavos (ADR-0009). */
export interface DecomposicaoDoPreco {
  taxaBase: number;
  ateVeiculo: number;
  rebocado: number;
  adicionalNoturno: number;
  adicionalFeriado: number;
  ajusteMinimo: number;
}

/**
 * O preço refeito porque o Pedido foi redirecionado a outra Frota (ADR-0013). `pendente`: o
 * Cliente precisa aprovar ou desistir antes de `expiraEm`; `aplicada`: o preço novo é menor
 * (ou igual) e já vale, com a diferença estornada; `aprovada`: o Cliente aprovou o maior.
 */
export interface RecotacaoDoPedido {
  estado: 'pendente' | 'aplicada' | 'aprovada';
  /** Centavos. */
  precoAnterior: number;
  precoNovo: number;
  /** Do preço novo. */
  decomposicao: DecomposicaoDoPreco;
  /** ISO 8601; só na `pendente`. */
  expiraEm: string | null;
}

/** O que o Cliente vê do Guincheiro: só o nome e a Frota (sem CPF nem telefone). */
export interface GuincheiroDaCorrida {
  nome: string;
  frota: string | null;
}

/** O Pedido do Cliente e, depois do aceite, a Corrida, como o Cliente acompanha (RF09 enxuto). */
export interface Acompanhamento {
  pedidoId: string;
  etapa: EtapaDoAcompanhamento;
  /** Centavos: o Preço fechado, quando já cotado. */
  precoTotal: number | null;
  origemEndereco: string | null;
  destinoEndereco: string | null;
  /** A recotação mais recente que ainda vale (pendente, aplicada ou aprovada); `null` se nunca houve. */
  recotacao: RecotacaoDoPedido | null;
  /** `null` até um Guincheiro aceitar (e depois do estorno). */
  corrida: {
    id: string;
    estado: Enums<'estado_corrida'>;
    /** `null` se a contraparte não pôde ser lida. */
    guincheiro: GuincheiroDaCorrida | null;
  } | null;
}

/** Etapa das Fotos de estado: "antes" até o "Carreguei", "depois" de carregado em diante. */
export type EtapaFoto = Enums<'etapa_foto'>;

/** Itens por etapa e por autor (ADR-0011). O banco recusa o 7º. */
export const LIMITE_FOTOS_POR_ETAPA = 6;
/** Vídeo de até 30 s (ADR-0011); o app confere antes de enviar, o banco só limita o tamanho. */
export const DURACAO_MAXIMA_VIDEO_SEGUNDOS = 30;
/** Limite do bucket `fotos-estado` (50 MiB). */
export const TAMANHO_MAXIMO_MIDIA_BYTES = 52_428_800;
/** Quanto tempo vale a URL assinada de uma Foto de estado. */
export const VALIDADE_URL_FOTO_SEGUNDOS = 900;

/** Foto ou vídeo escolhido no aparelho (um `File` ou `Blob` do navegador serve). */
export interface ArquivoDeMidia {
  readonly type: string;
  readonly size: number;
}

export interface OpcoesFotoEstado {
  etapa: EtapaFoto;
  /** Coordenadas do navegador, opcionais e sempre em par. */
  latitude?: number;
  longitude?: number;
}

/** Uma Foto de estado (foto ou vídeo) de uma Corrida, como Cliente e Guincheiro a veem. */
export interface FotoEstado {
  id: string;
  corridaId: string;
  papelAutor: 'cliente' | 'guincheiro';
  tipo: Enums<'tipo_midia'>;
  etapa: EtapaFoto;
  /** ISO 8601, hora do servidor. */
  criadoEm: string;
  latitude: number | null;
  longitude: number | null;
  /** URL assinada de curta duração (`VALIDADE_URL_FOTO_SEGUNDOS`); `null` se não foi gerada. */
  url: string | null;
}

export type MotivoErroApi =
  | 'codigo_invalido'
  | 'cpf_ja_cadastrado'
  | 'sem_sessao'
  | 'fora_do_df'
  /** Nenhum Guincheiro elegível na hora da cotação. */
  | 'sem_guincheiro'
  /** O Pedido ainda não tem origem e destino. */
  | 'sem_trajeto'
  /** O Pedido não tem Preço fechado (ex.: o trajeto mudou depois de cotar). */
  | 'sem_cotacao'
  | 'pagamento_recusado'
  /** O prazo para aprovar o novo preço venceu; o Pedido será estornado. */
  | 'prazo_vencido'
  /** O Pedido não é do Cliente ou não está no estado que a ação pede. */
  | 'pedido_indisponivel'
  /** A oferta não é do Guincheiro, já foi respondida ou expirou. */
  | 'oferta_indisponivel'
  /** O Guincheiro está indisponível (plantão desligado ou outra Corrida). */
  | 'guincheiro_indisponivel'
  /** O Guincheiro tem Corrida em andamento e não pode ficar disponível (`GDP01`). */
  | 'em_corrida'
  /** A Corrida não é do Guincheiro logado. */
  | 'corrida_indisponivel'
  /**
   * A Corrida não pode ir do estado atual para o pedido (fora de ordem ou já entregue); o
   * item de homologação não está no estado que a decisão pede (ex.: vencido sem reenvio).
   */
  | 'transicao_invalida'
  /** Só a operação decide itens de homologação. */
  | 'sem_permissao'
  /** O item de homologação não existe (ou não é do usuário). */
  | 'item_indisponivel'
  /** Recusar um item exige o motivo. */
  | 'motivo_obrigatorio'
  /** A validade do documento já passou: aprovar exige um reenvio. */
  | 'documento_vencido'
  /** A Frota ainda não cumpre a regra de ativação (a mensagem diz quantos itens faltam). */
  | 'frota_incompleta'
  /** O arquivo não é uma imagem ou um vídeo dos formatos aceitos. */
  | 'arquivo_invalido'
  /** O arquivo passa do limite (50 MiB para foto e vídeo, 10 MiB para documento). */
  | 'arquivo_grande'
  /** Já são 6 itens do autor na etapa. */
  | 'limite_de_fotos'
  /** A Corrida mudou de etapa entre abrir a tela e registrar. */
  | 'etapa_mudou'
  /** Cadastro de Frota: não há rascunho para enviar. */
  | 'sem_cadastro_em_andamento'
  /** Cadastro de Frota: CPF ou CNPJ da Frota inválido. */
  | 'documento_invalido'
  /** Cadastro de Frota: CPF do representante inválido ou diferente do documento do autônomo. */
  | 'cpf_representante_invalido'
  /** Cadastro de Frota: falta algum dado obrigatório. */
  | 'dados_incompletos'
  /** Cadastro de Frota: apólice sem validade, vencida ou a vencer em menos de 30 dias. */
  | 'apolice_curta'
  /** Cadastro de Frota: os termos para prestadores não foram aceitos. */
  | 'termos_nao_aceitos'
  /** Cadastro de Frota: o documento (CNPJ do MEI) já está em outra Frota. */
  | 'documento_ja_cadastrado'
  /** Cadastro de Frota: o alvará ou a apólice não chegou ao bucket. */
  | 'documento_ausente'
  /** Cadastro de Frota: este número não pode cadastrar uma Frota (já é prestador ou Cliente). */
  | 'cadastro_indisponivel'
  /** Convite: o celular não tem 55 + DDD + número. */
  | 'telefone_invalido'
  /** Convite: a Frota já convidou este número e o convite está pendente. */
  | 'convite_repetido'
  /** Convite: o número já foi convidado por outra Frota. */
  | 'convidado_por_outra_frota'
  /** Convite: o número já tem conta (Guincheiro, Cliente, representante ou operação). */
  | 'numero_ja_tem_conta'
  /** Primeiro acesso: não há convite pendente para o número (nunca houve ou foi cancelado). */
  | 'sem_convite'
  /** Primeiro acesso: o convite venceu. */
  | 'convite_vencido'
  /** Cancelar: o convite não é da Frota ou já foi decidido. */
  | 'convite_indisponivel'
  /** Primeiro acesso: o CPF não passa no dígito verificador. */
  | 'cpf_invalido'
  /** Documentos do Guincheiro: número ou categoria da CNH inválidos. */
  | 'cnh_invalida'
  /** Documentos do Guincheiro: CNH sem validade ou vencida. */
  | 'cnh_vencida'
  /** Documentos do Guincheiro: a CNH não tem a observação EAR. */
  | 'cnh_sem_ear'
  /** Documentos do Guincheiro: esta CNH já está em outra conta. */
  | 'cnh_ja_cadastrada'
  /** Documentos do Guincheiro: o documento já foi enviado e está em análise ou aprovado. */
  | 'documento_ja_enviado'
  /** Documentos do Guincheiro: data de emissão da certidão ausente ou no futuro. */
  | 'emissao_invalida'
  /** Documentos do Guincheiro: certidão emitida há mais de 12 meses. */
  | 'antecedentes_vencidos'
  /** Só o representante de uma Frota autônoma vira Guincheiro da própria Frota. */
  | 'frota_nao_autonoma'
  /** Veículo: só o representante de uma Frota cadastra veículos. */
  | 'sem_frota'
  /** Veículo: placa fora dos padrões antigo e Mercosul. */
  | 'placa_invalida'
  /** Veículo: RENAVAM com dígito verificador errado. */
  | 'renavam_invalido'
  /** Veículo: tipo ou PBT fora do aceito. */
  | 'veiculo_dados_invalidos'
  /** Veículo: de 1 a 6 fotos. */
  | 'fotos_do_veiculo'
  /** Veículo: a placa ou o RENAVAM já estão cadastrados. */
  | 'veiculo_duplicado'
  /** Veículo: com item aprovado, placa, RENAVAM, tipo e PBT não mudam. */
  | 'veiculo_travado'
  /** Vínculo: a CNH aprovada do Guincheiro não cobre o PBT do veículo (CTB art. 143). */
  | 'vinculo_bloqueado'
  /** Vínculo: o Guincheiro e o veículo não são da mesma Frota. */
  | 'vinculo_outra_frota'
  /** Vínculo: o Guincheiro já está vinculado a outro veículo. */
  | 'guincheiro_ja_vinculado'
  /** Vínculo: não existe (ou já foi desfeito). */
  | 'vinculo_indisponivel'
  | 'falha';

export class ErroApi extends Error {
  constructor(
    readonly motivo: MotivoErroApi,
    mensagem: string,
    options?: { cause?: unknown },
  ) {
    super(mensagem, options);
    this.name = 'ErroApi';
  }
}

/** O que os apps usam do Supabase. Telefones em E.164 com "+" (ex.: +5561900000001). */
export interface ApiGuinchei {
  enviarCodigo(telefone: string): Promise<void>;
  confirmarCodigo(telefone: string, codigo: string): Promise<void>;
  temSessao(): Promise<boolean>;
  /** Perfil de quem está logado; `null` sem sessão ou antes do cadastro urgente. */
  buscarMeuPerfil(): Promise<Perfil | null>;
  criarPerfilUrgente(dados: CadastroUrgente): Promise<Perfil>;
  /** Abre o Pedido em `cotado` e devolve o id. */
  abrirPedido(respostas: RespostasPedido): Promise<string>;
  /** Troca as respostas do próprio Pedido enquanto está em `cotado` (não abre outro). */
  atualizarPedido(id: string, respostas: RespostasPedido): Promise<void>;
  /** Grava origem e destino do próprio Pedido em `cotado`; recusa ponto fora do DF. */
  definirTrajeto(id: string, trajeto: TrajetoPedido): Promise<void>;
  /** O servidor calcula o Preço fechado e o grava no Pedido, que continua em `cotado`. */
  cotarPedido(id: string): Promise<CotacaoPedido>;
  /**
   * Autoriza o Preço fechado gravado (mock) e leva o Pedido a `confirmado`; o Match começa
   * na hora (`em_match`).
   */
  confirmarPedido(id: string, metodo: MetodoPagamento): Promise<PagamentoAutorizado>;
  /** Cliente, em `sem_guincheiro`: nova rodada do Match com o mesmo preço e autorização. */
  tentarDeNovo(pedidoId: string): Promise<void>;
  /** Cliente, em `sem_guincheiro`: estorna o pagamento e encerra o Pedido (`estornado`). */
  estornarPedido(pedidoId: string): Promise<PagamentoEstornado>;
  /**
   * Cliente, em `aguardando_aprovacao_preco`: aprova o novo preço (autoriza a diferença) e o
   * Match continua com a outra Frota (ADR-0013). Depois do prazo, `prazo_vencido`.
   */
  aprovarNovoPreco(pedidoId: string): Promise<void>;
  /** Cliente, em `aguardando_aprovacao_preco`: desiste, com estorno integral e sem custo. */
  desistirDoNovoPreco(pedidoId: string): Promise<void>;
  /**
   * Cliente: o Pedido e a Corrida de hoje, com o nome do Guincheiro. `null` se o Pedido não
   * existe ou não é do Cliente (a RLS esconde o dos outros).
   */
  buscarAcompanhamento(pedidoId: string): Promise<Acompanhamento | null>;
  /**
   * Cliente: o Pedido mais recente que ainda não terminou (pago e sem estorno nem entrega),
   * para reabrir o acompanhamento depois de recarregar. `null` se não há nenhum.
   */
  buscarAcompanhamentoEmAndamento(): Promise<Acompanhamento | null>;
  /**
   * Cliente: chama `aoMudar` com o estado atual assim que a assinatura do Supabase Realtime
   * fica de pé (e a cada reconexão) e a cada mudança do Pedido ou da Corrida dele. Devolve a
   * função que cancela a assinatura.
   */
  acompanharPedido(pedidoId: string, aoMudar: (acompanhamento: Acompanhamento) => void): () => void;
  /**
   * Guincheiro: ofertas abertas para ele, a que vence primeiro antes. Uma oferta vencida
   * aparece até a varredura (a cada 5 s) marcá-la expirada; aceitar já é recusado.
   */
  buscarOfertasAbertas(): Promise<OfertaAberta[]>;
  /** Guincheiro: aceita a oferta e devolve o id da Corrida criada. */
  aceitarOferta(tentativaId: number): Promise<string>;
  /** Guincheiro: recusa a oferta; o Match passa ao próximo. */
  recusarOferta(tentativaId: number): Promise<void>;
  /**
   * Cliente ou Guincheiro da Corrida: envia a foto ou o vídeo ao bucket `fotos-estado`
   * (`<corrida_id>/<uuid>.<ext>`) e registra em `fotos_estado`. A hora é a do servidor e o
   * autor, a conta logada. Se o registro falha, apaga o arquivo enviado. Erros:
   * `arquivo_invalido`, `arquivo_grande`, `limite_de_fotos` e `etapa_mudou`.
   */
  registrarFotoEstado(
    corridaId: string,
    arquivo: ArquivoDeMidia,
    opcoes: OpcoesFotoEstado,
  ): Promise<FotoEstado>;
  /** As Fotos de estado da Corrida (dos dois lados), da mais antiga à mais nova, com URL assinada. */
  listarFotosEstado(corridaId: string): Promise<FotoEstado[]>;
}

/** Guincheiro logado, para o plantão. */
export interface MeuGuincheiro {
  nome: string;
  /** Nome da Frota a que pertence. */
  frota: string;
  disponivel: boolean;
}

/** Por que o plantão do Guincheiro está bloqueado (issue #50). */
export interface MotivoDeBloqueio {
  /**
   * `documento` (CNH, certidão ou selfie sem aprovação vigente), `sem_veiculo`,
   * `veiculo_pendente` (o veículo dele ainda não foi aprovado) ou `frota_inativa`.
   */
  codigo: 'documento' | 'sem_veiculo' | 'veiculo_pendente' | 'frota_inativa';
  /** Em português, pronta para a tela. */
  descricao: string;
}

/**
 * Se o Guincheiro logado pode receber chamados: `habilitado` quando não falta nada (então o
 * interruptor do plantão vale); senão, os motivos.
 */
export interface MinhaElegibilidade {
  habilitado: boolean;
  motivos: MotivoDeBloqueio[];
}

export type EstadoCorrida = Enums<'estado_corrida'>;

/** Corrida do Guincheiro logado, com o que ele precisa do Pedido. */
export interface CorridaDoGuincheiro {
  id: string;
  pedidoId: string;
  estado: EstadoCorrida;
  /** Centavos: o repasse gravado na Corrida (o oferecido a ele no Match). */
  repasse: number;
  /** Centavos: Preço fechado recalculado com a distância dele, da oferta aceita. */
  precoRecalculado: number | null;
  /** Distância dele até o veículo, da oferta aceita. */
  kmAteVeiculo: number | null;
  /** Última mudança (ISO 8601, hora do servidor); em `entregue`, a hora da entrega. */
  atualizadoEm: string;
  pedido: OfertaAberta['pedido'];
}

/**
 * O que o app do Guincheiro usa: a entrada por telefone e as ofertas do `ApiGuinchei`, mais
 * o plantão, a Corrida e as assinaturas do Realtime. As assinaturas devolvem a função que
 * cancela a assinatura.
 */
export interface ApiGuincheiro extends Pick<
  ApiGuinchei,
  | 'enviarCodigo'
  | 'confirmarCodigo'
  | 'temSessao'
  | 'buscarMeuPerfil'
  | 'buscarOfertasAbertas'
  | 'aceitarOferta'
  | 'recusarOferta'
  | 'registrarFotoEstado'
  | 'listarFotosEstado'
> {
  /** Encerra a sessão no aparelho. */
  sair(): Promise<void>;
  /** `null` sem sessão ou se o perfil logado não é de Guincheiro. */
  buscarMeuGuincheiro(): Promise<MeuGuincheiro | null>;
  /** Telefone do login (só dígitos, com o 55), para preencher o representante do cadastro. */
  telefoneDaSessao(): Promise<string | null>;
  /** Cadastro de Frota em andamento de quem está logado; `null` se não há. */
  buscarRascunhoFrota(): Promise<RascunhoFrota | null>;
  /**
   * Grava o rascunho do cadastro (cria ou atualiza o mesmo). Erro `cadastro_indisponivel` se
   * o número já é de Cliente, Guincheiro ou de quem já enviou a Frota.
   */
  salvarRascunhoFrota(rascunho: RascunhoFrota): Promise<void>;
  /**
   * Envia o alvará ou a apólice ao bucket `documentos-prestadores` (`<usuario>/<uuid>.<ext>`)
   * e devolve o caminho, para o rascunho. PDF ou imagem de até 10 MiB; erros
   * `arquivo_invalido` e `arquivo_grande`. Exige o rascunho aberto.
   */
  enviarDocumentoDaFrota(arquivo: ArquivoDeMidia): Promise<string>;
  /**
   * Envia o rascunho: o servidor valida tudo e cria o perfil de representante, a Frota
   * inativa e um item `pendente` por documento. Devolve o id da Frota. Erros: `sem_cadastro_em_andamento`,
   * `documento_invalido`, `cpf_representante_invalido`, `dados_incompletos`, `apolice_curta`,
   * `termos_nao_aceitos`, `cpf_ja_cadastrado`, `documento_ja_cadastrado`, `documento_ausente`.
   */
  enviarCadastroFrota(): Promise<string>;
  /** A Frota cadastrada por quem está logado; `null` se ainda não enviou o cadastro. */
  buscarMinhaFrota(): Promise<MinhaFrota | null>;
  /**
   * Representante: convida um Guincheiro pelo celular (E.164, com ou sem o "+") e devolve o id
   * do convite. Erros: `telefone_invalido`, `convite_repetido`, `convidado_por_outra_frota`,
   * `numero_ja_tem_conta`, `sem_permissao` (quem não representa uma Frota).
   */
  convidarGuincheiro(telefone: string): Promise<string>;
  /** Representante: os convites pendentes da própria Frota, do mais novo ao mais antigo. */
  listarConvites(): Promise<ConviteGuincheiro[]>;
  /** Representante: cancela um convite pendente da própria Frota (`convite_indisponivel`). */
  cancelarConvite(id: string): Promise<void>;
  /** Representante: os Guincheiros já vinculados à Frota. */
  listarGuincheirosDaFrota(): Promise<GuincheiroDaFrota[]>;
  /** O convite pendente e válido para o telefone do login, se a pessoa ainda não tem perfil. */
  buscarMeuConvite(): Promise<MeuConvite | null>;
  /**
   * Primeiro acesso do convidado: cria o perfil de Guincheiro e a linha em `guincheiros`
   * (indisponível), vinculada à Frota que convidou. Erros: `sem_convite`, `convite_vencido`,
   * `numero_ja_tem_conta`, `dados_incompletos`, `cpf_invalido`, `cpf_ja_cadastrado`.
   */
  aceitarConvite(dados: CadastroGuincheiroConvidado): Promise<void>;
  /**
   * O autônomo (representante de uma Frota autônoma) cria a própria linha de Guincheiro,
   * indisponível, ao começar a etapa de documentos. Pode repetir. Erros: `frota_nao_autonoma`.
   */
  criarMeuGuincheiro(): Promise<void>;
  /** Os documentos do Guincheiro logado e o estado de homologação de cada um. */
  buscarMeusDocumentos(): Promise<MeusDocumentos>;
  /**
   * Envia a foto da CNH, a certidão ou a selfie ao bucket `documentos-prestadores`
   * (`<usuario>/<uuid>.<ext>`) e devolve o caminho. PDF ou imagem de até 10 MiB; erros
   * `arquivo_invalido` e `arquivo_grande`.
   */
  enviarArquivoDoGuincheiro(arquivo: ArquivoDeMidia): Promise<string>;
  /**
   * Envia a CNH (ou reenvia, se recusada ou vencida): grava os dados e cria o item pendente.
   * Erros: `cnh_invalida`, `cnh_vencida`, `cnh_sem_ear`, `cnh_ja_cadastrada`,
   * `documento_ja_enviado`, `documento_ausente`, `sem_permissao`.
   */
  enviarCnh(envio: EnvioDeCnh): Promise<void>;
  /**
   * Envia a certidão de antecedentes (ou reenvia). Erros: `emissao_invalida`,
   * `antecedentes_vencidos`, `documento_ja_enviado`, `documento_ausente`, `sem_permissao`.
   */
  enviarAntecedentes(envio: EnvioDeAntecedentes): Promise<void>;
  /** Envia a selfie (ou reenvia). Erros: `documento_ja_enviado`, `documento_ausente`, `sem_permissao`. */
  enviarSelfie(arquivo: string): Promise<void>;
  /**
   * Envia o CRLV (PDF ou imagem) ou uma foto (só imagem) do veículo ao bucket
   * `documentos-prestadores` e devolve o caminho, para `cadastrarVeiculo` ou
   * `reenviarItemDeVeiculo`. Até 10 MiB; erros `arquivo_invalido` e `arquivo_grande`.
   */
  enviarArquivoDoVeiculo(arquivo: ArquivoDeMidia, finalidade: 'crlv' | 'foto'): Promise<string>;
  /**
   * Cadastra o veículo da própria Frota; o CRLV e as fotos viram itens `pendente` na fila do
   * Painel. Devolve o id. Erros: `sem_frota`, `placa_invalida`, `renavam_invalido`,
   * `veiculo_dados_invalidos`, `fotos_do_veiculo`, `veiculo_duplicado`, `documento_ausente`.
   */
  cadastrarVeiculo(dados: DadosVeiculo): Promise<string>;
  /** Os veículos da própria Frota, do mais antigo ao mais novo, com o estado de cada um. */
  listarMeusVeiculos(): Promise<VeiculoDaFrota[]>;
  /**
   * Reenvia o item recusado ou vencido de um veículo com o arquivo novo (já no bucket); volta
   * a `pendente`. Erros `item_indisponivel`, `transicao_invalida`, `documento_ausente`.
   */
  reenviarItemDeVeiculo(itemId: string, arquivo: string): Promise<void>;
  /** Representante: os vínculos Guincheiro × veículo da própria Frota. */
  listarVinculos(): Promise<VinculoDaFrota[]>;
  /**
   * Representante: a categoria e o estado da CNH de cada Guincheiro da Frota, para o aviso
   * CNH × PBT antes de confirmar o vínculo.
   */
  listarCnhDosGuincheiros(): Promise<CnhDoGuincheiro[]>;
  /**
   * Representante: vincula um Guincheiro a um veículo da Frota e devolve a situação (`ativo`, ou
   * `pendente` se a CNH ainda não foi aprovada). O banco é a barreira: CNH aprovada que não
   * cobre o PBT é `vinculo_bloqueado`. Outros erros: `sem_permissao`, `vinculo_outra_frota`,
   * `guincheiro_ja_vinculado`.
   */
  vincularGuincheiro(guincheiroId: string, veiculoId: string): Promise<SituacaoVinculo>;
  /** Representante: desfaz um vínculo da Frota (`vinculo_indisponivel` se já não existe). */
  desfazerVinculo(vinculoId: string): Promise<void>;
  /** Os vínculos que acabaram (os da Frota, para o representante; os próprios, para o Guincheiro), do mais novo ao mais antigo. */
  listarVinculosEncerrados(): Promise<VinculoEncerrado[]>;
  /** O veículo em que o Guincheiro logado está vinculado; `null` se não há. */
  buscarMeuVeiculo(): Promise<MeuVeiculo | null>;
  /**
   * Os documentos aprovados do próprio Guincheiro (ou, para o representante, da Frota) que
   * vencem em até `prazoDias` e os já vencidos, do mais urgente ao menos.
   */
  listarAvisosDeVencimento(): Promise<AlertaDeVencimento>;
  /**
   * Representante: reenvia o documento da Frota (apólice) vencido ou vencendo, com o arquivo
   * novo (já no bucket, veja `enviarDocumentoDaFrota`) e a nova validade. Volta a `pendente`.
   * Erros `documento_vencido`, `item_indisponivel`, `transicao_invalida`, `documento_ausente`.
   */
  reenviarItemDaFrota(itemId: string, arquivo: string, validade: string): Promise<void>;
  /**
   * Por que o Guincheiro logado não recebe chamados (documento sem aprovação, sem veículo,
   * veículo ainda não aprovado, Frota inativa); `habilitado` quando não falta nada. O banco
   * exclui do Match quem não está habilitado, mesmo com o plantão ligado.
   */
  buscarMinhaElegibilidade(): Promise<MinhaElegibilidade>;
  /** O interruptor do plantão: grava `guincheiros.disponivel`. */
  definirDisponibilidade(disponivel: boolean): Promise<void>;
  /** Hora do banco (ISO 8601), para contar o prazo da oferta. */
  horaDoServidor(): Promise<string>;
  /** A Corrida do Guincheiro ainda não entregue, se houver. */
  minhaCorridaAtual(): Promise<CorridaDoGuincheiro | null>;
  buscarCorrida(id: string): Promise<CorridaDoGuincheiro | null>;
  /** Leva a própria Corrida a `para` (a transição é conferida no banco); devolve o estado. */
  avancarCorrida(id: string, para: EstadoCorrida): Promise<EstadoCorrida>;
  /**
   * Avisa a cada mudança nas ofertas do Guincheiro logado (a RLS filtra no Realtime) e uma
   * vez quando a assinatura fica pronta, para o app reler sem perder o que mudou antes.
   */
  assinarOfertas(aoMudar: () => void): () => void;
  /** Avisa o novo estado a cada mudança da Corrida; `aoConectar` quando a assinatura fica pronta. */
  assinarCorrida(
    id: string,
    aoMudar: (estado: EstadoCorrida) => void,
    aoConectar?: () => void,
  ): () => void;
}

export function criarClienteApi({ supabaseUrl, supabaseAnonKey }: ConfigApi): ClienteSupabase {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('supabaseUrl e supabaseAnonKey são obrigatórios');
  }
  // A sessão fica no localStorage do navegador (padrão do supabase-js): o login persiste.
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

const CPF_UNICO = 'perfis_cpf_key';
/** Violação de check: o trigger de transição recusou o novo estado. */
const TRANSICAO_RECUSADA = '23514';
/** PostgREST: `.single()` sem nenhuma linha. */
const NENHUMA_LINHA = 'PGRST116';
/** Código do erro de `definir_trajeto_pedido` para ponto fora do DF. */
const FORA_DO_DF = 'GDF01';
/** Código do trigger que recusa `disponivel = true` com Corrida não terminal. */
const EM_CORRIDA = 'GDP01';

/** Erros de `aceitar_oferta` e `recusar_oferta` (migração do Match). */
function erroDaOferta(error: { code?: string }, mensagemDeFalha: string): ErroApi {
  switch (error.code) {
    case 'P0002':
    case 'GMT01':
      return new ErroApi('oferta_indisponivel', 'Esta oferta não está mais disponível', {
        cause: error,
      });
    case 'GMT02':
      return new ErroApi('guincheiro_indisponivel', 'Fique disponível para aceitar', {
        cause: error,
      });
    default:
      return new ErroApi('falha', mensagemDeFalha, { cause: error });
  }
}

const MOTIVOS_DAS_FUNCOES: readonly MotivoErroApi[] = [
  'sem_sessao',
  'sem_guincheiro',
  'sem_trajeto',
  'sem_cotacao',
  'pagamento_recusado',
  'pedido_indisponivel',
];

/** Chama uma Edge Function; o erro dela chega como `{ erro, mensagem }`. */
async function chamarFuncao<T>(
  supabase: ClienteSupabase,
  nome: string,
  corpo: Record<string, unknown>,
  mensagemDeFalha: string,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(nome, { body: corpo });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    // `context` é a Response da função.
    const contexto = error.context as { json(): Promise<unknown> };
    const resposta = (await contexto.json().catch(() => null)) as {
      erro?: string;
      mensagem?: string;
    } | null;
    const motivo = MOTIVOS_DAS_FUNCOES.find((m) => m === resposta?.erro);
    if (motivo && resposta?.mensagem) {
      throw new ErroApi(motivo, resposta.mensagem, { cause: error });
    }
  }
  throw new ErroApi('falha', mensagemDeFalha, { cause: error });
}

/** Estados do Pedido que contam como "em andamento" para o Cliente que reabre o app. */
const PEDIDO_EM_ANDAMENTO: Enums<'estado_pedido'>[] = [
  'confirmado',
  'em_match',
  'aguardando_aprovacao_preco',
  'sem_guincheiro',
  'atribuido',
];

function etapaDoPedido(
  estado: Enums<'estado_pedido'>,
  corrida: Enums<'estado_corrida'> | undefined,
): EtapaDoAcompanhamento {
  switch (estado) {
    case 'cotado':
    case 'sem_guincheiro':
    case 'estornado':
      return estado;
    case 'aguardando_aprovacao_preco':
      return estado;
    case 'confirmado':
    case 'em_match':
      return 'em_match';
    case 'atribuido':
      return corrida ?? 'aceita';
  }
}

const COLUNAS_DA_RECOTACAO =
  'resultado, preco_anterior, preco_novo, expira_em, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_adicional_noturno, preco_adicional_feriado, preco_ajuste_minimo';
type LinhaDaRecotacao = Pick<
  Tables<'recotacoes_pedido'>,
  | 'resultado'
  | 'preco_anterior'
  | 'preco_novo'
  | 'expira_em'
  | 'preco_taxa_base'
  | 'preco_ate_veiculo'
  | 'preco_rebocado'
  | 'preco_adicional_noturno'
  | 'preco_adicional_feriado'
  | 'preco_ajuste_minimo'
>;

function recotacaoDaLinha(linha: LinhaDaRecotacao): RecotacaoDoPedido {
  return {
    estado:
      linha.resultado === 'pendente' || linha.resultado === 'aprovada'
        ? linha.resultado
        : 'aplicada',
    precoAnterior: linha.preco_anterior,
    precoNovo: linha.preco_novo,
    decomposicao: {
      taxaBase: linha.preco_taxa_base,
      ateVeiculo: linha.preco_ate_veiculo,
      rebocado: linha.preco_rebocado,
      adicionalNoturno: linha.preco_adicional_noturno,
      adicionalFeriado: linha.preco_adicional_feriado,
      ajusteMinimo: linha.preco_ajuste_minimo,
    },
    expiraEm: linha.expira_em,
  };
}

const BUCKET_FOTOS = 'fotos-estado';
const COLUNAS_DA_FOTO =
  'id, corrida_id, papel_autor, tipo, caminho, etapa, criado_em, latitude, longitude';
type LinhaDaFoto = Pick<
  Tables<'fotos_estado'>,
  | 'id'
  | 'corrida_id'
  | 'papel_autor'
  | 'tipo'
  | 'caminho'
  | 'etapa'
  | 'criado_em'
  | 'latitude'
  | 'longitude'
>;

/** Tipos aceitos pelo bucket e a extensão de cada um no nome do objeto. */
const EXTENSAO_DA_MIDIA: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

function erroDoRegistroDaFoto(error: { code?: string }): ErroApi {
  switch (error.code) {
    case 'GFT01':
      return new ErroApi('etapa_mudou', 'A Corrida mudou de etapa. Registre de novo.', {
        cause: error,
      });
    case 'GFT02':
      return new ErroApi(
        'limite_de_fotos',
        `Limite de ${LIMITE_FOTOS_POR_ETAPA} itens por etapa atingido.`,
        { cause: error },
      );
    default:
      return new ErroApi('falha', 'Não foi possível registrar a foto', { cause: error });
  }
}

/** Erros de `aprovar_novo_preco` e `desistir_do_novo_preco` (migração `recotacao_do_preco`). */
function erroDaRespostaAoNovoPreco(error: { code?: string }, mensagemDeFalha: string): ErroApi {
  switch (error.code) {
    case 'GRC01':
      return new ErroApi(
        'prazo_vencido',
        'O prazo para aprovar o novo preço venceu. O pagamento será estornado.',
        { cause: error },
      );
    case 'P0002':
      return new ErroApi('pedido_indisponivel', 'O Pedido não está aguardando a sua aprovação', {
        cause: error,
      });
    default:
      return new ErroApi('falha', mensagemDeFalha, { cause: error });
  }
}

let assinaturas = 0;

export function criarApi(supabase: ClienteSupabase): ApiGuinchei {
  async function usuarioLogado() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  }

  async function comUrlsAssinadas(linhas: LinhaDaFoto[]): Promise<FotoEstado[]> {
    // Se não conseguir assinar, a foto aparece sem imagem em vez de derrubar a lista.
    const urls = new Map<string, string>();
    if (linhas.length > 0) {
      const { data } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(
        linhas.map((l) => l.caminho),
        VALIDADE_URL_FOTO_SEGUNDOS,
      );
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
      }
    }
    return linhas.map((l) => ({
      id: l.id,
      corridaId: l.corrida_id,
      papelAutor: l.papel_autor === 'guincheiro' ? 'guincheiro' : 'cliente',
      tipo: l.tipo,
      etapa: l.etapa,
      criadoEm: l.criado_em,
      latitude: l.latitude,
      longitude: l.longitude,
      url: urls.get(l.caminho) ?? null,
    }));
  }

  async function lerAcompanhamento(pedidoId: string): Promise<Acompanhamento | null> {
    const [pedido, corrida, recotacao] = await Promise.all([
      supabase
        .from('pedidos')
        .select('id, estado, preco_total, origem_endereco, destino_endereco')
        .eq('id', pedidoId)
        .maybeSingle(),
      supabase.from('corridas').select('id, estado').eq('pedido_id', pedidoId).maybeSingle(),
      supabase
        .from('recotacoes_pedido')
        .select(COLUNAS_DA_RECOTACAO)
        .eq('pedido_id', pedidoId)
        .in('resultado', ['pendente', 'aplicada', 'aprovada'])
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (pedido.error || corrida.error || recotacao.error) {
      throw new ErroApi('falha', 'Não foi possível ler o acompanhamento', {
        cause: pedido.error ?? corrida.error ?? recotacao.error,
      });
    }
    if (!pedido.data) return null;
    let guincheiro: GuincheiroDaCorrida | null = null;
    if (corrida.data) {
      // O perfil do Guincheiro não é legível (tem CPF e telefone): só nome e Frota, pela função.
      const contraparte = await supabase.rpc('contraparte_da_corrida', {
        corrida_id: corrida.data.id,
      });
      if (contraparte.error) {
        throw new ErroApi('falha', 'Não foi possível ler o Guincheiro', {
          cause: contraparte.error,
        });
      }
      const linha = contraparte.data[0];
      if (linha) guincheiro = { nome: linha.nome, frota: linha.frota ?? null };
    }
    return {
      pedidoId: pedido.data.id,
      etapa: etapaDoPedido(pedido.data.estado, corrida.data?.estado),
      precoTotal: pedido.data.preco_total,
      origemEndereco: pedido.data.origem_endereco,
      destinoEndereco: pedido.data.destino_endereco,
      recotacao: recotacao.data ? recotacaoDaLinha(recotacao.data) : null,
      corrida: corrida.data
        ? { id: corrida.data.id, estado: corrida.data.estado, guincheiro }
        : null,
    };
  }

  return {
    async enviarCodigo(telefone) {
      const { error } = await supabase.auth.signInWithOtp({ phone: telefone });
      if (error) throw new ErroApi('falha', 'Não foi possível enviar o código', { cause: error });
    },

    async confirmarCodigo(telefone, codigo) {
      const { error } = await supabase.auth.verifyOtp({
        phone: telefone,
        token: codigo,
        type: 'sms',
      });
      if (!error) return;
      if (isAuthApiError(error) && error.status < 500) {
        throw new ErroApi('codigo_invalido', 'Código incorreto ou expirado', { cause: error });
      }
      throw new ErroApi('falha', 'Não foi possível confirmar o código', { cause: error });
    },

    async temSessao() {
      return (await usuarioLogado()) !== null;
    },

    async buscarMeuPerfil() {
      const usuario = await usuarioLogado();
      if (!usuario) return null;
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', usuario.id)
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler o perfil', { cause: error });
      return data;
    },

    async criarPerfilUrgente({ nome, cpf, termosVersao }) {
      const usuario = await usuarioLogado();
      if (!usuario?.phone) throw new ErroApi('sem_sessao', 'Entre com o celular antes');
      const { data, error } = await supabase
        .from('perfis')
        .insert({
          id: usuario.id,
          papel: 'cliente',
          nome: nome.trim(),
          // O banco só aceita o telefone verificado no login (o do JWT).
          telefone: usuario.phone,
          cpf,
          // A hora do aceite é a do servidor (o banco grava; o app não pode mandar).
          aceite_termos_versao: termosVersao,
        })
        .select()
        .single();
      if (error?.code === '23505' && error.message.includes(CPF_UNICO)) {
        throw new ErroApi('cpf_ja_cadastrado', 'CPF já cadastrado em outra conta', {
          cause: error,
        });
      }
      if (error) throw new ErroApi('falha', 'Não foi possível salvar o cadastro', { cause: error });
      return data;
    },

    async abrirPedido({ tipoVeiculo, situacao, rodasGiram }) {
      const { data, error } = await supabase.rpc('abrir_pedido', {
        tipo_veiculo: tipoVeiculo,
        situacao,
        rodas_giram: rodasGiram,
      });
      if (error) throw new ErroApi('falha', 'Não foi possível abrir o Pedido', { cause: error });
      return data;
    },

    async atualizarPedido(id, { tipoVeiculo, situacao, rodasGiram }) {
      const { error } = await supabase.rpc('atualizar_pedido_cotado', {
        pedido_id: id,
        tipo_veiculo: tipoVeiculo,
        situacao,
        rodas_giram: rodasGiram,
      });
      if (error) {
        throw new ErroApi('falha', 'Não foi possível atualizar o Pedido', { cause: error });
      }
    },

    async definirTrajeto(id, { origem, destino, kmRebocado }) {
      const { error } = await supabase.rpc('definir_trajeto_pedido', {
        pedido_id: id,
        origem_lat: origem.ponto.lat,
        origem_lng: origem.ponto.lng,
        origem_endereco: origem.rotulo,
        destino_lat: destino.ponto.lat,
        destino_lng: destino.ponto.lng,
        destino_endereco: destino.rotulo,
        km_rebocado: kmRebocado,
      });
      if (error?.code === FORA_DO_DF) {
        throw new ErroApi('fora_do_df', 'Origem ou destino fora do DF', { cause: error });
      }
      if (error) throw new ErroApi('falha', 'Não foi possível gravar o trajeto', { cause: error });
    },

    async cotarPedido(id) {
      return chamarFuncao<CotacaoPedido>(
        supabase,
        'cotar-pedido',
        { pedido_id: id },
        'Não foi possível calcular o preço',
      );
    },

    async confirmarPedido(id, metodo) {
      return chamarFuncao<PagamentoAutorizado>(
        supabase,
        'confirmar-pedido',
        { pedido_id: id, metodo },
        'Não foi possível confirmar o pagamento',
      );
    },

    async tentarDeNovo(pedidoId) {
      const { error } = await supabase.rpc('tentar_de_novo', { pedido_id: pedidoId });
      if (error?.code === 'P0002') {
        throw new ErroApi('pedido_indisponivel', 'O Pedido não está aguardando um Guincheiro', {
          cause: error,
        });
      }
      if (error) throw new ErroApi('falha', 'Não foi possível tentar de novo', { cause: error });
    },

    async estornarPedido(pedidoId) {
      return chamarFuncao<PagamentoEstornado>(
        supabase,
        'estornar-pedido',
        { pedido_id: pedidoId },
        'Não foi possível estornar o pagamento',
      );
    },

    async aprovarNovoPreco(pedidoId) {
      const { error } = await supabase.rpc('aprovar_novo_preco', { pedido_id: pedidoId });
      if (error) throw erroDaRespostaAoNovoPreco(error, 'Não foi possível aprovar o novo preço');
    },

    async desistirDoNovoPreco(pedidoId) {
      const { error } = await supabase.rpc('desistir_do_novo_preco', { pedido_id: pedidoId });
      if (error) throw erroDaRespostaAoNovoPreco(error, 'Não foi possível desistir do Pedido');
    },

    buscarAcompanhamento: lerAcompanhamento,

    async buscarAcompanhamentoEmAndamento() {
      const usuario = await usuarioLogado();
      if (!usuario) return null;
      const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('id, estado')
        .eq('cliente_id', usuario.id)
        .in('estado', PEDIDO_EM_ANDAMENTO)
        .order('criado_em', { ascending: false })
        .limit(20);
      if (error) throw new ErroApi('falha', 'Não foi possível ler o Pedido', { cause: error });
      // `atribuido` é terminal para o Pedido, mas a Corrida pode já ter sido entregue.
      const { data: corridas, error: erroCorridas } = await supabase
        .from('corridas')
        .select('pedido_id')
        .in(
          'pedido_id',
          pedidos.map((p) => p.id),
        )
        .eq('estado', 'entregue');
      if (erroCorridas) {
        throw new ErroApi('falha', 'Não foi possível ler a Corrida', { cause: erroCorridas });
      }
      const entregues = new Set(corridas.map((c) => c.pedido_id));
      const atual = pedidos.find((p) => !entregues.has(p.id));
      return atual ? lerAcompanhamento(atual.id) : null;
    },

    acompanharPedido(pedidoId, aoMudar) {
      let ativo = true;
      let leitura = 0;
      // Qualquer evento relê o estado inteiro: a Corrida e o nome do Guincheiro chegam juntos,
      // e uma leitura atrasada nunca sobrepõe uma mais nova.
      async function atualizar() {
        const minha = ++leitura;
        try {
          const atual = await lerAcompanhamento(pedidoId);
          if (ativo && minha === leitura && atual) aoMudar(atual);
        } catch {
          // Falha de rede: o próximo evento ou a reconexão relê.
        }
      }
      const filtroPedido = { event: '*', schema: 'public', table: 'pedidos' } as const;
      const filtroCorrida = { event: '*', schema: 'public', table: 'corridas' } as const;
      const canal = supabase
        .channel(`acompanhamento-${pedidoId}-${++assinaturas}`)
        .on('postgres_changes', { ...filtroPedido, filter: `id=eq.${pedidoId}` }, atualizar)
        .on('postgres_changes', { ...filtroCorrida, filter: `pedido_id=eq.${pedidoId}` }, atualizar)
        .subscribe((status) => {
          // Cobre o que mudou entre a leitura inicial e a assinatura, e as reconexões.
          if (status === 'SUBSCRIBED') void atualizar();
        });
      return () => {
        ativo = false;
        void supabase.removeChannel(canal);
      };
    },

    async buscarOfertasAbertas() {
      // A RLS só mostra as ofertas feitas ao Guincheiro logado (e as do Pedido dele).
      const { data, error } = await supabase
        .from('tentativas_match')
        .select(
          'id, pedido_id, rodada, km_ate_veiculo, preco_recalculado, repasse_oferecido, expira_em, pedidos (origem_endereco, destino_endereco, km_rebocado, tipo_veiculo, situacao, rodas_giram)',
        )
        .eq('resultado', 'oferecida')
        .order('expira_em');
      if (error) throw new ErroApi('falha', 'Não foi possível ler as ofertas', { cause: error });
      return data.map((t) => ({
        tentativaId: t.id,
        pedidoId: t.pedido_id,
        rodada: t.rodada,
        kmAteVeiculo: t.km_ate_veiculo,
        precoRecalculado: t.preco_recalculado,
        repasse: t.repasse_oferecido,
        expiraEm: t.expira_em!,
        pedido: {
          origemEndereco: t.pedidos.origem_endereco,
          destinoEndereco: t.pedidos.destino_endereco,
          kmRebocado: t.pedidos.km_rebocado,
          tipoVeiculo: t.pedidos.tipo_veiculo,
          situacao: t.pedidos.situacao,
          rodasGiram: t.pedidos.rodas_giram,
        },
      }));
    },

    async aceitarOferta(tentativaId) {
      const { data, error } = await supabase.rpc('aceitar_oferta', { tentativa_id: tentativaId });
      if (error) throw erroDaOferta(error, 'Não foi possível aceitar a oferta');
      return data;
    },

    async recusarOferta(tentativaId) {
      const { error } = await supabase.rpc('recusar_oferta', { tentativa_id: tentativaId });
      if (error) throw erroDaOferta(error, 'Não foi possível recusar a oferta');
    },

    async registrarFotoEstado(corridaId, arquivo, { etapa, latitude, longitude }) {
      const usuario = await usuarioLogado();
      if (!usuario) throw new ErroApi('sem_sessao', 'Entre com o celular antes');
      const extensao = EXTENSAO_DA_MIDIA[arquivo.type];
      if (!extensao) {
        throw new ErroApi('arquivo_invalido', 'Formato não aceito. Use uma foto ou um vídeo.');
      }
      if (arquivo.size > TAMANHO_MAXIMO_MIDIA_BYTES) {
        throw new ErroApi('arquivo_grande', 'O arquivo passa de 50 MB.');
      }
      const caminho = `${corridaId}/${crypto.randomUUID()}.${extensao}`;
      const envio = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
      if (envio.error) {
        throw new ErroApi('falha', 'Não foi possível enviar o arquivo', { cause: envio.error });
      }
      // O app não pode mandar `papel_autor` nem `criado_em` (sem GRANT): o servidor deriva o
      // papel da Corrida e grava a hora. O tipo gerado só exige o campo, daí o `as`.
      const linha = {
        corrida_id: corridaId,
        autor_id: usuario.id,
        tipo: arquivo.type.startsWith('video/') ? 'video' : 'foto',
        caminho,
        etapa,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      } as TablesInsert<'fotos_estado'>;
      const { data, error } = await supabase
        .from('fotos_estado')
        .insert(linha)
        .select(COLUNAS_DA_FOTO)
        .single();
      if (error) {
        // Arquivo sem registro não é prova de nada: a política de limpeza deixa o autor
        // apagar. Se a limpeza falhar, o arquivo fica órfão no bucket (inofensivo).
        await supabase.storage.from(BUCKET_FOTOS).remove([caminho]);
        throw erroDoRegistroDaFoto(error);
      }
      const [foto] = await comUrlsAssinadas([data]);
      return foto!;
    },

    async listarFotosEstado(corridaId) {
      const { data, error } = await supabase
        .from('fotos_estado')
        .select(COLUNAS_DA_FOTO)
        .eq('corrida_id', corridaId)
        .order('criado_em', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw new ErroApi('falha', 'Não foi possível ler as fotos', { cause: error });
      return comUrlsAssinadas(data);
    },
  };
}

const COLUNAS_DA_CORRIDA =
  'id, pedido_id, estado, repasse, atualizado_em, pedidos (origem_endereco, destino_endereco, km_rebocado, tipo_veiculo, situacao, rodas_giram)';

/** Canal do Realtime com nome único (o mesmo cliente pode assinar mais de uma vez). */
let canais = 0;
const nomeDoCanal = (prefixo: string) => `${prefixo}-${++canais}-${Date.now()}`;

const BUCKET_DOCUMENTOS = 'documentos-prestadores';
const FROTA_DOCUMENTO_UNICO = 'frotas_documento_key';
const CNH_UNICA = 'documentos_guincheiro_cnh_numero_key';

/** Tipos aceitos no bucket de documentos e a extensão de cada um no nome do objeto. */
const EXTENSAO_DO_DOCUMENTO: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** O rascunho no banco guarda os campos em snake_case, como o `enviar_cadastro_frota` os lê. */
const CAMPOS_DO_RASCUNHO = {
  documento: 'documento',
  nome: 'nome',
  representanteNome: 'representante_nome',
  representanteCpf: 'representante_cpf',
  baseCep: 'base_cep',
  baseEndereco: 'base_endereco',
  baseBairro: 'base_bairro',
  chavePix: 'chave_pix',
  apoliceValidade: 'apolice_validade',
  termosVersao: 'termos_versao',
  alvaraArquivo: 'alvara_arquivo',
  apoliceArquivo: 'apolice_arquivo',
} as const satisfies Record<keyof DadosCadastroFrota, string>;

function dadosParaJson(dados: DadosCadastroFrota): Record<string, string> {
  const json: Record<string, string> = {};
  for (const [campo, coluna] of Object.entries(CAMPOS_DO_RASCUNHO)) {
    const valor = dados[campo as keyof DadosCadastroFrota];
    if (valor !== undefined) json[coluna] = valor;
  }
  return json;
}

function dadosDoJson(json: unknown): DadosCadastroFrota {
  const guardado = (json ?? {}) as Record<string, unknown>;
  const dados: DadosCadastroFrota = {};
  for (const [campo, coluna] of Object.entries(CAMPOS_DO_RASCUNHO)) {
    const valor = guardado[coluna];
    if (typeof valor === 'string') dados[campo as keyof DadosCadastroFrota] = valor;
  }
  return dados;
}

/** Erros de `cadastrar_veiculo` e do reenvio de itens (migrações `veiculos` e `homologacao`). */
function erroDoVeiculo(
  error: { code?: string; message?: string },
  mensagemDeFalha: string,
): ErroApi {
  const causa = { cause: error };
  switch (error.code) {
    case 'GVE01':
    case '42501':
      return new ErroApi('sem_frota', 'Só o representante de uma Frota cadastra veículos', causa);
    case 'GVE02':
      return new ErroApi(
        'placa_invalida',
        'Placa inválida. Confira as letras e os números.',
        causa,
      );
    case 'GVE03':
      return new ErroApi('renavam_invalido', 'RENAVAM inválido. Confira os números.', causa);
    case 'GVE04':
      return new ErroApi(
        'veiculo_dados_invalidos',
        `Informe o tipo e o PBT em kg (de ${PBT_MINIMO_KG} a ${PBT_MAXIMO_KG}).`,
        causa,
      );
    case 'GVE05':
      return new ErroApi(
        'fotos_do_veiculo',
        `Envie de 1 a ${LIMITE_FOTOS_VEICULO} fotos do veículo.`,
        causa,
      );
    case 'GVE06':
    case '23505':
      return new ErroApi(
        'veiculo_duplicado',
        'Já existe um veículo cadastrado com esta placa ou este RENAVAM.',
        causa,
      );
    case 'GVE07':
      return new ErroApi(
        'veiculo_travado',
        'Veículo com documento aprovado não muda placa, RENAVAM, tipo nem PBT.',
        causa,
      );
    case 'GHM06':
      return new ErroApi(
        'documento_ausente',
        'Um arquivo não chegou ao servidor. Envie de novo.',
        causa,
      );
    case 'P0002':
      return new ErroApi('item_indisponivel', 'Este item não existe mais', causa);
    case 'GHM03':
      return new ErroApi('transicao_invalida', 'Só se reenvia item recusado ou vencido', causa);
    case 'GHM05':
      return new ErroApi(
        'documento_vencido',
        'A validade informada já passou. Confira a data do documento novo.',
        causa,
      );
    default:
      return new ErroApi('falha', mensagemDeFalha, causa);
  }
}

/** Erros de `enviar_cadastro_frota` e do rascunho (migração `cadastro_de_frota`). */
function erroDoCadastroDeFrota(
  error: { code?: string; message?: string },
  mensagemDeFalha: string,
): ErroApi {
  const causa = { cause: error };
  switch (error.code) {
    case 'GCF01':
      return new ErroApi('sem_cadastro_em_andamento', 'Não há cadastro em andamento', causa);
    case 'GCF02':
      return new ErroApi('documento_invalido', 'CPF ou CNPJ inválido. Confira os números.', causa);
    case 'GCF03':
      return new ErroApi(
        'cpf_representante_invalido',
        'CPF do representante inválido. Confira os números.',
        causa,
      );
    case 'GCF04':
      return new ErroApi('dados_incompletos', 'Falta algum dado do cadastro', causa);
    case 'GCF05':
      return new ErroApi(
        'apolice_curta',
        `A apólice precisa valer por pelo menos ${DIAS_MINIMOS_VALIDADE_APOLICE} dias. Envie uma apólice com validade mais longa.`,
        causa,
      );
    case 'GCF06':
    case '42501':
      return new ErroApi(
        'cadastro_indisponivel',
        'Este número não pode cadastrar uma Frota',
        causa,
      );
    case 'GCF07':
      return new ErroApi('termos_nao_aceitos', 'Aceite os termos para prestadores', causa);
    case 'GHM06':
      return new ErroApi(
        'documento_ausente',
        'Um documento não chegou ao servidor. Envie de novo.',
        causa,
      );
    case '23505':
      if (error.message?.includes(CPF_UNICO)) {
        return new ErroApi('cpf_ja_cadastrado', 'CPF já cadastrado em outra conta', causa);
      }
      if (error.message?.includes(FROTA_DOCUMENTO_UNICO)) {
        return new ErroApi('documento_ja_cadastrado', 'Este documento já tem uma Frota', causa);
      }
      return new ErroApi('falha', mensagemDeFalha, causa);
    default:
      return new ErroApi('falha', mensagemDeFalha, causa);
  }
}

/** Erros das funções de convite (migração `convites_de_guincheiro`). */
function erroDoConvite(
  error: { code?: string; message?: string },
  mensagemDeFalha: string,
): ErroApi {
  const causa = { cause: error };
  switch (error.code) {
    case 'GCV01':
      return new ErroApi('telefone_invalido', 'Informe o celular com DDD', causa);
    case 'GCV03':
      return new ErroApi('convite_repetido', 'Este número já tem um convite pendente', causa);
    case 'GCV04':
      return new ErroApi(
        'convidado_por_outra_frota',
        'Este número já foi convidado por outra Frota',
        causa,
      );
    case 'GCV05':
    case 'GCV08':
      return new ErroApi('numero_ja_tem_conta', 'Este número já tem conta no Guinchei', causa);
    case 'GCV06':
      return new ErroApi(
        'sem_convite',
        'Não há convite para este número. Peça à sua Frota que o convide de novo.',
        causa,
      );
    case 'GCV07':
      return new ErroApi(
        'convite_vencido',
        'O convite venceu. Peça à sua Frota que o convide de novo.',
        causa,
      );
    case 'GCV09':
      return new ErroApi('dados_incompletos', 'Informe o nome e aceite os termos de uso', causa);
    case 'GCV10':
      return new ErroApi('cpf_invalido', 'CPF inválido. Confira os números.', causa);
    case 'GCV11':
      return new ErroApi('convite_indisponivel', 'O convite não está mais pendente', causa);
    case '42501':
      return new ErroApi(
        'sem_permissao',
        'Só o representante de uma Frota gerencia convites',
        causa,
      );
    case '23505':
      if (error.message?.includes(CPF_UNICO)) {
        return new ErroApi('cpf_ja_cadastrado', 'CPF já cadastrado em outra conta', causa);
      }
      return new ErroApi('falha', mensagemDeFalha, causa);
    default:
      return new ErroApi('falha', mensagemDeFalha, causa);
  }
}

/** Erros das funções de vínculo Guincheiro × veículo (migração `vinculo_guincheiro_veiculo`). */
function erroDoVinculo(error: { code?: string }, mensagemDeFalha: string): ErroApi {
  const causa = { cause: error };
  switch (error.code) {
    case 'GVL01':
    case '42501':
      return new ErroApi(
        'sem_permissao',
        'Só o representante da Frota vincula Guincheiros a veículos',
        causa,
      );
    case 'GVL02':
      return new ErroApi(
        'vinculo_outra_frota',
        'O Guincheiro e o veículo precisam ser da mesma Frota',
        causa,
      );
    case 'GVL03':
      return new ErroApi(
        'vinculo_bloqueado',
        'A categoria da CNH do Guincheiro não cobre o PBT deste veículo',
        causa,
      );
    case 'GVL04':
    case '23505':
      return new ErroApi(
        'guincheiro_ja_vinculado',
        'Este Guincheiro já está vinculado a um veículo. Desfaça o vínculo antes.',
        causa,
      );
    case 'GVL05':
      return new ErroApi('vinculo_indisponivel', 'Este vínculo não existe mais', causa);
    default:
      return new ErroApi('falha', mensagemDeFalha, causa);
  }
}

/** Erros das funções de documentos do Guincheiro (migração `documentos_do_guincheiro`). */
function erroDosDocumentos(
  error: { code?: string; message?: string },
  mensagemDeFalha: string,
): ErroApi {
  const causa = { cause: error };
  switch (error.code) {
    case '42501':
    case 'GDG01':
      return new ErroApi('sem_permissao', 'Só o Guincheiro envia os próprios documentos', causa);
    case 'GDG02':
    case 'GDG03':
      return new ErroApi('cnh_invalida', 'Confira o número e a categoria da CNH', causa);
    case 'GDG04':
      return new ErroApi('cnh_vencida', 'A CNH está vencida. Renove a CNH antes de enviar.', causa);
    case 'GDG05':
      return new ErroApi('cnh_sem_ear', 'A CNH precisa da observação EAR', causa);
    case 'GDG06':
      return new ErroApi(
        'documento_ja_enviado',
        'Este documento já foi enviado e está em análise ou aprovado',
        causa,
      );
    case 'GDG07':
      return new ErroApi('emissao_invalida', 'Informe a data de emissão da certidão', causa);
    case 'GDG08':
      return new ErroApi(
        'antecedentes_vencidos',
        'A certidão foi emitida há mais de 12 meses. Emita uma nova.',
        causa,
      );
    case 'GDG09':
      return new ErroApi(
        'frota_nao_autonoma',
        'Só o autônomo é Guincheiro da própria Frota. Convide os Guincheiros da empresa.',
        causa,
      );
    case 'GHM06':
      return new ErroApi(
        'documento_ausente',
        'O arquivo não chegou ao servidor. Envie de novo.',
        causa,
      );
    case '23505':
      if (error.message?.includes(CNH_UNICA)) {
        return new ErroApi(
          'cnh_ja_cadastrada',
          'Esta CNH já está cadastrada em outra conta',
          causa,
        );
      }
      return new ErroApi('falha', mensagemDeFalha, causa);
    default:
      return new ErroApi('falha', mensagemDeFalha, causa);
  }
}

export function criarApiGuincheiro(supabase: ClienteSupabase): ApiGuincheiro {
  const base = criarApi(supabase);

  async function meuId() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }

  /** Envia ao bucket de documentos, na pasta de quem está logado. Só o CRLV aceita PDF. */
  async function enviarAoBucketDeDocumentos(arquivo: ArquivoDeMidia, aceitaPdf: boolean) {
    const id = await meuId();
    if (!id) throw new ErroApi('sem_sessao', 'Entre com o celular antes');
    const extensao = EXTENSAO_DO_DOCUMENTO[arquivo.type];
    if (!extensao || (!aceitaPdf && arquivo.type === 'application/pdf')) {
      throw new ErroApi(
        'arquivo_invalido',
        aceitaPdf
          ? 'Formato não aceito. Envie um PDF ou uma foto.'
          : 'Formato não aceito. Envie uma foto.',
      );
    }
    if (arquivo.size > TAMANHO_MAXIMO_DOCUMENTO_BYTES) {
      throw new ErroApi('arquivo_grande', 'O arquivo passa de 10 MB.');
    }
    const caminho = `${id}/${crypto.randomUUID()}.${extensao}`;
    const envio = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
    if (envio.error) {
      throw new ErroApi('falha', 'Não foi possível enviar o documento', { cause: envio.error });
    }
    return caminho;
  }

  async function completarCorrida(
    linha: {
      id: string;
      pedido_id: string;
      estado: EstadoCorrida;
      repasse: number;
      atualizado_em: string;
      pedidos: {
        origem_endereco: string | null;
        destino_endereco: string | null;
        km_rebocado: number | null;
        tipo_veiculo: Enums<'tipo_veiculo'>;
        situacao: Enums<'situacao_veiculo'>;
        rodas_giram: Enums<'rodas_giram'>;
      };
    } | null,
  ): Promise<CorridaDoGuincheiro | null> {
    if (!linha) return null;
    // A oferta aceita (a RLS só mostra as feitas a ele) traz o preço pela distância dele.
    const { data: oferta, error } = await supabase
      .from('tentativas_match')
      .select('preco_recalculado, km_ate_veiculo')
      .eq('pedido_id', linha.pedido_id)
      .eq('resultado', 'aceita')
      .maybeSingle();
    if (error) throw new ErroApi('falha', 'Não foi possível ler a Corrida', { cause: error });
    return {
      id: linha.id,
      pedidoId: linha.pedido_id,
      estado: linha.estado,
      repasse: linha.repasse,
      precoRecalculado: oferta?.preco_recalculado ?? null,
      kmAteVeiculo: oferta?.km_ate_veiculo ?? null,
      atualizadoEm: linha.atualizado_em,
      pedido: {
        origemEndereco: linha.pedidos.origem_endereco,
        destinoEndereco: linha.pedidos.destino_endereco,
        kmRebocado: linha.pedidos.km_rebocado,
        tipoVeiculo: linha.pedidos.tipo_veiculo,
        situacao: linha.pedidos.situacao,
        rodasGiram: linha.pedidos.rodas_giram,
      },
    };
  }

  return {
    enviarCodigo: base.enviarCodigo,
    confirmarCodigo: base.confirmarCodigo,
    temSessao: base.temSessao,
    buscarMeuPerfil: base.buscarMeuPerfil,
    buscarOfertasAbertas: base.buscarOfertasAbertas,
    aceitarOferta: base.aceitarOferta,
    recusarOferta: base.recusarOferta,
    registrarFotoEstado: base.registrarFotoEstado,
    listarFotosEstado: base.listarFotosEstado,

    async sair() {
      const { error } = await supabase.auth.signOut();
      if (error) throw new ErroApi('falha', 'Não foi possível sair', { cause: error });
    },

    async buscarMeuGuincheiro() {
      const id = await meuId();
      if (!id) return null;
      const { data, error } = await supabase
        .from('guincheiros')
        .select('disponivel, frotas (nome), perfis (nome)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler o plantão', { cause: error });
      if (!data) return null;
      return { nome: data.perfis.nome, frota: data.frotas.nome, disponivel: data.disponivel };
    },

    async telefoneDaSessao() {
      const { data } = await supabase.auth.getSession();
      return data.session?.user.phone ?? null;
    },

    async buscarRascunhoFrota() {
      const { data, error } = await supabase
        .from('rascunhos_frota')
        .select('etapa, dados')
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler o cadastro', { cause: error });
      if (!data) return null;
      return { etapa: data.etapa as EtapaCadastroFrota, dados: dadosDoJson(data.dados) };
    },

    async salvarRascunhoFrota({ etapa, dados }) {
      const { error } = await supabase
        .from('rascunhos_frota')
        .upsert({ etapa, dados: dadosParaJson(dados) }, { onConflict: 'usuario_id' });
      if (error) throw erroDoCadastroDeFrota(error, 'Não foi possível salvar o cadastro');
    },

    async enviarDocumentoDaFrota(arquivo) {
      return enviarAoBucketDeDocumentos(arquivo, true);
    },

    async enviarArquivoDoGuincheiro(arquivo) {
      return enviarAoBucketDeDocumentos(arquivo, true);
    },
    async enviarArquivoDoVeiculo(arquivo, finalidade) {
      return enviarAoBucketDeDocumentos(arquivo, finalidade === 'crlv');
    },

    async cadastrarVeiculo(dados) {
      const { data, error } = await supabase.rpc('cadastrar_veiculo', {
        placa: dados.placa,
        renavam: dados.renavam,
        tipo: dados.tipo,
        pbt_kg: dados.pbtKg,
        crlv_arquivo: dados.crlvArquivo,
        fotos: dados.fotosArquivos,
      });
      if (error) throw erroDoVeiculo(error, 'Não foi possível cadastrar o veículo');
      return data;
    },

    async listarMeusVeiculos() {
      const { data: veiculos, error } = await supabase
        .from('veiculos')
        .select('id, placa, renavam, tipo, pbt_kg')
        .order('criado_em', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw new ErroApi('falha', 'Não foi possível ler os veículos', { cause: error });
      if (veiculos.length === 0) return [];
      const { data: itens, error: erroItens } = await supabase
        .from('itens_homologacao')
        .select('id, alvo, alvo_id, tipo, estado, motivo, validade, enviado_em')
        .eq('alvo', 'veiculo')
        .in(
          'alvo_id',
          veiculos.map((v) => v.id),
        );
      if (erroItens) {
        throw new ErroApi('falha', 'Não foi possível ler os veículos', { cause: erroItens });
      }
      return veiculos.map((v) => {
        const doVeiculo = itens
          .filter((i) => i.alvo_id === v.id)
          .map(itemDeHomologacao)
          .sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm) || a.id.localeCompare(b.id));
        return {
          id: v.id,
          placa: v.placa,
          renavam: v.renavam,
          tipo: v.tipo,
          pbtKg: v.pbt_kg,
          estado: estadoDoVeiculo(doVeiculo),
          itens: doVeiculo,
        };
      });
    },

    async reenviarItemDeVeiculo(itemId, arquivo) {
      const { error } = await supabase.rpc('reenviar_item_homologacao', {
        item_id: itemId,
        arquivo,
      });
      if (error) throw erroDoVeiculo(error, 'Não foi possível reenviar o item');
    },

    async listarVinculos() {
      const { data, error } = await supabase
        .from('vinculos_veiculo')
        .select('id, veiculo_id, guincheiro_id, situacao')
        .order('criado_em', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw new ErroApi('falha', 'Não foi possível ler os vínculos', { cause: error });
      return data.map((v) => ({
        id: v.id,
        veiculoId: v.veiculo_id,
        guincheiroId: v.guincheiro_id,
        situacao: v.situacao,
      }));
    },

    async listarCnhDosGuincheiros() {
      const { data, error } = await supabase.rpc('cnh_dos_meus_guincheiros');
      if (error) throw new ErroApi('falha', 'Não foi possível ler as CNHs', { cause: error });
      return data.map((c) => ({
        guincheiroId: c.guincheiro_id,
        categoria: c.categoria,
        estado: c.estado,
      }));
    },

    async vincularGuincheiro(guincheiroId, veiculoId) {
      const { data, error } = await supabase.rpc('vincular_guincheiro_veiculo', {
        guincheiro_id: guincheiroId,
        veiculo_id: veiculoId,
      });
      if (error) throw erroDoVinculo(error, 'Não foi possível vincular o Guincheiro');
      return data;
    },

    async desfazerVinculo(vinculoId) {
      const { error } = await supabase.rpc('desfazer_vinculo', { vinculo_id: vinculoId });
      if (error) throw erroDoVinculo(error, 'Não foi possível desfazer o vínculo');
    },

    async listarVinculosEncerrados() {
      const { data, error } = await supabase
        .from('vinculos_encerrados')
        .select('id, guincheiro_id, veiculo_id, placa, motivo, detalhe, encerrado_em')
        .order('encerrado_em', { ascending: false })
        .order('id', { ascending: false })
        .limit(20);
      if (error) throw new ErroApi('falha', 'Não foi possível ler o histórico', { cause: error });
      return data.map((v) => ({
        id: v.id,
        guincheiroId: v.guincheiro_id,
        veiculoId: v.veiculo_id,
        placa: v.placa,
        motivo: v.motivo === 'cnh_nao_cobre' ? 'cnh_nao_cobre' : 'desfeito_pelo_representante',
        detalhe: v.detalhe,
        encerradoEm: v.encerrado_em,
      }));
    },

    async buscarMeuVeiculo() {
      const { data, error } = await supabase.rpc('meu_veiculo');
      if (error) throw new ErroApi('falha', 'Não foi possível ler o seu veículo', { cause: error });
      const v = data[0];
      if (!v) return null;
      return {
        vinculoId: v.vinculo_id,
        situacao: v.situacao,
        veiculoId: v.veiculo_id,
        placa: v.placa,
        tipo: v.tipo,
        pbtKg: v.pbt_kg,
      };
    },

    listarAvisosDeVencimento() {
      return lerAlertaDeVencimento(supabase);
    },

    async reenviarItemDaFrota(itemId, arquivo, validade) {
      const { error } = await supabase.rpc('reenviar_item_homologacao', {
        item_id: itemId,
        arquivo,
        validade,
      });
      if (error) throw erroDoVeiculo(error, 'Não foi possível reenviar o documento');
    },

    async enviarCadastroFrota() {
      const { data, error } = await supabase.rpc('enviar_cadastro_frota');
      if (error) throw erroDoCadastroDeFrota(error, 'Não foi possível enviar o cadastro');
      return data;
    },

    async buscarMinhaFrota() {
      const id = await meuId();
      if (!id) return null;
      const { data, error } = await supabase
        .from('frotas')
        .select(
          'id, tipo, documento, nome, ativa, base_cep, base_endereco, base_bairro, chave_pix, apolice_validade, termos_prestador_versao, itens_homologacao (id, alvo, alvo_id, tipo, estado, motivo, validade, enviado_em)',
        )
        .eq('representante_id', id)
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler a Frota', { cause: error });
      if (!data) return null;
      let pendencias: PendenciaDeAtivacao[] = [];
      if (!data.ativa) {
        const lidas = await supabase.rpc('pendencias_de_ativacao', { frota_id: data.id });
        if (lidas.error) {
          throw new ErroApi('falha', 'Não foi possível ler o que falta para a Frota', {
            cause: lidas.error,
          });
        }
        pendencias = lidas.data.map(pendenciaDeAtivacao);
      }
      return {
        id: data.id,
        tipo: data.tipo,
        documento: data.documento,
        nome: data.nome,
        ativa: data.ativa,
        pendenciasDeAtivacao: pendencias,
        baseCep: data.base_cep,
        baseEndereco: data.base_endereco,
        baseBairro: data.base_bairro,
        chavePix: data.chave_pix,
        apoliceValidade: data.apolice_validade,
        termosPrestadorVersao: data.termos_prestador_versao,
        itens: data.itens_homologacao
          .map(itemDeHomologacao)
          .sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm) || a.tipo.localeCompare(b.tipo)),
      };
    },

    async convidarGuincheiro(telefone) {
      const { data, error } = await supabase.rpc('convidar_guincheiro', { telefone });
      if (error) throw erroDoConvite(error, 'Não foi possível enviar o convite');
      return data;
    },

    async listarConvites() {
      const { data, error } = await supabase
        .from('convites_guincheiro')
        .select('id, telefone, criado_em, valido_ate')
        .eq('estado', 'pendente')
        .order('criado_em', { ascending: false });
      if (error) throw new ErroApi('falha', 'Não foi possível ler os convites', { cause: error });
      const agora = Date.now();
      return data.map((c) => ({
        id: c.id,
        telefone: c.telefone,
        criadoEm: c.criado_em,
        validoAte: c.valido_ate,
        vencido: Date.parse(c.valido_ate) <= agora,
      }));
    },

    async cancelarConvite(id) {
      const { error } = await supabase.rpc('cancelar_convite_guincheiro', { convite_id: id });
      if (error) throw erroDoConvite(error, 'Não foi possível cancelar o convite');
    },

    async listarGuincheirosDaFrota() {
      const { data, error } = await supabase.rpc('guincheiros_da_minha_frota');
      if (error)
        throw new ErroApi('falha', 'Não foi possível ler os Guincheiros', { cause: error });
      return data.map((g) => ({
        id: g.id,
        nome: g.nome,
        telefone: g.telefone,
        disponivel: g.disponivel,
        criadoEm: g.criado_em,
      }));
    },

    async buscarMeuConvite() {
      const { data, error } = await supabase.rpc('meu_convite_guincheiro');
      if (error) throw new ErroApi('falha', 'Não foi possível ler o convite', { cause: error });
      const convite = data[0];
      return convite ? { frotaNome: convite.frota_nome } : null;
    },

    async aceitarConvite({ nome, cpf, termosVersao }) {
      const { error } = await supabase.rpc('aceitar_convite_guincheiro', {
        nome,
        cpf,
        termos_versao: termosVersao,
      });
      if (error) throw erroDoConvite(error, 'Não foi possível concluir o primeiro acesso');
    },

    async criarMeuGuincheiro() {
      const { error } = await supabase.rpc('criar_meu_guincheiro');
      if (error) throw erroDosDocumentos(error, 'Não foi possível abrir a etapa de documentos');
    },

    async buscarMeusDocumentos() {
      const id = await meuId();
      if (!id) return { cnh: null, antecedentes: null, selfie: null };
      const [itens, dados] = await Promise.all([
        supabase
          .from('itens_homologacao')
          .select('id, alvo, alvo_id, tipo, estado, motivo, validade, enviado_em')
          .eq('alvo', 'guincheiro')
          .eq('alvo_id', id),
        supabase
          .from('documentos_guincheiro')
          .select('cnh_numero, cnh_categoria, cnh_validade, cnh_ear, antecedentes_emissao')
          .eq('guincheiro_id', id)
          .maybeSingle(),
      ]);
      if (itens.error || dados.error) {
        throw new ErroApi('falha', 'Não foi possível ler os documentos', {
          cause: itens.error ?? dados.error,
        });
      }
      const doTipo = (tipo: Enums<'tipo_item_homologacao'>) => {
        const i = itens.data.find((linha) => linha.tipo === tipo);
        return i ? itemDeHomologacao(i) : null;
      };
      const d = dados.data;
      const cnh = doTipo('cnh');
      const antecedentes = doTipo('antecedentes');
      return {
        cnh: cnh && {
          ...cnh,
          dados:
            d?.cnh_numero && d.cnh_categoria && d.cnh_validade && d.cnh_ear !== null
              ? {
                  numero: d.cnh_numero,
                  categoria: d.cnh_categoria,
                  validade: d.cnh_validade,
                  ear: d.cnh_ear,
                }
              : null,
        },
        antecedentes: antecedentes && { ...antecedentes, emissao: d?.antecedentes_emissao ?? null },
        selfie: doTipo('selfie'),
      };
    },

    async enviarCnh({ numero, categoria, validade, ear, arquivo }) {
      const { error } = await supabase.rpc('enviar_cnh', {
        numero,
        categoria,
        validade,
        ear,
        arquivo,
      });
      if (error) throw erroDosDocumentos(error, 'Não foi possível enviar a CNH');
    },

    async enviarAntecedentes({ emissao, arquivo }) {
      const { error } = await supabase.rpc('enviar_antecedentes', { emissao, arquivo });
      if (error) throw erroDosDocumentos(error, 'Não foi possível enviar a certidão');
    },

    async enviarSelfie(arquivo) {
      const { error } = await supabase.rpc('enviar_selfie', { arquivo });
      if (error) throw erroDosDocumentos(error, 'Não foi possível enviar a selfie');
    },

    async buscarMinhaElegibilidade() {
      const { data, error } = await supabase.rpc('minha_elegibilidade');
      if (error) {
        throw new ErroApi('falha', 'Não foi possível conferir a sua homologação', { cause: error });
      }
      const motivos = data.map((m) => ({
        codigo: m.codigo as MotivoDeBloqueio['codigo'],
        descricao: m.descricao,
      }));
      return { habilitado: motivos.length === 0, motivos };
    },

    async definirDisponibilidade(disponivel) {
      const id = await meuId();
      if (!id) throw new ErroApi('sem_sessao', 'Entre com o celular antes');
      const { error } = await supabase
        .from('guincheiros')
        .update({ disponivel })
        .eq('id', id)
        .select('id')
        .single();
      if (error?.code === EM_CORRIDA) {
        throw new ErroApi(
          'em_corrida',
          'Termine a Corrida em andamento antes de ficar disponível',
          {
            cause: error,
          },
        );
      }
      if (error) {
        throw new ErroApi('falha', 'Não foi possível mudar a disponibilidade', { cause: error });
      }
    },

    async horaDoServidor() {
      const { data, error } = await supabase.rpc('hora_do_servidor');
      if (error) throw new ErroApi('falha', 'Não foi possível ler a hora', { cause: error });
      return data;
    },

    async minhaCorridaAtual() {
      const id = await meuId();
      if (!id) return null;
      const { data, error } = await supabase
        .from('corridas')
        .select(COLUNAS_DA_CORRIDA)
        .eq('guincheiro_id', id)
        .neq('estado', 'entregue')
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler a Corrida', { cause: error });
      return completarCorrida(data);
    },

    async buscarCorrida(corridaId) {
      const { data, error } = await supabase
        .from('corridas')
        .select(COLUNAS_DA_CORRIDA)
        .eq('id', corridaId)
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler a Corrida', { cause: error });
      return completarCorrida(data);
    },

    async avancarCorrida(corridaId, para) {
      // A RLS só deixa o Guincheiro da Corrida mudar o estado; o trigger confere a transição.
      const { data, error } = await supabase
        .from('corridas')
        .update({ estado: para })
        .eq('id', corridaId)
        .select('estado')
        .single();
      if (error?.code === TRANSICAO_RECUSADA) {
        throw new ErroApi('transicao_invalida', 'A Corrida está em outra etapa', {
          cause: error,
        });
      }
      if (error?.code === NENHUMA_LINHA) {
        throw new ErroApi('corrida_indisponivel', 'Corrida não encontrada', { cause: error });
      }
      if (error) throw new ErroApi('falha', 'Não foi possível avançar a Corrida', { cause: error });
      return data.estado;
    },

    assinarOfertas(aoMudar) {
      // Sem filtro: a RLS de `tentativas_match` já entrega só as ofertas feitas a ele.
      const canal = supabase
        .channel(nomeDoCanal('ofertas'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tentativas_match' }, () =>
          aoMudar(),
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') aoMudar();
        });
      return () => void supabase.removeChannel(canal);
    },

    assinarCorrida(corridaId, aoMudar, aoConectar) {
      const canal = supabase
        .channel(nomeDoCanal('corrida'))
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'corridas', filter: `id=eq.${corridaId}` },
          (mudanca) => aoMudar((mudanca.new as { estado: EstadoCorrida }).estado),
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') aoConectar?.();
        });
      return () => void supabase.removeChannel(canal);
    },
  };
}

/** Operador logado no Painel. */
export interface MeuOperador {
  nome: string;
}

/** Quanto tempo vale a URL assinada de um documento de prestador. */
export const VALIDADE_URL_DOCUMENTO_SEGUNDOS = 300;
export type EstadoHomologacao = Enums<'estado_homologacao'>;
export type TipoItemHomologacao = Enums<'tipo_item_homologacao'>;
export type AlvoHomologacao = Enums<'alvo_homologacao'>;

/** Documento ou dado de uma Frota, de um Guincheiro ou de um veículo a homologar. */
export interface ItemHomologacao {
  id: string;
  alvo: AlvoHomologacao;
  /** A Frota, o Guincheiro ou o veículo a que o item se refere. */
  alvoId: string;
  tipo: TipoItemHomologacao;
  estado: EstadoHomologacao;
  /** Motivo da recusa vigente; `null` fora de `recusado`. */
  motivo: string | null;
  /** Último dia de validade (AAAA-MM-DD), quando o documento tem. */
  validade: string | null;
  /** ISO 8601: quando entrou (ou voltou) para a fila. */
  enviadoEm: string;
  /** Só no Painel, nos itens de Guincheiro: de quem é o documento. */
  guincheiro?: string | null;
  /** Só no Painel, na CNH: os dados enviados. `null` se o item veio de fora do app. */
  cnh?: DadosCnh | null;
  /** Só no Painel, nos antecedentes: o dia da emissão (a validade de 12 meses é `validade`). */
  antecedentesEmissao?: string | null;
}

interface LinhaDoItem {
  id: string;
  alvo: AlvoHomologacao;
  alvo_id: string;
  tipo: TipoItemHomologacao;
  estado: EstadoHomologacao;
  motivo: string | null;
  validade: string | null;
  enviado_em: string;
}

function itemDeHomologacao(i: LinhaDoItem): ItemHomologacao {
  return {
    id: i.id,
    alvo: i.alvo,
    alvoId: i.alvo_id,
    tipo: i.tipo,
    estado: i.estado,
    motivo: i.motivo,
    validade: i.validade,
    enviadoEm: i.enviado_em,
  };
}

/** Uma Frota com item `pendente`, na ordem de envio. */
export interface FrotaNaFila {
  id: string;
  nome: string;
  tipo: Enums<'tipo_frota'>;
  documento: string;
  pendentes: number;
  /**
   * A Frota, ainda inativa, já cumpre a regra de ativação: só falta a operação ativar. Pode ter
   * itens pendentes que a regra não exige (de um segundo veículo, por exemplo). Sem itens
   * pendentes, `enviadoEm` é a última decisão da operação.
   */
  pronta: boolean;
  /** ISO 8601: o envio do item pendente mais antigo. */
  enviadoEm: string;
}

export interface FrotaEmHomologacao {
  id: string;
  nome: string;
  tipo: Enums<'tipo_frota'>;
  documento: string;
  /** A Frota está ativa (no Match, se tiver Guincheiro habilitado e disponível). */
  ativa: boolean;
  /** O que falta para ativar a Frota: o "faltam N itens" do Painel. Vazio = pode ativar. */
  pendenciasDeAtivacao: PendenciaDeAtivacao[];
  /** Todos os itens, em qualquer estado, do mais antigo ao mais novo. */
  itens: ItemHomologacao[];
  /** Os veículos cadastrados, para dar nome (placa) aos itens de veículo. */
  veiculos: { id: string; placa: string; tipo: TipoVeiculoGuincho; pbtKg: number }[];
  /** Os vínculos Guincheiro × veículo da Frota, para o aviso CNH × PBT ao aprovar uma CNH. */
  vinculos: VinculoDaFrota[];
}

/**
 * Item de homologação aprovado que vence em breve, ou já vencido (apólice, certidão, CNH). O
 * `estado` é `aprovado` (a vencer) ou `vencido`.
 */
export interface ItemEmAlerta {
  itemId: string;
  frotaId: string;
  frotaNome: string;
  alvo: AlvoHomologacao;
  alvoId: string;
  tipo: TipoItemHomologacao;
  estado: EstadoHomologacao;
  /** Último dia de validade (AAAA-MM-DD). */
  validade: string;
  /** Dias até o fim da validade: 0 no último dia, negativo nos vencidos. */
  diasRestantes: number;
  /** Nos itens de Guincheiro, de quem é o documento. */
  guincheiro: string | null;
  /** Quem lê pode reenviar o documento (o dono, ou o representante nos itens da Frota). */
  podeReenviar: boolean;
}

/** Os itens em alerta, do mais urgente, e o prazo configurado (dias antes do vencimento). */
export interface AlertaDeVencimento {
  prazoDias: number;
  itens: ItemEmAlerta[];
}

/** Uma Frota com itens em alerta; `itens` do mais urgente ao menos. */
export interface FrotaComVencimentos {
  id: string;
  nome: string;
  itens: ItemEmAlerta[];
}

/**
 * Agrupa por Frota. As Frotas saem pela urgência do item mais urgente de cada uma, e os itens
 * de cada Frota também (menos dias restantes primeiro: vencidos antes dos a vencer).
 */
export function agruparVencimentosPorFrota(itens: readonly ItemEmAlerta[]): FrotaComVencimentos[] {
  const porUrgencia = [...itens].sort(
    (a, b) =>
      a.diasRestantes - b.diasRestantes ||
      a.frotaNome.localeCompare(b.frotaNome, 'pt-BR') ||
      a.itemId.localeCompare(b.itemId),
  );
  const frotas = new Map<string, FrotaComVencimentos>();
  for (const item of porUrgencia) {
    const frota = frotas.get(item.frotaId);
    if (frota) frota.itens.push(item);
    else frotas.set(item.frotaId, { id: item.frotaId, nome: item.frotaNome, itens: [item] });
  }
  return [...frotas.values()];
}

/** Lê o alerta de vencimento de quem está logado (a operação vê todos; os demais, os seus). */
async function lerAlertaDeVencimento(supabase: ClienteSupabase): Promise<AlertaDeVencimento> {
  const [itens, prazo] = await Promise.all([
    supabase.rpc('itens_em_alerta_de_vencimento'),
    supabase.rpc('prazo_alerta_vencimento_dias'),
  ]);
  if (itens.error || prazo.error) {
    throw new ErroApi('falha', 'Não foi possível ler os vencimentos', {
      cause: itens.error ?? prazo.error,
    });
  }
  return {
    prazoDias: prazo.data,
    itens: itens.data.map((i): ItemEmAlerta => ({
      itemId: i.item_id,
      frotaId: i.frota_id,
      frotaNome: i.frota_nome,
      alvo: i.alvo,
      alvoId: i.alvo_id,
      tipo: i.tipo,
      estado: i.estado,
      validade: i.validade,
      diasRestantes: i.dias_restantes,
      guincheiro: i.guincheiro_nome ?? null,
      podeReenviar: i.posso_reenviar,
    })),
  };
}

/** Erros das funções de homologação (migração `homologacao`). */
function erroDaHomologacao(error: { code?: string }, mensagemDeFalha: string): ErroApi {
  switch (error.code) {
    case '42501':
      return new ErroApi('sem_permissao', 'Só a operação decide itens de homologação', {
        cause: error,
      });
    case 'P0002':
      return new ErroApi('item_indisponivel', 'Este item não existe mais', { cause: error });
    case 'GHM03':
      return new ErroApi('transicao_invalida', 'Este item já foi decidido ou aguarda reenvio', {
        cause: error,
      });
    case 'GHM04':
      return new ErroApi('motivo_obrigatorio', 'Diga o motivo da recusa', { cause: error });
    case 'GHM05':
      return new ErroApi(
        'documento_vencido',
        'A validade do documento já passou: peça um novo envio',
        { cause: error },
      );
    default:
      return new ErroApi('falha', mensagemDeFalha, { cause: error });
  }
}

/** Pedido parado à espera de o Cliente aprovar o novo preço (ADR-0013), como o Monitor mostra. */
export interface PedidoAguardandoAprovacao {
  pedidoId: string;
  /** Centavos: o preço anterior e o novo, de outra Frota. */
  precoAnterior: number;
  precoNovo: number;
  /** ISO 8601: sem resposta até aqui, vale como desistência. */
  expiraEm: string;
  origemEndereco: string | null;
  destinoEndereco: string | null;
}

/**
 * O que o Painel de operação usa: a entrada por telefone do `ApiGuinchei`, mais sair e a
 * leitura do operador. O Painel só admite perfis com papel `operacao`.
 */
export interface ApiPainel extends Pick<
  ApiGuinchei,
  'enviarCodigo' | 'confirmarCodigo' | 'temSessao' | 'buscarMeuPerfil'
> {
  /** Encerra a sessão no aparelho. */
  sair(): Promise<void>;
  /** `null` sem sessão ou se o perfil logado não é da operação. */
  buscarMeuOperador(): Promise<MeuOperador | null>;
  /** Monitor: Pedidos aguardando o Cliente aprovar o novo preço, o que vence primeiro no topo. */
  listarPedidosAguardandoAprovacao(): Promise<PedidoAguardandoAprovacao[]>;
  /** Frotas com item `pendente`, a de envio mais antigo primeiro. */
  listarFilaHomologacao(): Promise<FrotaNaFila[]>;
  /** A Frota com todos os itens; `null` se não existe. */
  buscarFrotaHomologacao(frotaId: string): Promise<FrotaEmHomologacao | null>;
  /** Aprova um item `pendente`. */
  aprovarItem(itemId: string): Promise<void>;
  /** Recusa um item `pendente`; o motivo é obrigatório. */
  recusarItem(itemId: string, motivo: string): Promise<void>;
  /**
   * Ativa a Frota. O banco só aceita se a regra de homologação vale agora (alvará, apólice,
   * veículo e Guincheiro vinculado aprovados e vigentes); senão, erro `frota_incompleta` com
   * "Faltam N itens para ativar a Frota". A Frota volta a inativa sozinha quando um item
   * obrigatório vence ou é recusado.
   */
  ativarFrota(frotaId: string): Promise<void>;
  /** URL assinada de curta duração (`VALIDADE_URL_DOCUMENTO_SEGUNDOS`) do documento do item. */
  urlDoDocumento(itemId: string): Promise<string>;
  /**
   * Itens aprovados que vencem em até `prazoDias` (parâmetro do banco, 30 por padrão) e os já
   * vencidos, de todas as Frotas, do mais urgente ao menos.
   */
  listarVencimentos(): Promise<AlertaDeVencimento>;
}

export function criarApiPainel(supabase: ClienteSupabase): ApiPainel {
  const base = criarApi(supabase);
  return {
    enviarCodigo: base.enviarCodigo,
    confirmarCodigo: base.confirmarCodigo,
    temSessao: base.temSessao,
    buscarMeuPerfil: base.buscarMeuPerfil,

    async sair() {
      const { error } = await supabase.auth.signOut();
      if (error) throw new ErroApi('falha', 'Não foi possível sair', { cause: error });
    },

    async buscarMeuOperador() {
      const perfil = await base.buscarMeuPerfil();
      return perfil?.papel === 'operacao' ? { nome: perfil.nome } : null;
    },

    async listarPedidosAguardandoAprovacao() {
      const { data, error } = await supabase
        .from('recotacoes_pedido')
        .select(
          'pedido_id, preco_anterior, preco_novo, expira_em, pedidos (origem_endereco, destino_endereco)',
        )
        .eq('resultado', 'pendente')
        .order('expira_em', { ascending: true });
      if (error) {
        throw new ErroApi('falha', 'Não foi possível ler os Pedidos aguardando aprovação', {
          cause: error,
        });
      }
      return data.map((r) => ({
        pedidoId: r.pedido_id,
        precoAnterior: r.preco_anterior,
        precoNovo: r.preco_novo,
        expiraEm: r.expira_em ?? '',
        origemEndereco: r.pedidos?.origem_endereco ?? null,
        destinoEndereco: r.pedidos?.destino_endereco ?? null,
      }));
    },

    async listarFilaHomologacao() {
      const { data, error } = await supabase
        .from('itens_homologacao')
        .select('frota_id, enviado_em, frotas (nome, tipo, documento)')
        .eq('estado', 'pendente')
        .order('enviado_em', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw new ErroApi('falha', 'Não foi possível ler a fila', { cause: error });
      // Ordenados do mais antigo: o primeiro item de cada Frota marca a vez dela na fila.
      const fila = new Map<string, FrotaNaFila>();
      const prontas = await supabase.rpc('frotas_prontas_para_ativar');
      if (prontas.error) {
        throw new ErroApi('falha', 'Não foi possível ler a fila de ativação', {
          cause: prontas.error,
        });
      }
      const idsProntas = new Set(prontas.data.map((f) => f.id));
      for (const item of data) {
        const frota = fila.get(item.frota_id);
        if (frota) {
          frota.pendentes += 1;
        } else if (item.frotas) {
          fila.set(item.frota_id, {
            id: item.frota_id,
            nome: item.frotas.nome,
            tipo: item.frotas.tipo,
            documento: item.frotas.documento,
            pendentes: 1,
            pronta: idsProntas.has(item.frota_id),
            enviadoEm: item.enviado_em,
          });
        }
      }
      // Frotas que cumprem a regra e não têm item pendente: só falta a operação ativar.
      for (const f of prontas.data) {
        if (fila.has(f.id)) continue;
        fila.set(f.id, {
          id: f.id,
          nome: f.nome,
          tipo: f.tipo,
          documento: f.documento,
          pendentes: 0,
          pronta: true,
          enviadoEm: f.pronta_desde,
        });
      }
      return [...fila.values()];
    },

    async buscarFrotaHomologacao(frotaId) {
      const { data, error } = await supabase
        .from('frotas')
        .select(
          'id, nome, tipo, documento, ativa, itens_homologacao (id, alvo, alvo_id, tipo, estado, motivo, validade, enviado_em), veiculos (id, placa, tipo, pbt_kg), vinculos_veiculo (id, veiculo_id, guincheiro_id, situacao)',
        )
        .eq('id', frotaId)
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler a Frota', { cause: error });
      if (!data) return null;
      const pendencias = await supabase.rpc('pendencias_de_ativacao', { frota_id: data.id });
      if (pendencias.error) {
        throw new ErroApi('falha', 'Não foi possível ler o que falta para a Frota', {
          cause: pendencias.error,
        });
      }

      // Itens de Guincheiro: o nome do dono e os dados da CNH e da certidão (a operação lê todos).
      const donos = [
        ...new Set(
          data.itens_homologacao.filter((i) => i.alvo === 'guincheiro').map((i) => i.alvo_id),
        ),
      ];
      const nomes = new Map<string, string>();
      const documentos = new Map<string, Tables<'documentos_guincheiro'>>();
      if (donos.length > 0) {
        const [perfis, dados] = await Promise.all([
          supabase.from('perfis').select('id, nome').in('id', donos),
          supabase.from('documentos_guincheiro').select('*').in('guincheiro_id', donos),
        ]);
        if (perfis.error || dados.error) {
          throw new ErroApi('falha', 'Não foi possível ler os Guincheiros', {
            cause: perfis.error ?? dados.error,
          });
        }
        for (const p of perfis.data) nomes.set(p.id, p.nome);
        for (const d of dados.data) documentos.set(d.guincheiro_id, d);
      }

      return {
        id: data.id,
        nome: data.nome,
        tipo: data.tipo,
        documento: data.documento,
        ativa: data.ativa,
        pendenciasDeAtivacao: pendencias.data.map(pendenciaDeAtivacao),
        itens: data.itens_homologacao
          .map((i): ItemHomologacao => {
            const item = itemDeHomologacao(i);
            if (i.alvo !== 'guincheiro') return item;
            const d = documentos.get(i.alvo_id);
            item.guincheiro = nomes.get(i.alvo_id) ?? null;
            if (i.tipo === 'cnh') {
              item.cnh =
                d?.cnh_numero && d.cnh_categoria && d.cnh_validade && d.cnh_ear !== null
                  ? {
                      numero: d.cnh_numero,
                      categoria: d.cnh_categoria,
                      validade: d.cnh_validade,
                      ear: d.cnh_ear,
                    }
                  : null;
            }
            if (i.tipo === 'antecedentes')
              item.antecedentesEmissao = d?.antecedentes_emissao ?? null;
            return item;
          })
          .sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm) || a.id.localeCompare(b.id)),
        veiculos: data.veiculos.map((v) => ({
          id: v.id,
          placa: v.placa,
          tipo: v.tipo,
          pbtKg: v.pbt_kg,
        })),
        vinculos: data.vinculos_veiculo.map((v) => ({
          id: v.id,
          veiculoId: v.veiculo_id,
          guincheiroId: v.guincheiro_id,
          situacao: v.situacao,
        })),
      };
    },

    async aprovarItem(itemId) {
      const { error } = await supabase.rpc('decidir_item_homologacao', {
        item_id: itemId,
        decisao: 'aprovado',
      });
      if (error) throw erroDaHomologacao(error, 'Não foi possível aprovar o item');
    },

    async recusarItem(itemId, motivo) {
      const { error } = await supabase.rpc('decidir_item_homologacao', {
        item_id: itemId,
        decisao: 'recusado',
        motivo,
      });
      if (error) throw erroDaHomologacao(error, 'Não foi possível recusar o item');
    },

    async ativarFrota(frotaId) {
      const { error } = await supabase.rpc('ativar_frota', { frota_id: frotaId });
      if (!error) return;
      switch (error.code) {
        case 'GAT01':
          throw new ErroApi('frota_incompleta', error.message, { cause: error });
        case '42501':
          throw new ErroApi('sem_permissao', 'Só a operação ativa uma Frota', { cause: error });
        case 'P0002':
          throw new ErroApi('item_indisponivel', 'Esta Frota não existe mais', { cause: error });
        default:
          throw new ErroApi('falha', 'Não foi possível ativar a Frota', { cause: error });
      }
    },

    async urlDoDocumento(itemId) {
      const { data: item, error } = await supabase
        .from('itens_homologacao')
        .select('arquivo')
        .eq('id', itemId)
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler o item', { cause: error });
      if (!item) throw new ErroApi('item_indisponivel', 'Este item não existe mais');
      const { data, error: erroUrl } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .createSignedUrl(item.arquivo, VALIDADE_URL_DOCUMENTO_SEGUNDOS);
      if (erroUrl || !data) {
        throw new ErroApi('falha', 'Documento indisponível', { cause: erroUrl });
      }
      return data.signedUrl;
    },

    listarVencimentos() {
      return lerAlertaDeVencimento(supabase);
    },
  };
}
