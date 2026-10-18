-- Usuários, Frotas e Guincheiros de teste. Só para o ambiente local (e e2e).
-- Nomes, documentos e telefones são fictícios; os CPFs e o CNPJ só passam no dígito
-- verificador. O login usa os números de teste de `[auth.sms.test_otp]` no config.toml
-- (código 123456), sem envio real. Tabela completa em docs/desenvolvimento.md.
--
-- Cenário do protótipo: o Cliente parado no Eixo Monumental (-15.7903, -47.8921). Os três
-- Guincheiros ficam a ~4,2 km (Cruzeiro), ~4,9 km (Asa Norte) e ~9,6 km (Guará).

-- Usuários do Auth, já com o telefone confirmado.
with usuarios (id, telefone) as (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid, '5561900000001'),
    ('22222222-2222-4222-8222-222222222201'::uuid, '5561900000002'),
    ('22222222-2222-4222-8222-222222222202'::uuid, '5561900000003'),
    ('22222222-2222-4222-8222-222222222203'::uuid, '5561900000004'),
    ('33333333-3333-4333-8333-333333333333'::uuid, '5561900000005'),
    ('22222222-2222-4222-8222-222222222204'::uuid, '5561900000007')
),
novos as (
  insert into auth.users (
    instance_id, id, aud, role, phone, phone_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    encrypted_password, confirmation_token, recovery_token, email_change_token_new,
    email_change, phone_change, phone_change_token, email_change_token_current,
    reauthentication_token
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', telefone, now(),
    '{"provider": "phone", "providers": ["phone"]}', '{}', now(), now(),
    '', '', '', '', '', '', '', '', ''
  from usuarios
  returning id, phone
)
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), id, id::text, 'phone',
  jsonb_build_object('sub', id::text, 'phone', phone, 'phone_verified', true),
  now(), now(), now()
from novos;

insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao)
values
  ('11111111-1111-4111-8111-111111111111', 'cliente', 'Rafael Souza', '5561900000001', '12345678062', now(), 'provisoria-2026-10'),
  ('22222222-2222-4222-8222-222222222201', 'guincheiro', 'Marcos Alves', '5561900000002', '23456789173', now(), 'provisoria-2026-10'),
  ('22222222-2222-4222-8222-222222222202', 'guincheiro', 'Wagner Lopes', '5561900000003', '34567891228', now(), 'provisoria-2026-10'),
  ('22222222-2222-4222-8222-222222222203', 'guincheiro', 'Rita Campos', '5561900000004', '45678912364', now(), 'provisoria-2026-10'),
  ('33333333-3333-4333-8333-333333333333', 'operacao', 'Operação Guinchei', '5561900000005', '56789123482', now(), 'provisoria-2026-10'),
  ('22222222-2222-4222-8222-222222222204', 'guincheiro', 'Paulo Mendes', '5561900000007', '67321845982', now(), 'provisoria-2026-10');

-- Uma empresa e uma autônoma (Frota de uma pessoa só, ADR-0012), ambas ativas.
insert into public.frotas (id, tipo, documento, nome, ativa) values
  ('f0000000-0000-4000-8000-000000000001', 'empresa', '11222333000181', 'Reboque Planalto', true),
  ('f0000000-0000-4000-8000-000000000002', 'autonomo', '45678912364', 'Rita Campos', true);

insert into public.guincheiros (id, frota_id, posicao, disponivel) values
  -- Cruzeiro
  ('22222222-2222-4222-8222-222222222201', 'f0000000-0000-4000-8000-000000000001',
    extensions.st_setsrid(extensions.st_makepoint(-47.9310, -15.7925), 4326), true),
  -- Asa Norte
  ('22222222-2222-4222-8222-222222222202', 'f0000000-0000-4000-8000-000000000001',
    extensions.st_setsrid(extensions.st_makepoint(-47.8830, -15.7470), 4326), true),
  -- Guará
  ('22222222-2222-4222-8222-222222222203', 'f0000000-0000-4000-8000-000000000002',
    extensions.st_setsrid(extensions.st_makepoint(-47.9750, -15.8230), 4326), true);

-- Frota pendente de exemplo para a demo da Homologação (#42): "Guincho Capital", ainda
-- inativa, com um Guincheiro indisponível (não entra no Match). Os arquivos não existem no
-- bucket `documentos-prestadores`: o Painel mostra "Documento indisponível" ao abri-los.
insert into public.frotas (id, tipo, documento, nome, ativa) values
  ('f0000000-0000-4000-8000-000000000003', 'empresa', '11444777000161', 'Guincho Capital', false);

insert into public.guincheiros (id, frota_id, posicao, disponivel) values
  -- Taguatinga
  ('22222222-2222-4222-8222-222222222204', 'f0000000-0000-4000-8000-000000000003',
    extensions.st_setsrid(extensions.st_makepoint(-48.0560, -15.8330), 4326), false);

insert into public.itens_homologacao
  (id, frota_id, alvo, alvo_id, tipo, dono_id, arquivo, validade, enviado_em)
values
  ('a1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'frota',
    'f0000000-0000-4000-8000-000000000003', 'alvara', '22222222-2222-4222-8222-222222222204',
    '22222222-2222-4222-8222-222222222204/alvara.pdf', null, now() - interval '3 days'),
  ('a1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'frota',
    'f0000000-0000-4000-8000-000000000003', 'apolice_rc', '22222222-2222-4222-8222-222222222204',
    '22222222-2222-4222-8222-222222222204/apolice-rc.pdf', current_date + 365,
    now() - interval '3 days'),
  ('a1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 'guincheiro',
    '22222222-2222-4222-8222-222222222204', 'cnh', '22222222-2222-4222-8222-222222222204',
    '22222222-2222-4222-8222-222222222204/cnh.jpg', current_date + 730,
    now() - interval '2 days'),
  ('a1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000003', 'veiculo',
    'b1000000-0000-4000-8000-000000000001', 'crlv', '22222222-2222-4222-8222-222222222204',
    '22222222-2222-4222-8222-222222222204/crlv.pdf', null, now() - interval '2 days');

-- O alvará já foi aprovado pela operação; os outros três aguardam.
update public.itens_homologacao
set estado = 'aprovado', decidido_em = now() - interval '1 day',
    decidido_por = '33333333-3333-4333-8333-333333333333'
where id = 'a1000000-0000-4000-8000-000000000001';
