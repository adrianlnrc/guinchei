-- Hora do aceite dos termos de uso (ADR-0010): sempre a do servidor, nunca a do aparelho.
-- Mesmo padrão de fotos_estado.criado_em: o valor enviado é descartado e o app nem tem
-- permissão de mandar a coluna. Rever os termos (outra versão) grava a hora de novo.
begin;
select plan(7);

insert into auth.users (id, aud, role, phone)
values ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', '5561900000096');

-- ---------------------------------------------------------------------------
-- Pelo app (authenticated)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated", "phone": "5561900000096"}';

select throws_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, cep, aceite_termos_em, aceite_termos_versao)
     values ('66666666-6666-4666-8666-666666666666', 'cliente', 'Novo', '5561900000096',
             '39053344705', '70040010', '2020-01-01', 'v1') $$,
  '42501',
  null,
  'o app não consegue mandar a hora do aceite'
);
select lives_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, cep, aceite_termos_versao)
     values ('66666666-6666-4666-8666-666666666666', 'cliente', 'Novo', '5561900000096',
             '39053344705', '70040010', 'v1') $$,
  'o cadastro urgente manda só a versão dos termos'
);
select is(
  (select aceite_termos_em from public.perfis where id = '66666666-6666-4666-8666-666666666666'),
  now(),
  'a hora do aceite é a do servidor'
);
select throws_ok(
  $$ update public.perfis set aceite_termos_em = '2020-01-01'
     where id = '66666666-6666-4666-8666-666666666666' $$,
  '42501',
  null,
  'o app não muda a hora do aceite'
);

reset role;

-- ---------------------------------------------------------------------------
-- Hora enviada por quem tem permissão também é descartada
-- ---------------------------------------------------------------------------
update public.perfis set aceite_termos_em = '2020-01-01'
where id = '66666666-6666-4666-8666-666666666666';

select is(
  (select aceite_termos_em from public.perfis where id = '66666666-6666-4666-8666-666666666666'),
  now(),
  'sem trocar a versão, a hora do aceite não muda'
);

-- Simula um aceite antigo para ver a hora mudar ao aceitar outra versão.
alter table public.perfis disable trigger perfis_aceite_termos_na_hora_do_servidor;
update public.perfis set aceite_termos_em = '2020-01-01'
where id = '66666666-6666-4666-8666-666666666666';
alter table public.perfis enable trigger perfis_aceite_termos_na_hora_do_servidor;

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated", "phone": "5561900000096"}';

select lives_ok(
  $$ update public.perfis set aceite_termos_versao = 'v2'
     where id = '66666666-6666-4666-8666-666666666666' $$,
  'o Cliente aceita uma versão nova dos termos'
);

reset role;

select is(
  (select aceite_termos_em from public.perfis where id = '66666666-6666-4666-8666-666666666666'),
  now(),
  'aceitar outra versão grava a hora do servidor de novo'
);

select * from finish();
rollback;
