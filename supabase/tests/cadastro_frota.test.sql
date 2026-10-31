-- Cadastro de Frota autônoma pelo app do Guincheiro (issue #43, ADR-0012, ADR-0007).
--
-- Aurora (5561900000008) é uma pessoa sem perfil: entra por telefone, grava o rascunho do
-- cadastro, envia os documentos ao bucket e envia o cadastro. O envio cria o perfil de
-- representante, a Frota inativa e os itens pendentes de homologação. Marcos (Guincheiro de
-- outra Frota), Rafael (Cliente) e a operação do seed são os de fora.
begin;
select plan(71);

-- Preparação (demo): o seed 05_demonstracao.sql traz a Frota "Cerrado Guinchos" (a representante,
-- dois Guincheiros, dois veículos e seus itens). Este teste conta as Frotas com representante
-- do seed original, então tira a Frota da demonstração do cenário.
delete from public.itens_homologacao where frota_id = 'f0000000-0000-4000-8000-000000000004';
delete from public.veiculos where frota_id = 'f0000000-0000-4000-8000-000000000004';
delete from public.guincheiros where frota_id = 'f0000000-0000-4000-8000-000000000004';
delete from public.frotas where id = 'f0000000-0000-4000-8000-000000000004';
delete from public.perfis
where id in ('d0d00000-0000-4000-8000-000000000001', 'd0d00000-0000-4000-8000-000000000002',
             'd0d00000-0000-4000-8000-000000000003');

insert into auth.users (id, aud, role, phone)
values ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', '5561900000008');

-- ---------------------------------------------------------------------------
-- Modelo
-- ---------------------------------------------------------------------------
select ok(
  'representante' = any (enum_range(null::public.papel)::text[]),
  'o enum de papéis ganha o representante, distinto de guincheiro'
);
select is(
  (select count(*) from public.frotas where representante_id is not null), 0::bigint,
  'as Frotas do seed não têm representante'
);
select is(
  (select count(*) from public.frotas where apolice_validade is not null), 1::bigint,
  'a validade da apólice acompanha o item de homologação (a Frota pendente do seed)'
);

-- ---------------------------------------------------------------------------
-- Rascunho: quem pode e quem lê
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "phone": "5561900000008"}';

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/alvara.pdf',
             '55555555-5555-4555-8555-555555555555') $$,
  '42501', null, 'sem rascunho nem perfil, ninguém envia documento de prestador'
);
select lives_ok(
  $$ insert into public.rascunhos_frota (tipo, etapa, dados) values ('autonomo', 1, '{}') $$,
  'quem não tem perfil abre o rascunho do cadastro'
);
select is(
  (select usuario_id from public.rascunhos_frota), '55555555-5555-4555-8555-555555555555'::uuid,
  'o rascunho é de quem o abriu (o servidor grava o dono)'
);
select throws_ok(
  $$ insert into public.rascunhos_frota (usuario_id, tipo) values ('22222222-2222-4222-8222-222222222201', 'autonomo') $$,
  '42501', null, 'ninguém abre rascunho em nome de outro'
);
select throws_ok(
  $$ insert into public.rascunhos_frota (tipo, etapa, dados) values ('autonomo', 6, '{}') $$,
  '23514', null, 'a etapa vai de 1 a 5'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/alvara.pdf',
             '55555555-5555-4555-8555-555555555555'),
            ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/apolice.pdf',
             '55555555-5555-4555-8555-555555555555') $$,
  'com o rascunho aberto, ela envia os documentos à própria pasta'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('documentos-prestadores', '22222222-2222-4222-8222-222222222201/intruso.pdf',
             '55555555-5555-4555-8555-555555555555') $$,
  '42501', null, 'e não à pasta de outro'
);

-- ---------------------------------------------------------------------------
-- Envio: validações do servidor (nada é criado quando alguma falha)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF02', null, 'rascunho vazio: o documento é o primeiro dado exigido'
);

update public.rascunhos_frota set dados = jsonb_build_object(
  'documento', '52998224725', 'nome', 'Aurora Lima Guinchos',
  'representante_nome', 'Aurora Lima', 'representante_cpf', '52998224725',
  'base_cep', '70000000', 'base_endereco', 'SQN 308 Bloco A, loja 2', 'base_bairro', 'Asa Norte',
  'chave_pix', 'aurora@exemplo.com',
  'apolice_validade', (public.hoje_em_brasilia() + 60)::text,
  'termos_versao', 'prestadores-provisoria-2026-10',
  'alvara_arquivo', '55555555-5555-4555-8555-555555555555/alvara.pdf',
  'apolice_arquivo', '55555555-5555-4555-8555-555555555555/apolice.pdf'
);

update public.rascunhos_frota set dados = dados || '{"documento": "52998224724"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF02', null, 'CPF com dígito verificador errado é recusado'
);
update public.rascunhos_frota set dados = dados || '{"documento": "123"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF02', null, 'documento que não é CPF nem CNPJ é recusado'
);
update public.rascunhos_frota set dados = dados || '{"documento": "52998224725", "representante_cpf": "39053344705"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF03', null, 'no autônomo de CPF, o representante é a própria pessoa'
);
update public.rascunhos_frota set dados = dados || '{"representante_cpf": "52998224724"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF03', null, 'o CPF do representante é validado'
);
update public.rascunhos_frota set dados = dados || '{"representante_cpf": "52998224725", "base_bairro": "  "}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF04', null, 'o endereço da base é obrigatório'
);
update public.rascunhos_frota set dados = dados || '{"base_bairro": "Asa Norte", "base_cep": "7000"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF04', null, 'o CEP tem 8 dígitos'
);
update public.rascunhos_frota set dados = (dados || '{"base_cep": "70000000"}') - 'chave_pix';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF04', null, 'a chave Pix é obrigatória'
);
update public.rascunhos_frota set dados = (dados || '{"chave_pix": "aurora@exemplo.com"}') - 'termos_versao';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF07', null, 'sem o aceite dos termos para prestadores não há cadastro'
);
update public.rascunhos_frota set dados = dados
  || jsonb_build_object('termos_versao', 'prestadores-provisoria-2026-10',
                        'apolice_validade', (public.hoje_em_brasilia() - 1)::text);
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF05', null, 'apólice já vencida é recusada'
);
update public.rascunhos_frota set dados = dados
  || jsonb_build_object('apolice_validade', (public.hoje_em_brasilia() + 29)::text);
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF05', null, 'apólice que vence em menos de 30 dias é recusada'
);
update public.rascunhos_frota set dados = dados - 'apolice_validade';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF05', null, 'apólice sem validade é recusada'
);
update public.rascunhos_frota set dados = dados
  || jsonb_build_object('apolice_validade', (public.hoje_em_brasilia() + 30)::text,
                        'alvara_arquivo', '55555555-5555-4555-8555-555555555555/falta.pdf');
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GHM06', null, 'o alvará precisa estar no bucket'
);
update public.rascunhos_frota set dados = dados
  || '{"alvara_arquivo": "22222222-2222-4222-8222-222222222201/alvara.pdf"}';
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GHM06', null, 'e na pasta de quem envia'
);
update public.rascunhos_frota set dados = dados
  || '{"alvara_arquivo": "55555555-5555-4555-8555-555555555555/alvara.pdf"}';

reset role;
select is(
  (select count(*) from public.frotas where documento = '52998224725')
  + (select count(*) from public.perfis where id = '55555555-5555-4555-8555-555555555555'),
  0::bigint, 'nenhum envio recusado deixa Frota ou perfil pela metade'
);

-- Documento já cadastrado por outra Frota.
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "phone": "5561900000008"}';
update public.rascunhos_frota set dados = dados
  || jsonb_build_object('documento', '45678912364', 'representante_cpf', '45678912364');
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  '23505', null, 'o documento de uma Frota já cadastrada não se repete'
);
update public.rascunhos_frota set dados = dados
  || '{"documento": "52998224725", "representante_cpf": "52998224725"}';

-- ---------------------------------------------------------------------------
-- Envio válido (apólice com exatamente 30 dias)
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'o cadastro completo é enviado (apólice que vence daqui a 30 dias passa)'
);
select is_empty('select * from public.rascunhos_frota', 'o rascunho some depois do envio');
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF01', null, 'sem rascunho, não há o que enviar'
);
select throws_ok(
  $$ insert into public.rascunhos_frota (tipo) values ('autonomo') $$,
  '42501', null, 'quem já tem Frota não abre outro rascunho'
);

reset role;
select results_eq(
  $$ select papel::text, telefone, nome, cpf, aceite_termos_versao
     from public.perfis where id = '55555555-5555-4555-8555-555555555555' $$,
  $$ values ('representante', '5561900000008', 'Aurora Lima', '52998224725',
             'prestadores-provisoria-2026-10') $$,
  'o perfil nasce representante, com o telefone verificado no login'
);
select results_eq(
  $$ select tipo::text, ativa, documento, nome, representante_id, base_cep, base_endereco,
            base_bairro, chave_pix, apolice_validade, termos_prestador_versao
     from public.frotas where documento = '52998224725' $$,
  $$ values ('autonomo', false, '52998224725', 'Aurora Lima Guinchos',
             '55555555-5555-4555-8555-555555555555'::uuid, '70000000', 'SQN 308 Bloco A, loja 2',
             'Asa Norte', 'aurora@exemplo.com', public.hoje_em_brasilia() + 30,
             'prestadores-provisoria-2026-10') $$,
  'a Frota nasce inativa, com todos os campos do ADR-0012'
);
select is(
  (select termos_prestador_em = now() from public.frotas where documento = '52998224725'),
  true, 'a hora do aceite dos termos de prestador é a do servidor'
);
select results_eq(
  $$ select alvo::text, tipo::text, estado::text, validade, dono_id, arquivo
     from public.itens_homologacao
     where frota_id = (select id from public.frotas where documento = '52998224725')
     order by tipo $$,
  $$ values
       ('frota', 'alvara', 'pendente', null::date, '55555555-5555-4555-8555-555555555555'::uuid,
        '55555555-5555-4555-8555-555555555555/alvara.pdf'),
       ('frota', 'apolice_rc', 'pendente', public.hoje_em_brasilia() + 30,
        '55555555-5555-4555-8555-555555555555'::uuid,
        '55555555-5555-4555-8555-555555555555/apolice.pdf') $$,
  'alvará e apólice (com validade) viram itens pendentes, do representante'
);
select is(
  (select count(*) from public.auditoria_homologacao a
   join public.itens_homologacao i on i.id = a.item_id
   where i.frota_id = (select id from public.frotas where documento = '52998224725')
     and a.para = 'pendente' and a.de is null and a.por = '55555555-5555-4555-8555-555555555555'),
  2::bigint, 'a entrada dos dois itens está na trilha, com o representante como autor'
);

-- ---------------------------------------------------------------------------
-- Operação enxerga a Frota na fila
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is(
  (select count(*) from public.itens_homologacao i
   join public.frotas f on f.id = i.frota_id
   where f.documento = '52998224725' and i.estado = 'pendente'),
  2::bigint, 'a operação vê os dois itens pendentes da nova Frota na fila'
);
select lives_ok(
  $$ select public.decidir_item_homologacao(i.id, 'recusado', 'Alvará ilegível')
     from public.itens_homologacao i
     where i.tipo = 'alvara' and i.dono_id = '55555555-5555-4555-8555-555555555555' $$,
  'a operação recusa o alvará'
);
select lives_ok(
  $$ select public.decidir_item_homologacao(i.id, 'recusado', 'Apólice sem a plataforma como cossegurada')
     from public.itens_homologacao i
     where i.tipo = 'apolice_rc' and i.dono_id = '55555555-5555-4555-8555-555555555555' $$,
  'a operação recusa a apólice'
);

-- ---------------------------------------------------------------------------
-- O representante: lê e edita a própria Frota enquanto não está ativa
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "phone": "5561900000008"}';

select results_eq(
  $$ select nome, ativa from public.frotas $$,
  $$ values ('Aurora Lima Guinchos', false) $$,
  'o representante lê a própria Frota e nenhuma outra'
);
select is(
  (select count(*) from public.itens_homologacao), 2::bigint,
  'lê os itens da própria Frota, com o motivo da recusa'
);
select is(
  (select motivo from public.itens_homologacao where tipo = 'alvara'), 'Alvará ilegível',
  'o motivo da recusa chega ao representante'
);
select is_empty('select * from public.auditoria_homologacao', 'a trilha continua só da operação');
select is_empty(
  $$ select * from public.frotas where id = 'f0000000-0000-4000-8000-000000000002' $$,
  'não lê a Frota de outro'
);
select results_eq(
  $$ update public.frotas set base_endereco = 'SQN 308 Bloco B', chave_pix = '61900000008',
       nome = 'Aurora Lima Reboques', base_cep = '70000001', base_bairro = 'Asa Norte II'
     returning base_endereco, chave_pix $$,
  $$ values ('SQN 308 Bloco B', '61900000008') $$,
  'edita nome, endereço da base e Pix enquanto a Frota não está ativa'
);
select throws_ok(
  $$ update public.frotas set ativa = true $$,
  '42501', null, 'não consegue se auto-ativar'
);
select throws_ok(
  $$ update public.frotas set documento = '39053344705' $$,
  '42501', null, 'o documento não se edita'
);
select throws_ok(
  $$ update public.frotas set representante_id = '22222222-2222-4222-8222-222222222201' $$,
  '42501', null, 'o representante não se troca'
);
select throws_ok(
  $$ update public.frotas set termos_prestador_em = '2020-01-01' $$,
  '42501', null, 'a hora do aceite não é do app'
);
select throws_ok(
  $$ update public.frotas set apolice_validade = '2099-01-01' $$,
  '42501', null, 'a validade da apólice só muda por reenvio do item'
);
select throws_ok(
  $$ insert into public.frotas (tipo, documento, nome) values ('autonomo', '39053344705', 'Outra') $$,
  '42501', null, 'não cria Frota direto (só pelo envio do cadastro)'
);
select is_empty(
  $$ update public.frotas set nome = 'Invadida' where id = 'f0000000-0000-4000-8000-000000000002' returning id $$,
  'não edita a Frota de outro'
);

-- Itens: o representante é o dono e reenvia o que foi recusado.
reset role;
insert into storage.objects (bucket_id, name, owner) values
  ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/alvara-2.pdf', '55555555-5555-4555-8555-555555555555'),
  ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/apolice-2.pdf', '55555555-5555-4555-8555-555555555555'),
  ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/veiculo.jpg', '55555555-5555-4555-8555-555555555555'),
  ('documentos-prestadores', '22222222-2222-4222-8222-222222222204/dele.jpg', '22222222-2222-4222-8222-222222222204');
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "phone": "5561900000008"}';

select lives_ok(
  $$ select public.reenviar_item_homologacao(i.id, '55555555-5555-4555-8555-555555555555/alvara-2.pdf')
     from public.itens_homologacao i where i.tipo = 'alvara' $$,
  'o representante reenvia o alvará recusado'
);
select lives_ok(
  $$ select public.reenviar_item_homologacao(i.id, '55555555-5555-4555-8555-555555555555/apolice-2.pdf',
       public.hoje_em_brasilia() + 90)
     from public.itens_homologacao i where i.tipo = 'apolice_rc' $$,
  'e a apólice, com a validade nova'
);
select is(
  (select apolice_validade from public.frotas), public.hoje_em_brasilia() + 90,
  'a validade da Frota acompanha o reenvio da apólice'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao(i.id, '55555555-5555-4555-8555-555555555555/apolice-2.pdf',
       public.hoje_em_brasilia() + 90)
     from public.itens_homologacao i where i.tipo = 'apolice_rc' $$,
  'GHM03', null, 'item pendente não se reenvia'
);
select lives_ok(
  $$ select public.enviar_item_homologacao('veiculo', gen_random_uuid(), 'foto_veiculo',
       '55555555-5555-4555-8555-555555555555/veiculo.jpg') $$,
  'o representante envia item de veículo da própria Frota'
);

-- ---------------------------------------------------------------------------
-- Frota ativa: o representante só lê
-- ---------------------------------------------------------------------------
reset role;
update public.frotas set ativa = true where documento = '52998224725';
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "phone": "5561900000008"}';
select is(
  (select ativa from public.frotas), true, 'o representante continua lendo a Frota ativa'
);
select is_empty(
  $$ update public.frotas set chave_pix = 'nova' returning id $$,
  'mas não edita depois da ativação (mudança passa de novo pela operação)'
);

-- ---------------------------------------------------------------------------
-- De fora
-- ---------------------------------------------------------------------------
-- Guincheiro de outra Frota (Marcos).
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated", "phone": "5561900000002"}';
select is_empty(
  $$ select * from public.frotas where documento = '52998224725' $$,
  'Guincheiro de outra Frota não lê a Frota nova'
);
select is_empty(
  $$ select * from public.itens_homologacao where dono_id = '55555555-5555-4555-8555-555555555555' $$,
  'nem os itens dela'
);
select is_empty('select * from public.rascunhos_frota', 'nem rascunho');
select throws_ok(
  $$ insert into public.rascunhos_frota (tipo) values ('autonomo') $$,
  '42501', null, 'quem já é Guincheiro não abre rascunho de Frota'
);

-- Guincheiro de Frota, sem ser o representante, não envia item da Frota (Paulo, Guincho Capital).
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222204", "role": "authenticated", "phone": "5561900000007"}';
select throws_ok(
  $$ select public.enviar_item_homologacao('frota', 'f0000000-0000-4000-8000-000000000003', 'alvara',
       '22222222-2222-4222-8222-222222222204/dele.jpg') $$,
  '42501', null, 'só o representante envia item da Frota'
);
select is_empty(
  $$ select * from public.itens_homologacao where dono_id = '55555555-5555-4555-8555-555555555555' $$,
  'o Guincheiro não lê itens do representante de outra Frota'
);

-- Cliente.
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated", "phone": "5561900000001"}';
select throws_ok(
  $$ insert into public.rascunhos_frota (tipo) values ('autonomo') $$,
  '42501', null, 'o Cliente não abre rascunho de Frota'
);
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  'GCF01', null, 'nem envia cadastro'
);
select is_empty('select * from public.rascunhos_frota', 'e não lê rascunho');
select is_empty(
  $$ select * from public.frotas where documento = '52998224725' $$,
  'o Cliente não lê a Frota nova'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.rascunhos_frota $$,
  '42501', null, 'anon não lê rascunho'
);
select throws_ok(
  $$ select public.enviar_cadastro_frota() $$,
  '42501', null, 'anon não envia cadastro'
);
reset role;

-- ---------------------------------------------------------------------------
-- Aceite dos termos de prestador: hora do servidor, só muda com a versão
-- ---------------------------------------------------------------------------
update public.frotas set termos_prestador_em = '2020-01-01' where documento = '52998224725';
select is(
  (select termos_prestador_em = now() from public.frotas where documento = '52998224725'),
  true, 'nem o servidor grava outra hora sem mudar a versão'
);

select * from finish();
rollback;
