-- Acompanhamento do Cliente por status em tempo real (issue #14, substituto do RF09).
--
-- 1. Realtime (Postgres Changes): o app do Cliente escuta `pedidos` e `corridas`. O
--    Realtime confere a RLS de cada linha para cada assinante: o Cliente só recebe eventos
--    do próprio Pedido e da própria Corrida (as políticas de `*_rls.sql`). A adição é
--    idempotente: o app do Guincheiro (#12) pode adicionar as mesmas tabelas (e
--    `tentativas_match`) numa migração própria, em qualquer ordem.
-- 2. `contraparte_da_corrida(corrida_id)`: o perfil da contraparte não é legível pela RLS
--    (perfis têm CPF e telefone). A função devolve só o nome e o nome da Frota, e só para
--    quem participa da Corrida: ao Cliente, o Guincheiro e a Frota dele; ao Guincheiro, o
--    nome do Cliente (Frota nula).

do $$
declare
  tabela text;
begin
  foreach tabela in array array['pedidos', 'corridas'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabela
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tabela);
    end if;
  end loop;
end;
$$;

create function public.contraparte_da_corrida(corrida_id uuid)
returns table (nome text, frota text)
language sql
stable
security definer
set search_path = ''
as $$
  -- Cliente da Corrida: o Guincheiro e a Frota dele.
  select g_perfil.nome, f.nome
  from public.corridas c
  join public.pedidos p on p.id = c.pedido_id
  join public.perfis g_perfil on g_perfil.id = c.guincheiro_id
  join public.guincheiros g on g.id = c.guincheiro_id
  join public.frotas f on f.id = g.frota_id
  where c.id = contraparte_da_corrida.corrida_id
    and p.cliente_id = (select auth.uid())
  union all
  -- Guincheiro da Corrida: o nome do Cliente.
  select c_perfil.nome, null
  from public.corridas c
  join public.pedidos p on p.id = c.pedido_id
  join public.perfis c_perfil on c_perfil.id = p.cliente_id
  where c.id = contraparte_da_corrida.corrida_id
    and c.guincheiro_id = (select auth.uid());
$$;

comment on function public.contraparte_da_corrida is
  'Nome da contraparte da Corrida (e da Frota, para o Cliente), só para quem participa dela. Sem CPF nem telefone.';

revoke execute on function public.contraparte_da_corrida(uuid) from public, anon;
grant execute on function public.contraparte_da_corrida(uuid) to authenticated;
