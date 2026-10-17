import { describe, expect, it } from 'vitest';
import { criarClienteApi } from './index';

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
});
