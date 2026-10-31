/** Primeiro acesso do convidado: nome, CPF e aceite dos termos de uso (#46). */
export const ROTA_DADOS_PESSOAIS = '/guincheiro/dados';

/**
 * Etapa de documentos do Guincheiro (#47): o resumo do que falta, o que a operação está
 * conferindo e o que foi recusado. É a que vem depois dos dados pessoais.
 */
export const ROTA_DOCUMENTOS = '/guincheiro/documentos';

/** Uma tela por documento: CNH, certidão de antecedentes e selfie. */
export const ROTA_DOCUMENTOS_CNH = '/guincheiro/documentos/cnh';
export const ROTA_DOCUMENTOS_ANTECEDENTES = '/guincheiro/documentos/antecedentes';
export const ROTA_DOCUMENTOS_SELFIE = '/guincheiro/documentos/selfie';

/**
 * Reenvio da apólice de responsabilidade civil vencida, pelo representante (#49). O item da
 * apólice vem na rota; o Guincheiro reenvia CNH e certidão pelas telas de documentos.
 */
export const ROTA_APOLICE = '/frota/apolice/:itemId';
export const rotaDaApolice = (itemId: string) => `/frota/apolice/${encodeURIComponent(itemId)}`;

/** Gestão de convites e Guincheiros da Frota, para o representante (#46). */
export const ROTA_CONVITES = '/frota/convites';

/** Quem dirige cada veículo: vínculos Guincheiro × veículo, para o representante (#48). */
export const ROTA_VINCULOS = '/frota/vinculos';
