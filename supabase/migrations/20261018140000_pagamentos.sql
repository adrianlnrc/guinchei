-- Confirmação do Pedido e pagamento mock (issue #10, RF06; ADR-0004, ADR-0008).
--
-- A Edge Function `confirmar-pedido` lê o Preço fechado gravado (`preco_para_confirmar`),
-- autoriza esse mesmo valor no GatewayPagamento (@guinchei/pagamento, adaptador mock no
-- skeleton) e registra o resultado (`registrar_pagamento`), que leva o Pedido de `cotado` a
-- `confirmado` quando autorizado. Recusado: o pagamento fica registrado e o Pedido continua
-- `cotado`, para o Cliente tentar de novo.
--
-- `pagamentos` guarda o estado do pagamento no provedor; captura (#14) e estorno (#11) vão
-- atualizar a mesma linha. Ninguém escreve pela API: só a service_role, pelas funções.
--
-- Códigos de erro próprios:
--   GPG01  Pedido sem Preço fechado (cote antes de confirmar)
--   GPG02  valor do pagamento diferente do Preço fechado gravado
--   P0002  Pedido em cotado do Cliente não encontrado

create type public.estado_pagamento as enum ('autorizado', 'capturado', 'estornado', 'recusado');
create type public.metodo_pagamento as enum ('pix', 'cartao');

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id),
  -- Centavos: o Preço fechado do Pedido no momento da autorização.
  valor integer not null check (valor > 0),
  estado public.estado_pagamento not null,
  -- Só informativo no mock.
  metodo public.metodo_pagamento not null,
  -- Adaptador do GatewayPagamento que atendeu; o PSP real (RF12) entra como outro valor.
  provedor text not null check (provedor in ('mock')),
  -- Identificador do pagamento no provedor.
  referencia_externa text not null unique check (length(trim(referencia_externa)) > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.pagamentos is
  'Pagamentos do Pedido no provedor (GatewayPagamento). Escrita só pela service_role.';

create index pagamentos_pedido_id_idx on public.pagamentos (pedido_id);

-- Uma autorização viva por Pedido: recusas e estornos podem se repetir.
create unique index pagamentos_um_vivo_por_pedido
on public.pagamentos (pedido_id) where estado in ('autorizado', 'capturado');

create trigger pagamentos_atualizado_em
before update on public.pagamentos
for each row execute function public.definir_atualizado_em();

-- Hora do servidor, mesmo que alguém com service_role mande outra.
create function public.pagamentos_criado_em_do_servidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.criado_em := now();
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger pagamentos_criado_em_do_servidor
before insert on public.pagamentos
for each row execute function public.pagamentos_criado_em_do_servidor();

-- ---------------------------------------------------------------------------
-- RLS: o Cliente lê os do próprio Pedido; a operação lê todos; ninguém escreve pela API
-- ---------------------------------------------------------------------------

revoke all on public.pagamentos from anon, authenticated;
grant select on public.pagamentos to authenticated;

alter table public.pagamentos enable row level security;

create policy "pagamentos: o Cliente lê os do próprio Pedido; a operação lê todos"
on public.pagamentos for select to authenticated
using (public.sou_cliente_do_pedido(pedido_id) or (select public.eh_operacao()));

-- ---------------------------------------------------------------------------
-- preco_para_confirmar
-- ---------------------------------------------------------------------------

create function public.preco_para_confirmar(pedido_id uuid, cliente_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  select p.preco_total into total
  from public.pedidos p
  where p.id = preco_para_confirmar.pedido_id
    and p.cliente_id = preco_para_confirmar.cliente_id
    and p.estado = 'cotado';
  if not found then
    raise exception 'Pedido em cotado não encontrado' using errcode = 'P0002';
  end if;
  if total is null then
    raise exception 'O Pedido ainda não tem Preço fechado' using errcode = 'GPG01';
  end if;
  return total;
end;
$$;

comment on function public.preco_para_confirmar is
  'Preço fechado gravado no Pedido em cotado, que a Edge Function confirmar-pedido autoriza. Só service_role.';

-- ---------------------------------------------------------------------------
-- registrar_pagamento
-- ---------------------------------------------------------------------------

create function public.registrar_pagamento(
  pedido_id uuid,
  cliente_id uuid,
  valor integer,
  estado public.estado_pagamento,
  metodo public.metodo_pagamento,
  provedor text,
  referencia_externa text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
  novo uuid;
begin
  if estado not in ('autorizado', 'recusado') then
    raise exception 'Na confirmação, o pagamento é autorizado ou recusado, não %', estado
      using errcode = '22023';
  end if;

  -- Trava o Pedido: o trajeto (e a cotação) não muda entre a conferência e a confirmação.
  select p.preco_total into total
  from public.pedidos p
  where p.id = registrar_pagamento.pedido_id
    and p.cliente_id = registrar_pagamento.cliente_id
    and p.estado = 'cotado'
  for update;
  if not found then
    raise exception 'Pedido em cotado não encontrado' using errcode = 'P0002';
  end if;
  if total is distinct from valor then
    raise exception 'O valor do pagamento (%) difere do Preço fechado (%)', valor, total
      using errcode = 'GPG02';
  end if;

  insert into public.pagamentos (pedido_id, valor, estado, metodo, provedor, referencia_externa)
  values (
    registrar_pagamento.pedido_id, valor, estado, metodo, provedor, referencia_externa
  )
  returning id into novo;

  if estado = 'autorizado' then
    update public.pedidos p set estado = 'confirmado' where p.id = registrar_pagamento.pedido_id;
  end if;

  return novo;
end;
$$;

comment on function public.registrar_pagamento is
  'Registra o resultado da autorização; autorizado leva o Pedido de cotado a confirmado. Só service_role.';

revoke execute on function public.preco_para_confirmar from public, anon, authenticated;
revoke execute on function public.registrar_pagamento from public, anon, authenticated;
grant execute on function public.preco_para_confirmar to service_role;
grant execute on function public.registrar_pagamento to service_role;
