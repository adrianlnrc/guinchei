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

/** A certidão de antecedentes vale 12 meses a partir da emissão (ADR-0012). */
export const MESES_DE_VALIDADE_DOS_ANTECEDENTES = 12;

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Último dia de validade da certidão de antecedentes: o mesmo dia, 12 meses depois da emissão
 * (29/02 vira 28/02). Datas em AAAA-MM-DD, sem fuso. Mesma regra de
 * `public.validade_antecedentes` no banco. Devolve `null` se a entrada não é uma data válida.
 */
export function validadeDosAntecedentes(emissao: string): string | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(emissao);
  if (!partes) return null;
  const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  if (mes < 1 || mes > 12 || dia < 1 || dia > ultimoDiaDoMes(ano, mes)) return null;
  const novoAno = ano + MESES_DE_VALIDADE_DOS_ANTECEDENTES / 12;
  const novoDia = Math.min(dia, ultimoDiaDoMes(novoAno, mes));
  return [
    String(novoAno).padStart(4, '0'),
    String(mes).padStart(2, '0'),
    String(novoDia).padStart(2, '0'),
  ].join('-');
}

/** Só dígitos da CNH, no máximo 11. */
export function mascararCnh(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, 11);
}

/** O número da CNH tem 11 dígitos. */
export function cnhNumeroValido(numero: string): boolean {
  return /^\d{11}$/.test(numero);
}

// Placa e RENAVAM (ADR-0012, issue #45). Mesmas regras de public.placa_valida e
// public.renavam_valido no banco.

/** Placa sem hífen e em maiúsculas: "abc-1d23" → "ABC1D23". */
export function normalizarPlaca(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** AAA9999 (padrão antigo) ou AAA9A99 (Mercosul), já normalizada. */
export function placaValida(placa: string): boolean {
  return /^[A-Z]{3}\d{4}$/.test(placa) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(placa);
}

/** "abc1d23" → "ABC-1D23" (o hífen só aparece na máscara; o dado guardado não tem). */
export function mascararPlaca(texto: string): string {
  const p = normalizarPlaca(texto).slice(0, 7);
  return p.length > 3 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

/** Só dígitos, preenchidos com zeros à esquerda até 11 (RENAVAM de 9 ou 10 dígitos). */
export function normalizarRenavam(texto: string): string {
  return texto.replace(/\D/g, '').padStart(11, '0');
}

const PESOS_RENAVAM = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * RENAVAM de 11 dígitos (normalizado) com o dígito verificador correto: módulo 11, pesos
 * 3 2 9 8 7 6 5 4 3 2 nos dez primeiros. Não aceita todos os dígitos iguais.
 */
export function renavamValido(renavam: string): boolean {
  if (!/^\d{11}$/.test(renavam) || /^(\d)\1{10}$/.test(renavam)) return false;
  const soma = PESOS_RENAVAM.reduce((s, peso, i) => s + Number(renavam[i]) * peso, 0);
  return ((soma * 10) % 11) % 10 === Number(renavam[10]);
}
