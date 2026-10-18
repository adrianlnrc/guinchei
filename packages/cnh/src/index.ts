// Regra legal CNH × PBT (ADR-0012, CTB art. 143): o vínculo Guincheiro × veículo é bloqueado
// se a categoria da CNH não cobre o PBT do veículo. Este módulo é a fonte única da regra; o
// banco repete a mesma tabela de verdade na função `categoria_cnh_cobre_pbt` (migração
// `supabase/migrations/*_cnh_pbt.sql`) e `sincronia-sql.test.ts` falha se as duas divergirem.
//
// Em aberto (CONTEXT.md): confirmar resoluções CONTRAN específicas de guincho. Por isso o
// limite e as categorias abaixo são constantes nomeadas, fáceis de revisar.

/**
 * Categorias de CNH aceitas no cadastro do Guincheiro (ADR-0012), da menos à mais abrangente
 * para conduzir veículo de carga. Combinações como "AB" não existem aqui: o cadastro guarda
 * uma categoria só, a que vale para o guincho (CTB art. 143).
 */
export const CATEGORIAS_CNH = ['ACC', 'A', 'B', 'C', 'D', 'E'] as const;
export type CategoriaCnh = (typeof CATEGORIAS_CNH)[number];

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

function ehCategoria(valor: string): valor is CategoriaCnh {
  return (CATEGORIAS_CNH as readonly string[]).includes(valor);
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
  if (!ehCategoria(categoria)) {
    return { situacao: 'erro', motivo: `Categoria de CNH desconhecida: ${categoria}` };
  }

  const acimaDoLimiteB = pbtKg > LIMITE_PBT_CATEGORIA_B_KG;
  const categoriaMinima: CategoriaCnh = acimaDoLimiteB ? 'C' : 'B';
  const peso = `${formatarKg(pbtKg)} kg`;

  if ((CATEGORIAS_SEM_REBOQUE as readonly string[]).includes(categoria)) {
    const exigencia = acimaDoLimiteB
      ? 'categoria C ou superior'
      : `categoria B (até ${formatarKg(LIMITE_PBT_CATEGORIA_B_KG)} kg) ou superior`;
    return {
      situacao: 'nao_coberto',
      categoriaMinima,
      motivo: `CNH ${categoria} não habilita conduzir guincho (reboque de carga): exige ${exigencia}`,
    };
  }
  if (categoria === 'B' && acimaDoLimiteB) {
    return {
      situacao: 'nao_coberto',
      categoriaMinima,
      motivo: `CNH B não cobre guincho de ${peso}: exige categoria C ou superior`,
    };
  }
  return { situacao: 'coberto', motivo: `CNH ${categoria} cobre guincho de ${peso}` };
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
