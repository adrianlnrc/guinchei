import { describe, expect, it, vi } from 'vitest';
import { criarApi, criarClienteApi, ErroApi, type ClienteSupabase } from './index';

describe('@guinchei/api', () => {
  it('cria o cliente Supabase', () => {
    const cliente = criarClienteApi({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseAnonKey: 'chave-de-teste',
    });
    expect(cliente.auth).toBeDefined();
  });

  it('recusa configuração vazia', () => {
    expect(() => criarClienteApi({ supabaseUrl: '', supabaseAnonKey: '' })).toThrow();
  });

  describe('atualizarMeuCadastro', () => {
    /** Cliente Supabase de mentira: só a chamada de função do cadastro. */
    function apiComRpc(resposta: { data: unknown; error: unknown }) {
      const rpc = vi.fn(async () => resposta);
      return { rpc, api: criarApi({ rpc } as unknown as ClienteSupabase) };
    }

    it('chama a função do banco; e-mail ausente vira vazio', async () => {
      const perfil = { id: 'p1', nome: 'Ana Lima', cep: '70040010', email: null };
      const { rpc, api } = apiComRpc({ data: perfil, error: null });
      await expect(api.atualizarMeuCadastro({ nome: 'Ana Lima', cep: '70040010' })).resolves.toBe(
        perfil,
      );
      expect(rpc).toHaveBeenCalledWith('atualizar_cadastro_cliente', {
        nome: 'Ana Lima',
        cep: '70040010',
        email: '',
      });
    });

    it.each([
      ['perfis_cep_check', 'cep_invalido'],
      ['perfis_email_check', 'email_invalido'],
    ])('traduz a violação de %s em %s', async (constraint, motivo) => {
      const { api } = apiComRpc({
        data: null,
        error: { code: '23514', message: `violates check constraint "${constraint}"` },
      });
      const erro = await api
        .atualizarMeuCadastro({ nome: 'Ana', cep: '11111111', email: 'x' })
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroApi);
      expect((erro as ErroApi).motivo).toBe(motivo);
    });

    it('outro erro vira falha', async () => {
      const { api } = apiComRpc({ data: null, error: { code: '42501', message: 'negado' } });
      const erro = await api.atualizarMeuCadastro({ nome: 'Ana', cep: '70040010' }).catch((e) => e);
      expect((erro as ErroApi).motivo).toBe('falha');
    });
  });
});
