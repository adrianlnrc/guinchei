import { describe, expect, it } from 'vitest';
import { criarClienteApi, lerPontoDoBanco } from './index';

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

describe('lerPontoDoBanco', () => {
  it('lê o ponto em EWKB hexadecimal, como o PostgREST devolve a geography', () => {
    const ponto = lerPontoDoBanco('0101000020E61000007C61325530F247C0BF0E9C33A2942FC0');
    expect(ponto?.lng).toBeCloseTo(-47.8921, 6);
    expect(ponto?.lat).toBeCloseTo(-15.7903, 6);
  });

  it('lê GeoJSON', () => {
    expect(lerPontoDoBanco({ type: 'Point', coordinates: [-47.8921, -15.7903] })).toEqual({
      lat: -15.7903,
      lng: -47.8921,
    });
  });

  it('devolve null para o que não é um ponto', () => {
    expect(lerPontoDoBanco(null)).toBeNull();
    expect(lerPontoDoBanco('POINT(1 2)')).toBeNull();
    expect(lerPontoDoBanco('0102000020E6100000')).toBeNull();
    expect(lerPontoDoBanco({ type: 'Polygon', coordinates: [] })).toBeNull();
  });
});
