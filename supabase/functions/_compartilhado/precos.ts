// Tabela de preços como o banco devolve (`to_jsonb(tabela_precos)`), convertida para o
// formato de @guinchei/preco. Usada pela cotação e pelo Match.
import type { TabelaPrecos } from '../../../packages/preco/src/index.ts';

/** Linha de `tabela_precos`. As frações chegam como número (numeric em jsonb). */
export interface LinhaTabelaPrecos {
  versao: number;
  taxa_base: number;
  por_km_ate_veiculo: number;
  por_km_rebocado: number;
  adicional_noturno: number;
  noturno_das: number;
  noturno_ate: number;
  adicional_feriado: number;
  preco_minimo: number;
  comissao: number;
}

export function tabelaDoBanco(linha: LinhaTabelaPrecos): TabelaPrecos {
  return {
    versao: linha.versao,
    taxaBase: linha.taxa_base,
    porKmAteVeiculo: linha.por_km_ate_veiculo,
    porKmRebocado: linha.por_km_rebocado,
    adicionalNoturno: Number(linha.adicional_noturno),
    noturnoDas: linha.noturno_das,
    noturnoAte: linha.noturno_ate,
    adicionalFeriado: Number(linha.adicional_feriado),
    precoMinimo: linha.preco_minimo,
    comissao: Number(linha.comissao),
  };
}
