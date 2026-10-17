-- Guincheiros elegíveis mais próximos de um ponto (ADR-0002, ADR-0008).
-- Ponto: Eixo Monumental, onde o Cliente do seed está parado. Seed: Marcos (Cruzeiro,
-- ~4,2 km), Wagner (Asa Norte, ~4,9 km), ambos da Reboque Planalto; Rita (Guará, ~9,6 km),
-- autônoma.
begin;
select plan(7);

select results_eq(
  $$ select guincheiro_id from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921) $$,
  $$ values ('22222222-2222-4222-8222-222222222201'::uuid),
            ('22222222-2222-4222-8222-222222222202'::uuid),
            ('22222222-2222-4222-8222-222222222203'::uuid) $$,
  'ordena pela distância até o ponto'
);

select ok(
  (select distancia_m between 4000 and 4400
   from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921, 1)),
  'devolve a distância real em metros (Cruzeiro a ~4,2 km)'
);

select results_eq(
  $$ select guincheiro_id from public.guincheiros_elegiveis_proximos(-15.8230, -47.9750) $$,
  $$ values ('22222222-2222-4222-8222-222222222203'::uuid),
            ('22222222-2222-4222-8222-222222222201'::uuid),
            ('22222222-2222-4222-8222-222222222202'::uuid) $$,
  'a ordem muda com o ponto (no Guará, Rita é a mais próxima)'
);

select is(
  (select count(*) from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921, 2)),
  2::bigint,
  'respeita o limite'
);

update public.guincheiros set disponivel = false
where id = '22222222-2222-4222-8222-222222222201';

select results_eq(
  $$ select guincheiro_id from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921) $$,
  $$ values ('22222222-2222-4222-8222-222222222202'::uuid),
            ('22222222-2222-4222-8222-222222222203'::uuid) $$,
  'exclui Guincheiro indisponível'
);

update public.frotas set ativa = false where id = 'f0000000-0000-4000-8000-000000000001';

select results_eq(
  $$ select guincheiro_id from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921) $$,
  $$ values ('22222222-2222-4222-8222-222222222203'::uuid) $$,
  'exclui Guincheiro de Frota inativa, mesmo disponível'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ select * from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921) $$,
  '42501',
  null,
  'usuário logado não consulta posições de Guincheiros (só service_role)'
);

reset role;

select * from finish();
rollback;
