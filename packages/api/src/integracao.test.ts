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
import { beforeAll, describe, expect, it } from 'vitest';
import { criarApi, criarClienteApi, ErroApi } from './index';

declare const process: { env: Record<string, string | undefined> };
declare const console: { info(mensagem: string): void };
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
      expect(confirmado).toEqual({ estado: 'confirmado', preco_total: cotacao.preco.total });

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
