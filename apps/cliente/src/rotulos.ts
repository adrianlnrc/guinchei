import type { EtapaDoAcompanhamento } from '@guinchei/api';

/** Como cada etapa do Pedido aparece nas listas e nos cartões do Cliente. */
const ROTULOS_DA_ETAPA: Record<EtapaDoAcompanhamento, string> = {
  cotado: 'Não finalizado',
  em_match: 'Procurando guincho',
  aguardando_aprovacao_preco: 'Aguardando sua resposta',
  sem_guincheiro: 'Sem Guincheiro',
  estornado: 'Estornado',
  aceita: 'Guincheiro aceitou',
  a_caminho: 'Guincho a caminho',
  no_local: 'Guincho no local',
  carregado: 'Veículo carregado',
  entregue: 'Entregue',
};

export function rotuloDaEtapa(etapa: EtapaDoAcompanhamento): string {
  return ROTULOS_DA_ETAPA[etapa];
}

/**
 * Pedido que o Cliente ainda acompanha: pago e nem entregue nem estornado. Inclui
 * `sem_guincheiro`, que espera uma decisão dele (tentar de novo ou estornar).
 */
export function pedidoAtivo(etapa: EtapaDoAcompanhamento): boolean {
  return etapa !== 'cotado' && etapa !== 'estornado' && etapa !== 'entregue';
}

const formatoDaData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Sao_Paulo',
});

/** "2026-10-26T17:32:00Z" → "26/10/2026 · 14:32" (horário de Brasília). */
export function dataEHora(iso: string): string {
  const partes = Object.fromEntries(
    formatoDaData.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${partes.day}/${partes.month}/${partes.year} · ${partes.hour}:${partes.minute}`;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]!.toUpperCase())
    .join('');
}

/** "52998224725" → "***.***.***-25": nunca mostra o CPF inteiro. */
export function cpfMascarado(cpf: string): string {
  return `***.***.***-${cpf.replace(/\D/g, '').slice(-2)}`;
}
