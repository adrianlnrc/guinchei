-- Cadastro e homologação de veículos da Frota (issue #45, ADR-0012).
--
-- Aurora e Beto são representantes de Frotas diferentes; Rafael é Cliente, Marcos é Guincheiro
-- e a operação é a do seed. O seed traz um veículo (PBX1D23) da Frota pendente "Guincho
-- Capital", que nenhum dos dois representantes enxerga.
begin;
select plan(66);

-- Preparação (#50): o seed agora traz os veículos e vínculos das Frotas homologadas (Reboque
-- Planalto e Rita Campos). Este teste conta os veículos que ele mesmo cria mais o da demo
-- (Guincho Capital), então tira do cenário os veículos dessas duas Frotas.
delete from public.vinculos_veiculo
where frota_id in ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002');
delete from public.veiculos
where frota_id in ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002');

insert into auth.users (id, aud, role, phone) values
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', '5561900000008'),
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', '5561900000009');

insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao)
values
  ('55555555-5555-4555-8555-555555555555', 'representante', 'Aurora Lima', '5561900000008',
    '52998224725', now(), 'prestadores-teste'),
  ('66666666-6666-4666-8666-666666666666', 'representante', 'Beto Dias', '5561900000009',
    '71428793860', now(), 'prestadores-teste');

insert into public.frotas (
  id, tipo, documento, nome, ativa, representante_id, base_cep, base_endereco, base_bairro,
  chave_pix, termos_prestador_versao
) values
  ('f0000000-0000-4000-8000-0000000000a1', 'autonomo', '52998224725', 'Aurora Guinchos', false,
    '55555555-5555-4555-8555-555555555555', '70000000', 'SQN 308', 'Asa Norte', 'aurora@x.com', 'v1'),
  ('f0000000-0000-4000-8000-0000000000a2', 'autonomo', '71428793860', 'Beto Guinchos', false,
    '66666666-6666-4666-8666-666666666666', '70000000', 'SQN 309', 'Asa Norte', 'beto@x.com', 'v1');

-- Arquivos já no bucket, cada um na pasta de quem os enviou.
insert into storage.objects (bucket_id, name, owner) values
  ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/crlv.pdf', '55555555-5555-4555-8555-555555555555'),
  ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/f1.jpg', '55555555-5555-4555-8555-555555555555'),
  ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/f2.jpg', '55555555-5555-4555-8555-555555555555'),
  ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/f3.jpg', '55555555-5555-4555-8555-555555555555'),
  ('documentos-prestadores', '66666666-6666-4666-8666-666666666666/crlv.pdf', '66666666-6666-4666-8666-666666666666'),
  ('documentos-prestadores', '66666666-6666-4666-8666-666666666666/f1.jpg', '66666666-6666-4666-8666-666666666666');

-- ---------------------------------------------------------------------------
-- Validação de placa e RENAVAM
-- ---------------------------------------------------------------------------
select ok(public.placa_valida('ABC1234'), 'placa no padrão antigo');
select ok(public.placa_valida('ABC1D23'), 'placa Mercosul');
select ok(not public.placa_valida('ABC-1234'), 'placa com hífen não é a forma guardada');
select ok(not public.placa_valida('abc1234'), 'placa em minúsculas não é a forma guardada');
select ok(not public.placa_valida('AB12345'), 'duas letras não são placa');
select ok(not public.placa_valida('ABC12D3'), 'letra na posição errada não é placa');
select ok(public.renavam_valido('63936443047'), 'RENAVAM com dígito verificador certo');
select ok(public.renavam_valido('09876543216'), 'RENAVAM de 10 dígitos com zero à esquerda');
select ok(not public.renavam_valido('63936443048'), 'RENAVAM com dígito verificador errado');
select ok(not public.renavam_valido('00000000000'), 'RENAVAM de dígitos iguais não vale');
select ok(not public.renavam_valido('6393644304'), 'RENAVAM sem normalizar (10 dígitos) não vale');

-- ---------------------------------------------------------------------------
-- Cadastro pelo representante
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "phone": "5561900000008"}';

select lives_ok(
  $$ select public.cadastrar_veiculo(
       'abc-1d23', '9876543216', 'plataforma', 4500,
       '55555555-5555-4555-8555-555555555555/crlv.pdf',
       array['55555555-5555-4555-8555-555555555555/f1.jpg', '55555555-5555-4555-8555-555555555555/f2.jpg']) $$,
  'o representante cadastra o veículo (placa com máscara, RENAVAM de 10 dígitos)'
);
select is(
  (select placa || ' ' || renavam || ' ' || tipo || ' ' || pbt_kg from public.veiculos where placa = 'ABC1D23'),
  'ABC1D23 09876543216 plataforma 4500',
  'placa em maiúsculas sem hífen, RENAVAM com 11 dígitos, PBT numérico'
);
select is(
  (select frota_id from public.veiculos where placa = 'ABC1D23'),
  'f0000000-0000-4000-8000-0000000000a1'::uuid, 'o veículo é da Frota de quem cadastrou'
);
select is(
  (select count(*) from public.itens_homologacao where alvo = 'veiculo' and estado = 'pendente'
     and alvo_id = (select id from public.veiculos where placa = 'ABC1D23')),
  3::bigint, 'o CRLV e as duas fotos viram itens pendentes'
);
select is(
  (select count(*) from public.itens_homologacao where tipo = 'crlv'
     and alvo_id = (select id from public.veiculos where placa = 'ABC1D23')),
  1::bigint, 'um CRLV por veículo'
);
select is(
  (select count(*) from public.itens_homologacao where tipo = 'foto_veiculo'
     and alvo_id = (select id from public.veiculos where placa = 'ABC1D23')),
  2::bigint, 'uma foto por item: o veículo tem várias'
);

select throws_ok(
  $$ select public.cadastrar_veiculo('AB12345', '63936443047', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array['55555555-5555-4555-8555-555555555555/f3.jpg']) $$,
  'GVE02', null, 'placa inválida'
);
select throws_ok(
  $$ select public.cadastrar_veiculo('XYZ1A23', '63936443048', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array['55555555-5555-4555-8555-555555555555/f3.jpg']) $$,
  'GVE03', null, 'RENAVAM inválido'
);
select throws_ok(
  $$ select public.cadastrar_veiculo('XYZ1A23', '63936443047', 'lanca', 100,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array['55555555-5555-4555-8555-555555555555/f3.jpg']) $$,
  'GVE04', null, 'PBT abaixo do aceito'
);
select throws_ok(
  $$ select public.cadastrar_veiculo('XYZ1A23', '63936443047', 'lanca', 70000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array['55555555-5555-4555-8555-555555555555/f3.jpg']) $$,
  'GVE04', null, 'PBT acima do aceito'
);
select throws_ok(
  $$ select public.cadastrar_veiculo('XYZ1A23', '63936443047', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array[]::text[]) $$,
  'GVE05', null, 'sem foto'
);
select throws_ok(
  $$ select public.cadastrar_veiculo('XYZ1A23', '63936443047', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf',
       array_fill('55555555-5555-4555-8555-555555555555/f3.jpg'::text, array[7])) $$,
  'GVE05', null, 'mais de seis fotos'
);
select throws_ok(
  $$ select public.cadastrar_veiculo('abc1d23', '63936443047', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array['55555555-5555-4555-8555-555555555555/f3.jpg']) $$,
  'GVE06', null, 'placa duplicada tem erro próprio'
);
select throws_ok(
  $$ select public.cadastrar_veiculo('XYZ1A23', '9876543216', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array['55555555-5555-4555-8555-555555555555/f3.jpg']) $$,
  'GVE06', null, 'RENAVAM duplicado tem erro próprio'
);
select throws_ok(
  $$ select public.cadastrar_veiculo('PBX1D23', '63936443047', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array['55555555-5555-4555-8555-555555555555/f3.jpg']) $$,
  'GVE06', null, 'placa de veículo de outra Frota (que ele não enxerga) também é duplicada'
);
select throws_ok(
  $$ select public.cadastrar_veiculo('XYZ1A23', '12345678900', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/nao-existe.pdf', array['55555555-5555-4555-8555-555555555555/f3.jpg']) $$,
  'GHM06', null, 'o CRLV precisa estar no bucket'
);
select throws_ok(
  $$ select public.cadastrar_veiculo('XYZ1A23', '12345678900', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array['66666666-6666-4666-8666-666666666666/f1.jpg']) $$,
  'GHM06', null, 'a foto precisa estar na pasta de quem cadastra'
);
select is(
  (select count(*) from public.veiculos), 1::bigint,
  'nenhuma tentativa recusada deixou veículo pela metade'
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.veiculos (frota_id, placa, renavam, tipo, pbt_kg)
     values ('f0000000-0000-4000-8000-0000000000a1', 'DEF1G23', '63936443047', 'lanca', 3000) $$,
  '42501', null, 'ninguém insere veículo direto: só por cadastrar_veiculo'
);
select throws_ok(
  $$ delete from public.veiculos where placa = 'ABC1D23' $$,
  '42501', null, 'ninguém apaga veículo pela API'
);
select throws_ok(
  $$ update public.veiculos set frota_id = 'f0000000-0000-4000-8000-0000000000a2' $$,
  '42501', null, 'o veículo não troca de Frota'
);
select is(
  (select count(*) from public.veiculos), 1::bigint,
  'o representante lê só os veículos da própria Frota'
);

select lives_ok(
  $$ update public.veiculos set pbt_kg = 5000, tipo = 'lanca' where placa = 'ABC1D23' $$,
  'o representante edita tipo e PBT do veículo da própria Frota'
);
select is(
  (select pbt_kg from public.veiculos where placa = 'ABC1D23'), 5000,
  'a edição valeu enquanto nada foi aprovado'
);

set local request.jwt.claims to '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated", "phone": "5561900000009"}';
select is((select count(*) from public.veiculos), 0::bigint, 'outro representante não lê veículo alheio');
select is(
  (select count(*) from public.itens_homologacao where alvo = 'veiculo'), 0::bigint,
  'nem os itens do veículo alheio'
);
with t as (update public.veiculos set pbt_kg = 9000 where placa = 'ABC1D23' returning 1)
select is((select count(*) from t), 0::bigint, 'outro representante não edita veículo alheio');
select lives_ok(
  $$ select public.cadastrar_veiculo('BET1A23', '12345678900', 'asa_delta', 8000,
       '66666666-6666-4666-8666-666666666666/crlv.pdf', array['66666666-6666-4666-8666-666666666666/f1.jpg']) $$,
  'cada representante cadastra na própria Frota'
);
select is(
  (select frota_id from public.veiculos where placa = 'BET1A23'),
  'f0000000-0000-4000-8000-0000000000a2'::uuid, 'o veículo do Beto é da Frota do Beto'
);

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated", "phone": "5561900000001"}';
select is((select count(*) from public.veiculos), 0::bigint, 'o Cliente não lê veículos');
select throws_ok(
  $$ select public.cadastrar_veiculo('CLI1A23', '63936443047', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array['55555555-5555-4555-8555-555555555555/f3.jpg']) $$,
  'GVE01', null, 'o Cliente não cadastra veículo'
);

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222201", "role": "authenticated", "phone": "5561900000002"}';
select is((select count(*) from public.veiculos), 0::bigint, 'o Guincheiro não lê veículos da Frota');
select throws_ok(
  $$ select public.cadastrar_veiculo('GUI1A23', '63936443047', 'lanca', 3000,
       '55555555-5555-4555-8555-555555555555/crlv.pdf', array['55555555-5555-4555-8555-555555555555/f3.jpg']) $$,
  'GVE01', null, 'o Guincheiro não cadastra veículo'
);

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.veiculos $$, '42501', null, 'anon não lê veículos');
select throws_ok(
  $$ select public.cadastrar_veiculo('ANO1A23', '63936443047', 'lanca', 3000, 'x/y.pdf', array['x/z.jpg']) $$,
  '42501', null, 'anon não cadastra veículo'
);
reset role;

-- ---------------------------------------------------------------------------
-- Operação: lê todos, decide os itens
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated", "phone": "5561900000005"}';

select is(
  (select count(*) from public.veiculos), 3::bigint,
  'a operação lê todos os veículos (o do seed e os dois representantes)'
);
select is(
  (select count(*) from public.itens_homologacao
     where alvo = 'veiculo' and estado = 'pendente' and frota_id = 'f0000000-0000-4000-8000-0000000000a1'),
  3::bigint, 'os itens pendentes do veículo estão na fila da Frota, para a operação'
);
select lives_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao where tipo = 'crlv'
          and alvo_id = (select id from public.veiculos where placa = 'ABC1D23')), 'aprovado') $$,
  'a operação aprova o CRLV'
);
select throws_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao where tipo = 'foto_veiculo' and arquivo = '55555555-5555-4555-8555-555555555555/f2.jpg'), 'recusado') $$,
  'GHM04', null, 'recusar a foto exige motivo'
);
select lives_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao where tipo = 'foto_veiculo' and arquivo = '55555555-5555-4555-8555-555555555555/f2.jpg'),
       'recusado', 'Foto escura') $$,
  'a operação recusa a foto com motivo'
);
select lives_ok(
  $$ select public.decidir_item_homologacao(
       (select id from public.itens_homologacao where tipo = 'foto_veiculo' and arquivo = '55555555-5555-4555-8555-555555555555/f1.jpg'), 'aprovado') $$,
  'a operação aprova a outra foto'
);

-- Com item aprovado, o que ela conferiu não muda por baixo dela.
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "phone": "5561900000008"}';
select throws_ok(
  $$ update public.veiculos set pbt_kg = 9000 where placa = 'ABC1D23' $$,
  'GVE07', null, 'depois de um item aprovado, o PBT não muda'
);
select throws_ok(
  $$ update public.veiculos set placa = 'ZZZ9Z99' where placa = 'ABC1D23' $$,
  'GVE07', null, 'nem a placa'
);

-- O representante vê o motivo e reenvia o que foi recusado.
select is(
  (select motivo from public.itens_homologacao where estado = 'recusado' and alvo = 'veiculo'),
  'Foto escura', 'o representante lê o motivo da recusa'
);
reset role;
insert into storage.objects (bucket_id, name, owner)
values ('documentos-prestadores', '55555555-5555-4555-8555-555555555555/f2-nova.jpg', '55555555-5555-4555-8555-555555555555');
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "phone": "5561900000008"}';
select lives_ok(
  $$ select public.reenviar_item_homologacao(
       (select id from public.itens_homologacao where estado = 'recusado' and alvo = 'veiculo'),
       '55555555-5555-4555-8555-555555555555/f2-nova.jpg') $$,
  'o representante reenvia a foto recusada'
);
select is(
  (select estado::text || ' ' || coalesce(motivo, 'sem motivo') from public.itens_homologacao
     where arquivo like '%/f2-nova.jpg'),
  'pendente sem motivo', 'o item reenviado volta a pendente, sem o motivo'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao(
       (select id from public.itens_homologacao where tipo = 'crlv' and estado = 'aprovado'
          and alvo_id = (select id from public.veiculos where placa = 'ABC1D23')),
       '55555555-5555-4555-8555-555555555555/f3.jpg') $$,
  'GHM03', null, 'item aprovado não se reenvia'
);
select throws_ok(
  $$ select public.reenviar_item_homologacao(
       (select id from public.itens_homologacao where tipo = 'crlv'
          and alvo_id = (select id from public.veiculos where placa = 'BET1A23')),
       '55555555-5555-4555-8555-555555555555/f3.jpg') $$,
  'P0002', null, 'o representante não reenvia item de veículo de outra Frota'
);
reset role;

-- ---------------------------------------------------------------------------
-- Modelo
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo)
     values ('f0000000-0000-4000-8000-0000000000a1', 'veiculo',
       (select id from public.veiculos where placa = 'ABC1D23'), 'crlv',
       '55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555/f3.jpg') $$,
  '23505', null, 'só um CRLV por veículo'
);
select lives_ok(
  $$ insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo)
     values ('f0000000-0000-4000-8000-0000000000a1', 'veiculo',
       (select id from public.veiculos where placa = 'ABC1D23'), 'foto_veiculo',
       '55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555/f3.jpg') $$,
  'mas o veículo aceita várias fotos'
);
select throws_ok(
  $$ insert into public.veiculos (frota_id, placa, renavam, tipo, pbt_kg)
     values ('f0000000-0000-4000-8000-0000000000a1', 'GHI1J23', '63936443047', 'lanca', 3000) $$,
  '23505', null, 'o RENAVAM é único (o banco garante, além da função)'
);
select throws_ok(
  $$ insert into public.veiculos (frota_id, placa, renavam, tipo, pbt_kg)
     values ('f0000000-0000-4000-8000-0000000000a1', 'GHI-1J23', '12345678900', 'lanca', 3000) $$,
  '23514', null, 'a placa guardada é a normalizada'
);
select throws_ok(
  $$ insert into public.veiculos (frota_id, placa, renavam, tipo, pbt_kg)
     values ('f0000000-0000-4000-8000-0000000000a1', 'GHI1J23', '12345678901', 'lanca', 3000) $$,
  '23514', null, 'o RENAVAM guardado tem o dígito verificador certo'
);
select throws_ok(
  $$ insert into public.veiculos (frota_id, placa, renavam, tipo, pbt_kg)
     values ('f0000000-0000-4000-8000-0000000000a1', 'GHI1J23', '12345678900', 'lanca', 0) $$,
  '23514', null, 'o PBT é um número positivo dentro da faixa'
);
select throws_ok(
  $$ insert into public.veiculos (frota_id, placa, renavam, tipo, pbt_kg)
     values ('f0000000-0000-4000-8000-0000000000a1', 'GHI1J23', '12345678900', 'caminhao', 3000) $$,
  '22P02', null, 'o tipo é plataforma, asa_delta ou lanca'
);

select * from finish();
rollback;
