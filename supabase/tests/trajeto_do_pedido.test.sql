-- definir_trajeto_pedido: o Cliente grava origem e destino do próprio Pedido (issue #9, RF04).
--
-- Só o dono, só em `cotado`, e origem e destino dentro do DF (ADR-0001, trava 1 do
-- ADR-0007). O polígono é o mesmo de @guinchei/geo; packages/geo/src/sincronia-sql.test.ts
-- confere que o bloco de pontos abaixo é o mesmo que o Vitest testa.
--
-- Usuários do seed: Cliente A (Rafael), Guincheiro G1 (Marcos). Aqui se cria o Cliente B.
begin;
select plan(18);

-- ---------------------------------------------------------------------------
-- Regra do DF no banco: mesmos pontos de referência do TS
-- ---------------------------------------------------------------------------
create temp table pontos (nome text, lat double precision, lng double precision, no_df boolean);
insert into pontos values
-- inicio:pontos
  ('Esplanada dos Ministérios', -15.7975, -47.8641, true),
  ('Taguatinga', -15.8336, -48.0566, true),
  ('Planaltina-DF', -15.6203, -47.6522, true),
  ('Gama', -16.0153, -48.0614, true),
  ('Águas Lindas de Goiás', -15.7617, -48.2817, false),
  ('Valparaíso de Goiás', -16.0683, -47.9758, false),
  ('Formosa', -15.5372, -47.3342, false),
  ('Goiânia', -16.6869, -49.2648, false)
-- fim:pontos
;

select results_eq(
  $$ select nome, public.ponto_no_df(lat, lng) from pontos order by nome $$,
  $$ select nome, no_df from pontos order by nome $$,
  'ponto_no_df responde como dentroDoDF nos pontos de referência'
);

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Cliente B', '5561900000099',
        '11144477735', 'v1');

-- ---------------------------------------------------------------------------
-- Cliente A grava o trajeto do próprio Pedido
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select set_config('teste.pedido_a', public.abrir_pedido('carro', 'nao_liga', 'sim')::text, true);

select lives_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7903, -47.8921, 'Eixo Monumental, Brasília - DF',
       -15.8336, -48.0566, 'QNA 12, Taguatinga Norte, Brasília - DF',
       21.347) $$,
  'o Cliente grava o trajeto do próprio Pedido em cotado'
);
select results_eq(
  $$ select extensions.st_y(origem::extensions.geometry), extensions.st_x(origem::extensions.geometry),
            origem_endereco,
            extensions.st_y(destino::extensions.geometry), extensions.st_x(destino::extensions.geometry),
            destino_endereco, km_rebocado, km_ate_veiculo is null, preco_total is null, estado::text
     from public.pedidos where id = current_setting('teste.pedido_a')::uuid $$,
  $$ values (-15.7903::float8, -47.8921::float8, 'Eixo Monumental, Brasília - DF',
             -15.8336::float8, -48.0566::float8, 'QNA 12, Taguatinga Norte, Brasília - DF',
             21.35::numeric, true, true, 'cotado') $$,
  'o Pedido fica com origem, destino e km rebocado; sem cotação, ainda em cotado'
);
select lives_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7903, -47.8921, 'Eixo Monumental, Brasília - DF',
       -16.0153, -48.0614, 'Setor Central, Gama, Brasília - DF',
       30) $$,
  'o Cliente troca o destino enquanto está em cotado'
);
select results_eq(
  $$ select destino_endereco, km_rebocado from public.pedidos
     where id = current_setting('teste.pedido_a')::uuid $$,
  $$ values ('Setor Central, Gama, Brasília - DF', 30.00::numeric) $$,
  'o mesmo Pedido fica com o destino novo'
);

-- Fora do DF é recusado, na origem ou no destino.
select throws_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7617, -48.2817, 'Águas Lindas de Goiás - GO',
       -15.8336, -48.0566, 'Taguatinga, Brasília - DF', 25) $$,
  'GDF01',
  null,
  'origem fora do DF é recusada'
);
select throws_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7903, -47.8921, 'Eixo Monumental, Brasília - DF',
       -16.0683, -47.9758, 'Valparaíso de Goiás - GO', 35) $$,
  'GDF01',
  null,
  'destino fora do DF é recusado'
);
select throws_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7903, -47.8921, '   ',
       -15.8336, -48.0566, 'Taguatinga, Brasília - DF', 21) $$,
  '22023',
  null,
  'endereço em branco é recusado'
);
select throws_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7903, -47.8921, 'Eixo Monumental, Brasília - DF',
       null, -48.0566, 'Taguatinga, Brasília - DF', 21) $$,
  '22004',
  null,
  'sem uma coordenada não grava'
);
select throws_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7903, -47.8921, 'Eixo Monumental, Brasília - DF',
       -15.8336, -48.0566, 'Taguatinga, Brasília - DF', -1) $$,
  '23514',
  null,
  'km rebocado negativo é recusado'
);
select results_eq(
  $$ select destino_endereco from public.pedidos
     where id = current_setting('teste.pedido_a')::uuid $$,
  $$ values ('Setor Central, Gama, Brasília - DF') $$,
  'as tentativas recusadas não mudaram o Pedido'
);

reset role;

-- ---------------------------------------------------------------------------
-- Cliente B, Guincheiro e anon não mexem no trajeto do A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';

select throws_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7975, -47.8641, 'Esplanada', -15.8336, -48.0566, 'Taguatinga', 20) $$,
  'P0002',
  null,
  'Cliente B não grava trajeto no Pedido do Cliente A'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated"}';

select throws_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7975, -47.8641, 'Esplanada', -15.8336, -48.0566, 'Taguatinga', 20) $$,
  '42501',
  null,
  'Guincheiro não grava trajeto'
);

reset role;

set local role anon;

select throws_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7975, -47.8641, 'Esplanada', -15.8336, -48.0566, 'Taguatinga', 20) $$,
  '42501',
  null,
  'anon não grava trajeto'
);

reset role;

-- ---------------------------------------------------------------------------
-- Trocar o trajeto de um Pedido já cotado descarta o Preço fechado (vale o trajeto novo)
-- ---------------------------------------------------------------------------
update public.pedidos
set km_ate_veiculo = 4.2, tabela_precos_versao = 1, preco_taxa_base = 11000,
    preco_ate_veiculo = 2100, preco_rebocado = 18000, preco_adicional_noturno = 0,
    preco_adicional_feriado = 0, preco_ajuste_minimo = 0, preco_total = 31100
where id = current_setting('teste.pedido_a')::uuid;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select public.definir_trajeto_pedido(
  current_setting('teste.pedido_a')::uuid,
  -15.7903, -47.8921, 'Eixo Monumental, Brasília - DF',
  -15.8336, -48.0566, 'QNA 12, Taguatinga Norte, Brasília - DF', 21.3);

select results_eq(
  $$ select num_nulls(km_ate_veiculo, tabela_precos_versao, preco_taxa_base, preco_ate_veiculo,
                      preco_rebocado, preco_adicional_noturno, preco_adicional_feriado,
                      preco_ajuste_minimo, preco_total)
     from public.pedidos where id = current_setting('teste.pedido_a')::uuid $$,
  $$ values (9) $$,
  'trajeto novo apaga a cotação anterior (o Preço fechado é recalculado)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Fora de cotado, o trajeto fica como foi confirmado
-- ---------------------------------------------------------------------------
update public.pedidos
set km_ate_veiculo = 4.2, tabela_precos_versao = 1, preco_taxa_base = 11000,
    preco_ate_veiculo = 2100, preco_rebocado = 12780, preco_adicional_noturno = 0,
    preco_adicional_feriado = 0, preco_ajuste_minimo = 0, preco_total = 25880,
    estado = 'confirmado'
where id = current_setting('teste.pedido_a')::uuid;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ select public.definir_trajeto_pedido(
       current_setting('teste.pedido_a')::uuid,
       -15.7975, -47.8641, 'Esplanada', -16.0153, -48.0614, 'Gama', 30) $$,
  'P0002',
  null,
  'Pedido confirmado não muda de trajeto'
);
select throws_ok(
  $$ select public.ponto_no_df(-15.7975, -47.8641) $$,
  '42501',
  null,
  'ponto_no_df não fica exposto pela API'
);

reset role;

select results_eq(
  $$ select destino_endereco from public.pedidos
     where id = current_setting('teste.pedido_a')::uuid $$,
  $$ values ('QNA 12, Taguatinga Norte, Brasília - DF') $$,
  'as tentativas de terceiros e fora de cotado não mudaram o trajeto'
);

select * from finish();
rollback;
