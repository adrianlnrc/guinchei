-- Convites de Guincheiro de exemplo (issue #46). Só para o ambiente local (e e2e).
--
-- O 5561900000046 foi convidado pela Reboque Planalto e ainda não tem usuário nem perfil: ao
-- entrar no app do Guincheiro, cai no primeiro acesso (nome, CPF e termos). O 5561900000047
-- (também em `[auth.sms.test_otp]`) fica sem convite, para o e2e convidar pelo representante.
-- Sem `criado_por`: a Frota do seed não tem representante.
insert into public.convites_guincheiro (frota_id, telefone)
values ('f0000000-0000-4000-8000-000000000001', '5561900000046');
