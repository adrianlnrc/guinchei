-- Validação de CPF/CNPJ e dos dados do cadastro (ADR-0010, ADR-0012).
begin;
select plan(12);

select ok(public.cpf_valido('12345678909'), 'CPF com dígitos verificadores corretos é válido');
select ok(not public.cpf_valido('12345678900'), 'CPF com dígito verificador errado é inválido');
select ok(not public.cpf_valido('11111111111'), 'CPF com todos os dígitos iguais é inválido');
select ok(not public.cpf_valido('123.456.789-09'), 'CPF com máscara é inválido (grava só dígitos)');
select ok(public.cnpj_valido('11222333000181'), 'CNPJ numérico válido');
select ok(not public.cnpj_valido('11222333000182'), 'CNPJ com dígito verificador errado é inválido');
select ok(public.cnpj_valido('12ABC34501DE35'), 'CNPJ alfanumérico (IN RFB 2.229/2024) válido');

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');

select throws_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao)
     values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Teste', '5561900000099',
             '12345678900', now(), 'v1') $$,
  '23514',
  null,
  'perfil com CPF inválido é rejeitado'
);

select throws_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao)
     values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Teste', '5561900000099',
             '12345678062', now(), 'v1') $$,
  '23505',
  null,
  'CPF é único por conta'
);

select throws_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao,
                                data_nascimento)
     values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Teste', '5561900000099',
             '11144477735', now(), 'v1', current_date - interval '17 years') $$,
  '23514',
  null,
  'data de nascimento de menor de 18 anos é rejeitada'
);

select lives_ok(
  $$ insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao,
                                data_nascimento)
     values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Teste', '5561900000099',
             '11144477735', now(), 'v1', current_date - interval '18 years') $$,
  'Cliente com 18 anos completos e CPF válido é aceito'
);

select throws_ok(
  $$ insert into public.frotas (tipo, documento, nome) values ('empresa', '12345678909', 'X') $$,
  '23514',
  null,
  'Frota empresa exige CNPJ'
);

select * from finish();
rollback;
