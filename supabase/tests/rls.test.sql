-- RLS por papel: um papel não lê dado de outro (issue #6).
--
-- Usuários do seed: Cliente A (Rafael), Guincheiros G1 (Marcos), G2 (Wagner), G3 (Rita) e
-- a operação. Aqui se cria o Cliente B e o cenário:
--   Pedido A (Cliente A): oferecido a G1 (recusou) e a G2 (aceitou, Corrida A); G3 foi
--     pulado pelo teto (não chegou a receber).
--   Pedido B (Cliente B): oferecido a G1, ainda sem resposta.
begin;
select plan(30);

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
   4.2, 21.3, 1, 11000, 2100, 12780, 25880),
  ('aaaaaaaa-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444',
   'moto', 'batida', 'nao',
   extensions.st_makepoint(-47.9000, -15.8000), 'Setor Policial Sul',
   extensions.st_makepoint(-47.9500, -15.8300), 'Guará II',
   3, 6, 1, 11000, 1500, 3600, 16100);

insert into public.tentativas_match
  (pedido_id, guincheiro_id, rodada, ordem, resultado, km_ate_veiculo, preco_recalculado,
   repasse_oferecido, expira_em)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222201', 1, 1, 'recusada', 4.2, 25880, 20704, now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222202', 1, 2, 'aceita', 4.9, 26230, 20984, now()),
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222203', 1, 3, 'pulada_teto', 9.6, 33000, 26400, null),
  ('aaaaaaaa-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222201', 1, 1, 'oferecida', 3, 16100, 12880, now() + interval '30 seconds');

insert into public.corridas (id, pedido_id, guincheiro_id, repasse)
values ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        '22222222-2222-4222-8222-222222222202', 20984);

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
set local role anon;

select throws_ok('select * from public.pedidos', '42501', null, 'anon não lê Pedidos');
select throws_ok('select * from public.perfis', '42501', null, 'anon não lê perfis');

reset role;

-- ---------------------------------------------------------------------------
-- Cliente A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select results_eq(
  'select id from public.pedidos',
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'Cliente A lê só o próprio Pedido, não o do Cliente B'
);
select results_eq(
  'select id from public.corridas',
  $$ values ('cccccccc-0000-4000-8000-000000000001'::uuid) $$,
  'Cliente A lê a Corrida do seu Pedido'
);
select results_eq(
  'select id from public.perfis',
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid) $$,
  'Cliente A lê só o próprio perfil'
);
select is_empty('select * from public.tentativas_match', 'Cliente não lê as ofertas do Match');
select is_empty('select * from public.guincheiros', 'Cliente não lê posições de Guincheiros');
select is_empty('select * from public.frotas', 'Cliente não lê Frotas');
select isnt_empty('select * from public.tabela_precos', 'Cliente lê a tabela de preços');
select isnt_empty('select * from public.feriados', 'Cliente lê os feriados');

select throws_ok(
  $$ insert into public.pedidos (
       cliente_id, tipo_veiculo, situacao, rodas_giram,
       origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
       tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
     ) values (
       '11111111-1111-4111-8111-111111111111', 'carro', 'nao_liga', 'sim',
       extensions.st_makepoint(-47.89, -15.79), 'A', extensions.st_makepoint(-48.05, -15.81), 'B',
       1, 1, 1, 100, 0, 0, 100
     ) $$,
  '42501',
  null,
  'Cliente não cria Pedido com o preço que quiser (só o servidor cota)'
);

select is_empty(
  $$ update public.corridas set estado = 'a_caminho' returning id $$,
  'Cliente não avança a Corrida'
);

select throws_ok(
  $$ update public.perfis set papel = 'operacao' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  null,
  'Cliente não muda o próprio papel'
);

reset role;

-- ---------------------------------------------------------------------------
-- Cadastro urgente de um Cliente novo (ADR-0010)
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, phone)
values ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', '5561900000098');

set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "phone": "5561900000098"}';

select throws_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
     values ('55555555-5555-4555-8555-555555555555', 'guincheiro', 'Novo', '5561900000098',
             '98765432100', 'v1') $$,
  '42501',
  null,
  'ninguém se cadastra como Guincheiro pela API'
);
select throws_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
     values ('55555555-5555-4555-8555-555555555555', 'cliente', 'Novo', '5561900000097',
             '98765432100', 'v1') $$,
  '42501',
  null,
  'o telefone do perfil é o verificado no login'
);
select lives_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
     values ('55555555-5555-4555-8555-555555555555', 'cliente', 'Novo', '5561900000098',
             '98765432100', 'v1') $$,
  'o usuário cria o próprio perfil de Cliente'
);

reset role;

-- ---------------------------------------------------------------------------
-- Guincheiros
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated"}';

select set_eq(
  'select id from public.pedidos',
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid),
            ('aaaaaaaa-0000-4000-8000-000000000002'::uuid) $$,
  'G1 lê os Pedidos oferecidos a ele (inclusive o que recusou)'
);
select is_empty('select * from public.corridas', 'G1 não lê a Corrida de outro Guincheiro');
select is(
  (select count(*) from public.tentativas_match), 2::bigint,
  'G1 lê só as ofertas feitas a ele'
);
select results_eq(
  'select nome from public.frotas',
  $$ values ('Reboque Planalto') $$,
  'G1 lê só a própria Frota'
);
select results_eq(
  $$ update public.guincheiros set disponivel = false returning id $$,
  $$ values ('22222222-2222-4222-8222-222222222201'::uuid) $$,
  'G1 muda só a própria disponibilidade'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222202", "role": "authenticated"}';

select results_eq(
  'select id from public.pedidos',
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'G2 lê o Pedido que aceitou e não o do Cliente B'
);
select results_eq(
  $$ update public.corridas set estado = 'a_caminho' returning estado::text $$,
  $$ values ('a_caminho') $$,
  'G2 avança a própria Corrida ("Saí para o local")'
);
select throws_ok(
  $$ update public.corridas set estado = 'entregue' $$,
  '23514',
  'Corrida não pode ir de a_caminho para entregue',
  'a transição continua reforçada para o Guincheiro'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222203", "role": "authenticated"}';

select is_empty(
  'select * from public.pedidos',
  'G3 não lê o Pedido em que foi pulado pelo teto (nunca lhe foi oferecido)'
);
select is_empty('select * from public.tentativas_match', 'G3 não vê a tentativa pulada');

reset role;

-- ---------------------------------------------------------------------------
-- Operação
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select is((select count(*) from public.pedidos), 2::bigint, 'operação lê todos os Pedidos');
select is((select count(*) from public.corridas), 1::bigint, 'operação lê todas as Corridas');
select is(
  (select count(*) from public.perfis), 7::bigint,
  'operação lê todos os perfis (5 do seed + Cliente B + o Cliente novo)'
);
select is((select count(*) from public.guincheiros), 3::bigint, 'operação lê todos os Guincheiros');

reset role;

select * from finish();
rollback;
