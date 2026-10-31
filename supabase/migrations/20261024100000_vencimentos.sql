-- Vencimento de apólice, certidão e CNH com alerta (issue #49, ADR-0012).
--
-- A #42 já criou o estado `vencido`, a trilha de auditoria e o job diário `homologacao-vencer`
-- (pg_cron, 00:05 em Brasília), que chama `marcar_itens_vencidos`: o item aprovado cuja
-- validade passou vira `vencido`, com linha na trilha sem autor (`por` nulo = o sistema).
-- Esta migração acrescenta o que faltava para o alerta:
--
--   1. `parametros_homologacao`: o prazo do alerta (30 dias), em uma linha, como
--      `parametros_match`. Muda com um UPDATE, sem deploy.
--   2. `itens_em_alerta_de_vencimento()`: os itens aprovados que vencem dentro do prazo e os
--      já vencidos, do mais urgente ao menos. A operação vê todos; o representante, os da
--      própria Frota; o Guincheiro, os que ele enviou. Alimenta a lista "Vencendo" do Painel
--      e o aviso nos apps.
--   3. `item_vigente`: aprovado e dentro da validade. Item vencido não conta como aprovado;
--      o efeito disso sobre o Match é do ticket de elegibilidade.
--
-- O reenvio do documento novo é `reenviar_item_homologacao` (#42): vencido volta a pendente.

-- ---------------------------------------------------------------------------
-- Parâmetro do alerta
-- ---------------------------------------------------------------------------

create table public.parametros_homologacao (
  id boolean primary key default true check (id),
  -- Quantos dias antes do fim da validade o item entra no alerta.
  alerta_vencimento_dias integer not null default 30
    check (alerta_vencimento_dias between 1 and 365),
  atualizado_em timestamptz not null default now()
);

comment on table public.parametros_homologacao is
  'Parâmetros da homologação (uma linha): quantos dias antes do vencimento o item entra no alerta.';

insert into public.parametros_homologacao default values;

create trigger parametros_homologacao_atualizado_em
before update on public.parametros_homologacao
for each row execute function public.definir_atualizado_em();

revoke all on public.parametros_homologacao from anon, authenticated;
alter table public.parametros_homologacao enable row level security;

-- Os apps leem o prazo por esta função, não pela tabela.
create function public.prazo_alerta_vencimento_dias()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select p.alerta_vencimento_dias from public.parametros_homologacao p;
$$;

comment on function public.prazo_alerta_vencimento_dias is
  'Dias de antecedência do alerta de vencimento (parametros_homologacao).';

-- ---------------------------------------------------------------------------
-- Item vigente: aprovado e dentro da validade
-- ---------------------------------------------------------------------------

-- Falso para item vencido e também para o aprovado cuja validade passou e o job ainda não
-- rodou. A validade vale até o fim do dia; sem validade (selfie, alvará), vale enquanto aprovado.
create function public.item_vigente(estado public.estado_homologacao, validade date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select estado = 'aprovado' and (validade is null or validade >= public.hoje_em_brasilia());
$$;

comment on function public.item_vigente is
  'Item aprovado e dentro da validade. Vencido não conta como aprovado para a elegibilidade.';

-- ---------------------------------------------------------------------------
-- Itens em alerta de vencimento
-- ---------------------------------------------------------------------------

-- `estado` já vem corrigido: o aprovado de validade passada aparece como `vencido` mesmo antes
-- da varredura da madrugada. `dias_restantes` é negativo nos vencidos e 0 no último dia.
-- `posso_reenviar`: quem chama reenvia o item (o dono; o representante, nos itens da Frota e dos
-- veículos), como em `reenviar_item_homologacao`.
create function public.itens_em_alerta_de_vencimento()
returns table (
  item_id uuid,
  frota_id uuid,
  frota_nome text,
  alvo public.alvo_homologacao,
  alvo_id uuid,
  tipo public.tipo_item_homologacao,
  estado public.estado_homologacao,
  validade date,
  dias_restantes integer,
  guincheiro_nome text,
  posso_reenviar boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with ctx as (
    select public.hoje_em_brasilia() as hoje,
           p.alerta_vencimento_dias as prazo,
           (select auth.uid()) as eu,
           (select public.eh_operacao()) as operacao
    from public.parametros_homologacao p
  )
  select i.id, i.frota_id, f.nome, i.alvo, i.alvo_id, i.tipo,
         case when i.estado = 'aprovado' and i.validade < ctx.hoje
              then 'vencido'::public.estado_homologacao else i.estado end,
         i.validade,
         i.validade - ctx.hoje,
         pf.nome,
         coalesce(i.dono_id = ctx.eu or (i.alvo <> 'guincheiro' and f.representante_id = ctx.eu), false)
  from ctx
  join public.itens_homologacao i on true
  join public.frotas f on f.id = i.frota_id
  left join public.perfis pf on i.alvo = 'guincheiro' and pf.id = i.alvo_id
  where i.validade is not null
    and (i.estado = 'vencido'
         or (i.estado = 'aprovado' and i.validade <= ctx.hoje + ctx.prazo))
    and (ctx.operacao or i.dono_id = ctx.eu or f.representante_id = ctx.eu)
  order by i.validade - ctx.hoje, f.nome, i.tipo, i.id;
$$;

comment on function public.itens_em_alerta_de_vencimento is
  'Itens aprovados que vencem dentro do prazo do alerta e os já vencidos, do mais urgente ao menos. Operação: todos; representante: os da Frota; Guincheiro: os seus.';

revoke execute on function
  public.prazo_alerta_vencimento_dias, public.item_vigente, public.itens_em_alerta_de_vencimento
from public, anon;
grant execute on function
  public.prazo_alerta_vencimento_dias, public.item_vigente, public.itens_em_alerta_de_vencimento
to authenticated;
