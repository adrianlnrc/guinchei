-- Fotos de estado: hora do servidor, autor, RLS da tabela e do bucket (ADR-0011).
--
-- Corrida A: Cliente A (seed) e G2 (Wagner). Cliente B e G1 são de fora.
begin;
select plan(17);

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao)
values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Cliente B', '5561900000099',
        '11144477735', now(), 'v1');

insert into public.pedidos (
  id, cliente_id, tipo_veiculo, situacao, rodas_giram,
  origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
  tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
) values (
  'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
  'carro', 'nao_liga', 'sim',
  extensions.st_makepoint(-47.8921, -15.7903), 'Eixo Monumental',
  extensions.st_makepoint(-48.0560, -15.8100), 'QNA 12, Taguatinga Norte',
  4.2, 21.3, 1, 11000, 2100, 12780, 25880
);
insert into public.corridas (id, pedido_id, guincheiro_id, repasse)
values ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        '22222222-2222-4222-8222-222222222202', 20984);

select is(
  (select public from storage.buckets where id = 'fotos-estado'),
  false,
  'o bucket fotos-estado é privado'
);

-- ---------------------------------------------------------------------------
-- Hora do servidor
-- ---------------------------------------------------------------------------
insert into public.fotos_estado (id, corrida_id, autor_id, tipo, caminho, criado_em)
values ('f0f0f0f0-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
        '22222222-2222-4222-8222-222222222202', 'foto',
        'cccccccc-0000-4000-8000-000000000001/servidor.jpg', '2020-01-01 00:00:00-03');

select is(
  (select criado_em from public.fotos_estado where id = 'f0f0f0f0-0000-4000-8000-000000000001'),
  now(),
  'criado_em enviado é descartado e o servidor grava a própria hora'
);
select is(
  (select papel_autor::text from public.fotos_estado where id = 'f0f0f0f0-0000-4000-8000-000000000001'),
  'guincheiro',
  'o papel do autor vem da Corrida'
);
select throws_ok(
  $$ update public.fotos_estado set criado_em = '2020-01-01' where id = 'f0f0f0f0-0000-4000-8000-000000000001' $$,
  '23514',
  'Fotos de estado não podem ser alteradas',
  'Foto de estado gravada não muda'
);

-- ---------------------------------------------------------------------------
-- Cliente A (participante)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.fotos_estado (corrida_id, tipo, caminho, criado_em)
     values ('cccccccc-0000-4000-8000-000000000001', 'foto',
             'cccccccc-0000-4000-8000-000000000001/cliente-0.jpg', '2020-01-01') $$,
  '42501',
  null,
  'o app não consegue mandar criado_em'
);
select lives_ok(
  $$ insert into public.fotos_estado (corrida_id, tipo, caminho, latitude, longitude)
     values ('cccccccc-0000-4000-8000-000000000001', 'video',
             'cccccccc-0000-4000-8000-000000000001/cliente-1.mp4', -15.7903, -47.8921) $$,
  'Cliente da Corrida registra Foto de estado'
);
select throws_ok(
  $$ insert into public.fotos_estado (corrida_id, autor_id, tipo, caminho)
     values ('cccccccc-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222202', 'foto',
             'cccccccc-0000-4000-8000-000000000001/forjada.jpg') $$,
  '42501',
  null,
  'ninguém registra em nome de outro autor'
);
select is(
  (select count(*) from public.fotos_estado), 2::bigint,
  'Cliente da Corrida lê as Fotos de estado dos dois lados'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('fotos-estado', 'cccccccc-0000-4000-8000-000000000001/cliente-1.mp4',
             '11111111-1111-4111-8111-111111111111') $$,
  'Cliente da Corrida envia arquivo ao bucket'
);

reset role;

-- Arquivo do Guincheiro da Corrida.
insert into storage.objects (bucket_id, name, owner)
values ('fotos-estado', 'cccccccc-0000-4000-8000-000000000001/servidor.jpg',
        '22222222-2222-4222-8222-222222222202');

-- ---------------------------------------------------------------------------
-- Guincheiro da Corrida
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222202", "role": "authenticated"}';

select is(
  (select count(*) from storage.objects where bucket_id = 'fotos-estado'), 2::bigint,
  'Guincheiro da Corrida lê os arquivos da Corrida, inclusive os do Cliente'
);

reset role;

-- ---------------------------------------------------------------------------
-- Cliente B e G1 (de fora)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';

select is_empty('select * from public.fotos_estado', 'Cliente B não lê Fotos de estado da Corrida A');
select is_empty(
  $$ select * from storage.objects where bucket_id = 'fotos-estado' $$,
  'Cliente B não lê os arquivos da Corrida A'
);
select throws_ok(
  $$ insert into public.fotos_estado (corrida_id, tipo, caminho)
     values ('cccccccc-0000-4000-8000-000000000001', 'foto',
             'cccccccc-0000-4000-8000-000000000001/intruso.jpg') $$,
  '23514', -- o trigger de autor barra antes da política de RLS, que também barraria
  'O autor da Foto de estado precisa ser o Cliente ou o Guincheiro da Corrida',
  'Cliente B não registra Foto de estado na Corrida A'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('fotos-estado', 'cccccccc-0000-4000-8000-000000000001/intruso.jpg',
             '44444444-4444-4444-8444-444444444444') $$,
  '42501',
  null,
  'Cliente B não envia arquivo para a pasta da Corrida A'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated"}';

select is_empty(
  $$ select * from storage.objects where bucket_id = 'fotos-estado' $$,
  'Guincheiro de outra Corrida não lê os arquivos'
);

reset role;

-- ---------------------------------------------------------------------------
-- Operação e anon
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select is(
  (select count(*) from storage.objects where bucket_id = 'fotos-estado'), 2::bigint,
  'operação lê todos os arquivos'
);

reset role;

set local role anon;

select is_empty(
  $$ select * from storage.objects where bucket_id = 'fotos-estado' $$,
  'anon não lê o bucket'
);

reset role;

select * from finish();
rollback;
