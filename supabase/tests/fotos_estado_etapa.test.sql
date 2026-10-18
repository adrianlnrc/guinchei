-- Fotos de estado: etapa derivada do estado da Corrida, limite de 6 itens por etapa e por
-- autor, e Corrida que encerra sem nenhuma foto (ADR-0011, issue #13).
--
-- Corrida A: Cliente A (Rafael) e G2 (Wagner), percorre os estados com fotos.
-- Corrida B: Cliente B e G1 (Marcos), vai até `entregue` sem nenhuma Foto de estado.
begin;
select plan(19);

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
  ('aaaaaaaa-0000-4000-8000-000000000021', '11111111-1111-4111-8111-111111111111',
   'carro', 'nao_liga', 'sim',
   extensions.st_makepoint(-47.8921, -15.7903), 'Eixo Monumental',
   extensions.st_makepoint(-48.0560, -15.8100), 'QNA 12, Taguatinga Norte',
   4.2, 21.3, 1, 11000, 2100, 12780, 25880),
  ('aaaaaaaa-0000-4000-8000-000000000022', '44444444-4444-4444-8444-444444444444',
   'moto', 'batida', 'nao',
   extensions.st_makepoint(-47.9000, -15.8000), 'Setor Policial Sul',
   extensions.st_makepoint(-47.9500, -15.8300), 'Guará II',
   3, 6, 1, 11000, 1500, 3600, 16100);

insert into public.corridas (id, pedido_id, guincheiro_id, repasse) values
  ('cccccccc-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000021',
   '22222222-2222-4222-8222-222222222202', 20984),
  ('cccccccc-0000-4000-8000-000000000022', 'aaaaaaaa-0000-4000-8000-000000000022',
   '22222222-2222-4222-8222-222222222201', 12880);

create function pg_temp.como(usuario text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- Registra n itens (foto) do autor atual na Corrida A, na etapa dada, com nomes distintos.
create function pg_temp.registrar(n integer, prefixo text, etapa_pedida public.etapa_foto)
returns void language plpgsql as $$
begin
  for i in 1..n loop
    insert into public.fotos_estado (corrida_id, tipo, caminho, etapa)
    values ('cccccccc-0000-4000-8000-000000000021', 'foto',
            'cccccccc-0000-4000-8000-000000000021/' || prefixo || '-' || i || '.jpg', etapa_pedida);
  end loop;
end;
$$;
grant execute on function pg_temp.registrar(integer, text, public.etapa_foto) to authenticated;

-- ---------------------------------------------------------------------------
-- Etapa "antes": aceita, a_caminho e no_local
-- ---------------------------------------------------------------------------
select pg_temp.como('11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$ insert into public.fotos_estado (corrida_id, tipo, caminho, etapa)
     values ('cccccccc-0000-4000-8000-000000000021', 'foto',
             'cccccccc-0000-4000-8000-000000000021/antes-a.jpg', 'antes') $$,
  'Cliente registra na etapa "antes" com a Corrida em aceita'
);
select is(
  (select etapa::text from public.fotos_estado where caminho like '%/antes-a.jpg'),
  'antes',
  'a etapa gravada é "antes" em aceita'
);
select throws_ok(
  $$ insert into public.fotos_estado (corrida_id, tipo, caminho, etapa)
     values ('cccccccc-0000-4000-8000-000000000021', 'foto',
             'cccccccc-0000-4000-8000-000000000021/errada.jpg', 'depois') $$,
  'GFT01',
  'A Corrida mudou de etapa; registre de novo',
  'etapa "depois" é recusada enquanto a Corrida não chegou a carregado'
);

-- Limite: 6 por etapa e por autor (o Cliente já tem 1 em "antes").
select lives_ok(
  $$ select pg_temp.registrar(5, 'cliente-antes', 'antes') $$,
  'Cliente chega a 6 itens na etapa "antes"'
);
select throws_ok(
  $$ select pg_temp.registrar(1, 'cliente-antes-extra', 'antes') $$,
  'GFT02',
  'Limite de 6 itens por etapa atingido',
  'o 7º item do Cliente na etapa "antes" é recusado'
);

reset role;

-- O Guincheiro tem os próprios 6: o limite é por autor.
select pg_temp.como('22222222-2222-4222-8222-222222222202');
select lives_ok(
  $$ select pg_temp.registrar(6, 'guincheiro-antes', 'antes') $$,
  'o Guincheiro tem 6 itens próprios na etapa "antes", mesmo com os 6 do Cliente'
);
select throws_ok(
  $$ select pg_temp.registrar(1, 'guincheiro-antes-extra', 'antes') $$,
  'GFT02',
  'Limite de 6 itens por etapa atingido',
  'o 7º item do Guincheiro na etapa "antes" é recusado'
);
reset role;

-- ---------------------------------------------------------------------------
-- Etapa "depois": carregado e entregue
-- ---------------------------------------------------------------------------
update public.corridas set estado = 'a_caminho' where id = 'cccccccc-0000-4000-8000-000000000021';
update public.corridas set estado = 'no_local' where id = 'cccccccc-0000-4000-8000-000000000021';
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select pg_temp.registrar(1, 'cliente-antes-no-local', 'antes') $$,
  'GFT02',
  null,
  'em no_local ainda é a etapa "antes" (limite já atingido)'
);
reset role;

update public.corridas set estado = 'carregado' where id = 'cccccccc-0000-4000-8000-000000000021';
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ insert into public.fotos_estado (corrida_id, tipo, caminho, etapa)
     values ('cccccccc-0000-4000-8000-000000000021', 'video',
             'cccccccc-0000-4000-8000-000000000021/depois-a.mp4', 'depois') $$,
  'em carregado vale a etapa "depois", com o contador zerado'
);
select throws_ok(
  $$ insert into public.fotos_estado (corrida_id, tipo, caminho, etapa)
     values ('cccccccc-0000-4000-8000-000000000021', 'foto',
             'cccccccc-0000-4000-8000-000000000021/antes-tarde.jpg', 'antes') $$,
  'GFT01',
  null,
  'etapa "antes" é recusada depois de carregado'
);
select lives_ok(
  $$ insert into public.fotos_estado (corrida_id, tipo, caminho)
     values ('cccccccc-0000-4000-8000-000000000021', 'foto',
             'cccccccc-0000-4000-8000-000000000021/depois-b.jpg') $$,
  'sem informar a etapa, o servidor deriva a do estado da Corrida'
);
select is(
  (select etapa::text from public.fotos_estado where caminho like '%/depois-b.jpg'),
  'depois',
  'a etapa derivada em carregado é "depois"'
);
reset role;

update public.corridas set estado = 'entregue' where id = 'cccccccc-0000-4000-8000-000000000021';
select pg_temp.como('22222222-2222-4222-8222-222222222202');
select lives_ok(
  $$ insert into public.fotos_estado (corrida_id, tipo, caminho, etapa)
     values ('cccccccc-0000-4000-8000-000000000021', 'foto',
             'cccccccc-0000-4000-8000-000000000021/depois-entregue.jpg', 'depois') $$,
  'em entregue ainda dá para registrar (etapa "depois")'
);
select is(
  (select count(*) from public.fotos_estado where corrida_id = 'cccccccc-0000-4000-8000-000000000021'),
  15::bigint,
  'a Corrida A tem 6 + 6 em "antes" e 3 em "depois"'
);
reset role;

-- ---------------------------------------------------------------------------
-- A etapa e o autor não são forjáveis; estranho não registra nem lê
-- ---------------------------------------------------------------------------
select pg_temp.como('44444444-4444-4444-8444-444444444444');
select is_empty(
  $$ select * from public.fotos_estado where corrida_id = 'cccccccc-0000-4000-8000-000000000021' $$,
  'Cliente B não lê as Fotos de estado da Corrida A'
);
select throws_ok(
  $$ insert into public.fotos_estado (corrida_id, tipo, caminho, etapa)
     values ('cccccccc-0000-4000-8000-000000000021', 'foto',
             'cccccccc-0000-4000-8000-000000000021/intruso.jpg', 'depois') $$,
  '23514',
  null,
  'Cliente B não registra na Corrida A'
);
reset role;

-- ---------------------------------------------------------------------------
-- A Corrida encerra sem fotos (ADR-0011): nenhuma guarda nas transições
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ update public.corridas set estado = 'a_caminho' where id = 'cccccccc-0000-4000-8000-000000000022';
     update public.corridas set estado = 'no_local' where id = 'cccccccc-0000-4000-8000-000000000022';
     update public.corridas set estado = 'carregado' where id = 'cccccccc-0000-4000-8000-000000000022';
     update public.corridas set estado = 'entregue' where id = 'cccccccc-0000-4000-8000-000000000022' $$,
  'a Corrida B vai de aceita a entregue sem nenhuma Foto de estado'
);
select is(
  (select count(*) from public.fotos_estado where corrida_id = 'cccccccc-0000-4000-8000-000000000022'),
  0::bigint,
  'a Corrida B encerrou sem Fotos de estado'
);

-- ---------------------------------------------------------------------------
-- Bucket: o Storage não deixa apagar por SQL (a política de limpeza de arquivo órfão é
-- testada pela API, em packages/api/src/integracao.test.ts)
-- ---------------------------------------------------------------------------
insert into storage.objects (bucket_id, name, owner_id)
values ('fotos-estado', 'cccccccc-0000-4000-8000-000000000021/depois-a.mp4',
        '11111111-1111-4111-8111-111111111111');

select pg_temp.como('44444444-4444-4444-8444-444444444444');
select is_empty(
  $$ select * from storage.objects where bucket_id = 'fotos-estado' $$,
  'Cliente B não lê nenhum arquivo da Corrida A'
);
reset role;

select * from finish();
rollback;
