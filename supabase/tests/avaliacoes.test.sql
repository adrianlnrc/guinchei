-- Avaliação da Corrida pelo Cliente (RF13): RPC avaliar_corrida, RLS de leitura, hora do
-- servidor, imutabilidade e nota_media_desde.
--
-- Usuários do seed: Cliente A (Rafael), G1 Marcos, G2 Wagner, G3 Rita e a operação. Aqui se
-- cria o Cliente B e o cenário:
--   Corrida 1: Cliente A e G2, entregue.
--   Corrida 2: Cliente B e G1, entregue.
--   Corrida 4: Cliente A e G3, entregue.
--   Corrida 3: Cliente A e G2, ainda `aceita` (não pode ser avaliada).
begin;
select plan(39);

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao)
values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Cliente B', '5561900000099',
        '11144477735', now(), 'v1');

insert into public.pedidos (
  id, cliente_id, tipo_veiculo, situacao, rodas_giram,
  origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
  tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', '11111111-1111-4111-8111-111111111111',
   'carro', 'nao_liga', 'sim',
   extensions.st_makepoint(-47.8921, -15.7903), 'Eixo Monumental',
   extensions.st_makepoint(-48.0560, -15.8100), 'QNA 12, Taguatinga Norte',
   4.2, 21.3, 1, 11000, 2100, 12780, 25880),
  ('aaaaaaaa-0000-4000-8000-0000000000a2', '44444444-4444-4444-8444-444444444444',
   'moto', 'batida', 'nao',
   extensions.st_makepoint(-47.9000, -15.8000), 'Setor Policial Sul',
   extensions.st_makepoint(-47.9500, -15.8300), 'Guará II',
   3, 6, 1, 11000, 1500, 3600, 16100),
  ('aaaaaaaa-0000-4000-8000-0000000000a4', '11111111-1111-4111-8111-111111111111',
   'carro', 'superaqueceu', 'sim',
   extensions.st_makepoint(-47.9100, -15.7800), 'Asa Norte',
   extensions.st_makepoint(-47.9500, -15.8300), 'Guará II',
   3, 8, 1, 11000, 1500, 4800, 17300);

insert into public.corridas (id, pedido_id, guincheiro_id, repasse) values
  ('cccccccc-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a1',
   '22222222-2222-4222-8222-222222222202', 20984),
  ('cccccccc-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-0000000000a2',
   '22222222-2222-4222-8222-222222222201', 12880),
  ('cccccccc-0000-4000-8000-0000000000a4', 'aaaaaaaa-0000-4000-8000-0000000000a4',
   '22222222-2222-4222-8222-222222222203', 13840);

-- Entrega pelas transições normais (o Guincheiro volta ao plantão, como no app).
update public.corridas set estado = 'a_caminho' where estado = 'aceita';
update public.corridas set estado = 'no_local' where estado = 'a_caminho';
update public.corridas set estado = 'carregado' where estado = 'no_local';
update public.corridas set estado = 'entregue' where estado = 'carregado';

-- A Corrida 3 fica de fora: o Wagner já entregou a Corrida 1, então pode ter outra aberta.
insert into public.pedidos (
  id, cliente_id, tipo_veiculo, situacao, rodas_giram,
  origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
  tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
) values (
  'aaaaaaaa-0000-4000-8000-0000000000a3', '11111111-1111-4111-8111-111111111111',
  'suv', 'batida', 'nao_sei',
  extensions.st_makepoint(-47.9200, -15.7700), 'Lago Norte',
  extensions.st_makepoint(-47.9500, -15.8300), 'Guará II',
  3, 10, 1, 11000, 1500, 6000, 18500
);
insert into public.corridas (id, pedido_id, guincheiro_id, repasse)
values ('cccccccc-0000-4000-8000-0000000000a3', 'aaaaaaaa-0000-4000-8000-0000000000a3',
        '22222222-2222-4222-8222-222222222202', 14800);

-- ---------------------------------------------------------------------------
-- Cliente A: quem pode avaliar e o que a RPC valida
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a3', 5::smallint, null) $$,
  'GAV02',
  'A Corrida ainda não foi entregue',
  'Corrida não entregue não é avaliada'
);
select throws_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a2', 5::smallint, null) $$,
  'GAV01',
  'Corrida não encontrada',
  'o Cliente não avalia a Corrida de outro Cliente'
);
select throws_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000ff', 5::smallint, null) $$,
  'GAV01',
  'Corrida não encontrada',
  'Corrida inexistente'
);

-- Nota e comentário, numa Corrida entregue do próprio Cliente.
select throws_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a1', 0::smallint, null) $$,
  'GAV04',
  'A nota deve ser de 1 a 5',
  'nota 0 é recusada'
);
select throws_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a1', 6::smallint, null) $$,
  'GAV04',
  'A nota deve ser de 1 a 5',
  'nota 6 é recusada'
);
select throws_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a1', null::smallint, null) $$,
  'GAV04',
  'A nota deve ser de 1 a 5',
  'nota nula é recusada'
);
select throws_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a1', 5::smallint, repeat('a', 281)) $$,
  'GAV05',
  'O comentário deve ter no máximo 280 caracteres',
  'comentário de 281 caracteres é recusado'
);

select lives_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a1', 5::smallint, '  Muito bom  ') $$,
  'o Cliente avalia a Corrida entregue'
);
select is(
  (select comentario from public.avaliacoes where corrida_id = 'cccccccc-0000-4000-8000-0000000000a1'),
  'Muito bom',
  'o comentário é guardado sem espaços nas pontas'
);
select results_eq(
  $$ select papel_autor::text, autor_id, nota from public.avaliacoes
     where corrida_id = 'cccccccc-0000-4000-8000-0000000000a1' $$,
  $$ values ('cliente', '11111111-1111-4111-8111-111111111111'::uuid, 5::smallint) $$,
  'o papel e o autor vêm de quem chama, não do app'
);
select is(
  (select criado_em from public.avaliacoes where corrida_id = 'cccccccc-0000-4000-8000-0000000000a1'),
  now(),
  'criado_em é a hora do servidor'
);
select throws_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a1', 1::smallint, 'De novo') $$,
  'GAV03',
  'Esta Corrida já foi avaliada',
  'uma avaliação por Corrida'
);

select lives_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a4', 4::smallint, repeat('a', 280)) $$,
  'comentário de 280 caracteres vale'
);
select is(
  (select char_length(comentario) from public.avaliacoes
   where corrida_id = 'cccccccc-0000-4000-8000-0000000000a4'),
  280,
  'o comentário de 280 caracteres foi guardado inteiro'
);

-- ---------------------------------------------------------------------------
-- Cliente B: comentário em branco vira nulo
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';

select lives_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a2', 3::smallint, '   ') $$,
  'o Cliente B avalia a própria Corrida, com comentário em branco'
);
select is(
  (select comentario from public.avaliacoes where corrida_id = 'cccccccc-0000-4000-8000-0000000000a2'),
  null,
  'comentário em branco não é guardado'
);

-- ---------------------------------------------------------------------------
-- Guincheiro G2: não avalia a Corrida em que atendeu
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222202", "role": "authenticated"}';

select throws_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a1', 5::smallint, null) $$,
  'GAV01',
  'Corrida não encontrada',
  'o Guincheiro não avalia pela RPC do Cliente'
);

-- ---------------------------------------------------------------------------
-- RLS de leitura
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select corrida_id, nota from public.avaliacoes $$,
  $$ values ('cccccccc-0000-4000-8000-0000000000a1'::uuid, 5::smallint) $$,
  'o Guincheiro lê a avaliação que recebeu (Corrida 1) e nenhuma outra'
);

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is(
  (select count(*) from public.avaliacoes), 2::bigint,
  'o Cliente A lê as avaliações que fez (Corridas 1 e 4)'
);
select is_empty(
  $$ select 1 from public.avaliacoes where corrida_id = 'cccccccc-0000-4000-8000-0000000000a2' $$,
  'o Cliente A não lê a avaliação do Cliente B'
);

set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select is(
  (select count(*) from public.avaliacoes), 1::bigint,
  'o Cliente B lê só a própria avaliação'
);

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222203", "role": "authenticated"}';
select results_eq(
  $$ select corrida_id from public.avaliacoes $$,
  $$ values ('cccccccc-0000-4000-8000-0000000000a4'::uuid) $$,
  'o G3 lê a avaliação que recebeu (Corrida 4) e nenhuma outra'
);

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated"}';
select results_eq(
  $$ select corrida_id from public.avaliacoes $$,
  $$ values ('cccccccc-0000-4000-8000-0000000000a2'::uuid) $$,
  'o G1 lê a avaliação que recebeu (Corrida 2) e nenhuma outra'
);

set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is(
  (select count(*) from public.avaliacoes), 3::bigint,
  'a operação lê todas as avaliações'
);

-- ---------------------------------------------------------------------------
-- nota_media_desde: a RLS decide o que entra na conta
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select media, total from public.nota_media_desde('2000-01-01') $$,
  $$ values (4.00, 3::bigint) $$,
  'a operação tem a média de todas (5, 3 e 4)'
);
select results_eq(
  $$ select media is null, total from public.nota_media_desde(now() + interval '1 day') $$,
  $$ values (true, 0::bigint) $$,
  'sem avaliação no período, a média é nula e o total é 0'
);
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$ select media, total from public.nota_media_desde('2000-01-01') $$,
  $$ values (4.50, 2::bigint) $$,
  'o Cliente A só conta as que fez (5 e 4)'
);

-- ---------------------------------------------------------------------------
-- Ninguém escreve direto
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.avaliacoes (corrida_id, autor_id, papel_autor, nota)
     values ('cccccccc-0000-4000-8000-0000000000a3', '11111111-1111-4111-8111-111111111111',
             'cliente', 5) $$,
  '42501',
  null,
  'o app não insere em avaliacoes'
);
select throws_ok(
  $$ update public.avaliacoes set nota = 1 where corrida_id = 'cccccccc-0000-4000-8000-0000000000a1' $$,
  '42501',
  null,
  'o app não altera avaliações'
);
select throws_ok(
  $$ delete from public.avaliacoes where corrida_id = 'cccccccc-0000-4000-8000-0000000000a1' $$,
  '42501',
  null,
  'o app não apaga avaliações'
);

reset role;

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
set local role anon;

select throws_ok(
  $$ select * from public.avaliacoes $$,
  '42501',
  null,
  'anon não lê avaliações'
);
select throws_ok(
  $$ select public.avaliar_corrida('cccccccc-0000-4000-8000-0000000000a1', 5::smallint, null) $$,
  '42501',
  null,
  'anon não executa avaliar_corrida'
);

reset role;

-- ---------------------------------------------------------------------------
-- Banco: imutabilidade, unicidade, faixa da nota e hora do servidor
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ update public.avaliacoes set nota = 1 where corrida_id = 'cccccccc-0000-4000-8000-0000000000a1' $$,
  '23514',
  'Avaliações não podem ser alteradas',
  'avaliação gravada não muda, nem para a manutenção'
);
select throws_ok(
  $$ insert into public.avaliacoes (corrida_id, autor_id, papel_autor, nota)
     values ('cccccccc-0000-4000-8000-0000000000a1', '11111111-1111-4111-8111-111111111111',
             'cliente', 2) $$,
  '23505',
  null,
  'o banco recusa uma segunda avaliação do Cliente na mesma Corrida'
);
select throws_ok(
  $$ insert into public.avaliacoes (corrida_id, autor_id, papel_autor, nota)
     values ('cccccccc-0000-4000-8000-0000000000a3', '11111111-1111-4111-8111-111111111111',
             'cliente', 7) $$,
  '23514',
  null,
  'o banco recusa nota fora de 1 a 5'
);

-- O lado Guincheiro → Cliente cabe na mesma tabela (unicidade por Corrida e papel), mas
-- só quem o fez o lê; a hora enviada é descartada.
insert into public.avaliacoes (corrida_id, autor_id, papel_autor, nota, criado_em)
values ('cccccccc-0000-4000-8000-0000000000a4', '22222222-2222-4222-8222-222222222203',
        'guincheiro', 4, '2020-01-01 00:00:00-03');
select is(
  (select criado_em from public.avaliacoes
   where corrida_id = 'cccccccc-0000-4000-8000-0000000000a4' and papel_autor = 'guincheiro'),
  now(),
  'o servidor grava a própria hora, mesmo que alguém envie outra'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is(
  (select count(*) from public.avaliacoes), 2::bigint,
  'o Cliente A não lê a avaliação que o Guincheiro fez'
);
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222203", "role": "authenticated"}';
select is(
  (select count(*) from public.avaliacoes), 2::bigint,
  'o G3 lê a que recebeu e a que fez'
);
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222202", "role": "authenticated"}';
select is(
  (select count(*) from public.avaliacoes), 1::bigint,
  'o G2 continua lendo só a que recebeu'
);
reset role;

select * from finish();
rollback;
