-- Preço fechado refeito quando o Pedido é redirecionado a outra Frota (issue #58, ADR-0013).
--
-- A Edge Function `ofertar-proximo` decide com `decidirRecotacao` (@guinchei/match) e grava
-- por `registrar_recotacao`: candidato da mesma Frota cotada não recota (o banco recusa);
-- outra Frota e preço menor ou igual vale na hora ('aplicada'); outra Frota e preço maior
-- pausa o Match ('pendente', Pedido em `aguardando_aprovacao_preco`) até o Cliente aprovar
-- (`aprovar_novo_preco`), desistir (`desistir_do_novo_preco`) ou o prazo vencer
-- (`varrer_aprovacoes_de_preco`).
--
-- Usuários do seed: Cliente A (Rafael), G1 Marcos e G2 Wagner (Frota Reboque Planalto,
-- f...01), G3 Rita (Frota autônoma, f...02, ~9,6 km do Eixo Monumental). Aqui se cria o
-- Cliente B.
begin;
select plan(49);

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Cliente B', '5561900000099',
        '11144477735', 'v1');

-- Pedido do Cliente A no Eixo Monumental, cotado com o Marcos (Frota Reboque Planalto) e,
-- se `pagar`, com o pagamento autorizado (rodada 1 do Match).
create function pg_temp.pedido(referencia text, pagar boolean) returns uuid
language plpgsql as $$
declare
  id uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
  id := public.abrir_pedido('carro', 'nao_liga', 'sim');
  perform public.definir_trajeto_pedido(id,
    -15.7903, -47.8921, 'Eixo Monumental, Brasília - DF',
    -15.8336, -48.0566, 'QNA 12, Taguatinga Norte, Brasília - DF',
    21.347);
  reset role;
  perform public.gravar_cotacao(id, '11111111-1111-4111-8111-111111111111',
    (public.dados_da_cotacao(id, '11111111-1111-4111-8111-111111111111') ->> 'trajeto'),
    4.21, 1, 11000, 2105, 12810, 0, 0, 0, 25915, '2026-10-13T14:00:00-03:00',
    'f0000000-0000-4000-8000-000000000001');
  if pagar then
    perform public.registrar_pagamento(id, '11111111-1111-4111-8111-111111111111',
      25915, 'autorizado', 'pix', 'mock', referencia);
  end if;
  return id;
end;
$$;

create function pg_temp.como(usuario text) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
end;
$$;

-- Rita (outra Frota): mais cara (28610 = 11000 + 4800 + 12810) e mais barata (24000).
create function pg_temp.recotar_rita(pedido uuid, total integer, exige boolean)
returns public.resultado_recotacao
language sql as $$
  select public.registrar_recotacao(pedido, 1, 0, '22222222-2222-4222-8222-222222222203', 9.6,
    11000, case when total > 25915 then 4800 else 190 end, 12810, 0, 0, 0, total, exige);
$$;

-- ---------------------------------------------------------------------------
-- Cotação grava a Frota cotada
-- ---------------------------------------------------------------------------
select set_config('teste.cotado', pg_temp.pedido('x', false)::text, true);
select results_eq(
  $$ select estado::text, frota_cotada_id from public.pedidos
     where id = current_setting('teste.cotado')::uuid $$,
  $$ values ('cotado', 'f0000000-0000-4000-8000-000000000001'::uuid) $$,
  'gravar_cotacao grava a Frota cotada, o Pedido continua cotado'
);
select is(
  (public.dados_da_cotacao(current_setting('teste.cotado')::uuid,
     '11111111-1111-4111-8111-111111111111') ->> 'frota_id')::uuid,
  'f0000000-0000-4000-8000-000000000001'::uuid,
  'dados_da_cotacao devolve a Frota do Guincheiro elegível mais próximo (o Marcos)'
);

select set_config('teste.p1', pg_temp.pedido('mock_rec_1', true)::text, true);
select set_config('teste.p2', pg_temp.pedido('mock_rec_2', true)::text, true);
select set_config('teste.p3', pg_temp.pedido('mock_rec_3', true)::text, true);
select set_config('teste.p4', pg_temp.pedido('mock_rec_4', true)::text, true);
select set_config('teste.p5', pg_temp.pedido('mock_rec_5', true)::text, true);

select is(
  (select prazo_aprovacao_preco_segundos from public.parametros_match),
  120,
  'o prazo para aprovar o novo preço é configurável e começa em 120 s'
);

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
set local role authenticated;
select throws_ok(
  $$ select public.registrar_recotacao(current_setting('teste.p1')::uuid, 1, 0,
       '22222222-2222-4222-8222-222222222203', 9.6, 11000, 190, 12810, 0, 0, 0, 24000, false) $$,
  '42501', null, 'pela API ninguém registra recotação'
);
select throws_ok(
  $$ select public.varrer_aprovacoes_de_preco() $$,
  '42501', null, 'pela API ninguém roda a varredura de aprovações'
);
reset role;

-- ---------------------------------------------------------------------------
-- Mesma Frota e incoerências: o banco recusa
-- ---------------------------------------------------------------------------
set local role service_role;
select throws_ok(
  $$ select public.registrar_recotacao(current_setting('teste.p1')::uuid, 1, 0,
       '22222222-2222-4222-8222-222222222202', 4.9, 11000, 2450, 12810, 0, 0, 0, 26260, true) $$,
  '22023', null, 'Wagner é da Frota cotada: não há recotação (nada muda para o Cliente)'
);
reset role;
select throws_ok(
  $$ select pg_temp.recotar_rita(current_setting('teste.p1')::uuid, 28610, false) $$,
  '22023', null, 'preço maior não segue sem a aprovação do Cliente'
);
select throws_ok(
  $$ select pg_temp.recotar_rita(current_setting('teste.p1')::uuid, 24000, true) $$,
  '22023', null, 'preço menor não pede aprovação'
);
set local role service_role;
select throws_ok(
  $$ select public.registrar_recotacao(current_setting('teste.p1')::uuid, 1, 1,
       '22222222-2222-4222-8222-222222222203', 9.6, 11000, 190, 12810, 0, 0, 0, 24000, false) $$,
  'GMT03', null, 'tentativas lidas diferentes das gravadas (outra execução gravou antes)'
);
select throws_ok(
  $$ select public.registrar_recotacao(current_setting('teste.p1')::uuid, 2, 0,
       '22222222-2222-4222-8222-222222222203', 9.6, 11000, 190, 12810, 0, 0, 0, 24000, false) $$,
  'GMT03', null, 'rodada diferente da atual'
);
reset role;

-- ---------------------------------------------------------------------------
-- Outra Frota, preço menor: segue sem pausa; o Pedido passa a valer o novo preço
-- ---------------------------------------------------------------------------
select is(
  pg_temp.recotar_rita(current_setting('teste.p1')::uuid, 24000, false),
  'aplicada'::public.resultado_recotacao,
  'outra Frota mais barata: recotação aplicada na hora'
);

select results_eq(
  $$ select estado::text, preco_total, preco_ate_veiculo, km_ate_veiculo, frota_cotada_id
     from public.pedidos where id = current_setting('teste.p1')::uuid $$,
  $$ values ('em_match', 24000, 190, 9.6::numeric, 'f0000000-0000-4000-8000-000000000002'::uuid) $$,
  'o Pedido segue em em_match, com o novo preço, a nova decomposição e a nova Frota cotada'
);
select results_eq(
  $$ select estado::text, valor from public.pagamentos
     where pedido_id = current_setting('teste.p1')::uuid $$,
  $$ values ('autorizado', 24000) $$,
  'a autorização cai para o novo valor (a diferença é estornada)'
);
select results_eq(
  $$ select resultado::text, preco_anterior, preco_novo, frota_anterior_id, frota_nova_id,
            expira_em is null, respondida_em is not null
     from public.recotacoes_pedido where pedido_id = current_setting('teste.p1')::uuid $$,
  $$ values ('aplicada', 25915, 24000, 'f0000000-0000-4000-8000-000000000001'::uuid,
             'f0000000-0000-4000-8000-000000000002'::uuid, true, true) $$,
  'a recotação fica no histórico, com os dois preços e as duas Frotas'
);
set local role service_role;
select is(
  (public.dados_do_match(current_setting('teste.p1')::uuid) ->> 'frota_cotada_id')::uuid,
  'f0000000-0000-4000-8000-000000000002'::uuid,
  'dados_do_match devolve a nova Frota cotada: os próximos candidatos dela não recotam'
);
select ok(
  (select bool_and(c ? 'frota_id')
   from jsonb_array_elements(public.dados_do_match(current_setting('teste.p1')::uuid) -> 'candidatos') c),
  'dados_do_match devolve a Frota de cada candidato'
);
reset role;

-- ---------------------------------------------------------------------------
-- Outra Frota, preço maior: o Match pausa
-- ---------------------------------------------------------------------------
select is(
  pg_temp.recotar_rita(current_setting('teste.p2')::uuid, 28610, true),
  'pendente'::public.resultado_recotacao,
  'outra Frota mais cara: recotação pendente'
);

select results_eq(
  $$ select estado::text, preco_total, frota_cotada_id from public.pedidos
     where id = current_setting('teste.p2')::uuid $$,
  $$ values ('aguardando_aprovacao_preco', 25915, 'f0000000-0000-4000-8000-000000000001'::uuid) $$,
  'o Pedido aguarda a aprovação, ainda com o preço e a Frota anteriores'
);
select results_eq(
  $$ select resultado::text, preco_anterior, preco_novo, preco_ate_veiculo,
            expira_em = now() + interval '120 seconds'
     from public.recotacoes_pedido where pedido_id = current_setting('teste.p2')::uuid $$,
  $$ values ('pendente', 25915, 28610, 4800, true) $$,
  'a recotação pendente guarda os dois preços, a decomposição nova e o prazo'
);
select results_eq(
  $$ select valor from public.pagamentos where pedido_id = current_setting('teste.p2')::uuid $$,
  $$ values (25915) $$,
  'a autorização só sobe se o Cliente aprovar'
);

set local role service_role;
select throws_ok(
  $$ select public.registrar_tentativa(current_setting('teste.p2')::uuid, 1,
       '22222222-2222-4222-8222-222222222203', 1, 'oferecida', 9.6, 28610, 22888) $$,
  'GMT03', null, 'pausado: nenhuma oferta sai enquanto o Cliente não responde'
);
select is(
  public.dados_do_match(current_setting('teste.p2')::uuid) ->> 'estado',
  'aguardando_aprovacao_preco',
  'o Match não tem o que decidir enquanto o Pedido aguarda a aprovação'
);
reset role;

-- Prazo não vencido: a varredura não mexe.
select is_empty(
  $$ select * from public.varrer_aprovacoes_de_preco() $$,
  'a varredura ignora a recotação dentro do prazo'
);

-- ---------------------------------------------------------------------------
-- Aprovação
-- ---------------------------------------------------------------------------
select pg_temp.como('44444444-4444-4444-8444-444444444444');
select throws_ok(
  $$ select public.aprovar_novo_preco(current_setting('teste.p2')::uuid) $$,
  'P0002', null, 'outro Cliente não aprova o preço do Pedido alheio'
);
reset role;
select pg_temp.como('22222222-2222-4222-8222-222222222201');
select throws_ok(
  $$ select public.aprovar_novo_preco(current_setting('teste.p2')::uuid) $$,
  'P0002', null, 'o Guincheiro não aprova o preço do Cliente'
);
reset role;
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select public.aprovar_novo_preco(current_setting('teste.p1')::uuid) $$,
  'P0002', null, 'só se aprova Pedido que aguarda a aprovação'
);
select lives_ok(
  $$ select public.aprovar_novo_preco(current_setting('teste.p2')::uuid) $$,
  'o Cliente aprova o novo preço'
);
reset role;

select results_eq(
  $$ select estado::text, preco_total, preco_ate_veiculo, km_ate_veiculo, frota_cotada_id
     from public.pedidos where id = current_setting('teste.p2')::uuid $$,
  $$ values ('em_match', 28610, 4800, 9.6::numeric, 'f0000000-0000-4000-8000-000000000002'::uuid) $$,
  'aprovado: o Match continua (em_match) com o novo preço e a nova Frota'
);
select results_eq(
  $$ select estado::text, valor from public.pagamentos
     where pedido_id = current_setting('teste.p2')::uuid $$,
  $$ values ('autorizado', 28610) $$,
  'aprovado: a autorização sobe para o novo valor (mock da diferença)'
);
select results_eq(
  $$ select resultado::text, respondida_em is not null from public.recotacoes_pedido
     where pedido_id = current_setting('teste.p2')::uuid $$,
  $$ values ('aprovada', true) $$,
  'a recotação fica aprovada no histórico'
);
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select public.aprovar_novo_preco(current_setting('teste.p2')::uuid) $$,
  'P0002', null, 'aprovar de novo não faz nada (o Pedido já saiu da espera)'
);
reset role;

-- ---------------------------------------------------------------------------
-- Desistência: estorno integral, sem custo
-- ---------------------------------------------------------------------------
select pg_temp.recotar_rita(current_setting('teste.p3')::uuid, 28610, true);

select pg_temp.como('44444444-4444-4444-8444-444444444444');
select throws_ok(
  $$ select public.desistir_do_novo_preco(current_setting('teste.p3')::uuid) $$,
  'P0002', null, 'outro Cliente não desiste pelo dono do Pedido'
);
reset role;
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select lives_ok(
  $$ select public.desistir_do_novo_preco(current_setting('teste.p3')::uuid) $$,
  'o Cliente desiste do novo preço'
);
reset role;

select results_eq(
  $$ select p.estado::text, pg.estado::text, pg.valor
     from public.pedidos p join public.pagamentos pg on pg.pedido_id = p.id
     where p.id = current_setting('teste.p3')::uuid $$,
  $$ values ('estornado', 'estornado', 25915) $$,
  'desistiu: Pedido estornado e estorno integral do valor que estava autorizado'
);
select results_eq(
  $$ select resultado::text from public.recotacoes_pedido
     where pedido_id = current_setting('teste.p3')::uuid $$,
  $$ values ('desistida') $$,
  'a recotação fica desistida no histórico'
);
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select public.desistir_do_novo_preco(current_setting('teste.p3')::uuid) $$,
  'P0002', null, 'o Pedido estornado não aguarda mais nada'
);
reset role;

-- ---------------------------------------------------------------------------
-- Prazo vencido: vale como desistência
-- ---------------------------------------------------------------------------
select pg_temp.recotar_rita(current_setting('teste.p4')::uuid, 28610, true);
update public.recotacoes_pedido set expira_em = now() - interval '1 second'
where pedido_id = current_setting('teste.p4')::uuid;

select pg_temp.como('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select public.aprovar_novo_preco(current_setting('teste.p4')::uuid) $$,
  'GRC01', null, 'aprovar depois do prazo é recusado'
);
reset role;

select results_eq(
  $$ select * from public.varrer_aprovacoes_de_preco() $$,
  $$ select current_setting('teste.p4')::uuid $$,
  'a varredura encerra o Pedido de prazo vencido (e só ele)'
);
select results_eq(
  $$ select p.estado::text, pg.estado::text, pg.valor, r.resultado::text
     from public.pedidos p
     join public.pagamentos pg on pg.pedido_id = p.id
     join public.recotacoes_pedido r on r.pedido_id = p.id
     where p.id = current_setting('teste.p4')::uuid $$,
  $$ values ('estornado', 'estornado', 25915, 'expirada') $$,
  'prazo vencido: Pedido e pagamento estornados por inteiro, recotação expirada'
);
select is_empty(
  $$ select * from public.varrer_aprovacoes_de_preco() $$,
  'a varredura não encerra duas vezes'
);

-- ---------------------------------------------------------------------------
-- Uma pendente por Pedido; histórico visível só a quem deve ver
-- ---------------------------------------------------------------------------
select pg_temp.recotar_rita(current_setting('teste.p5')::uuid, 28610, true);
select throws_ok(
  $$ insert into public.recotacoes_pedido (
       pedido_id, rodada, guincheiro_id, frota_anterior_id, frota_nova_id, km_ate_veiculo,
       preco_anterior, preco_novo, tabela_precos_versao, preco_taxa_base, preco_ate_veiculo,
       preco_rebocado, resultado, expira_em
     ) values (
       current_setting('teste.p5')::uuid, 1, '22222222-2222-4222-8222-222222222203',
       'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 9.6,
       25915, 28610, 1, 11000, 4800, 12810, 'pendente', now() + interval '1 minute'
     ) $$,
  '23505', null, 'nunca duas recotações pendentes para o mesmo Pedido'
);
select throws_ok(
  $$ insert into public.recotacoes_pedido (
       pedido_id, rodada, guincheiro_id, frota_anterior_id, frota_nova_id, km_ate_veiculo,
       preco_anterior, preco_novo, tabela_precos_versao, preco_taxa_base, preco_ate_veiculo,
       preco_rebocado, resultado
     ) values (
       current_setting('teste.p5')::uuid, 1, '22222222-2222-4222-8222-222222222203',
       'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 9.6,
       25915, 28610, 1, 11000, 4800, 12810, 'aplicada'
     ) $$,
  '23514', null, 'aplicada não pode subir o preço'
);

select pg_temp.como('11111111-1111-4111-8111-111111111111');
select is(
  (select count(*)::int from public.recotacoes_pedido), 5,
  'o Cliente lê as recotações dos próprios Pedidos'
);
reset role;
select pg_temp.como('44444444-4444-4444-8444-444444444444');
select is(
  (select count(*)::int from public.recotacoes_pedido), 0,
  'outro Cliente não lê as recotações alheias'
);
reset role;
select pg_temp.como('22222222-2222-4222-8222-222222222203');
select is(
  (select count(*)::int from public.recotacoes_pedido), 0,
  'o Guincheiro não lê as recotações'
);
reset role;
select pg_temp.como('33333333-3333-4333-8333-333333333333');
select is(
  (select count(*)::int from public.recotacoes_pedido
   where pedido_id = current_setting('teste.p5')::uuid), 1,
  'a operação lê as recotações (o Monitor mostra o Pedido aguardando aprovação)'
);
select throws_ok(
  $$ update public.recotacoes_pedido set resultado = 'aprovada' $$,
  '42501', null, 'ninguém escreve no histórico pela API, nem a operação'
);
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.recotacoes_pedido $$,
  '42501', null, 'anônimo não lê as recotações'
);
reset role;

select results_eq(
  $$ select schedule, command from cron.job where jobname = 'match-aprovacao-varrer' $$,
  $$ values ('5 seconds', 'select public.varrer_aprovacoes_de_preco()') $$,
  'o pg_cron roda a varredura das aprovações a cada 5 s'
);

select * from finish();
rollback;
