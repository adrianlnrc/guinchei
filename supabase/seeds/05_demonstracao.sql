-- Dados da demonstração (roteiro em docs/produto/roteiro-de-demo.md). Só para o ambiente local.
--
-- ADITIVO: este arquivo só acrescenta linhas. Nada do 02_usuarios_de_teste.sql é alterado nem
-- apagado (ids, telefones, documentos e posições seguem como estão), porque os testes de banco,
-- a integração do `@guinchei/api` e o e2e do skeleton dependem deles.
--
-- A "Cerrado Guinchos" é a Frota para ver o vínculo Guincheiro × veículo (#48) e a ativação (#50):
--   - Helena Duarte (5561900000060) é a representante: entra no app do Guincheiro e cai na Frota;
--   - Cláudia Brito (5561900000061), CNH C, e Diego Ferraz (5561900000062), CNH B, são
--     Guincheiros da Frota, com os três documentos aprovados e fora do plantão;
--   - dois veículos aprovados: a plataforma CRB4G56 (4.200 kg: exige CNH C) e a lança CRB5H67
--     (3.500 kg: a CNH B cobre);
--   - NENHUM vínculo: é a Helena quem vincula na demo. Com o primeiro vínculo ativo a Frota passa a
--     "pronta para ativar" no Painel e a operação clica "Ativar". Até lá ela fica inativa, então
--     ninguém dela entra no Match nem na cotação.
-- A "Guincho Capital" (02_usuarios_de_teste.sql) segue pendente, para a operação aprovar na demo.
--
-- Os itens nascem aprovados, sem decisão a auditar: como no 02, a trilha de auditoria e o espelho
-- da validade da apólice na Frota ficam desligados enquanto eles entram (a Frota não ganha
-- `apolice_validade`). Os arquivos não existem no bucket `documentos-prestadores`: o Painel
-- mostra "Documento indisponível" ao abri-los. Nomes e documentos são fictícios (CPFs, CNPJ e
-- RENAVAMs só passam no dígito verificador) e nenhum repete valores do seed nem dos testes.

-- Usuários do Auth, já com o telefone confirmado.
with usuarios (id, telefone) as (
  values
    ('d0d00000-0000-4000-8000-000000000001'::uuid, '5561900000060'),
    ('d0d00000-0000-4000-8000-000000000002'::uuid, '5561900000061'),
    ('d0d00000-0000-4000-8000-000000000003'::uuid, '5561900000062')
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
  ('d0d00000-0000-4000-8000-000000000001', 'representante', 'Helena Duarte', '5561900000060', '38472951600', now(), 'prestadores-provisoria-2026-10'),
  ('d0d00000-0000-4000-8000-000000000002', 'guincheiro', 'Cláudia Brito', '5561900000061', '29518473609', now(), 'provisoria-2026-10'),
  ('d0d00000-0000-4000-8000-000000000003', 'guincheiro', 'Diego Ferraz', '5561900000062', '61748293591', now(), 'provisoria-2026-10');

-- A Frota nasce inativa e com a representante: o grupo do cadastro (base, Pix, termos) vem inteiro.
insert into public.frotas (
  id, tipo, documento, nome, ativa, representante_id,
  base_cep, base_endereco, base_bairro, chave_pix, termos_prestador_versao
) values (
  'f0000000-0000-4000-8000-000000000004', 'empresa', '27491836000192', 'Cerrado Guinchos', false,
  'd0d00000-0000-4000-8000-000000000001',
  '71200000', 'QE 28 Conjunto A Lote 10', 'Guará II', '27491836000192',
  'prestadores-provisoria-2026-10'
);

-- Fora do plantão (`disponivel = false`): quem liga é o Guincheiro, depois de a Frota ser ativada.
insert into public.guincheiros (id, frota_id, posicao, disponivel) values
  -- Asa Sul, ~1,4 km do Eixo Monumental: a mais perto do Cliente do cenário quando ativa.
  ('d0d00000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000004',
    extensions.st_setsrid(extensions.st_makepoint(-47.9000, -15.8000), 4326), false),
  -- Samambaia
  ('d0d00000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000004',
    extensions.st_setsrid(extensions.st_makepoint(-48.0900, -15.8750), 4326), false);

-- Placa Mercosul e RENAVAM válidos só no dígito verificador.
insert into public.veiculos (id, frota_id, placa, renavam, tipo, pbt_kg) values
  ('b1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000004',
    'CRB4G56', '48291756039', 'plataforma', 4200),
  ('b1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000004',
    'CRB5H67', '30749158265', 'lanca', 3500);

-- CNH (número fictício, único) e certidão emitida há 20 dias (vale 12 meses).
insert into public.documentos_guincheiro
  (guincheiro_id, cnh_numero, cnh_categoria, cnh_validade, cnh_ear, antecedentes_emissao)
values
  ('d0d00000-0000-4000-8000-000000000002', '52839417601', 'C', current_date + 730, true, current_date - 20),
  ('d0d00000-0000-4000-8000-000000000003', '63947285103', 'B', current_date + 730, true, current_date - 20);

alter table public.itens_homologacao disable trigger itens_homologacao_auditar;
alter table public.itens_homologacao disable trigger itens_homologacao_sincronizar_apolice;

-- Itens: alvará e apólice da Frota e CRLV e foto de cada veículo (a representante é a dona, como
-- no cadastro pelo app); CNH, certidão e selfie de cada Guincheiro (o dono é ele).
insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo, validade)
select i.frota_id, i.alvo::public.alvo_homologacao, i.alvo_id, i.tipo::public.tipo_item_homologacao,
       i.dono_id, i.dono_id::text || '/demo-' || right(i.alvo_id::text, 4) || '-' || i.tipo || '.pdf',
       i.validade
from (
  values
    ('f0000000-0000-4000-8000-000000000004'::uuid, 'frota', 'f0000000-0000-4000-8000-000000000004'::uuid, 'alvara', 'd0d00000-0000-4000-8000-000000000001'::uuid, null::date),
    ('f0000000-0000-4000-8000-000000000004', 'frota', 'f0000000-0000-4000-8000-000000000004', 'apolice_rc', 'd0d00000-0000-4000-8000-000000000001', current_date + 400),
    ('f0000000-0000-4000-8000-000000000004', 'veiculo', 'b1000000-0000-4000-8000-000000000004', 'crlv', 'd0d00000-0000-4000-8000-000000000001', null),
    ('f0000000-0000-4000-8000-000000000004', 'veiculo', 'b1000000-0000-4000-8000-000000000004', 'foto_veiculo', 'd0d00000-0000-4000-8000-000000000001', null),
    ('f0000000-0000-4000-8000-000000000004', 'veiculo', 'b1000000-0000-4000-8000-000000000005', 'crlv', 'd0d00000-0000-4000-8000-000000000001', null),
    ('f0000000-0000-4000-8000-000000000004', 'veiculo', 'b1000000-0000-4000-8000-000000000005', 'foto_veiculo', 'd0d00000-0000-4000-8000-000000000001', null),
    ('f0000000-0000-4000-8000-000000000004', 'guincheiro', 'd0d00000-0000-4000-8000-000000000002', 'cnh', 'd0d00000-0000-4000-8000-000000000002', current_date + 730),
    ('f0000000-0000-4000-8000-000000000004', 'guincheiro', 'd0d00000-0000-4000-8000-000000000002', 'antecedentes', 'd0d00000-0000-4000-8000-000000000002', (current_date - 20 + interval '12 months')::date),
    ('f0000000-0000-4000-8000-000000000004', 'guincheiro', 'd0d00000-0000-4000-8000-000000000002', 'selfie', 'd0d00000-0000-4000-8000-000000000002', null),
    ('f0000000-0000-4000-8000-000000000004', 'guincheiro', 'd0d00000-0000-4000-8000-000000000003', 'cnh', 'd0d00000-0000-4000-8000-000000000003', current_date + 730),
    ('f0000000-0000-4000-8000-000000000004', 'guincheiro', 'd0d00000-0000-4000-8000-000000000003', 'antecedentes', 'd0d00000-0000-4000-8000-000000000003', (current_date - 20 + interval '12 months')::date),
    ('f0000000-0000-4000-8000-000000000004', 'guincheiro', 'd0d00000-0000-4000-8000-000000000003', 'selfie', 'd0d00000-0000-4000-8000-000000000003', null)
) as i (frota_id, alvo, alvo_id, tipo, dono_id, validade);

-- A operação aprova tudo. A Frota segue inativa: sem vínculo ela não cumpre a regra de ativação,
-- e a ativação é sempre um clique da operação no Painel.
update public.itens_homologacao
set estado = 'aprovado', decidido_em = now(),
    decidido_por = '33333333-3333-4333-8333-333333333333'
where frota_id = 'f0000000-0000-4000-8000-000000000004';

alter table public.itens_homologacao enable trigger itens_homologacao_auditar;
alter table public.itens_homologacao enable trigger itens_homologacao_sincronizar_apolice;
