-- Acompanhamento do Cliente (issue #14): Realtime e a contraparte da Corrida.
--
-- Usuários do seed: Cliente A (Rafael), G1 Marcos, G2 Wagner (Frota Reboque Planalto),
-- G3 Rita. Aqui se cria o Cliente B e a Corrida A (Pedido do Cliente A, com o Wagner).
begin;
select plan(8);

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao)
values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Cliente B', '5561900000099',
        '11144477735', now(), 'v1');

insert into public.pedidos (
  id, cliente_id, tipo_veiculo, situacao, rodas_giram,
  origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
  tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'carro', 'nao_liga', 'sim',
   extensions.st_makepoint(-47.8921, -15.7903), 'Eixo Monumental',
   extensions.st_makepoint(-48.0560, -15.8100), 'QNA 12, Taguatinga Norte',
   4.2, 21.3, 1, 11000, 2100, 12780, 25880);

insert into public.corridas (id, pedido_id, guincheiro_id, repasse)
values ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        '22222222-2222-4222-8222-222222222202', 20984);

-- ---------------------------------------------------------------------------
-- Realtime: o app do Cliente escuta Pedido e Corrida
-- ---------------------------------------------------------------------------
select ok(
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos'),
  'pedidos está na publicação supabase_realtime'
);
select ok(
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'corridas'),
  'corridas está na publicação supabase_realtime'
);
select is(
  (select count(*) from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename not in ('pedidos', 'corridas', 'tentativas_match')),
  0::bigint,
  'nenhuma tabela com dado pessoal (perfis, pagamentos...) entra na publicação'
);

-- ---------------------------------------------------------------------------
-- contraparte_da_corrida: só nome e Frota, só para quem participa
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$ select to_jsonb(c) from public.contraparte_da_corrida('cccccccc-0000-4000-8000-000000000001') c $$,
  $$ values ('{"nome": "Wagner Lopes", "frota": "Reboque Planalto"}'::jsonb) $$,
  'o Cliente da Corrida lê só o nome do Guincheiro e o nome da Frota (sem CPF nem telefone)'
);

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222202", "role": "authenticated"}';
select results_eq(
  $$ select to_jsonb(c) from public.contraparte_da_corrida('cccccccc-0000-4000-8000-000000000001') c $$,
  $$ values ('{"nome": "Rafael Souza", "frota": null}'::jsonb) $$,
  'o Guincheiro da Corrida lê só o nome do Cliente'
);

set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select is_empty(
  $$ select * from public.contraparte_da_corrida('cccccccc-0000-4000-8000-000000000001') $$,
  'o Cliente B (estranho à Corrida) não lê nada'
);

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated"}';
select is_empty(
  $$ select * from public.contraparte_da_corrida('cccccccc-0000-4000-8000-000000000001') $$,
  'outro Guincheiro (estranho à Corrida) não lê nada'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.contraparte_da_corrida('cccccccc-0000-4000-8000-000000000001') $$,
  '42501', null,
  'anon não executa contraparte_da_corrida'
);
reset role;

select * from finish();
rollback;
