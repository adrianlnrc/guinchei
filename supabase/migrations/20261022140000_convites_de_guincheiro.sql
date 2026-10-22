-- Convite de Guincheiro por telefone e conta própria (issue #46, ADR-0012, ADR-0010).
--
-- O representante da Frota convida um Guincheiro pelo número de telefone. O convidado entra no
-- app do Guincheiro com telefone + código; no primeiro acesso informa nome e CPF e aceita os
-- termos de uso, e `aceitar_convite_guincheiro()` cria, numa transação, o perfil de Guincheiro e
-- a linha em `guincheiros`, vinculada à Frota que convidou, e marca o convite como aceito.
-- O Guincheiro nasce `disponivel = false`: fica fora do Match até a homologação (#47, #42).
--
-- Erros (errcode):
--   GCV01  telefone do convite inválido (esperado: 55 + DDD + número)
--   GCV03  esta Frota já tem um convite pendente para o número
--   GCV04  o número já foi convidado por outra Frota
--   GCV05  o número já tem conta (Guincheiro, Cliente, representante ou operação)
--   GCV06  sem convite pendente para o número (nunca houve ou foi cancelado)
--   GCV07  o convite venceu
--   GCV08  o número já tem conta (no aceite)
--   GCV09  nome ou aceite dos termos ausentes
--   GCV10  CPF inválido
--   GCV11  convite não encontrado ou já decidido (no cancelamento)
-- Sem permissão (quem não é representante de uma Frota) é 42501.

create type public.estado_convite as enum ('pendente', 'aceito', 'cancelado');

create table public.convites_guincheiro (
  id uuid primary key default gen_random_uuid(),
  frota_id uuid not null references public.frotas (id),
  -- E.164 sem o "+", como `perfis.telefone` e o telefone do JWT.
  telefone text not null check (telefone ~ '^\d{10,15}$'),
  estado public.estado_convite not null default 'pendente',
  -- Quem convidou: o representante da Frota. Nulo nos convites do seed, que antecedem o cadastro.
  criado_por uuid default auth.uid() references public.perfis (id),
  criado_em timestamptz not null default now(),
  -- Convite pendente depois desta hora não vincula (vencido).
  valido_ate timestamptz not null default now() + interval '7 days',
  -- Quem aceitou (o perfil do Guincheiro) e quando; o convite aceito guarda o vínculo.
  aceito_por uuid references public.perfis (id) on delete set null,
  aceito_em timestamptz,
  constraint convites_guincheiro_validade check (valido_ate > criado_em),
  constraint convites_guincheiro_aceite check ((estado = 'aceito') = (aceito_em is not null))
);

-- Um número tem no máximo um convite pendente: nunca duas Frotas ao mesmo tempo.
create unique index convites_guincheiro_pendente_unico
  on public.convites_guincheiro (telefone) where estado = 'pendente';
create index convites_guincheiro_frota_idx on public.convites_guincheiro (frota_id, criado_em desc);

comment on table public.convites_guincheiro is
  'Convite do representante a um número de telefone; vira Guincheiro da Frota no primeiro login (ADR-0012).';

-- O app só lê (o representante da própria Frota). Criar, cancelar e aceitar passam pelas funções.
revoke all on public.convites_guincheiro from anon, authenticated;
grant select on public.convites_guincheiro to authenticated;
alter table public.convites_guincheiro enable row level security;

create policy "convites_guincheiro: o representante lê os da própria Frota; a operação lê todos"
on public.convites_guincheiro for select to authenticated
using ((select public.sou_representante_da_frota(frota_id)) or (select public.eh_operacao()));

-- ---------------------------------------------------------------------------
-- Convidar e cancelar (representante)
-- ---------------------------------------------------------------------------

create function public.convidar_guincheiro(telefone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  numero text := regexp_replace(coalesce(convidar_guincheiro.telefone, ''), '\D', '', 'g');
  frota uuid;
  anterior public.convites_guincheiro;
  novo uuid;
begin
  select f.id into frota from public.frotas f where f.representante_id = eu;
  if frota is null then
    raise exception 'Só o representante de uma Frota convida Guincheiros' using errcode = '42501';
  end if;
  if numero !~ '^55\d{10,11}$' then
    raise exception 'Informe o celular com DDD' using errcode = 'GCV01';
  end if;
  if exists (select 1 from public.perfis p where p.telefone = numero) then
    raise exception 'Este número já tem conta no Guinchei' using errcode = 'GCV05';
  end if;

  select * into anterior from public.convites_guincheiro c
  where c.telefone = numero and c.estado = 'pendente' for update;
  if found then
    if anterior.valido_ate > now() then
      if anterior.frota_id = frota then
        raise exception 'Este número já tem um convite pendente na sua Frota' using errcode = 'GCV03';
      end if;
      raise exception 'Este número já foi convidado por outra Frota' using errcode = 'GCV04';
    end if;
    -- Convite vencido de qualquer Frota: sai do caminho (o estado `cancelado` o encerra).
    update public.convites_guincheiro c set estado = 'cancelado' where c.id = anterior.id;
  end if;

  insert into public.convites_guincheiro (frota_id, telefone, criado_por)
  values (frota, numero, eu)
  returning id into novo;
  return novo;
end;
$$;

create function public.cancelar_convite_guincheiro(convite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
begin
  if not exists (select 1 from public.frotas f where f.representante_id = eu) then
    raise exception 'Só o representante de uma Frota cancela convites' using errcode = '42501';
  end if;
  update public.convites_guincheiro c
  set estado = 'cancelado'
  where c.id = cancelar_convite_guincheiro.convite_id
    and c.estado = 'pendente'
    and public.sou_representante_da_frota(c.frota_id);
  if not found then
    raise exception 'Convite não encontrado ou já decidido' using errcode = 'GCV11';
  end if;
end;
$$;

-- Os Guincheiros já vinculados à Frota do representante. Nome e telefone, sem CPF: o perfil do
-- Guincheiro não é legível para a Frota.
create function public.guincheiros_da_minha_frota()
returns table (id uuid, nome text, telefone text, disponivel boolean, criado_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, p.nome, p.telefone, g.disponivel, g.criado_em
  from public.guincheiros g
  join public.perfis p on p.id = g.id
  where public.sou_representante_da_frota(g.frota_id)
  order by g.criado_em, g.id;
$$;

-- ---------------------------------------------------------------------------
-- Primeiro acesso do convidado
-- ---------------------------------------------------------------------------

-- Há convite pendente e válido para o telefone da sessão? Só para quem ainda não tem perfil
-- (quem tem conta não é convidado de novo). O app usa para abrir o primeiro acesso.
create function public.meu_convite_guincheiro()
returns table (frota_nome text, valido_ate timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.nome, c.valido_ate
  from public.convites_guincheiro c
  join public.frotas f on f.id = c.frota_id
  where c.telefone = (select auth.jwt() ->> 'phone')
    and c.estado = 'pendente'
    and c.valido_ate > now()
    and not exists (select 1 from public.perfis p where p.id = (select auth.uid()));
$$;

-- Ponto de partida do Guincheiro novo: o centro de Brasília. O skeleton não tem GPS ao vivo
-- (RF09 fora) e `guincheiros.posicao` é obrigatória; a posição só importa no Match, de que o
-- Guincheiro novo fica fora (`disponivel = false`).
create function public.aceitar_convite_guincheiro(nome text, cpf text, termos_versao text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  numero text := (select auth.jwt() ->> 'phone');
  convite public.convites_guincheiro;
  nome_limpo text := trim(coalesce(aceitar_convite_guincheiro.nome, ''));
  termos text := trim(coalesce(aceitar_convite_guincheiro.termos_versao, ''));
begin
  if eu is null or numero is null then
    raise exception 'Entre com o celular antes' using errcode = '42501';
  end if;

  select * into convite from public.convites_guincheiro c
  where c.telefone = numero and c.estado = 'pendente' for update;
  if not found then
    raise exception 'Não há convite para este número. Peça à sua Frota que o convide de novo.'
      using errcode = 'GCV06';
  end if;
  if convite.valido_ate <= now() then
    raise exception 'O convite venceu. Peça à sua Frota que o convide de novo.'
      using errcode = 'GCV07';
  end if;
  if exists (select 1 from public.perfis p where p.id = eu or p.telefone = numero) then
    raise exception 'Este número já tem conta no Guinchei' using errcode = 'GCV08';
  end if;
  if length(nome_limpo) = 0 or length(termos) = 0 then
    raise exception 'Informe o nome e aceite os termos de uso' using errcode = 'GCV09';
  end if;
  if not coalesce(public.cpf_valido(aceitar_convite_guincheiro.cpf), false) then
    raise exception 'CPF inválido' using errcode = 'GCV10';
  end if;

  -- A hora do aceite dos termos é a do servidor (trigger de `perfis`).
  insert into public.perfis (id, papel, nome, telefone, cpf, aceite_termos_versao)
  values (eu, 'guincheiro', nome_limpo, numero, aceitar_convite_guincheiro.cpf, termos);

  insert into public.guincheiros (id, frota_id, posicao, disponivel)
  values (
    eu, convite.frota_id,
    extensions.st_setsrid(extensions.st_makepoint(-47.8825, -15.7942), 4326), false
  );

  update public.convites_guincheiro c
  set estado = 'aceito', aceito_por = eu, aceito_em = now()
  where c.id = convite.id;
  return eu;
end;
$$;

comment on function public.aceitar_convite_guincheiro is
  'Primeiro acesso do convidado: cria o perfil de Guincheiro e a linha em guincheiros (indisponível), vinculada à Frota que convidou.';

revoke execute on function
  public.convidar_guincheiro, public.cancelar_convite_guincheiro,
  public.guincheiros_da_minha_frota, public.meu_convite_guincheiro,
  public.aceitar_convite_guincheiro
from public, anon;
grant execute on function
  public.convidar_guincheiro, public.cancelar_convite_guincheiro,
  public.guincheiros_da_minha_frota, public.meu_convite_guincheiro,
  public.aceitar_convite_guincheiro
to authenticated;
