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

/**
 * Telefones de teste do cadastro (supabase/config.toml, `[auth.sms.test_otp]`): a cada cenário o
 * número entra como pessoa nova, sem usuário nem perfil. Quem se cadastra com eles é limpo e
 * liberado por `prepararBanco`.
 */
export const TELEFONES_DO_CADASTRO = {
  autonomo: '5561900000051',
  autonomoSemHomologacao: '5561900000052',
} as const;
const BUCKET_DOCUMENTOS = 'documentos-prestadores';

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

/** Os arquivos que cada um dos `donos` enviou ao bucket de documentos (pasta = id do dono). */
async function apagarDocumentosDe(donos: readonly string[]): Promise<void> {
  const bucket = banco.storage.from(BUCKET_DOCUMENTOS);
  for (const dono of donos) {
    const arquivos = conferir(await bucket.list(dono, { limit: 1000 }));
    if (arquivos.length === 0) continue;
    conferir(await bucket.remove(arquivos.map((a) => `${dono}/${a.name}`)));
  }
}

const soDigitos = (telefone: string | undefined) => (telefone ?? '').replace(/\D/g, '');

/**
 * Limpa o que os cenários de cadastro deixam e liberta os telefones de teste.
 *
 * Uma Frota cadastrada não se apaga: a trilha de auditoria da homologação (imutável, nem o
 * `service_role` mexe) referencia os itens, que referenciam a Frota e o perfil de quem a
 * cadastrou. Por isso, como na integração do `@guinchei/api`, o número de teste passa a outro
 * telefone aleatório e o próximo cenário o encontra como pessoa nova (CPF, placa, RENAVAM e CNH
 * também são sorteados a cada cenário, para não colidir com os que ficaram). Do que sobra, sai
 * tudo o que pode sair: os arquivos do bucket, os vínculos (e o histórico deles), os dados de
 * CNH e certidão, os convites e o rascunho do cadastro; e o Guincheiro fica fora do plantão, o
 * que o tira do Match (a Frota volta a inativa sozinha quando o vínculo cai).
 */
async function limparCadastros(): Promise<void> {
  const telefones = new Set<string>(Object.values(TELEFONES_DO_CADASTRO));
  const lista = await banco.auth.admin.listUsers({ perPage: 1000 });
  if (lista.error) throw new Error(`Banco do e2e: ${lista.error.message}`);
  const { users } = lista.data;
  const usados = users.filter((u) => telefones.has(soDigitos(u.phone)));
  if (usados.length === 0) return;
  const ids = usados.map((u) => u.id);

  await apagarDocumentosDe(ids);
  conferir(await banco.from('vinculos_veiculo').delete().in('guincheiro_id', ids));
  conferir(await banco.from('vinculos_encerrados').delete().in('guincheiro_id', ids));
  conferir(await banco.from('documentos_guincheiro').delete().in('guincheiro_id', ids));
  conferir(await banco.from('convites_guincheiro').delete().in('criado_por', ids));
  conferir(await banco.from('rascunhos_frota').delete().in('usuario_id', ids));
  await definirPlantao(ids, false);

  const emUso = new Set(users.map((u) => soDigitos(u.phone)));
  for (const usuario of usados) {
    let livre: string;
    do {
      livre = `55619${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    } while (emUso.has(livre));
    emUso.add(livre);
    const troca = await banco.auth.admin.updateUserById(usuario.id, { phone: livre });
    if (troca.error) throw new Error(`Banco do e2e: ${troca.error.message}`);
    conferir(await banco.from('perfis').update({ telefone: livre }).eq('id', usuario.id));
  }
}

/**
 * Deixa o banco como o cenário espera: sem Pedidos, Corridas, ofertas, recotações, pagamentos nem fotos,
 * sem os cadastros do e2e (`limparCadastros`) e com os três Guincheiros do seed em plantão. As Corridas saem antes de religar a
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
  await limparCadastros();
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

/** O usuário (id do Auth, do perfil e do Guincheiro) que entrou com o telefone, ou null. */
export async function usuarioDoTelefone(telefone: string): Promise<string | null> {
  const linhas = conferir(await banco.from('perfis').select('id').eq('telefone', telefone));
  return linhas[0]?.id ?? null;
}

/** A Frota que a pessoa representa (o autônomo cadastra a própria), ou null. */
export async function frotaDoRepresentante(usuarioId: string) {
  const linhas = conferir(
    await banco.from('frotas').select('id, nome, ativa').eq('representante_id', usuarioId),
  );
  return linhas[0] ?? null;
}

/** O estado de cada item de homologação da Frota (alvo, tipo e estado), para conferir a fila. */
export async function itensDaFrota(frotaId: string) {
  return conferir(
    await banco.from('itens_homologacao').select('alvo, tipo, estado').eq('frota_id', frotaId),
  );
}

/** O vínculo do Guincheiro com o veículo (no máximo um), com a situação que o banco calculou. */
export async function vinculoDoGuincheiro(guincheiroId: string) {
  const linhas = conferir(
    await banco
      .from('vinculos_veiculo')
      .select('situacao, veiculos (placa, pbt_kg)')
      .eq('guincheiro_id', guincheiroId),
  );
  return linhas[0] ?? null;
}
