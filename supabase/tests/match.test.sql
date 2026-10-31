-- Match (issue #11, RF07; ADR-0002, ADR-0008 e a nota de 2026-10-17, ADR-0009).
--
-- A Edge Function `ofertar-proximo` lê `dados_do_match`, decide com @guinchei/match e grava
-- pela `registrar_tentativa` (oferta com expiração ou `pulada_teto`) ou encerra a rodada
-- (`encerrar_rodada_sem_guincheiro`). O banco confere estado, rodada, a ordem lida e que não
-- há outra oferta aberta: duas execuções simultâneas não abrem duas ofertas. O Guincheiro
-- aceita ou recusa pela API (`aceitar_oferta`, `recusar_oferta`); o job do pg_cron chama
-- `varrer_match`, que expira as ofertas vencidas e devolve os Pedidos a avançar. Sem aceite,
-- o Cliente tenta de novo (`tentar_de_novo`) ou estorna (`estornar-pedido`, com
-- `pagamento_para_estornar` e `registrar_estorno`).
--
-- Usuários do seed: Cliente A (Rafael), G1 Marcos (Cruzeiro, ~4,2 km do Eixo Monumental),
-- G2 Wagner (Asa Norte, ~4,9 km), G3 Rita (Guará, ~9,6 km). Aqui se cria o Cliente B.
begin;
select plan(65);

insert into auth.users (id, aud, role, phone)
values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', '5561900000099');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
values ('44444444-4444-4444-8444-444444444444', 'cliente', 'Cliente B', '5561900000099',
        '11144477735', 'v1');

-- Um Pedido do Cliente A no Eixo Monumental, cotado e com pagamento autorizado.
create function pg_temp.pedido_autorizado(referencia text) returns uuid
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
    4.21, 1, 11000, 2105, 12810, 0, 0, 0, 25915, '2026-10-13T14:00:00-03:00');
  perform public.registrar_pagamento(id, '11111111-1111-4111-8111-111111111111',
    25915, 'autorizado', 'pix', 'mock', referencia);
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

select set_config('teste.pedido', pg_temp.pedido_autorizado('mock_match_1')::text, true);

-- ---------------------------------------------------------------------------
-- Autorizado o pagamento, a rodada 1 começa
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select estado::text, rodada_match, cotado_em = '2026-10-13T14:00:00-03:00'::timestamptz
     from public.pedidos where id = current_setting('teste.pedido')::uuid $$,
  $$ values ('em_match', 1, true) $$,
  'pagamento autorizado: o Pedido vai a em_match na rodada 1, com a hora da cotação gravada'
);

set local role service_role;
select set_config('teste.dados',
  public.dados_do_match(current_setting('teste.pedido')::uuid)::text, true);
reset role;

select results_eq(
  $$ select d ->> 'estado', (d ->> 'rodada')::int, (d ->> 'limite_tentativas')::int,
            (d ->> 'preco_total')::int, (d ->> 'km_rebocado')::numeric,
            (d -> 'tabela' ->> 'versao')::int, d ->> 'instante' is not null,
            jsonb_array_length(d -> 'tentativas')
     from (select current_setting('teste.dados')::jsonb as d) x $$,
  $$ values ('em_match', 1, 3, 25915, 21.35, 1, true, 0) $$,
  'dados_do_match: estado, rodada, teto, Preço fechado, km rebocado, tabela da cotação'
);
select results_eq(
  $$ select c ->> 'guincheiro_id', (c ->> 'km')::numeric between 4 and 10
     from jsonb_array_elements(current_setting('teste.dados')::jsonb -> 'candidatos')
       with ordinality as e(c, i)
     order by i $$,
  $$ values ('22222222-2222-4222-8222-222222222201', true),
            ('22222222-2222-4222-8222-222222222202', true),
            ('22222222-2222-4222-8222-222222222203', true) $$,
  'candidatos: os elegíveis, do mais perto ao mais longe'
);

set local role authenticated;
select throws_ok(
  $$ select public.dados_do_match(current_setting('teste.pedido')::uuid) $$,
  '42501', null, 'pela API ninguém lê dados_do_match'
);
select throws_ok(
  $$ select public.registrar_tentativa(current_setting('teste.pedido')::uuid, 1,
       '22222222-2222-4222-8222-222222222201', 1, 'oferecida', 4.21, 25915, 20732) $$,
  '42501', null, 'pela API ninguém registra oferta'
);
select throws_ok(
  $$ select public.varrer_match() $$,
  '42501', null, 'pela API ninguém roda a varredura'
);
reset role;

-- ---------------------------------------------------------------------------
-- registrar_tentativa: uma oferta aberta por vez, na ordem e na rodada lidas
-- ---------------------------------------------------------------------------
set local role service_role;

select throws_ok(
  $$ select public.registrar_tentativa(current_setting('teste.pedido')::uuid, 1,
       '22222222-2222-4222-8222-222222222201', 2, 'oferecida', 4.21, 25915, 20732) $$,
  'GMT03', null, 'ordem diferente da lida (outra execução gravou antes) é recusada'
);
select throws_ok(
  $$ select public.registrar_tentativa(current_setting('teste.pedido')::uuid, 2,
       '22222222-2222-4222-8222-222222222201', 1, 'oferecida', 4.21, 25915, 20732) $$,
  'GMT03', null, 'rodada diferente da atual é recusada'
);
select throws_ok(
  $$ select public.registrar_tentativa(current_setting('teste.pedido')::uuid, 1,
       '22222222-2222-4222-8222-222222222201', 1, 'aceita', 4.21, 25915, 20732) $$,
  '22023', null, 'só se registra oferecida ou pulada_teto'
);

-- Rita pulada pelo teto (cenário de teste: a absorção passaria da Comissão).
select set_config('teste.pulada', public.registrar_tentativa(
  current_setting('teste.pedido')::uuid, 1, '22222222-2222-4222-8222-222222222203', 1,
  'pulada_teto', 9.6, 28000, 22400)::text, true);
select set_config('teste.oferta_marcos', public.registrar_tentativa(
  current_setting('teste.pedido')::uuid, 1, '22222222-2222-4222-8222-222222222201', 2,
  'oferecida', 4.21, 25915, 20732)::text, true);

select results_eq(
  $$ select resultado::text, expira_em = now() + interval '30 seconds', km_ate_veiculo,
            preco_recalculado, repasse_oferecido
     from public.tentativas_match where id = current_setting('teste.oferta_marcos')::bigint $$,
  $$ values ('oferecida', true, 4.21::numeric, 25915, 20732) $$,
  'oferta registrada com o preço e o repasse do candidato e expiração em 30 s'
);
select results_eq(
  $$ select resultado::text, expira_em is null
     from public.tentativas_match where id = current_setting('teste.pulada')::bigint $$,
  $$ values ('pulada_teto', true) $$,
  'pulada_teto fica registrada, sem expiração'
);
select throws_ok(
  $$ select public.registrar_tentativa(current_setting('teste.pedido')::uuid, 1,
       '22222222-2222-4222-8222-222222222202', 3, 'oferecida', 4.87, 26245, 20996) $$,
  'GMT03', null, 'com uma oferta aberta, não se abre outra'
);
select throws_ok(
  $$ select public.encerrar_rodada_sem_guincheiro(current_setting('teste.pedido')::uuid, 1, 2) $$,
  'GMT03', null, 'com uma oferta aberta, a rodada não é encerrada'
);
reset role;

-- Mesmo por fora das funções, o banco não aceita duas ofertas abertas no mesmo Pedido.
select throws_ok(
  $$ insert into public.tentativas_match (pedido_id, guincheiro_id, rodada, ordem, resultado,
       km_ate_veiculo, preco_recalculado, repasse_oferecido, expira_em)
     values (current_setting('teste.pedido')::uuid, '22222222-2222-4222-8222-222222222202',
       1, 3, 'oferecida', 4.87, 26245, 20996, now() + interval '30 seconds') $$,
  '23505', null, 'no máximo uma oferta aberta por Pedido'
);

-- O Guincheiro lê a oferta feita a ele; o pulado não vê nada; o Cliente lê o estado.
select pg_temp.como('22222222-2222-4222-8222-222222222201');
select results_eq(
  $$ select id, repasse_oferecido from public.tentativas_match $$,
  $$ values (current_setting('teste.oferta_marcos')::bigint, 20732) $$,
  'Marcos lê a oferta feita a ele'
);
reset role;
select pg_temp.como('22222222-2222-4222-8222-222222222203');
select is_empty($$ select * from public.tentativas_match $$, 'Rita, pulada pelo teto, não vê a tentativa');
select is_empty($$ select * from public.pedidos $$, 'Rita não vê o Pedido');
reset role;
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select results_eq(
  $$ select estado::text from public.pedidos where id = current_setting('teste.pedido')::uuid $$,
  $$ values ('em_match') $$,
  'o Cliente lê o estado do próprio Pedido'
);
reset role;

-- ---------------------------------------------------------------------------
-- Recusar
-- ---------------------------------------------------------------------------
select pg_temp.como('22222222-2222-4222-8222-222222222202');
select throws_ok(
  $$ select public.recusar_oferta(current_setting('teste.oferta_marcos')::bigint) $$,
  'P0002', null, 'Wagner não recusa a oferta feita ao Marcos'
);
select throws_ok(
  $$ select public.aceitar_oferta(current_setting('teste.oferta_marcos')::bigint) $$,
  'P0002', null, 'Wagner não aceita a oferta feita ao Marcos'
);
reset role;

select pg_temp.como('22222222-2222-4222-8222-222222222201');
select lives_ok(
  $$ select public.recusar_oferta(current_setting('teste.oferta_marcos')::bigint) $$,
  'Marcos recusa a oferta'
);
select throws_ok(
  $$ select public.recusar_oferta(current_setting('teste.oferta_marcos')::bigint) $$,
  'GMT01', null, 'oferta já recusada não é recusada de novo'
);
select throws_ok(
  $$ select public.aceitar_oferta(current_setting('teste.oferta_marcos')::bigint) $$,
  'GMT01', null, 'oferta recusada não é aceita depois'
);
reset role;
select results_eq(
  $$ select resultado::text, respondida_em = now()
     from public.tentativas_match where id = current_setting('teste.oferta_marcos')::bigint $$,
  $$ values ('recusada', true) $$,
  'a recusa fica registrada com a hora da resposta'
);

-- ---------------------------------------------------------------------------
-- Expiração pela varredura
-- ---------------------------------------------------------------------------
set local role service_role;
select set_config('teste.oferta_wagner', public.registrar_tentativa(
  current_setting('teste.pedido')::uuid, 1, '22222222-2222-4222-8222-222222222202', 3,
  'oferecida', 4.87, 26245, 20996)::text, true);
reset role;

-- O prazo vence (no teste, a expiração é trazida para o passado).
update public.tentativas_match set expira_em = now() - interval '1 second'
where id = current_setting('teste.oferta_wagner')::bigint;

select pg_temp.como('22222222-2222-4222-8222-222222222202');
select throws_ok(
  $$ select public.aceitar_oferta(current_setting('teste.oferta_wagner')::bigint) $$,
  'GMT01', null, 'oferta vencida não é aceita, mesmo antes da varredura'
);
reset role;

select results_eq(
  $$ select public.varrer_match() $$,
  $$ values (current_setting('teste.pedido')::uuid) $$,
  'a varredura expira a oferta vencida e devolve o Pedido para a próxima oferta'
);
select results_eq(
  $$ select resultado::text, respondida_em = now()
     from public.tentativas_match where id = current_setting('teste.oferta_wagner')::bigint $$,
  $$ values ('expirada', true) $$,
  'a oferta vencida fica expirada'
);
select is_empty(
  $$ select public.varrer_match() $$,
  'uma segunda varredura não expira de novo nem devolve o Pedido outra vez'
);

-- ---------------------------------------------------------------------------
-- Aceitar
-- ---------------------------------------------------------------------------
-- Teto de 3 tentativas: recusa e expiração contam, pulada_teto não. Uma terceira oferta.
set local role service_role;
select is(
  jsonb_array_length(public.dados_do_match(current_setting('teste.pedido')::uuid) -> 'tentativas'),
  3,
  'dados_do_match devolve as três tentativas da rodada (uma pulada)'
);
-- Guincheiro de teste a mais, para a terceira oferta (Rita foi pulada nesta rodada).
reset role;
insert into auth.users (id, aud, role, phone)
values ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', '5561900000098');
insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
values ('55555555-5555-4555-8555-555555555555', 'guincheiro', 'Guincheiro Teste',
        '5561900000098', '39053344705', 'v1');
insert into public.guincheiros (id, frota_id, posicao, disponivel)
values ('55555555-5555-4555-8555-555555555555', 'f0000000-0000-4000-8000-000000000002',
        extensions.st_setsrid(extensions.st_makepoint(-47.95, -15.80), 4326), true);

-- Sem homologação (#50), o Guincheiro de teste, mesmo disponível e de Frota ativa, não é
-- candidato e não recebe oferta.
set local role service_role;
select is(
  (select count(*)
   from jsonb_array_elements(public.dados_do_match(current_setting('teste.pedido')::uuid) -> 'candidatos') c
   where c ->> 'guincheiro_id' = '55555555-5555-4555-8555-555555555555'),
  0::bigint,
  'Guincheiro sem homologação não aparece nos candidatos de dados_do_match'
);
select throws_ok(
  $$ select public.registrar_tentativa(current_setting('teste.pedido')::uuid, 1,
       '55555555-5555-4555-8555-555555555555', 4, 'oferecida', 6.3, 26965, 21572) $$,
  'GMT03', null, 'e a oferta a ele é recusada: o Guincheiro não está habilitado'
);
reset role;

-- Preparação: homologa o Guincheiro de teste (CNH B, certidão e selfie aprovadas) e o vincula
-- ao veículo de 3.000 kg da Rita, na mesma Frota (autônoma, ativa no seed).
insert into public.documentos_guincheiro
  (guincheiro_id, cnh_numero, cnh_categoria, cnh_validade, cnh_ear, antecedentes_emissao)
values ('55555555-5555-4555-8555-555555555555', '60493827150', 'B',
        public.hoje_em_brasilia() + 400, true, public.hoje_em_brasilia() - 10);
insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo, validade)
select 'f0000000-0000-4000-8000-000000000002', 'guincheiro', '55555555-5555-4555-8555-555555555555',
       t.tipo::public.tipo_item_homologacao, '55555555-5555-4555-8555-555555555555',
       '55555555-5555-4555-8555-555555555555/' || t.tipo || '.pdf', t.validade
from (values ('cnh', public.hoje_em_brasilia() + 400),
             ('antecedentes', public.hoje_em_brasilia() + 300),
             ('selfie', null::date)) t (tipo, validade);
update public.itens_homologacao set estado = 'aprovado'
where alvo = 'guincheiro' and alvo_id = '55555555-5555-4555-8555-555555555555';
insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
values ('f0000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000003',
        '55555555-5555-4555-8555-555555555555');

set local role service_role;
select is(
  (select count(*)
   from jsonb_array_elements(public.dados_do_match(current_setting('teste.pedido')::uuid) -> 'candidatos') c
   where c ->> 'guincheiro_id' = '55555555-5555-4555-8555-555555555555'),
  1::bigint,
  'homologado e vinculado a veículo homologado, o Guincheiro vira candidato'
);
select set_config('teste.oferta_g4', public.registrar_tentativa(
  current_setting('teste.pedido')::uuid, 1, '55555555-5555-4555-8555-555555555555', 4,
  'oferecida', 6.3, 26965, 21572)::text, true);
reset role;

-- Indisponível (desligou o plantão): não aceita.
update public.guincheiros set disponivel = false where id = '55555555-5555-4555-8555-555555555555';
select pg_temp.como('55555555-5555-4555-8555-555555555555');
select throws_ok(
  $$ select public.aceitar_oferta(current_setting('teste.oferta_g4')::bigint) $$,
  'GMT02', null, 'Guincheiro indisponível não aceita'
);
reset role;
update public.guincheiros set disponivel = true where id = '55555555-5555-4555-8555-555555555555';

select pg_temp.como('55555555-5555-4555-8555-555555555555');
select set_config('teste.corrida',
  public.aceitar_oferta(current_setting('teste.oferta_g4')::bigint)::text, true);
select throws_ok(
  $$ select public.aceitar_oferta(current_setting('teste.oferta_g4')::bigint) $$,
  'GMT01', null, 'a mesma oferta não é aceita duas vezes'
);
reset role;

select results_eq(
  $$ select c.estado::text, c.guincheiro_id, c.repasse, p.estado::text, t.resultado::text,
            g.disponivel
     from public.corridas c
     join public.pedidos p on p.id = c.pedido_id
     join public.tentativas_match t on t.id = current_setting('teste.oferta_g4')::bigint
     join public.guincheiros g on g.id = c.guincheiro_id
     where c.id = current_setting('teste.corrida')::uuid $$,
  $$ values ('aceita', '55555555-5555-4555-8555-555555555555'::uuid, 21572, 'atribuido',
             'aceita', false) $$,
  'aceite: Corrida aceita com o repasse oferecido, Pedido atribuido, Guincheiro indisponível'
);

set local role service_role;
select throws_ok(
  $$ select public.registrar_tentativa(current_setting('teste.pedido')::uuid, 1,
       '22222222-2222-4222-8222-222222222203', 5, 'oferecida', 9.6, 28000, 22400) $$,
  'GMT03', null, 'Pedido atribuído não recebe mais ofertas'
);
select is(
  public.dados_do_match(current_setting('teste.pedido')::uuid) ->> 'estado',
  'atribuido',
  'dados_do_match de um Pedido atribuído só informa o estado'
);
reset role;

-- O Cliente lê a Corrida; o Guincheiro também.
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select results_eq(
  $$ select id from public.corridas where pedido_id = current_setting('teste.pedido')::uuid $$,
  $$ values (current_setting('teste.corrida')::uuid) $$,
  'o Cliente lê a Corrida do próprio Pedido'
);
reset role;

-- ---------------------------------------------------------------------------
-- Esgotamento → sem_guincheiro → tentar de novo
-- ---------------------------------------------------------------------------
select set_config('teste.pedido2', pg_temp.pedido_autorizado('mock_match_2')::text, true);

set local role service_role;
select public.registrar_tentativa(current_setting('teste.pedido2')::uuid, 1,
  '22222222-2222-4222-8222-222222222201', 1, 'oferecida', 4.21, 25915, 20732);
reset role;
update public.tentativas_match set expira_em = now() - interval '1 second'
where pedido_id = current_setting('teste.pedido2')::uuid;
select public.varrer_match();

set local role service_role;
select throws_ok(
  $$ select public.encerrar_rodada_sem_guincheiro(current_setting('teste.pedido2')::uuid, 1, 0) $$,
  'GMT03', null, 'encerrar com tentativas diferentes das lidas é recusado'
);
select lives_ok(
  $$ select public.encerrar_rodada_sem_guincheiro(current_setting('teste.pedido2')::uuid, 1, 1) $$,
  'rodada esgotada: encerra'
);
reset role;
select is(
  (select estado::text from public.pedidos where id = current_setting('teste.pedido2')::uuid),
  'sem_guincheiro',
  'sem aceite, o Pedido vai a sem_guincheiro'
);
select is(
  (select estado::text from public.pagamentos where pedido_id = current_setting('teste.pedido2')::uuid),
  'autorizado',
  'em sem_guincheiro, o pagamento continua autorizado'
);
set local role service_role;
select throws_ok(
  $$ select public.registrar_tentativa(current_setting('teste.pedido2')::uuid, 1,
       '22222222-2222-4222-8222-222222222202', 2, 'oferecida', 4.87, 26245, 20996) $$,
  'GMT03', null, 'Pedido em sem_guincheiro não recebe oferta'
);
reset role;

select pg_temp.como('44444444-4444-4444-8444-444444444444');
select throws_ok(
  $$ select public.tentar_de_novo(current_setting('teste.pedido2')::uuid) $$,
  'P0002', null, 'o Cliente B não tenta de novo o Pedido do Cliente A'
);
reset role;
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select public.tentar_de_novo(current_setting('teste.pedido')::uuid) $$,
  'P0002', null, 'Pedido atribuído não volta ao Match'
);
select is(
  public.tentar_de_novo(current_setting('teste.pedido2')::uuid),
  2,
  'tentar de novo abre a rodada 2'
);
select throws_ok(
  $$ select public.tentar_de_novo(current_setting('teste.pedido2')::uuid) $$,
  'P0002', null, 'em em_match, tentar de novo não abre outra rodada'
);
reset role;

select results_eq(
  $$ select p.estado::text, p.rodada_match, p.preco_total, pg.estado::text, pg.referencia_externa
     from public.pedidos p join public.pagamentos pg on pg.pedido_id = p.id
     where p.id = current_setting('teste.pedido2')::uuid $$,
  $$ values ('em_match', 2, 25915, 'autorizado', 'mock_match_2') $$,
  'nova rodada com o mesmo Preço fechado e a mesma autorização'
);

set local role service_role;
select is(
  jsonb_array_length(public.dados_do_match(current_setting('teste.pedido2')::uuid) -> 'tentativas'),
  0,
  'a rodada 2 começa sem tentativas'
);
select throws_ok(
  $$ select public.registrar_tentativa(current_setting('teste.pedido2')::uuid, 1,
       '22222222-2222-4222-8222-222222222202', 2, 'oferecida', 4.87, 26245, 20996) $$,
  'GMT03', null, 'a rodada 1 encerrada não recebe mais ofertas'
);
select lives_ok(
  $$ select public.registrar_tentativa(current_setting('teste.pedido2')::uuid, 2,
       '22222222-2222-4222-8222-222222222201', 1, 'oferecida', 4.21, 25915, 20732) $$,
  'na rodada 2, Marcos recebe o Pedido de novo'
);
reset role;

-- Um Guincheiro só na mesma rodada, mesmo por fora das funções.
select throws_ok(
  $$ insert into public.tentativas_match (pedido_id, guincheiro_id, rodada, ordem, resultado,
       km_ate_veiculo, preco_recalculado, repasse_oferecido)
     values (current_setting('teste.pedido2')::uuid, '22222222-2222-4222-8222-222222222201',
       2, 2, 'recusada', 4.21, 25915, 20732) $$,
  '23505', null, 'cada Guincheiro recebe o Pedido no máximo uma vez por rodada'
);

-- ---------------------------------------------------------------------------
-- Rede de segurança da varredura: Pedido em em_match sem oferta aberta e parado
-- ---------------------------------------------------------------------------
select set_config('teste.pedido3', pg_temp.pedido_autorizado('mock_match_3')::text, true);
insert into public.tentativas_match (pedido_id, guincheiro_id, rodada, ordem, resultado,
  km_ate_veiculo, preco_recalculado, repasse_oferecido, criado_em, respondida_em)
values (current_setting('teste.pedido3')::uuid, '22222222-2222-4222-8222-222222222201',
  1, 1, 'recusada', 4.21, 25915, 20732, now() - interval '1 minute', now() - interval '1 minute');
select ok(
  current_setting('teste.pedido3')::uuid in (select public.varrer_match()),
  'Pedido em em_match parado sem oferta aberta volta para a próxima oferta'
);
select ok(
  current_setting('teste.pedido2')::uuid not in (select public.varrer_match()),
  'Pedido com oferta aberta no prazo não é devolvido'
);

-- ---------------------------------------------------------------------------
-- Estornar
-- ---------------------------------------------------------------------------
set local role service_role;
select throws_ok(
  $$ select public.pagamento_para_estornar(current_setting('teste.pedido3')::uuid,
       '11111111-1111-4111-8111-111111111111') $$,
  'P0002', null, 'em em_match, não se estorna'
);
select public.encerrar_rodada_sem_guincheiro(current_setting('teste.pedido3')::uuid, 1, 1);
select throws_ok(
  $$ select public.pagamento_para_estornar(current_setting('teste.pedido3')::uuid,
       '44444444-4444-4444-8444-444444444444') $$,
  'P0002', null, 'o Cliente B não estorna o Pedido do Cliente A'
);
select results_eq(
  $$ select p ->> 'referencia_externa', (p ->> 'valor')::int
     from (select public.pagamento_para_estornar(current_setting('teste.pedido3')::uuid,
             '11111111-1111-4111-8111-111111111111') as p) x $$,
  $$ values ('mock_match_3', 25915) $$,
  'pagamento_para_estornar devolve a autorização do Pedido em sem_guincheiro'
);
select throws_ok(
  $$ select public.registrar_estorno(current_setting('teste.pedido3')::uuid,
       '11111111-1111-4111-8111-111111111111', 'mock_outro') $$,
  'GPG03', null, 'estorno de outra referência é recusado'
);
select lives_ok(
  $$ select public.registrar_estorno(current_setting('teste.pedido3')::uuid,
       '11111111-1111-4111-8111-111111111111', 'mock_match_3') $$,
  'registra o estorno'
);
reset role;
select results_eq(
  $$ select p.estado::text, pg.estado::text
     from public.pedidos p join public.pagamentos pg on pg.pedido_id = p.id
     where p.id = current_setting('teste.pedido3')::uuid $$,
  $$ values ('estornado', 'estornado') $$,
  'estornar: Pedido estornado e pagamento estornado'
);
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select public.tentar_de_novo(current_setting('teste.pedido3')::uuid) $$,
  'P0002', null, 'Pedido estornado não volta ao Match'
);
select throws_ok(
  $$ select public.pagamento_para_estornar(current_setting('teste.pedido3')::uuid,
       '11111111-1111-4111-8111-111111111111') $$,
  '42501', null, 'o Cliente não chama pagamento_para_estornar pela API'
);
reset role;

-- ---------------------------------------------------------------------------
-- Parâmetros e o job
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select timeout_oferta_segundos, limite_tentativas from public.parametros_match $$,
  $$ values (30, 3) $$,
  'parâmetros padrão: 30 s por oferta e 3 tentativas por rodada'
);
select pg_temp.como('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select * from public.parametros_match $$,
  '42501', null, 'pela API ninguém lê os parâmetros do Match'
);
reset role;
select results_eq(
  $$ select schedule, command from cron.job where jobname = 'match-varrer' $$,
  $$ values ('5 seconds', 'select public.varrer_match()') $$,
  'o pg_cron roda a varredura a cada 5 s'
);

select * from finish();
rollback;
