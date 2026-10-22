// CPF e CNPJ (ADR-0010, ADR-0012). Mesmas regras de public.cpf_valido e public.cnpj_valido no
// banco: o app recusa antes de enviar e o banco garante.

/** 11 dígitos sem máscara, não todos iguais, com os dois dígitos verificadores corretos. */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const d = [...cpf].map(Number);
  const verificador = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += d[i]! * (n + 1 - i);
    return ((soma * 10) % 11) % 10;
  };
  return verificador(9) === d[9] && verificador(10) === d[10];
}

const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * 14 caracteres sem máscara. Aceita o CNPJ alfanumérico (IN RFB 2.229/2024): as 12 primeiras
 * posições podem ser [0-9A-Z], valendo o código ASCII menos 48; os dois verificadores são
 * numéricos (módulo 11).
 */
export function cnpjValido(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const v = [...cnpj].map((c) => c.charCodeAt(0) - 48);
  const verificador = (pesos: number[]) => {
    const soma = pesos.reduce((s, peso, i) => s + v[i]! * peso, 0);
    return soma % 11 < 2 ? 0 : 11 - (soma % 11);
  };
  return verificador(PESOS_CNPJ_1) === v[12] && verificador(PESOS_CNPJ_2) === v[13];
}

/** CPF (11 dígitos) ou CNPJ (14 caracteres) válido: o documento do autônomo ou do MEI. */
export function documentoValido(documento: string): boolean {
  return cpfValido(documento) || cnpjValido(documento);
}

/** "52998224725" → "529.982.247-25" */
export function mascararCpf(digitos: string): string {
  const d = digitos.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** "11222333000181" → "11.222.333/0001-81"; letras do CNPJ alfanumérico ficam em maiúsculas. */
export function mascararCnpj(texto: string): string {
  const c = texto
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 14);
  const partes = [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8, 12), c.slice(12)];
  const [a, b, d, e, f] = partes;
  return [a, b && `.${b}`, d && `.${d}`, e && `/${e}`, f && `-${f}`].filter(Boolean).join('');
}

/** "70000000" → "70000-000" */
export function mascararCep(digitos: string): string {
  const d = digitos.replace(/\D/g, '').slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, '$1-$2');
}

/**
 * 8 dígitos sem máscara, não todos iguais. Mesma regra de `perfis_cep_check`; não restringe
 * ao DF (a praça do Pedido é outra regra, ADR-0001).
 */
export function cepValido(cep: string): boolean {
  return /^\d{8}$/.test(cep) && !/^(\d)\1{7}$/.test(cep);
}

/** Formato simples, o mesmo de `perfis_email_check`: algo@dominio.ext, sem espaços. */
export function emailValido(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
