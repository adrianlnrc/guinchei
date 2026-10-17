-- Guincheiros elegíveis mais próximos de um ponto (ADR-0002, ADR-0008).
-- Elegível: `disponivel` e de Frota ativa (invariante 3). Ordem pela distância geodésica
-- (PostGIS, metros); empate desempatado pelo id para a ordem ser estável.
-- Usada pela cotação (distância do mais próximo, nota do ADR-0003) e pelo Match (#11),
-- que rodam em Edge Functions com service_role. Não é exposta a anon/authenticated: as
-- posições dos Guincheiros não são públicas.

create function public.guincheiros_elegiveis_proximos(
  latitude double precision,
  longitude double precision,
  limite integer default 3
)
returns table (guincheiro_id uuid, frota_id uuid, distancia_m double precision)
language sql
stable
set search_path = ''
as $$
  with ponto as (
    select extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography as g
  )
  select g.id, g.frota_id, extensions.st_distance(g.posicao, ponto.g)
  from public.guincheiros g
  join public.frotas f on f.id = g.frota_id
  cross join ponto
  where g.disponivel and f.ativa
  order by extensions.st_distance(g.posicao, ponto.g), g.id
  limit limite;
$$;

revoke execute on function public.guincheiros_elegiveis_proximos(double precision, double precision, integer)
  from public, anon, authenticated;
grant execute on function public.guincheiros_elegiveis_proximos(double precision, double precision, integer)
  to service_role;
