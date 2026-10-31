-- Vínculo Guincheiro × veículo com bloqueio CNH × PBT (issue #48, ADR-0012, CTB art. 143).
--
-- O representante vincula um Guincheiro a um veículo da Frota. A regra de verdade é
-- `categoria_cnh_cobre_pbt` (#40; fonte em packages/cnh): B cobre PBT até 3.500 kg, C ou
-- superior cobre acima, A e ACC não cobrem nada. O app avisa antes de confirmar usando o
-- módulo TypeScript; esta migração é a barreira real: o trigger de `vinculos_veiculo` recusa
-- o vínculo mesmo por chamada direta, e vale para qualquer papel, inclusive `service_role`.
--
-- Situação do vínculo, calculada pelo banco (o app nunca a escolhe):
--   ativo      a CNH do Guincheiro está aprovada e a categoria cobre o PBT do veículo;
--   pendente   a CNH ainda não foi aprovada (não enviada, em análise, recusada ou vencida):
--              o vínculo é permitido e revalidado quando a CNH for aprovada;
--   (bloqueado) CNH aprovada que não cobre o PBT: o vínculo não existe (erro GVL03).
--
-- Revalidação: aprovar, vencer ou reprovar o item de CNH, mudar a categoria da CNH
-- (`documentos_guincheiro.cnh_categoria`) e mudar o PBT do veículo revalidam os vínculos
-- afetados. O vínculo que deixou de ser coberto é derrubado e fica registrado em
-- `vinculos_encerrados`, para o representante e o Guincheiro saberem por quê.
--
-- Um Guincheiro dirige um veículo por vez (`vinculos_veiculo_guincheiro_key`); um veículo pode
-- ter vários Guincheiros (turnos).
--
-- Erros (errcode):
--   GVL01  quem chama não é o representante da Frota do veículo (ou o veículo não existe)
--   GVL02  o Guincheiro não é da mesma Frota do veículo
--   GVL03  a CNH aprovada do Guincheiro não cobre o PBT do veículo
--   GVL04  o Guincheiro já está vinculado a outro veículo: desfaça o vínculo antes
--   GVL05  vínculo inexistente (ou de outra Frota) ao desfazer

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create type public.situacao_vinculo as enum ('pendente', 'ativo');

create table public.vinculos_veiculo (
  id uuid primary key default gen_random_uuid(),
  -- Copiada do veículo pelo trigger: Guincheiro e veículo são sempre da mesma Frota.
  frota_id uuid not null references public.frotas (id),
  veiculo_id uuid not null references public.veiculos (id),
  guincheiro_id uuid not null references public.guincheiros (id) on delete cascade,
  -- Sempre calculada pelo trigger a partir da CNH e do PBT; o valor enviado é ignorado.
  situacao public.situacao_vinculo not null default 'pendente',
  criado_por uuid references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint vinculos_veiculo_guincheiro_key unique (guincheiro_id)
);

create index vinculos_veiculo_veiculo_id_idx on public.vinculos_veiculo (veiculo_id);
create index vinculos_veiculo_frota_id_idx on public.vinculos_veiculo (frota_id);

create trigger vinculos_veiculo_atualizado_em
before update on public.vinculos_veiculo
for each row execute function public.definir_atualizado_em();

comment on table public.vinculos_veiculo is
  'Em qual veículo cada Guincheiro está vinculado (ADR-0012). A situação (ativo ou pendente) e o bloqueio CNH × PBT são do banco.';

-- Histórico dos vínculos que acabaram, com o motivo. A placa é guardada porque o Guincheiro não
-- lê a tabela de veículos.
create table public.vinculos_encerrados (
  id bigint generated always as identity primary key,
  frota_id uuid not null references public.frotas (id),
  veiculo_id uuid not null references public.veiculos (id),
  guincheiro_id uuid not null references public.guincheiros (id) on delete cascade,
  placa text not null,
  motivo text not null check (motivo in ('cnh_nao_cobre', 'desfeito_pelo_representante')),
  -- Para `cnh_nao_cobre`: o que a revalidação encontrou, em linguagem do domínio.
  detalhe text,
  encerrado_em timestamptz not null default now()
);

create index vinculos_encerrados_frota_idx on public.vinculos_encerrados (frota_id, encerrado_em desc);
create index vinculos_encerrados_guincheiro_idx
  on public.vinculos_encerrados (guincheiro_id, encerrado_em desc);

comment on table public.vinculos_encerrados is
  'Vínculos Guincheiro × veículo que acabaram: derrubados pela revalidação CNH × PBT ou desfeitos pelo representante.';

-- ---------------------------------------------------------------------------
-- Regra: situação de um par Guincheiro × veículo
-- ---------------------------------------------------------------------------

-- 'ativo', 'pendente' ou 'bloqueado'; null se o veículo não existe. Só `true` de
-- `categoria_cnh_cobre_pbt` libera: categoria ausente ou entrada inválida bloqueia a CNH
-- aprovada (o item pode ter vindo de fora do app, sem os dados).
create function public.avaliar_vinculo(guincheiro uuid, veiculo uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from public.itens_homologacao i
      where i.alvo = 'guincheiro' and i.alvo_id = avaliar_vinculo.guincheiro
        and i.tipo = 'cnh' and i.estado = 'aprovado'
    ) then 'pendente'
    when public.categoria_cnh_cobre_pbt(
      (select d.cnh_categoria from public.documentos_guincheiro d
        where d.guincheiro_id = avaliar_vinculo.guincheiro),
      v.pbt_kg
    ) is true then 'ativo'
    else 'bloqueado'
  end
  from public.veiculos v
  where v.id = avaliar_vinculo.veiculo;
$$;

comment on function public.avaliar_vinculo is
  'Situação do par Guincheiro × veículo: ativo (CNH aprovada cobre o PBT), pendente (CNH não aprovada) ou bloqueado.';

-- ---------------------------------------------------------------------------
-- Barreira: trigger da tabela (vale para qualquer papel)
-- ---------------------------------------------------------------------------

create function public.vinculos_veiculo_barreira()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  frota_do_veiculo uuid;
  frota_do_guincheiro uuid;
  resultado text;
  categoria text;
  pbt integer;
begin
  select v.frota_id, v.pbt_kg into frota_do_veiculo, pbt
  from public.veiculos v where v.id = new.veiculo_id;
  select g.frota_id into frota_do_guincheiro
  from public.guincheiros g where g.id = new.guincheiro_id;
  if frota_do_veiculo is null or frota_do_guincheiro is distinct from frota_do_veiculo then
    raise exception 'O Guincheiro e o veículo precisam ser da mesma Frota' using errcode = 'GVL02';
  end if;
  new.frota_id := frota_do_veiculo;

  resultado := public.avaliar_vinculo(new.guincheiro_id, new.veiculo_id);
  if resultado = 'bloqueado' then
    select d.cnh_categoria into categoria
    from public.documentos_guincheiro d where d.guincheiro_id = new.guincheiro_id;
    raise exception 'A CNH % do Guincheiro não cobre o PBT de % kg deste veículo',
      coalesce(categoria, '(sem categoria)'), pbt
      using errcode = 'GVL03';
  end if;
  new.situacao := resultado::public.situacao_vinculo;
  return new;
end;
$$;

create trigger vinculos_veiculo_barreira
before insert or update on public.vinculos_veiculo
for each row execute function public.vinculos_veiculo_barreira();

-- ---------------------------------------------------------------------------
-- Encerrar e revalidar
-- ---------------------------------------------------------------------------

-- Apaga o vínculo e guarda o motivo. Interna.
create function public.encerrar_vinculo(vinculo_id uuid, motivo text, detalhe text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  atual public.vinculos_veiculo;
begin
  delete from public.vinculos_veiculo l
  where l.id = encerrar_vinculo.vinculo_id
  returning * into atual;
  if not found then
    return;
  end if;
  insert into public.vinculos_encerrados
    (frota_id, veiculo_id, guincheiro_id, placa, motivo, detalhe)
  select atual.frota_id, atual.veiculo_id, atual.guincheiro_id, v.placa,
    encerrar_vinculo.motivo, encerrar_vinculo.detalhe
  from public.veiculos v where v.id = atual.veiculo_id;
end;
$$;

-- Revalida os vínculos de um Guincheiro, de um veículo, ou de todos (os dois nulos): derruba os
-- que a CNH aprovada não cobre e põe em dia a situação dos demais (ativo ou pendente). Devolve
-- quantos foram derrubados. Interna: os triggers abaixo a chamam.
create function public.revalidar_vinculos(
  guincheiro uuid default null,
  veiculo uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  nova text;
  derrubados integer := 0;
  categoria text;
begin
  for l in
    select x.id, x.guincheiro_id, x.veiculo_id, x.situacao, v.pbt_kg
    from public.vinculos_veiculo x
    join public.veiculos v on v.id = x.veiculo_id
    where (revalidar_vinculos.guincheiro is null or x.guincheiro_id = revalidar_vinculos.guincheiro)
      and (revalidar_vinculos.veiculo is null or x.veiculo_id = revalidar_vinculos.veiculo)
    order by x.id
    for update of x
  loop
    nova := public.avaliar_vinculo(l.guincheiro_id, l.veiculo_id);
    if nova = 'bloqueado' then
      select d.cnh_categoria into categoria
      from public.documentos_guincheiro d where d.guincheiro_id = l.guincheiro_id;
      perform public.encerrar_vinculo(
        l.id, 'cnh_nao_cobre',
        format('CNH %s não cobre o PBT de %s kg', coalesce(categoria, '(sem categoria)'), l.pbt_kg)
      );
      derrubados := derrubados + 1;
    elsif nova::public.situacao_vinculo is distinct from l.situacao then
      -- O trigger da tabela recalcula a situação; o update só dispara o recálculo.
      update public.vinculos_veiculo x set situacao = nova::public.situacao_vinculo where x.id = l.id;
    end if;
  end loop;
  return derrubados;
end;
$$;

comment on function public.revalidar_vinculos is
  'Derruba os vínculos que a CNH aprovada não cobre e atualiza a situação dos demais. Interna: chamada pelos triggers de CNH e de PBT.';

-- Aprovar, reprovar, vencer ou reenviar a CNH muda o que vale para os vínculos do Guincheiro.
create function public.revalidar_vinculos_pela_cnh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.revalidar_vinculos(new.alvo_id, null);
  return null;
end;
$$;

create trigger itens_homologacao_revalidar_vinculos
after update of estado on public.itens_homologacao
for each row
when (new.alvo = 'guincheiro' and new.tipo = 'cnh' and new.estado is distinct from old.estado)
execute function public.revalidar_vinculos_pela_cnh();

-- Mudar a categoria da CNH (reenvio) revalida os vínculos do Guincheiro.
create function public.revalidar_vinculos_pela_categoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.revalidar_vinculos(new.guincheiro_id, null);
  return null;
end;
$$;

create trigger documentos_guincheiro_revalidar_vinculos
after update of cnh_categoria on public.documentos_guincheiro
for each row
when (new.cnh_categoria is distinct from old.cnh_categoria)
execute function public.revalidar_vinculos_pela_categoria();

-- Mudar o PBT do veículo revalida os vínculos dele.
create function public.revalidar_vinculos_pelo_pbt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.revalidar_vinculos(null, new.id);
  return null;
end;
$$;

create trigger veiculos_revalidar_vinculos
after update of pbt_kg on public.veiculos
for each row
when (new.pbt_kg is distinct from old.pbt_kg)
execute function public.revalidar_vinculos_pelo_pbt();

-- ---------------------------------------------------------------------------
-- GRANTs e RLS: leitura pelo representante da Frota, pelo Guincheiro e pela operação
-- ---------------------------------------------------------------------------

revoke all on public.vinculos_veiculo, public.vinculos_encerrados from anon, authenticated;
grant select on public.vinculos_veiculo, public.vinculos_encerrados to authenticated;

alter table public.vinculos_veiculo enable row level security;
alter table public.vinculos_encerrados enable row level security;

create policy "vinculos_veiculo: o Guincheiro lê o seu; o representante, os da Frota; a operação lê todos"
on public.vinculos_veiculo for select to authenticated
using (
  guincheiro_id = (select auth.uid())
  or (select public.sou_representante_da_frota(frota_id))
  or (select public.eh_operacao())
);

create policy "vinculos_encerrados: o Guincheiro lê os seus; o representante, os da Frota; a operação lê todos"
on public.vinculos_encerrados for select to authenticated
using (
  guincheiro_id = (select auth.uid())
  or (select public.sou_representante_da_frota(frota_id))
  or (select public.eh_operacao())
);

-- ---------------------------------------------------------------------------
-- Funções pela API
-- ---------------------------------------------------------------------------

-- O representante vincula um Guincheiro a um veículo da própria Frota. Devolve a situação:
-- `ativo` ou `pendente` (CNH ainda não aprovada). Vincular de novo ao mesmo veículo não muda
-- nada. CNH aprovada que não cobre o PBT é GVL03, vindo do trigger da tabela.
create function public.vincular_guincheiro_veiculo(guincheiro_id uuid, veiculo_id uuid)
returns public.situacao_vinculo
language plpgsql
security definer
set search_path = ''
as $$
declare
  frota uuid;
  atual public.vinculos_veiculo;
  nova public.situacao_vinculo;
begin
  select v.frota_id into frota
  from public.veiculos v where v.id = vincular_guincheiro_veiculo.veiculo_id;
  if frota is null or not public.sou_representante_da_frota(frota) then
    raise exception 'Só o representante da Frota vincula Guincheiros a veículos'
      using errcode = 'GVL01';
  end if;
  if not exists (
    select 1 from public.guincheiros g
    where g.id = vincular_guincheiro_veiculo.guincheiro_id and g.frota_id = frota
  ) then
    raise exception 'O Guincheiro precisa ser da mesma Frota do veículo' using errcode = 'GVL02';
  end if;

  select * into atual from public.vinculos_veiculo l
  where l.guincheiro_id = vincular_guincheiro_veiculo.guincheiro_id
  for update;
  if found then
    if atual.veiculo_id = vincular_guincheiro_veiculo.veiculo_id then
      return atual.situacao;
    end if;
    raise exception 'O Guincheiro já está vinculado a outro veículo: desfaça o vínculo antes'
      using errcode = 'GVL04';
  end if;

  insert into public.vinculos_veiculo (frota_id, veiculo_id, guincheiro_id, criado_por)
  values (
    frota, vincular_guincheiro_veiculo.veiculo_id, vincular_guincheiro_veiculo.guincheiro_id,
    (select auth.uid())
  )
  returning situacao into nova;
  return nova;
end;
$$;

comment on function public.vincular_guincheiro_veiculo is
  'O representante vincula um Guincheiro a um veículo da Frota; bloqueado (GVL03) se a CNH aprovada não cobre o PBT, pendente se a CNH ainda não foi aprovada.';

-- O representante desfaz um vínculo da própria Frota.
create function public.desfazer_vinculo(vinculo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  atual public.vinculos_veiculo;
begin
  select * into atual from public.vinculos_veiculo l
  where l.id = desfazer_vinculo.vinculo_id
  for update;
  if not found or not public.sou_representante_da_frota(atual.frota_id) then
    raise exception 'Vínculo não encontrado' using errcode = 'GVL05';
  end if;
  perform public.encerrar_vinculo(atual.id, 'desfeito_pelo_representante');
end;
$$;

comment on function public.desfazer_vinculo is
  'O representante desfaz um vínculo Guincheiro × veículo da própria Frota; fica no histórico.';

-- O veículo em que o Guincheiro logado está vinculado (o Guincheiro não lê `veiculos`).
create function public.meu_veiculo()
returns table (
  vinculo_id uuid,
  situacao public.situacao_vinculo,
  veiculo_id uuid,
  placa text,
  tipo public.tipo_veiculo_guincho,
  pbt_kg integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.situacao, v.id, v.placa, v.tipo, v.pbt_kg
  from public.vinculos_veiculo l
  join public.veiculos v on v.id = l.veiculo_id
  where l.guincheiro_id = (select auth.uid());
$$;

-- A CNH dos Guincheiros da Frota do representante: categoria enviada e estado da homologação
-- (nulos se ainda não enviou). O app usa para avisar, antes de confirmar, se o vínculo seria
-- recusado. Não devolve número nem foto da CNH.
create function public.cnh_dos_meus_guincheiros()
returns table (guincheiro_id uuid, categoria text, estado public.estado_homologacao)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, d.cnh_categoria, i.estado
  from public.guincheiros g
  left join public.documentos_guincheiro d on d.guincheiro_id = g.id
  left join public.itens_homologacao i
    on i.alvo = 'guincheiro' and i.alvo_id = g.id and i.tipo = 'cnh'
  where public.sou_representante_da_frota(g.frota_id)
  order by g.criado_em, g.id;
$$;

revoke execute on function
  public.avaliar_vinculo, public.encerrar_vinculo, public.revalidar_vinculos,
  public.vinculos_veiculo_barreira, public.revalidar_vinculos_pela_cnh,
  public.revalidar_vinculos_pela_categoria, public.revalidar_vinculos_pelo_pbt,
  public.vincular_guincheiro_veiculo, public.desfazer_vinculo, public.meu_veiculo,
  public.cnh_dos_meus_guincheiros
from public, anon, authenticated;
grant execute on function
  public.vincular_guincheiro_veiculo, public.desfazer_vinculo, public.meu_veiculo,
  public.cnh_dos_meus_guincheiros
to authenticated;
