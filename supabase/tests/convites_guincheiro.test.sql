-- Convite de Guincheiro por telefone e conta própria (issue #46, ADR-0012).
--
-- Duas Frotas de teste, cada uma com o seu representante (Ana e Bruno). O representante convida
-- pelo telefone, vê e cancela só os convites da própria Frota; o convidado entra por telefone,
-- informa nome e CPF no primeiro acesso e ganha perfil + Guincheiro indisponível na Frota que o
-- convidou. Número já com conta, convidado por duas Frotas, convite cancelado ou vencido não vinculam.
begin;
select plan(67);

-- Ana (Frota A) e Bruno (Frota B): representantes. Os convidados são usuários sem perfil.
insert into auth.users (id, aud, role, phone) values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '5561900000091'),
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '5561900000092'),
  ('a2000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '5561999990001'),
  ('a2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '5561999990002'),
  ('a2000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '5561999990003'),
  ('a2000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', '5561999990004'),
  ('a2000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '5561999990005'),
  ('a2000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', '5561900000046');

insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao) values
  ('a1000000-0000-4000-8000-000000000001', 'representante', 'Ana Frota A', '5561900000091', '52998224725', 'teste'),
  ('a1000000-0000-4000-8000-000000000002', 'representante', 'Bruno Frota B', '5561900000092', '39053344705', 'teste');
insert into public.frotas (id, tipo, documento, nome, representante_id, base_cep, base_endereco, base_bairro,
                           chave_pix, termos_prestador_versao)
values
  ('f1000000-0000-4000-8000-00000000000a', 'autonomo', '52998224725', 'Frota A', 'a1000000-0000-4000-8000-000000000001',
   '70000000', 'SQN 1', 'Asa Norte', 'a@exemplo.com', 'teste'),
  ('f1000000-0000-4000-8000-00000000000b', 'autonomo', '39053344705', 'Frota B', 'a1000000-0000-4000-8000-000000000002',
   '70000000', 'SQS 2', 'Asa Sul', 'b@exemplo.com', 'teste');

-- ---------------------------------------------------------------------------
-- Modelo
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(e::text order by e::text) from unnest(enum_range(null::public.estado_convite)) e),
  array['aceito', 'cancelado', 'pendente'], 'o convite é pendente, aceito ou cancelado'
);
select is(
  (select count(*) from public.convites_guincheiro
   where telefone = '5561900000046' and estado = 'pendente'
     and frota_id = 'f0000000-0000-4000-8000-000000000001'),
  1::bigint, 'o seed convida o 5561900000046 pela Reboque Planalto'
);
select throws_ok(
  $$ insert into public.convites_guincheiro (frota_id, telefone)
     values ('f1000000-0000-4000-8000-00000000000a', '5561900000046') $$,
  '23505', null, 'um número não tem dois convites pendentes, nem por duas Frotas'
);
select throws_ok(
  $$ insert into public.convites_guincheiro (frota_id, telefone, criado_em, valido_ate)
     values ('f1000000-0000-4000-8000-00000000000a', '5561999990009', now(), now() - interval '1 day') $$,
  '23514', null, 'a validade vem depois da criação'
);

-- ---------------------------------------------------------------------------
-- Ana convida
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "a1000000-0000-4000-8000-000000000001", "role": "authenticated", "phone": "5561900000091"}';

select lives_ok(
  $$ select public.convidar_guincheiro('5561999990001') $$,
  'o representante convida um número'
);
select lives_ok(
  $$ select public.convidar_guincheiro('+55 (61) 99999-0002') $$,
  'o número entra com ou sem máscara'
);
select is(
  (select count(*) from public.convites_guincheiro where telefone = '5561999990002'),
  1::bigint, 'e fica só com dígitos'
);
select throws_ok(
  $$ select public.convidar_guincheiro('61999990003') $$,
  'GCV01', null, 'sem o 55 o número é recusado'
);
select throws_ok(
  $$ select public.convidar_guincheiro('') $$,
  'GCV01', null, 'número vazio é recusado'
);
select throws_ok(
  $$ select public.convidar_guincheiro('5561999990001') $$,
  'GCV03', null, 'a mesma Frota não convida o mesmo número duas vezes'
);
select throws_ok(
  $$ select public.convidar_guincheiro('5561900000002') $$,
  'GCV05', null, 'número que já é de outro Guincheiro tem erro claro'
);
select throws_ok(
  $$ select public.convidar_guincheiro('5561900000001') $$,
  'GCV05', null, 'e o de um Cliente também'
);
select throws_ok(
  $$ select public.convidar_guincheiro('5561900000046') $$,
  'GCV04', null, 'número já convidado pela Reboque Planalto não é convidado por outra Frota'
);
select is(
  (select array_agg(telefone order by telefone) from public.convites_guincheiro),
  array['5561999990001', '5561999990002'], 'Ana lê só os convites da própria Frota'
);
select throws_ok(
  $$ insert into public.convites_guincheiro (frota_id, telefone)
     values ('f1000000-0000-4000-8000-00000000000a', '5561999990008') $$,
  '42501', null, 'o app não escreve convite direto: só pela função'
);
select throws_ok(
  $$ update public.convites_guincheiro set estado = 'aceito' $$,
  '42501', null, 'nem muda o estado direto'
);

-- ---------------------------------------------------------------------------
-- Bruno: o convite de outra Frota não é visível nem cancelável
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a1000000-0000-4000-8000-000000000002", "role": "authenticated", "phone": "5561900000092"}';

select is_empty(
  'select * from public.convites_guincheiro',
  'Bruno não vê convite de outra Frota (nem o do seed, que não é da Frota dele)'
);
select throws_ok(
  $$ select public.convidar_guincheiro('5561999990001') $$,
  'GCV04', null, 'número convidado pela Frota A tem erro claro na Frota B'
);
reset role;
create temp table ids_convites on commit drop as
  select telefone, id from public.convites_guincheiro;
grant select on ids_convites to authenticated;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a1000000-0000-4000-8000-000000000002", "role": "authenticated", "phone": "5561900000092"}';

select throws_ok(
  $$ select public.cancelar_convite_guincheiro((select id from ids_convites where telefone = '5561999990001')) $$,
  'GCV11', null, 'Bruno não cancela o convite de outra Frota'
);
select throws_ok(
  $$ select public.cancelar_convite_guincheiro(gen_random_uuid()) $$,
  'GCV11', null, 'convite que não existe tem erro claro'
);
select lives_ok(
  $$ select public.convidar_guincheiro('5561999990003') $$,
  'Bruno convida um número livre'
);
select lives_ok(
  $$ select public.convidar_guincheiro('5561999990004') $$,
  'e outro, que a Frota dele cancela em seguida'
);
select lives_ok(
  $$ select public.cancelar_convite_guincheiro(
       (select id from public.convites_guincheiro where telefone = '5561999990004')) $$,
  'o representante cancela o convite da própria Frota'
);
select is(
  (select estado::text from public.convites_guincheiro where telefone = '5561999990004'),
  'cancelado', 'que fica cancelado'
);
select throws_ok(
  $$ select public.cancelar_convite_guincheiro(
       (select id from public.convites_guincheiro where telefone = '5561999990004')) $$,
  'GCV11', null, 'convite já cancelado não se cancela de novo'
);
select lives_ok(
  $$ select public.convidar_guincheiro('5561999990004') $$,
  'convite cancelado libera o número para um novo convite'
);
select is(
  (select array_agg(telefone order by telefone) from public.convites_guincheiro where estado = 'pendente'),
  array['5561999990003', '5561999990004'], 'Bruno lê só os convites da Frota B'
);

-- ---------------------------------------------------------------------------
-- Quem não é representante, a operação e anon
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated", "phone": "5561900000002"}';
select throws_ok(
  $$ select public.convidar_guincheiro('5561999990005') $$,
  '42501', null, 'Guincheiro não convida'
);
select throws_ok(
  $$ select public.cancelar_convite_guincheiro(gen_random_uuid()) $$,
  '42501', null, 'Guincheiro não cancela convite'
);
select is_empty('select * from public.convites_guincheiro', 'Guincheiro não lê convites');
select is_empty('select * from public.guincheiros_da_minha_frota()', 'nem a lista de Guincheiros da Frota');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated", "phone": "5561900000001"}';
select throws_ok(
  $$ select public.convidar_guincheiro('5561999990005') $$,
  '42501', null, 'Cliente não convida'
);
select is_empty('select * from public.convites_guincheiro', 'Cliente não lê convites');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated", "phone": "5561900000005"}';
select is(
  (select count(*) from public.convites_guincheiro), 6::bigint,
  'a operação lê todos os convites (o do seed e os das duas Frotas, cancelados incluídos)'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.convites_guincheiro $$,
  '42501', null, 'anon não lê convites'
);
select throws_ok(
  $$ select public.convidar_guincheiro('5561999990005') $$,
  '42501', null, 'anon não convida'
);
select throws_ok(
  $$ select public.aceitar_convite_guincheiro('Fulano', '11144477735', 'teste') $$,
  '42501', null, 'anon não aceita convite'
);
reset role;

-- ---------------------------------------------------------------------------
-- Primeiro acesso: aceite
-- ---------------------------------------------------------------------------
-- O 5561999990003 foi convidado pela Frota B (Bruno).
set local role authenticated;
set local request.jwt.claims to '{"sub": "a2000000-0000-4000-8000-000000000003", "role": "authenticated", "phone": "5561999990003"}';

select is(
  (select frota_nome from public.meu_convite_guincheiro()), 'Frota B',
  'o convidado vê a Frota que o convidou'
);
select throws_ok(
  $$ select public.aceitar_convite_guincheiro('   ', '11144477735', 'termos-teste') $$,
  'GCV09', null, 'o nome é obrigatório'
);
select throws_ok(
  $$ select public.aceitar_convite_guincheiro('Carla Dias', '11144477735', '') $$,
  'GCV09', null, 'sem o aceite dos termos não há conta'
);
select throws_ok(
  $$ select public.aceitar_convite_guincheiro('Carla Dias', '11144477734', 'termos-teste') $$,
  'GCV10', null, 'o CPF é validado'
);
select throws_ok(
  $$ select public.aceitar_convite_guincheiro('Carla Dias', '23456789173', 'termos-teste') $$,
  '23505', null, 'CPF de outra conta é recusado'
);
select is_empty(
  $$ select * from public.perfis where id = 'a2000000-0000-4000-8000-000000000003' $$,
  'nenhuma recusa deixa perfil pela metade'
);
select is(
  (select public.aceitar_convite_guincheiro('Carla Dias', '11144477735', 'termos-teste')),
  'a2000000-0000-4000-8000-000000000003'::uuid, 'o primeiro login com número convidado cria a conta'
);
select is(
  (select papel::text || '|' || nome || '|' || telefone || '|' || aceite_termos_versao
   from public.perfis where id = 'a2000000-0000-4000-8000-000000000003'),
  'guincheiro|Carla Dias|5561999990003|termos-teste', 'com perfil de Guincheiro, o telefone verificado e os termos'
);
select is(
  (select aceite_termos_em = now() from public.perfis where id = 'a2000000-0000-4000-8000-000000000003'),
  true, 'a hora do aceite é a do servidor'
);
select is(
  (select frota_id from public.guincheiros where id = 'a2000000-0000-4000-8000-000000000003'),
  'f1000000-0000-4000-8000-00000000000b'::uuid, 'o Guincheiro nasce na Frota que convidou'
);
select is(
  (select disponivel from public.guincheiros where id = 'a2000000-0000-4000-8000-000000000003'),
  false, 'e indisponível'
);
select is_empty('select * from public.meu_convite_guincheiro()', 'o convite aceito não aparece mais');
select throws_ok(
  $$ select public.aceitar_convite_guincheiro('Carla Dias', '11144477735', 'termos-teste') $$,
  'GCV06', null, 'o mesmo convite não vincula duas vezes'
);

reset role;
select is(
  (select estado::text || '|' || (aceito_por = 'a2000000-0000-4000-8000-000000000003')::text
   from public.convites_guincheiro where telefone = '5561999990003'),
  'aceito|true', 'o convite fica aceito, com quem aceitou'
);
select is(
  (select count(*) from public.guincheiros_elegiveis_proximos(-15.79, -47.88, 100)
   where guincheiro_id = 'a2000000-0000-4000-8000-000000000003'),
  0::bigint, 'o Guincheiro recém-criado fica fora do Match'
);

-- Bruno vê o Guincheiro vinculado; Ana não.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a1000000-0000-4000-8000-000000000002", "role": "authenticated", "phone": "5561900000092"}';
select is(
  (select nome || '|' || telefone || '|' || disponivel::text from public.guincheiros_da_minha_frota()),
  'Carla Dias|5561999990003|false', 'o representante vê os Guincheiros já vinculados'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a1000000-0000-4000-8000-000000000001", "role": "authenticated", "phone": "5561900000091"}';
select is_empty('select * from public.guincheiros_da_minha_frota()', 'a outra Frota não os vê');

-- ---------------------------------------------------------------------------
-- Sem convite, convite cancelado e vencido não vinculam
-- ---------------------------------------------------------------------------
reset role;
-- 5561999990005: sem convite. 5561999990004 já tem convite pendente (de Bruno): ele o perde ao
-- ser cancelado abaixo. 5561999990002: Ana convidou, e o vencimento é simulado.
update public.convites_guincheiro set estado = 'cancelado' where telefone = '5561999990004';
update public.convites_guincheiro
set criado_em = now() - interval '10 days', valido_ate = now() - interval '3 days'
where telefone = '5561999990002';

set local role authenticated;
set local request.jwt.claims to '{"sub": "a2000000-0000-4000-8000-000000000005", "role": "authenticated", "phone": "5561999990005"}';
select is_empty('select * from public.meu_convite_guincheiro()', 'número sem convite não vê convite');
select throws_ok(
  $$ select public.aceitar_convite_guincheiro('Sem Convite', '11144477735', 'termos-teste') $$,
  'GCV06', null, 'número sem convite não vira Guincheiro'
);
select is_empty(
  $$ select * from public.perfis where id = 'a2000000-0000-4000-8000-000000000005' $$,
  'e não ganha perfil'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a2000000-0000-4000-8000-000000000004", "role": "authenticated", "phone": "5561999990004"}';
select throws_ok(
  $$ select public.aceitar_convite_guincheiro('Cancelado', '11144477735', 'termos-teste') $$,
  'GCV06', null, 'convite cancelado não vincula'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a2000000-0000-4000-8000-000000000002", "role": "authenticated", "phone": "5561999990002"}';
select is_empty('select * from public.meu_convite_guincheiro()', 'convite vencido não aparece para o convidado');
select throws_ok(
  $$ select public.aceitar_convite_guincheiro('Vencido', '11144477735', 'termos-teste') $$,
  'GCV07', null, 'convite vencido não vincula'
);

-- Convite vencido não trava um convite novo, nem de outra Frota.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a1000000-0000-4000-8000-000000000002", "role": "authenticated", "phone": "5561900000092"}';
select lives_ok(
  $$ select public.convidar_guincheiro('5561999990002') $$,
  'convite vencido de outra Frota libera o número para um novo convite'
);
reset role;
select is(
  (select array_agg(frota_id::text || ':' || estado::text order by estado)
   from public.convites_guincheiro where telefone = '5561999990002'),
  array['f1000000-0000-4000-8000-00000000000b:pendente', 'f1000000-0000-4000-8000-00000000000a:cancelado'],
  'o vencido é encerrado e o novo é pendente da outra Frota'
);

-- Quem já tem conta não vira Guincheiro pelo convite.
insert into public.convites_guincheiro (frota_id, telefone)
values ('f1000000-0000-4000-8000-00000000000a', '5561900000001');
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated", "phone": "5561900000001"}';
select is_empty('select * from public.meu_convite_guincheiro()', 'quem já tem perfil não é convidado');
select throws_ok(
  $$ select public.aceitar_convite_guincheiro('Rafael', '12345678062', 'termos-teste') $$,
  'GCV08', null, 'e não troca de papel pelo convite'
);

-- ---------------------------------------------------------------------------
-- O convite do seed: Frota certa
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "a2000000-0000-4000-8000-000000000006", "role": "authenticated", "phone": "5561900000046"}';
select is(
  (select frota_nome from public.meu_convite_guincheiro()), 'Reboque Planalto',
  'o 5561900000046 é convidado da Reboque Planalto'
);
select lives_ok(
  $$ select public.aceitar_convite_guincheiro('Davi Rocha', '12345678909', 'termos-teste') $$,
  'e entra pelo primeiro acesso'
);
select is(
  (select frota_id from public.guincheiros where id = 'a2000000-0000-4000-8000-000000000006'),
  'f0000000-0000-4000-8000-000000000001'::uuid, 'vinculado à Reboque Planalto'
);

select * from finish();
rollback;
