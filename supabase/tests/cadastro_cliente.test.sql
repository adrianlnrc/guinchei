-- Cadastro do Cliente (issue #57): CEP no emergencial, cadastro completo no app.
-- Seed: Rafael (Cliente, sem CEP), Marcos (Guincheiro). Aqui entram Ana (nova) e Bia.
begin;
select plan(24);

insert into auth.users (id, aud, role, phone) values
  ('77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', '5561900000095'),
  ('88888888-8888-4888-8888-888888888888', 'authenticated', 'authenticated', '5561900000094');

-- ---------------------------------------------------------------------------
-- Cadastro emergencial: exige CEP válido
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "77777777-7777-4777-8777-777777777777", "role": "authenticated", "phone": "5561900000095"}';

select throws_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
     values ('77777777-7777-4777-8777-777777777777', 'cliente', 'Ana', '5561900000095',
             '39053344705', 'v1') $$,
  '42501', null, 'sem CEP o cadastro emergencial é recusado'
);
select throws_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, cep, aceite_termos_versao)
     values ('77777777-7777-4777-8777-777777777777', 'cliente', 'Ana', '5561900000095',
             '39053344705', '11111111', 'v1') $$,
  '23514', null, 'CEP com os 8 dígitos iguais é recusado'
);
select throws_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, cep, aceite_termos_versao)
     values ('77777777-7777-4777-8777-777777777777', 'cliente', 'Ana', '5561900000095',
             '39053344705', '70040-010', 'v1') $$,
  '23514', null, 'CEP com máscara é recusado (grava só dígitos)'
);
select throws_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, cep, aceite_termos_versao)
     values ('77777777-7777-4777-8777-777777777777', 'cliente', 'Ana', '5561900000095',
             '39053344705', '7004001', 'v1') $$,
  '23514', null, 'CEP com menos de 8 dígitos é recusado'
);
select lives_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, cep, aceite_termos_versao)
     values ('77777777-7777-4777-8777-777777777777', 'cliente', 'Ana', '5561900000095',
             '39053344705', '01310100', 'v1') $$,
  'CEP de fora do DF também vale'
);

-- ---------------------------------------------------------------------------
-- Cadastro no app: nome, CEP e e-mail do próprio Cliente
-- ---------------------------------------------------------------------------
select is(
  (select cep from public.atualizar_cadastro_cliente('  Ana Souza ', '70040010', 'ana@exemplo.com.br')),
  '70040010',
  'o Cliente atualiza o próprio cadastro'
);
select is(
  (select nome || '|' || email from public.perfis where id = '77777777-7777-4777-8777-777777777777'),
  'Ana Souza|ana@exemplo.com.br',
  'nome sem espaços nas pontas e e-mail gravados'
);
select is(
  (select email from public.atualizar_cadastro_cliente('Ana Souza', '70040010')),
  null,
  'sem e-mail, o e-mail é apagado'
);
select is(
  (select email from public.atualizar_cadastro_cliente('Ana Souza', '70040010', '   ')),
  null,
  'e-mail em branco vira nulo'
);
select throws_ok(
  $$ select public.atualizar_cadastro_cliente('Ana Souza', '00000000') $$,
  '23514', null, 'CEP com dígitos iguais é recusado na atualização'
);
select throws_ok(
  $$ select public.atualizar_cadastro_cliente('Ana Souza', null) $$,
  '23514', null, 'o CEP não pode ser apagado'
);
select throws_ok(
  $$ select public.atualizar_cadastro_cliente('Ana Souza', '70040010', 'sem-arroba') $$,
  '23514', null, 'e-mail de formato inválido é recusado'
);
select throws_ok(
  $$ select public.atualizar_cadastro_cliente('   ', '70040010') $$,
  '23514', null, 'nome em branco é recusado'
);

-- CPF, telefone, papel e CEP não mudam pelas tabelas.
select throws_ok(
  $$ update public.perfis set cpf = '12345678909' where id = '77777777-7777-4777-8777-777777777777' $$,
  '42501', null, 'o Cliente não troca o CPF'
);
select throws_ok(
  $$ update public.perfis set telefone = '5561900000001' where id = '77777777-7777-4777-8777-777777777777' $$,
  '42501', null, 'o Cliente não troca o telefone'
);
select throws_ok(
  $$ update public.perfis set papel = 'operacao' where id = '77777777-7777-4777-8777-777777777777' $$,
  '42501', null, 'o Cliente não troca o papel'
);
select throws_ok(
  $$ update public.perfis set cep = null where id = '77777777-7777-4777-8777-777777777777' $$,
  '42501', null, 'o CEP só muda pela função do cadastro'
);

-- ---------------------------------------------------------------------------
-- RLS: lê e altera só o próprio cadastro
-- ---------------------------------------------------------------------------
reset role;
insert into public.perfis (id, papel, nome, telefone, cpf, cep, aceite_termos_versao)
values ('88888888-8888-4888-8888-888888888888', 'cliente', 'Bia', '5561900000094',
        '11144477735', '72000000', 'v1');

set local role authenticated;
set local request.jwt.claims to '{"sub": "77777777-7777-4777-8777-777777777777", "role": "authenticated", "phone": "5561900000095"}';

select is(
  (select count(*)::int from public.perfis where id = '88888888-8888-4888-8888-888888888888'),
  0,
  'o Cliente não lê o cadastro de outro'
);
select is(
  (select cpf from public.atualizar_cadastro_cliente('Ana Souza', '70040010')),
  '39053344705',
  'a função devolve e altera só o perfil de quem chama'
);

reset role;
select is(
  (select nome || '|' || cep from public.perfis where id = '88888888-8888-4888-8888-888888888888'),
  'Bia|72000000',
  'o cadastro de outro Cliente não mudou'
);

-- Guincheiro e anon não usam a função.
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated"}';
select throws_ok(
  $$ select public.atualizar_cadastro_cliente('Marcos', '70040010') $$,
  '42501', null, 'o Guincheiro não usa a função do Cliente'
);

set local role anon;
select throws_ok(
  $$ select public.atualizar_cadastro_cliente('X', '70040010') $$,
  '42501', null, 'anon não usa a função'
);

-- Perfis anteriores ao CEP seguem válidos.
reset role;
select is(
  (select cep from public.perfis where id = '11111111-1111-4111-8111-111111111111'),
  null,
  'o perfil do seed segue com CEP nulo'
);
select lives_ok(
  $$ update public.perfis set nome = nome where id = '11111111-1111-4111-8111-111111111111' $$,
  'perfil sem CEP continua válido'
);

select * from finish();
rollback;
