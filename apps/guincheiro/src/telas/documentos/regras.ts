import { ErroApi, TAMANHO_MAXIMO_DOCUMENTO_BYTES, type ItemHomologacao } from '@guinchei/api';
import { CATEGORIAS_CNH, CATEGORIAS_SEM_REBOQUE } from '@guinchei/cnh';
import { cnhNumeroValido, validadeDosAntecedentes } from '@guinchei/documentos';
import { dataIso, formatarData } from '../cadastro/regras';

export type TipoDeDocumento = 'cnh' | 'antecedentes' | 'selfie';

export const NOME_DO_DOCUMENTO: Record<TipoDeDocumento, string> = {
  cnh: 'CNH',
  antecedentes: 'Certidão de antecedentes',
  selfie: 'Selfie',
};

/** Categorias que o formulário oferece: as que conduzem veículo de carga (A e ACC ficam de fora). */
export const CATEGORIAS_DO_FORMULARIO = CATEGORIAS_CNH.filter(
  (c) => !(CATEGORIAS_SEM_REBOQUE as readonly string[]).includes(c),
);

export const LIMITE_EM_MB = TAMANHO_MAXIMO_DOCUMENTO_BYTES / (1024 * 1024);

/** Estado de um documento na tela: o de homologação ou "ainda não enviado". */
export type SituacaoDoDocumento = ItemHomologacao['estado'] | 'nao_enviado';

export const NOME_DA_SITUACAO: Record<SituacaoDoDocumento, string> = {
  nao_enviado: 'Não enviado',
  pendente: 'Em análise',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  vencido: 'Vencido',
};

/** Pode (re)enviar: ainda não enviou, ou a operação recusou, ou a validade passou. */
export const podeEnviar = (situacao: SituacaoDoDocumento) =>
  situacao === 'nao_enviado' || situacao === 'recusado' || situacao === 'vencido';

export const situacaoDe = (item: ItemHomologacao | null): SituacaoDoDocumento =>
  item ? item.estado : 'nao_enviado';

export interface FormularioDeCnh {
  numero: string;
  categoria: string;
  validade: string;
  ear: boolean;
  arquivo: File | null;
}

/**
 * Mensagem para o que o formulário da CNH recusa; `null` quando serve. O servidor confere de
 * novo no envio (a validade, em Brasília).
 */
export function erroDaCnh(f: FormularioDeCnh, hoje: Date = new Date()): string | null {
  if (!cnhNumeroValido(f.numero))
    return 'O número da CNH tem 11 dígitos. Confira e digite de novo.';
  if (!f.categoria) return 'Escolha a categoria que está na sua CNH.';
  if (!f.validade) return 'Informe a validade da CNH.';
  if (f.validade < dataIso(hoje)) {
    return `A CNH venceu em ${formatarData(f.validade)}. Renove a CNH antes de enviar.`;
  }
  if (!f.ear) {
    return 'O Guinchei só aceita CNH com a observação EAR (exerce atividade remunerada). Peça a inclusão ao Detran-DF e envie de novo.';
  }
  if (!f.arquivo) return 'Anexe a foto da CNH.';
  return null;
}

/** Mensagem para a emissão que o formulário recusa (futura ou de mais de 12 meses); `null` serve. */
export function erroDaEmissao(emissao: string, hoje: Date = new Date()): string | null {
  if (!emissao) return 'Informe a data de emissão da certidão.';
  const hojeIso = dataIso(hoje);
  const validade = validadeDosAntecedentes(emissao);
  if (!validade) return 'A data de emissão não é válida.';
  if (emissao > hojeIso) return 'A data de emissão não pode ser no futuro.';
  if (validade < hojeIso) {
    return `A certidão foi emitida em ${formatarData(emissao)}, há mais de 12 meses, e não vale mais. Emita uma nova na PCDF e na Polícia Federal.`;
  }
  return null;
}

/** A mensagem que a pessoa lê quando o envio de um documento falha. */
export function mensagemDoEnvio(e: unknown): string {
  if (!(e instanceof ErroApi)) return 'Não foi possível enviar. Tente de novo.';
  switch (e.motivo) {
    case 'arquivo_invalido':
    case 'arquivo_grande':
    case 'cnh_invalida':
    case 'cnh_vencida':
    case 'cnh_sem_ear':
    case 'cnh_ja_cadastrada':
    case 'documento_ja_enviado':
    case 'emissao_invalida':
    case 'antecedentes_vencidos':
    case 'documento_ausente':
      return e.message;
    case 'sem_permissao':
      return 'Só o Guincheiro envia os próprios documentos. Entre de novo.';
    default:
      return `Não foi possível enviar. Use um PDF ou uma foto de até ${LIMITE_EM_MB} MB e tente de novo.`;
  }
}
