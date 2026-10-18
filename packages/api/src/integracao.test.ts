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
  criarClienteApi,
  ErroApi,
  type ApiGuinchei,
  type ApiGuincheiro,
} from './index';

declare const process: { env: Record<string, string | undefined> };
declare const console: { info(mensagem: string): void };
declare function setTimeout(fazer: () => void, ms: number): unknown;
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
/**
 * Diz ao teste com que configuração as Edge Functions estão rodando: com `1`, elas foram
 * servidas com `--env-file supabase/testes-recusa.env` e o mock recusa valores terminados
 * em 99 centavos; sem ela, o padrão (nunca recusa).
 */
const RECUSA_LIGADA = process.env.PAGAMENTO_MOCK_RECUSA_TESTE === '1';

const CODIGO_DE_TESTE = '123456';
const RAFAEL = { telefone: '+5561900000001', id: '11111111-1111-4111-8111-111111111111' };
const SEM_PERFIL = '+5561900000006';

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

    // Quem aceita fica indisponível; cada teste começa com os três disponíveis.
    afterEach(async () => {
      await admin().from('guincheiros').update({ disponivel: true }).in('id', GUINCHEIROS);
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
    function ofertaDoPedido(guincheiro: ApiGuinchei, pedidoId: string) {
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
        await admin()
          .from('parametros_match')
          .update({ timeout_oferta_segundos: TIMEOUT_DO_BLOCO_S })
          .eq('id', true);
      });
      afterAll(async () => {
        await admin()
          .from('parametros_match')
          .update({ timeout_oferta_segundos: TIMEOUT_DE_TESTE_S })
          .eq('id', true);
      });

      async function entrarComoGuincheiro(telefone: string) {
        const supabase = criarClienteApi({
          supabaseUrl: SUPABASE_URL!,
          supabaseAnonKey: SUPABASE_ANON_KEY!,
        });
        const api = criarApiGuincheiro(supabase);
        await api.confirmarCodigo(telefone, CODIGO_DE_TESTE);
        return api;
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
        const [marcos, wagner] = await Promise.all([
          entrarComoGuincheiro(MARCOS.telefone),
          entrarComoGuincheiro(WAGNER.telefone),
        ]);
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
        const doWagner = await assinarEContar(wagner);
        try {
          const { id } = await pedidoConfirmado();
          // O Marcos, o mais perto, recebe a oferta pelo Realtime, sem consultar antes.
          await esperar(async () => doMarcos.avisos() > 0, 'evento da oferta no Realtime');
          const [oferta] = (await marcos.buscarOfertasAbertas()).filter((o) => o.pedidoId === id);
          expect(oferta).toBeDefined();

          // Pela hora do servidor, a oferta vence dentro do prazo do bloco.
          const agora = Date.parse(await marcos.horaDoServidor());
          expect(Date.parse(oferta!.expiraEm) - agora).toBeGreaterThan(0);
          expect(Date.parse(oferta!.expiraEm) - agora).toBeLessThanOrEqual(
            TIMEOUT_DO_BLOCO_S * 1000,
          );

          const corridaId = await marcos.aceitarOferta(oferta!.tentativaId);
          // A RLS vale no Realtime: o Wagner não recebeu nada da oferta do Marcos.
          expect(doWagner.avisos()).toBe(0);
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
              repasse: oferta!.repasse,
              precoRecalculado: oferta!.precoRecalculado,
              pedido: { origemEndereco: 'Eixo Monumental, Brasília' },
            });

            const pulo = await marcos.avancarCorrida(corridaId, 'no_local').catch((e) => e);
            expect((pulo as ErroApi).motivo).toBe('transicao_invalida');
            const alheia = await wagner.avancarCorrida(corridaId, 'a_caminho').catch((e) => e);
            expect((alheia as ErroApi).motivo).toBe('corrida_indisponivel');

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
            repasse: oferta!.repasse,
          });
        } finally {
          doMarcos.cancelar();
          doWagner.cancelar();
        }
      }, 60_000);

      it('o Cliente não é Guincheiro: o perfil diz o papel', async () => {
        const rafael = await entrarComoGuincheiro(RAFAEL.telefone);
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
  });

  it('código errado não entra', async () => {
    // Sem reenviar: o Auth limita um envio a cada 5 s por número (max_frequency).
    const { api } = novaApi();
    const erro = await api.confirmarCodigo(RAFAEL.telefone, '000000').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).motivo).toBe('codigo_invalido');
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
