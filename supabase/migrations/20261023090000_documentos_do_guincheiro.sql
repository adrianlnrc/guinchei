-- Documentos do Guincheiro: CNH, antecedentes e selfie (issue #47, ADR-0012).
--
-- Depois de entrar (convidado, #46, ou o autônomo que é o próprio Guincheiro, #43), o Guincheiro
-- envia a CNH (número, categoria, validade, EAR e foto), a certidão de antecedentes (PCDF e PF,
-- com a data de emissão; vale 12 meses) e a selfie. Cada documento vira um item `pendente` de
-- homologação do Guincheiro (#42), que a operação aprova ou recusa no Painel; o Guincheiro
-- recusado ou vencido reenvia pela mesma função.
--
-- Os dados que a regra CNH × PBT (#40) e o alerta de vencimento consultam ficam em colunas de
-- `documentos_guincheiro`, não só na foto. O arquivo, a validade e o estado continuam no item
-- de homologação, que é a fonte da fila. O app não escreve nas tabelas: só chama as funções.
--
-- Erros (errcode):
--   GDG01  quem chama não é Guincheiro (não tem linha em `guincheiros`)
--   GDG02  número da CNH inválido (11 dígitos)
--   GDG03  categoria da CNH desconhecida
--   GDG04  CNH sem validade ou vencida
--   GDG05  CNH sem a observação EAR
--   GDG06  o documento já foi enviado e está pendente ou aprovado (só recusado/vencido reenvia)
--   GDG07  data de emissão da certidão ausente ou no futuro
--   GDG08  certidão emitida há mais de 12 meses
--   GDG09  só o representante de uma Frota autônoma vira Guincheiro da própria Frota
-- Arquivo que não chegou ao bucket é GHM06; CNH já usada por outro Guincheiro é 23505.

-- ---------------------------------------------------------------------------
-- O autônomo é representante e Guincheiro da mesma conta (ADR-0012)
-- ---------------------------------------------------------------------------

alter table public.guincheiros drop constraint guincheiros_id_check;
alter table public.guincheiros add constraint guincheiros_id_papel_check check (
  public.perfil_tem_papel(id, 'guincheiro') or public.perfil_tem_papel(id, 'representante')
);

-- O autônomo cria a própria linha de Guincheiro na Frota dele ao começar a etapa de documentos
-- (mesmas regras do convite, sem convite). Nasce `disponivel = false`: fora do Match até a
-- homologação. Posição de partida: o centro de Brasília (veja `aceitar_convite_guincheiro`).
-- Chamar de novo não muda nada.
create function public.criar_meu_guincheiro()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  frota uuid;
begin
  select f.id into frota
  from public.frotas f
  where f.representante_id = eu and f.tipo = 'autonomo';
  if frota is null then
    raise exception 'Só o representante de uma Frota autônoma é Guincheiro da própria Frota'
      using errcode = 'GDG09';
  end if;

  insert into public.guincheiros (id, frota_id, posicao, disponivel)
  values (
    eu, frota,
    extensions.st_setsrid(extensions.st_makepoint(-47.8825, -15.7942), 4326), false
  )
  on conflict (id) do nothing;
  return eu;
end;
$$;

comment on function public.criar_meu_guincheiro is
  'O representante de uma Frota autônoma cria a própria linha de Guincheiro (indisponível).';

-- ---------------------------------------------------------------------------
-- Dados consultáveis dos documentos
-- ---------------------------------------------------------------------------

-- A certidão de antecedentes vale 12 meses a partir da emissão: o último dia de validade é o
-- mesmo dia, 12 meses depois (29/02 vira 28/02). Mesma regra de `validadeDosAntecedentes`
-- (@guinchei/documentos).
create function public.validade_antecedentes(emissao date)
returns date
language sql
immutable
set search_path = ''
as $$
  select (emissao + interval '12 months')::date;
$$;

create table public.documentos_guincheiro (
  guincheiro_id uuid primary key references public.guincheiros (id) on delete cascade,
  -- CNH: o grupo vem inteiro ou não vem. Mesmas categorias de @guinchei/cnh.
  cnh_numero text check (cnh_numero ~ '^\d{11}$'),
  cnh_categoria text check (
    cnh_categoria in ('ACC', 'A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE')
  ),
  -- Último dia de validade; o item de homologação da CNH guarda a mesma data.
  cnh_validade date,
  -- Observação EAR (exerce atividade remunerada): o envio exige `true` (ADR-0012).
  cnh_ear boolean,
  -- Dia da emissão da certidão; a validade (12 meses) está no item de homologação.
  antecedentes_emissao date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint documentos_guincheiro_cnh_completa check (
    num_nonnulls(cnh_numero, cnh_categoria, cnh_validade, cnh_ear) in (0, 4)
  ),
  -- A mesma CNH não está em duas contas.
  constraint documentos_guincheiro_cnh_numero_key unique (cnh_numero)
);

create trigger documentos_guincheiro_atualizado_em
before update on public.documentos_guincheiro
for each row execute function public.definir_atualizado_em();

comment on table public.documentos_guincheiro is
  'Dados da CNH (número, categoria, validade, EAR) e da certidão de antecedentes (emissão) do Guincheiro, em colunas consultáveis (ADR-0012).';

-- Leitura: o próprio Guincheiro e a operação. Ninguém escreve direto: só as funções abaixo.
revoke all on public.documentos_guincheiro from anon, authenticated;
grant select on public.documentos_guincheiro to authenticated;

alter table public.documentos_guincheiro enable row level security;

create policy "documentos_guincheiro: cada Guincheiro lê os seus; a operação lê todos"
on public.documentos_guincheiro for select to authenticated
using (guincheiro_id = (select auth.uid()) or (select public.eh_operacao()));

-- ---------------------------------------------------------------------------
-- Envio e reenvio
-- ---------------------------------------------------------------------------

-- Envia o item do tipo ou, se ele foi recusado ou venceu, reenvia. Interna: só as funções
-- abaixo a chamam, depois de validar os dados do documento.
create function public.registrar_documento_do_guincheiro(
  tipo public.tipo_item_homologacao,
  arquivo text,
  validade date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  atual public.itens_homologacao;
begin
  if eu is null or not exists (select 1 from public.guincheiros g where g.id = eu) then
    raise exception 'Só o Guincheiro envia os próprios documentos' using errcode = 'GDG01';
  end if;

  select * into atual
  from public.itens_homologacao i
  where i.alvo = 'guincheiro'
    and i.alvo_id = eu
    and i.tipo = registrar_documento_do_guincheiro.tipo
  for update;
  if not found then
    return public.enviar_item_homologacao('guincheiro', eu, tipo, arquivo, validade);
  end if;
  if atual.estado in ('pendente', 'aprovado') then
    raise exception 'Este documento já foi enviado e está %', atual.estado using errcode = 'GDG06';
  end if;
  perform public.reenviar_item_homologacao(atual.id, arquivo, validade);
  return atual.id;
end;
$$;

create function public.enviar_cnh(
  numero text,
  categoria text,
  validade date,
  ear boolean,
  arquivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  digitos text := regexp_replace(coalesce(enviar_cnh.numero, ''), '\D', '', 'g');
  cat text := upper(btrim(coalesce(enviar_cnh.categoria, '')));
  item uuid;
begin
  if eu is null or not exists (select 1 from public.guincheiros g where g.id = eu) then
    raise exception 'Só o Guincheiro envia os próprios documentos' using errcode = 'GDG01';
  end if;
  if digitos !~ '^\d{11}$' then
    raise exception 'O número da CNH tem 11 dígitos' using errcode = 'GDG02';
  end if;
  if cat not in ('ACC', 'A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE') then
    raise exception 'Categoria de CNH desconhecida' using errcode = 'GDG03';
  end if;
  if enviar_cnh.validade is null or enviar_cnh.validade < public.hoje_em_brasilia() then
    raise exception 'A CNH está vencida ou sem validade' using errcode = 'GDG04';
  end if;
  if enviar_cnh.ear is not true then
    raise exception 'A CNH precisa da observação EAR' using errcode = 'GDG05';
  end if;

  -- GDG06 e GHM06 saem daqui, antes de gravar os dados (e a transação desfaz tudo).
  item := public.registrar_documento_do_guincheiro('cnh', enviar_cnh.arquivo, enviar_cnh.validade);

  insert into public.documentos_guincheiro
    (guincheiro_id, cnh_numero, cnh_categoria, cnh_validade, cnh_ear)
  values (eu, digitos, cat, enviar_cnh.validade, true)
  on conflict (guincheiro_id) do update
  set cnh_numero = excluded.cnh_numero,
      cnh_categoria = excluded.cnh_categoria,
      cnh_validade = excluded.cnh_validade,
      cnh_ear = excluded.cnh_ear;
  return item;
end;
$$;

create function public.enviar_antecedentes(emissao date, arquivo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  hoje date := public.hoje_em_brasilia();
  item uuid;
begin
  if eu is null or not exists (select 1 from public.guincheiros g where g.id = eu) then
    raise exception 'Só o Guincheiro envia os próprios documentos' using errcode = 'GDG01';
  end if;
  if enviar_antecedentes.emissao is null or enviar_antecedentes.emissao > hoje then
    raise exception 'Informe a data de emissão da certidão' using errcode = 'GDG07';
  end if;
  if public.validade_antecedentes(enviar_antecedentes.emissao) < hoje then
    raise exception 'A certidão foi emitida há mais de 12 meses' using errcode = 'GDG08';
  end if;

  item := public.registrar_documento_do_guincheiro(
    'antecedentes', enviar_antecedentes.arquivo,
    public.validade_antecedentes(enviar_antecedentes.emissao)
  );

  insert into public.documentos_guincheiro (guincheiro_id, antecedentes_emissao)
  values (eu, enviar_antecedentes.emissao)
  on conflict (guincheiro_id) do update
  set antecedentes_emissao = excluded.antecedentes_emissao;
  return item;
end;
$$;

create function public.enviar_selfie(arquivo text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.registrar_documento_do_guincheiro('selfie', arquivo, null);
$$;

comment on function public.enviar_cnh is
  'O Guincheiro envia (ou reenvia, se recusada ou vencida) a CNH: grava os dados e o item pendente.';
comment on function public.enviar_antecedentes is
  'O Guincheiro envia (ou reenvia) a certidão de antecedentes; vale 12 meses a partir da emissão.';
comment on function public.enviar_selfie is
  'O Guincheiro envia (ou reenvia) a selfie tirada no cadastro.';

revoke execute on function
  public.criar_meu_guincheiro, public.validade_antecedentes,
  public.registrar_documento_do_guincheiro, public.enviar_cnh, public.enviar_antecedentes,
  public.enviar_selfie
from public, anon;
grant execute on function
  public.criar_meu_guincheiro, public.validade_antecedentes, public.enviar_cnh,
  public.enviar_antecedentes, public.enviar_selfie
to authenticated;
revoke execute on function public.registrar_documento_do_guincheiro from authenticated;
