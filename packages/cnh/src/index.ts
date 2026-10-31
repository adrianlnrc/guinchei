// Regra legal CNH × PBT (ADR-0012, CTB art. 143): o vínculo Guincheiro × veículo é bloqueado
// se a categoria da CNH não cobre o PBT do veículo. Este módulo é a fonte única da regra; o
// banco repete a mesma tabela de verdade na função `categoria_cnh_cobre_pbt` (migração
// `supabase/migrations/*_cnh_pbt.sql`) e `sincronia-sql.test.ts` falha se as duas divergirem.
//
// Em aberto (CONTEXT.md): confirmar resoluções CONTRAN específicas de guincho. Por isso o
// limite e as categorias abaixo são constantes nomeadas, fáceis de revisar.

/**
 * Categorias de CNH aceitas no cadastro do Guincheiro (ADR-0012), da menos à mais abrangente
 * para conduzir veículo de carga, mais as combinadas AB, AC, AD e AE (moto + carro ou caminhão),
 * comuns na CNH brasileira. A combinada vale pela parte B–E (AC cobre como C): veja
 * `CATEGORIA_DE_CARGA`. A entrada é normalizada com trim e maiúsculas ("ac " vale AC).
 */
export const CATEGORIAS_CNH = ['ACC', 'A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'] as const;
export type CategoriaCnh = (typeof CATEGORIAS_CNH)[number];

/** Categoria que vale para conduzir veículo de carga; as combinadas valem pela parte B–E. */
export const CATEGORIA_DE_CARGA: Record<CategoriaCnh, CategoriaCnh> = {
  ACC: 'ACC',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  AB: 'B',
  AC: 'C',
  AD: 'D',
  AE: 'E',
};

/**
 * Limite de PBT (kg) que a categoria B cobre, inclusive: CTB art. 143, ADR-0012. Acima dele o
 * veículo exige categoria C ou superior.
 */
export const LIMITE_PBT_CATEGORIA_B_KG = 3500;

/**
 * Categorias que não conduzem reboque de carga, qualquer que seja o PBT: A (moto) e ACC
 * (ciclomotor). C, D e E cobrem qualquer PBT acima do limite da B (CTB art. 143, ADR-0012).
 */
export const CATEGORIAS_SEM_REBOQUE = ['ACC', 'A'] as const;

/**
 * O Guincheiro precisa da observação EAR (exerce atividade remunerada) na CNH, qualquer que
 * seja a categoria (ADR-0012). É pré-condição separada: a homologação cobra categoria e EAR.
 */
export const EXIGE_EAR = true;

export type ResultadoCobertura =
  | { situacao: 'coberto'; motivo: string }
  | { situacao: 'nao_coberto'; motivo: string; categoriaMinima: CategoriaCnh }
  | { situacao: 'erro'; motivo: string };

function normalizarCategoria(valor: string): CategoriaCnh | undefined {
  const normalizada = valor.trim().toUpperCase();
  return (CATEGORIAS_CNH as readonly string[]).includes(normalizada)
    ? (normalizada as CategoriaCnh)
    : undefined;
}

/** 4200 → "4.200" (separador de milhar do pt-BR, sem depender do ICU do ambiente). */
function formatarKg(kg: number): string {
  return String(kg).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Esta categoria de CNH habilita conduzir um veículo com este PBT (kg)? Nunca lança:
 * categoria desconhecida e PBT que não seja um número finito maior que zero viram
 * `situacao: 'erro'`. O `motivo` está em linguagem do domínio, para a UI explicar.
 */
export function categoriaCobrePbt(categoria: string, pbtKg: number): ResultadoCobertura {
  if (!Number.isFinite(pbtKg) || pbtKg <= 0) {
    return { situacao: 'erro', motivo: 'PBT inválido: informe um peso em kg maior que zero' };
  }
  const informada = normalizarCategoria(categoria);
  if (!informada) {
    return { situacao: 'erro', motivo: `Categoria de CNH desconhecida: ${categoria}` };
  }
  const efetiva = CATEGORIA_DE_CARGA[informada];

  const acimaDoLimiteB = pbtKg > LIMITE_PBT_CATEGORIA_B_KG;
  const categoriaMinima: CategoriaCnh = acimaDoLimiteB ? 'C' : 'B';
  const peso = `${formatarKg(pbtKg)} kg`;

  if ((CATEGORIAS_SEM_REBOQUE as readonly string[]).includes(efetiva)) {
    const exigencia = acimaDoLimiteB
      ? 'categoria C ou superior'
      : `categoria B (até ${formatarKg(LIMITE_PBT_CATEGORIA_B_KG)} kg) ou superior`;
    return {
      situacao: 'nao_coberto',
      categoriaMinima,
      motivo: `CNH ${informada} não habilita conduzir guincho (reboque de carga): exige ${exigencia}`,
    };
  }
  if (efetiva === 'B' && acimaDoLimiteB) {
    return {
      situacao: 'nao_coberto',
      categoriaMinima,
      motivo: `CNH ${informada} não cobre guincho de ${peso}: exige categoria C ou superior`,
    };
  }
  return { situacao: 'coberto', motivo: `CNH ${informada} cobre guincho de ${peso}` };
}

export interface Cnh {
  categoria: string;
  /** Observação EAR (exerce atividade remunerada) presente na CNH. */
  ear: boolean;
}

export type Pendencia = { tipo: 'categoria'; motivo: string } | { tipo: 'ear'; motivo: string };

export interface ResultadoHabilitacao {
  apto: boolean;
  /** Tudo que falta, na ordem em que a homologação cobra: categoria, depois EAR. */
  pendencias: Pendencia[];
}

/**
 * A CNH habilita o Guincheiro a conduzir veículo com este PBT? Cobra as duas pré-condições
 * do ADR-0012 (categoria × PBT e EAR) e devolve todas as pendências de uma vez.
 */
export function cnhHabilitaConduzir(cnh: Cnh, pbtKg: number): ResultadoHabilitacao {
  const pendencias: Pendencia[] = [];
  const cobertura = categoriaCobrePbt(cnh.categoria, pbtKg);
  if (cobertura.situacao !== 'coberto') {
    pendencias.push({ tipo: 'categoria', motivo: cobertura.motivo });
  }
  if (EXIGE_EAR && !cnh.ear) {
    pendencias.push({
      tipo: 'ear',
      motivo: 'A CNH precisa da observação EAR (exerce atividade remunerada)',
    });
  }
  return { apto: pendencias.length === 0, pendencias };
}

/**
 * Situação de um vínculo Guincheiro × veículo (issue #48): `ativo` (CNH aprovada que cobre o
 * PBT), `pendente` (CNH ainda não aprovada: o vínculo é permitido e revalidado na aprovação) ou
 * `bloqueado` (CNH aprovada que não cobre o PBT: o vínculo é recusado). É o espelho da função
 * SQL `avaliar_vinculo`; o banco é a barreira real, e este módulo só serve para avisar antes.
 */
export type SituacaoDoVinculo = 'ativo' | 'pendente' | 'bloqueado';

export interface CnhParaVinculo {
  /** Categoria enviada pelo Guincheiro; `null` se ainda não enviou a CNH. */
  categoria: string | null;
  /** A operação já aprovou o item de CNH (e ele não venceu). */
  aprovada: boolean;
}

export interface AvaliacaoDoVinculo {
  situacao: SituacaoDoVinculo;
  /** Em linguagem do domínio, para a UI explicar o que acontece e por quê. */
  motivo: string;
  /** Só em `bloqueado` por categoria que não cobre: a menor categoria que cobriria o PBT. */
  categoriaMinima?: CategoriaCnh;
}

/**
 * O vínculo deste Guincheiro (pela CNH dele) a um veículo com este PBT é possível? CNH não
 * aprovada nunca bloqueia: fica pendente. CNH aprovada sem categoria legível bloqueia, como no
 * banco (só a cobertura confirmada libera).
 */
export function avaliarVinculo(cnh: CnhParaVinculo, pbtKg: number): AvaliacaoDoVinculo {
  if (!cnh.aprovada) {
    return {
      situacao: 'pendente',
      motivo: cnh.categoria
        ? 'A CNH ainda não foi aprovada pela operação. O vínculo fica pendente e é conferido quando ela for aprovada.'
        : 'O Guincheiro ainda não enviou a CNH. O vínculo fica pendente e é conferido quando a CNH for aprovada.',
    };
  }
  if (!cnh.categoria) {
    return { situacao: 'bloqueado', motivo: 'A CNH aprovada não informa a categoria' };
  }
  const cobertura = categoriaCobrePbt(cnh.categoria, pbtKg);
  if (cobertura.situacao === 'coberto') return { situacao: 'ativo', motivo: cobertura.motivo };
  if (cobertura.situacao === 'nao_coberto') {
    return {
      situacao: 'bloqueado',
      motivo: cobertura.motivo,
      categoriaMinima: cobertura.categoriaMinima,
    };
  }
  return { situacao: 'bloqueado', motivo: cobertura.motivo };
}

export interface ResumoDaAprovacaoDaCnh {
  /** Ids dos veículos que a categoria cobre. */
  cobertos: string[];
  /** Ids dos veículos que a categoria não cobre. */
  naoCobertos: string[];
  /** Ids dos veículos com vínculo existente que a aprovação derrubaria (⊂ `naoCobertos`). */
  derrubaria: string[];
}

/**
 * O que a operação precisa ver ao aprovar uma CNH: quais veículos da Frota a categoria cobre e
 * quais vínculos existentes do Guincheiro ela derrubaria. Categoria ilegível não cobre nada.
 */
export function resumoDaAprovacaoDaCnh(
  categoria: string,
  veiculos: readonly { id: string; pbtKg: number }[],
  veiculosVinculados: readonly string[],
): ResumoDaAprovacaoDaCnh {
  const cobertos: string[] = [];
  const naoCobertos: string[] = [];
  for (const v of veiculos) {
    (categoriaCobrePbt(categoria, v.pbtKg).situacao === 'coberto' ? cobertos : naoCobertos).push(
      v.id,
    );
  }
  return {
    cobertos,
    naoCobertos,
    derrubaria: naoCobertos.filter((id) => veiculosVinculados.includes(id)),
  };
}
