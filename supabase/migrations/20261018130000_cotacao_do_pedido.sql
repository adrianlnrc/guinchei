-- Cotação do Pedido pelo servidor (issue #10, RF05; ADR-0003, ADR-0009).
--
-- O Preço fechado é calculado na Edge Function `cotar-pedido` com @guinchei/preco (a mesma
-- regra dos apps, sem duplicar em SQL) e gravado por ela com a service_role. O banco faz o
-- que só ele sabe: quem é o Guincheiro elegível mais próximo, a tabela vigente, os feriados
-- e a hora do servidor; e confere, na gravação, dono, estado e que o trajeto não mudou
-- entre a leitura e a escrita (cotações simultâneas do mesmo trajeto não conflitam). O
-- Cliente nunca grava o próprio preço.
--
-- Distância até o veículo (provisório): linha reta (PostGIS, geography) do Guincheiro
-- elegível mais próximo até a origem. A rota real, com o token de servidor do Mapbox, fica
-- para depois; `km_rebocado` continua o que o trajeto (#9) gravou.
--
-- Códigos de erro próprios, para a Edge Function responder ao app:
--   GCT01  nenhum Guincheiro elegível agora
--   GCT02  Pedido sem trajeto completo
--   GCT03  o trajeto do Pedido mudou entre a leitura e a gravação da cotação
--   P0002  Pedido em cotado do Cliente não encontrado (não é dono ou não está em cotado)

-- Identifica o trajeto de que o preço depende: origem, destino e km rebocado.
create function public.assinatura_do_trajeto(
  origem extensions.geography,
  destino extensions.geography,
  km_rebocado numeric
)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(concat_ws('|', origem::text, destino::text, km_rebocado::text))
$$;

create function public.dados_da_cotacao(pedido_id uuid, cliente_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.pedidos;
  distancia_m double precision;
  tabela public.tabela_precos;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into p
  from public.pedidos
  where id = dados_da_cotacao.pedido_id
    and pedidos.cliente_id = dados_da_cotacao.cliente_id
    and estado = 'cotado';
  if not found then
    raise exception 'Pedido em cotado não encontrado' using errcode = 'P0002';
  end if;

  if p.origem is null or p.destino is null or p.km_rebocado is null then
    raise exception 'O Pedido ainda não tem origem e destino' using errcode = 'GCT02';
  end if;

  select e.distancia_m into distancia_m
  from public.guincheiros_elegiveis_proximos(
    extensions.st_y(p.origem::extensions.geometry),
    extensions.st_x(p.origem::extensions.geometry),
    1
  ) e;
  if distancia_m is null then
    raise exception 'Nenhum guincho disponível agora' using errcode = 'GCT01';
  end if;

  tabela := public.tabela_precos_vigente(now());
  if tabela.versao is null then
    raise exception 'Sem tabela de preços vigente' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'instante', now(),
    -- 2 casas, como a coluna: o preço é calculado com a distância que fica gravada.
    'km_ate_veiculo', round((distancia_m / 1000)::numeric, 2),
    'km_rebocado', p.km_rebocado,
    'trajeto', public.assinatura_do_trajeto(p.origem, p.destino, p.km_rebocado),
    'tabela', to_jsonb(tabela),
    -- O adicional de feriado é decidido na data de Brasília; um dia de folga para cada lado.
    'feriados', coalesce(
      (select jsonb_agg(distinct to_char(f.data, 'YYYY-MM-DD'))
       from public.feriados f
       where f.data between hoje - 1 and hoje + 1),
      '[]'::jsonb
    )
  );
end;
$$;

comment on function public.dados_da_cotacao is
  'Dados para a Edge Function cotar-pedido calcular o Preço fechado (RF05). Só service_role.';

create function public.gravar_cotacao(
  pedido_id uuid,
  cliente_id uuid,
  trajeto text,
  km_ate_veiculo numeric,
  tabela_precos_versao integer,
  preco_taxa_base integer,
  preco_ate_veiculo integer,
  preco_rebocado integer,
  preco_adicional_noturno integer,
  preco_adicional_feriado integer,
  preco_ajuste_minimo integer,
  preco_total integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.pedidos p
    where p.id = gravar_cotacao.pedido_id
      and p.cliente_id = gravar_cotacao.cliente_id
      and p.estado = 'cotado'
  ) then
    raise exception 'Pedido em cotado não encontrado' using errcode = 'P0002';
  end if;

  -- Os checks da tabela conferem a decomposição (soma o total, tudo ou nada, com trajeto).
  update public.pedidos p
  set km_ate_veiculo = gravar_cotacao.km_ate_veiculo,
      tabela_precos_versao = gravar_cotacao.tabela_precos_versao,
      preco_taxa_base = gravar_cotacao.preco_taxa_base,
      preco_ate_veiculo = gravar_cotacao.preco_ate_veiculo,
      preco_rebocado = gravar_cotacao.preco_rebocado,
      preco_adicional_noturno = gravar_cotacao.preco_adicional_noturno,
      preco_adicional_feriado = gravar_cotacao.preco_adicional_feriado,
      preco_ajuste_minimo = gravar_cotacao.preco_ajuste_minimo,
      preco_total = gravar_cotacao.preco_total
  where p.id = gravar_cotacao.pedido_id
    and p.cliente_id = gravar_cotacao.cliente_id
    and p.estado = 'cotado'
    and public.assinatura_do_trajeto(p.origem, p.destino, p.km_rebocado)
      = gravar_cotacao.trajeto;

  if not found then
    raise exception 'O trajeto do Pedido mudou durante a cotação' using errcode = 'GCT03';
  end if;
end;
$$;

comment on function public.gravar_cotacao is
  'Grava o Preço fechado calculado pela Edge Function cotar-pedido no Pedido em cotado. Só service_role.';

revoke execute on function public.assinatura_do_trajeto from public, anon, authenticated;
revoke execute on function public.dados_da_cotacao from public, anon, authenticated;
revoke execute on function public.gravar_cotacao from public, anon, authenticated;
grant execute on function public.dados_da_cotacao to service_role;
grant execute on function public.gravar_cotacao to service_role;
