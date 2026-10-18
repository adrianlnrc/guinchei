-- Confirmação e pagamento mock (issue #10, RF06): pagamentos, preco_para_confirmar e
-- registrar_pagamento.
--
-- A Edge Function `confirmar-pedido` lê o Preço fechado gravado, autoriza esse mesmo valor
-- no GatewayPagamento (mock) e registra o resultado. Autorizado: o Pedido vai a
-- `confirmado`. Recusado: o pagamento fica registrado e o Pedido continua `cotado`.
-- Ninguém escreve em `pagamentos` pela API; o Cliente lê os do próprio Pedido.
--
-- Usuários do seed: Cliente A (Rafael). Aqui se cria o Cliente B.
begin;
select plan(19);

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Cliente B', '5561900000099',
        '11144477735', 'v1');

-- Cliente A: um Pedido cotado (com trajeto) e um sem cotação.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select set_config('teste.pedido', public.abrir_pedido('carro', 'nao_liga', 'sim')::text, true);
select set_config('teste.sem_preco', public.abrir_pedido('moto', 'batida', 'nao')::text, true);
select public.definir_trajeto_pedido(
  current_setting('teste.pedido')::uuid,
  -15.7903, -47.8921, 'Eixo Monumental, Brasília - DF',
  -15.8336, -48.0566, 'QNA 12, Taguatinga Norte, Brasília - DF',
  21.347);
reset role;

set local role service_role;
select public.gravar_cotacao(current_setting('teste.pedido')::uuid,
  '11111111-1111-4111-8111-111111111111',
  (select public.dados_da_cotacao(current_setting('teste.pedido')::uuid,
     '11111111-1111-4111-8111-111111111111') ->> 'trajeto'),
  4.23, 1, 11000, 2115, 12810, 0, 0, 0, 25925);
reset role;

-- ---------------------------------------------------------------------------
-- Pela API, o Cliente não confirma sozinho nem escreve pagamento
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ select public.preco_para_confirmar(current_setting('teste.pedido')::uuid,
                                        '11111111-1111-4111-8111-111111111111') $$,
  '42501',
  null,
  'o Cliente não chama preco_para_confirmar pela API'
);
select throws_ok(
  $$ select public.registrar_pagamento(current_setting('teste.pedido')::uuid,
       '11111111-1111-4111-8111-111111111111', 25925, 'autorizado', 'pix', 'mock', 'mock_x') $$,
  '42501',
  null,
  'o Cliente não registra o próprio pagamento'
);
select throws_ok(
  $$ insert into public.pagamentos (pedido_id, valor, estado, metodo, provedor, referencia_externa)
     values (current_setting('teste.pedido')::uuid, 1, 'autorizado', 'pix', 'mock', 'mock_x') $$,
  '42501',
  null,
  'o Cliente não insere em pagamentos'
);
reset role;

-- ---------------------------------------------------------------------------
-- preco_para_confirmar
-- ---------------------------------------------------------------------------
set local role service_role;

select is(
  public.preco_para_confirmar(current_setting('teste.pedido')::uuid,
                              '11111111-1111-4111-8111-111111111111'),
  25925,
  'devolve o Preço fechado gravado no Pedido'
);
select throws_ok(
  $$ select public.preco_para_confirmar(current_setting('teste.pedido')::uuid,
                                        '44444444-4444-4444-8444-444444444444') $$,
  'P0002',
  null,
  'o Cliente B não confirma o Pedido do Cliente A'
);
select throws_ok(
  $$ select public.preco_para_confirmar(current_setting('teste.sem_preco')::uuid,
                                        '11111111-1111-4111-8111-111111111111') $$,
  'GPG01',
  null,
  'Pedido sem Preço fechado não é confirmado'
);

-- ---------------------------------------------------------------------------
-- registrar_pagamento
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.registrar_pagamento(current_setting('teste.pedido')::uuid,
       '11111111-1111-4111-8111-111111111111', 25000, 'autorizado', 'pix', 'mock', 'mock_a') $$,
  'GPG02',
  null,
  'valor diferente do Preço fechado gravado é recusado'
);
select throws_ok(
  $$ select public.registrar_pagamento(current_setting('teste.pedido')::uuid,
       '11111111-1111-4111-8111-111111111111', 25925, 'capturado', 'pix', 'mock', 'mock_a') $$,
  '22023',
  null,
  'na confirmação, só autorizado ou recusado'
);

-- Recusa: fica registrada e o Pedido continua cotado.
select lives_ok(
  $$ select public.registrar_pagamento(current_setting('teste.pedido')::uuid,
       '11111111-1111-4111-8111-111111111111', 25925, 'recusado', 'cartao', 'mock', 'mock_recusa') $$,
  'registra um pagamento recusado'
);
select is(
  (select estado::text from public.pedidos where id = current_setting('teste.pedido')::uuid),
  'cotado',
  'pagamento recusado mantém o Pedido em cotado'
);

-- Autorização: valor == Preço fechado e o Pedido vai a confirmado.
select set_config('teste.pagamento', public.registrar_pagamento(
  current_setting('teste.pedido')::uuid,
  '11111111-1111-4111-8111-111111111111', 25925, 'autorizado', 'pix', 'mock', 'mock_ok')::text,
  true);
select results_eq(
  $$ select pg.valor, pg.estado::text, pg.metodo::text, pg.provedor, pg.referencia_externa,
            pg.criado_em = now(), p.estado::text, pg.valor = p.preco_total
     from public.pagamentos pg join public.pedidos p on p.id = pg.pedido_id
     where pg.id = current_setting('teste.pagamento')::uuid $$,
  $$ values (25925, 'autorizado', 'pix', 'mock', 'mock_ok', true, 'confirmado', true) $$,
  'autorizado: o pagamento tem o valor do Preço fechado e o Pedido vai a confirmado'
);
select throws_ok(
  $$ select public.registrar_pagamento(current_setting('teste.pedido')::uuid,
       '11111111-1111-4111-8111-111111111111', 25925, 'autorizado', 'pix', 'mock', 'mock_2') $$,
  'P0002',
  null,
  'Pedido já confirmado não recebe outra autorização'
);
select throws_ok(
  $$ select public.preco_para_confirmar(current_setting('teste.pedido')::uuid,
                                        '11111111-1111-4111-8111-111111111111') $$,
  'P0002',
  null,
  'Pedido já confirmado não é confirmado de novo'
);

-- Uma autorização viva por Pedido, mesmo por fora das funções.
select throws_ok(
  $$ insert into public.pagamentos (pedido_id, valor, estado, metodo, provedor, referencia_externa)
     values (current_setting('teste.pedido')::uuid, 25925, 'autorizado', 'pix', 'mock', 'mock_3') $$,
  '23505',
  null,
  'no máximo um pagamento autorizado ou capturado por Pedido'
);
reset role;

-- ---------------------------------------------------------------------------
-- Leitura: o Cliente vê os do próprio Pedido; outro Cliente, não
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select results_eq(
  $$ select estado::text from public.pagamentos
     where pedido_id = current_setting('teste.pedido')::uuid order by criado_em, estado $$,
  $$ values ('autorizado'), ('recusado') $$,
  'o Cliente lê os pagamentos do próprio Pedido'
);
select throws_ok(
  $$ update public.pagamentos set valor = 1 where pedido_id = current_setting('teste.pedido')::uuid $$,
  '42501',
  null,
  'o Cliente não altera pagamentos'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select is(
  (select count(*) from public.pagamentos),
  0::bigint,
  'o Cliente B não vê os pagamentos do Cliente A'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is(
  (select count(*) from public.pagamentos where pedido_id = current_setting('teste.pedido')::uuid),
  2::bigint,
  'a operação lê todos os pagamentos'
);
reset role;

set local role anon;
select throws_ok(
  $$ select count(*) from public.pagamentos $$,
  '42501',
  null,
  'anon não lê pagamentos'
);
reset role;

select * from finish();
rollback;
