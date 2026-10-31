import { describe, expect, it } from 'vitest';
import {
  cnpjValido,
  cpfValido,
  documentoValido,
  mascararCep,
  mascararCnpj,
  mascararCpf,
  mascararPlaca,
  normalizarPlaca,
  normalizarRenavam,
  placaValida,
  renavamValido,
} from './index';

describe('placa', () => {
  it('normaliza e valida os dois padrões', () => {
    expect(normalizarPlaca('abc-1d23')).toBe('ABC1D23');
    expect(placaValida('ABC1234')).toBe(true);
    expect(placaValida('ABC1D23')).toBe(true);
    expect(placaValida('AB12345')).toBe(false);
    expect(placaValida('ABC12D3')).toBe(false);
    expect(placaValida('abc1234')).toBe(false);
    expect(placaValida('ABC-1234')).toBe(false);
  });

  it('mascara com hífen depois da terceira letra', () => {
    expect(mascararPlaca('abc1d23')).toBe('ABC-1D23');
    expect(mascararPlaca('ab')).toBe('AB');
    expect(mascararPlaca('abc1d2345')).toBe('ABC-1D23');
  });
});

describe('RENAVAM', () => {
  it('valida o dígito verificador', () => {
    expect(renavamValido('63936443047')).toBe(true);
    expect(renavamValido('12345678900')).toBe(true);
    expect(renavamValido('63936443048')).toBe(false);
    expect(renavamValido('00000000000')).toBe(false);
    expect(renavamValido('6393644304')).toBe(false);
  });

  it('preenche com zeros os números de 9 e 10 dígitos', () => {
    expect(normalizarRenavam('9876543216')).toBe('09876543216');
    expect(renavamValido(normalizarRenavam('9876543216'))).toBe(true);
    expect(normalizarRenavam('6393.6443-047')).toBe('63936443047');
  });
});

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
