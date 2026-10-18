-- Cotação do Pedido (issue #10, RF05): dados_da_cotacao e gravar_cotacao.
--
-- A Edge Function `cotar-pedido` lê os dados (distância do Guincheiro elegível mais próximo
-- até a origem, km rebocado, tabela vigente, feriados e a hora do servidor), calcula o
-- Preço fechado com @guinchei/preco e grava a decomposição. As duas funções são só da
-- service_role; quem é o Cliente vem do JWT, conferido pela Edge Function.
--
-- Usuários do seed: Cliente A (Rafael), Guincheiro G1 (Marcos, Cruzeiro, ~4,2 km do Eixo
-- Monumental). Aqui se cria o Cliente B.
begin;
select plan(16);

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Cliente B', '5561900000099',
        '11144477735', 'v1');

-- O Cliente A abre dois Pedidos: um com trajeto (Eixo Monumental → Taguatinga) e um sem.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select set_config('teste.pedido', public.abrir_pedido('carro', 'nao_liga', 'sim')::text, true);
select set_config('teste.sem_trajeto', public.abrir_pedido('moto', 'batida', 'nao')::text, true);
select public.definir_trajeto_pedido(
  current_setting('teste.pedido')::uuid,
  -15.7903, -47.8921, 'Eixo Monumental, Brasília - DF',
  -15.8336, -48.0566, 'QNA 12, Taguatinga Norte, Brasília - DF',
  21.347);

-- Pela API, o Cliente não chama as funções da cotação.
select throws_ok(
  $$ select public.dados_da_cotacao(current_setting('teste.pedido')::uuid,
                                    '11111111-1111-4111-8111-111111111111') $$,
  '42501',
  null,
  'o Cliente não lê os dados da cotação pela API'
);
select throws_ok(
  $$ select public.gravar_cotacao(current_setting('teste.pedido')::uuid,
       '11111111-1111-4111-8111-111111111111', now(), 1, 1, 18000, 0, 0, 0, 0, 0, 18000) $$,
  '42501',
  null,
  'o Cliente não grava o próprio Preço fechado'
);
reset role;

-- Um feriado hoje (data de Brasília) aparece nos dados.
insert into public.feriados (data, nome, abrangencia)
values ((now() at time zone 'America/Sao_Paulo')::date, 'Feriado de teste', 'df')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- dados_da_cotacao
-- ---------------------------------------------------------------------------
set local role service_role;

create temp table dados as
select public.dados_da_cotacao(current_setting('teste.pedido')::uuid,
                               '11111111-1111-4111-8111-111111111111') as d;

select is(
  (select (d ->> 'km_ate_veiculo')::numeric from dados),
  (select round((distancia_m / 1000)::numeric, 2)
   from public.guincheiros_elegiveis_proximos(-15.7903, -47.8921, 1)),
  'km até o veículo: distância em linha reta do Guincheiro elegível mais próximo à origem, em 2 casas'
);
select ok(
  (select (d ->> 'km_ate_veiculo')::numeric between 4.0 and 4.4 from dados),
  'o mais próximo do Eixo Monumental é o Marcos, no Cruzeiro (~4,2 km)'
);
select is(
  (select (d ->> 'km_rebocado')::numeric from dados),
  21.35::numeric,
  'km rebocado: o que o trajeto gravou'
);
select is(
  (select d -> 'tabela' from dados),
  (select to_jsonb(t) from public.tabela_precos_vigente() t),
  'traz a tabela de preços vigente'
);
select ok(
  (select (d ->> 'instante')::timestamptz = now() from dados),
  'o instante é a hora do servidor'
);
select ok(
  (select d -> 'feriados' ? to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')
   from dados),
  'traz os feriados em volta da data de Brasília, no formato YYYY-MM-DD'
);

select throws_ok(
  $$ select public.dados_da_cotacao(current_setting('teste.pedido')::uuid,
                                    '44444444-4444-4444-8444-444444444444') $$,
  'P0002',
  null,
  'o Cliente B não cota o Pedido do Cliente A'
);
select throws_ok(
  $$ select public.dados_da_cotacao(current_setting('teste.sem_trajeto')::uuid,
                                    '11111111-1111-4111-8111-111111111111') $$,
  'GCT02',
  null,
  'Pedido sem trajeto não é cotado'
);

-- ---------------------------------------------------------------------------
-- gravar_cotacao
-- ---------------------------------------------------------------------------
-- Decomposição de 4,23 km até o veículo e 21,35 km rebocado, de dia, sem feriado.
select lives_ok(
  $$ select public.gravar_cotacao(current_setting('teste.pedido')::uuid,
       '11111111-1111-4111-8111-111111111111',
       (select (d ->> 'atualizado_em')::timestamptz from dados),
       4.23, 1, 11000, 2115, 12810, 0, 0, 0, 25925) $$,
  'grava a cotação no Pedido do Cliente'
);
select results_eq(
  $$ select km_ate_veiculo, tabela_precos_versao, preco_taxa_base, preco_ate_veiculo,
            preco_rebocado, preco_adicional_noturno, preco_adicional_feriado,
            preco_ajuste_minimo, preco_total, estado::text
     from public.pedidos where id = current_setting('teste.pedido')::uuid $$,
  $$ values (4.23::numeric, 1, 11000, 2115, 12810, 0, 0, 0, 25925, 'cotado') $$,
  'o Pedido fica com a decomposição e a versão da tabela, ainda em cotado'
);

select throws_ok(
  $$ select public.gravar_cotacao(current_setting('teste.pedido')::uuid,
       '11111111-1111-4111-8111-111111111111',
       (select atualizado_em from public.pedidos where id = current_setting('teste.pedido')::uuid),
       4.23, 1, 11000, 2115, 12810, 0, 0, 0, 30000) $$,
  '23514',
  null,
  'decomposição que não soma o total é recusada'
);

-- O trajeto mudou depois da leitura (atualizado_em antigo): não grava preço de outro trajeto.
select throws_ok(
  $$ select public.gravar_cotacao(current_setting('teste.pedido')::uuid,
       '11111111-1111-4111-8111-111111111111', '2026-01-01 00:00:00-03',
       4.23, 1, 11000, 2115, 12810, 0, 0, 0, 25925) $$,
  'GCT03',
  null,
  'o Pedido mudou desde a leitura: a cotação não é gravada'
);

-- ---------------------------------------------------------------------------
-- Sem Guincheiro elegível e Pedido fora de cotado
-- ---------------------------------------------------------------------------
reset role;
update public.guincheiros set disponivel = false;
set local role service_role;

select throws_ok(
  $$ select public.dados_da_cotacao(current_setting('teste.pedido')::uuid,
                                    '11111111-1111-4111-8111-111111111111') $$,
  'GCT01',
  'Nenhum guincho disponível agora',
  'sem Guincheiro elegível, a cotação responde erro claro'
);

reset role;
update public.guincheiros set disponivel = true;
update public.pedidos set estado = 'confirmado' where id = current_setting('teste.pedido')::uuid;
set local role service_role;

select throws_ok(
  $$ select public.dados_da_cotacao(current_setting('teste.pedido')::uuid,
                                    '11111111-1111-4111-8111-111111111111') $$,
  'P0002',
  null,
  'Pedido já confirmado não é cotado de novo'
);

reset role;

select * from finish();
rollback;
