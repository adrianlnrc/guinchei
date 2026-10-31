-- Vencimento de apólice, certidão e CNH com alerta (issue #49, ADR-0012).
--
-- Cobre o job `homologacao-vencer` (pg_cron) e `marcar_itens_vencidos`, a fronteira do dia, a
-- auditoria sem autor (o "sistema"), o prazo do alerta em `parametros_homologacao`, a lista
-- `itens_em_alerta_de_vencimento` por quem chama e o reenvio, que devolve o item a `pendente`.
-- As datas são relativas a `hoje_em_brasilia()`: o teste vale em qualquer dia. Os dados são
-- todos criados aqui (nada do seed, que tem RENAVAM, placa, CNH e CPF próprios): uma Frota
-- empresa (Elisa, com os Guincheiros Fabio e Gabriela) e uma Frota de fora (Heitor). A operação
-- e o Cliente são os do seed, só como quem chama.
begin;
select plan(40);

create function pg_temp.como(usuario text) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, aud, role, phone) values
  ('e5000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '5561900000601'),
  ('e5000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '5561900000602'),
  ('e5000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '5561900000603'),
  ('e5000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', '5561900000604');

-- CPFs e CNPJs válidos que o seed não usa.
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao) values
  ('e5000000-0000-4000-8000-000000000001', 'representante', 'Elisa Representante', '5561900000601', '48151623446', now(), 'teste'),
  ('e5000000-0000-4000-8000-000000000002', 'guincheiro', 'Fabio Guincheiro', '5561900000602', '72918364509', now(), 'teste'),
  ('e5000000-0000-4000-8000-000000000003', 'guincheiro', 'Gabriela Guincheira', '5561900000603', '36482917500', now(), 'teste'),
  ('e5000000-0000-4000-8000-000000000004', 'representante', 'Heitor de Fora', '5561900000604', '91726483509', now(), 'teste');

insert into public.frotas (id, tipo, documento, nome, representante_id, base_cep, base_endereco,
                           base_bairro, chave_pix, termos_prestador_versao)
values
  ('f5000000-0000-4000-8000-000000000001', 'empresa', '48151623000191', 'Guinchos Elisa',
   'e5000000-0000-4000-8000-000000000001', '70000000', 'SQN 1', 'Asa Norte', 'elisa@exemplo.com', 'teste'),
  ('f5000000-0000-4000-8000-000000000002', 'empresa', '72918364000166', 'Reboques do Heitor',
   'e5000000-0000-4000-8000-000000000004', '70000000', 'SQS 2', 'Asa Sul', 'heitor@exemplo.com', 'teste');

insert into public.guincheiros (id, frota_id, posicao, disponivel) values
  ('e5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-47.88, -15.79), 4326), false),
  ('e5000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000001',
   extensions.st_setsrid(extensions.st_makepoint(-47.88, -15.79), 4326), false);

-- Itens do cenário, com o prazo relativo a hoje (em dias; nulo = sem validade):
--   ...01 apólice da Frota da Elisa, vence daqui a 30 dias  -> no limite do alerta
--   ...02 CNH do Fabio, vence daqui a 31 dias               -> fora do alerta
--   ...03 antecedentes do Fabio, vence hoje                 -> último dia: ainda vale
--   ...04 CNH da Gabriela, venceu ontem                     -> vence na varredura
--   ...05 apólice da Frota do Heitor, venceu ontem          -> vence na varredura (outra Frota)
--   ...06 selfie do Fabio, sem validade                     -> nunca vence
--   ...07 antecedentes da Gabriela, pendente, vence em 5    -> pendente não entra no alerta
create temporary table itens_do_teste (
  id uuid, frota uuid, alvo public.alvo_homologacao, alvo_id uuid,
  tipo public.tipo_item_homologacao, dono uuid, dias integer
);
insert into itens_do_teste values
  ('a5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'frota',
   'f5000000-0000-4000-8000-000000000001', 'apolice_rc', 'e5000000-0000-4000-8000-000000000001', 30),
  ('a5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', 'guincheiro',
   'e5000000-0000-4000-8000-000000000002', 'cnh', 'e5000000-0000-4000-8000-000000000002', 31),
  ('a5000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000001', 'guincheiro',
   'e5000000-0000-4000-8000-000000000002', 'antecedentes', 'e5000000-0000-4000-8000-000000000002', 0),
  ('a5000000-0000-4000-8000-000000000004', 'f5000000-0000-4000-8000-000000000001', 'guincheiro',
   'e5000000-0000-4000-8000-000000000003', 'cnh', 'e5000000-0000-4000-8000-000000000003', -1),
  ('a5000000-0000-4000-8000-000000000005', 'f5000000-0000-4000-8000-000000000002', 'frota',
   'f5000000-0000-4000-8000-000000000002', 'apolice_rc', 'e5000000-0000-4000-8000-000000000004', -1),
  ('a5000000-0000-4000-8000-000000000006', 'f5000000-0000-4000-8000-000000000001', 'guincheiro',
   'e5000000-0000-4000-8000-000000000002', 'selfie', 'e5000000-0000-4000-8000-000000000002', null),
  ('a5000000-0000-4000-8000-000000000007', 'f5000000-0000-4000-8000-000000000001', 'guincheiro',
   'e5000000-0000-4000-8000-000000000003', 'antecedentes', 'e5000000-0000-4000-8000-000000000003', 5);

-- Os itens nascem pendentes e com validade futura, como no envio; os seis primeiros são
-- aprovados e só então a validade recua para o dia do cenário, como acontece com o passar do tempo.
insert into public.itens_homologacao
  (id, frota_id, alvo, alvo_id, tipo, dono_id, arquivo, validade)
select id, frota, alvo, alvo_id, tipo, dono, dono::text || '/doc-' || right(id::text, 2) || '.pdf',
       case when dias is null then null else public.hoje_em_brasilia() + 400 end
from itens_do_teste;

update public.itens_homologacao set estado = 'aprovado'
where id::text like 'a5000000-%' and right(id::text, 2) <> '07';
update public.itens_homologacao i set validade = public.hoje_em_brasilia() + t.dias
from itens_do_teste t where t.id = i.id and t.dias is not null;

-- ---------------------------------------------------------------------------
-- O prazo do alerta e o job
-- ---------------------------------------------------------------------------
select is(
  (select alerta_vencimento_dias from public.parametros_homologacao), 30,
  'o prazo do alerta é de 30 dias por padrão'
);
select is((select count(*) from public.parametros_homologacao), 1::bigint, 'o parâmetro é uma linha só');
select throws_ok(
  $$ insert into public.parametros_homologacao (id, alerta_vencimento_dias) values (false, 10) $$,
  '23514', null, 'não cabe uma segunda linha de parâmetros'
);
select throws_ok(
  $$ update public.parametros_homologacao set alerta_vencimento_dias = 0 $$,
  '23514', null, 'o prazo do alerta é de no mínimo 1 dia'
);
select results_eq(
  $$ select schedule, command from cron.job where jobname = 'homologacao-vencer' $$,
  $$ values ('5 3 * * *', 'select public.marcar_itens_vencidos()') $$,
  'o pg_cron roda a varredura de vencimento às 00:05 de Brasília'
);

select pg_temp.como('e5000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select * from public.parametros_homologacao $$,
  '42501', null, 'pela API ninguém lê a tabela de parâmetros'
);
select is(public.prazo_alerta_vencimento_dias(), 30, 'o app lê o prazo pela função');
select throws_ok(
  $$ select public.marcar_itens_vencidos() $$,
  '42501', null, 'o representante não roda o job de vencimento'
);
reset role;

-- ---------------------------------------------------------------------------
-- A lista de alerta, antes da varredura
-- ---------------------------------------------------------------------------
select pg_temp.como('33333333-3333-4333-8333-333333333333');
select results_eq(
  $$ select item_id::text, estado::text, dias_restantes from public.itens_em_alerta_de_vencimento()
     where item_id::text like 'a5000000-%' $$,
  $$ values ('a5000000-0000-4000-8000-000000000004', 'vencido', -1),
            ('a5000000-0000-4000-8000-000000000005', 'vencido', -1),
            ('a5000000-0000-4000-8000-000000000003', 'aprovado', 0),
            ('a5000000-0000-4000-8000-000000000001', 'aprovado', 30) $$,
  'a operação vê vencidos e a vencer em até 30 dias, do mais urgente; 31 dias, pendente e sem validade ficam de fora'
);
select results_eq(
  $$ select frota_nome, guincheiro_nome from public.itens_em_alerta_de_vencimento()
     where item_id = 'a5000000-0000-4000-8000-000000000004' $$,
  $$ values ('Guinchos Elisa', 'Gabriela Guincheira') $$,
  'o alerta traz a Frota e o nome do Guincheiro dono do documento'
);
reset role;

select is(
  (select estado::text from public.itens_homologacao where id = 'a5000000-0000-4000-8000-000000000004'),
  'aprovado', 'antes da varredura o banco ainda guarda aprovado'
);
select ok(
  not public.item_vigente('aprovado', public.hoje_em_brasilia() - 1),
  'aprovado com a validade de ontem não é vigente'
);
select ok(
  public.item_vigente('aprovado', public.hoje_em_brasilia()),
  'aprovado com a validade de hoje ainda é vigente (a validade vale até o fim do dia)'
);
select ok(public.item_vigente('aprovado', null), 'aprovado sem validade é vigente');
select ok(not public.item_vigente('vencido', public.hoje_em_brasilia() + 10), 'vencido nunca é vigente');
select ok(not public.item_vigente('pendente', public.hoje_em_brasilia() + 10), 'pendente não é vigente');

-- ---------------------------------------------------------------------------
-- A varredura e a fronteira do dia
-- ---------------------------------------------------------------------------
-- O job do pg_cron roda sem usuário logado.
set local request.jwt.claims to '{}';
select is(public.marcar_itens_vencidos(), 2::integer, 'a varredura vence os dois itens com validade de ontem');
select is(
  (select estado::text from public.itens_homologacao where id = 'a5000000-0000-4000-8000-000000000004'),
  'vencido', 'a CNH que venceu ontem está vencida'
);
select is(
  (select estado::text from public.itens_homologacao where id = 'a5000000-0000-4000-8000-000000000005'),
  'vencido', 'a apólice de outra Frota que venceu ontem também'
);
select is(
  (select estado::text from public.itens_homologacao where id = 'a5000000-0000-4000-8000-000000000003'),
  'aprovado', 'fronteira: a validade de hoje ainda vale, não vence'
);
select is(
  (select estado::text from public.itens_homologacao where id = 'a5000000-0000-4000-8000-000000000001'),
  'aprovado', 'a validade futura (30 dias) não muda'
);
select is(
  (select estado::text from public.itens_homologacao where id = 'a5000000-0000-4000-8000-000000000006'),
  'aprovado', 'item sem validade nunca vence'
);
select is(
  (select estado::text from public.itens_homologacao where id = 'a5000000-0000-4000-8000-000000000007'),
  'pendente', 'o pendente não é vencido pela varredura'
);
select results_eq(
  $$ select de::text, para::text, por, motivo like 'Validade vencida em %'
     from public.auditoria_homologacao
     where item_id = 'a5000000-0000-4000-8000-000000000004' order by id desc limit 1 $$,
  $$ values ('aprovado', 'vencido', null::uuid, true) $$,
  'a trilha registra o vencimento feito pelo sistema (sem autor) e o dia da validade'
);
select is(
  (select count(*) from public.auditoria_homologacao
   where item_id in ('a5000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000003')
     and para = 'vencido'),
  0::bigint, 'o item que não venceu não ganha linha de vencimento na trilha'
);
select is(public.marcar_itens_vencidos(), 0::integer, 'rodar a varredura de novo não muda nada');

-- Um dia depois, o item de validade de hoje vence: a fronteira andou um dia.
update public.itens_homologacao set validade = public.hoje_em_brasilia() - 1
where id = 'a5000000-0000-4000-8000-000000000003';
select is(public.marcar_itens_vencidos(), 1::integer, 'passado o último dia de validade, o item vence');

-- ---------------------------------------------------------------------------
-- A lista depois da varredura, por quem chama
-- ---------------------------------------------------------------------------
select pg_temp.como('e5000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select item_id::text, posso_reenviar from public.itens_em_alerta_de_vencimento() order by item_id $$,
  $$ values ('a5000000-0000-4000-8000-000000000001', true),
            ('a5000000-0000-4000-8000-000000000003', false),
            ('a5000000-0000-4000-8000-000000000004', false) $$,
  'o representante vê os itens da própria Frota (e só eles); reenvia só os que são dele'
);
reset role;
select pg_temp.como('e5000000-0000-4000-8000-000000000003');
select results_eq(
  $$ select item_id::text, estado::text, dias_restantes, posso_reenviar from public.itens_em_alerta_de_vencimento() $$,
  $$ values ('a5000000-0000-4000-8000-000000000004', 'vencido', -1, true) $$,
  'o Guincheiro vê só os documentos dele'
);
reset role;
select pg_temp.como('e5000000-0000-4000-8000-000000000004');
select results_eq(
  $$ select item_id::text from public.itens_em_alerta_de_vencimento() $$,
  $$ values ('a5000000-0000-4000-8000-000000000005') $$,
  'o representante de outra Frota não vê a Frota da Elisa'
);
reset role;
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select is_empty(
  $$ select * from public.itens_em_alerta_de_vencimento() $$,
  'o Cliente não vê nenhum item'
);
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.itens_em_alerta_de_vencimento() $$,
  '42501', null, 'sem login não chama a lista'
);
reset role;

-- ---------------------------------------------------------------------------
-- O prazo é configurável sem deploy
-- ---------------------------------------------------------------------------
update public.parametros_homologacao set alerta_vencimento_dias = 45;
select pg_temp.como('33333333-3333-4333-8333-333333333333');
select results_eq(
  $$ select item_id::text from public.itens_em_alerta_de_vencimento()
     where item_id::text like 'a5000000-%' and estado = 'aprovado' order by item_id $$,
  $$ values ('a5000000-0000-4000-8000-000000000001'), ('a5000000-0000-4000-8000-000000000002') $$,
  'com o prazo em 45 dias, a CNH que vence em 31 dias entra no alerta'
);
reset role;
update public.parametros_homologacao set alerta_vencimento_dias = 10;
select pg_temp.como('33333333-3333-4333-8333-333333333333');
select is_empty(
  $$ select item_id from public.itens_em_alerta_de_vencimento()
     where item_id::text like 'a5000000-%' and estado = 'aprovado' $$,
  'com o prazo em 10 dias, a apólice que vence em 30 dias sai do alerta'
);
reset role;
update public.parametros_homologacao set alerta_vencimento_dias = 30;

-- ---------------------------------------------------------------------------
-- O reenvio devolve o vencido a pendente
-- ---------------------------------------------------------------------------
insert into storage.objects (bucket_id, name, owner)
values ('documentos-prestadores', 'e5000000-0000-4000-8000-000000000003/cnh-nova.jpg',
        'e5000000-0000-4000-8000-000000000003');

reset role;
select pg_temp.como('e5000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select public.reenviar_item_homologacao('a5000000-0000-4000-8000-000000000004',
       'e5000000-0000-4000-8000-000000000003/cnh-nova.jpg', public.hoje_em_brasilia() - 1) $$,
  'GHM05', null, 'reenviar com a validade já passada é rejeitado'
);
select lives_ok(
  $$ select public.reenviar_item_homologacao('a5000000-0000-4000-8000-000000000004',
       'e5000000-0000-4000-8000-000000000003/cnh-nova.jpg', public.hoje_em_brasilia() + 700) $$,
  'o Guincheiro reenvia a CNH vencida com a validade nova'
);
select is_empty(
  $$ select * from public.itens_em_alerta_de_vencimento() $$,
  'o item reenviado sai do alerta'
);
reset role;
select results_eq(
  $$ select estado::text, validade = public.hoje_em_brasilia() + 700
     from public.itens_homologacao where id = 'a5000000-0000-4000-8000-000000000004' $$,
  $$ values ('pendente', true) $$,
  'o reenvio devolve o item a pendente, com a nova validade, para nova decisão'
);
select results_eq(
  $$ select de::text, para::text, por from public.auditoria_homologacao
     where item_id = 'a5000000-0000-4000-8000-000000000004' order by id desc limit 1 $$,
  $$ values ('vencido', 'pendente', 'e5000000-0000-4000-8000-000000000003'::uuid) $$,
  'a trilha mostra o reenvio, desta vez com autor'
);
select is(public.marcar_itens_vencidos(), 0::integer, 'o item pendente reenviado não é vencido de novo');

select * from finish();
rollback;
