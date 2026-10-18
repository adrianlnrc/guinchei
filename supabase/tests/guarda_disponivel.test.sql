-- Guarda de disponibilidade (issue #35; ADR-0008 com a nota de 2026-10-17).
--
-- O Guincheiro não fica disponível (`guincheiros.disponivel = true`) enquanto tem Corrida
-- não terminal (aceita, a_caminho, no_local, carregado): o banco recusa com GDP01, por
-- qualquer caminho (a API, outra aba, SQL). Pôr `disponivel = false` é sempre permitido. A
-- volta ao plantão ao entregar (#12) continua valendo, e o Match não oferece a quem está
-- em Corrida.
--
-- Usuários do seed: Cliente A (Rafael), G1 Marcos (Cruzeiro, o mais próximo do Eixo
-- Monumental), G2 Wagner. Cenário: Corrida de G1 (aceita; G1 indisponível, como o aceite
-- deixa). G2 não tem Corrida.
begin;
select plan(15);

insert into public.pedidos (
  id, cliente_id, tipo_veiculo, situacao, rodas_giram,
  origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
  tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
) values
  ('aaaaaaaa-0000-4000-8000-000000000035', '11111111-1111-4111-8111-111111111111',
   'carro', 'nao_liga', 'sim',
   extensions.st_makepoint(-47.8921, -15.7903), 'Eixo Monumental',
   extensions.st_makepoint(-48.0560, -15.8100), 'QNA 12, Taguatinga Norte',
   4.2, 21.3, 1, 11000, 2100, 12780, 25880);

insert into public.corridas (id, pedido_id, guincheiro_id, repasse) values
  ('cccccccc-0000-4000-8000-000000000035', 'aaaaaaaa-0000-4000-8000-000000000035',
   '22222222-2222-4222-8222-222222222201', 20984);

update public.guincheiros set disponivel = false
where id = '22222222-2222-4222-8222-222222222201';

create function pg_temp.como(usuario text) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.elegiveis() returns uuid[]
language plpgsql as $$
declare
  ids uuid[];
begin
  set local role service_role;
  select array_agg(guincheiro_id) into ids
  from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921, 10);
  reset role;
  return coalesce(ids, '{}');
end;
$$;

create function pg_temp.avancar(novo text) returns void
language sql as $$
  update public.corridas set estado = novo::public.estado_corrida
  where id = 'cccccccc-0000-4000-8000-000000000035';
$$;

-- ---------------------------------------------------------------------------
-- Em cada estado não terminal, ficar disponível é recusado
-- ---------------------------------------------------------------------------
select pg_temp.como('22222222-2222-4222-8222-222222222201');

select throws_ok(
  $$ update public.guincheiros set disponivel = true
     where id = '22222222-2222-4222-8222-222222222201' $$,
  'GDP01',
  'Termine a Corrida em andamento antes de ficar disponível',
  'aceita: o Guincheiro não fica disponível'
);

select pg_temp.avancar('a_caminho');
select throws_ok(
  $$ update public.guincheiros set disponivel = true
     where id = '22222222-2222-4222-8222-222222222201' $$,
  'GDP01', null, 'a_caminho: o Guincheiro não fica disponível'
);

select pg_temp.avancar('no_local');
select throws_ok(
  $$ update public.guincheiros set disponivel = true
     where id = '22222222-2222-4222-8222-222222222201' $$,
  'GDP01', null, 'no_local: o Guincheiro não fica disponível'
);

select pg_temp.avancar('carregado');
select throws_ok(
  $$ update public.guincheiros set disponivel = true
     where id = '22222222-2222-4222-8222-222222222201' $$,
  'GDP01', null, 'carregado: o Guincheiro não fica disponível'
);

select results_eq(
  $$ update public.guincheiros set disponivel = false
     where id = '22222222-2222-4222-8222-222222222201' returning disponivel $$,
  $$ values (false) $$,
  'pôr disponivel = false durante a Corrida é permitido'
);

reset role;

-- A guarda vale para qualquer caminho, não só para a API.
select throws_ok(
  $$ update public.guincheiros set disponivel = true
     where id = '22222222-2222-4222-8222-222222222201' $$,
  'GDP01', null, 'nem por SQL direto (sem passar pela API) o Guincheiro em Corrida fica disponível'
);

-- Outras colunas continuam livres: a guarda só olha para disponivel = true.
select lives_ok(
  $$ update public.guincheiros set posicao = extensions.st_makepoint(-47.9, -15.8)
     where id = '22222222-2222-4222-8222-222222222201' $$,
  'mudar outra coluna do Guincheiro em Corrida não é barrado'
);

-- ---------------------------------------------------------------------------
-- Match: quem está em Corrida não é oferecido
-- ---------------------------------------------------------------------------
select ok(
  not ('22222222-2222-4222-8222-222222222201'::uuid = any (pg_temp.elegiveis())),
  'o Match não oferece a quem está em Corrida (carregado)'
);

-- ---------------------------------------------------------------------------
-- Quem não tem Corrida não é afetado
-- ---------------------------------------------------------------------------
update public.guincheiros set disponivel = false
where id = '22222222-2222-4222-8222-222222222202';
select pg_temp.como('22222222-2222-4222-8222-222222222202');
select results_eq(
  $$ update public.guincheiros set disponivel = true
     where id = '22222222-2222-4222-8222-222222222202' returning disponivel $$,
  $$ values (true) $$,
  'a Corrida de G1 não impede G2 de ficar disponível'
);
reset role;

-- ---------------------------------------------------------------------------
-- Entregue: a volta ao plantão continua funcionando
-- ---------------------------------------------------------------------------
select pg_temp.como('22222222-2222-4222-8222-222222222201');
select results_eq(
  $$ update public.corridas set estado = 'entregue'
     where id = 'cccccccc-0000-4000-8000-000000000035' returning estado::text $$,
  $$ values ('entregue') $$,
  'carregado → entregue pelo Guincheiro não é barrado pela guarda'
);
reset role;

select is(
  (select disponivel from public.guincheiros where id = '22222222-2222-4222-8222-222222222201'),
  true,
  'ao entregar, o Guincheiro volta ao plantão automaticamente'
);
select ok(
  '22222222-2222-4222-8222-222222222201'::uuid = any (pg_temp.elegiveis()),
  'depois de entregue, o Match volta a oferecer ao Guincheiro'
);

select pg_temp.como('22222222-2222-4222-8222-222222222201');
select lives_ok(
  $$ update public.guincheiros set disponivel = false
     where id = '22222222-2222-4222-8222-222222222201' $$,
  'depois de entregue, o Guincheiro sai do plantão'
);
select results_eq(
  $$ update public.guincheiros set disponivel = true
     where id = '22222222-2222-4222-8222-222222222201' returning disponivel $$,
  $$ values (true) $$,
  'depois de entregue, o Guincheiro volta ao plantão pelo interruptor'
);
reset role;

-- ---------------------------------------------------------------------------
-- Aceite pelo Match deixa o Guincheiro indisponível mesmo com a guarda
-- ---------------------------------------------------------------------------
select ok(
  not exists (
    select 1 from public.corridas c
    join public.guincheiros g on g.id = c.guincheiro_id
    where c.estado in ('aceita', 'a_caminho', 'no_local', 'carregado') and g.disponivel
  ),
  'ninguém com Corrida não terminal está disponível'
);

select * from finish();
rollback;
