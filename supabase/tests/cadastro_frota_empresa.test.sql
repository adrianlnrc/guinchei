-- Cadastro de Frota empresa pelo app do Guincheiro (issue #44, ADR-0012).
--
-- Helena (5561900000044) é a representante de uma empresa: entra por telefone, grava o
-- rascunho com tipo 'empresa' e envia o cadastro com o CNPJ (alfanumérico, que a regra do
-- banco aceita). Ela não dirige: o envio cria perfil de representante e Frota, nunca um
-- Guincheiro. Bruno (5561900000045) é o representante de outra empresa, que tenta repetir o
-- CNPJ da primeira. Marcos (Guincheiro de outra Frota) e Rafael (Cliente) são os de fora.
begin;
select plan(37);

insert into auth.users (id, aud, role, phone) values
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', '5561900000044'),
  ('77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', '5561900000045');

-- ---------------------------------------------------------------------------
-- Rascunho e documentos da empresa
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated", "phone": "5561900000044"}';

select lives_ok(
  $$ insert into public.rascunhos_frota (tipo, etapa, dados) values ('empresa', 1, '{}') $$,
  'quem não tem perfil abre o rascunho do cadastro de empresa'
);
select is(
  (select tipo::text from public.rascunhos_frota), 'empresa', 'o rascunho guarda o tipo da Frota'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('documentos-prestadores', '66666666-6666-4666-8666-666666666666/alvara.pdf',
             '66666666-6666-4666-8666-666666666666'),
            ('documentos-prestadores', '66666666-6666-4666-8666-666666666666/apolice.pdf',
             '66666666-6666-4666-8666-666666666666') $$,
  'com o rascunho aberto, a representante envia os documentos à própria pasta'
);

-- ---------------------------------------------------------------------------
-- Envio: a mesma validação de documento do banco (frotas_documento_valido)
-- ---------------------------------------------------------------------------
update public.rascunhos_frota set etapa = 5, dados = jsonb_build_object(
  'documento', '12ABC34501DE35', 'nome', 'Reboque Horizonte Ltda',
  'representante_nome', 'Helena Prado', 'representante_cpf', '52998224725',
  'base_cep', '71000000', 'base_endereco', 'SIA Trecho 3, lote 10', 'base_bairro', 'SIA',
  'chave_pix', '12ABC34501DE35',
  'apolice_validade', (public.hoje_em_brasilia() + 60)::text,
  'termos_versao', 'prestadores-provisoria-2026-10',
  'alvara_arquivo', '66666666-6666-4666-8666-666666666666/alvara.pdf',
  'apolice_arquivo', '66666666-6666-4666-8666-666666666666/apolice.pdf'
);

update public.rascunhos_frota set dados = dados || '{"documento": "52998224725"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF02', null, 'a empresa não aceita CPF no lugar do CNPJ'
);
update public.rascunhos_frota set dados = dados || '{"documento": "12ABC34501DE36"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF02', null, 'CNPJ alfanumérico com dígito verificador errado é recusado'
);
update public.rascunhos_frota set dados = dados || '{"documento": "11222333000182"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF02', null, 'CNPJ numérico com dígito verificador errado é recusado'
);
update public.rascunhos_frota set dados = dados || '{"documento": "12ABC34501DE35", "representante_cpf": "52998224724"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF03', null, 'o CPF do representante é validado'
);
update public.rascunhos_frota set dados = dados || '{"representante_cpf": "52998224725", "representante_nome": " "}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF04', null, 'o nome do representante é obrigatório'
);
update public.rascunhos_frota set dados = dados || '{"representante_nome": "Helena Prado"}';

select lives_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'o cadastro da empresa é enviado, com o CPF do representante diferente do documento'
);
select is_empty('select * from public.rascunhos_frota', 'o rascunho some depois do envio');

reset role;
select results_eq(
  $$ select tipo::text, ativa, documento, nome, representante_id from public.frotas
     where documento = '12ABC34501DE35' $$,
  $$ values ('empresa', false, '12ABC34501DE35', 'Reboque Horizonte Ltda',
             '66666666-6666-4666-8666-666666666666'::uuid) $$,
  'a Frota nasce empresa e inativa, com a representante'
);
select results_eq(
  $$ select papel::text, nome, cpf, telefone from public.perfis
     where id = '66666666-6666-4666-8666-666666666666' $$,
  $$ values ('representante', 'Helena Prado', '52998224725', '5561900000044') $$,
  'o perfil nasce representante, com o telefone verificado no login'
);
select is_empty(
  $$ select * from public.guincheiros where id = '66666666-6666-4666-8666-666666666666' $$,
  'a representante não vira Guincheiro'
);
select results_eq(
  $$ select tipo::text, estado::text, dono_id from public.itens_homologacao
     where frota_id = (select id from public.frotas where documento = '12ABC34501DE35')
     order by tipo $$,
  $$ values ('alvara', 'pendente', '66666666-6666-4666-8666-666666666666'::uuid),
            ('apolice_rc', 'pendente', '66666666-6666-4666-8666-666666666666'::uuid) $$,
  'alvará e apólice entram pendentes, da representante'
);

-- ---------------------------------------------------------------------------
-- CNPJ duplicado: a coluna documento é única
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "77777777-7777-4777-8777-777777777777", "role": "authenticated", "phone": "5561900000045"}';
insert into public.rascunhos_frota (tipo, etapa, dados) values ('empresa', 5, '{}');
insert into storage.objects (bucket_id, name, owner) values
  ('documentos-prestadores', '77777777-7777-4777-8777-777777777777/alvara.pdf', '77777777-7777-4777-8777-777777777777'),
  ('documentos-prestadores', '77777777-7777-4777-8777-777777777777/apolice.pdf', '77777777-7777-4777-8777-777777777777');
update public.rascunhos_frota set dados = jsonb_build_object(
  'documento', '12ABC34501DE35', 'nome', 'Reboque Duplicado Ltda',
  'representante_nome', 'Bruno Reis', 'representante_cpf', '39053344705',
  'base_cep', '71000000', 'base_endereco', 'SIA Trecho 4, lote 1', 'base_bairro', 'SIA',
  'chave_pix', 'bruno@exemplo.com',
  'apolice_validade', (public.hoje_em_brasilia() + 60)::text,
  'termos_versao', 'prestadores-provisoria-2026-10',
  'alvara_arquivo', '77777777-7777-4777-8777-777777777777/alvara.pdf',
  'apolice_arquivo', '77777777-7777-4777-8777-777777777777/apolice.pdf'
);
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  '23505', null, 'o CNPJ de uma Frota que já existe é recusado'
);
update public.rascunhos_frota set dados = dados || '{"documento": "11222333000181"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  '23505', null, 'e o de uma Frota do seed também'
);
select is(
  (select count(*) from public.rascunhos_frota), 1::bigint,
  'o rascunho continua, para corrigir o CNPJ e tentar de novo'
);

-- ---------------------------------------------------------------------------
-- O representante da empresa: lê e edita só a própria Frota, enquanto inativa
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select lives_ok(
  $$ select public.decidir_item_homologacao(i.id, 'recusado', 'Alvará vencido na prefeitura')
     from public.itens_homologacao i
     where i.tipo = 'alvara' and i.dono_id = '66666666-6666-4666-8666-666666666666' $$,
  'a operação recusa o alvará da empresa'
);

set local request.jwt.claims to '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated", "phone": "5561900000044"}';
select results_eq(
  $$ select nome, tipo::text from public.frotas $$,
  $$ values ('Reboque Horizonte Ltda', 'empresa') $$,
  'a representante lê a própria Frota e nenhuma outra'
);
select is(
  (select motivo from public.itens_homologacao where tipo = 'alvara'),
  'Alvará vencido na prefeitura', 'lê o motivo da recusa'
);
select results_eq(
  $$ update public.frotas set nome = 'Reboque Horizonte Transportes Ltda', chave_pix = 'pix@horizonte.com'
     returning nome, chave_pix $$,
  $$ values ('Reboque Horizonte Transportes Ltda', 'pix@horizonte.com') $$,
  'edita razão social e Pix enquanto a Frota não está ativa'
);
select throws_ok(
  $$ update public.frotas set ativa = true $$,
  '42501', null, 'não consegue se auto-ativar'
);
select throws_ok(
  $$ update public.frotas set documento = '11444777000161' $$,
  '42501', null, 'o CNPJ não se edita'
);
select throws_ok(
  $$ update public.frotas set tipo = 'autonomo' $$,
  '42501', null, 'o tipo da Frota não se edita'
);
select is_empty(
  $$ update public.frotas set nome = 'Invadida' where documento = '11222333000181' returning id $$,
  'não edita a Frota de outro'
);

-- ---------------------------------------------------------------------------
-- Reenvio do item recusado: volta a pendente e à fila da operação
-- ---------------------------------------------------------------------------
reset role;
insert into storage.objects (bucket_id, name, owner) values
  ('documentos-prestadores', '66666666-6666-4666-8666-666666666666/alvara-2.pdf', '66666666-6666-4666-8666-666666666666'),
  ('documentos-prestadores', '77777777-7777-4777-8777-777777777777/dele.pdf', '77777777-7777-4777-8777-777777777777');
set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated", "phone": "5561900000044"}';

select throws_ok(
  $$ select public.reenviar_item_homologacao(i.id, '66666666-6666-4666-8666-666666666666/alvara-2.pdf')
     from public.itens_homologacao i where i.tipo = 'apolice_rc' $$,
  'GHM03', null, 'item pendente não se reenvia'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao(i.id, '66666666-6666-4666-8666-666666666666/nao-existe.pdf')
     from public.itens_homologacao i where i.tipo = 'alvara' $$,
  'GHM06', null, 'o arquivo novo precisa estar no bucket'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao(i.id, '77777777-7777-4777-8777-777777777777/dele.pdf')
     from public.itens_homologacao i where i.tipo = 'alvara' $$,
  'GHM06', null, 'e na pasta da representante'
);
select lives_ok(
  $$ select public.reenviar_item_homologacao(i.id, '66666666-6666-4666-8666-666666666666/alvara-2.pdf')
     from public.itens_homologacao i where i.tipo = 'alvara' $$,
  'a representante reenvia o alvará recusado'
);
select results_eq(
  $$ select estado::text, motivo, arquivo from public.itens_homologacao where tipo = 'alvara' $$,
  $$ values ('pendente', null::text, '66666666-6666-4666-8666-666666666666/alvara-2.pdf') $$,
  'o item volta a pendente, sem o motivo e com o arquivo novo'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao('a1000000-0000-4000-8000-000000000001',
       '66666666-6666-4666-8666-666666666666/alvara-2.pdf') $$,
  'P0002', null, 'item de outra Frota não se reenvia'
);

reset role;
select is(
  (select count(*) from public.itens_homologacao
   where frota_id = (select id from public.frotas where documento = '12ABC34501DE35')
     and estado = 'pendente'),
  2::bigint, 'os dois itens estão pendentes na fila de homologação'
);
select is(
  (select count(*) from public.auditoria_homologacao a
   join public.itens_homologacao i on i.id = a.item_id
   where i.tipo = 'alvara' and i.frota_id = (select id from public.frotas where documento = '12ABC34501DE35')
     and a.de = 'recusado' and a.para = 'pendente'
     and a.por = '66666666-6666-4666-8666-666666666666'),
  1::bigint, 'o reenvio está na trilha de auditoria, com a representante como autora'
);

-- ---------------------------------------------------------------------------
-- De fora
-- ---------------------------------------------------------------------------
-- Guincheiro de outra Frota (Marcos) e Cliente (Rafael).
create temp table item_da_empresa as
  select id from public.itens_homologacao
  where tipo = 'alvara' and dono_id = '66666666-6666-4666-8666-666666666666';
grant select on item_da_empresa to authenticated;
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated", "phone": "5561900000002"}';
select is_empty(
  $$ select * from public.frotas where documento = '12ABC34501DE35' $$,
  'Guincheiro de outra Frota não lê a empresa nova'
);
select is_empty(
  $$ select * from public.itens_homologacao where dono_id = '66666666-6666-4666-8666-666666666666' $$,
  'nem os itens dela'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao(id, '22222222-2222-4222-8222-222222222201/x.pdf')
     from item_da_empresa $$,
  'P0002', null, 'nem reenvia o item dela'
);

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated", "phone": "5561900000001"}';
select throws_ok(
  $$ insert into public.rascunhos_frota (tipo) values ('empresa') $$,
  '42501', null, 'o Cliente não abre rascunho de empresa'
);

reset role;
select * from finish();
rollback;
