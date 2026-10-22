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
  /** 8 dígitos, sem máscara (qualquer CEP do país, não só do DF). */
  cep: string;
  /** Versão dos termos de uso aceita. */
  termosVersao: string;
}

/** Cadastro no app (completo, nunca bloqueia Pedido): o que o Cliente pode mudar. */
export interface CadastroCliente {
  nome: string;
  /** 8 dígitos, sem máscara. */
  cep: string;
  /** Opcional; vazio apaga o e-mail. */
  email?: string;
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
  /** CPF ou CNPJ do MEI do autônomo; CNPJ da empresa (aceita o alfanumérico). */
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
  /** Qual dos dois formulários: `empresa` (CNPJ) ou `autonomo` (CPF ou MEI), ADR-0012. */
  tipo: Enums<'tipo_frota'>;
  etapa: EtapaCadastroFrota;
  dados: DadosCadastroFrota;
}

/** A Frota de quem a cadastrou (representante), com o estado de cada item de homologação. */
export interface MinhaFrota {
  id: string;
  tipo: Enums<'tipo_frota'>;
  documento: string;
  nome: string;
  /** `false` até a operação ativar, depois da homologação. */
  ativa: boolean;
  baseCep: string | null;
  baseEndereco: string | null;
  baseBairro: string | null;
  chavePix: string | null;
  /** Último dia de validade da apólice (AAAA-MM-DD). */
  apoliceValidade: string | null;
  termosPrestadorVersao: string | null;
  itens: ItemHomologacao[];
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
  'cotado' | 'em_match' | 'sem_guincheiro' | 'estornado' | Enums<'estado_corrida'>;

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
  /** Cadastro do Cliente: o CEP não tem 8 dígitos ou são todos iguais. */
  | 'cep_invalido'
  /** Cadastro do Cliente: o e-mail não tem formato válido. */
  | 'email_invalido'
  | 'sem_sessao'
  | 'fora_do_df'
  /** Nenhum Guincheiro elegível na hora da cotação. */
  | 'sem_guincheiro'
  /** O Pedido ainda não tem origem e destino. */
  | 'sem_trajeto'
  /** O Pedido não tem Preço fechado (ex.: o trajeto mudou depois de cotar). */
  | 'sem_cotacao'
  | 'pagamento_recusado'
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
  /** Telefone do login (só dígitos, com o 55); `null` sem sessão. */
  telefoneDaSessao(): Promise<string | null>;
  /** Perfil de quem está logado; `null` sem sessão ou antes do cadastro urgente. */
  buscarMeuPerfil(): Promise<Perfil | null>;
  /** Erros: `cpf_ja_cadastrado`, `cep_invalido`. */
  criarPerfilUrgente(dados: CadastroUrgente): Promise<Perfil>;
  /**
   * Atualiza nome, CEP e e-mail do próprio Cliente (CPF e telefone não mudam) e devolve o
   * perfil. Erros: `cep_invalido`, `email_invalido`.
   */
  atualizarMeuCadastro(dados: CadastroCliente): Promise<Perfil>;
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
  | 'telefoneDaSessao'
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
  /** Cadastro de Frota em andamento de quem está logado; `null` se não há. */
  buscarRascunhoFrota(): Promise<RascunhoFrota | null>;
  /**
   * Grava o rascunho do cadastro (cria ou atualiza o mesmo). Erro `cadastro_indisponivel` se
   * o número já é de Cliente, Guincheiro ou de quem já enviou a Frota.
   */
  salvarRascunhoFrota(rascunho: RascunhoFrota): Promise<void>;
  /**
   * O representante reenvia o documento de um item da Frota recusado (ou vencido): envia o
   * arquivo ao bucket e volta o item a `pendente`, na fila do Painel. A apólice leva a nova
   * validade. Erros: `arquivo_invalido`, `arquivo_grande`, `item_indisponivel`,
   * `transicao_invalida` (o item não está recusado nem vencido), `documento_vencido`.
   */
  reenviarItemDaFrota(itemId: string, arquivo: ArquivoDeMidia, validade?: string): Promise<void>;
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
const CEP_CHECK = 'perfis_cep_check';
const EMAIL_CHECK = 'perfis_email_check';
const VIOLACAO_DE_CHECK = '23514';
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
    case 'confirmado':
    case 'em_match':
      return 'em_match';
    case 'atribuido':
      return corrida ?? 'aceita';
  }
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
    const [pedido, corrida] = await Promise.all([
      supabase
        .from('pedidos')
        .select('id, estado, preco_total, origem_endereco, destino_endereco')
        .eq('id', pedidoId)
        .maybeSingle(),
      supabase.from('corridas').select('id, estado').eq('pedido_id', pedidoId).maybeSingle(),
    ]);
    if (pedido.error || corrida.error) {
      throw new ErroApi('falha', 'Não foi possível ler o acompanhamento', {
        cause: pedido.error ?? corrida.error,
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

    async telefoneDaSessao() {
      return (await usuarioLogado())?.phone ?? null;
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

    async criarPerfilUrgente({ nome, cpf, cep, termosVersao }) {
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
          cep,
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
      if (error?.code === VIOLACAO_DE_CHECK && error.message.includes(CEP_CHECK)) {
        throw new ErroApi('cep_invalido', 'CEP inválido', { cause: error });
      }
      if (error) throw new ErroApi('falha', 'Não foi possível salvar o cadastro', { cause: error });
      return data;
    },

    async atualizarMeuCadastro({ nome, cep, email }) {
      const { data, error } = await supabase.rpc('atualizar_cadastro_cliente', {
        nome,
        cep,
        email: email ?? '',
      });
      if (error?.code === VIOLACAO_DE_CHECK && error.message.includes(CEP_CHECK)) {
        throw new ErroApi('cep_invalido', 'CEP inválido', { cause: error });
      }
      if (error?.code === VIOLACAO_DE_CHECK && error.message.includes(EMAIL_CHECK)) {
        throw new ErroApi('email_invalido', 'E-mail inválido', { cause: error });
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

export function criarApiGuincheiro(supabase: ClienteSupabase): ApiGuincheiro {
  const base = criarApi(supabase);

  async function meuId() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }

  /** Envia o documento ao bucket de prestadores, na pasta de quem envia, e devolve o caminho. */
  async function enviarDocumentoDePrestador(arquivo: ArquivoDeMidia): Promise<string> {
    const id = await meuId();
    if (!id) throw new ErroApi('sem_sessao', 'Entre com o celular antes');
    const extensao = EXTENSAO_DO_DOCUMENTO[arquivo.type];
    if (!extensao) {
      throw new ErroApi('arquivo_invalido', 'Formato não aceito. Envie um PDF ou uma foto.');
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

    telefoneDaSessao: base.telefoneDaSessao,

    async buscarRascunhoFrota() {
      const { data, error } = await supabase
        .from('rascunhos_frota')
        .select('tipo, etapa, dados')
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler o cadastro', { cause: error });
      if (!data) return null;
      return {
        tipo: data.tipo,
        etapa: data.etapa as EtapaCadastroFrota,
        dados: dadosDoJson(data.dados),
      };
    },

    async salvarRascunhoFrota({ tipo, etapa, dados }) {
      const { error } = await supabase
        .from('rascunhos_frota')
        .upsert({ tipo, etapa, dados: dadosParaJson(dados) }, { onConflict: 'usuario_id' });
      if (error) throw erroDoCadastroDeFrota(error, 'Não foi possível salvar o cadastro');
    },

    async enviarDocumentoDaFrota(arquivo) {
      return enviarDocumentoDePrestador(arquivo);
    },

    async reenviarItemDaFrota(itemId, arquivo, validade) {
      const caminho = await enviarDocumentoDePrestador(arquivo);
      const { error } = await supabase.rpc('reenviar_item_homologacao', {
        item_id: itemId,
        arquivo: caminho,
        validade,
      });
      if (error?.code === '42501') {
        throw new ErroApi('sem_permissao', 'Este item não é da sua Frota', { cause: error });
      }
      if (error) throw erroDaHomologacao(error, 'Não foi possível reenviar o documento');
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
          'id, tipo, documento, nome, ativa, base_cep, base_endereco, base_bairro, chave_pix, apolice_validade, termos_prestador_versao, itens_homologacao (id, alvo, tipo, estado, motivo, validade, enviado_em)',
        )
        .eq('representante_id', id)
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler a Frota', { cause: error });
      if (!data) return null;
      return {
        id: data.id,
        tipo: data.tipo,
        documento: data.documento,
        nome: data.nome,
        ativa: data.ativa,
        baseCep: data.base_cep,
        baseEndereco: data.base_endereco,
        baseBairro: data.base_bairro,
        chavePix: data.chave_pix,
        apoliceValidade: data.apolice_validade,
        termosPrestadorVersao: data.termos_prestador_versao,
        itens: data.itens_homologacao
          .map((i) => ({
            id: i.id,
            alvo: i.alvo,
            tipo: i.tipo,
            estado: i.estado,
            motivo: i.motivo,
            validade: i.validade,
            enviadoEm: i.enviado_em,
          }))
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
  tipo: TipoItemHomologacao;
  estado: EstadoHomologacao;
  /** Motivo da recusa vigente; `null` fora de `recusado`. */
  motivo: string | null;
  /** Último dia de validade (AAAA-MM-DD), quando o documento tem. */
  validade: string | null;
  /** ISO 8601: quando entrou (ou voltou) para a fila. */
  enviadoEm: string;
}

/** Uma Frota com item `pendente`, na ordem de envio. */
export interface FrotaNaFila {
  id: string;
  nome: string;
  tipo: Enums<'tipo_frota'>;
  documento: string;
  pendentes: number;
  /** ISO 8601: o envio do item pendente mais antigo. */
  enviadoEm: string;
}

export interface FrotaEmHomologacao {
  id: string;
  nome: string;
  tipo: Enums<'tipo_frota'>;
  documento: string;
  /** Todos os itens, em qualquer estado, do mais antigo ao mais novo. */
  itens: ItemHomologacao[];
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
  /** Frotas com item `pendente`, a de envio mais antigo primeiro. */
  listarFilaHomologacao(): Promise<FrotaNaFila[]>;
  /** A Frota com todos os itens; `null` se não existe. */
  buscarFrotaHomologacao(frotaId: string): Promise<FrotaEmHomologacao | null>;
  /** Aprova um item `pendente`. */
  aprovarItem(itemId: string): Promise<void>;
  /** Recusa um item `pendente`; o motivo é obrigatório. */
  recusarItem(itemId: string, motivo: string): Promise<void>;
  /** URL assinada de curta duração (`VALIDADE_URL_DOCUMENTO_SEGUNDOS`) do documento do item. */
  urlDoDocumento(itemId: string): Promise<string>;
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
            enviadoEm: item.enviado_em,
          });
        }
      }
      return [...fila.values()];
    },

    async buscarFrotaHomologacao(frotaId) {
      const { data, error } = await supabase
        .from('frotas')
        .select(
          'id, nome, tipo, documento, itens_homologacao (id, alvo, tipo, estado, motivo, validade, enviado_em)',
        )
        .eq('id', frotaId)
        .maybeSingle();
      if (error) throw new ErroApi('falha', 'Não foi possível ler a Frota', { cause: error });
      if (!data) return null;
      return {
        id: data.id,
        nome: data.nome,
        tipo: data.tipo,
        documento: data.documento,
        itens: data.itens_homologacao
          .map((i) => ({
            id: i.id,
            alvo: i.alvo,
            tipo: i.tipo,
            estado: i.estado,
            motivo: i.motivo,
            validade: i.validade,
            enviadoEm: i.enviado_em,
          }))
          .sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm) || a.id.localeCompare(b.id)),
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
  };
}
