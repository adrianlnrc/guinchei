-- Ativação da Frota por homologação (issue #50, ADR-0012, invariante 3 / RN03).
--
-- A Frota só é ativada (`ativar_frota`, a ação do Painel) quando alvará e apólice, um veículo
-- (CRLV e fotos) e um Guincheiro (CNH, certidão e selfie) vinculado a esse veículo com a CNH
-- cobrindo o PBT estão aprovados e vigentes; e volta a inativa sozinha quando uma dessas
-- exigências deixa de valer. Cada exigência faltante é testada isoladamente.
--
-- Cenário próprio (nada do seed, que tem CPFs, CNHs, placas e RENAVAMs próprios): a Frota
-- "Pátio Central" (empresa) da representante Renata, com os Guincheiros Gustavo e Giovana; e uma
-- Frota vazia de Otto. A operação e o Cliente são os do seed, só como quem chama. As validades
-- são relativas a `hoje_em_brasilia()`.
begin;
select plan(75);

create function pg_temp.como(usuario text) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
end;
$$;

-- Aprova um item novo (nasce pendente, a operação aprova).
create function pg_temp.aprovar(
  frota uuid, a public.alvo_homologacao, alvo uuid, t public.tipo_item_homologacao,
  dono uuid, validade date default null
) returns void
language plpgsql as $$
begin
  insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo, validade)
  values (frota, a, alvo, t, dono, dono::text || '/' || t || '-' || left(alvo::text, 8) || '.pdf', validade);
  update public.itens_homologacao i set estado = 'aprovado'
  where i.alvo = a and i.alvo_id = aprovar.alvo and i.tipo = t;
end;
$$;

-- O item vencido ou recusado volta a valer (reenvio e nova aprovação), com a validade dada.
create function pg_temp.reaprovar(
  a public.alvo_homologacao, alvo uuid, t public.tipo_item_homologacao, validade date default null
) returns void
language plpgsql as $$
begin
  update public.itens_homologacao i set estado = 'pendente'
  where i.alvo = a and i.alvo_id = reaprovar.alvo and i.tipo = t and i.estado in ('vencido', 'recusado');
  update public.itens_homologacao i
  set estado = 'aprovado', validade = coalesce(reaprovar.validade, i.validade)
  where i.alvo = a and i.alvo_id = reaprovar.alvo and i.tipo = t;
end;
$$;

-- A ação "Ativar" do Painel, pela operação do seed.
create function pg_temp.ativar(frota uuid) returns void
language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}', true);
  perform public.ativar_frota(frota);
  reset role;
end;
$$;

create function pg_temp.pendencias(frota uuid) returns text[]
language sql as $$
  select coalesce(array_agg(p.descricao order by p.ordem, p.tipo, p.descricao), '{}')
  from public.frota_pendencias(frota) p;
$$;

insert into auth.users (id, aud, role, phone) values
  ('e6000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '5561900000701'),
  ('e6000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '5561900000702'),
  ('e6000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '5561900000703'),
  ('e6000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', '5561900000704');

insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao) values
  ('e6000000-0000-4000-8000-000000000001', 'representante', 'Renata Pátio', '5561900000701', '20735841950', now(), 'teste'),
  ('e6000000-0000-4000-8000-000000000002', 'guincheiro', 'Gustavo Pátio', '5561900000702', '31840692731', now(), 'teste'),
  ('e6000000-0000-4000-8000-000000000003', 'guincheiro', 'Giovana Pátio', '5561900000703', '42951706316', now(), 'teste'),
  ('e6000000-0000-4000-8000-000000000004', 'representante', 'Otto Vazio', '5561900000704', '53662817411', now(), 'teste');

insert into public.frotas (id, tipo, documento, nome, representante_id, base_cep, base_endereco,
                           base_bairro, chave_pix, termos_prestador_versao)
values
  ('f6000000-0000-4000-8000-00000000000a', 'empresa', '38472915000172', 'Pátio Central',
   'e6000000-0000-4000-8000-000000000001', '70000000', 'SQS 20', 'Asa Sul', 'p@exemplo.com', 'teste'),
  ('f6000000-0000-4000-8000-00000000000b', 'empresa', '59183642000116', 'Frota Vazia',
   'e6000000-0000-4000-8000-000000000004', '70000000', 'SQN 21', 'Asa Norte', 'v@exemplo.com', 'teste');

insert into public.guincheiros (id, frota_id, posicao, disponivel) values
  ('e6000000-0000-4000-8000-000000000002', 'f6000000-0000-4000-8000-00000000000a',
   extensions.st_setsrid(extensions.st_makepoint(-47.88, -15.79), 4326), false),
  ('e6000000-0000-4000-8000-000000000003', 'f6000000-0000-4000-8000-00000000000a',
   extensions.st_setsrid(extensions.st_makepoint(-47.88, -15.79), 4326), false);

insert into public.documentos_guincheiro
  (guincheiro_id, cnh_numero, cnh_categoria, cnh_validade, cnh_ear, antecedentes_emissao)
values
  ('e6000000-0000-4000-8000-000000000002', '48170692350', 'C',
   public.hoje_em_brasilia() + 400, true, public.hoje_em_brasilia() - 30),
  ('e6000000-0000-4000-8000-000000000003', '59281703461', 'C',
   public.hoje_em_brasilia() + 400, true, public.hoje_em_brasilia() - 30);

-- Veículo 1: 4.000 kg (exige CNH C). Ainda sem nenhum item.
insert into public.veiculos (id, frota_id, placa, renavam, tipo, pbt_kg) values
  ('b6000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-00000000000a',
   'QZA1B23', '82640591374', 'plataforma', 4000);

-- Arquivos para os reenvios (a CNH do Gustavo e a apólice da Renata).
insert into storage.objects (bucket_id, name, owner) values
  ('documentos-prestadores', 'e6000000-0000-4000-8000-000000000002/cnh-nova-1.jpg', 'e6000000-0000-4000-8000-000000000002'),
  ('documentos-prestadores', 'e6000000-0000-4000-8000-000000000002/cnh-nova-2.jpg', 'e6000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Nada enviado: a lista do que falta é a lista real
-- ---------------------------------------------------------------------------
select is(
  pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'),
  array[
    'Alvará: não enviado',
    'Apólice de RC por avaria: não enviado',
    'CRLV (QZA-1B23): não enviado',
    'Foto do veículo (QZA-1B23): não enviado',
    'CNH de Gustavo Pátio: não enviado',
    'Certidão de antecedentes de Gustavo Pátio: não enviado',
    'Selfie de Gustavo Pátio: não enviado',
    'Nenhum Guincheiro homologado vinculado a um veículo homologado'
  ],
  'sem nada enviado faltam oito itens, na ordem Frota, veículo, Guincheiro, vínculo'
);
select is(public.frota_pronta('f6000000-0000-4000-8000-00000000000a'), false, 'a Frota não está pronta');
select is(
  pg_temp.pendencias('f6000000-0000-4000-8000-00000000000b'),
  array[
    'Alvará: não enviado',
    'Apólice de RC por avaria: não enviado',
    'Nenhum veículo cadastrado',
    'Nenhum Guincheiro na Frota',
    'Nenhum Guincheiro homologado vinculado a um veículo homologado'
  ],
  'a Frota vazia: sem veículo, sem Guincheiro e sem vínculo'
);

-- ---------------------------------------------------------------------------
-- Os itens vão sendo aprovados: a lista encolhe
-- ---------------------------------------------------------------------------
select pg_temp.aprovar('f6000000-0000-4000-8000-00000000000a', 'frota', 'f6000000-0000-4000-8000-00000000000a',
  'alvara', 'e6000000-0000-4000-8000-000000000001');
select pg_temp.aprovar('f6000000-0000-4000-8000-00000000000a', 'frota', 'f6000000-0000-4000-8000-00000000000a',
  'apolice_rc', 'e6000000-0000-4000-8000-000000000001', public.hoje_em_brasilia() + 400);
select is(
  cardinality(pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a')), 6,
  'alvará e apólice aprovados: faltam seis itens'
);

select pg_temp.aprovar('f6000000-0000-4000-8000-00000000000a', 'veiculo', 'b6000000-0000-4000-8000-000000000001',
  'crlv', 'e6000000-0000-4000-8000-000000000001');
select is(
  pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'),
  array[
    'Foto do veículo (QZA-1B23): não enviado',
    'CNH de Gustavo Pátio: não enviado',
    'Certidão de antecedentes de Gustavo Pátio: não enviado',
    'Selfie de Gustavo Pátio: não enviado',
    'Nenhum Guincheiro homologado vinculado a um veículo homologado'
  ],
  'só o CRLV não basta: o veículo precisa das fotos também'
);
select pg_temp.aprovar('f6000000-0000-4000-8000-00000000000a', 'veiculo', 'b6000000-0000-4000-8000-000000000001',
  'foto_veiculo', 'e6000000-0000-4000-8000-000000000001');
select is(
  cardinality(pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a')), 4,
  'veículo aprovado: faltam o Guincheiro (três itens) e o vínculo'
);

select pg_temp.aprovar('f6000000-0000-4000-8000-00000000000a', 'guincheiro', 'e6000000-0000-4000-8000-000000000002',
  'cnh', 'e6000000-0000-4000-8000-000000000002', public.hoje_em_brasilia() + 400);
select pg_temp.aprovar('f6000000-0000-4000-8000-00000000000a', 'guincheiro', 'e6000000-0000-4000-8000-000000000002',
  'antecedentes', 'e6000000-0000-4000-8000-000000000002', public.hoje_em_brasilia() + 300);
select is(
  pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'),
  array[
    'Selfie de Gustavo Pátio: não enviado',
    'Nenhum Guincheiro homologado vinculado a um veículo homologado'
  ],
  'o Guincheiro ainda sem selfie'
);
select pg_temp.aprovar('f6000000-0000-4000-8000-00000000000a', 'guincheiro', 'e6000000-0000-4000-8000-000000000002',
  'selfie', 'e6000000-0000-4000-8000-000000000002');

-- Tudo aprovado, só falta o Guincheiro estar vinculado ao veículo.
select is(
  pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'),
  array['Nenhum Guincheiro homologado vinculado a um veículo homologado'],
  'falta só o vínculo do Guincheiro homologado ao veículo homologado'
);
select is(public.guincheiro_habilitado('e6000000-0000-4000-8000-000000000002'), false,
  'sem vínculo o Guincheiro não está habilitado');

-- O que o Guincheiro vê no app: o veículo e a Frota.
select pg_temp.como('e6000000-0000-4000-8000-000000000002');
select is(
  (select array_agg(codigo order by codigo) from public.minha_elegibilidade()),
  array['frota_inativa', 'sem_veiculo'],
  'o Guincheiro vê por que o plantão está bloqueado: sem veículo e Frota ainda inativa'
);
reset role;

-- ---------------------------------------------------------------------------
-- Vínculo feito: a regra vale, mas a Frota não se ativa sozinha
-- ---------------------------------------------------------------------------
insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
values ('f6000000-0000-4000-8000-00000000000a', 'b6000000-0000-4000-8000-000000000001',
        'e6000000-0000-4000-8000-000000000002');
select is(
  (select situacao::text from public.vinculos_veiculo
   where guincheiro_id = 'e6000000-0000-4000-8000-000000000002'),
  'ativo', 'a CNH C aprovada cobre os 4.000 kg: vínculo ativo'
);
select is(pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'), '{}'::text[], 'não falta nada');
select is(public.frota_pronta('f6000000-0000-4000-8000-00000000000a'), true, 'a Frota está pronta');
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'mas a homologação sozinha não ativa: a operação ativa'
);
select is(public.guincheiro_habilitado('e6000000-0000-4000-8000-000000000002'), true,
  'o Guincheiro está habilitado');
select is(public.guincheiro_elegivel('e6000000-0000-4000-8000-000000000002'), false,
  'mas ainda não é elegível: Frota inativa e plantão desligado');
select is(
  public.guincheiro_habilitado('e6000000-0000-4000-8000-000000000003'), false,
  'a Giovana, sem nenhum documento, não está habilitada'
);

-- ---------------------------------------------------------------------------
-- Quem pode ler a lista e quem pode ativar
-- ---------------------------------------------------------------------------
select pg_temp.como('e6000000-0000-4000-8000-000000000001');
select is(
  (select count(*) from public.pendencias_de_ativacao('f6000000-0000-4000-8000-00000000000a')), 0::bigint,
  'a representante lê a lista da própria Frota (vazia)'
);
select throws_ok(
  $$ select * from public.pendencias_de_ativacao('f6000000-0000-4000-8000-00000000000b') $$,
  '42501', null, 'mas não a da Frota de outra pessoa'
);
select throws_ok(
  $$ select public.ativar_frota('f6000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'a representante não ativa a própria Frota'
);
select throws_ok(
  $$ update public.frotas set ativa = true where id = 'f6000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'nem por UPDATE direto pela API'
);
select throws_ok(
  $$ select * from public.frotas_prontas_para_ativar() $$,
  '42501', null, 'a fila de ativação é da operação'
);
reset role;

select pg_temp.como('e6000000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.ativar_frota('f6000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'o Guincheiro não ativa a Frota'
);
select throws_ok(
  $$ select * from public.pendencias_de_ativacao('f6000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'nem lê a lista de pendências'
);
reset role;

select pg_temp.como('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$ select public.ativar_frota('f6000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'o Cliente não ativa a Frota'
);
reset role;

select pg_temp.como('33333333-3333-4333-8333-333333333333');
select results_eq(
  $$ select id from public.frotas_prontas_para_ativar() where id::text like 'f6000000-%' $$,
  $$ values ('f6000000-0000-4000-8000-00000000000a'::uuid) $$,
  'a operação vê a Frota pronta na fila de ativação (a Frota vazia não aparece)'
);
select throws_ok(
  $$ select public.ativar_frota('f6000000-0000-4000-8000-00000000000b') $$,
  'GAT01', 'Faltam 5 itens para ativar a Frota',
  'a operação não ativa a Frota incompleta: o erro conta quantos itens faltam'
);
select is(
  (select count(*) from public.pendencias_de_ativacao('f6000000-0000-4000-8000-00000000000b')), 5::bigint,
  'e a operação lê a mesma lista de cinco itens'
);
select throws_ok(
  $$ select public.ativar_frota('f6000000-0000-4000-8000-0000000000ff') $$,
  'P0002', null, 'Frota inexistente'
);
select lives_ok(
  $$ select public.ativar_frota('f6000000-0000-4000-8000-00000000000a') $$,
  'a operação ativa a Frota que cumpre a regra'
);
reset role;
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), true,
  'a Frota ficou ativa'
);
select pg_temp.como('33333333-3333-4333-8333-333333333333');
select lives_ok(
  $$ select public.ativar_frota('f6000000-0000-4000-8000-00000000000a') $$,
  'ativar de novo uma Frota ativa não muda nada'
);
select is_empty(
  $$ select id from public.frotas_prontas_para_ativar() where id::text like 'f6000000-%' $$,
  'a Frota ativa sai da fila de ativação'
);
reset role;

-- Giovana (sem documentos) e um segundo veículo pendente não derrubam a Frota: a regra pede
-- "ao menos um" de cada.
insert into public.veiculos (id, frota_id, placa, renavam, tipo, pbt_kg) values
  ('b6000000-0000-4000-8000-000000000002', 'f6000000-0000-4000-8000-00000000000a',
   'QZB2C34', '94153602781', 'lanca', 3000);
insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo)
values ('f6000000-0000-4000-8000-00000000000a', 'veiculo', 'b6000000-0000-4000-8000-000000000002',
        'crlv', 'e6000000-0000-4000-8000-000000000001', 'e6000000-0000-4000-8000-000000000001/crlv-2.pdf');
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), true,
  'um segundo veículo pendente e uma Guincheira sem documentos não desativam a Frota'
);

-- Plantão ligado (os dois): só o Gustavo, que está homologado, entra no Match.
update public.guincheiros set disponivel = true
where id in ('e6000000-0000-4000-8000-000000000002', 'e6000000-0000-4000-8000-000000000003');
select is(public.guincheiro_elegivel('e6000000-0000-4000-8000-000000000002'), true,
  'ativa, habilitado e disponível: elegível');
select pg_temp.como('e6000000-0000-4000-8000-000000000002');
select is_empty('select * from public.minha_elegibilidade()', 'e o app dele não mostra nenhum bloqueio');
reset role;
set local role service_role;
select is(
  (select count(*) from public.guincheiros_elegiveis_proximos(-15.79, -47.88, 100)
   where guincheiro_id = 'e6000000-0000-4000-8000-000000000002'),
  1::bigint, 'a lista do Match inclui o Gustavo'
);
select is(
  (select count(*) from public.guincheiros_elegiveis_proximos(-15.79, -47.88, 100)
   where guincheiro_id = 'e6000000-0000-4000-8000-000000000003'),
  0::bigint, 'e não inclui a Giovana, sem homologação'
);
reset role;

-- ---------------------------------------------------------------------------
-- Cada exigência faltante, isoladamente: a Frota volta a inativa e a lista diz o que falta
-- ---------------------------------------------------------------------------

-- Alvará vencido.
update public.itens_homologacao set estado = 'vencido'
where alvo = 'frota' and alvo_id = 'f6000000-0000-4000-8000-00000000000a' and tipo = 'alvara';
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'alvará vencido: a Frota volta a inativa'
);
select is(
  pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'), array['Alvará: vencido'],
  'e é só o alvará que falta'
);
select is(public.guincheiro_elegivel('e6000000-0000-4000-8000-000000000002'), false,
  'o Guincheiro sai do Match com a Frota inativa');
select pg_temp.reaprovar('frota', 'f6000000-0000-4000-8000-00000000000a', 'alvara');
select pg_temp.ativar('f6000000-0000-4000-8000-00000000000a');

-- Apólice com a validade de ontem: o item segue "aprovado" (o job ainda não rodou), mas não vale.
update public.itens_homologacao set validade = public.hoje_em_brasilia() - 1
where alvo = 'frota' and alvo_id = 'f6000000-0000-4000-8000-00000000000a' and tipo = 'apolice_rc';
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'apólice com a validade passada: a Frota volta a inativa, sem esperar o job'
);
select is(
  (select estado::text from public.itens_homologacao
   where alvo = 'frota' and tipo = 'apolice_rc' and alvo_id = 'f6000000-0000-4000-8000-00000000000a'),
  'aprovado', 'o item ainda consta aprovado'
);
select ok(
  pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a')
    = array[format('Apólice de RC por avaria: vencido em %s',
                   to_char(public.hoje_em_brasilia() - 1, 'DD/MM/YYYY'))],
  'e a lista diz que a apólice venceu, com a data'
);
select throws_ok(
  $$ select pg_temp.ativar('f6000000-0000-4000-8000-00000000000a') $$,
  'GAT01', 'Faltam 1 item para ativar a Frota', 'a operação não ativa com a apólice vencida'
);
select pg_temp.reaprovar('frota', 'f6000000-0000-4000-8000-00000000000a', 'apolice_rc',
                         public.hoje_em_brasilia() + 400);
select pg_temp.ativar('f6000000-0000-4000-8000-00000000000a');

-- Foto do veículo vencida.
update public.itens_homologacao set estado = 'vencido'
where alvo = 'veiculo' and alvo_id = 'b6000000-0000-4000-8000-000000000001' and tipo = 'foto_veiculo';
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'item do único veículo homologado vencido: a Frota volta a inativa'
);
select is(
  pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'),
  array['Foto do veículo (QZA-1B23): vencido'],
  'e a lista pede só a foto'
);
select pg_temp.reaprovar('veiculo', 'b6000000-0000-4000-8000-000000000001', 'foto_veiculo');
select pg_temp.ativar('f6000000-0000-4000-8000-00000000000a');

-- Selfie do Guincheiro vencida.
update public.itens_homologacao set estado = 'vencido'
where alvo = 'guincheiro' and alvo_id = 'e6000000-0000-4000-8000-000000000002' and tipo = 'selfie';
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'item do único Guincheiro homologado vencido: a Frota volta a inativa'
);
select is(
  (pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'))[1], 'Selfie de Gustavo Pátio: vencido',
  'e a lista nomeia a selfie do Gustavo'
);
select pg_temp.reaprovar('guincheiro', 'e6000000-0000-4000-8000-000000000002', 'selfie');
select pg_temp.ativar('f6000000-0000-4000-8000-00000000000a');

-- Certidão de antecedentes com a validade de ontem.
update public.itens_homologacao set validade = public.hoje_em_brasilia() - 1
where alvo = 'guincheiro' and alvo_id = 'e6000000-0000-4000-8000-000000000002' and tipo = 'antecedentes';
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'certidão com a validade passada: a Frota volta a inativa'
);
select pg_temp.reaprovar('guincheiro', 'e6000000-0000-4000-8000-000000000002', 'antecedentes',
                         public.hoje_em_brasilia() + 300);
select pg_temp.ativar('f6000000-0000-4000-8000-00000000000a');

-- Vínculo desfeito.
delete from public.vinculos_veiculo where guincheiro_id = 'e6000000-0000-4000-8000-000000000002';
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'vínculo desfeito: a Frota volta a inativa'
);
select is(
  pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'),
  array['Nenhum Guincheiro homologado vinculado a um veículo homologado'],
  'e falta só o vínculo'
);
insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
values ('f6000000-0000-4000-8000-00000000000a', 'b6000000-0000-4000-8000-000000000001',
        'e6000000-0000-4000-8000-000000000002');
select pg_temp.ativar('f6000000-0000-4000-8000-00000000000a');

-- CNH × PBT: a categoria passa a B, que não cobre 4.000 kg; a revalidação derruba o vínculo.
update public.documentos_guincheiro set cnh_categoria = 'B'
where guincheiro_id = 'e6000000-0000-4000-8000-000000000002';
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'CNH que não cobre o PBT: o vínculo cai e a Frota volta a inativa'
);
select is(
  pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'),
  array['Nenhum Guincheiro homologado vinculado a um veículo homologado'],
  'a lista pede o vínculo de novo'
);
update public.documentos_guincheiro set cnh_categoria = 'C'
where guincheiro_id = 'e6000000-0000-4000-8000-000000000002';
insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
values ('f6000000-0000-4000-8000-00000000000a', 'b6000000-0000-4000-8000-000000000001',
        'e6000000-0000-4000-8000-000000000002');
select pg_temp.ativar('f6000000-0000-4000-8000-00000000000a');

-- ---------------------------------------------------------------------------
-- CNH com a validade de ontem, o job de vencimento, o reenvio e a recusa
-- ---------------------------------------------------------------------------
update public.itens_homologacao set validade = public.hoje_em_brasilia() - 1
where alvo = 'guincheiro' and alvo_id = 'e6000000-0000-4000-8000-000000000002' and tipo = 'cnh';
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'CNH com a validade passada: a Frota volta a inativa antes do job'
);
select is(
  public.avaliar_vinculo('e6000000-0000-4000-8000-000000000002', 'b6000000-0000-4000-8000-000000000001'),
  'pendente', 'avaliar_vinculo olha a vigência: CNH aprovada de validade passada não ativa o vínculo'
);
select is(public.guincheiro_habilitado('e6000000-0000-4000-8000-000000000002'), false,
  'e o Guincheiro não está habilitado');
select is(public.marcar_itens_vencidos() >= 1, true, 'o job marca a CNH como vencida');
select is(
  (pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'))[1], 'CNH de Gustavo Pátio: vencido',
  'depois do job a lista diz "vencido" sem data'
);

-- O Gustavo reenvia; a operação recusa; a Frota segue inativa.
select pg_temp.como('e6000000-0000-4000-8000-000000000002');
select lives_ok(
  $$ select public.reenviar_item_homologacao(
       (select id from public.itens_homologacao
        where alvo = 'guincheiro' and alvo_id = 'e6000000-0000-4000-8000-000000000002' and tipo = 'cnh'),
       'e6000000-0000-4000-8000-000000000002/cnh-nova-1.jpg',
       public.hoje_em_brasilia() + 500) $$,
  'o Gustavo reenvia a CNH'
);
select is(
  (select array_agg(distinct codigo order by codigo) from public.minha_elegibilidade()),
  array['documento', 'frota_inativa'], 'o app dele diz que falta documento (CNH em análise) e que a Frota está inativa'
);
reset role;
select pg_temp.como('33333333-3333-4333-8333-333333333333');
select lives_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao
        where alvo = 'guincheiro' and alvo_id = 'e6000000-0000-4000-8000-000000000002' and tipo = 'cnh'),
       'recusado', 'Foto desfocada') $$,
  'a operação recusa a CNH reenviada'
);
reset role;
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'CNH recusada: a Frota segue inativa'
);
select is(
  (pg_temp.pendencias('f6000000-0000-4000-8000-00000000000a'))[1], 'CNH de Gustavo Pátio: recusado',
  'e a lista diz "recusado"'
);

-- Reenvio novo, aprovação, e a operação ativa de novo.
select pg_temp.como('e6000000-0000-4000-8000-000000000002');
select lives_ok(
  $$ select public.reenviar_item_homologacao(
       (select id from public.itens_homologacao
        where alvo = 'guincheiro' and alvo_id = 'e6000000-0000-4000-8000-000000000002' and tipo = 'cnh'),
       'e6000000-0000-4000-8000-000000000002/cnh-nova-2.jpg',
       public.hoje_em_brasilia() + 500) $$,
  'o Gustavo reenvia de novo'
);
reset role;
select pg_temp.como('33333333-3333-4333-8333-333333333333');
select lives_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao
        where alvo = 'guincheiro' and alvo_id = 'e6000000-0000-4000-8000-000000000002' and tipo = 'cnh'),
       'aprovado') $$,
  'a operação aprova a CNH'
);
reset role;
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), false,
  'aprovar não reativa sozinho: a operação precisa ativar'
);
select is(public.frota_pronta('f6000000-0000-4000-8000-00000000000a'), true, 'a Frota está pronta de novo');
select pg_temp.ativar('f6000000-0000-4000-8000-00000000000a');
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000a'), true,
  'ativada de novo pela operação'
);
select is(public.guincheiro_elegivel('e6000000-0000-4000-8000-000000000002'), true,
  'o Gustavo volta a ser elegível (plantão continuava ligado)');

-- ---------------------------------------------------------------------------
-- Um Guincheiro sem homologação nem é ligado ao Match por outro caminho
-- ---------------------------------------------------------------------------
select is(
  public.guincheiro_elegivel('e6000000-0000-4000-8000-000000000003'), false,
  'a Giovana, disponível e de Frota ativa, mas sem homologação nem veículo, não é elegível'
);
select pg_temp.como('e6000000-0000-4000-8000-000000000003');
select is(
  (select array_agg(distinct codigo order by codigo) from public.minha_elegibilidade()),
  array['documento', 'sem_veiculo'],
  'o app dela explica: faltam documentos e o veículo'
);
select is(
  (select count(*) from public.minha_elegibilidade() where codigo = 'documento'), 3::bigint,
  'os três documentos aparecem, um por linha'
);
reset role;

-- O vínculo da Giovana a um veículo ainda sem aprovação a bloqueia pelo veículo.
insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
values ('f6000000-0000-4000-8000-00000000000a', 'b6000000-0000-4000-8000-000000000002',
        'e6000000-0000-4000-8000-000000000003');
select pg_temp.como('e6000000-0000-4000-8000-000000000003');
select is(
  (select descricao from public.minha_elegibilidade() where codigo = 'veiculo_pendente'),
  'O veículo QZB-2C34 ainda não foi aprovado pela operação.',
  'vinculada a um veículo sem aprovação, o app nomeia o veículo pela placa'
);
reset role;

-- A Frota vazia segue sem ativar e fora do Match.
select is(
  (select ativa from public.frotas where id = 'f6000000-0000-4000-8000-00000000000b'), false,
  'a Frota vazia continua inativa'
);

select * from finish();
rollback;
