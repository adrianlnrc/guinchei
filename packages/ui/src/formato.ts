const reais = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const km = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 29762 → "R$ 297,62" */
export function formatarReais(centavos: number): string {
  return `R$ ${reais.format(centavos / 100)}`;
}

/** 29762 → { inteiro: "R$ 297", centavos: ",62" }, para o número-herói */
export function partesReais(centavos: number): { inteiro: string; centavos: string } {
  const [inteiro, decimal] = reais.format(centavos / 100).split(',');
  return { inteiro: `R$ ${inteiro}`, centavos: `,${decimal}` };
}

/** 4.2 → "4,2 km" */
export function formatarKm(valor: number): string {
  return `${km.format(valor)} km`;
}

/** 0.15 → "15%" */
export function formatarPercentual(fracao: number): string {
  return `${Math.round(fracao * 100)}%`;
}

/** Date → "21:47" */
export function formatarHora(data: Date): string {
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}
