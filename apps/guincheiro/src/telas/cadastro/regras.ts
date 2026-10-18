import { DIAS_MINIMOS_VALIDADE_APOLICE } from '@guinchei/api';

/** AAAA-MM-DD, pelo calendário do aparelho (o servidor confere de novo, em Brasília). */
function dataIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** "2026-11-17" → "17/11/2026" */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** A menor validade que a apólice pode ter hoje: daqui a 30 dias (ADR-0007). */
export function validadeMinimaDaApolice(hoje: Date = new Date()): string {
  return dataIso(
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + DIAS_MINIMOS_VALIDADE_APOLICE),
  );
}

/**
 * Mensagem para a apólice que o formulário recusa: já vencida ou a vencer em menos de 30 dias.
 * `null` quando a validade serve. O servidor confere de novo na hora de enviar.
 */
export function erroDaValidadeDaApolice(validade: string, hoje: Date = new Date()): string | null {
  const minima = validadeMinimaDaApolice(hoje);
  if (validade >= minima) return null;
  const orientacao = `Envie uma apólice com validade a partir de ${formatarData(minima)}.`;
  return validade < dataIso(hoje)
    ? `A apólice está vencida. ${orientacao}`
    : `A apólice vence em menos de ${DIAS_MINIMOS_VALIDADE_APOLICE} dias. ${orientacao}`;
}
