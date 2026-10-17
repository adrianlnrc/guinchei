-- abrir_pedido: o Cliente abre o próprio Pedido em três toques (issue #8, RF03).
--
-- O Pedido nasce `cotado`, sem trajeto nem Preço fechado: origem e destino vêm com o mapa
-- (#9) e o preço com a cotação (#10). A função só recebe as três respostas; o resto do
-- Pedido não passa por ela.
--
-- Usuários do seed: Cliente A (Rafael), Guincheiro G1 (Marcos). Aqui se cria o Cliente B.
begin;
select plan(16);

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao)
values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Cliente B', '5561900000099',
        '11144477735', now(), 'v1');

-- ---------------------------------------------------------------------------
-- Cliente A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- Guarda o id do Pedido aberto para as consultas seguintes.
select set_config('teste.pedido_a', public.abrir_pedido('suv', 'batida', 'nao_sei')::text, true);

select results_eq(
  $$ select cliente_id, estado::text, tipo_veiculo::text, situacao::text, rodas_giram::text
     from public.pedidos where id = current_setting('teste.pedido_a')::uuid $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'cotado', 'suv', 'batida', 'nao_sei') $$,
  'o Cliente abre o próprio Pedido em cotado e o lê com as três respostas'
);

select is(
  (select num_nulls(
     origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
     tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado,
     preco_adicional_noturno, preco_adicional_feriado, preco_ajuste_minimo, preco_total)
   from public.pedidos where id = current_setting('teste.pedido_a')::uuid),
  14,
  'o Pedido aberto não tem trajeto nem Preço fechado (vêm do servidor em #9 e #10)'
);

select throws_ok(
  $$ select public.abrir_pedido(null, 'batida', 'sim') $$,
  '23502',
  null,
  'sem tipo de veículo não abre'
);
select throws_ok(
  $$ select public.abrir_pedido('carro', null, 'sim') $$,
  '23502',
  null,
  'sem situação não abre'
);
select throws_ok(
  $$ select public.abrir_pedido('carro', 'batida', null) $$,
  '23502',
  null,
  'sem a resposta das rodas não abre'
);
select throws_ok(
  $$ select public.abrir_pedido('caminhao', 'batida', 'sim') $$,
  '22P02',
  null,
  'tipo de veículo fora das opções não abre'
);
select throws_ok(
  $$ select public.abrir_pedido('carro', 'batida', 'sim', 99900) $$,
  '42883',
  null,
  'não há como passar preço para a função'
);
select throws_ok(
  $$ insert into public.pedidos (cliente_id, tipo_veiculo, situacao, rodas_giram)
     values ('11111111-1111-4111-8111-111111111111', 'carro', 'nao_liga', 'sim') $$,
  '42501',
  null,
  'o Cliente continua sem INSERT direto em pedidos'
);

reset role;

-- ---------------------------------------------------------------------------
-- Cliente B, Guincheiro e anon
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';

select is_empty(
  $$ select id from public.pedidos where id = current_setting('teste.pedido_a')::uuid $$,
  'Cliente B não lê o Pedido do Cliente A'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated"}';

select throws_ok(
  $$ select public.abrir_pedido('carro', 'nao_liga', 'sim') $$,
  '42501',
  null,
  'Guincheiro não abre Pedido'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated"}';

select throws_ok(
  $$ select public.abrir_pedido('carro', 'nao_liga', 'sim') $$,
  '42501',
  null,
  'usuário logado sem cadastro urgente não abre Pedido'
);

reset role;

set local role anon;

select throws_ok(
  $$ select public.abrir_pedido('carro', 'nao_liga', 'sim') $$,
  '42501',
  null,
  'anon não abre Pedido'
);

reset role;

-- ---------------------------------------------------------------------------
-- Coerência do Preço fechado (o servidor, em #10, grava a cotação)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.pedidos set preco_total = 25880
     where id = current_setting('teste.pedido_a')::uuid $$,
  '23514',
  null,
  'o Preço fechado não é gravado pela metade'
);
select throws_ok(
  $$ update public.pedidos
     set tabela_precos_versao = 1, preco_taxa_base = 11000, preco_ate_veiculo = 2100,
         preco_rebocado = 12780, preco_adicional_noturno = 0, preco_adicional_feriado = 0,
         preco_ajuste_minimo = 0, preco_total = 25880
     where id = current_setting('teste.pedido_a')::uuid $$,
  '23514',
  null,
  'não se cota sem origem, destino e distâncias'
);
select throws_ok(
  $$ update public.pedidos set estado = 'confirmado'
     where id = current_setting('teste.pedido_a')::uuid $$,
  '23514',
  null,
  'Pedido sem Preço fechado não é confirmado'
);
select lives_ok(
  $$ update public.pedidos
     set origem = extensions.st_makepoint(-47.8921, -15.7903), origem_endereco = 'Eixo Monumental',
         destino = extensions.st_makepoint(-48.0560, -15.8100),
         destino_endereco = 'QNA 12, Taguatinga Norte', km_ate_veiculo = 4.2, km_rebocado = 21.3,
         tabela_precos_versao = 1, preco_taxa_base = 11000, preco_ate_veiculo = 2100,
         preco_rebocado = 12780, preco_adicional_noturno = 0, preco_adicional_feriado = 0,
         preco_ajuste_minimo = 0, preco_total = 25880
     where id = current_setting('teste.pedido_a')::uuid $$,
  'o servidor grava a cotação inteira no Pedido aberto'
);

select * from finish();
rollback;
