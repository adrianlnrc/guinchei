-- Homologação por item (issue #42, ADR-0012): estados, auditoria imutável, RLS da tabela e
-- do bucket `documentos-prestadores`.
--
-- Usa a Frota pendente do seed ("Guincho Capital", dona Paulo Mendes): alvará aprovado, e
-- apólice de RC, CNH do Paulo e CRLV de um veículo pendentes. Marcos (outra Frota) e Rafael
-- (Cliente) são de fora; a operação é a do seed.
begin;
select plan(72);

-- ---------------------------------------------------------------------------
-- Bucket e estado inicial do seed
-- ---------------------------------------------------------------------------
select is(
  (select public from storage.buckets where id = 'documentos-prestadores'), false,
  'o bucket documentos-prestadores é privado'
);
select is(
  (select file_size_limit from storage.buckets where id = 'documentos-prestadores'), 10485760::bigint,
  'o bucket limita o arquivo a 10 MiB'
);
select ok(
  (select allowed_mime_types @> array['application/pdf'] and not allowed_mime_types @> array['video/mp4']
   from storage.buckets where id = 'documentos-prestadores'),
  'o bucket aceita PDF e imagem, não vídeo'
);
select is(
  (select count(*) from public.itens_homologacao where frota_id = 'f0000000-0000-4000-8000-000000000003'),
  4::bigint, 'o seed tem os quatro itens da Frota pendente'
);

-- Todos os pares de estados: a função aceita exatamente a tabela do cabeçalho da migração.
select results_eq(
  $$ select de::text, para::text
     from unnest(enum_range(null::public.estado_homologacao)) de,
          unnest(enum_range(null::public.estado_homologacao)) para
     where public.transicao_homologacao_valida(de, para)
     order by 1, 2 $$,
  $$ values ('aprovado', 'vencido'), ('pendente', 'aprovado'), ('pendente', 'recusado'),
            ('recusado', 'pendente'), ('vencido', 'pendente') $$,
  'só cinco transições de estado são válidas'
);

-- Arquivos que o Paulo "enviou" ao bucket (para reenviar e enviar).
insert into storage.objects (bucket_id, name, owner) values
  ('documentos-prestadores', '22222222-2222-4222-8222-222222222204/apolice-nova.pdf', '22222222-2222-4222-8222-222222222204'),
  ('documentos-prestadores', '22222222-2222-4222-8222-222222222204/selfie.jpg', '22222222-2222-4222-8222-222222222204'),
  ('documentos-prestadores', '22222222-2222-4222-8222-222222222204/cnh-nova.jpg', '22222222-2222-4222-8222-222222222204');

-- ---------------------------------------------------------------------------
-- Auditoria: entrada do item e transição, com hora do servidor
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.auditoria_homologacao where item_id = 'a1000000-0000-4000-8000-000000000002'),
  1::bigint, 'o envio de um item grava a primeira linha da trilha'
);
select results_eq(
  $$ select de::text, para::text from public.auditoria_homologacao
     where item_id = 'a1000000-0000-4000-8000-000000000001' order by id $$,
  $$ values (null::text, 'pendente'), ('pendente', 'aprovado') $$,
  'a trilha do alvará do seed mostra pendente e depois aprovado'
);

-- ---------------------------------------------------------------------------
-- Operação decide
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select lives_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000002', 'aprovado') $$,
  'a operação aprova um item pendente'
);
select is(
  (select estado::text from public.itens_homologacao where id = 'a1000000-0000-4000-8000-000000000002'),
  'aprovado', 'o item vira aprovado'
);
select is(
  (select decidido_por from public.itens_homologacao where id = 'a1000000-0000-4000-8000-000000000002'),
  '33333333-3333-4333-8333-333333333333'::uuid, 'o item guarda quem decidiu'
);
select results_eq(
  $$ select de::text, para::text, por, em = now() from public.auditoria_homologacao
     where item_id = 'a1000000-0000-4000-8000-000000000002' order by id desc limit 1 $$,
  $$ values ('pendente', 'aprovado', '33333333-3333-4333-8333-333333333333'::uuid, true) $$,
  'a trilha grava de qual estado para qual, quem decidiu e a hora do servidor'
);

select throws_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000003', 'recusado') $$,
  'GHM04', null, 'recusar sem motivo é rejeitado'
);
select throws_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000003', 'recusado', '   ') $$,
  'GHM04', null, 'recusar com motivo em branco é rejeitado'
);
select is(
  (select estado::text from public.itens_homologacao where id = 'a1000000-0000-4000-8000-000000000003'),
  'pendente', 'a recusa sem motivo não muda o item'
);
select lives_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000003', 'recusado', ' CNH ilegível ') $$,
  'a operação recusa com motivo'
);
select results_eq(
  $$ select estado::text, motivo from public.itens_homologacao where id = 'a1000000-0000-4000-8000-000000000003' $$,
  $$ values ('recusado', 'CNH ilegível') $$,
  'o item fica recusado com o motivo gravado'
);
select is(
  (select motivo from public.auditoria_homologacao
   where item_id = 'a1000000-0000-4000-8000-000000000003' and para = 'recusado'),
  'CNH ilegível', 'a trilha guarda o motivo da recusa'
);

-- Transições inválidas.
select throws_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000002', 'aprovado') $$,
  'GHM03', null, 'aprovar item já aprovado é rejeitado'
);
select throws_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000003', 'aprovado') $$,
  'GHM03', null, 'aprovar item recusado, sem reenvio, é rejeitado'
);
select throws_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000004', 'pendente') $$,
  'GHM03', null, 'decidir "pendente" não é decisão'
);
select throws_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000004', 'vencido') $$,
  'GHM03', null, 'a operação não vence item à mão'
);
select throws_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-0000000000ff', 'aprovado') $$,
  'P0002', null, 'item inexistente'
);
select throws_ok(
  $$ update public.itens_homologacao set estado = 'aprovado' where id = 'a1000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'nem a operação muda o estado por update direto'
);
select throws_ok(
  $$ delete from public.itens_homologacao where id = 'a1000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'nem a operação apaga item'
);

select is(
  (select count(*) from public.auditoria_homologacao), 7::bigint,
  'a operação lê a trilha inteira (4 entradas, a aprovação do seed, a aprovação e a recusa novas)'
);
select ok(
  (select count(*) from storage.objects where bucket_id = 'documentos-prestadores') = 3,
  'a operação lê todos os documentos do bucket'
);

reset role;

-- Item aprovado cuja validade passou vira vencido; aprovar item de validade passada não.
insert into public.itens_homologacao
  (id, frota_id, alvo, alvo_id, tipo, dono_id, arquivo, validade)
values
  ('a1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000003', 'frota',
   'f0000000-0000-4000-8000-000000000003', 'antecedentes', '22222222-2222-4222-8222-222222222204',
   '22222222-2222-4222-8222-222222222204/antigo.pdf', current_date - 1);

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000005', 'aprovado') $$,
  'GHM05', null, 'aprovar documento com a validade já vencida é rejeitado'
);
reset role;

-- A apólice (aprovada acima) tem a validade empurrada para ontem.
update public.itens_homologacao set validade = current_date - 1
where id = 'a1000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ select public.marcar_itens_vencidos() $$,
  '42501', null, 'a operação não roda o job de vencimento (só o servidor)'
);
reset role;

-- O job do pg_cron roda sem usuário logado.
set local request.jwt.claims to '{}';
select is(public.marcar_itens_vencidos(), 1::integer, 'o job vence só o item aprovado com validade passada');
select is(
  (select estado::text from public.itens_homologacao where id = 'a1000000-0000-4000-8000-000000000002'),
  'vencido', 'a apólice aprovada de validade passada está vencida'
);
select is(
  (select estado::text from public.itens_homologacao where id = 'a1000000-0000-4000-8000-000000000005'),
  'pendente', 'o item pendente não é vencido pelo job'
);
select results_eq(
  $$ select de::text, para::text, por, motivo like 'Validade vencida em %' from public.auditoria_homologacao
     where item_id = 'a1000000-0000-4000-8000-000000000002' order by id desc limit 1 $$,
  $$ values ('aprovado', 'vencido', null::uuid, true) $$,
  'a trilha mostra o vencimento feito pelo sistema, sem autor'
);
select is(public.marcar_itens_vencidos(), 0::integer, 'rodar o job de novo não muda nada');

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000002', 'aprovado') $$,
  'GHM03', null, 'aprovar item vencido, sem reenvio, é rejeitado'
);
reset role;

-- O trigger vale para todos: nem o servidor pula um estado.
select throws_ok(
  $$ update public.itens_homologacao set estado = 'aprovado' where id = 'a1000000-0000-4000-8000-000000000002' $$,
  'GHM03', null, 'o trigger recusa vencido -> aprovado até para o servidor'
);
select throws_ok(
  $$ update public.itens_homologacao set estado = 'vencido' where id = 'a1000000-0000-4000-8000-000000000004' $$,
  'GHM03', null, 'o trigger recusa pendente -> vencido'
);
select throws_ok(
  $$ insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo, estado)
     values ('f0000000-0000-4000-8000-000000000003', 'frota', 'f0000000-0000-4000-8000-000000000003',
             'selfie', '22222222-2222-4222-8222-222222222204',
             '22222222-2222-4222-8222-222222222204/x.jpg', 'aprovado') $$,
  'GHM03', null, 'o item nasce pendente'
);

-- ---------------------------------------------------------------------------
-- O dono (Paulo)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222204", "role": "authenticated"}';

select is(
  (select count(*) from public.itens_homologacao), 5::bigint, 'o dono lê os próprios itens'
);
select is_empty('select * from public.auditoria_homologacao', 'o dono não lê a trilha de auditoria');
select throws_ok(
  $$ select public.decidir_item_homologacao('a1000000-0000-4000-8000-000000000004', 'aprovado') $$,
  '42501', null, 'o dono não decide o próprio item'
);
select throws_ok(
  $$ update public.itens_homologacao set estado = 'aprovado' where id = 'a1000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'o dono não muda o estado por update'
);
select throws_ok(
  $$ delete from public.itens_homologacao where id = 'a1000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'o dono não apaga item'
);
select throws_ok(
  $$ delete from public.auditoria_homologacao $$,
  '42501', null, 'o dono não apaga a auditoria'
);
select throws_ok(
  $$ update public.auditoria_homologacao set motivo = 'x' $$,
  '42501', null, 'o dono não altera a auditoria'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao('a1000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222204/selfie.jpg') $$,
  'GHM03', null, 'item pendente não se reenvia'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao('a1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222204/nao-existe.jpg') $$,
  'GHM06', null, 'reenvio exige o arquivo no bucket'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao('a1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222204/cnh-nova.jpg', current_date - 1) $$,
  'GHM05', null, 'reenvio com validade vencida é rejeitado'
);
select lives_ok(
  $$ select public.reenviar_item_homologacao('a1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222204/cnh-nova.jpg', current_date + 700) $$,
  'o dono reenvia o item recusado'
);
select results_eq(
  $$ select estado::text, motivo, arquivo, enviado_em = now() from public.itens_homologacao
     where id = 'a1000000-0000-4000-8000-000000000003' $$,
  $$ values ('pendente', null, '22222222-2222-4222-8222-222222222204/cnh-nova.jpg', true) $$,
  'reenviar volta para pendente, limpa o motivo e põe o item no fim da fila'
);
select lives_ok(
  $$ select public.reenviar_item_homologacao('a1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222204/apolice-nova.pdf', current_date + 365) $$,
  'o dono reenvia o item vencido'
);

-- Item novo.
select throws_ok(
  $$ select public.enviar_item_homologacao('frota', '22222222-2222-4222-8222-222222222201', 'selfie', '22222222-2222-4222-8222-222222222204/selfie.jpg') $$,
  'GHM07', null, 'item de Frota só da própria Frota'
);
select throws_ok(
  $$ select public.enviar_item_homologacao('guincheiro', '22222222-2222-4222-8222-222222222201', 'selfie', '22222222-2222-4222-8222-222222222204/selfie.jpg') $$,
  'GHM07', null, 'item de Guincheiro só de quem é da própria Frota'
);
select throws_ok(
  $$ select public.enviar_item_homologacao('guincheiro', '22222222-2222-4222-8222-222222222204', 'selfie', '22222222-2222-4222-8222-222222222204/falta.jpg') $$,
  'GHM06', null, 'item novo exige o arquivo no bucket'
);
select throws_ok(
  $$ select public.enviar_item_homologacao('guincheiro', '22222222-2222-4222-8222-222222222204', 'selfie', '22222222-2222-4222-8222-222222222201/selfie.jpg') $$,
  'GHM06', null, 'o arquivo precisa estar na pasta do dono'
);
select lives_ok(
  $$ select public.enviar_item_homologacao('guincheiro', '22222222-2222-4222-8222-222222222204', 'selfie', '22222222-2222-4222-8222-222222222204/selfie.jpg') $$,
  'o Guincheiro envia item novo'
);
select throws_ok(
  $$ select public.enviar_item_homologacao('guincheiro', '22222222-2222-4222-8222-222222222204', 'selfie', '22222222-2222-4222-8222-222222222204/selfie.jpg') $$,
  '23505', null, 'um item por documento de cada alvo: refazer é reenviar'
);

-- Bucket.
select is(
  (select count(*) from storage.objects where bucket_id = 'documentos-prestadores'), 3::bigint,
  'o dono lê os próprios documentos'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('documentos-prestadores', '22222222-2222-4222-8222-222222222204/extra.pdf',
             '22222222-2222-4222-8222-222222222204') $$,
  'o Guincheiro envia à própria pasta'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('documentos-prestadores', '22222222-2222-4222-8222-222222222201/intruso.pdf',
             '22222222-2222-4222-8222-222222222204') $$,
  '42501', null, 'ninguém envia à pasta de outro'
);
select is_empty(
  $$ update storage.objects set name = name || '.bak'
     where bucket_id = 'documentos-prestadores' returning name $$,
  'o dono não sobrescreve nem renomeia documento enviado'
);
reset role;

-- Depois dos reenvios, a trilha tem as duas entradas do reenvio.
select is(
  (select count(*) from public.auditoria_homologacao
   where item_id in ('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003')
     and para = 'pendente' and de is not null and por = '22222222-2222-4222-8222-222222222204'),
  2::bigint, 'o reenvio entra na trilha com o autor'
);

-- ---------------------------------------------------------------------------
-- Trilha imutável, até para o servidor
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ update public.auditoria_homologacao set motivo = 'x' $$,
  '23514', null, 'a trilha não é atualizada'
);
select throws_ok(
  $$ delete from public.auditoria_homologacao $$,
  '23514', null, 'a trilha não é apagada'
);
select throws_ok(
  $$ truncate public.auditoria_homologacao $$,
  '23514', null, 'a trilha não é truncada'
);

-- ---------------------------------------------------------------------------
-- De fora: Guincheiro de outra Frota e Cliente
-- ---------------------------------------------------------------------------
-- Preparação (#50): os Guincheiros do seed (o Marcos inclusive) agora têm os próprios itens de
-- homologação, então o "Guincheiro de outra Frota" que não lê nada é um Guincheiro novo, da
-- Reboque Planalto e sem nenhum item.
reset role;
insert into auth.users (id, aud, role, phone)
values ('e7000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '5561900000711');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
values ('e7000000-0000-4000-8000-000000000001', 'guincheiro', 'Guincheiro de Fora', '5561900000711',
        '64720951325', 'teste');
insert into public.guincheiros (id, frota_id, posicao, disponivel)
values ('e7000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
        extensions.st_setsrid(extensions.st_makepoint(-47.88, -15.79), 4326), false);

set local role authenticated;
set local request.jwt.claims to '{"sub": "e7000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is_empty('select * from public.itens_homologacao', 'Guincheiro de outra Frota não lê os itens');
select is_empty(
  $$ select * from storage.objects where bucket_id = 'documentos-prestadores' $$,
  'Guincheiro de outra Frota não lê os documentos'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao('a1000000-0000-4000-8000-000000000003', 'e7000000-0000-4000-8000-000000000001/x.jpg') $$,
  'P0002', null, 'só o dono reenvia o item'
);

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select is_empty('select * from public.itens_homologacao', 'o Cliente não lê os itens');
select is_empty('select * from public.auditoria_homologacao', 'o Cliente não lê a trilha');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('documentos-prestadores', '11111111-1111-4111-8111-111111111111/doc.pdf',
             '11111111-1111-4111-8111-111111111111') $$,
  '42501', null, 'o Cliente não envia documento de prestador'
);
select throws_ok(
  $$ select public.enviar_item_homologacao('frota', 'f0000000-0000-4000-8000-000000000003', 'alvara', '11111111-1111-4111-8111-111111111111/doc.pdf') $$,
  '42501', null, 'o Cliente não envia item'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.itens_homologacao $$,
  '42501', null, 'anon não lê itens'
);
reset role;

select * from finish();
rollback;
