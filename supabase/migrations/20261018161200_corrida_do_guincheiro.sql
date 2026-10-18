-- App do Guincheiro: aceite e status da Corrida (issue #12; ADR-0008 com a nota de
-- 2026-10-17, ADR-0011).
--
--   1. O Guincheiro avança a própria Corrida por UPDATE de `corridas.estado`, como a RLS
--      do #6 já permite; o trigger de transição continua valendo (`aceita → a_caminho` é o
--      "Saí para o local"). Fotos de estado não são exigidas (ADR-0011).
--   2. Ao chegar a `entregue`, o banco devolve o Guincheiro ao plantão (`disponivel`), por
--      trigger: vale por qualquer caminho que leve a Corrida a `entregue`. O aceite já o
--      deixa indisponível (`aceitar_oferta`, #11). A captura do pagamento fica fora.
--   3. `hora_do_servidor()`: o app conta o prazo da oferta (`expira_em`) pela hora do banco,
--      não pelo relógio do aparelho.
--   4. Realtime: `tentativas_match` e `corridas` entram na publicação `supabase_realtime`.
--      Postgres Changes respeita a RLS: cada Guincheiro só recebe as ofertas feitas a ele
--      e a própria Corrida. Idempotente: outra migração (#14) pode adicionar as mesmas.

-- ---------------------------------------------------------------------------
-- Entregue: o Guincheiro volta ao plantão
-- ---------------------------------------------------------------------------

create function public.devolver_guincheiro_ao_plantao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guincheiros g set disponivel = true where g.id = new.guincheiro_id;
  return new;
end;
$$;

comment on function public.devolver_guincheiro_ao_plantao is
  'Trigger: a Corrida chegou a entregue; o Guincheiro volta a ficar disponível.';

revoke execute on function public.devolver_guincheiro_ao_plantao() from public, anon, authenticated;

create trigger corridas_entregue_devolve_ao_plantao
after update of estado on public.corridas
for each row
when (new.estado = 'entregue' and old.estado is distinct from new.estado)
execute function public.devolver_guincheiro_ao_plantao();

-- ---------------------------------------------------------------------------
-- Hora do servidor
-- ---------------------------------------------------------------------------

create function public.hora_do_servidor()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

comment on function public.hora_do_servidor is
  'Hora do banco, para o app contar o prazo da oferta (expira_em) sem depender do relógio do aparelho.';

revoke execute on function public.hora_do_servidor() from public, anon;
grant execute on function public.hora_do_servidor() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
declare
  tabela text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach tabela in array array['tentativas_match', 'corridas'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabela
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tabela);
    end if;
  end loop;
end;
$$;
