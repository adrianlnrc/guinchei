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
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

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
