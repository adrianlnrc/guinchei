// Base das Edge Functions do Guinchei (Deno). Sem dependências externas: o banco é chamado
// pelo PostgREST com a service_role (fetch puro), e quem é o Cliente vem do JWT da
// requisição, conferido no Auth. SUPABASE_URL, SUPABASE_ANON_KEY e
// SUPABASE_SERVICE_ROLE_KEY são injetadas pelo Supabase (local e staging).

/** Mesmos motivos de `MotivoErroApi` em @guinchei/api, que os traduz para o app. */
export type MotivoErro =
  | 'sem_sessao'
  | 'sem_guincheiro'
  | 'sem_trajeto'
  | 'sem_cotacao'
  | 'pagamento_recusado'
  | 'pedido_indisponivel'
  | 'falha';

export class ErroServidor extends Error {
  constructor(
    readonly status: number,
    readonly erro: MotivoErro,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** Erro devolvido por uma função do banco: `code` é o SQLSTATE (ex.: GCT01). */
export class ErroBanco extends Error {
  constructor(
    readonly code: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function variavel(nome: string): string {
  const valor = Deno.env.get(nome);
  if (!valor) throw new Error(`variável ${nome} ausente`);
  return valor;
}

/** Id do usuário dono do JWT da requisição; sem sessão válida, 401. */
async function usuarioDaRequisicao(req: Request): Promise<string> {
  const autorizacao = req.headers.get('Authorization');
  const semSessao = new ErroServidor(401, 'sem_sessao', 'Entre com o celular antes');
  if (!autorizacao) throw semSessao;
  const resposta = await fetch(`${variavel('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: variavel('SUPABASE_ANON_KEY'), Authorization: autorizacao },
  });
  if (!resposta.ok) throw semSessao;
  const usuario = (await resposta.json()) as { id?: string };
  if (!usuario.id) throw semSessao;
  return usuario.id;
}

/** Chama uma função do banco como service_role. */
export async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const chave = variavel('SUPABASE_SERVICE_ROLE_KEY');
  const resposta = await fetch(`${variavel('SUPABASE_URL')}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const { code, message } = (corpo ?? {}) as { code?: string; message?: string };
    throw new ErroBanco(code ?? String(resposta.status), message ?? 'erro no banco');
  }
  return corpo as T;
}

export interface Requisicao {
  clienteId: string;
  corpo: Record<string, unknown>;
}

type Traducao = (erro: ErroBanco) => ErroServidor | null;

/** POST com CORS; erro do banco traduzido por `traduzir`, o resto vira 500 `falha`. */
function servirPost(
  tratar: (req: Request, corpo: Record<string, unknown>) => Promise<unknown>,
  traduzir: Traducao,
): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return responder(405, { erro: 'falha', mensagem: 'Use POST' });
    try {
      const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      return responder(200, await tratar(req, corpo));
    } catch (e) {
      const erro = e instanceof ErroBanco ? (traduzir(e) ?? e) : e;
      if (erro instanceof ErroServidor) {
        return responder(erro.status, { erro: erro.erro, mensagem: erro.message });
      }
      console.error(erro);
      return responder(500, { erro: 'falha', mensagem: 'Erro inesperado no servidor' });
    }
  });
}

/**
 * Serve uma função POST autenticada pelo JWT do usuário. `traduzir` converte o erro do
 * banco (SQLSTATE) na resposta ao app; o que não for traduzido vira 500 `falha`.
 */
export function servir(
  tratar: (requisicao: Requisicao) => Promise<unknown>,
  traduzir: Traducao,
): void {
  servirPost(async (req, corpo) => {
    const clienteId = await usuarioDaRequisicao(req);
    return tratar({ clienteId, corpo });
  }, traduzir);
}

/**
 * Serve uma função POST só para o próprio backend (o pg_net do banco): exige a
 * service_role no `Authorization`. Nenhum app chama.
 */
export function servirInterno(
  tratar: (corpo: Record<string, unknown>) => Promise<unknown>,
  traduzir: Traducao,
): void {
  servirPost(async (req, corpo) => {
    const esperado = `Bearer ${variavel('SUPABASE_SERVICE_ROLE_KEY')}`;
    if (req.headers.get('Authorization') !== esperado) {
      throw new ErroServidor(401, 'sem_sessao', 'Só o backend chama esta função');
    }
    return tratar(corpo);
  }, traduzir);
}

/** O Pedido não é do Cliente ou já saiu de `cotado` (P0002 nas funções do banco). */
export const PEDIDO_INDISPONIVEL = new ErroServidor(
  404,
  'pedido_indisponivel',
  'Pedido não encontrado ou já confirmado',
);

/** `pedido_id` do corpo, como uuid. */
export function pedidoIdDoCorpo(corpo: Record<string, unknown>): string {
  const id = corpo.pedido_id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new ErroServidor(400, 'falha', 'pedido_id inválido');
  }
  return id;
}
