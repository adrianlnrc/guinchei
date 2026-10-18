import { describe, expect, it } from 'vitest';
import { cpfValido, mascararCpf } from './cpf';

// Mesmos casos de supabase/tests/documentos.test.sql: a regra é a de public.cpf_valido.
describe('cpfValido', () => {
  it('aceita CPF com os dois dígitos verificadores corretos', () => {
    expect(cpfValido('12345678909')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('12345678062')).toBe(true);
  });

  it('recusa dígito verificador errado', () => {
    expect(cpfValido('12345678900')).toBe(false);
    expect(cpfValido('52998224724')).toBe(false);
  });

  it('recusa todos os dígitos iguais', () => {
    expect(cpfValido('11111111111')).toBe(false);
  });

  it('recusa máscara e tamanho errado (grava só os 11 dígitos)', () => {
    expect(cpfValido('123.456.789-09')).toBe(false);
    expect(cpfValido('1234567890')).toBe(false);
  });
});

describe('mascararCpf', () => {
  it('formata enquanto digita', () => {
    expect(mascararCpf('529')).toBe('529');
    expect(mascararCpf('5299822')).toBe('529.982.2');
    expect(mascararCpf('52998224725')).toBe('529.982.247-25');
  });
});
