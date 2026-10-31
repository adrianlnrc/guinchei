// Preparo, limpeza e conferência do banco pelo `service_role`. É a única parte do e2e que
// fala com o banco por fora dos apps: o fluxo em si (login, Pedido, aceite, Corrida) passa
// sempre pela tela.
import { createClient } from '@supabase/supabase-js';

export const GUINCHEIROS = {
  marcos: '22222222-2222-4222-8222-222222222201',
  wagner: '22222222-2222-4222-8222-222222222202',
  rita: '22222222-2222-4222-8222-222222222203',
} as const;
const TODOS_OS_GUINCHEIROS = Object.values(GUINCHEIROS);

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor)
    throw new Error(`Falta ${nome}. Rode o e2e por \`pnpm e2e\` (veja docs/desenvolvimento.md).`);
  return valor;
}

const banco = createClient(exigir('SUPABASE_URL'), exigir('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

function conferir<T>({
  data,
  error,
}: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (error) throw new Error(`Banco do e2e: ${error.message}`);
  return data as NonNullable<T>;
}

async function apagarArquivosDeFotos(): Promise<void> {
  const bucket = banco.storage.from('fotos-estado');
  const pastas = conferir(await bucket.list('', { limit: 1000 }));
  for (const pasta of pastas) {
    const arquivos = conferir(await bucket.list(pasta.name, { limit: 1000 }));
    if (arquivos.length === 0) continue;
    conferir(await bucket.remove(arquivos.map((a) => `${pasta.name}/${a.name}`)));
  }
}

/**
 * Deixa o banco como o cenário espera: sem Pedidos, Corridas, ofertas, recotações, pagamentos nem fotos, e
 * com os três Guincheiros do seed em plantão. As Corridas saem antes de religar a
 * disponibilidade (o banco recusa `disponivel = true` com Corrida aberta).
 */
export async function prepararBanco(): Promise<void> {
  await apagarArquivosDeFotos();
  for (const tabela of [
    'fotos_estado',
    'corridas',
    'tentativas_match',
    'recotacoes_pedido',
    'pagamentos',
    'pedidos',
  ]) {
    conferir(await banco.from(tabela).delete().not('id', 'is', null));
  }
  await definirPlantao(TODOS_OS_GUINCHEIROS, true);
}

export async function definirPlantao(ids: readonly string[], disponivel: boolean): Promise<void> {
  conferir(
    await banco
      .from('guincheiros')
      .update({ disponivel })
      .in('id', [...ids]),
  );
}

export async function tirarTodosDoPlantao(): Promise<void> {
  await definirPlantao(TODOS_OS_GUINCHEIROS, false);
}

export async function colocarTodosNoPlantao(): Promise<void> {
  await definirPlantao(TODOS_OS_GUINCHEIROS, true);
}

/** O Pedido mais recente (os cenários abrem um só). */
export async function pedidoAtual() {
  const linhas = conferir(
    await banco
      .from('pedidos')
      .select('id, estado, preco_total, rodada_match')
      .order('criado_em', { ascending: false })
      .limit(1),
  );
  return linhas[0] ?? null;
}

export async function pagamentosDoPedido(pedidoId: string) {
  return conferir(
    await banco.from('pagamentos').select('estado, valor, metodo').eq('pedido_id', pedidoId),
  );
}

export async function ofertasDoPedido(pedidoId: string) {
  return conferir(
    await banco
      .from('tentativas_match')
      .select('guincheiro_id, resultado, rodada, repasse_oferecido')
      .eq('pedido_id', pedidoId)
      .order('id'),
  );
}

export async function corridaDoPedido(pedidoId: string) {
  const linhas = conferir(
    await banco.from('corridas').select('estado, guincheiro_id').eq('pedido_id', pedidoId),
  );
  return linhas[0] ?? null;
}

export async function guincheiroDisponivel(id: string): Promise<boolean | null> {
  const linhas = conferir(await banco.from('guincheiros').select('disponivel').eq('id', id));
  return linhas[0]?.disponivel ?? null;
}
