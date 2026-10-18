// CPF no cadastro urgente (ADR-0010). Mesma regra de public.cpf_valido no banco: o app
// recusa antes de enviar e o banco garante.

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

/** "52998224725" → "529.982.247-25" */
export function mascararCpf(digitos: string): string {
  const d = digitos.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}
