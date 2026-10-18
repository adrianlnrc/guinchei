// Integração com o Supabase local (login por telefone, cadastro urgente, abrir Pedido).
//
// Só roda com SUPABASE_URL definida (o CI ainda não sobe o Supabase). Com o Supabase local
// de pé (`pnpm supabase start`), na raiz do repositório:
//
//   eval "$(pnpm -s supabase status -o env | sed 's/^/export /')"
//   SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
//     pnpm --filter @guinchei/api test
//
// Usa os números de teste de `[auth.sms.test_otp]` (código 123456): o Rafael, que já tem
// perfil no seed, e o 5561900000006, sem perfil. A `service_role` só serve para apagar o
// usuário do 5561900000006 antes, para o teste poder rodar de novo sem `db reset`.
import { createClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  criarApi,
  criarApiGuincheiro,
  criarApiPainel,
  criarClienteApi,
  ErroApi,
  VALIDADE_URL_DOCUMENTO_SEGUNDOS,
  type Acompanhamento,
  type ApiGuinchei,
  type ApiGuincheiro,
  type ClienteSupabase,
  type EtapaDoAcompanhamento,
  type MotivoErroApi,
} from './index';

declare const crypto: { randomUUID(): string };
declare const process: { env: Record<string, string | undefined> };
declare const console: { info(mensagem: string): void };
declare function setTimeout(fazer: () => void, ms: number): unknown;
declare function atob(base64: string): string;
declare function fetch(url: string): Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>;
declare class Blob {
  constructor(partes: Uint8Array[], opcoes?: { type: string });
  readonly type: string;
  readonly size: number;
}
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
/**
 * Diz ao teste com que configuração as Edge Functions estão rodando: com `1`, elas foram
 * servidas com `--env-file supabase/testes-recusa.env` e o mock recusa valores terminados
 * em 99 centavos; sem ela, o padrão (nunca recusa).
 */
const RECUSA_LIGADA = process.env.PAGAMENTO_MOCK_RECUSA_TESTE === '1';

const CODIGO_DE_TESTE = '123456';
const RAFAEL = { telefone: '+5561900000001', id: '11111111-1111-4111-8111-111111111111' };
const OPERACAO = { telefone: '+5561900000005', id: '33333333-3333-4333-8333-333333333333' };
const MARCOS_TELEFONE = '+5561900000002';
const SEM_PERFIL = '+5561900000006';
const PAULO = { telefone: '+5561900000007', id: '22222222-2222-4222-8222-222222222204' };

function novaApi() {
  const supabase = criarClienteApi({
    supabaseUrl: SUPABASE_URL!,
    supabaseAnonKey: SUPABASE_ANON_KEY!,
  });
  return { supabase, api: criarApi(supabase) };
}

async function pedidoComTrajeto() {
  // Sem reenviar o código (limite de um envio a cada 5 s): o número de teste confirma direto.
  const { supabase, api } = novaApi();
  await api.confirmarCodigo(RAFAEL.telefone, CODIGO_DE_TESTE);
  const id = await api.abrirPedido({
    tipoVeiculo: 'carro',
    situacao: 'nao_liga',
    rodasGiram: 'sim',
  });
  await api.definirTrajeto(id, {
    origem: { ponto: { lat: -15.7903, lng: -47.8921 }, rotulo: 'Eixo Monumental, Brasília' },
    destino: { ponto: { lat: -15.8336, lng: -48.0566 }, rotulo: 'QNA 12, Taguatinga Norte' },
    kmRebocado: 21.347,
  });
  return { supabase, api, id };
}

function admin() {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('defina SUPABASE_SERVICE_ROLE_KEY');
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

describe.skipIf(!SUPABASE_URL)('@guinchei/api contra o Supabase local', () => {
  it('o Cliente do seed entra com o código de teste e abre um Pedido em cotado', async () => {
    const { supabase, api } = novaApi();
    expect(await api.temSessao()).toBe(false);

    await api.enviarCodigo(RAFAEL.telefone);
    await api.confirmarCodigo(RAFAEL.telefone, CODIGO_DE_TESTE);
    expect(await api.temSessao()).toBe(true);
    expect((await api.buscarMeuPerfil())?.nome).toBe('Rafael Souza');

    const id = await api.abrirPedido({
      tipoVeiculo: 'moto',
      situacao: 'superaqueceu',
      rodasGiram: 'sim',
    });
    const { data } = await supabase
      .from('pedidos')
      .select('cliente_id, estado, tipo_veiculo, situacao, rodas_giram, preco_total')
      .eq('id', id)
      .single();
    expect(data).toEqual({
      cliente_id: RAFAEL.id,
      estado: 'cotado',
      tipo_veiculo: 'moto',
      situacao: 'superaqueceu',
      rodas_giram: 'sim',
      preco_total: null,
    });

    // Voltou e mudou uma resposta: o mesmo Pedido é atualizado.
    await api.atualizarPedido(id, { tipoVeiculo: 'van', situacao: 'outro', rodasGiram: 'nao' });
    const { data: atualizado } = await supabase
      .from('pedidos')
      .select('estado, tipo_veiculo, situacao, rodas_giram')
      .eq('id', id)
      .single();
    expect(atualizado).toEqual({
      estado: 'cotado',
      tipo_veiculo: 'van',
      situacao: 'outro',
      rodas_giram: 'nao',
    });

    // Origem e destino pelo mapa (#9).
    await api.definirTrajeto(id, {
      origem: { ponto: { lat: -15.7903, lng: -47.8921 }, rotulo: 'Eixo Monumental, Brasília' },
      destino: { ponto: { lat: -15.8336, lng: -48.0566 }, rotulo: 'QNA 12, Taguatinga Norte' },
      kmRebocado: 21.347,
    });
    const { data: comTrajeto } = await supabase
      .from('pedidos')
      .select('origem_endereco, destino_endereco, km_rebocado')
      .eq('id', id)
      .single();
    expect(comTrajeto).toEqual({
      origem_endereco: 'Eixo Monumental, Brasília',
      destino_endereco: 'QNA 12, Taguatinga Norte',
      km_rebocado: 21.35,
    });

    const foraDoDF = await api
      .definirTrajeto(id, {
        origem: { ponto: { lat: -15.7903, lng: -47.8921 }, rotulo: 'Eixo Monumental, Brasília' },
        destino: { ponto: { lat: -16.0683, lng: -47.9758 }, rotulo: 'Valparaíso de Goiás' },
        kmRebocado: 35,
      })
      .catch((e: unknown) => e);
    expect((foraDoDF as ErroApi).motivo).toBe('fora_do_df');
  });

  describe('cotação e confirmação (Edge Functions cotar-pedido e confirmar-pedido)', () => {
    it('preço exibido == preço gravado == valor autorizado, com a cotação em menos de 2 s', async () => {
      const { supabase, api, id } = await pedidoComTrajeto();

      const inicio = Date.now();
      const cotacao = await api.cotarPedido(id);
      const duracaoMs = Date.now() - inicio;
      console.info(`cotarPedido respondeu em ${duracaoMs.toFixed(0)} ms`);
      expect(duracaoMs).toBeLessThan(2000);

      // Guincheiro elegível mais próximo do Eixo Monumental: Marcos, no Cruzeiro (~4,2 km).
      expect(cotacao.kmAteVeiculo).toBeGreaterThan(4);
      expect(cotacao.kmAteVeiculo).toBeLessThan(4.4);
      expect(cotacao.kmRebocado).toBe(21.35);
      expect(cotacao.tabelaPrecosVersao).toBe(1);
      expect(cotacao.preco).toMatchObject({ taxaBase: 11000, reboque: 12810 });

      const { data: gravado } = await supabase
        .from('pedidos')
        .select(
          'estado, km_ate_veiculo, tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_adicional_noturno, preco_adicional_feriado, preco_ajuste_minimo, preco_total',
        )
        .eq('id', id)
        .single();
      expect(gravado).toEqual({
        estado: 'cotado',
        km_ate_veiculo: cotacao.kmAteVeiculo,
        tabela_precos_versao: 1,
        preco_taxa_base: cotacao.preco.taxaBase,
        preco_ate_veiculo: cotacao.preco.deslocamento,
        preco_rebocado: cotacao.preco.reboque,
        preco_adicional_noturno: cotacao.preco.adicionalNoturno,
        preco_adicional_feriado: cotacao.preco.adicionalFeriado,
        preco_ajuste_minimo: cotacao.preco.ajustePiso,
        preco_total: cotacao.preco.total,
      });

      const pagamento = await api.confirmarPedido(id, 'pix');
      expect(pagamento).toMatchObject({ estado: 'autorizado', valor: cotacao.preco.total });

      const { data: pagamentos } = await supabase
        .from('pagamentos')
        .select('valor, estado, metodo, provedor')
        .eq('pedido_id', id);
      expect(pagamentos).toEqual([
        { valor: cotacao.preco.total, estado: 'autorizado', metodo: 'pix', provedor: 'mock' },
      ]);
      const { data: confirmado } = await supabase
        .from('pedidos')
        .select('estado, preco_total')
        .eq('id', id)
        .single();
      // Autorizado, o Pedido passa por `confirmado` e já entra no Match (#11).
      expect(confirmado).toEqual({ estado: 'em_match', preco_total: cotacao.preco.total });

      // Confirmado, o Pedido não é cotado nem confirmado de novo.
      const deNovo = await api.confirmarPedido(id, 'pix').catch((e: unknown) => e);
      expect((deNovo as ErroApi).motivo).toBe('pedido_indisponivel');
      const recotar = await api.cotarPedido(id).catch((e: unknown) => e);
      expect((recotar as ErroApi).motivo).toBe('pedido_indisponivel');
    });

    it('mudar o trajeto depois de cotar exige cotar de novo; cotar de novo regrava', async () => {
      const { api, id } = await pedidoComTrajeto();
      await api.cotarPedido(id);
      await api.definirTrajeto(id, {
        origem: { ponto: { lat: -15.7903, lng: -47.8921 }, rotulo: 'Eixo Monumental, Brasília' },
        destino: { ponto: { lat: -16.0153, lng: -48.0614 }, rotulo: 'Setor Central, Gama' },
        kmRebocado: 30,
      });
      const semCotacao = await api.confirmarPedido(id, 'pix').catch((e: unknown) => e);
      expect((semCotacao as ErroApi).motivo).toBe('sem_cotacao');

      const nova = await api.cotarPedido(id);
      expect(nova.kmRebocado).toBe(30);
      expect(nova.preco.reboque).toBe(18000);
      await expect(api.confirmarPedido(id, 'cartao')).resolves.toMatchObject({
        valor: nova.preco.total,
      });
    });

    it('cotações simultâneas do mesmo Pedido não falham (a segunda relê e regrava)', async () => {
      const { api, id } = await pedidoComTrajeto();
      const cotacoes = await Promise.all([
        api.cotarPedido(id),
        api.cotarPedido(id),
        api.cotarPedido(id),
      ]);
      expect(new Set(cotacoes.map((c) => c.preco.total)).size).toBe(1);
    });

    describe('Preço fechado terminado em 99 centavos', () => {
      // Uma versão temporária da tabela, vigente só durante o teste, com o total fixo em
      // R$ 179,99 (sem km, adicionais nem piso). Apagada no fim, junto com o Pedido.
      async function comPrecoTerminadoEm99(
        teste: (
          id: string,
          api: ReturnType<typeof novaApi>['api'],
          supabase: ReturnType<typeof novaApi>['supabase'],
        ) => Promise<void>,
      ) {
        const servico = admin();
        const { data: ultima } = await servico
          .from('tabela_precos')
          .select('versao')
          .order('versao', { ascending: false })
          .limit(1)
          .single();
        const versao = (ultima!.versao as number) + 1;
        const { error } = await servico.from('tabela_precos').insert({
          versao,
          vigente_desde: new Date(Date.now() - 1000).toISOString(),
          taxa_base: 17999,
          por_km_ate_veiculo: 0,
          por_km_rebocado: 0,
          adicional_noturno: 0,
          noturno_das: 20,
          noturno_ate: 6,
          adicional_feriado: 0,
          preco_minimo: 0,
          comissao: 0.2,
        });
        if (error) throw error;
        let id: string | undefined;
        try {
          const pedido = await pedidoComTrajeto();
          id = pedido.id;
          const cotacao = await pedido.api.cotarPedido(id);
          expect(cotacao.preco.total).toBe(17999);
          await teste(id, pedido.api, pedido.supabase);
        } finally {
          if (id) {
            // Autorizado, o Pedido entrou no Match: as ofertas também saem.
            await servico.from('tentativas_match').delete().eq('pedido_id', id);
            await servico.from('pagamentos').delete().eq('pedido_id', id);
            await servico.from('pedidos').delete().eq('id', id);
          }
          await servico.from('tabela_precos').delete().eq('versao', versao);
        }
      }

      it.skipIf(RECUSA_LIGADA)(
        'com a recusa de teste desligada (padrão, como em staging), é autorizado',
        async () => {
          await comPrecoTerminadoEm99(async (id, api) => {
            await expect(api.confirmarPedido(id, 'pix')).resolves.toMatchObject({
              estado: 'autorizado',
              valor: 17999,
            });
          });
        },
      );

      it.skipIf(!RECUSA_LIGADA)(
        'com PAGAMENTO_MOCK_RECUSA_TESTE=1, é recusado e o Pedido continua cotado',
        async () => {
          await comPrecoTerminadoEm99(async (id, api, supabase) => {
            const recusa = await api.confirmarPedido(id, 'cartao').catch((e: unknown) => e);
            expect(recusa).toBeInstanceOf(ErroApi);
            expect((recusa as ErroApi).motivo).toBe('pagamento_recusado');

            const { data: pedido } = await supabase
              .from('pedidos')
              .select('estado, preco_total')
              .eq('id', id)
              .single();
            expect(pedido).toEqual({ estado: 'cotado', preco_total: 17999 });
            const { data: pagamentos } = await supabase
              .from('pagamentos')
              .select('valor, estado, metodo, provedor')
              .eq('pedido_id', id);
            expect(pagamentos).toEqual([
              { valor: 17999, estado: 'recusado', metodo: 'cartao', provedor: 'mock' },
            ]);
          });
        },
      );
    });

    it('sem Guincheiro elegível, a cotação responde "Nenhum guincho disponível agora"', async () => {
      const { api, id } = await pedidoComTrajeto();
      const servico = admin();
      const { data: disponiveis } = await servico
        .from('guincheiros')
        .select('id')
        .eq('disponivel', true);
      const ids = (disponiveis ?? []).map((g) => g.id as string);
      await servico.from('guincheiros').update({ disponivel: false }).in('id', ids);
      try {
        const erro = await api.cotarPedido(id).catch((e: unknown) => e);
        expect(erro).toBeInstanceOf(ErroApi);
        expect((erro as ErroApi).motivo).toBe('sem_guincheiro');
        expect((erro as ErroApi).message).toBe('Nenhum guincho disponível agora');
      } finally {
        await servico.from('guincheiros').update({ disponivel: true }).in('id', ids);
      }
    });

    it('sem Pedido em cotado do próprio Cliente, nem cota nem confirma', async () => {
      const { id } = await pedidoComTrajeto();
      const { api: deslogado } = novaApi();
      const semSessao = await deslogado.cotarPedido(id).catch((e: unknown) => e);
      expect((semSessao as ErroApi).motivo).toBe('sem_sessao');

      const { api } = novaApi();
      await api.confirmarCodigo(RAFAEL.telefone, CODIGO_DE_TESTE);
      const inexistente = await api
        .cotarPedido('00000000-0000-4000-8000-000000000000')
        .catch((e: unknown) => e);
      expect((inexistente as ErroApi).motivo).toBe('pedido_indisponivel');
    });
  });

  describe('Match (Edge Functions ofertar-proximo e estornar-pedido, pg_cron e pg_net)', () => {
    // Guincheiros do seed, do mais perto ao mais longe do Eixo Monumental.
    const MARCOS = { telefone: '+5561900000002', id: '22222222-2222-4222-8222-222222222201' };
    const WAGNER = { telefone: '+5561900000003', id: '22222222-2222-4222-8222-222222222202' };
    const RITA = { telefone: '+5561900000004', id: '22222222-2222-4222-8222-222222222203' };
    const GUINCHEIROS = [MARCOS.id, WAGNER.id, RITA.id];
    /** Timeout curto, para a expiração não demorar 30 s; a varredura roda a cada 5 s. */
    const TIMEOUT_DE_TESTE_S = 3;
    const PRAZO_MS = 25_000;

    let timeoutAnterior = 30;

    beforeAll(async () => {
      const servico = admin();
      const { data } = await servico
        .from('parametros_match')
        .select('timeout_oferta_segundos')
        .single();
      timeoutAnterior = data!.timeout_oferta_segundos as number;
      await servico
        .from('parametros_match')
        .update({ timeout_oferta_segundos: TIMEOUT_DE_TESTE_S })
        .eq('id', true);
    });

    afterAll(async () => {
      await admin()
        .from('parametros_match')
        .update({ timeout_oferta_segundos: timeoutAnterior })
        .eq('id', true);
    });

    // Quem aceita fica indisponível; cada teste começa com os três disponíveis e sem Corrida.
    // A guarda do banco (GDP01, #35) recusa ligar o plantão com Corrida não terminal, então
    // as Corridas que o teste deixou em andamento saem antes de religar.
    afterEach(async () => {
      const servico = admin();
      const { data: abertas, error } = await servico
        .from('corridas')
        .select('id, estado')
        .in('guincheiro_id', GUINCHEIROS)
        .in('estado', ['aceita', 'a_caminho', 'no_local', 'carregado']);
      if (error) throw error;
      const etapas = ['aceita', 'a_caminho', 'no_local', 'carregado', 'entregue'] as const;
      for (const corrida of abertas ?? []) {
        // Entrega pelas transições normais: as Corridas e as Fotos de estado continuam no banco.
        for (const estado of etapas.slice(etapas.indexOf(corrida.estado as never) + 1)) {
          const avancou = await servico.from('corridas').update({ estado }).eq('id', corrida.id);
          if (avancou.error) throw avancou.error;
        }
      }
      const religou = await servico
        .from('guincheiros')
        .update({ disponivel: true })
        .in('id', GUINCHEIROS);
      if (religou.error) throw religou.error;
    });

    async function entrar(telefone: string) {
      const { api } = novaApi();
      await api.confirmarCodigo(telefone, CODIGO_DE_TESTE);
      return api;
    }

    async function esperar<T>(ler: () => Promise<T | null | undefined>, oQue: string): Promise<T> {
      const limite = Date.now() + PRAZO_MS;
      for (;;) {
        const valor = await ler();
        if (valor) return valor;
        if (Date.now() > limite) throw new Error(`esperou demais por: ${oQue}`);
        await new Promise<void>((r) => setTimeout(r, 300));
      }
    }

    /** A oferta aberta deste Pedido para o Guincheiro (ele pode ter ofertas de outros). */
    function ofertaDoPedido(
      guincheiro: Pick<ApiGuinchei, 'buscarOfertasAbertas'>,
      pedidoId: string,
    ) {
      return esperar(
        async () => (await guincheiro.buscarOfertasAbertas()).find((o) => o.pedidoId === pedidoId),
        `oferta do Pedido ${pedidoId}`,
      );
    }

    async function estadoDoPedido(pedidoId: string) {
      const { data } = await admin().from('pedidos').select('estado').eq('id', pedidoId).single();
      return data!.estado as string;
    }

    async function pedidoConfirmado() {
      const pedido = await pedidoComTrajeto();
      const cotacao = await pedido.api.cotarPedido(pedido.id);
      await pedido.api.confirmarPedido(pedido.id, 'pix');
      return { ...pedido, cotacao };
    }

    it('confirmar oferta ao mais próximo; a recusa passa ao próximo; o aceite cria a Corrida', async () => {
      const { supabase, id, cotacao } = await pedidoConfirmado();
      expect(await estadoDoPedido(id)).toBe('em_match');
      const [marcos, wagner] = await Promise.all([
        entrar(MARCOS.telefone),
        entrar(WAGNER.telefone),
      ]);

      // O Marcos (Cruzeiro, o mais perto) recebe pela distância dele: a da cotação.
      const primeira = await ofertaDoPedido(marcos, id);
      expect(primeira).toMatchObject({
        rodada: 1,
        kmAteVeiculo: cotacao.kmAteVeiculo,
        precoRecalculado: cotacao.preco.total,
        repasse: cotacao.preco.total - Math.round(cotacao.preco.total * 0.2),
        pedido: {
          origemEndereco: 'Eixo Monumental, Brasília',
          destinoEndereco: 'QNA 12, Taguatinga Norte',
          kmRebocado: 21.35,
        },
      });
      const naoEhDele = await wagner.aceitarOferta(primeira.tentativaId).catch((e: unknown) => e);
      expect((naoEhDele as ErroApi).motivo).toBe('oferta_indisponivel');

      // Recusa, com chamadas simultâneas a ofertar-proximo junto com o disparo do banco:
      // nenhuma abre uma segunda oferta.
      await marcos.recusarOferta(primeira.tentativaId);
      const servico = admin();
      await Promise.all(
        Array.from({ length: 4 }, () =>
          servico.functions.invoke('ofertar-proximo', { body: { pedido_id: id } }),
        ),
      );

      // O Wagner (Asa Norte, mais longe) recebe pela distância dele.
      const segunda = await ofertaDoPedido(wagner, id);
      expect(segunda.kmAteVeiculo).toBeGreaterThan(primeira.kmAteVeiculo);
      expect(segunda.precoRecalculado).toBeGreaterThan(cotacao.preco.total);
      const { data: tentativas } = await admin()
        .from('tentativas_match')
        .select('guincheiro_id, resultado, ordem')
        .eq('pedido_id', id)
        .order('ordem');
      expect(tentativas).toEqual([
        { guincheiro_id: MARCOS.id, resultado: 'recusada', ordem: 1 },
        { guincheiro_id: WAGNER.id, resultado: 'oferecida', ordem: 2 },
      ]);

      const corridaId = await wagner.aceitarOferta(segunda.tentativaId);
      const deNovo = await wagner.aceitarOferta(segunda.tentativaId).catch((e: unknown) => e);
      expect((deNovo as ErroApi).motivo).toBe('oferta_indisponivel');

      const { data: corrida } = await servico
        .from('corridas')
        .select('id, estado, guincheiro_id, repasse')
        .eq('pedido_id', id)
        .single();
      expect(corrida).toEqual({
        id: corridaId,
        estado: 'aceita',
        guincheiro_id: WAGNER.id,
        repasse: segunda.repasse,
      });
      const { data: guincheiro } = await servico
        .from('guincheiros')
        .select('disponivel')
        .eq('id', WAGNER.id)
        .single();
      expect(guincheiro).toEqual({ disponivel: false });
      expect((await wagner.buscarOfertasAbertas()).some((o) => o.pedidoId === id)).toBe(false);

      // O Cliente acompanha pelo próprio Pedido.
      const { data: doCliente } = await supabase
        .from('pedidos')
        .select('estado')
        .eq('id', id)
        .single();
      expect(doCliente).toEqual({ estado: 'atribuido' });
    }, 60_000);

    async function esgotarRodada(id: string) {
      const [marcos, wagner, rita] = await Promise.all([
        entrar(MARCOS.telefone),
        entrar(WAGNER.telefone),
        entrar(RITA.telefone),
      ]);
      await marcos.recusarOferta((await ofertaDoPedido(marcos, id)).tentativaId);
      // O Wagner deixa a oferta expirar: a varredura do pg_cron passa à Rita.
      await ofertaDoPedido(wagner, id);
      await rita.recusarOferta((await ofertaDoPedido(rita, id)).tentativaId);
      await esperar(
        async () => (await estadoDoPedido(id)) === 'sem_guincheiro',
        'Pedido em sem_guincheiro',
      );
      const { data: tentativas } = await admin()
        .from('tentativas_match')
        .select('guincheiro_id, resultado')
        .eq('pedido_id', id)
        .order('ordem');
      expect(tentativas).toEqual([
        { guincheiro_id: MARCOS.id, resultado: 'recusada' },
        { guincheiro_id: WAGNER.id, resultado: 'expirada' },
        { guincheiro_id: RITA.id, resultado: 'recusada' },
      ]);
      return { marcos };
    }

    it('sem aceite, sem_guincheiro com o pagamento autorizado; tentar de novo reoferta e o aceite atribui', async () => {
      const { api, id, cotacao } = await pedidoConfirmado();
      const { marcos } = await esgotarRodada(id);

      const { data: pagamento } = await admin()
        .from('pagamentos')
        .select('estado, valor')
        .eq('pedido_id', id)
        .single();
      expect(pagamento).toEqual({ estado: 'autorizado', valor: cotacao.preco.total });

      await api.tentarDeNovo(id);
      const deNovo = await api.tentarDeNovo(id).catch((e: unknown) => e);
      expect((deNovo as ErroApi).motivo).toBe('pedido_indisponivel');

      // Rodada 2: o Marcos, que recusou na rodada 1, recebe de novo, com o mesmo preço.
      const reoferta = await ofertaDoPedido(marcos, id);
      expect(reoferta).toMatchObject({ rodada: 2, precoRecalculado: cotacao.preco.total });
      await marcos.aceitarOferta(reoferta.tentativaId);
      expect(await estadoDoPedido(id)).toBe('atribuido');
      const { data: pagamentos } = await admin()
        .from('pagamentos')
        .select('estado')
        .eq('pedido_id', id);
      expect(pagamentos).toEqual([{ estado: 'autorizado' }]);
    }, 90_000);

    it('candidato longe demais (absorção acima da Comissão) é pulado pelo teto e não recebe', async () => {
      const pedido = await pedidoComTrajeto();
      const cotacao = await pedido.api.cotarPedido(pedido.id);
      // Depois da cotação (com o Marcos a ~4,2 km), só a Rita fica elegível, e em Planaltina
      // (~35 km do Eixo Monumental): o repasse pela distância dela passaria da Comissão.
      const servico = admin();
      const { data: rita } = await servico
        .from('guincheiros')
        .select('posicao')
        .eq('id', RITA.id)
        .single();
      await servico
        .from('guincheiros')
        .update({ disponivel: false })
        .in('id', [MARCOS.id, WAGNER.id]);
      await servico
        .from('guincheiros')
        .update({ posicao: 'SRID=4326;POINT(-47.65 -15.62)' })
        .eq('id', RITA.id);
      try {
        await pedido.api.confirmarPedido(pedido.id, 'pix');
        // A primeira oferta sai na confirmação: a Rita é pulada e a rodada se esgota.
        expect(await estadoDoPedido(pedido.id)).toBe('sem_guincheiro');
        const { data: tentativas } = await servico
          .from('tentativas_match')
          .select('guincheiro_id, resultado, expira_em, preco_recalculado')
          .eq('pedido_id', pedido.id);
        const [pulada, ...outras] = tentativas ?? [];
        expect(outras).toEqual([]);
        expect(pulada).toMatchObject({
          guincheiro_id: RITA.id,
          resultado: 'pulada_teto',
          expira_em: null,
        });
        expect(pulada!.preco_recalculado as number).toBeGreaterThan(cotacao.preco.total);
        const ritaApi = await entrar(RITA.telefone);
        expect(await ritaApi.buscarOfertasAbertas()).toEqual([]);
      } finally {
        await servico.from('guincheiros').update({ posicao: rita!.posicao }).eq('id', RITA.id);
      }
    }, 30_000);

    describe('app do Guincheiro (#12): Realtime, aceite e avanço da Corrida', () => {
      // Aqui a oferta não deve expirar antes do aceite: prazo de 20 s neste bloco.
      const TIMEOUT_DO_BLOCO_S = 20;
      beforeAll(async () => {
        const servico = admin();
        await servico
          .from('parametros_match')
          .update({ timeout_oferta_segundos: TIMEOUT_DO_BLOCO_S })
          .eq('id', true);
        // Corridas deixadas em andamento pelos outros testes: aqui cada um começa sem Corrida.
        await servico.from('corridas').delete().in('guincheiro_id', GUINCHEIROS);
        const religou = await servico
          .from('guincheiros')
          .update({ disponivel: true })
          .in('id', GUINCHEIROS);
        if (religou.error) throw religou.error;
      });
      afterAll(async () => {
        const servico = admin();
        await servico
          .from('parametros_match')
          .update({ timeout_oferta_segundos: TIMEOUT_DE_TESTE_S })
          .eq('id', true);
        // Ofertas de 20 s que sobraram de Pedidos deste bloco não podem atrapalhar os próximos
        // testes (por exemplo, o de "candidato longe demais", que espera a Rita sem ofertas).
        await servico
          .from('tentativas_match')
          .update({ resultado: 'expirada', respondida_em: new Date().toISOString() })
          .eq('resultado', 'oferecida');
      });

      async function entrarComoGuincheiro(telefone: string) {
        const supabase = criarClienteApi({
          supabaseUrl: SUPABASE_URL!,
          supabaseAnonKey: SUPABASE_ANON_KEY!,
        });
        const api = criarApiGuincheiro(supabase);
        await api.confirmarCodigo(telefone, CODIGO_DE_TESTE);
        return { supabase, api };
      }

      /**
       * Escuta `tentativas_match` direto no Realtime e guarda os Pedidos dos eventos que chegam
       * a este login: prova que a RLS filtra no Realtime (cada Guincheiro só recebe o seu).
       */
      async function escutarTentativas(supabase: ReturnType<typeof criarClienteApi>) {
        const pedidos = new Set<string>();
        let pronto!: () => void;
        const conectado = new Promise<void>((r) => (pronto = r));
        const canal = supabase
          .channel(`tentativas-${Math.random()}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tentativas_match' },
            (mudanca) => pedidos.add((mudanca.new as { pedido_id: string }).pedido_id),
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') pronto();
          });
        await conectado;
        return { pedidos, parar: () => void supabase.removeChannel(canal) };
      }

      /** Assina as ofertas e espera o canal ficar pronto (o primeiro aviso é o da conexão). */
      async function assinarEContar(api: ApiGuincheiro) {
        let avisos = 0;
        let pronto!: () => void;
        const conectado = new Promise<void>((r) => (pronto = r));
        const cancelar = api.assinarOfertas(() => {
          avisos += 1;
          if (avisos === 1) pronto();
        });
        await conectado;
        return { cancelar, avisos: () => avisos - 1 };
      }

      it('a oferta chega pelo Realtime só a quem a recebeu; aceitar e avançar até entregue', async () => {
        const [doMarcosLogin, doWagnerLogin] = await Promise.all([
          entrarComoGuincheiro(MARCOS.telefone),
          entrarComoGuincheiro(WAGNER.telefone),
        ]);
        const marcos = doMarcosLogin.api;
        const wagner = doWagnerLogin.api;
        expect((await marcos.buscarMeuPerfil())?.papel).toBe('guincheiro');
        await marcos.definirDisponibilidade(false);
        expect((await marcos.buscarMeuGuincheiro())?.disponivel).toBe(false);
        await marcos.definirDisponibilidade(true);
        expect(await marcos.buscarMeuGuincheiro()).toMatchObject({
          nome: 'Marcos Alves',
          frota: 'Reboque Planalto',
          disponivel: true,
        });

        const doMarcos = await assinarEContar(marcos);
        const brutoMarcos = await escutarTentativas(doMarcosLogin.supabase);
        const brutoWagner = await escutarTentativas(doWagnerLogin.supabase);
        // Logo depois de SUBSCRIBED o Realtime ainda pode estar ligando a replicação do canal (num banco recém-criado, o primeiro evento chegou a se perder sem esta espera).
        await new Promise<void>((r) => setTimeout(r, 6000));
        try {
          const { id } = await pedidoConfirmado();
          // O Marcos, o mais perto, recebe a oferta pelo Realtime, sem consultar antes.
          await esperar(async () => doMarcos.avisos() > 0, 'aviso de oferta no Realtime');
          await esperar(async () => brutoMarcos.pedidos.has(id), 'evento da oferta do Pedido');
          const oferta = await ofertaDoPedido(marcos, id);

          // Pela hora do servidor, a oferta vence dentro do prazo do bloco.
          const agora = Date.parse(await marcos.horaDoServidor());
          expect(Date.parse(oferta.expiraEm) - agora).toBeGreaterThan(0);
          expect(Date.parse(oferta.expiraEm) - agora).toBeLessThanOrEqual(
            TIMEOUT_DO_BLOCO_S * 1000,
          );

          const corridaId = await marcos.aceitarOferta(oferta.tentativaId);
          // A RLS vale no Realtime: o Wagner não recebeu nenhum evento do Pedido do Marcos.
          await new Promise<void>((r) => setTimeout(r, 1500));
          expect(brutoWagner.pedidos.has(id)).toBe(false);
          expect((await marcos.buscarMeuGuincheiro())?.disponivel).toBe(false);

          const estados: string[] = [];
          let prontoCorrida!: () => void;
          const conectada = new Promise<void>((r) => (prontoCorrida = r));
          const cancelarCorrida = marcos.assinarCorrida(
            corridaId,
            (estado) => estados.push(estado),
            () => prontoCorrida(),
          );
          await conectada;
          try {
            const atual = await marcos.minhaCorridaAtual();
            expect(atual).toMatchObject({
              id: corridaId,
              pedidoId: id,
              estado: 'aceita',
              repasse: oferta.repasse,
              precoRecalculado: oferta.precoRecalculado,
              pedido: { origemEndereco: 'Eixo Monumental, Brasília' },
            });

            const pulo = await marcos.avancarCorrida(corridaId, 'no_local').catch((e) => e);
            expect((pulo as ErroApi).motivo).toBe('transicao_invalida');
            const alheia = await wagner.avancarCorrida(corridaId, 'a_caminho').catch((e) => e);
            expect((alheia as ErroApi).motivo).toBe('corrida_indisponivel');

            // Guarda do banco (GDP01): em Corrida, o plantão não liga (por exemplo, em outra aba).
            const plantao = await marcos.definirDisponibilidade(true).catch((e) => e);
            expect((plantao as ErroApi).motivo).toBe('em_corrida');
            await marcos.definirDisponibilidade(false);

            for (const para of ['a_caminho', 'no_local', 'carregado', 'entregue'] as const) {
              expect(await marcos.avancarCorrida(corridaId, para)).toBe(para);
            }
            await esperar(async () => estados.length === 4, 'os 4 estados pelo Realtime');
            expect(estados).toEqual(['a_caminho', 'no_local', 'carregado', 'entregue']);
          } finally {
            cancelarCorrida();
          }

          // Entregue: sem Corrida atual, de volta ao plantão, e o repasse continua legível.
          expect(await marcos.minhaCorridaAtual()).toBeNull();
          expect((await marcos.buscarMeuGuincheiro())?.disponivel).toBe(true);
          expect(await marcos.buscarCorrida(corridaId)).toMatchObject({
            estado: 'entregue',
            repasse: oferta.repasse,
          });
        } finally {
          doMarcos.cancelar();
          brutoMarcos.parar();
          brutoWagner.parar();
        }
      }, 60_000);

      it('o Cliente não é Guincheiro: o perfil diz o papel', async () => {
        const { api: rafael } = await entrarComoGuincheiro(RAFAEL.telefone);
        expect((await rafael.buscarMeuPerfil())?.papel).toBe('cliente');
        expect(await rafael.buscarMeuGuincheiro()).toBeNull();
        await rafael.sair();
        expect(await rafael.temSessao()).toBe(false);
      });
    });

    it('sem aceite, o Cliente estorna: Pedido e pagamento estornados', async () => {
      const { api, id, cotacao } = await pedidoConfirmado();
      await esgotarRodada(id);

      await expect(api.estornarPedido(id)).resolves.toEqual({
        estado: 'estornado',
        valor: cotacao.preco.total,
      });
      expect(await estadoDoPedido(id)).toBe('estornado');
      const { data: pagamento } = await admin()
        .from('pagamentos')
        .select('estado')
        .eq('pedido_id', id)
        .single();
      expect(pagamento).toEqual({ estado: 'estornado' });

      const outraVez = await api.estornarPedido(id).catch((e: unknown) => e);
      expect((outraVez as ErroApi).motivo).toBe('pedido_indisponivel');
      const tentar = await api.tentarDeNovo(id).catch((e: unknown) => e);
      expect((tentar as ErroApi).motivo).toBe('pedido_indisponivel');
    }, 90_000);

    describe('acompanhamento do Cliente (Supabase Realtime)', () => {
      /** Segue o Pedido como o app do Cliente: guarda cada estado que chega pelo Realtime. */
      function observar(api: ApiGuinchei, pedidoId: string) {
        const vistos: Acompanhamento[] = [];
        const cancelar = api.acompanharPedido(pedidoId, (a) => vistos.push(a));
        return {
          vistos,
          cancelar,
          /** Espera a etapa mais recente ser esta. */
          aguardar: (etapa: EtapaDoAcompanhamento) =>
            esperar(
              async () => (vistos.at(-1)?.etapa === etapa ? vistos.at(-1) : null),
              `etapa ${etapa}`,
            ),
          /** As etapas na ordem em que chegaram, sem repetir a mesma em seguida. */
          etapas: () =>
            vistos.map((a) => a.etapa).filter((etapa, i, todas) => etapa !== todas[i - 1]),
        };
      }

      async function entrarComoGuincheiro(telefone: string) {
        const { api, supabase } = novaApi();
        await api.confirmarCodigo(telefone, CODIGO_DE_TESTE);
        return { api, supabase };
      }

      /** O Guincheiro avança a própria Corrida (a RLS libera só o `estado`). */
      async function avancar(
        guincheiro: ClienteSupabase,
        corridaId: string,
        estado: 'a_caminho' | 'no_local' | 'carregado' | 'entregue',
      ) {
        const { error } = await guincheiro.from('corridas').update({ estado }).eq('id', corridaId);
        expect(error).toBeNull();
      }

      /** Escuta direto as tabelas, sem filtro: só chega o que a RLS deixa o usuário ver. */
      async function escutarTabelas(supabase: ClienteSupabase) {
        const eventos: string[] = [];
        const canal = supabase.channel(`escuta-${Math.random().toString(36).slice(2)}`);
        for (const tabela of ['pedidos', 'corridas'] as const) {
          canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, (p) =>
            eventos.push(`${tabela}:${p.eventType}`),
          );
        }
        await new Promise<void>((resolve, reject) =>
          canal.subscribe((status) => {
            if (status === 'SUBSCRIBED') resolve();
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
          }),
        );
        return { eventos, parar: () => supabase.removeChannel(canal) };
      }

      // Logo depois de `supabase db reset`, o Realtime ainda religa a replicação do banco:
      // uma assinatura já "SUBSCRIBED" pode perder eventos por alguns segundos. Espera um
      // evento de verdade chegar antes de testar (fora desse caso, passa na hora).
      beforeAll(async () => {
        const { api, supabase } = novaApi();
        await api.confirmarCodigo(RAFAEL.telefone, CODIGO_DE_TESTE);
        const id = await api.abrirPedido({
          tipoVeiculo: 'carro',
          situacao: 'nao_liga',
          rodasGiram: 'sim',
        });
        const escuta = await escutarTabelas(supabase);
        let vez = 0;
        try {
          await esperar(async () => {
            await api.atualizarPedido(id, {
              tipoVeiculo: 'carro',
              situacao: 'nao_liga',
              rodasGiram: ++vez % 2 ? 'nao' : 'sim',
            });
            await new Promise<void>((r) => setTimeout(r, 500));
            return escuta.eventos.length > 0;
          }, 'o Realtime entregar um evento');
        } finally {
          await escuta.parar();
        }
      }, 60_000);

      it('o Cliente recebe cada etapa da Corrida sem recarregar, com só o nome do Guincheiro', async () => {
        const { api, id } = await pedidoConfirmado();
        const acompanhamento = observar(api, id);
        try {
          expect((await acompanhamento.aguardar('em_match')).corrida).toBeNull();

          const { api: marcos, supabase: doMarcos } = await entrarComoGuincheiro(MARCOS.telefone);
          const oferta = await ofertaDoPedido(marcos, id);
          const corridaId = await marcos.aceitarOferta(oferta.tentativaId);

          const aceita = await acompanhamento.aguardar('aceita');
          expect(aceita.corrida).toEqual({
            id: corridaId,
            estado: 'aceita',
            guincheiro: { nome: 'Marcos Alves', frota: 'Reboque Planalto' },
          });
          for (const estado of ['a_caminho', 'no_local', 'carregado', 'entregue'] as const) {
            await avancar(doMarcos, corridaId, estado);
            await acompanhamento.aguardar(estado);
          }
          expect(acompanhamento.etapas()).toEqual([
            'em_match',
            'aceita',
            'a_caminho',
            'no_local',
            'carregado',
            'entregue',
          ]);
        } finally {
          acompanhamento.cancelar();
        }
      }, 60_000);

      it('o Cliente B não recebe nada do Pedido e da Corrida do Cliente A', async () => {
        const { api, supabase, id } = await pedidoConfirmado();
        const { api: apiB, supabase: supabaseB } = novaApi();
        await apiB.enviarCodigo(SEM_PERFIL);
        await apiB.confirmarCodigo(SEM_PERFIL, CODIGO_DE_TESTE);
        if (!(await apiB.buscarMeuPerfil())) {
          await apiB.criarPerfilUrgente({
            nome: 'Bia Costa',
            cpf: '11144477735',
            termosVersao: 'v-teste',
          });
        }
        const escutaA = await escutarTabelas(supabase);
        const escutaB = await escutarTabelas(supabaseB);
        const deA = observar(api, id);
        const deB = observar(apiB, id);
        try {
          await deA.aguardar('em_match');
          const { api: marcos, supabase: doMarcos } = await entrarComoGuincheiro(MARCOS.telefone);
          const corridaId = await marcos.aceitarOferta(
            (await ofertaDoPedido(marcos, id)).tentativaId,
          );
          await deA.aguardar('aceita');
          await avancar(doMarcos, corridaId, 'a_caminho');
          await deA.aguardar('a_caminho');
          // Dá tempo de um evento indevido chegar ao B antes de conferir que não veio nenhum.
          await new Promise<void>((r) => setTimeout(r, 1500));

          expect(escutaA.eventos).toEqual(
            expect.arrayContaining(['pedidos:UPDATE', 'corridas:INSERT', 'corridas:UPDATE']),
          );
          expect(escutaB.eventos).toEqual([]);
          expect(deB.vistos).toEqual([]);
          expect(await apiB.buscarAcompanhamento(id)).toBeNull();
        } finally {
          deA.cancelar();
          deB.cancelar();
          await escutaA.parar();
          await escutaB.parar();
        }
      }, 60_000);

      it('sem aceite, mostra sem_guincheiro; tentar de novo volta ao Match e o aceite atribui', async () => {
        const { api, id } = await pedidoConfirmado();
        const acompanhamento = observar(api, id);
        try {
          const { marcos } = await esgotarRodada(id);
          await acompanhamento.aguardar('sem_guincheiro');
          expect((await api.buscarAcompanhamentoEmAndamento())?.pedidoId).toBe(id);

          await api.tentarDeNovo(id);
          await acompanhamento.aguardar('em_match');
          await marcos.aceitarOferta((await ofertaDoPedido(marcos, id)).tentativaId);
          const aceita = await acompanhamento.aguardar('aceita');
          expect(aceita.corrida?.guincheiro?.nome).toBe('Marcos Alves');
          expect(acompanhamento.etapas()).toEqual([
            'em_match',
            'sem_guincheiro',
            'em_match',
            'aceita',
          ]);
        } finally {
          acompanhamento.cancelar();
        }
      }, 90_000);

      it('sem aceite, o Cliente estorna e vê "estornado"; o Pedido deixa de estar em andamento', async () => {
        const { api, id, cotacao } = await pedidoConfirmado();
        const acompanhamento = observar(api, id);
        try {
          await esgotarRodada(id);
          await acompanhamento.aguardar('sem_guincheiro');
          await api.estornarPedido(id);
          const estornado = await acompanhamento.aguardar('estornado');
          expect(estornado.precoTotal).toBe(cotacao.preco.total);
          expect(estornado.corrida).toBeNull();
          expect((await api.buscarAcompanhamentoEmAndamento())?.pedidoId).not.toBe(id);
          expect((await api.buscarAcompanhamento(id))?.etapa).toBe('estornado');
        } finally {
          acompanhamento.cancelar();
        }
      }, 90_000);

      it('o Pedido mais recente em andamento é o que o Cliente recupera ao reabrir o app', async () => {
        const { api, id } = await pedidoConfirmado();
        const { api: reaberto } = novaApi();
        await reaberto.confirmarCodigo(RAFAEL.telefone, CODIGO_DE_TESTE);
        await expect(reaberto.buscarAcompanhamentoEmAndamento()).resolves.toMatchObject({
          pedidoId: id,
          etapa: 'em_match',
        });
        expect(await api.buscarAcompanhamento('00000000-0000-4000-8000-000000000000')).toBeNull();
      }, 30_000);
    });

    describe('Fotos de estado (#13): Storage, RLS e Corrida sem fotos', () => {
      // PNG de 1x1 pixel, gerado em memória.
      const PNG = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        ),
        (c) => c.charCodeAt(0),
      );
      const imagem = () => new Blob([PNG], { type: 'image/png' });
      const video = () => new Blob([PNG], { type: 'video/mp4' });

      async function entrarComoGuincheiro(telefone: string) {
        const { api, supabase } = novaApi();
        await api.confirmarCodigo(telefone, CODIGO_DE_TESTE);
        return { api, supabase };
      }

      async function avancar(
        guincheiro: ClienteSupabase,
        corridaId: string,
        estado: 'a_caminho' | 'no_local' | 'carregado' | 'entregue',
      ) {
        const { error } = await guincheiro.from('corridas').update({ estado }).eq('id', corridaId);
        expect(error).toBeNull();
      }

      /** Pedido pago e aceito pelo Marcos: a Corrida em `aceita`, com os dois lados logados. */
      async function corridaAceita() {
        const { api: cliente, id } = await pedidoConfirmado();
        const marcos = await entrarComoGuincheiro(MARCOS.telefone);
        const oferta = await ofertaDoPedido(marcos.api, id);
        const corridaId = await marcos.api.aceitarOferta(oferta.tentativaId);
        return { cliente, guincheiro: marcos.api, doGuincheiro: marcos.supabase, corridaId };
      }

      async function esperarErro(promessa: Promise<unknown>): Promise<MotivoErroApi | 'sem_erro'> {
        try {
          await promessa;
          return 'sem_erro';
        } catch (e) {
          return e instanceof ErroApi ? e.motivo : 'falha';
        }
      }

      async function objetosDaCorrida(corridaId: string) {
        const { data } = await admin().storage.from('fotos-estado').list(corridaId);
        return (data ?? []).map((o) => o.name);
      }

      const corridasCriadas: string[] = [];
      afterAll(async () => {
        // Apaga o que o bloco registrou, para o teste rodar de novo sem `db reset`.
        const servico = admin();
        for (const corridaId of corridasCriadas) {
          await servico.from('fotos_estado').delete().eq('corrida_id', corridaId);
          const nomes = await objetosDaCorrida(corridaId);
          if (nomes.length) {
            await servico.storage
              .from('fotos-estado')
              .remove(nomes.map((n) => `${corridaId}/${n}`));
          }
          await servico.from('corridas').delete().eq('id', corridaId);
        }
      });

      it('Cliente e Guincheiro enviam uma imagem e cada um lê a do outro; o outro Cliente não lê', async () => {
        const { cliente, guincheiro, corridaId } = await corridaAceita();
        corridasCriadas.push(corridaId);

        const doCliente = await cliente.registrarFotoEstado(corridaId, imagem(), {
          etapa: 'antes',
          latitude: -15.7903,
          longitude: -47.8921,
        });
        const doGuincheiro = await guincheiro.registrarFotoEstado(corridaId, video(), {
          etapa: 'antes',
        });
        expect(doCliente).toMatchObject({
          corridaId,
          papelAutor: 'cliente',
          tipo: 'foto',
          etapa: 'antes',
          latitude: -15.7903,
          longitude: -47.8921,
        });
        expect(doGuincheiro).toMatchObject({ papelAutor: 'guincheiro', tipo: 'video' });
        // A hora é a do servidor: recente e igual à gravada.
        expect(Math.abs(Date.now() - Date.parse(doCliente.criadoEm))).toBeLessThan(60_000);

        for (const lado of [cliente, guincheiro]) {
          const fotos = await lado.listarFotosEstado(corridaId);
          expect(fotos.map((f) => f.papelAutor)).toEqual(['cliente', 'guincheiro']);
          // A URL assinada entrega o arquivo enviado.
          const resposta = await fetch(fotos[0]!.url!);
          expect(resposta.ok).toBe(true);
          expect(new Uint8Array(await resposta.arrayBuffer())).toEqual(PNG);
        }

        // Outro Cliente (o 5561900000006) não lê nem registra na Corrida.
        const { api: estranho } = novaApi();
        await estranho.enviarCodigo(SEM_PERFIL);
        await estranho.confirmarCodigo(SEM_PERFIL, CODIGO_DE_TESTE);
        if (!(await estranho.buscarMeuPerfil())) {
          await estranho.criarPerfilUrgente({
            nome: 'Bia Costa',
            cpf: '11144477735',
            termosVersao: 'v-teste',
          });
        }
        expect(await estranho.listarFotosEstado(corridaId)).toEqual([]);
        expect(
          await esperarErro(estranho.registrarFotoEstado(corridaId, imagem(), { etapa: 'antes' })),
        ).toBe('falha');
        // O envio do estranho foi barrado pelo Storage: só os 2 arquivos dos participantes.
        expect(await objetosDaCorrida(corridaId)).toHaveLength(2);
      }, 90_000);

      it('o 7º item na etapa é recusado e o arquivo enviado é apagado; etapa errada e formato inválido também', async () => {
        const { cliente, guincheiro, corridaId } = await corridaAceita();
        corridasCriadas.push(corridaId);

        for (let i = 0; i < 6; i++) {
          await cliente.registrarFotoEstado(corridaId, imagem(), { etapa: 'antes' });
        }
        expect(
          await esperarErro(cliente.registrarFotoEstado(corridaId, imagem(), { etapa: 'antes' })),
        ).toBe('limite_de_fotos');
        // O limite é por autor: o Guincheiro ainda registra as dele.
        await guincheiro.registrarFotoEstado(corridaId, imagem(), { etapa: 'antes' });
        // A limpeza do arquivo órfão funcionou: 7 linhas, 7 arquivos.
        expect(await cliente.listarFotosEstado(corridaId)).toHaveLength(7);
        expect(await objetosDaCorrida(corridaId)).toHaveLength(7);

        // Corrida em aceita: a etapa é "antes".
        expect(
          await esperarErro(
            guincheiro.registrarFotoEstado(corridaId, imagem(), { etapa: 'depois' }),
          ),
        ).toBe('etapa_mudou');
        const texto = new Blob([PNG], { type: 'text/plain' });
        expect(
          await esperarErro(cliente.registrarFotoEstado(corridaId, texto, { etapa: 'antes' })),
        ).toBe('arquivo_invalido');
        expect(await objetosDaCorrida(corridaId)).toHaveLength(7);
      }, 90_000);

      it('a etapa muda em carregado; a Corrida encerra sem nenhuma foto; arquivo registrado não se apaga', async () => {
        const { cliente, guincheiro, doGuincheiro, corridaId } = await corridaAceita();
        corridasCriadas.push(corridaId);
        await avancar(doGuincheiro, corridaId, 'a_caminho');
        await avancar(doGuincheiro, corridaId, 'no_local');
        await avancar(doGuincheiro, corridaId, 'carregado');
        expect(
          await esperarErro(
            guincheiro.registrarFotoEstado(corridaId, imagem(), { etapa: 'antes' }),
          ),
        ).toBe('etapa_mudou');
        const foto = await cliente.registrarFotoEstado(corridaId, imagem(), { etapa: 'depois' });
        expect(foto.etapa).toBe('depois');

        // Prova de Disputa: nem o autor apaga o arquivo registrado.
        const { supabase: doCliente } = await (async () => {
          const c = novaApi();
          await c.api.confirmarCodigo(RAFAEL.telefone, CODIGO_DE_TESTE);
          return c;
        })();
        const nome = (await objetosDaCorrida(corridaId))[0]!;
        await doCliente.storage.from('fotos-estado').remove([`${corridaId}/${nome}`]);
        expect(await objetosDaCorrida(corridaId)).toHaveLength(1);

        // Nenhuma guarda de fotos: entrega sem ter registrado nada pelo Guincheiro.
        await avancar(doGuincheiro, corridaId, 'entregue');
        const { data } = await admin()
          .from('corridas')
          .select('estado')
          .eq('id', corridaId)
          .single();
        expect(data?.estado).toBe('entregue');
        // Depois de entregue ainda dá para registrar (etapa "depois").
        await guincheiro.registrarFotoEstado(corridaId, imagem(), { etapa: 'depois' });
      }, 90_000);

      it('encerrar a Corrida sem nenhuma Foto de estado funciona', async () => {
        const { guincheiro, doGuincheiro, cliente, corridaId } = await corridaAceita();
        corridasCriadas.push(corridaId);
        for (const estado of ['a_caminho', 'no_local', 'carregado', 'entregue'] as const) {
          await avancar(doGuincheiro, corridaId, estado);
        }
        expect(await guincheiro.listarFotosEstado(corridaId)).toEqual([]);
        expect(await cliente.listarFotosEstado(corridaId)).toEqual([]);
      }, 90_000);
    });
  });

  it('código errado não entra', async () => {
    // Sem reenviar: o Auth limita um envio a cada 5 s por número (max_frequency).
    const { api } = novaApi();
    const erro = await api.confirmarCodigo(RAFAEL.telefone, '000000').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).motivo).toBe('codigo_invalido');
  });

  describe('Painel de operação (#41): entrada e leitura pela RLS de eh_operacao()', () => {
    function novoPainel() {
      const supabase = criarClienteApi({
        supabaseUrl: SUPABASE_URL!,
        supabaseAnonKey: SUPABASE_ANON_KEY!,
      });
      return { supabase, api: criarApiPainel(supabase) };
    }

    it('sem sessão, não há operador', async () => {
      const { api } = novoPainel();
      expect(await api.temSessao()).toBe(false);
      expect(await api.buscarMeuOperador()).toBeNull();
    });

    it('a operação do seed entra com o código de teste e lê o próprio nome', async () => {
      const { api } = novoPainel();
      await api.enviarCodigo(OPERACAO.telefone);
      await api.confirmarCodigo(OPERACAO.telefone, CODIGO_DE_TESTE);
      expect(await api.temSessao()).toBe(true);
      expect(await api.buscarMeuOperador()).toEqual({ nome: 'Operação Guinchei' });
    });

    it('código errado é recusado com codigo_invalido', async () => {
      const { api } = novoPainel();
      const erro = await api.confirmarCodigo(OPERACAO.telefone, '000000').catch((e: unknown) => e);
      expect((erro as ErroApi).motivo).toBe('codigo_invalido');
      expect(await api.temSessao()).toBe(false);
    });

    it('Cliente e Guincheiro entram no Auth, mas não são operador; sair encerra a sessão', async () => {
      for (const telefone of [RAFAEL.telefone, MARCOS_TELEFONE]) {
        const { api } = novoPainel();
        await api.confirmarCodigo(telefone, CODIGO_DE_TESTE);
        expect(await api.temSessao()).toBe(true);
        expect(await api.buscarMeuOperador()).toBeNull();
        await api.sair();
        expect(await api.temSessao()).toBe(false);
      }
    });

    it('a RLS deixa a operação ler o perfil de outra pessoa, e o Guincheiro não', async () => {
      const operacao = novoPainel();
      await operacao.api.confirmarCodigo(OPERACAO.telefone, CODIGO_DE_TESTE);
      const daOperacao = await operacao.supabase.from('perfis').select('nome').eq('id', RAFAEL.id);
      expect(daOperacao.data).toEqual([{ nome: 'Rafael Souza' }]);

      const guincheiro = novoPainel();
      await guincheiro.api.confirmarCodigo(MARCOS_TELEFONE, CODIGO_DE_TESTE);
      const doGuincheiro = await guincheiro.supabase
        .from('perfis')
        .select('nome')
        .eq('id', RAFAEL.id);
      expect(doGuincheiro.data).toEqual([]);
    });
  });

  describe('Homologação por item (#42): fila, decisão, auditoria e documento', () => {
    /** CNPJ válido novo a cada chamada: o teste cria Frotas próprias e roda de novo sem reset. */
    function cnpjNovo() {
      const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
      const digito = (digitos: number[], pesos: number[]) => {
        const resto = digitos.reduce((soma, d, i) => soma + d * pesos[i]!, 0) % 11;
        return resto < 2 ? 0 : 11 - resto;
      };
      const d1 = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
      const d2 = digito([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
      return [...base, d1, d2].join('');
    }

    /** Frota nova com itens pendentes, criada pelo servidor (o Paulo é o dono dos itens). */
    async function frotaComItens(
      tipos: ('alvara' | 'apolice_rc' | 'crlv')[],
      enviadoEm = new Date().toISOString(),
    ) {
      const servidor = admin();
      const { data: frota, error } = await servidor
        .from('frotas')
        .insert({ tipo: 'empresa', documento: cnpjNovo(), nome: `Frota de teste ${Date.now()}` })
        .select('id, nome')
        .single();
      if (error) throw error;
      const itens: string[] = [];
      for (const tipo of tipos) {
        const { data, error: erroItem } = await servidor
          .from('itens_homologacao')
          .insert({
            frota_id: frota.id,
            alvo: 'frota',
            alvo_id: frota.id,
            tipo,
            dono_id: PAULO.id,
            arquivo: `${PAULO.id}/${crypto.randomUUID()}.pdf`,
            enviado_em: enviadoEm,
          })
          .select('id')
          .single();
        if (erroItem) throw erroItem;
        itens.push(data.id);
      }
      return { frotaId: frota.id, nome: frota.nome, itens };
    }

    function novoPainel() {
      const supabase = criarClienteApi({
        supabaseUrl: SUPABASE_URL!,
        supabaseAnonKey: SUPABASE_ANON_KEY!,
      });
      return { supabase, api: criarApiPainel(supabase) };
    }

    async function operacao() {
      const { supabase, api } = novoPainel();
      await api.confirmarCodigo(OPERACAO.telefone, CODIGO_DE_TESTE);
      return { supabase, api };
    }

    const motivoDe = async (promessa: Promise<unknown>) =>
      ((await promessa.catch((e: unknown) => e)) as ErroApi).motivo;

    it('a fila lista só Frotas com item pendente, a de envio mais antigo primeiro', async () => {
      const antiga = await frotaComItens(['alvara', 'apolice_rc'], '2020-01-01T10:00:00Z');
      const nova = await frotaComItens(['alvara'], '2020-01-02T10:00:00Z');
      const { api } = await operacao();

      const fila = await api.listarFilaHomologacao();
      const ids = fila.map((f) => f.id);
      expect(ids.indexOf(antiga.frotaId)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(antiga.frotaId)).toBeLessThan(ids.indexOf(nova.frotaId));
      expect(fila.find((f) => f.id === antiga.frotaId)).toMatchObject({
        nome: antiga.nome,
        tipo: 'empresa',
        pendentes: 2,
      });
      expect(Date.parse(fila.find((f) => f.id === antiga.frotaId)!.enviadoEm)).toBe(
        Date.parse('2020-01-01T10:00:00Z'),
      );
      // Frota do seed sem item pendente (Reboque Planalto) não aparece.
      expect(ids).not.toContain('f0000000-0000-4000-8000-000000000001');
    });

    it('aprovar e recusar com motivo; a Frota sai da fila com todos os itens decididos', async () => {
      const { frotaId, itens } = await frotaComItens(['alvara', 'apolice_rc']);
      const { api, supabase } = await operacao();

      await api.aprovarItem(itens[0]!);
      expect((await api.listarFilaHomologacao()).find((f) => f.id === frotaId)?.pendentes).toBe(1);

      expect(await motivoDe(api.recusarItem(itens[1]!, '   '))).toBe('motivo_obrigatorio');
      await api.recusarItem(itens[1]!, 'Apólice sem a plataforma como cossegurada');
      expect((await api.listarFilaHomologacao()).map((f) => f.id)).not.toContain(frotaId);

      const frota = await api.buscarFrotaHomologacao(frotaId);
      expect(frota?.itens.map((i) => [i.tipo, i.estado, i.motivo])).toEqual([
        ['alvara', 'aprovado', null],
        ['apolice_rc', 'recusado', 'Apólice sem a plataforma como cossegurada'],
      ]);

      // A trilha: entrada e decisão de cada item, com quem decidiu.
      const trilha = await supabase
        .from('auditoria_homologacao')
        .select('de, para, motivo, por')
        .in('item_id', itens)
        .order('id');
      expect(trilha.data?.map((l) => [l.de, l.para, l.motivo, l.por])).toEqual([
        [null, 'pendente', null, null],
        [null, 'pendente', null, null],
        ['pendente', 'aprovado', null, OPERACAO.id],
        ['pendente', 'recusado', 'Apólice sem a plataforma como cossegurada', OPERACAO.id],
      ]);
    });

    it('item já decidido ou vencido não volta a ser decidido sem reenvio', async () => {
      const { itens } = await frotaComItens(['alvara', 'apolice_rc']);
      const { api } = await operacao();
      await api.aprovarItem(itens[0]!);
      await api.recusarItem(itens[1]!, 'Ilegível');

      expect(await motivoDe(api.aprovarItem(itens[0]!))).toBe('transicao_invalida');
      expect(await motivoDe(api.aprovarItem(itens[1]!))).toBe('transicao_invalida');
      expect(await motivoDe(api.recusarItem(itens[1]!, 'De novo'))).toBe('transicao_invalida');

      const servidor = admin();
      await servidor
        .from('itens_homologacao')
        .update({ validade: '2020-01-01' })
        .eq('id', itens[0]!);
      await servidor.rpc('marcar_itens_vencidos');
      expect(await motivoDe(api.aprovarItem(itens[0]!))).toBe('transicao_invalida');
      const lido = await servidor
        .from('itens_homologacao')
        .select('estado')
        .eq('id', itens[0]!)
        .single();
      expect(lido.data?.estado).toBe('vencido');
    });

    it('item inexistente é item_indisponivel', async () => {
      const { api } = await operacao();
      expect(await motivoDe(api.aprovarItem(crypto.randomUUID()))).toBe('item_indisponivel');
    });

    it('o dono do item e o Guincheiro de outra Frota não decidem nem leem a trilha', async () => {
      const { itens } = await frotaComItens(['alvara']);
      for (const telefone of [PAULO.telefone, MARCOS_TELEFONE]) {
        const { api, supabase } = novoPainel();
        await api.confirmarCodigo(telefone, CODIGO_DE_TESTE);
        expect(await motivoDe(api.aprovarItem(itens[0]!))).toBe('sem_permissao');
        expect(await motivoDe(api.recusarItem(itens[0]!, 'x'))).toBe('sem_permissao');
        const direto = await supabase
          .from('itens_homologacao')
          .update({ estado: 'aprovado' })
          .eq('id', itens[0]!);
        expect(direto.error?.code).toBe('42501');
        const apagar = await supabase
          .from('auditoria_homologacao')
          .delete()
          .eq('item_id', itens[0]!);
        expect(apagar.error?.code).toBe('42501');
        const trilha = await supabase.from('auditoria_homologacao').select('id');
        expect(trilha.data).toEqual([]);
      }
      const estado = await admin().from('itens_homologacao').select('estado').eq('id', itens[0]!);
      expect(estado.data).toEqual([{ estado: 'pendente' }]);
    });

    it('o documento abre por URL assinada de curta duração, só para o dono e a operação', async () => {
      const dono = novoPainel();
      await dono.api.confirmarCodigo(PAULO.telefone, CODIGO_DE_TESTE);
      const caminho = `${PAULO.id}/${crypto.randomUUID()}.pdf`;
      const pdf = new Blob([new Uint8Array([37, 80, 68, 70, 45])], { type: 'application/pdf' });
      const envio = await dono.supabase.storage
        .from('documentos-prestadores')
        .upload(caminho, pdf, { contentType: 'application/pdf' });
      expect(envio.error).toBeNull();

      const { itens } = await frotaComItens(['alvara']);
      await admin().from('itens_homologacao').update({ arquivo: caminho }).eq('id', itens[0]!);

      const { api } = await operacao();
      const url = await api.urlDoDocumento(itens[0]!);
      const resposta = await fetch(url);
      expect(resposta.ok).toBe(true);
      expect((await resposta.arrayBuffer()).byteLength).toBe(5);

      // A URL expira em 5 minutos (campo exp do token).
      const token = /[?&]token=([^&]+)/.exec(url)![1]!;
      const carga = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(carga)) as { exp: number };
      const restante = exp - Date.now() / 1000;
      expect(restante).toBeGreaterThan(0);
      expect(restante).toBeLessThanOrEqual(VALIDADE_URL_DOCUMENTO_SEGUNDOS + 5);

      // O dono assina o próprio arquivo; outro Guincheiro, não.
      const doDono = await dono.supabase.storage
        .from('documentos-prestadores')
        .createSignedUrl(caminho, 60);
      expect(doDono.error).toBeNull();
      const outro = novoPainel();
      await outro.api.confirmarCodigo(MARCOS_TELEFONE, CODIGO_DE_TESTE);
      const negado = await outro.supabase.storage
        .from('documentos-prestadores')
        .createSignedUrl(caminho, 60);
      expect(negado.data).toBeNull();
      expect(negado.error).not.toBeNull();
      expect(await motivoDe(outro.api.urlDoDocumento(itens[0]!))).toBe('item_indisponivel');
    });

    it('documento que não está no bucket é "indisponível", sem derrubar a tela', async () => {
      const { itens } = await frotaComItens(['crlv']);
      const { api } = await operacao();
      expect(await motivoDe(api.urlDoDocumento(itens[0]!))).toBe('falha');
    });
  });

  describe('Cliente novo (sem perfil)', () => {
    beforeAll(async () => {
      if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('defina SUPABASE_SERVICE_ROLE_KEY');
      const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      const { data } = await admin.auth.admin.listUsers();
      const anterior = data.users.find((u) => `+${u.phone}` === SEM_PERFIL);
      if (anterior) {
        await admin.from('pedidos').delete().eq('cliente_id', anterior.id);
        await admin.auth.admin.deleteUser(anterior.id);
      }
    });

    it('entra sem perfil, faz o cadastro urgente e abre um Pedido', async () => {
      const { api } = novaApi();
      await api.enviarCodigo(SEM_PERFIL);
      await api.confirmarCodigo(SEM_PERFIL, CODIGO_DE_TESTE);
      expect(await api.buscarMeuPerfil()).toBeNull();

      const cpfDoRafael = await api
        .criarPerfilUrgente({ nome: 'Ana Lima', cpf: '12345678062', termosVersao: 'v-teste' })
        .catch((e: unknown) => e);
      expect((cpfDoRafael as ErroApi).motivo).toBe('cpf_ja_cadastrado');

      const perfil = await api.criarPerfilUrgente({
        nome: 'Ana Lima',
        cpf: '52998224725',
        termosVersao: 'v-teste',
      });
      expect(perfil).toMatchObject({
        papel: 'cliente',
        nome: 'Ana Lima',
        telefone: '5561900000006',
        aceite_termos_versao: 'v-teste',
      });
      expect(await api.buscarMeuPerfil()).toEqual(perfil);

      await expect(
        api.abrirPedido({ tipoVeiculo: 'carro', situacao: 'nao_liga', rodasGiram: 'nao' }),
      ).resolves.toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
