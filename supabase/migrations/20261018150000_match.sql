-- Match por proximidade com timeout e sem_guincheiro (issue #11, RF07; ADR-0002, ADR-0008
-- com a nota de 2026-10-17, ADR-0009).
--
-- Quem decide é a Edge Function `ofertar-proximo` (@guinchei/match + @guinchei/preco); o
-- banco guarda o estado e garante as regras que não podem falhar sob concorrência:
--
--   1. `registrar_pagamento` autorizado leva o Pedido a `confirmado` e já abre a rodada 1
--      (`em_match`), na mesma transação: nenhum Pedido pago fica parado em `confirmado`.
--   2. `ofertar-proximo` lê `dados_do_match` (candidatos elegíveis com a distância de cada
--      um, tentativas da rodada, tabela e instante da cotação), decide e grava por
--      `registrar_tentativa` (oferta com `expira_em`, ou `pulada_teto`) ou encerra a rodada
--      por `encerrar_rodada_sem_guincheiro` (`sem_guincheiro`).
--   3. As duas gravações travam o Pedido (`for update`) e conferem estado, rodada e a
--      quantidade de tentativas lidas: se outra execução gravou antes, falham com GMT03 e a
--      Edge Function relê. O índice único parcial `tentativas_match_uma_aberta_por_pedido`
--      é a última barreira: nunca há duas ofertas abertas para o mesmo Pedido.
--   4. O Guincheiro responde pela API: `aceitar_oferta` (cria a Corrida `aceita` com o
--      repasse oferecido, Pedido `atribuido`, Guincheiro indisponível) ou `recusar_oferta`.
--   5. O job `match-varrer` do pg_cron (a cada 5 s) chama `varrer_match`, que expira as
--      ofertas vencidas (`for update skip locked`) e pede a próxima oferta. A recusa e o
--      "tentar de novo" pedem a próxima oferta na hora. O pedido é um POST assíncrono
--      (pg_net) para a Edge Function, com a URL e a chave no Vault (`disparar_ofertar_proximo`);
--      a varredura também repete o pedido para Pedidos em `em_match` parados sem oferta
--      aberta, caso um POST tenha se perdido.
--   6. Sem aceite, o pagamento continua autorizado e o Cliente escolhe: `tentar_de_novo`
--      (nova rodada, mesmo Preço fechado e mesma autorização) ou estornar (Edge Function
--      `estornar-pedido`: `pagamento_para_estornar` e `registrar_estorno`).
--
-- Códigos de erro próprios:
--   GMT01  a oferta não está mais aberta (respondida, expirada ou o Pedido já saiu do Match)
--   GMT02  o Guincheiro não está disponível para aceitar
--   GMT03  o Match do Pedido mudou desde a leitura (outra execução gravou antes)
--   GPG03  Pedido sem pagamento autorizado para estornar
--   P0002  oferta ou Pedido não encontrado para quem chamou

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Parâmetros
-- ---------------------------------------------------------------------------

-- Uma linha só. O timeout e o teto mudam sem deploy (e o teste de integração encurta o
-- timeout para não esperar 30 s).
create table public.parametros_match (
  id boolean primary key default true check (id),
  -- ~30 s para o Guincheiro aceitar (ADR-0002).
  timeout_oferta_segundos integer not null default 30
    check (timeout_oferta_segundos between 1 and 600),
  -- Teto de tentativas por rodada (ADR-0008); `pulada_teto` não conta.
  limite_tentativas integer not null default 3 check (limite_tentativas >= 1),
  atualizado_em timestamptz not null default now()
);

comment on table public.parametros_match is
  'Parâmetros do Match (uma linha): timeout da oferta e teto de tentativas por rodada.';

insert into public.parametros_match default values;

create trigger parametros_match_atualizado_em
before update on public.parametros_match
for each row execute function public.definir_atualizado_em();

revoke all on public.parametros_match from anon, authenticated;
alter table public.parametros_match enable row level security;

-- ---------------------------------------------------------------------------
-- Colunas novas
-- ---------------------------------------------------------------------------

alter table public.pedidos
  -- Rodada atual do Match; 0 antes de o pagamento ser autorizado.
  add column rodada_match integer not null default 0 check (rodada_match >= 0),
  -- Instante usado no cálculo do Preço fechado: a oferta a cada Guincheiro é recalculada
  -- com a mesma tabela, os mesmos feriados e este instante (ADR-0009).
  add column cotado_em timestamptz;

alter table public.tentativas_match
  -- Distância deste Guincheiro até o veículo, usada no preço recalculado.
  add column km_ate_veiculo numeric(7, 2) not null check (km_ate_veiculo >= 0),
  -- Prazo para aceitar; `pulada_teto` não chega ao Guincheiro e não tem prazo.
  add column expira_em timestamptz,
  -- Quando foi aceita, recusada ou expirada.
  add column respondida_em timestamptz,
  -- A varredura só expira oferta com prazo.
  add constraint tentativas_match_oferta_tem_prazo check (
    resultado <> 'oferecida' or expira_em is not null
  );

-- Nunca duas ofertas abertas para o mesmo Pedido, por mais execuções simultâneas que haja.
create unique index tentativas_match_uma_aberta_por_pedido
on public.tentativas_match (pedido_id) where resultado = 'oferecida';

-- Para a varredura achar as vencidas.
create index tentativas_match_abertas_por_prazo_idx
on public.tentativas_match (expira_em) where resultado = 'oferecida';

alter table public.corridas
  -- Repasse ao Guincheiro, em centavos: o oferecido a ele no Match (ADR-0009).
  add column repasse integer not null check (repasse >= 0);

-- ---------------------------------------------------------------------------
-- Cotação: grava o instante usado no cálculo
-- ---------------------------------------------------------------------------

-- Feriados perto de uma data de Brasília, como a cotação e o Match leem: um dia de folga
-- para cada lado.
create function public.feriados_perto_de(dia date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select jsonb_agg(distinct to_char(f.data, 'YYYY-MM-DD'))
     from public.feriados f
     where f.data between dia - 1 and dia + 1),
    '[]'::jsonb
  );
$$;

create or replace function public.dados_da_cotacao(pedido_id uuid, cliente_id uuid)
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
    'feriados', public.feriados_perto_de((now() at time zone 'America/Sao_Paulo')::date)
  );
end;
$$;

-- Mesma função, agora com o instante usado no cálculo (o `instante` de `dados_da_cotacao`).
drop function public.gravar_cotacao(
  uuid, uuid, text, numeric, integer, integer, integer, integer, integer, integer, integer, integer
);

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
  preco_total integer,
  instante timestamptz default null
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
      preco_total = gravar_cotacao.preco_total,
      cotado_em = coalesce(gravar_cotacao.instante, now())
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
  'Grava o Preço fechado calculado pela Edge Function cotar-pedido no Pedido em cotado, com o instante do cálculo. Só service_role.';

-- ---------------------------------------------------------------------------
-- Disparo da próxima oferta (pg_net → Edge Function ofertar-proximo)
-- ---------------------------------------------------------------------------

-- Pede à Edge Function `ofertar-proximo` a próxima oferta do Pedido. Assíncrono: o pg_net
-- só envia depois do commit, e uma transação desfeita não envia nada. A URL base das
-- Edge Functions e a chave (service_role) ficam no Vault, com os nomes
-- `match_url_funcoes` e `match_chave_servico` (veja docs/desenvolvimento.md). Sem os dois,
-- não dispara: a varredura é que vai tentar de novo.
create function public.disparar_ofertar_proximo(pedido_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  chave text;
begin
  select decrypted_secret into url
  from vault.decrypted_secrets where name = 'match_url_funcoes';
  select decrypted_secret into chave
  from vault.decrypted_secrets where name = 'match_chave_servico';
  if url is null or chave is null then
    raise warning 'Match: configure match_url_funcoes e match_chave_servico no Vault';
    return null;
  end if;

  return net.http_post(
    url := rtrim(url, '/') || '/ofertar-proximo',
    body := jsonb_build_object('pedido_id', pedido_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || chave
    ),
    timeout_milliseconds := 10000
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Rodadas
-- ---------------------------------------------------------------------------

-- Abre a próxima rodada de um Pedido já travado pelo chamador.
create function public.abrir_rodada_match(pedido_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.pedidos p
  set estado = 'em_match', rodada_match = p.rodada_match + 1
  where p.id = abrir_rodada_match.pedido_id
  returning p.rodada_match;
$$;

-- registrar_pagamento: autorizado, o Pedido vai a `confirmado` e abre a rodada 1.
create or replace function public.registrar_pagamento(
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
    perform public.abrir_rodada_match(registrar_pagamento.pedido_id);
  end if;

  return novo;
end;
$$;

comment on function public.registrar_pagamento is
  'Registra o resultado da autorização; autorizado leva o Pedido a confirmado e abre a rodada 1 do Match (em_match). Só service_role.';

-- ---------------------------------------------------------------------------
-- Leitura e gravação da Edge Function ofertar-proximo
-- ---------------------------------------------------------------------------

create function public.dados_do_match(pedido_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.pedidos;
  instante timestamptz;
begin
  select * into p from public.pedidos where id = dados_do_match.pedido_id;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;
  if p.estado <> 'em_match' then
    return jsonb_build_object('estado', p.estado);
  end if;

  instante := coalesce(p.cotado_em, p.criado_em);
  return jsonb_build_object(
    'estado', p.estado,
    'rodada', p.rodada_match,
    'limite_tentativas', (select m.limite_tentativas from public.parametros_match m),
    'preco_total', p.preco_total,
    'km_rebocado', p.km_rebocado,
    'instante', instante,
    -- A tabela da cotação, não a vigente agora.
    'tabela', (select to_jsonb(t) from public.tabela_precos t where t.versao = p.tabela_precos_versao),
    'feriados', public.feriados_perto_de((instante at time zone 'America/Sao_Paulo')::date),
    'tentativas', coalesce(
      (select jsonb_agg(
         jsonb_build_object('guincheiro_id', t.guincheiro_id, 'resultado', t.resultado)
         order by t.ordem)
       from public.tentativas_match t
       where t.pedido_id = p.id and t.rodada = p.rodada_match),
      '[]'::jsonb
    ),
    -- Do mais perto ao mais longe; km com 2 casas, como na cotação.
    'candidatos', coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'guincheiro_id', e.guincheiro_id,
           'km', round((e.distancia_m / 1000)::numeric, 2))
         order by e.distancia_m, e.guincheiro_id)
       from public.guincheiros_elegiveis_proximos(
         extensions.st_y(p.origem::extensions.geometry),
         extensions.st_x(p.origem::extensions.geometry),
         50
       ) e),
      '[]'::jsonb
    )
  );
end;
$$;

comment on function public.dados_do_match is
  'Dados para a Edge Function ofertar-proximo decidir a próxima oferta. Só service_role.';

-- Trava o Pedido e confere que o Match está como foi lido: em `em_match`, na mesma rodada,
-- com as mesmas tentativas e sem oferta aberta. Senão GMT03.
create function public.travar_match_lido(pedido_id uuid, rodada integer, tentativas_lidas integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pedidos;
begin
  select * into p from public.pedidos where id = travar_match_lido.pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;
  if p.estado <> 'em_match'
    or p.rodada_match <> travar_match_lido.rodada
    or (select count(*) from public.tentativas_match t
        where t.pedido_id = p.id and t.rodada = p.rodada_match) <> tentativas_lidas
    or exists (select 1 from public.tentativas_match t
               where t.pedido_id = p.id and t.resultado in ('oferecida', 'aceita'))
  then
    raise exception 'O Match do Pedido mudou desde a leitura' using errcode = 'GMT03';
  end if;
end;
$$;

create function public.registrar_tentativa(
  pedido_id uuid,
  rodada integer,
  guincheiro_id uuid,
  ordem integer,
  resultado public.resultado_tentativa,
  km_ate_veiculo numeric,
  preco_recalculado integer,
  repasse_oferecido integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  parametros public.parametros_match;
  nova bigint;
begin
  if resultado not in ('oferecida', 'pulada_teto') then
    raise exception 'Registra-se oferecida ou pulada_teto, não %', resultado
      using errcode = '22023';
  end if;

  perform public.travar_match_lido(pedido_id, rodada, ordem - 1);
  select * into parametros from public.parametros_match;

  if resultado = 'oferecida' and (
    -- Teto de tentativas (a Edge Function já decide assim; aqui é a garantia).
    (select count(*) from public.tentativas_match t
     where t.pedido_id = registrar_tentativa.pedido_id
       and t.rodada = registrar_tentativa.rodada
       and t.resultado <> 'pulada_teto') >= parametros.limite_tentativas
    -- O candidato continua elegível (pode ter aceitado outro Pedido desde a leitura).
    or not exists (
      select 1 from public.guincheiros g join public.frotas f on f.id = g.frota_id
      where g.id = registrar_tentativa.guincheiro_id and g.disponivel and f.ativa
    )
  ) then
    raise exception 'O Match do Pedido mudou desde a leitura' using errcode = 'GMT03';
  end if;

  insert into public.tentativas_match (
    pedido_id, guincheiro_id, rodada, ordem, resultado, km_ate_veiculo,
    preco_recalculado, repasse_oferecido, expira_em
  ) values (
    pedido_id, guincheiro_id, rodada, ordem, resultado, km_ate_veiculo,
    preco_recalculado, repasse_oferecido,
    case when resultado = 'oferecida'
      then now() + make_interval(secs => parametros.timeout_oferta_segundos)
    end
  )
  returning id into nova;
  return nova;
end;
$$;

comment on function public.registrar_tentativa is
  'Grava a oferta (com expiração) ou a pulada_teto decidida pela Edge Function ofertar-proximo, conferindo que nada mudou desde a leitura (GMT03). Só service_role.';

create function public.encerrar_rodada_sem_guincheiro(
  pedido_id uuid,
  rodada integer,
  tentativas_lidas integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.travar_match_lido(pedido_id, rodada, tentativas_lidas);
  update public.pedidos p set estado = 'sem_guincheiro'
  where p.id = encerrar_rodada_sem_guincheiro.pedido_id;
end;
$$;

comment on function public.encerrar_rodada_sem_guincheiro is
  'Rodada esgotada: o Pedido vai a sem_guincheiro (o pagamento continua autorizado). Só service_role.';

-- ---------------------------------------------------------------------------
-- Varredura (pg_cron)
-- ---------------------------------------------------------------------------

-- Expira as ofertas vencidas e pede a próxima oferta dos Pedidos afetados. Também pede de
-- novo para os Pedidos em `em_match` sem oferta aberta e parados há mais de 15 s (um POST
-- perdido, a primeira oferta que falhou na confirmação). Devolve os Pedidos para os quais
-- pediu. Duas varreduras ao mesmo tempo não expiram a mesma oferta (`skip locked`), e o
-- pedido em dobro não abre duas ofertas (ver `registrar_tentativa`).
create function public.varrer_match()
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo uuid;
begin
  for alvo in
    with vencidas as (
      select t.id from public.tentativas_match t
      where t.resultado = 'oferecida' and t.expira_em <= now()
      for update skip locked
    ),
    expiradas as (
      update public.tentativas_match t
      set resultado = 'expirada', respondida_em = now()
      from vencidas v
      where t.id = v.id
      returning t.pedido_id
    ),
    parados as (
      select p.id as pedido_id
      from public.pedidos p
      where p.estado = 'em_match'
        and not exists (
          select 1 from public.tentativas_match t
          where t.pedido_id = p.id and t.resultado = 'oferecida'
        )
        and coalesce(
          (select max(coalesce(t.respondida_em, t.criado_em)) from public.tentativas_match t
           where t.pedido_id = p.id and t.rodada = p.rodada_match),
          p.atualizado_em
        ) < now() - interval '15 seconds'
    )
    select pedido_id from expiradas
    union
    select pedido_id from parados
  loop
    perform public.disparar_ofertar_proximo(alvo);
    return next alvo;
  end loop;
end;
$$;

comment on function public.varrer_match is
  'Job match-varrer do pg_cron: expira ofertas vencidas e pede a próxima oferta.';

select cron.schedule('match-varrer', '5 seconds', 'select public.varrer_match()');

-- ---------------------------------------------------------------------------
-- Ações do Guincheiro (API)
-- ---------------------------------------------------------------------------

-- Trava o Pedido da oferta e a oferta do Guincheiro logado; confere que está aberta.
create function public.travar_oferta_aberta(tentativa_id bigint)
returns public.tentativas_match
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tentativas_match;
begin
  -- Pedido antes da tentativa: a mesma ordem de travas de `registrar_tentativa`.
  perform 1 from public.pedidos p
  where p.id = (select x.pedido_id from public.tentativas_match x
                where x.id = travar_oferta_aberta.tentativa_id)
  for update;

  select * into t from public.tentativas_match x
  where x.id = travar_oferta_aberta.tentativa_id
    and x.guincheiro_id = (select auth.uid())
    and x.resultado <> 'pulada_teto'
  for update;
  if not found then
    raise exception 'Oferta não encontrada' using errcode = 'P0002';
  end if;
  if t.resultado <> 'oferecida' or t.expira_em <= now() then
    raise exception 'A oferta não está mais disponível' using errcode = 'GMT01';
  end if;
  return t;
end;
$$;

create function public.aceitar_oferta(tentativa_id bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tentativas_match;
  corrida uuid;
begin
  t := public.travar_oferta_aberta(tentativa_id);

  perform 1 from public.guincheiros g
  where g.id = t.guincheiro_id and g.disponivel
  for update;
  if not found then
    raise exception 'Fique disponível para aceitar' using errcode = 'GMT02';
  end if;

  update public.tentativas_match x
  set resultado = 'aceita', respondida_em = now()
  where x.id = t.id;

  insert into public.corridas (pedido_id, guincheiro_id, repasse)
  values (t.pedido_id, t.guincheiro_id, t.repasse_oferecido)
  returning id into corrida;

  update public.pedidos p set estado = 'atribuido' where p.id = t.pedido_id;
  update public.guincheiros g set disponivel = false where g.id = t.guincheiro_id;
  return corrida;
end;
$$;

comment on function public.aceitar_oferta is
  'O Guincheiro aceita a oferta aberta feita a ele: Corrida aceita, Pedido atribuido, Guincheiro indisponível.';

create function public.recusar_oferta(tentativa_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tentativas_match;
begin
  t := public.travar_oferta_aberta(tentativa_id);
  update public.tentativas_match x
  set resultado = 'recusada', respondida_em = now()
  where x.id = t.id;
  perform public.disparar_ofertar_proximo(t.pedido_id);
end;
$$;

comment on function public.recusar_oferta is
  'O Guincheiro recusa a oferta aberta feita a ele; o Match passa ao próximo.';

-- ---------------------------------------------------------------------------
-- Ações do Cliente em sem_guincheiro
-- ---------------------------------------------------------------------------

create function public.tentar_de_novo(pedido_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rodada integer;
begin
  perform 1 from public.pedidos p
  where p.id = tentar_de_novo.pedido_id
    and p.cliente_id = (select auth.uid())
    and p.estado = 'sem_guincheiro'
  for update;
  if not found then
    raise exception 'Pedido sem Guincheiro não encontrado' using errcode = 'P0002';
  end if;
  -- Mesmo Preço fechado e mesma autorização: só abre a rodada.
  rodada := public.abrir_rodada_match(tentar_de_novo.pedido_id);
  perform public.disparar_ofertar_proximo(tentar_de_novo.pedido_id);
  return rodada;
end;
$$;

comment on function public.tentar_de_novo is
  'O Cliente tenta de novo o próprio Pedido em sem_guincheiro: nova rodada do Match, mesmo preço e autorização.';

create function public.pagamento_para_estornar(pedido_id uuid, cliente_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pagamento public.pagamentos;
begin
  perform 1 from public.pedidos p
  where p.id = pagamento_para_estornar.pedido_id
    and p.cliente_id = pagamento_para_estornar.cliente_id
    and p.estado = 'sem_guincheiro';
  if not found then
    raise exception 'Pedido sem Guincheiro não encontrado' using errcode = 'P0002';
  end if;
  select * into pagamento from public.pagamentos pg
  where pg.pedido_id = pagamento_para_estornar.pedido_id and pg.estado = 'autorizado';
  if not found then
    raise exception 'Pedido sem pagamento autorizado' using errcode = 'GPG03';
  end if;
  return jsonb_build_object(
    'referencia_externa', pagamento.referencia_externa,
    'valor', pagamento.valor
  );
end;
$$;

comment on function public.pagamento_para_estornar is
  'Autorização do Pedido em sem_guincheiro, que a Edge Function estornar-pedido estorna. Só service_role.';

create function public.registrar_estorno(
  pedido_id uuid,
  cliente_id uuid,
  referencia_externa text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.pedidos p
  where p.id = registrar_estorno.pedido_id
    and p.cliente_id = registrar_estorno.cliente_id
    and p.estado = 'sem_guincheiro'
  for update;
  if not found then
    raise exception 'Pedido sem Guincheiro não encontrado' using errcode = 'P0002';
  end if;

  update public.pagamentos pg set estado = 'estornado'
  where pg.pedido_id = registrar_estorno.pedido_id
    and pg.referencia_externa = registrar_estorno.referencia_externa
    and pg.estado = 'autorizado';
  if not found then
    raise exception 'Pedido sem pagamento autorizado com essa referência' using errcode = 'GPG03';
  end if;

  update public.pedidos p set estado = 'estornado' where p.id = registrar_estorno.pedido_id;
end;
$$;

comment on function public.registrar_estorno is
  'Registra o estorno feito no GatewayPagamento: pagamento e Pedido estornados. Só service_role.';

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

revoke execute on function
  public.feriados_perto_de(date),
  public.gravar_cotacao(uuid, uuid, text, numeric, integer, integer, integer, integer, integer, integer, integer, integer, timestamptz),
  public.disparar_ofertar_proximo(uuid),
  public.abrir_rodada_match(uuid),
  public.dados_do_match(uuid),
  public.travar_match_lido(uuid, integer, integer),
  public.registrar_tentativa(uuid, integer, uuid, integer, public.resultado_tentativa, numeric, integer, integer),
  public.encerrar_rodada_sem_guincheiro(uuid, integer, integer),
  public.varrer_match(),
  public.travar_oferta_aberta(bigint),
  public.aceitar_oferta(bigint),
  public.recusar_oferta(bigint),
  public.tentar_de_novo(uuid),
  public.pagamento_para_estornar(uuid, uuid),
  public.registrar_estorno(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
  public.gravar_cotacao(uuid, uuid, text, numeric, integer, integer, integer, integer, integer, integer, integer, integer, timestamptz),
  public.dados_do_match(uuid),
  public.registrar_tentativa(uuid, integer, uuid, integer, public.resultado_tentativa, numeric, integer, integer),
  public.encerrar_rodada_sem_guincheiro(uuid, integer, integer),
  public.pagamento_para_estornar(uuid, uuid),
  public.registrar_estorno(uuid, uuid, text)
to service_role;

grant execute on function
  public.aceitar_oferta(bigint),
  public.recusar_oferta(bigint),
  public.tentar_de_novo(uuid)
to authenticated;

-- O job de 5 s grava uma linha por execução em cron.job_run_details (~17 mil por dia):
-- guarda só o último dia.
select cron.schedule(
  'match-limpar-historico-cron',
  '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '1 day'$$
);
