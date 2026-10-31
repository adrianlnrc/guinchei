import { PBT_MAXIMO_KG, PBT_MINIMO_KG, type TipoVeiculoGuincho } from '@guinchei/api';
import {
  normalizarPlaca,
  normalizarRenavam,
  placaValida,
  renavamValido,
} from '@guinchei/documentos';

export const NOME_DO_TIPO: Record<TipoVeiculoGuincho, string> = {
  plataforma: 'Plataforma',
  asa_delta: 'Asa-delta',
  lanca: 'Lança',
};

export const TIPOS: TipoVeiculoGuincho[] = ['plataforma', 'asa_delta', 'lanca'];

/** `null` quando a placa serve (padrão antigo ou Mercosul). O servidor confere de novo. */
export function erroDaPlaca(texto: string): string | null {
  return placaValida(normalizarPlaca(texto))
    ? null
    : 'Placa inválida. Use o padrão antigo (ABC-1234) ou o Mercosul (ABC-1D23).';
}

/** RENAVAM de 9 a 11 dígitos com o dígito verificador certo. */
export function erroDoRenavam(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '');
  return digitos.length >= 9 && digitos.length <= 11 && renavamValido(normalizarRenavam(digitos))
    ? null
    : 'RENAVAM inválido. Confira os números.';
}

/** O PBT é um número inteiro de kg, dentro da faixa que o banco aceita. */
export function erroDoPbt(texto: string): string | null {
  const kg = Number(texto);
  return /^\d+$/.test(texto) && kg >= PBT_MINIMO_KG && kg <= PBT_MAXIMO_KG
    ? null
    : `Informe o PBT em kg, de ${PBT_MINIMO_KG} a ${PBT_MAXIMO_KG}.`;
}

/** "4500" → "4.500 kg" */
export function formatarPbt(kg: number): string {
  return `${new Intl.NumberFormat('pt-BR').format(kg)} kg`;
}
