/** "61900000002" → "+5561900000002" (E.164, como o Supabase Auth recebe). */
export function telefoneE164(celular: string): string {
  return `+55${celular.replace(/\D/g, '')}`;
}

/** "61900000002" → "(61) 90000-0002" */
export function mascararCelular(digitos: string): string {
  const d = digitos.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
