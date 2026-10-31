-- Guincheiros elegíveis mais próximos de um ponto (ADR-0002, ADR-0008).
-- Ponto: Eixo Monumental, onde o Cliente do seed está parado. Seed: Marcos (Cruzeiro,
-- ~4,2 km), Wagner (Asa Norte, ~4,9 km), ambos da Reboque Planalto; Rita (Guará, ~9,6 km),
-- autônoma. Desde o #50, "elegível" também exige Guincheiro homologado e vinculado a veículo
-- homologado: o seed já traz os três assim, e o final deste teste tira cada exigência.
begin;
select plan(15);

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

-- ---------------------------------------------------------------------------
-- Homologação e vínculo (#50): cada exigência tirada isoladamente
-- ---------------------------------------------------------------------------
-- Volta ao cenário do seed: Frota da Reboque Planalto ativa e Marcos disponível.
update public.frotas set ativa = true where id = 'f0000000-0000-4000-8000-000000000001';
update public.guincheiros set disponivel = true where id = '22222222-2222-4222-8222-222222222201';

select results_eq(
  $$ select guincheiro_id from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921) $$,
  $$ values ('22222222-2222-4222-8222-222222222201'::uuid),
            ('22222222-2222-4222-8222-222222222202'::uuid),
            ('22222222-2222-4222-8222-222222222203'::uuid) $$,
  'o seed migrado mantém os três Guincheiros elegíveis'
);
select ok(
  public.frota_pronta('f0000000-0000-4000-8000-000000000001')
  and public.frota_pronta('f0000000-0000-4000-8000-000000000002'),
  'as duas Frotas do seed cumprem a regra de ativação'
);

-- Sem veículo vinculado.
delete from public.vinculos_veiculo where guincheiro_id = '22222222-2222-4222-8222-222222222201';
select results_eq(
  $$ select guincheiro_id from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921) $$,
  $$ values ('22222222-2222-4222-8222-222222222202'::uuid),
            ('22222222-2222-4222-8222-222222222203'::uuid) $$,
  'Guincheiro sem veículo vinculado não é elegível (Marcos)'
);

-- CNH aprovada, mas com a validade de ontem: o job ainda não a marcou vencida. A Frota fica
-- marcada ativa de propósito, para provar que a conferência ao vivo basta.
update public.itens_homologacao set validade = public.hoje_em_brasilia() - 1
where alvo = 'guincheiro' and alvo_id = '22222222-2222-4222-8222-222222222202' and tipo = 'cnh';
update public.frotas set ativa = true where id = 'f0000000-0000-4000-8000-000000000001';
select results_eq(
  $$ select guincheiro_id from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921) $$,
  $$ values ('22222222-2222-4222-8222-222222222203'::uuid) $$,
  'CNH aprovada com a validade passada não conta como homologada (Wagner), mesmo antes do job'
);

-- Veículo sem todos os itens vigentes (CRLV vencido).
update public.itens_homologacao set estado = 'vencido'
where alvo = 'veiculo' and alvo_id = 'b1000000-0000-4000-8000-000000000003' and tipo = 'crlv';
update public.frotas set ativa = true where id = 'f0000000-0000-4000-8000-000000000002';
select is_empty(
  $$ select * from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921) $$,
  'Guincheiro vinculado a veículo sem homologação vigente não é elegível (Rita)'
);

-- O CRLV volta a valer, mas a apólice da Frota da Rita está com a validade de ontem.
update public.itens_homologacao set estado = 'pendente'
where alvo = 'veiculo' and alvo_id = 'b1000000-0000-4000-8000-000000000003' and tipo = 'crlv';
update public.itens_homologacao set estado = 'aprovado'
where alvo = 'veiculo' and alvo_id = 'b1000000-0000-4000-8000-000000000003' and tipo = 'crlv';
-- A Frota voltou a ser desativada pela mudança dos itens; a regra vale de novo, então reativa.
select ok(public.frota_pronta('f0000000-0000-4000-8000-000000000002'), 'a Frota da Rita cumpre a regra de novo');
update public.frotas set ativa = true where id = 'f0000000-0000-4000-8000-000000000002';
select results_eq(
  $$ select guincheiro_id from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921) $$,
  $$ values ('22222222-2222-4222-8222-222222222203'::uuid) $$,
  'com o CRLV de volta, a Rita volta a ser elegível'
);
update public.itens_homologacao set validade = public.hoje_em_brasilia() - 1
where alvo = 'frota' and alvo_id = 'f0000000-0000-4000-8000-000000000002' and tipo = 'apolice_rc';
update public.frotas set ativa = true where id = 'f0000000-0000-4000-8000-000000000002';
select is_empty(
  $$ select * from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921) $$,
  'apólice da Frota com a validade passada: ninguém da Frota entra no Match, mesmo marcada ativa'
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
