-- Regra CNH × PBT no banco (issue #40; ADR-0012, CTB art. 143).
--
-- `categoria_cnh_cobre_pbt(categoria, pbt_kg)` devolve true (coberto), false (não coberto) ou
-- null (entrada inválida: o equivalente do resultado `erro` do TS). A tabela de verdade abaixo,
-- entre `-- inicio:casos` e `-- fim:casos`, é a que packages/cnh/src/sincronia-sql.test.ts
-- confere contra `categoriaCobrePbt` do @guinchei/cnh: as linhas são `(categoria, pbt_kg,
-- esperado)`, com `null` para erro.
begin;
select plan(5);

create temporary table casos (ordem serial, categoria text, pbt_kg numeric, esperado boolean);

insert into casos (categoria, pbt_kg, esperado) values
-- inicio:casos
  ('B', 1, true),
  ('B', 3499, true),
  ('B', 3500, true),
  ('B', 3500.5, false),
  ('B', 3501, false),
  ('B', 4200, false),
  ('C', 3500, true),
  ('C', 3501, true),
  ('C', 16000, true),
  ('D', 3500, true),
  ('D', 3501, true),
  ('E', 3500, true),
  ('E', 3501, true),
  ('A', 1, false),
  ('A', 3500, false),
  ('A', 3501, false),
  ('ACC', 1, false),
  ('ACC', 3500, false),
  ('ACC', 3501, false),
  ('B', 0, null),
  ('B', -10, null),
  ('C', 0, null),
  ('X', 3000, null),
  ('AB', 3000, null),
  ('b', 3000, null),
  ('', 3000, null)
-- fim:casos
;

select results_eq(
  $$ select categoria, pbt_kg, public.categoria_cnh_cobre_pbt(categoria, pbt_kg)
     from casos order by ordem $$,
  $$ select categoria, pbt_kg, esperado from casos order by ordem $$,
  'a função responde a tabela de verdade categoria × PBT, incluindo as fronteiras'
);

select is(
  public.categoria_cnh_cobre_pbt('B', null), null,
  'PBT nulo é entrada inválida (null), não erro'
);
select is(
  public.categoria_cnh_cobre_pbt(null, 3000), null,
  'categoria nula é entrada inválida (null), não erro'
);
select is(
  public.categoria_cnh_cobre_pbt('E', 'NaN'::numeric), null,
  'PBT NaN é entrada inválida, como no TS'
);
select is(
  public.categoria_cnh_cobre_pbt('B', 'Infinity'::numeric), null,
  'PBT infinito é entrada inválida, como no TS'
);

select * from finish();
rollback;
