-- Cadastro de Frota autônoma pelo app do Guincheiro (issue #43, ADR-0012, ADR-0007).
--
-- Fluxo: quem não tem perfil entra por telefone + código, preenche o cadastro por etapas (o
-- rascunho fica no banco, `rascunhos_frota`), envia os documentos ao bucket
-- `documentos-prestadores` e chama `enviar_cadastro_frota()`. O envio, numa transação, cria o
-- perfil de representante, a Frota com `ativa = false` e um item `pendente` por documento
-- (alvará e apólice), que cai na fila de homologação do Painel (#42). A ativação da Frota
-- continua sendo do ticket de elegibilidade: nada aqui escreve `frotas.ativa`.
--
-- Erros do envio (errcode): GCF01 sem cadastro em andamento, GCF02 documento da Frota inválido,
-- GCF03 CPF do representante inválido (ou diferente do documento, no autônomo de CPF), GCF04
-- dado obrigatório ausente ou inválido, GCF05 apólice sem validade, vencida ou a vencer em menos
-- de 30 dias, GCF06 quem não pode cadastrar Frota, GCF07 termos de prestador não aceitos.

-- ---------------------------------------------------------------------------
-- Frotas: os campos do ADR-0012
-- ---------------------------------------------------------------------------

-- Nulos nas Frotas do seed, que antecedem o cadastro (o check abaixo exige o grupo inteiro
-- ou nada). O representante é o perfil que cadastrou e gere a Frota; nome, CPF e telefone dele
-- estão em `perfis`.
alter table public.frotas
  add column representante_id uuid unique references public.perfis (id)
    check (representante_id is null or public.perfil_tem_papel(representante_id, 'representante')),
  add column base_cep text check (base_cep ~ '^\d{8}$'),
  add column base_endereco text check (length(trim(base_endereco)) > 0),
  add column base_bairro text check (length(trim(base_bairro)) > 0),
  -- Para o repasse, até o PSP do Incremento 2 (ADR-0012). Qualquer tipo de chave.
  add column chave_pix text check (length(trim(chave_pix)) between 1 and 77),
  -- Validade da apólice de RC por avaria (ADR-0007). A fonte é o item de homologação da
  -- apólice: um trigger copia a validade para cá a cada envio ou reenvio.
  add column apolice_validade date,
  add column termos_prestador_versao text check (length(trim(termos_prestador_versao)) > 0),
  -- Hora do servidor (trigger abaixo), no padrão de `perfis.aceite_termos_em`.
  add column termos_prestador_em timestamptz,
  add constraint frotas_cadastro_completo check (
    num_nonnulls(
      representante_id, base_cep, base_endereco, base_bairro, chave_pix,
      termos_prestador_versao, termos_prestador_em
    ) in (0, 7)
  );

create function public.frotas_aceite_termos_prestador_na_hora_do_servidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.termos_prestador_versao is distinct from old.termos_prestador_versao then
    new.termos_prestador_em := case when new.termos_prestador_versao is not null then now() end;
  else
    new.termos_prestador_em := old.termos_prestador_em;
  end if;
  return new;
end;
$$;

create trigger frotas_aceite_termos_prestador_na_hora_do_servidor
before insert or update on public.frotas
for each row execute function public.frotas_aceite_termos_prestador_na_hora_do_servidor();

-- A validade da apólice da Frota é a do item de homologação (envio e reenvio).
create function public.sincronizar_apolice_validade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.alvo = 'frota' and new.tipo = 'apolice_rc' and new.validade is not null then
    update public.frotas f
    set apolice_validade = new.validade
    where f.id = new.alvo_id and f.apolice_validade is distinct from new.validade;
  end if;
  return null;
end;
$$;

create trigger itens_homologacao_sincronizar_apolice
after insert or update of validade on public.itens_homologacao
for each row execute function public.sincronizar_apolice_validade();

-- ---------------------------------------------------------------------------
-- Funções de apoio das políticas (security definer, para não recursar entre políticas)
-- ---------------------------------------------------------------------------

create function public.sou_representante_da_frota(frota uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.frotas f
    where f.id = frota and f.representante_id = (select auth.uid())
  );
$$;

-- Abre rascunho (e envia o cadastro) quem entrou por telefone e ainda não é prestador:
-- sem perfil, ou representante que ainda não tem Frota. Cliente, Guincheiro e operação não.
create function public.pode_cadastrar_frota()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not exists (
      select 1 from public.perfis p
      where p.id = (select auth.uid()) and p.papel <> 'representante'
    )
    and not exists (
      select 1 from public.frotas f where f.representante_id = (select auth.uid())
    );
$$;

-- ---------------------------------------------------------------------------
-- Rascunho do cadastro (no banco, para retomar em outro aparelho)
-- ---------------------------------------------------------------------------

create table public.rascunhos_frota (
  usuario_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  tipo public.tipo_frota not null default 'autonomo',
  -- Etapa em que a pessoa parou: 1 dados, 2 endereço, 3 documentos, 4 Pix, 5 termos.
  etapa smallint not null default 1 check (etapa between 1 and 5),
  -- Campos do formulário, todos opcionais até o envio, que valida tudo:
  -- documento, nome, representante_nome, representante_cpf, base_cep, base_endereco,
  -- base_bairro, chave_pix, apolice_validade, termos_versao, alvara_arquivo, apolice_arquivo.
  dados jsonb not null default '{}'
    check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) <= 8192),
  atualizado_em timestamptz not null default now()
);

create trigger rascunhos_frota_atualizado_em
before update on public.rascunhos_frota
for each row execute function public.definir_atualizado_em();

comment on table public.rascunhos_frota is
  'Cadastro de Frota em andamento, de quem ainda não é prestador; some no envio.';

-- Pasta de documentos: Guincheiro, representante, ou quem está cadastrando a Frota (sem perfil
-- ainda, mas com rascunho aberto).
create function public.pode_enviar_documento_de_prestador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.perfis p
      where p.id = (select auth.uid()) and p.papel in ('guincheiro', 'representante')
    )
    or (
      not exists (select 1 from public.perfis p where p.id = (select auth.uid()))
      and exists (select 1 from public.rascunhos_frota r where r.usuario_id = (select auth.uid()))
    );
$$;

revoke all on public.rascunhos_frota from anon, authenticated;
grant select, delete on public.rascunhos_frota to authenticated;
grant insert (tipo, etapa, dados) on public.rascunhos_frota to authenticated;
grant update (tipo, etapa, dados) on public.rascunhos_frota to authenticated;

alter table public.rascunhos_frota enable row level security;

create policy "rascunhos_frota: cada um lê o seu"
on public.rascunhos_frota for select to authenticated
using (usuario_id = (select auth.uid()));

create policy "rascunhos_frota: quem ainda não é prestador abre o seu"
on public.rascunhos_frota for insert to authenticated
with check (usuario_id = (select auth.uid()) and (select public.pode_cadastrar_frota()));

create policy "rascunhos_frota: edita o seu"
on public.rascunhos_frota for update to authenticated
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()) and (select public.pode_cadastrar_frota()));

create policy "rascunhos_frota: apaga o seu"
on public.rascunhos_frota for delete to authenticated
using (usuario_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS de Frotas, itens e bucket: o representante entra
-- ---------------------------------------------------------------------------

drop policy "frotas: o Guincheiro lê a própria Frota; a operação lê todas" on public.frotas;
create policy "frotas: o representante e o Guincheiro leem a própria Frota; a operação lê todas"
on public.frotas for select to authenticated
using (
  (select public.eh_operacao())
  or representante_id = (select auth.uid())
  or id = (select g.frota_id from public.guincheiros g where g.id = (select auth.uid()))
);

-- O representante edita o que o cadastro pediu, enquanto a Frota não está ativa (pendente ou
-- recusada na homologação). Documento, representante, apólice, termos e `ativa` ficam de fora:
-- sem GRANT de coluna, o app não os escreve.
grant update (nome, base_cep, base_endereco, base_bairro, chave_pix) on public.frotas to authenticated;

create policy "frotas: o representante edita a própria Frota enquanto não está ativa"
on public.frotas for update to authenticated
using (representante_id = (select auth.uid()) and not ativa)
with check (representante_id = (select auth.uid()) and not ativa);

drop policy "itens_homologacao: o dono lê os seus; a operação lê todos" on public.itens_homologacao;
create policy "itens_homologacao: o dono e o representante leem; a operação lê todos"
on public.itens_homologacao for select to authenticated
using (
  dono_id = (select auth.uid())
  or (select public.sou_representante_da_frota(frota_id))
  or (select public.eh_operacao())
);

drop policy "documentos-prestadores: o Guincheiro envia na própria pasta" on storage.objects;
create policy "documentos-prestadores: quem presta serviço envia na própria pasta"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos-prestadores'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and (select public.pode_enviar_documento_de_prestador())
);

-- ---------------------------------------------------------------------------
-- Itens de Frota: o dono passa a ser o representante
-- ---------------------------------------------------------------------------

-- O representante envia os itens da Frota e dos veículos; o Guincheiro, os dele e os dos
-- veículos. Reenvia quem enviou, ou o representante (que passa a ser o dono do item).
create or replace function public.enviar_item_homologacao(
  alvo public.alvo_homologacao,
  alvo_id uuid,
  tipo public.tipo_item_homologacao,
  arquivo text,
  validade date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  frota uuid;
  sou_representante boolean;
  novo uuid;
begin
  select f.id into frota from public.frotas f where f.representante_id = eu;
  sou_representante := frota is not null;
  if frota is null then
    select g.frota_id into frota from public.guincheiros g where g.id = eu;
  end if;
  if frota is null then
    raise exception 'Só o representante ou o Guincheiro de uma Frota envia itens'
      using errcode = '42501';
  end if;
  if alvo = 'frota' and alvo_id is distinct from frota then
    raise exception 'O item de Frota é da própria Frota' using errcode = 'GHM07';
  end if;
  if alvo = 'frota' and not sou_representante then
    raise exception 'Só o representante envia itens da Frota' using errcode = '42501';
  end if;
  if alvo = 'guincheiro' and not exists (
    select 1 from public.guincheiros g where g.id = alvo_id and g.frota_id = frota
  ) then
    raise exception 'O Guincheiro do item precisa ser da própria Frota' using errcode = 'GHM07';
  end if;
  if validade < public.hoje_em_brasilia() then
    raise exception 'A validade já passou' using errcode = 'GHM05';
  end if;
  perform public.conferir_arquivo_homologacao(eu, arquivo);

  insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo, validade)
  values (frota, alvo, alvo_id, tipo, eu, arquivo, validade)
  returning id into novo;
  return novo;
end;
$$;

create or replace function public.reenviar_item_homologacao(
  item_id uuid,
  arquivo text,
  validade date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  atual public.estado_homologacao;
begin
  select i.estado into atual
  from public.itens_homologacao i
  where i.id = reenviar_item_homologacao.item_id
    and (
      i.dono_id = eu
      or (i.alvo <> 'guincheiro' and public.sou_representante_da_frota(i.frota_id))
    )
  for update;
  if not found then
    raise exception 'Item não encontrado' using errcode = 'P0002';
  end if;
  if not public.transicao_homologacao_valida(atual, 'pendente') then
    raise exception 'Só se reenvia item recusado ou vencido, não %', atual using errcode = 'GHM03';
  end if;
  if validade < public.hoje_em_brasilia() then
    raise exception 'A validade já passou' using errcode = 'GHM05';
  end if;
  perform public.conferir_arquivo_homologacao(eu, arquivo);

  update public.itens_homologacao i
  set estado = 'pendente', arquivo = reenviar_item_homologacao.arquivo,
      validade = reenviar_item_homologacao.validade, motivo = null,
      enviado_em = now(), decidido_em = null, decidido_por = null, dono_id = eu
  where i.id = reenviar_item_homologacao.item_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Envio do cadastro
-- ---------------------------------------------------------------------------

-- A apólice precisa valer por 30 dias ou mais na data do envio, em Brasília (ADR-0007: sem
-- apólice vigente não há Frota; a folga evita aprovar o que vence antes da operação ativar).
create function public.apolice_validade_aceitavel(validade date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select validade >= public.hoje_em_brasilia() + 30;
$$;

create function public.enviar_cadastro_frota()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  telefone text := (select auth.jwt() ->> 'phone');
  r public.rascunhos_frota;
  d jsonb;
  doc text;
  nome_frota text;
  rep_nome text;
  rep_cpf text;
  cep text;
  endereco text;
  bairro text;
  pix text;
  termos text;
  validade date;
  alvara text;
  apolice text;
  nova uuid;
begin
  select * into r from public.rascunhos_frota where usuario_id = eu for update;
  if not found then
    raise exception 'Nenhum cadastro de Frota em andamento' using errcode = 'GCF01';
  end if;
  if not public.pode_cadastrar_frota() or telefone is null then
    raise exception 'Este número não pode cadastrar uma Frota' using errcode = 'GCF06';
  end if;

  d := r.dados;
  doc := trim(d ->> 'documento');
  nome_frota := trim(d ->> 'nome');
  rep_nome := trim(d ->> 'representante_nome');
  rep_cpf := trim(d ->> 'representante_cpf');
  cep := trim(d ->> 'base_cep');
  endereco := trim(d ->> 'base_endereco');
  bairro := trim(d ->> 'base_bairro');
  pix := trim(d ->> 'chave_pix');
  termos := trim(d ->> 'termos_versao');
  alvara := d ->> 'alvara_arquivo';
  apolice := d ->> 'apolice_arquivo';

  if not coalesce(
    case r.tipo
      when 'empresa' then public.cnpj_valido(doc)
      else public.cpf_valido(doc) or public.cnpj_valido(doc)
    end, false
  ) then
    raise exception 'Documento da Frota inválido' using errcode = 'GCF02';
  end if;
  if not coalesce(public.cpf_valido(rep_cpf), false) then
    raise exception 'CPF do representante inválido' using errcode = 'GCF03';
  end if;
  -- Autônomo de CPF: a Frota é a própria pessoa.
  if r.tipo = 'autonomo' and public.cpf_valido(doc) and rep_cpf <> doc then
    raise exception 'No autônomo de CPF, o representante é o dono do documento'
      using errcode = 'GCF03';
  end if;
  if length(coalesce(nome_frota, '')) = 0 or length(coalesce(rep_nome, '')) = 0 then
    raise exception 'Informe o nome da Frota e do representante' using errcode = 'GCF04';
  end if;
  if cep is null or cep !~ '^\d{8}$'
    or length(coalesce(endereco, '')) = 0 or length(coalesce(bairro, '')) = 0 then
    raise exception 'Endereço da base incompleto' using errcode = 'GCF04';
  end if;
  if length(coalesce(pix, '')) not between 1 and 77 then
    raise exception 'Informe a chave Pix' using errcode = 'GCF04';
  end if;
  if length(coalesce(termos, '')) = 0 then
    raise exception 'É preciso aceitar os termos para prestadores' using errcode = 'GCF07';
  end if;

  begin
    validade := (d ->> 'apolice_validade')::date;
  exception when others then
    validade := null;
  end;
  if validade is null or not public.apolice_validade_aceitavel(validade) then
    raise exception 'A apólice precisa valer por pelo menos 30 dias' using errcode = 'GCF05';
  end if;

  perform public.conferir_arquivo_homologacao(eu, coalesce(alvara, ''));
  perform public.conferir_arquivo_homologacao(eu, coalesce(apolice, ''));

  -- Quem já é representante (sem Frota) mantém o perfil. O aceite dos termos de uso do perfil
  -- novo é o dos termos para prestadores aceitos aqui.
  if not exists (select 1 from public.perfis p where p.id = eu) then
    insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
    values (eu, 'representante', rep_nome, telefone, rep_cpf, termos);
  end if;

  insert into public.frotas (
    tipo, documento, nome, representante_id, base_cep, base_endereco, base_bairro, chave_pix,
    apolice_validade, termos_prestador_versao
  ) values (
    r.tipo, doc, nome_frota, eu, cep, endereco, bairro, pix, validade, termos
  ) returning id into nova;

  insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo, validade)
  values
    (nova, 'frota', nova, 'alvara', eu, alvara, null),
    (nova, 'frota', nova, 'apolice_rc', eu, apolice, validade);

  delete from public.rascunhos_frota where usuario_id = eu;
  return nova;
end;
$$;

comment on function public.enviar_cadastro_frota is
  'Envia o rascunho: cria o perfil de representante, a Frota inativa e os itens pendentes (alvará, apólice).';

revoke execute on function
  public.enviar_cadastro_frota, public.sou_representante_da_frota, public.pode_cadastrar_frota,
  public.pode_enviar_documento_de_prestador, public.apolice_validade_aceitavel
from public, anon;
grant execute on function
  public.enviar_cadastro_frota, public.sou_representante_da_frota, public.pode_cadastrar_frota,
  public.pode_enviar_documento_de_prestador, public.apolice_validade_aceitavel
to authenticated;
