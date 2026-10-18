-- App do Guincheiro: avanço da Corrida, disponibilidade, hora do servidor e Realtime
-- (issue #12; ADR-0008 com a nota de 2026-10-17, ADR-0011).
--
-- O Guincheiro avança a própria Corrida por UPDATE de `corridas.estado` (RLS do #6 e o
-- trigger de transição). Ao entregar, o banco o deixa disponível de novo. O app conta o
-- prazo da oferta pela hora do servidor (`hora_do_servidor`) e escuta `tentativas_match`
-- e `corridas` pelo Realtime (publicação `supabase_realtime`).
--
-- Usuários do seed: Cliente A (Rafael), G1 Marcos, G2 Wagner. Cenário:
--   Pedido A: aceito por G2 (Corrida A, aceita); G2 indisponível, como o aceite deixa.
--   Pedido B: aceito por G1 (Corrida B, aceita); G1 indisponível, como o aceite deixa.
begin;
select plan(22);

insert into public.pedidos (
  id, cliente_id, tipo_veiculo, situacao, rodas_giram,
  origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
  tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
) values
  ('aaaaaaaa-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111',
   'carro', 'nao_liga', 'sim',
   extensions.st_makepoint(-47.8921, -15.7903), 'Eixo Monumental',
   extensions.st_makepoint(-48.0560, -15.8100), 'QNA 12, Taguatinga Norte',
   4.2, 21.3, 1, 11000, 2100, 12780, 25880),
  ('aaaaaaaa-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111',
   'moto', 'batida', 'nao',
   extensions.st_makepoint(-47.9000, -15.8000), 'Setor Policial Sul',
   extensions.st_makepoint(-47.9500, -15.8300), 'Guará II',
   3, 6, 1, 11000, 1500, 3600, 16100);

insert into public.corridas (id, pedido_id, guincheiro_id, repasse) values
  ('cccccccc-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000011',
   '22222222-2222-4222-8222-222222222202', 20984),
  ('cccccccc-0000-4000-8000-000000000012', 'aaaaaaaa-0000-4000-8000-000000000012',
   '22222222-2222-4222-8222-222222222201', 12880);

update public.guincheiros set disponivel = false
where id in ('22222222-2222-4222-8222-222222222201', '22222222-2222-4222-8222-222222222202');

create function pg_temp.como(usuario text) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Avanço da Corrida
-- ---------------------------------------------------------------------------
select pg_temp.como('22222222-2222-4222-8222-222222222202');

select throws_ok(
  $$ update public.corridas set estado = 'no_local'
     where id = 'cccccccc-0000-4000-8000-000000000011' $$,
  '23514',
  'Corrida não pode ir de aceita para no_local',
  'sem "Saí para o local", o Guincheiro não chega ao local'
);
select results_eq(
  $$ update public.corridas set estado = 'a_caminho'
     where id = 'cccccccc-0000-4000-8000-000000000011' returning estado::text $$,
  $$ values ('a_caminho') $$,
  '"Saí para o local": aceita → a_caminho pelo Guincheiro da Corrida'
);
select throws_ok(
  $$ update public.corridas set estado = 'aceita'
     where id = 'cccccccc-0000-4000-8000-000000000011' $$,
  '23514',
  'Corrida não pode ir de a_caminho para aceita',
  'a Corrida não volta'
);
select throws_ok(
  $$ update public.corridas set estado = 'carregado'
     where id = 'cccccccc-0000-4000-8000-000000000011' $$,
  '23514',
  'Corrida não pode ir de a_caminho para carregado',
  'não pula "Cheguei"'
);
select results_eq(
  $$ update public.corridas set estado = 'no_local'
     where id = 'cccccccc-0000-4000-8000-000000000011' returning estado::text $$,
  $$ values ('no_local') $$,
  '"Cheguei": a_caminho → no_local'
);
-- Sem Fotos de estado (ADR-0011): carregar e entregar não exigem fotos.
select results_eq(
  $$ update public.corridas set estado = 'carregado'
     where id = 'cccccccc-0000-4000-8000-000000000011' returning estado::text $$,
  $$ values ('carregado') $$,
  '"Carreguei": no_local → carregado, sem fotos'
);
select is(
  (select disponivel from public.guincheiros where id = '22222222-2222-4222-8222-222222222202'),
  false,
  'durante a Corrida o Guincheiro continua indisponível'
);
select results_eq(
  $$ update public.corridas set estado = 'entregue'
     where id = 'cccccccc-0000-4000-8000-000000000011' returning estado::text $$,
  $$ values ('entregue') $$,
  '"Entreguei": carregado → entregue, sem fotos'
);
select is(
  (select disponivel from public.guincheiros where id = '22222222-2222-4222-8222-222222222202'),
  true,
  'ao entregar, o Guincheiro volta a ficar disponível'
);
select throws_ok(
  $$ update public.corridas set estado = 'a_caminho'
     where id = 'cccccccc-0000-4000-8000-000000000011' $$,
  '23514',
  'Corrida não pode ir de entregue para a_caminho',
  'entregue é terminal'
);
select is_empty(
  $$ update public.corridas set estado = 'a_caminho'
     where id = 'cccccccc-0000-4000-8000-000000000012' returning id $$,
  'G2 não avança a Corrida de outro Guincheiro'
);
select throws_ok(
  $$ update public.corridas set repasse = 999999
     where id = 'cccccccc-0000-4000-8000-000000000011' $$,
  '42501',
  null,
  'o Guincheiro não muda o repasse da Corrida'
);

reset role;

select is(
  (select estado::text from public.corridas where id = 'cccccccc-0000-4000-8000-000000000012'),
  'aceita',
  'a Corrida de G1 continua aceita'
);
select is(
  (select disponivel from public.guincheiros where id = '22222222-2222-4222-8222-222222222201'),
  false,
  'entregar a Corrida de G2 não mexe na disponibilidade de G1, que segue em Corrida'
);

-- G1 entrega a Corrida B (o trigger o devolve ao plantão); a guarda de disponibilidade
-- (#35) impede ligar o plantão enquanto a Corrida está em andamento.
update public.corridas set estado = 'a_caminho' where id = 'cccccccc-0000-4000-8000-000000000012';
update public.corridas set estado = 'no_local' where id = 'cccccccc-0000-4000-8000-000000000012';
update public.corridas set estado = 'carregado' where id = 'cccccccc-0000-4000-8000-000000000012';
update public.corridas set estado = 'entregue' where id = 'cccccccc-0000-4000-8000-000000000012';

-- ---------------------------------------------------------------------------
-- Disponibilidade (o interruptor do plantão)
-- ---------------------------------------------------------------------------
select pg_temp.como('22222222-2222-4222-8222-222222222201');

select results_eq(
  $$ update public.guincheiros set disponivel = false
     where id = '22222222-2222-4222-8222-222222222201' returning disponivel $$,
  $$ values (false) $$,
  'o Guincheiro sai do plantão'
);
select results_eq(
  $$ update public.guincheiros set disponivel = true
     where id = '22222222-2222-4222-8222-222222222201' returning disponivel $$,
  $$ values (true) $$,
  'o Guincheiro volta ao plantão'
);
select is_empty(
  $$ update public.guincheiros set disponivel = false
     where id = '22222222-2222-4222-8222-222222222202' returning id $$,
  'o Guincheiro não muda a disponibilidade de outro'
);
select throws_ok(
  $$ update public.guincheiros set posicao = extensions.st_makepoint(-47.9, -15.8)
     where id = '22222222-2222-4222-8222-222222222201' $$,
  '42501',
  null,
  'o Guincheiro não muda a própria posição pela API'
);

-- ---------------------------------------------------------------------------
-- Hora do servidor (contagem do prazo da oferta)
-- ---------------------------------------------------------------------------
select is(public.hora_do_servidor(), now(), 'hora_do_servidor devolve a hora do banco');

reset role;
set local role anon;
select throws_ok('select public.hora_do_servidor()', '42501', null, 'anon não chama hora_do_servidor');
reset role;

-- ---------------------------------------------------------------------------
-- Realtime: as tabelas que o app do Guincheiro escuta estão na publicação
-- ---------------------------------------------------------------------------
select ok(
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public'
            and tablename = 'tentativas_match'),
  'tentativas_match está na publicação supabase_realtime'
);
select ok(
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public'
            and tablename = 'corridas'),
  'corridas está na publicação supabase_realtime'
);

select * from finish();
rollback;
