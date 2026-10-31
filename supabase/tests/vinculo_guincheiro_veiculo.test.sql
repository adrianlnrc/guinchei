-- Vínculo Guincheiro × veículo com bloqueio CNH × PBT (issue #48, ADR-0012).
--
-- Rita representa a Frota A (empresa); Gil, Gabi, Gus e Gui são Guincheiros dela. Otto é o
-- autônomo da Frota B (outra Frota). Rafael (Cliente) e a operação são os do seed. Tudo aqui
-- usa valores próprios (CPFs, CNHs, placas e RENAVAMs), nunca os do seed. Cobre:
--   - a barreira no banco (trigger): INSERT e UPDATE diretos, que valem até para o service_role;
--   - a RPC `vincular_guincheiro_veiculo` e os erros GVL01 a GVL05;
--   - CNH não aprovada = vínculo pendente, revalidado quando a operação aprova a CNH;
--   - revalidação ao mudar a categoria da CNH, o PBT do veículo, e ao vencer a CNH;
--   - leitura (RLS), `meu_veiculo`, `cnh_dos_meus_guincheiros` e o histórico `vinculos_encerrados`.
begin;
select plan(82);

-- Preparação (#50): o seed traz os vínculos dos Guincheiros das Frotas homologadas (Reboque
-- Planalto e Rita Campos). Este teste conta os vínculos que ele mesmo cria, então tira esses
-- do cenário.
delete from public.vinculos_veiculo
where frota_id in ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002');

insert into auth.users (id, aud, role, phone) values
  ('e4800000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '5561900000481'),
  ('e4800000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '5561900000482'),
  ('e4800000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '5561900000483'),
  ('e4800000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', '5561900000484'),
  ('e4800000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', '5561900000485'),
  ('e4800000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', '5561900000486');

insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao) values
  ('e4800000-0000-4000-8000-000000000001', 'representante', 'Rita Rocha', '5561900000481', '28417593691', 'teste'),
  ('e4800000-0000-4000-8000-000000000002', 'guincheiro', 'Gil Gomes', '5561900000482', '71382649177', 'teste'),
  ('e4800000-0000-4000-8000-000000000003', 'guincheiro', 'Gabi Gama', '5561900000483', '90537418288', 'teste'),
  ('e4800000-0000-4000-8000-000000000004', 'guincheiro', 'Gus Guedes', '5561900000484', '46192073813', 'teste'),
  ('e4800000-0000-4000-8000-000000000005', 'guincheiro', 'Gui Godói', '5561900000485', '37295841628', 'teste'),
  ('e4800000-0000-4000-8000-000000000006', 'representante', 'Otto Osório', '5561900000486', '15827460362', 'teste');

insert into public.frotas (id, tipo, documento, nome, representante_id, base_cep, base_endereco,
                           base_bairro, chave_pix, termos_prestador_versao)
values
  ('f4800000-0000-4000-8000-00000000000a', 'empresa', '34857129000132', 'Frota dos Vínculos',
   'e4800000-0000-4000-8000-000000000001', '70000000', 'SQS 10', 'Asa Sul', 'r@exemplo.com', 'teste'),
  ('f4800000-0000-4000-8000-00000000000b', 'autonomo', '15827460362', 'Frota do Otto',
   'e4800000-0000-4000-8000-000000000006', '70000000', 'SQN 11', 'Asa Norte', 'o@exemplo.com', 'teste');

insert into public.guincheiros (id, frota_id, posicao, disponivel)
select p.id, p.frota, extensions.st_setsrid(extensions.st_makepoint(-47.88, -15.79), 4326), false
from (values
  ('e4800000-0000-4000-8000-000000000002'::uuid, 'f4800000-0000-4000-8000-00000000000a'::uuid),
  ('e4800000-0000-4000-8000-000000000003'::uuid, 'f4800000-0000-4000-8000-00000000000a'::uuid),
  ('e4800000-0000-4000-8000-000000000004'::uuid, 'f4800000-0000-4000-8000-00000000000a'::uuid),
  ('e4800000-0000-4000-8000-000000000005'::uuid, 'f4800000-0000-4000-8000-00000000000a'::uuid),
  ('e4800000-0000-4000-8000-000000000006'::uuid, 'f4800000-0000-4000-8000-00000000000b'::uuid)
) p (id, frota);

-- V1: 4.200 kg (exige C); V2: no limite da B (3.500 kg); V3: 3.000 kg; V4: da outra Frota.
insert into public.veiculos (id, frota_id, placa, renavam, tipo, pbt_kg) values
  ('b4800000-0000-4000-8000-000000000001', 'f4800000-0000-4000-8000-00000000000a', 'ZTA1B23', '48291736500', 'plataforma', 4200),
  ('b4800000-0000-4000-8000-000000000002', 'f4800000-0000-4000-8000-00000000000a', 'ZTA2C34', '73519284602', 'lanca', 3500),
  ('b4800000-0000-4000-8000-000000000003', 'f4800000-0000-4000-8000-00000000000a', 'ZTA3D45', '29164835707', 'asa_delta', 3000),
  ('b4800000-0000-4000-8000-000000000004', 'f4800000-0000-4000-8000-00000000000b', 'ZTB4E56', '50836172945', 'plataforma', 3000);

-- Arquivos que cada Guincheiro "enviou" ao bucket de documentos.
insert into storage.objects (bucket_id, name, owner)
select 'documentos-prestadores', dono || '/' || arquivo, dono::uuid
from (values ('e4800000-0000-4000-8000-000000000002'), ('e4800000-0000-4000-8000-000000000003'),
             ('e4800000-0000-4000-8000-000000000004'), ('e4800000-0000-4000-8000-000000000005')) d (dono),
     (values ('cnh.jpg'), ('cnh2.jpg')) a (arquivo);

-- ---------------------------------------------------------------------------
-- Modelo
-- ---------------------------------------------------------------------------
select has_table('public', 'vinculos_veiculo', 'existe a tabela dos vínculos');
select has_table('public', 'vinculos_encerrados', 'existe o histórico dos vínculos que acabaram');

-- ---------------------------------------------------------------------------
-- Barreira no banco, sem passar pela RPC (vale para qualquer papel, inclusive service_role)
-- ---------------------------------------------------------------------------

-- Gil ainda não enviou a CNH: o vínculo é permitido, como pendente. A situação e a Frota não
-- são escolha de quem insere: o trigger calcula uma e copia a outra do veículo.
select lives_ok(
  $$ insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id, situacao)
     values ('f4800000-0000-4000-8000-00000000000b', 'b4800000-0000-4000-8000-000000000001',
             'e4800000-0000-4000-8000-000000000002', 'ativo') $$,
  'sem CNH aprovada, o vínculo de 4.200 kg é permitido'
);
select results_eq(
  $$ select situacao::text, frota_id from public.vinculos_veiculo
     where guincheiro_id = 'e4800000-0000-4000-8000-000000000002' $$,
  $$ values ('pendente', 'f4800000-0000-4000-8000-00000000000a'::uuid) $$,
  'fica pendente (o "ativo" enviado é ignorado) e na Frota do veículo (a enviada é ignorada)'
);
select throws_ok(
  $$ insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
     values ('f4800000-0000-4000-8000-00000000000a', 'b4800000-0000-4000-8000-000000000002',
             'e4800000-0000-4000-8000-000000000002') $$,
  '23505', null, 'o Guincheiro dirige um veículo só: o segundo vínculo é recusado'
);

-- Gil envia a CNH B: segue pendente até a operação aprovar.
set local role authenticated;
set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$ select public.enviar_cnh('71903482651', 'B', public.hoje_em_brasilia() + 400, true,
                              'e4800000-0000-4000-8000-000000000002/cnh.jpg') $$,
  'Gil envia a CNH categoria B'
);
reset role;
select is(
  (select situacao::text from public.vinculos_veiculo
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000002'),
  'pendente', 'CNH enviada e não aprovada: o vínculo continua pendente'
);

-- A operação aprova a CNH B de Gil: o vínculo pendente com 4.200 kg é revalidado e cai.
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select lives_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao
        where alvo_id = 'e4800000-0000-4000-8000-000000000002' and tipo = 'cnh'), 'aprovado') $$,
  'a operação aprova a CNH B do Gil'
);
reset role;
select is_empty(
  $$ select 1 from public.vinculos_veiculo where guincheiro_id = 'e4800000-0000-4000-8000-000000000002' $$,
  'na aprovação o vínculo pendente é revalidado e derrubado: B não cobre 4.200 kg'
);
select results_eq(
  $$ select motivo, detalhe, placa from public.vinculos_encerrados
     where guincheiro_id = 'e4800000-0000-4000-8000-000000000002' $$,
  $$ values ('cnh_nao_cobre', 'CNH B não cobre o PBT de 4200 kg', 'ZTA1B23') $$,
  'o histórico guarda o motivo e a placa'
);

-- Com a CNH B aprovada: 4.200 kg é recusado no banco; 3.500 kg (o limite), aceito.
select throws_ok(
  $$ insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
     values ('f4800000-0000-4000-8000-00000000000a', 'b4800000-0000-4000-8000-000000000001',
             'e4800000-0000-4000-8000-000000000002') $$,
  'GVL03', 'A CNH B do Guincheiro não cobre o PBT de 4200 kg deste veículo',
  'CNH B aprovada em veículo de 4.200 kg: recusado pela barreira do banco'
);
select lives_ok(
  $$ insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
     values ('f4800000-0000-4000-8000-00000000000a', 'b4800000-0000-4000-8000-000000000002',
             'e4800000-0000-4000-8000-000000000002') $$,
  'CNH B aprovada em veículo de exatamente 3.500 kg: aceito'
);
select is(
  (select situacao::text from public.vinculos_veiculo
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000002'),
  'ativo', 'CNH aprovada que cobre o PBT: vínculo ativo'
);
select throws_ok(
  $$ update public.vinculos_veiculo set veiculo_id = 'b4800000-0000-4000-8000-000000000001'
     where guincheiro_id = 'e4800000-0000-4000-8000-000000000002' $$,
  'GVL03', null, 'trocar o veículo por UPDATE direto passa pela mesma barreira'
);
select is(
  (select veiculo_id from public.vinculos_veiculo
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000002'),
  'b4800000-0000-4000-8000-000000000002'::uuid, 'o UPDATE recusado não mudou o vínculo'
);
select throws_ok(
  $$ insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
     values ('f4800000-0000-4000-8000-00000000000b', 'b4800000-0000-4000-8000-000000000001',
             'e4800000-0000-4000-8000-000000000006') $$,
  'GVL02', null, 'Guincheiro e veículo de Frotas diferentes não se vinculam'
);
select throws_ok(
  $$ insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
     values ('f4800000-0000-4000-8000-00000000000a', 'b4800000-0000-4000-8000-000000000004',
             'e4800000-0000-4000-8000-000000000002') $$,
  'GVL02', null, 'nem o Guincheiro da Frota A no veículo da Frota B'
);

-- Gabi tem CNH C aprovada: 4.200 kg é aceito.
set local role authenticated;
set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000003", "role": "authenticated"}';
select lives_ok(
  $$ select public.enviar_cnh('30581749263', 'C', public.hoje_em_brasilia() + 400, true,
                              'e4800000-0000-4000-8000-000000000003/cnh.jpg') $$,
  'Gabi envia a CNH categoria C'
);
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select lives_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao
        where alvo_id = 'e4800000-0000-4000-8000-000000000003' and tipo = 'cnh'), 'aprovado') $$,
  'a operação aprova a CNH C da Gabi'
);
reset role;
select lives_ok(
  $$ insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
     values ('f4800000-0000-4000-8000-00000000000a', 'b4800000-0000-4000-8000-000000000001',
             'e4800000-0000-4000-8000-000000000003') $$,
  'CNH C aprovada em veículo de 4.200 kg: aceito'
);
select is(
  (select situacao::text from public.vinculos_veiculo
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000003'),
  'ativo', 'e fica ativo'
);

-- ---------------------------------------------------------------------------
-- Pela API: `vincular_guincheiro_veiculo` e `desfazer_vinculo`
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000004',
                                     'b4800000-0000-4000-8000-000000000001')::text,
  'pendente', 'o representante vincula quem ainda não enviou a CNH: pendente'
);
select is(
  public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000004',
                                     'b4800000-0000-4000-8000-000000000001')::text,
  'pendente', 'vincular de novo ao mesmo veículo não muda nada'
);
select throws_ok(
  $$ select public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000004',
                                               'b4800000-0000-4000-8000-000000000002') $$,
  'GVL04', null, 'quem já tem veículo precisa ter o vínculo desfeito antes de ir a outro'
);
select throws_ok(
  $$ select public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000002',
                                               'b4800000-0000-4000-8000-000000000001') $$,
  'GVL04', null, 'o mesmo vale para o Gil, que já está no veículo de 3.500 kg'
);
select lives_ok(
  $$ select public.desfazer_vinculo((select id from public.vinculos_veiculo
       where guincheiro_id = 'e4800000-0000-4000-8000-000000000002')) $$,
  'o representante desfaz o vínculo do Gil'
);
select is(
  (select count(*) from public.vinculos_encerrados
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000002'
     and motivo = 'desfeito_pelo_representante' and placa = 'ZTA2C34'),
  1::bigint, 'o histórico registra que foi o representante quem desfez'
);
select throws_ok(
  $$ select public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000002',
                                               'b4800000-0000-4000-8000-000000000001') $$,
  'GVL03', null, 'CNH B aprovada em 4.200 kg é recusada também pela RPC (erro tratado)'
);
select is(
  public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000002',
                                     'b4800000-0000-4000-8000-000000000003')::text,
  'ativo', 'a mesma CNH B em veículo de 3.000 kg é aceita e fica ativa'
);
select is(
  public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000005',
                                     'b4800000-0000-4000-8000-000000000001')::text,
  'pendente', 'o Gui, sem CNH, também fica pendente em 4.200 kg'
);

-- Quem pode e quem não pode
select throws_ok(
  $$ select public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000006',
                                               'b4800000-0000-4000-8000-000000000001') $$,
  'GVL02', null, 'Guincheiro de outra Frota não se vincula a veículo desta'
);
select throws_ok(
  $$ select public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000002',
                                               'b4800000-0000-4000-8000-000000000004') $$,
  'GVL01', null, 'o representante não vincula a veículo de outra Frota'
);
select throws_ok(
  $$ select public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000002',
                                               '00000000-0000-4000-8000-0000000000ff') $$,
  'GVL01', null, 'veículo inexistente é o mesmo erro (não revela o que existe)'
);

set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000006", "role": "authenticated"}';
select throws_ok(
  $$ select public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000004',
                                               'b4800000-0000-4000-8000-000000000001') $$,
  'GVL01', null, 'o representante de outra Frota não vincula nesta'
);
select throws_ok(
  $$ select public.desfazer_vinculo((select id from public.vinculos_veiculo
       where guincheiro_id = 'e4800000-0000-4000-8000-000000000003')) $$,
  'GVL05', null, 'nem desfaz vínculo de outra Frota (ele nem enxerga)'
);

set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000002',
                                               'b4800000-0000-4000-8000-000000000003') $$,
  'GVL01', null, 'o Guincheiro não se vincula sozinho (só o representante)'
);

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select throws_ok(
  $$ select public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000002',
                                               'b4800000-0000-4000-8000-000000000003') $$,
  'GVL01', null, 'o Cliente não vincula ninguém'
);

set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ select public.desfazer_vinculo('00000000-0000-4000-8000-0000000000ff') $$,
  'GVL05', null, 'desfazer vínculo inexistente é GVL05'
);
select throws_ok(
  $$ select public.revalidar_vinculos() $$,
  '42501', null, 'a revalidação é interna: a API não a chama'
);
select throws_ok(
  $$ select public.avaliar_vinculo('e4800000-0000-4000-8000-000000000002',
                                   'b4800000-0000-4000-8000-000000000001') $$,
  '42501', null, 'nem a avaliação interna'
);

-- Escrita direta nas tabelas é do banco, não da API
select throws_ok(
  $$ insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id)
     values ('f4800000-0000-4000-8000-00000000000a', 'b4800000-0000-4000-8000-000000000003',
             'e4800000-0000-4000-8000-000000000002') $$,
  '42501', null, 'a API não insere vínculo direto na tabela'
);
select throws_ok(
  $$ update public.vinculos_veiculo set situacao = 'ativo' $$,
  '42501', null, 'a API não altera vínculo direto'
);
select throws_ok(
  $$ delete from public.vinculos_veiculo $$,
  '42501', null, 'a API não apaga vínculo direto'
);
select throws_ok(
  $$ update public.vinculos_encerrados set detalhe = 'x' $$,
  '42501', null, 'a API não altera o histórico'
);

set local role anon;
select throws_ok(
  $$ select public.vincular_guincheiro_veiculo('e4800000-0000-4000-8000-000000000002',
                                               'b4800000-0000-4000-8000-000000000003') $$,
  '42501', null, 'sem login, nada de vínculo'
);
reset role;
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Leitura: o representante vê e desfaz; o Guincheiro vê o seu; a operação vê tudo
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(
  (select count(*) from public.vinculos_veiculo), 4::bigint,
  'o representante vê os quatro vínculos da própria Frota'
);
select is(
  (select count(*) from public.vinculos_encerrados), 2::bigint,
  'e o histórico dos vínculos que acabaram na Frota'
);
select results_eq(
  $$ select guincheiro_id, categoria, estado::text from public.cnh_dos_meus_guincheiros() $$,
  $$ values
       ('e4800000-0000-4000-8000-000000000002'::uuid, 'B'::text, 'aprovado'::text),
       ('e4800000-0000-4000-8000-000000000003'::uuid, 'C'::text, 'aprovado'::text),
       ('e4800000-0000-4000-8000-000000000004'::uuid, null::text, null::text),
       ('e4800000-0000-4000-8000-000000000005'::uuid, null::text, null::text) $$,
  'o representante lê a categoria e o estado da CNH dos Guincheiros da Frota (nulos: não enviou)'
);

set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000006", "role": "authenticated"}';
select is((select count(*) from public.vinculos_veiculo), 0::bigint, 'o representante de outra Frota não vê estes vínculos');
select is((select count(*) from public.vinculos_encerrados), 0::bigint, 'nem o histórico');
select results_eq(
  $$ select guincheiro_id, categoria from public.cnh_dos_meus_guincheiros() $$,
  $$ values ('e4800000-0000-4000-8000-000000000006'::uuid, null::text) $$,
  'e só lê a CNH dos Guincheiros da própria Frota'
);

set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000002", "role": "authenticated"}';
select is((select count(*) from public.vinculos_veiculo), 1::bigint, 'o Guincheiro lê só o próprio vínculo');
select results_eq(
  $$ select situacao::text, placa, tipo::text, pbt_kg from public.meu_veiculo() $$,
  $$ values ('ativo', 'ZTA3D45', 'asa_delta', 3000) $$,
  'o Guincheiro vê em qual veículo está (placa, tipo, PBT), sem ler a tabela de veículos'
);
select is((select count(*) from public.veiculos), 0::bigint, 'a tabela de veículos continua fechada para ele');
select is((select count(*) from public.vinculos_encerrados), 2::bigint, 'ele lê o histórico dos próprios vínculos');
select is_empty($$ select * from public.cnh_dos_meus_guincheiros() $$, 'e não lê a CNH dos colegas');

set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000004", "role": "authenticated"}';
select results_eq(
  $$ select situacao::text, placa from public.meu_veiculo() $$,
  $$ values ('pendente', 'ZTA1B23') $$,
  'o vínculo pendente aparece como pendente para o Guincheiro'
);

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is((select count(*) from public.vinculos_veiculo), 0::bigint, 'o Cliente não lê vínculos');
select is_empty($$ select * from public.meu_veiculo() $$, 'e não tem veículo');

set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.vinculos_veiculo), 4::bigint, 'a operação lê todos os vínculos');
reset role;

-- ---------------------------------------------------------------------------
-- Revalidação: aprovar a CNH (pendente vira ativo, ou cai)
-- ---------------------------------------------------------------------------

-- Gus envia a CNH C: segue pendente; aprovada, o vínculo vira ativo.
set local role authenticated;
set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000004", "role": "authenticated"}';
select lives_ok(
  $$ select public.enviar_cnh('84620391750', 'C', public.hoje_em_brasilia() + 400, true,
                              'e4800000-0000-4000-8000-000000000004/cnh.jpg') $$,
  'Gus envia a CNH categoria C'
);
reset role;
select is(
  (select situacao::text from public.vinculos_veiculo
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000004'),
  'pendente', 'CNH em análise: o vínculo do Gus segue pendente'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select lives_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao
        where alvo_id = 'e4800000-0000-4000-8000-000000000004' and tipo = 'cnh'), 'aprovado') $$,
  'a operação aprova a CNH C do Gus'
);
reset role;
select is(
  (select situacao::text from public.vinculos_veiculo
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000004'),
  'ativo', 'revalidado na aprovação: C cobre 4.200 kg e o vínculo passa a ativo'
);

-- Gui envia a CNH B: aprovada, o vínculo pendente com 4.200 kg cai.
set local role authenticated;
set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000005", "role": "authenticated"}';
select lives_ok(
  $$ select public.enviar_cnh('52971380642', 'B', public.hoje_em_brasilia() + 400, true,
                              'e4800000-0000-4000-8000-000000000005/cnh.jpg') $$,
  'Gui envia a CNH categoria B'
);
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select lives_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao
        where alvo_id = 'e4800000-0000-4000-8000-000000000005' and tipo = 'cnh'), 'aprovado') $$,
  'a operação aprova a CNH B do Gui'
);
reset role;
select is_empty(
  $$ select 1 from public.vinculos_veiculo where guincheiro_id = 'e4800000-0000-4000-8000-000000000005' $$,
  'revalidado na aprovação: B não cobre 4.200 kg e o vínculo pendente cai'
);
select results_eq(
  $$ select motivo, detalhe from public.vinculos_encerrados
     where guincheiro_id = 'e4800000-0000-4000-8000-000000000005' $$,
  $$ values ('cnh_nao_cobre', 'CNH B não cobre o PBT de 4200 kg') $$,
  'e o motivo fica no histórico'
);

-- ---------------------------------------------------------------------------
-- Revalidação: mudar o PBT do veículo
-- ---------------------------------------------------------------------------
-- V3 (3.000 kg) com o Gil (B): subir até 3.500 kg ainda é coberto; 3.501 kg derruba.
update public.veiculos set pbt_kg = 3500 where id = 'b4800000-0000-4000-8000-000000000003';
select is(
  (select situacao::text from public.vinculos_veiculo
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000002'),
  'ativo', 'PBT subiu para 3.500 kg (limite da B): o vínculo do Gil continua'
);
update public.veiculos set pbt_kg = 3501 where id = 'b4800000-0000-4000-8000-000000000003';
select is_empty(
  $$ select 1 from public.vinculos_veiculo where guincheiro_id = 'e4800000-0000-4000-8000-000000000002' $$,
  'PBT subiu para 3.501 kg: o vínculo do Gil (CNH B) é derrubado'
);
select results_eq(
  $$ select detalhe from public.vinculos_encerrados
     where guincheiro_id = 'e4800000-0000-4000-8000-000000000002' and placa = 'ZTA3D45' $$,
  $$ values ('CNH B não cobre o PBT de 3501 kg') $$,
  'o histórico diz o PBT novo'
);

-- V1 (4.200 kg) tem a Gabi (C) e o Gus (C): subir o PBT não derruba ninguém.
update public.veiculos set pbt_kg = 4300 where id = 'b4800000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.vinculos_veiculo
   where veiculo_id = 'b4800000-0000-4000-8000-000000000001' and situacao = 'ativo'),
  2::bigint, 'PBT de 4.300 kg: C continua cobrindo e os dois vínculos seguem ativos'
);

-- ---------------------------------------------------------------------------
-- Revalidação: mudar a categoria da CNH
-- ---------------------------------------------------------------------------
update public.documentos_guincheiro set cnh_categoria = 'D'
where guincheiro_id = 'e4800000-0000-4000-8000-000000000004';
select is(
  (select situacao::text from public.vinculos_veiculo
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000004'),
  'ativo', 'categoria C trocada por D (também cobre): o vínculo do Gus continua'
);
update public.documentos_guincheiro set cnh_categoria = 'B'
where guincheiro_id = 'e4800000-0000-4000-8000-000000000003';
select is_empty(
  $$ select 1 from public.vinculos_veiculo where guincheiro_id = 'e4800000-0000-4000-8000-000000000003' $$,
  'categoria da Gabi mudou de C para B: o vínculo com 4.300 kg é derrubado'
);
select results_eq(
  $$ select motivo, detalhe, placa from public.vinculos_encerrados
     where guincheiro_id = 'e4800000-0000-4000-8000-000000000003' $$,
  $$ values ('cnh_nao_cobre', 'CNH B não cobre o PBT de 4300 kg', 'ZTA1B23') $$,
  'e o histórico diz a categoria nova'
);

-- ---------------------------------------------------------------------------
-- CNH vencida volta o vínculo a pendente; o reenvio com outra categoria é revalidado na aprovação
-- ---------------------------------------------------------------------------
update public.itens_homologacao set validade = public.hoje_em_brasilia() - 1
where alvo_id = 'e4800000-0000-4000-8000-000000000004' and tipo = 'cnh';
select lives_ok($$ select public.marcar_itens_vencidos() $$, 'o job marca a CNH vencida do Gus');
select is(
  (select estado::text from public.itens_homologacao
   where alvo_id = 'e4800000-0000-4000-8000-000000000004' and tipo = 'cnh'),
  'vencido', 'a CNH do Gus está vencida'
);
select is(
  (select situacao::text from public.vinculos_veiculo
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000004'),
  'pendente', 'CNH vencida não vale: o vínculo volta a pendente'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "e4800000-0000-4000-8000-000000000004", "role": "authenticated"}';
select lives_ok(
  $$ select public.enviar_cnh('84620391750', 'B', public.hoje_em_brasilia() + 400, true,
                              'e4800000-0000-4000-8000-000000000004/cnh2.jpg') $$,
  'o Gus renova a CNH, agora categoria B'
);
reset role;
select is(
  (select situacao::text from public.vinculos_veiculo
   where guincheiro_id = 'e4800000-0000-4000-8000-000000000004'),
  'pendente', 'CNH renovada e em análise: o vínculo segue pendente'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select lives_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao
        where alvo_id = 'e4800000-0000-4000-8000-000000000004' and tipo = 'cnh'), 'aprovado') $$,
  'a operação aprova a CNH renovada do Gus'
);
reset role;
select is_empty(
  $$ select 1 from public.vinculos_veiculo where guincheiro_id = 'e4800000-0000-4000-8000-000000000004' $$,
  'categoria nova (B) não cobre 4.300 kg: o vínculo cai na aprovação'
);

select * from finish();
rollback;
