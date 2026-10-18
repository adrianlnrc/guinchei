-- Regra CNH × PBT (issue #40; ADR-0012, CTB art. 143).
--
-- A categoria B cobre PBT até 3.500 kg (inclusive); acima disso exige C ou superior (D e E
-- também cobrem). A e ACC não conduzem reboque de carga: não cobrem nada. A fonte da regra é
-- packages/cnh/src/index.ts (`categoriaCobrePbt`); esta função repete a mesma tabela de
-- verdade e packages/cnh/src/sincronia-sql.test.ts, junto com o pgTAP
-- (supabase/tests/cnh_pbt.test.sql), falha se as duas divergirem.
--
-- Em aberto (CONTEXT.md): confirmar resoluções CONTRAN específicas de guincho. O limite e as
-- categorias estão só aqui, num lugar, para revisar fácil.
--
-- Devolve true (coberto), false (não coberto) ou null quando a entrada é inválida (categoria
-- desconhecida ou nula, PBT nulo, não positivo, NaN ou infinito): o equivalente do resultado
-- `erro` do TS. Quem usa a função (o vínculo Guincheiro × veículo) decide o que fazer com null;
-- só `true` libera.

create function public.categoria_cnh_cobre_pbt(categoria text, pbt_kg numeric)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when pbt_kg is null
      or pbt_kg <= 0
      or pbt_kg in ('NaN'::numeric, 'Infinity'::numeric) then null
    when categoria in ('ACC', 'A') then false
    when categoria = 'B' then pbt_kg <= 3500
    when categoria in ('C', 'D', 'E') then true
    else null
  end
$$;

comment on function public.categoria_cnh_cobre_pbt is
  'A categoria de CNH cobre o PBT (kg)? true/false, ou null se a entrada é inválida; mesma regra de categoriaCobrePbt (@guinchei/cnh), CTB art. 143 e ADR-0012.';
