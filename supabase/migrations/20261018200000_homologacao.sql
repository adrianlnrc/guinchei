-- Homologação por item (issue #42, ADR-0012, RN03 / invariante 3).
--
-- Um item de homologação é um documento ou dado a verificar de uma Frota, de um Guincheiro
-- ou de um veículo. Só a operação decide; cada mudança de estado grava uma linha imutável na
-- trilha de auditoria. Esta migração só decide itens: ativar a Frota é do ticket de
-- elegibilidade.
--
-- Estados e transições:
--   pendente  -> aprovado | recusado      (operação, `decidir_item_homologacao`)
--   aprovado  -> vencido                  (`marcar_itens_vencidos`, quando a validade passa)
--   recusado  -> pendente                 (o dono reenvia, `reenviar_item_homologacao`)
--   vencido   -> pendente                 (idem: vencido não se aprova sem reenvio)
--
-- Erros (errcode): GHM03 transição inválida, GHM04 recusa sem motivo, GHM05 validade já
-- vencida, GHM06 arquivo que não está no bucket, GHM07 alvo inválido. Item inexistente é
-- P0002; quem não pode agir recebe 42501.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.estado_homologacao as enum ('pendente', 'aprovado', 'recusado', 'vencido');

-- O que o item verifica: a Frota, um Guincheiro dela ou um veículo (ainda sem tabela própria).
create type public.alvo_homologacao as enum ('frota', 'guincheiro', 'veiculo');

-- Documentos e dados do ADR-0012.
create type public.tipo_item_homologacao as enum (
  'alvara', 'apolice_rc', 'crlv', 'foto_veiculo', 'cnh', 'antecedentes', 'selfie'
);

-- ---------------------------------------------------------------------------
-- Itens
-- ---------------------------------------------------------------------------

create table public.itens_homologacao (
  id uuid primary key default gen_random_uuid(),
  frota_id uuid not null references public.frotas (id),
  alvo public.alvo_homologacao not null,
  -- Frota: o id da Frota. Guincheiro: o id do Guincheiro. Veículo: id futuro, sem FK.
  alvo_id uuid not null,
  tipo public.tipo_item_homologacao not null,
  -- Quem enviou e pode reenviar; também é a pasta do arquivo no bucket.
  dono_id uuid not null references public.perfis (id),
  -- Caminho no bucket `documentos-prestadores`: "<dono_id>/<arquivo>".
  arquivo text not null,
  -- Último dia de validade (apólice, CNH, certidão), quando houver.
  validade date,
  estado public.estado_homologacao not null default 'pendente',
  -- Motivo da última recusa; some no reenvio (a trilha guarda o histórico).
  motivo text,
  -- Ordem da fila: quando o item entrou (ou voltou) como pendente.
  enviado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint itens_homologacao_arquivo_na_pasta_do_dono check (
    arquivo like dono_id::text || '/_%'
  ),
  constraint itens_homologacao_recusa_tem_motivo check (
    estado <> 'recusado' or length(trim(coalesce(motivo, ''))) > 0
  ),
  constraint itens_homologacao_frota_e_o_alvo check (alvo <> 'frota' or alvo_id = frota_id),
  -- Um item por documento de cada alvo: refazer é reenviar, não criar outro.
  constraint itens_homologacao_um_por_tipo unique (alvo, alvo_id, tipo)
);

create index itens_homologacao_fila_idx
  on public.itens_homologacao (enviado_em) where estado = 'pendente';
create index itens_homologacao_frota_id_idx on public.itens_homologacao (frota_id);
create index itens_homologacao_dono_id_idx on public.itens_homologacao (dono_id);

create trigger itens_homologacao_atualizado_em
before update on public.itens_homologacao
for each row execute function public.definir_atualizado_em();

comment on table public.itens_homologacao is
  'Documentos e dados de Frota, Guincheiro e veículo que a operação homologa (ADR-0012).';

-- ---------------------------------------------------------------------------
-- Transições
-- ---------------------------------------------------------------------------

create function public.transicao_homologacao_valida(
  de public.estado_homologacao,
  para public.estado_homologacao
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (de, para) in (
    ('pendente', 'aprovado'),
    ('pendente', 'recusado'),
    ('aprovado', 'vencido'),
    ('recusado', 'pendente'),
    ('vencido', 'pendente')
  );
$$;

-- Vale para qualquer papel, inclusive service_role: o item nasce pendente e só muda de
-- estado por uma transição da tabela.
create function public.reforcar_transicao_homologacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'pendente' then
      raise exception 'Item de homologação nasce pendente, não %', new.estado
        using errcode = 'GHM03';
    end if;
  elsif new.estado is distinct from old.estado
    and not public.transicao_homologacao_valida(old.estado, new.estado) then
    raise exception 'Item de homologação não pode ir de % para %', old.estado, new.estado
      using errcode = 'GHM03';
  end if;
  return new;
end;
$$;

create trigger itens_homologacao_reforcar_transicao
before insert or update of estado on public.itens_homologacao
for each row execute function public.reforcar_transicao_homologacao();

-- ---------------------------------------------------------------------------
-- Trilha de auditoria (imutável)
-- ---------------------------------------------------------------------------

create table public.auditoria_homologacao (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.itens_homologacao (id),
  -- Nulo na entrada do item (envio).
  de public.estado_homologacao,
  para public.estado_homologacao not null,
  motivo text,
  -- Quem agiu; nulo quando foi o sistema (item vencido pelo job).
  por uuid references public.perfis (id),
  -- Hora do servidor, sempre.
  em timestamptz not null default now()
);

create index auditoria_homologacao_item_id_idx on public.auditoria_homologacao (item_id, id);

comment on table public.auditoria_homologacao is
  'Quem mudou o estado de cada item, quando (hora do servidor), de qual para qual, e o motivo. Só trigger escreve; ninguém atualiza ou apaga.';

create function public.auditar_homologacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.auditoria_homologacao (item_id, de, para, por)
    values (new.id, null, new.estado, (select auth.uid()));
  elsif new.estado is distinct from old.estado then
    insert into public.auditoria_homologacao (item_id, de, para, motivo, por)
    values (
      new.id, old.estado, new.estado,
      case new.estado
        when 'recusado' then new.motivo
        when 'vencido' then 'Validade vencida em ' || to_char(new.validade, 'DD/MM/YYYY')
      end,
      (select auth.uid())
    );
  end if;
  return null;
end;
$$;

create trigger itens_homologacao_auditar
after insert or update of estado on public.itens_homologacao
for each row execute function public.auditar_homologacao();

create function public.auditoria_homologacao_imutavel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A trilha de auditoria da homologação não pode ser alterada ou apagada'
    using errcode = 'check_violation';
end;
$$;

create trigger auditoria_homologacao_sem_alterar
before update or delete on public.auditoria_homologacao
for each row execute function public.auditoria_homologacao_imutavel();

create trigger auditoria_homologacao_sem_truncar
before truncate on public.auditoria_homologacao
for each statement execute function public.auditoria_homologacao_imutavel();

-- ---------------------------------------------------------------------------
-- GRANTs e RLS: leitura pelo dono e pela operação; ninguém escreve direto
-- ---------------------------------------------------------------------------

revoke all on public.itens_homologacao, public.auditoria_homologacao from anon, authenticated;
grant select on public.itens_homologacao, public.auditoria_homologacao to authenticated;

alter table public.itens_homologacao enable row level security;
alter table public.auditoria_homologacao enable row level security;

create policy "itens_homologacao: o dono lê os seus; a operação lê todos"
on public.itens_homologacao for select to authenticated
using (dono_id = (select auth.uid()) or (select public.eh_operacao()));

create policy "auditoria_homologacao: só a operação lê"
on public.auditoria_homologacao for select to authenticated
using ((select public.eh_operacao()));

-- ---------------------------------------------------------------------------
-- Bucket privado de documentos de prestadores
-- ---------------------------------------------------------------------------

-- Objetos em "<dono_id>/<arquivo>". O dono (um Guincheiro) lê e envia; a operação lê tudo;
-- mais ninguém. Sem update nem delete pela API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-prestadores',
  'documentos-prestadores',
  false,
  10485760, -- 10 MiB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

create policy "documentos-prestadores: o dono lê; a operação lê tudo"
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos-prestadores'
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or (select public.eh_operacao())
  )
);

create policy "documentos-prestadores: o Guincheiro envia na própria pasta"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos-prestadores'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and public.perfil_tem_papel((select auth.uid()), 'guincheiro')
);

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- Hoje, em Brasília: a validade vale até o fim desse dia.
create function public.hoje_em_brasilia()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- O arquivo precisa estar no bucket, na pasta de quem envia.
create function public.conferir_arquivo_homologacao(dono uuid, arquivo text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if arquivo not like dono::text || '/_%' or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'documentos-prestadores' and o.name = arquivo
  ) then
    raise exception 'O arquivo não foi enviado ao bucket de documentos' using errcode = 'GHM06';
  end if;
end;
$$;

revoke execute on function public.conferir_arquivo_homologacao from public, anon, authenticated;

-- O Guincheiro envia um item novo (de si, da própria Frota ou de um veículo).
create function public.enviar_item_homologacao(
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
  novo uuid;
begin
  select g.frota_id into frota from public.guincheiros g where g.id = eu;
  if frota is null then
    raise exception 'Só o Guincheiro de uma Frota envia itens' using errcode = '42501';
  end if;
  if alvo = 'frota' and alvo_id is distinct from frota then
    raise exception 'O item de Frota é da própria Frota' using errcode = 'GHM07';
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

comment on function public.enviar_item_homologacao is
  'O Guincheiro envia um documento novo; nasce pendente. Quem envia é o dono do item.';

-- O dono reenvia um item recusado ou vencido: volta para a fila como pendente.
create function public.reenviar_item_homologacao(
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
  where i.id = reenviar_item_homologacao.item_id and i.dono_id = eu
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
      enviado_em = now(), decidido_em = null, decidido_por = null
  where i.id = reenviar_item_homologacao.item_id;
end;
$$;

comment on function public.reenviar_item_homologacao is
  'O dono reenvia item recusado ou vencido; volta a pendente e à fila.';

-- A operação aprova ou recusa um item pendente. Recusar exige motivo.
create function public.decidir_item_homologacao(
  item_id uuid,
  decisao public.estado_homologacao,
  motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  atual public.estado_homologacao;
  validade_do_item date;
begin
  if not (select public.eh_operacao()) then
    raise exception 'Só a operação decide itens de homologação' using errcode = '42501';
  end if;

  select i.estado, i.validade into atual, validade_do_item
  from public.itens_homologacao i
  where i.id = decidir_item_homologacao.item_id
  for update;
  if not found then
    raise exception 'Item não encontrado' using errcode = 'P0002';
  end if;

  if decisao not in ('aprovado', 'recusado')
    or not public.transicao_homologacao_valida(atual, decisao) then
    raise exception 'Item % não pode ir para %', atual, decisao using errcode = 'GHM03';
  end if;
  if decisao = 'recusado' and length(trim(coalesce(motivo, ''))) = 0 then
    raise exception 'Recusar exige o motivo' using errcode = 'GHM04';
  end if;
  if decisao = 'aprovado' and validade_do_item < public.hoje_em_brasilia() then
    raise exception 'A validade do documento já passou' using errcode = 'GHM05';
  end if;

  update public.itens_homologacao i
  set estado = decisao,
      motivo = case decisao when 'recusado' then trim(decidir_item_homologacao.motivo) end,
      decidido_em = now(),
      decidido_por = (select auth.uid())
  where i.id = decidir_item_homologacao.item_id;
end;
$$;

comment on function public.decidir_item_homologacao is
  'Só a operação: pendente vira aprovado ou recusado (com motivo). Grava a auditoria por trigger.';

-- Itens aprovados cuja validade passou viram `vencido`. Devolve quantos.
create function public.marcar_itens_vencidos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  update public.itens_homologacao i
  set estado = 'vencido'
  where i.estado = 'aprovado' and i.validade < public.hoje_em_brasilia();
  get diagnostics total = row_count;
  return total;
end;
$$;

comment on function public.marcar_itens_vencidos is
  'Marca como vencido o item aprovado com validade passada. Roda no job diário e pelo service_role.';

revoke execute on function
  public.enviar_item_homologacao, public.reenviar_item_homologacao,
  public.decidir_item_homologacao, public.marcar_itens_vencidos
from public, anon, authenticated;
grant execute on function
  public.enviar_item_homologacao, public.reenviar_item_homologacao,
  public.decidir_item_homologacao
to authenticated;
grant execute on function public.marcar_itens_vencidos to service_role;

-- 00:05 em Brasília (03:05 UTC): quem venceu ontem deixa de valer hoje.
select cron.schedule('homologacao-vencer', '5 3 * * *', 'select public.marcar_itens_vencidos()');
