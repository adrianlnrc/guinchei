import {
  createClient,
  FunctionsHttpError,
  isAuthApiError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { Endereco } from '@guinchei/geo';
import type { MetodoPagamento } from '@guinchei/pagamento';
import type { PrecoFechado } from '@guinchei/preco';
import type { Database, Enums, Tables } from '@guinchei/tipos';

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
  /** O Pedido não é do Cliente ou não está no estado que a ação pede. */
  | 'pedido_indisponivel'
  /** A oferta não é do Guincheiro, já foi respondida ou expirou. */
  | 'oferta_indisponivel'
  /** O Guincheiro está indisponível (plantão desligado ou outra Corrida). */
  | 'guincheiro_indisponivel'
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
  /** Guincheiro: ofertas abertas para ele, a que vence primeiro antes. */
  buscarOfertasAbertas(): Promise<OfertaAberta[]>;
  /** Guincheiro: aceita a oferta e devolve o id da Corrida criada. */
  aceitarOferta(tentativaId: number): Promise<string>;
  /** Guincheiro: recusa a oferta; o Match passa ao próximo. */
  recusarOferta(tentativaId: number): Promise<void>;
}

export function criarClienteApi({ supabaseUrl, supabaseAnonKey }: ConfigApi): ClienteSupabase {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('supabaseUrl e supabaseAnonKey são obrigatórios');
  }
  // A sessão fica no localStorage do navegador (padrão do supabase-js): o login persiste.
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

const CPF_UNICO = 'perfis_cpf_key';
/** Código do erro de `definir_trajeto_pedido` para ponto fora do DF. */
const FORA_DO_DF = 'GDF01';

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

export function criarApi(supabase: ClienteSupabase): ApiGuinchei {
  async function usuarioLogado() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
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
  };
}
