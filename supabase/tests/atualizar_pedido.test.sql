-- atualizar_pedido_cotado: o Cliente volta às perguntas e confirma de novo (revisão do #8).
--
-- Em vez de abrir outro Pedido, o app atualiza as três respostas do que já abriu. Só o
-- dono, só em `cotado`, e só as três respostas.
--
-- Usuários do seed: Cliente A (Rafael), Guincheiro G1 (Marcos). Aqui se cria o Cliente B.
begin;
select plan(10);

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Cliente B', '5561900000099',
        '11144477735', 'v1');

-- ---------------------------------------------------------------------------
-- Cliente A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select set_config('teste.pedido_a', public.abrir_pedido('carro', 'nao_liga', 'sim')::text, true);

select lives_ok(
  $$ select public.atualizar_pedido_cotado(
       current_setting('teste.pedido_a')::uuid, 'moto', 'batida', 'nao_sei') $$,
  'o Cliente muda as respostas do próprio Pedido em cotado'
);
select results_eq(
  $$ select estado::text, tipo_veiculo::text, situacao::text, rodas_giram::text,
            preco_total is null
     from public.pedidos where id = current_setting('teste.pedido_a')::uuid $$,
  $$ values ('cotado', 'moto', 'batida', 'nao_sei', true) $$,
  'o mesmo Pedido fica com as respostas novas, ainda em cotado e sem preço'
);
select is(
  (select count(*) from public.pedidos), 1::bigint,
  'confirmar de novo não cria outro Pedido'
);
select throws_ok(
  $$ select public.atualizar_pedido_cotado(
       current_setting('teste.pedido_a')::uuid, 'carro', null, 'sim') $$,
  '23502',
  null,
  'sem uma das respostas não atualiza'
);

reset role;

-- ---------------------------------------------------------------------------
-- Cliente B, Guincheiro e anon não mexem no Pedido do A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';

select throws_ok(
  $$ select public.atualizar_pedido_cotado(
       current_setting('teste.pedido_a')::uuid, 'van', 'outro', 'nao') $$,
  'P0002',
  null,
  'Cliente B não atualiza o Pedido do Cliente A'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated"}';

select throws_ok(
  $$ select public.atualizar_pedido_cotado(
       current_setting('teste.pedido_a')::uuid, 'van', 'outro', 'nao') $$,
  '42501',
  null,
  'Guincheiro não atualiza Pedido'
);

reset role;

set local role anon;

select throws_ok(
  $$ select public.atualizar_pedido_cotado(
       current_setting('teste.pedido_a')::uuid, 'van', 'outro', 'nao') $$,
  '42501',
  null,
  'anon não atualiza Pedido'
);

reset role;

select results_eq(
  $$ select tipo_veiculo::text from public.pedidos
     where id = current_setting('teste.pedido_a')::uuid $$,
  $$ values ('moto') $$,
  'as tentativas de terceiros não mudaram o Pedido'
);

-- ---------------------------------------------------------------------------
-- Fora de cotado, as respostas ficam como foram confirmadas
-- ---------------------------------------------------------------------------
update public.pedidos
set origem = extensions.st_makepoint(-47.8921, -15.7903), origem_endereco = 'Eixo Monumental',
    destino = extensions.st_makepoint(-48.0560, -15.8100),
    destino_endereco = 'QNA 12, Taguatinga Norte', km_ate_veiculo = 4.2, km_rebocado = 21.3,
    tabela_precos_versao = 1, preco_taxa_base = 11000, preco_ate_veiculo = 2100,
    preco_rebocado = 12780, preco_adicional_noturno = 0, preco_adicional_feriado = 0,
    preco_ajuste_minimo = 0, preco_total = 25880, estado = 'confirmado'
where id = current_setting('teste.pedido_a')::uuid;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ select public.atualizar_pedido_cotado(
       current_setting('teste.pedido_a')::uuid, 'van', 'outro', 'nao') $$,
  'P0002',
  null,
  'Pedido confirmado não muda de respostas'
);
select throws_ok(
  $$ update public.pedidos set tipo_veiculo = 'van'
     where id = current_setting('teste.pedido_a')::uuid $$,
  '42501',
  null,
  'o Cliente continua sem UPDATE direto em pedidos'
);

reset role;

select * from finish();
rollback;
