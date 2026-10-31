-- Documentos do Guincheiro: CNH, antecedentes e selfie (issue #47, ADR-0012).
--
-- Ana é representante e Guincheiro da Frota autônoma dela (cria a própria linha); Bruno
-- representa uma empresa, e Carla e Daniel são Guincheiros dessa empresa. Rafael (Cliente) e a
-- operação do seed são os de fora. Cobre a validação de cada documento, o item de homologação
-- que nasce pendente, o reenvio, e a RLS: o Guincheiro lê/envia só os próprios documentos, a
-- operação lê todos. Os arquivos "enviados" são criados direto no bucket; a CNH do Paulo vem do seed.
begin;
select plan(79);

-- Preparação (#50): o seed traz os dados de documento dos três Guincheiros homologados (Marcos,
-- Wagner e Rita). Este teste conta os dados que ele cria mais a CNH do Paulo (demo), então tira
-- os três do cenário, e também os dos dois Guincheiros da Frota "Cerrado Guinchos"
-- (05_demonstracao.sql).
delete from public.documentos_guincheiro
where guincheiro_id in ('22222222-2222-4222-8222-222222222201',
                        '22222222-2222-4222-8222-222222222202',
                        '22222222-2222-4222-8222-222222222203',
                        'd0d00000-0000-4000-8000-000000000002',
                        'd0d00000-0000-4000-8000-000000000003');

insert into auth.users (id, aud, role, phone) values
  ('d1000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', '5561900000191'),
  ('d1000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', '5561900000192'),
  ('d2000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', '5561900000193'),
  ('d2000000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', '5561900000194');

insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao) values
  ('d1000000-0000-4000-8000-00000000000a', 'representante', 'Ana Autônoma', '5561900000191', '52998224725', 'teste'),
  ('d1000000-0000-4000-8000-00000000000b', 'representante', 'Bruno Empresa', '5561900000192', '39053344705', 'teste'),
  ('d2000000-0000-4000-8000-00000000000c', 'guincheiro', 'Carla Dias', '5561900000193', '11144477735', 'teste'),
  ('d2000000-0000-4000-8000-00000000000d', 'guincheiro', 'Daniel Reis', '5561900000194', '12345678909', 'teste');

insert into public.frotas (id, tipo, documento, nome, representante_id, base_cep, base_endereco,
                           base_bairro, chave_pix, termos_prestador_versao)
values
  ('f2000000-0000-4000-8000-00000000000a', 'autonomo', '52998224725', 'Frota da Ana',
   'd1000000-0000-4000-8000-00000000000a', '70000000', 'SQN 1', 'Asa Norte', 'a@exemplo.com', 'teste'),
  ('f2000000-0000-4000-8000-00000000000b', 'empresa', '12345678000195', 'Empresa do Bruno',
   'd1000000-0000-4000-8000-00000000000b', '70000000', 'SQS 2', 'Asa Sul', 'b@exemplo.com', 'teste');

insert into public.guincheiros (id, frota_id, posicao, disponivel) values
  ('d2000000-0000-4000-8000-00000000000c', 'f2000000-0000-4000-8000-00000000000b',
   extensions.st_setsrid(extensions.st_makepoint(-47.88, -15.79), 4326), false),
  ('d2000000-0000-4000-8000-00000000000d', 'f2000000-0000-4000-8000-00000000000b',
   extensions.st_setsrid(extensions.st_makepoint(-47.88, -15.79), 4326), false);

-- Arquivos que cada um "enviou" ao bucket de documentos.
insert into storage.objects (bucket_id, name, owner)
select 'documentos-prestadores', dono || '/' || arquivo, dono::uuid
from (values ('d1000000-0000-4000-8000-00000000000a'), ('d2000000-0000-4000-8000-00000000000c'),
             ('d2000000-0000-4000-8000-00000000000d')) d (dono),
     (values ('cnh.jpg'), ('cnh2.jpg'), ('antecedentes.pdf'), ('antecedentes2.pdf'),
             ('selfie.jpg'), ('selfie2.jpg')) a (arquivo);

-- ---------------------------------------------------------------------------
-- Modelo
-- ---------------------------------------------------------------------------
select has_table('public', 'documentos_guincheiro', 'a CNH e a certidão têm colunas consultáveis');
select is(public.validade_antecedentes('2026-03-10'), '2027-03-10'::date, 'a certidão vale até o mesmo dia, 12 meses depois');
select is(public.validade_antecedentes('2024-02-29'), '2025-02-28'::date, '29 de fevereiro vira 28 de fevereiro');
select is(public.validade_antecedentes('2026-12-31'), '2027-12-31'::date, 'fim de ano também');
select throws_ok(
  $$ insert into public.guincheiros (id, frota_id, posicao)
     values ('11111111-1111-4111-8111-111111111111', 'f0000000-0000-4000-8000-000000000001',
             extensions.st_setsrid(extensions.st_makepoint(-47.88, -15.79), 4326)) $$,
  '23514', null, 'Cliente não vira Guincheiro: só os papéis guincheiro e representante'
);
select throws_ok(
  $$ insert into public.documentos_guincheiro (guincheiro_id, cnh_numero)
     values ('d2000000-0000-4000-8000-00000000000d', '04512398765') $$,
  '23514', null, 'a CNH vem inteira ou não vem (número sem categoria, validade e EAR)'
);
select throws_ok(
  $$ insert into public.documentos_guincheiro (guincheiro_id, cnh_numero, cnh_categoria, cnh_validade, cnh_ear)
     values ('d2000000-0000-4000-8000-00000000000d', '123', 'B', current_date + 1, true) $$,
  '23514', null, 'o número da CNH tem 11 dígitos'
);

-- ---------------------------------------------------------------------------
-- Ana: o autônomo cria a própria linha de Guincheiro
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "d1000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$ select public.enviar_selfie('d1000000-0000-4000-8000-00000000000a/selfie.jpg') $$,
  'GDG01', null, 'antes de ter a linha de Guincheiro, ninguém envia documento'
);
select lives_ok($$ select public.criar_meu_guincheiro() $$, 'o autônomo cria a própria linha de Guincheiro');
select lives_ok($$ select public.criar_meu_guincheiro() $$, 'chamar de novo não muda nada');
select results_eq(
  $$ select frota_id, disponivel from public.guincheiros $$,
  $$ values ('f2000000-0000-4000-8000-00000000000a'::uuid, false) $$,
  'a linha nasce na Frota dele, indisponível (fora do Match)'
);

-- CNH: cada regra tem o seu erro
select throws_ok(
  $$ select public.enviar_cnh('123', 'C', public.hoje_em_brasilia() + 400, true,
                              'd1000000-0000-4000-8000-00000000000a/cnh.jpg') $$,
  'GDG02', null, 'CNH: número com menos de 11 dígitos'
);
select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'Z', public.hoje_em_brasilia() + 400, true,
                              'd1000000-0000-4000-8000-00000000000a/cnh.jpg') $$,
  'GDG03', null, 'CNH: categoria desconhecida'
);
select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'C', public.hoje_em_brasilia() - 1, true,
                              'd1000000-0000-4000-8000-00000000000a/cnh.jpg') $$,
  'GDG04', null, 'CNH: validade já passou'
);
select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'C', null, true,
                              'd1000000-0000-4000-8000-00000000000a/cnh.jpg') $$,
  'GDG04', null, 'CNH: sem validade'
);
select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'C', public.hoje_em_brasilia() + 400, false,
                              'd1000000-0000-4000-8000-00000000000a/cnh.jpg') $$,
  'GDG05', null, 'CNH: sem a observação EAR'
);
select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'C', public.hoje_em_brasilia() + 400, null,
                              'd1000000-0000-4000-8000-00000000000a/cnh.jpg') $$,
  'GDG05', null, 'CNH: EAR não informada também não passa'
);
select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'C', public.hoje_em_brasilia() + 400, true,
                              'd1000000-0000-4000-8000-00000000000a/falta.jpg') $$,
  'GHM06', null, 'CNH: a foto precisa estar no bucket'
);
select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'C', public.hoje_em_brasilia() + 400, true,
                              'd2000000-0000-4000-8000-00000000000c/cnh.jpg') $$,
  'GHM06', null, 'CNH: e na pasta de quem envia'
);
select is_empty(
  'select * from public.documentos_guincheiro',
  'nenhum envio recusado deixa dados ou item pela metade'
);

-- CNH: envio válido (número com máscara, categoria em minúsculas e com espaço)
select lives_ok(
  $$ select public.enviar_cnh('045.123.987-65', ' c ', public.hoje_em_brasilia() + 400, true,
                              'd1000000-0000-4000-8000-00000000000a/cnh.jpg') $$,
  'a CNH completa é enviada'
);
select results_eq(
  $$ select cnh_numero, cnh_categoria, cnh_validade, cnh_ear from public.documentos_guincheiro $$,
  $$ values ('04512398765', 'C', public.hoje_em_brasilia() + 400, true) $$,
  'número, categoria, validade e EAR ficam em colunas consultáveis, normalizados'
);
select results_eq(
  $$ select estado::text, alvo::text, alvo_id, dono_id, validade from public.itens_homologacao
     where tipo = 'cnh' $$,
  $$ values ('pendente', 'guincheiro', 'd1000000-0000-4000-8000-00000000000a'::uuid,
             'd1000000-0000-4000-8000-00000000000a'::uuid, public.hoje_em_brasilia() + 400) $$,
  'a CNH vira item pendente do Guincheiro, com a mesma validade'
);
select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'C', public.hoje_em_brasilia() + 400, true,
                              'd1000000-0000-4000-8000-00000000000a/cnh2.jpg') $$,
  'GDG06', null, 'CNH pendente não é enviada de novo'
);

-- Antecedentes
select throws_ok(
  $$ select public.enviar_antecedentes(public.hoje_em_brasilia() + 1,
                                       'd1000000-0000-4000-8000-00000000000a/antecedentes.pdf') $$,
  'GDG07', null, 'antecedentes: emissão no futuro'
);
select throws_ok(
  $$ select public.enviar_antecedentes(null, 'd1000000-0000-4000-8000-00000000000a/antecedentes.pdf') $$,
  'GDG07', null, 'antecedentes: sem data de emissão'
);
select throws_ok(
  $$ select public.enviar_antecedentes((public.hoje_em_brasilia() - interval '12 months' - interval '1 day')::date,
                                       'd1000000-0000-4000-8000-00000000000a/antecedentes.pdf') $$,
  'GDG08', null, 'antecedentes: emitida há mais de 12 meses'
);
select throws_ok(
  $$ select public.enviar_antecedentes(public.hoje_em_brasilia() - 10,
                                       'd1000000-0000-4000-8000-00000000000a/falta.pdf') $$,
  'GHM06', null, 'antecedentes: o arquivo precisa estar no bucket'
);
select lives_ok(
  $$ select public.enviar_antecedentes(public.hoje_em_brasilia() - 10,
                                       'd1000000-0000-4000-8000-00000000000a/antecedentes.pdf') $$,
  'a certidão emitida há 10 dias é enviada'
);
select results_eq(
  $$ select i.estado::text, i.validade, d.antecedentes_emissao
     from public.itens_homologacao i, public.documentos_guincheiro d
     where i.tipo = 'antecedentes' $$,
  $$ values ('pendente', public.validade_antecedentes(public.hoje_em_brasilia() - 10),
             public.hoje_em_brasilia() - 10) $$,
  'a validade do item é a emissão + 12 meses, e a emissão fica em coluna'
);

-- Selfie
select throws_ok(
  $$ select public.enviar_selfie('d1000000-0000-4000-8000-00000000000a/falta.jpg') $$,
  'GHM06', null, 'selfie: o arquivo precisa estar no bucket'
);
select throws_ok(
  $$ select public.enviar_selfie('d2000000-0000-4000-8000-00000000000c/selfie.jpg') $$,
  'GHM06', null, 'selfie: nem o arquivo de outra pessoa'
);
select lives_ok(
  $$ select public.enviar_selfie('d1000000-0000-4000-8000-00000000000a/selfie.jpg') $$,
  'a selfie é enviada'
);
select results_eq(
  $$ select estado::text, validade from public.itens_homologacao where tipo = 'selfie' $$,
  $$ values ('pendente', null::date) $$,
  'a selfie vira item pendente, sem validade'
);
select throws_ok(
  $$ select public.enviar_selfie('d1000000-0000-4000-8000-00000000000a/selfie2.jpg') $$,
  'GDG06', null, 'selfie pendente não é enviada de novo'
);

-- O app não escreve direto
select throws_ok(
  $$ insert into public.documentos_guincheiro (guincheiro_id) values ('d1000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'o app não escreve os dados do documento direto'
);
select throws_ok(
  $$ update public.documentos_guincheiro set cnh_categoria = 'E' $$,
  '42501', null, 'nem os altera'
);
select throws_ok(
  $$ select public.registrar_documento_do_guincheiro('selfie', 'd1000000-0000-4000-8000-00000000000a/selfie2.jpg', null) $$,
  '42501', null, 'a função de apoio não é chamada pelo app'
);

-- ---------------------------------------------------------------------------
-- Carla (Guincheiro da empresa): só vê e envia o que é dela
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "d2000000-0000-4000-8000-00000000000c", "role": "authenticated"}';

select throws_ok($$ select public.criar_meu_guincheiro() $$, 'GDG09', null,
  'o Guincheiro de empresa não cria linha de Guincheiro em Frota autônoma');
select is_empty(
  'select * from public.documentos_guincheiro',
  'Carla, sem nada enviado, não vê os documentos de Ana (nem o da CNH do seed)'
);
select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'B', public.hoje_em_brasilia() + 100, true,
                              'd2000000-0000-4000-8000-00000000000c/cnh.jpg') $$,
  '23505', null, 'a mesma CNH não está em duas contas'
);
select is_empty(
  'select * from public.itens_homologacao',
  'o envio recusado pela CNH repetida não deixa item'
);
select lives_ok(
  $$ select public.enviar_cnh('98765432100', 'B', public.hoje_em_brasilia() + 100, true,
                              'd2000000-0000-4000-8000-00000000000c/cnh.jpg') $$,
  'Carla envia a própria CNH'
);
select lives_ok(
  $$ select public.enviar_selfie('d2000000-0000-4000-8000-00000000000c/selfie.jpg') $$,
  'e a própria selfie'
);
select is(
  (select count(*) from public.itens_homologacao), 2::bigint,
  'Carla vê só os próprios itens (CNH e selfie), não os de Ana'
);
select is(
  (select array_agg(guincheiro_id) from public.documentos_guincheiro),
  array['d2000000-0000-4000-8000-00000000000c'::uuid],
  'e só os próprios dados de documento'
);
select is_empty(
  $$ select * from storage.objects where bucket_id = 'documentos-prestadores'
       and split_part(name, '/', 1) = 'd1000000-0000-4000-8000-00000000000a' $$,
  'Carla não lê os arquivos de Ana'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('documentos-prestadores', 'd2000000-0000-4000-8000-00000000000c/outro.jpg',
             'd2000000-0000-4000-8000-00000000000c') $$,
  'Carla envia arquivo na própria pasta'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('documentos-prestadores', 'd2000000-0000-4000-8000-00000000000d/falso.jpg',
             'd2000000-0000-4000-8000-00000000000c') $$,
  '42501', null, 'mas não na pasta de Daniel'
);

-- ---------------------------------------------------------------------------
-- Daniel (mesma Frota) não vê o que Carla enviou
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "d2000000-0000-4000-8000-00000000000d", "role": "authenticated"}';

select is_empty('select * from public.documentos_guincheiro', 'Daniel não vê os dados de Carla');
select is_empty('select * from public.itens_homologacao', 'nem os itens dela');

-- ---------------------------------------------------------------------------
-- Bruno (representante da empresa) e quem não é Guincheiro
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "d1000000-0000-4000-8000-00000000000b", "role": "authenticated"}';

select throws_ok($$ select public.criar_meu_guincheiro() $$, 'GDG09', null,
  'o representante de empresa não vira Guincheiro');
select throws_ok(
  $$ select public.enviar_selfie('d1000000-0000-4000-8000-00000000000b/selfie.jpg') $$,
  'GDG01', null, 'e não envia documento de Guincheiro'
);
select is_empty(
  'select * from public.documentos_guincheiro',
  'o representante não lê a CNH nem a certidão dos Guincheiros da Frota'
);
select is(
  (select count(*) from public.itens_homologacao where alvo = 'guincheiro'), 2::bigint,
  'mas acompanha o estado dos itens deles (#43), sem o conteúdo'
);

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'C', public.hoje_em_brasilia() + 400, true,
                              '11111111-1111-4111-8111-111111111111/cnh.jpg') $$,
  'GDG01', null, 'Cliente não envia CNH'
);
select is_empty('select * from public.documentos_guincheiro', 'e não lê documento de ninguém');

reset role;
set local role anon;
select throws_ok(
  'select * from public.documentos_guincheiro', '42501', null, 'sem login não há leitura'
);
select throws_ok(
  $$ select public.enviar_selfie('x/y.jpg') $$, '42501', null, 'nem envio'
);

-- ---------------------------------------------------------------------------
-- Operação: lê tudo, decide por item
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select is(
  (select count(*) from public.documentos_guincheiro), 3::bigint,
  'a operação lê os dados de todos (Ana, Carla e a CNH do Paulo no seed)'
);
select is(
  (select count(*) from public.itens_homologacao
   where alvo = 'guincheiro' and estado = 'pendente'
     and alvo_id in ('d1000000-0000-4000-8000-00000000000a', 'd2000000-0000-4000-8000-00000000000c')),
  5::bigint, 'e vê os cinco itens pendentes dos dois Guincheiros'
);
select lives_ok(
  $$ select public.decidir_item_homologacao(i.id, 'aprovado') from public.itens_homologacao i
     where i.tipo = 'cnh' and i.alvo_id = 'd1000000-0000-4000-8000-00000000000a' $$,
  'aprova a CNH de Ana'
);
select lives_ok(
  $$ select public.decidir_item_homologacao(i.id, 'recusado', 'Foto desfocada') from public.itens_homologacao i
     where i.tipo = 'selfie' and i.alvo_id = 'd1000000-0000-4000-8000-00000000000a' $$,
  'recusa a selfie de Ana com motivo'
);
select lives_ok(
  $$ select public.decidir_item_homologacao(i.id, 'recusado', 'Falta a certidão da PF') from public.itens_homologacao i
     where i.tipo = 'antecedentes' and i.alvo_id = 'd1000000-0000-4000-8000-00000000000a' $$,
  'recusa os antecedentes de Ana com motivo'
);
select throws_ok(
  $$ select public.decidir_item_homologacao(i.id, 'recusado') from public.itens_homologacao i
     where i.tipo = 'cnh' and i.alvo_id = 'd2000000-0000-4000-8000-00000000000c' $$,
  'GHM04', null, 'recusar a CNH de Carla sem motivo é rejeitado'
);

-- ---------------------------------------------------------------------------
-- Ana reenvia o recusado; aprovado não se reenvia; vencido, sim
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "d1000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select results_eq(
  $$ select tipo::text, estado::text, motivo from public.itens_homologacao
     where tipo in ('selfie', 'antecedentes') order by tipo $$,
  $$ values ('antecedentes', 'recusado', 'Falta a certidão da PF'),
            ('selfie', 'recusado', 'Foto desfocada') $$,
  'Ana vê o estado e o motivo de cada recusa'
);
select lives_ok(
  $$ select public.enviar_selfie('d1000000-0000-4000-8000-00000000000a/selfie2.jpg') $$,
  'Ana reenvia a selfie recusada'
);
select results_eq(
  $$ select estado::text, motivo, arquivo from public.itens_homologacao where tipo = 'selfie' $$,
  $$ values ('pendente', null::text, 'd1000000-0000-4000-8000-00000000000a/selfie2.jpg') $$,
  'o mesmo item volta a pendente, sem motivo, com o arquivo novo'
);
select lives_ok(
  $$ select public.enviar_antecedentes(public.hoje_em_brasilia() - 1,
                                       'd1000000-0000-4000-8000-00000000000a/antecedentes2.pdf') $$,
  'Ana reenvia a certidão com a emissão nova'
);
select results_eq(
  $$ select d.antecedentes_emissao, i.validade, i.estado::text
     from public.itens_homologacao i, public.documentos_guincheiro d where i.tipo = 'antecedentes' $$,
  $$ values (public.hoje_em_brasilia() - 1, public.validade_antecedentes(public.hoje_em_brasilia() - 1), 'pendente') $$,
  'a emissão e a validade acompanham o reenvio'
);
select throws_ok(
  $$ select public.enviar_cnh('04512398765', 'C', public.hoje_em_brasilia() + 500, true,
                              'd1000000-0000-4000-8000-00000000000a/cnh2.jpg') $$,
  'GDG06', null, 'CNH aprovada não é substituída'
);

reset role;
-- A validade passou e o job marcou o item como vencido.
update public.itens_homologacao set estado = 'vencido'
where tipo = 'cnh' and alvo_id = 'd1000000-0000-4000-8000-00000000000a';
set local role authenticated;
set local request.jwt.claims to '{"sub": "d1000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$ select public.enviar_cnh('04512398765', 'D', public.hoje_em_brasilia() + 900, true,
                              'd1000000-0000-4000-8000-00000000000a/cnh2.jpg') $$,
  'a CNH vencida é reenviada com os dados novos'
);
select results_eq(
  $$ select i.estado::text, i.validade, d.cnh_categoria, d.cnh_validade
     from public.itens_homologacao i, public.documentos_guincheiro d where i.tipo = 'cnh' $$,
  $$ values ('pendente', public.hoje_em_brasilia() + 900, 'D', public.hoje_em_brasilia() + 900) $$,
  'item e colunas mostram a categoria e a validade novas'
);

-- ---------------------------------------------------------------------------
-- Trilha de auditoria (só a operação lê)
-- ---------------------------------------------------------------------------
reset role;
select results_eq(
  $$ select a.de::text, a.para::text from public.auditoria_homologacao a
     join public.itens_homologacao i on i.id = a.item_id
     where i.tipo = 'selfie' and i.alvo_id = 'd1000000-0000-4000-8000-00000000000a' order by a.id $$,
  $$ values (null::text, 'pendente'), ('pendente', 'recusado'), ('recusado', 'pendente') $$,
  'a selfie de Ana tem na trilha o envio, a recusa e o reenvio'
);
select is(
  (select count(*) from public.itens_homologacao where alvo_id = 'd1000000-0000-4000-8000-00000000000a'),
  3::bigint, 'reenviar não cria item novo: um por documento'
);
select is(
  (select count(*) from public.itens_homologacao where alvo_id = 'd2000000-0000-4000-8000-00000000000c'),
  2::bigint, 'Carla tem os dois itens que enviou'
);
select is(
  (select cnh_ear from public.documentos_guincheiro where guincheiro_id = 'd2000000-0000-4000-8000-00000000000c'),
  true, 'a EAR de Carla está na coluna'
);
select is(
  (select cnh_categoria from public.documentos_guincheiro
   where guincheiro_id = '22222222-2222-4222-8222-222222222204'),
  'C', 'o seed tem a CNH do Paulo em colunas, como o Painel mostra'
);
select is(
  (select public.categoria_cnh_cobre_pbt(cnh_categoria, 8000) from public.documentos_guincheiro
   where guincheiro_id = 'd1000000-0000-4000-8000-00000000000a'),
  true, 'a regra CNH × PBT (#40) lê a categoria direto da coluna: D cobre 8.000 kg'
);

select * from finish();
rollback;
