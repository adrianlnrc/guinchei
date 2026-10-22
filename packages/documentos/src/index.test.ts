import { describe, expect, it } from 'vitest';
import {
  cepValido,
  cnpjValido,
  cpfValido,
  documentoValido,
  emailValido,
  mascararCep,
  mascararCnpj,
  mascararCpf,
} from './index';

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

// Mesmos casos de supabase/tests/documentos.test.sql: a regra é a de public.cnpj_valido.
describe('cnpjValido', () => {
  it('aceita CNPJ numérico e alfanumérico (IN RFB 2.229/2024) com os verificadores corretos', () => {
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('45723174000110')).toBe(true);
    expect(cnpjValido('12ABC34501DE35')).toBe(true);
  });

  it('recusa dígito verificador errado', () => {
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('12ABC34501DE36')).toBe(false);
  });

  it('recusa todos os dígitos iguais, máscara, letra minúscula e tamanho errado', () => {
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('11.222.333/0001-81')).toBe(false);
    expect(cnpjValido('12abc34501de35')).toBe(false);
    expect(cnpjValido('1122233300018')).toBe(false);
  });
});

describe('documentoValido', () => {
  it('aceita CPF ou CNPJ (autônomo ou MEI) e recusa o resto', () => {
    expect(documentoValido('52998224725')).toBe(true);
    expect(documentoValido('45723174000110')).toBe(true);
    expect(documentoValido('123')).toBe(false);
    expect(documentoValido('')).toBe(false);
  });
});

describe('máscaras', () => {
  it('mascararCnpj formata enquanto digita', () => {
    expect(mascararCnpj('11')).toBe('11');
    expect(mascararCnpj('112223')).toBe('11.222.3');
    expect(mascararCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(mascararCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
  });

  it('mascararCep formata enquanto digita', () => {
    expect(mascararCep('70')).toBe('70');
    expect(mascararCep('70000000')).toBe('70000-000');
    expect(mascararCep('70.000-000999')).toBe('70000-000');
  });
});

describe('cepValido', () => {
  it('aceita 8 dígitos, de qualquer UF', () => {
    expect(cepValido('70040010')).toBe(true);
    expect(cepValido('01310100')).toBe(true);
  });

  it('recusa dígitos todos iguais, tamanho errado, máscara e letras', () => {
    expect(cepValido('11111111')).toBe(false);
    expect(cepValido('00000000')).toBe(false);
    expect(cepValido('7004001')).toBe(false);
    expect(cepValido('700400100')).toBe(false);
    expect(cepValido('70040-010')).toBe(false);
    expect(cepValido('7004001a')).toBe(false);
  });
});

describe('emailValido', () => {
  it('aceita o formato simples', () => {
    expect(emailValido('ana@exemplo.com.br')).toBe(true);
  });

  it('recusa sem arroba, sem domínio com ponto ou com espaço', () => {
    expect(emailValido('ana')).toBe(false);
    expect(emailValido('ana@exemplo')).toBe(false);
    expect(emailValido('ana @exemplo.com')).toBe(false);
    expect(emailValido('@exemplo.com')).toBe(false);
  });
});
