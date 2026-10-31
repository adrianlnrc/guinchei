-- Preço fechado refeito quando o Pedido é redirecionado a outra Frota (issue #58, ADR-0013,
-- que revisa o ADR-0009 e a invariante 2 do CONTEXT.md).
--
-- O Preço fechado é cotado com o Guincheiro elegível mais próximo; a Frota dele é a Frota
-- cotada (`pedidos.frota_cotada_id`). Enquanto o Match oferece a Guincheiros da mesma Frota,
-- nada muda (ADR-0009). Quando o próximo candidato é de outra Frota, a Edge Function
-- `ofertar-proximo` recalcula o preço com a distância dele e decide com `decidirRecotacao`
-- (@guinchei/match):
--
--   - menor ou igual: `registrar_recotacao(exige_aprovacao => false)` grava a recotação
--     `aplicada`, o Pedido passa a valer o novo preço, a Frota cotada passa a ser a nova e a
--     autorização cai para o novo valor (a diferença é estornada; no mock, só o registro);
--   - maior: `registrar_recotacao(exige_aprovacao => true)` grava a recotação `pendente` e
--     o Pedido vai a `aguardando_aprovacao_preco`. Nenhuma oferta sai. O Cliente decide:
--       `aprovar_novo_preco`     -> `aprovada`: novo preço e Frota cotada valem, a
--                                   autorização sobe (no mock, só o registro), o Pedido volta
--                                   a `em_match` e o Match continua com essa Frota;
--       `desistir_do_novo_preco` -> `desistida`: estorno integral, Pedido `estornado`;
--       prazo vencido (`varrer_aprovacoes_de_preco`, pg_cron) -> `expirada`, igual a desistir.
--
-- Provisório (RF12): o estorno e a autorização da diferença só mexem em `pagamentos`; o
-- GatewayPagamento mock não guarda estado. Com o PSP real, as duas respostas do Cliente e o
-- prazo vencido passam por uma Edge Function que chama o PSP antes de gravar.
--
-- Códigos de erro próprios:
--   GRC01  o prazo para aprovar o novo preço venceu
--   GMT03  (já existente) o Match mudou desde a leitura
--   P0002  Pedido sem preço a aprovar para quem chamou
--   22023  recotação incoerente com o Pedido (mesma Frota, preço no lado errado)

-- ---------------------------------------------------------------------------
-- Transições do Pedido
-- ---------------------------------------------------------------------------

-- Espelho das linhas novas de TRANSICOES_PEDIDO (@guinchei/estados); o teste
-- `packages/estados/src/sincronia-sql.test.ts` lê este bloco junto com o da migração inicial.
-- inicio:transicoes_pedido_recotacao
insert into public.transicoes_pedido (de, para) values
  ('em_match', 'aguardando_aprovacao_preco'),
  ('aguardando_aprovacao_preco', 'em_match'),
  ('aguardando_aprovacao_preco', 'estornado');
-- fim:transicoes_pedido_recotacao

-- ---------------------------------------------------------------------------
-- Colunas e parâmetro
-- ---------------------------------------------------------------------------

alter table public.pedidos
  -- Frota do Guincheiro com quem o Preço fechado foi cotado (ou da última recotação).
  -- Nula em Pedido cotado antes do ADR-0013: o Match não recota esse Pedido.
  add column frota_cotada_id uuid references public.frotas (id);

alter table public.parametros_match
  -- Prazo para o Cliente aprovar o novo preço; vencido, vale como desistência.
  add column prazo_aprovacao_preco_segundos integer not null default 120
    check (prazo_aprovacao_preco_segundos between 1 and 3600);

-- ---------------------------------------------------------------------------
-- Histórico de recotações
-- ---------------------------------------------------------------------------

create type public.resultado_recotacao as enum (
  'aplicada', 'pendente', 'aprovada', 'desistida', 'expirada'
);

create table public.recotacoes_pedido (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos (id),
  rodada integer not null check (rodada >= 1),
  -- O candidato de outra Frota que motivou a recotação.
  guincheiro_id uuid not null references public.guincheiros (id),
  frota_anterior_id uuid not null references public.frotas (id),
  frota_nova_id uuid not null references public.frotas (id),
  km_ate_veiculo numeric(7, 2) not null check (km_ate_veiculo >= 0),
  -- Centavos: o Preço fechado em vigor antes e o recalculado com a distância do candidato.
  preco_anterior integer not null check (preco_anterior > 0),
  preco_novo integer not null check (preco_novo > 0),
  -- Decomposição do preço novo, como em `pedidos` (ADR-0009).
  tabela_precos_versao integer not null references public.tabela_precos (versao),
  preco_taxa_base integer not null check (preco_taxa_base >= 0),
  preco_ate_veiculo integer not null check (preco_ate_veiculo >= 0),
  preco_rebocado integer not null check (preco_rebocado >= 0),
  preco_adicional_noturno integer not null default 0 check (preco_adicional_noturno >= 0),
  preco_adicional_feriado integer not null default 0 check (preco_adicional_feriado >= 0),
  preco_ajuste_minimo integer not null default 0 check (preco_ajuste_minimo >= 0),
  resultado public.resultado_recotacao not null,
  -- Prazo para o Cliente responder; só a recotação pendente tem.
  expira_em timestamptz,
  criado_em timestamptz not null default now(),
  respondida_em timestamptz,
  constraint recotacoes_pedido_decomposicao_soma_o_total check (
    preco_taxa_base + preco_ate_veiculo + preco_rebocado + preco_adicional_noturno
      + preco_adicional_feriado + preco_ajuste_minimo = preco_novo
  ),
  constraint recotacoes_pedido_outra_frota check (frota_anterior_id <> frota_nova_id),
  constraint recotacoes_pedido_pendente_tem_prazo check (
    resultado <> 'pendente' or expira_em is not null
  ),
  -- Só pede aprovação quem sobe o preço; só aplica sem pausa quem não sobe.
  constraint recotacoes_pedido_aplicada_nao_sobe check (
    resultado <> 'aplicada' or preco_novo <= preco_anterior
  ),
  constraint recotacoes_pedido_pendente_sobe check (
    resultado <> 'pendente' or preco_novo > preco_anterior
  )
);

comment on table public.recotacoes_pedido is
  'Histórico de cotações do Pedido redirecionado a outra Frota (ADR-0013): preço anterior e novo, decomposição e desfecho. Escrita só pelas funções.';

create index recotacoes_pedido_pedido_id_idx on public.recotacoes_pedido (pedido_id);

-- Nunca duas recotações pendentes para o mesmo Pedido.
create unique index recotacoes_pedido_uma_pendente_por_pedido
on public.recotacoes_pedido (pedido_id) where resultado = 'pendente';

-- Para a varredura achar as vencidas.
create index recotacoes_pedido_pendentes_por_prazo_idx
on public.recotacoes_pedido (expira_em) where resultado = 'pendente';

-- RLS: o Cliente lê as do próprio Pedido (a tela de aprovação e o aviso), a operação lê
-- todas (Monitor); o Guincheiro não vê. Ninguém escreve pela API.
revoke all on public.recotacoes_pedido from anon, authenticated;
grant select on public.recotacoes_pedido to authenticated;
alter table public.recotacoes_pedido enable row level security;

create policy "recotacoes_pedido: o Cliente lê as do próprio Pedido; a operação lê todas"
on public.recotacoes_pedido for select to authenticated
using (public.sou_cliente_do_pedido(pedido_id) or (select public.eh_operacao()));

-- ---------------------------------------------------------------------------
-- Cotação: grava a Frota cotada
-- ---------------------------------------------------------------------------

-- Mesma função, agora devolvendo também a Frota do Guincheiro elegível mais próximo.
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
  frota uuid;
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

  select e.distancia_m, e.frota_id into distancia_m, frota
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
    'feriados', public.feriados_perto_de((now() at time zone 'America/Sao_Paulo')::date),
    -- A Frota cotada (ADR-0013).
    'frota_id', frota
  );
end;
$$;

drop function public.gravar_cotacao(
  uuid, uuid, text, numeric, integer, integer, integer, integer, integer, integer, integer, integer,
  timestamptz
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
  instante timestamptz default null,
  frota_cotada_id uuid default null
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
      cotado_em = coalesce(gravar_cotacao.instante, now()),
      frota_cotada_id = gravar_cotacao.frota_cotada_id
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
  'Grava o Preço fechado calculado pela Edge Function cotar-pedido no Pedido em cotado, com o instante do cálculo e a Frota cotada (ADR-0013). Só service_role.';

-- ---------------------------------------------------------------------------
-- Leitura do Match: Frota cotada e Frota de cada candidato
-- ---------------------------------------------------------------------------

create or replace function public.dados_do_match(pedido_id uuid)
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
    -- A Frota com quem o preço em vigor foi cotado (ADR-0013); nula em Pedido antigo.
    'frota_cotada_id', p.frota_cotada_id,
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
           'frota_id', e.frota_id,
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

-- ---------------------------------------------------------------------------
-- Match pausando antes de ofertar a outra Frota
-- ---------------------------------------------------------------------------

-- Faz o preço e a Frota de uma recotação valerem no Pedido (já travado pelo chamador) e
-- ajusta a autorização ao novo valor. No mock, a diferença estornada ou autorizada é só este
-- registro; com o PSP real (RF12), uma Edge Function chama o PSP antes.
create function public.valer_recotacao(recotacao_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recotacoes_pedido;
begin
  select * into r from public.recotacoes_pedido x where x.id = valer_recotacao.recotacao_id;
  update public.pedidos p
  set km_ate_veiculo = r.km_ate_veiculo,
      preco_taxa_base = r.preco_taxa_base,
      preco_ate_veiculo = r.preco_ate_veiculo,
      preco_rebocado = r.preco_rebocado,
      preco_adicional_noturno = r.preco_adicional_noturno,
      preco_adicional_feriado = r.preco_adicional_feriado,
      preco_ajuste_minimo = r.preco_ajuste_minimo,
      preco_total = r.preco_novo,
      frota_cotada_id = r.frota_nova_id
  where p.id = r.pedido_id;
  update public.pagamentos pg set valor = r.preco_novo
  where pg.pedido_id = r.pedido_id and pg.estado = 'autorizado';
end;
$$;

-- Grava a recotação decidida pela Edge Function (`decidirRecotacao`). Trava o Pedido e
-- confere que o Match está como foi lido (GMT03). Devolve 'aplicada' ou 'pendente'.
create function public.registrar_recotacao(
  pedido_id uuid,
  rodada integer,
  tentativas_lidas integer,
  guincheiro_id uuid,
  km_ate_veiculo numeric,
  preco_taxa_base integer,
  preco_ate_veiculo integer,
  preco_rebocado integer,
  preco_adicional_noturno integer,
  preco_adicional_feriado integer,
  preco_ajuste_minimo integer,
  preco_total integer,
  exige_aprovacao boolean
)
returns public.resultado_recotacao
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pedidos;
  frota_nova uuid;
  nova bigint;
  desfecho public.resultado_recotacao;
begin
  perform public.travar_match_lido(
    registrar_recotacao.pedido_id, registrar_recotacao.rodada, tentativas_lidas
  );
  select * into p from public.pedidos x where x.id = registrar_recotacao.pedido_id;

  -- O candidato continua elegível (pode ter aceitado outro Pedido desde a leitura).
  select g.frota_id into frota_nova
  from public.guincheiros g join public.frotas f on f.id = g.frota_id
  where g.id = registrar_recotacao.guincheiro_id and g.disponivel and f.ativa;
  if not found then
    raise exception 'O Match do Pedido mudou desde a leitura' using errcode = 'GMT03';
  end if;

  if p.frota_cotada_id is null or p.frota_cotada_id = frota_nova then
    raise exception 'Recotação só vale para candidato de outra Frota que a cotada'
      using errcode = '22023';
  end if;
  if exige_aprovacao and registrar_recotacao.preco_total <= p.preco_total then
    raise exception 'Só um preço maior que o atual pede aprovação' using errcode = '22023';
  end if;
  if not exige_aprovacao and registrar_recotacao.preco_total > p.preco_total then
    raise exception 'Um preço maior que o atual só segue com a aprovação do Cliente'
      using errcode = '22023';
  end if;

  desfecho := case when exige_aprovacao
    then 'pendente'::public.resultado_recotacao
    else 'aplicada'::public.resultado_recotacao
  end;

  insert into public.recotacoes_pedido (
    pedido_id, rodada, guincheiro_id, frota_anterior_id, frota_nova_id, km_ate_veiculo,
    preco_anterior, preco_novo, tabela_precos_versao,
    preco_taxa_base, preco_ate_veiculo, preco_rebocado,
    preco_adicional_noturno, preco_adicional_feriado, preco_ajuste_minimo,
    resultado, expira_em, respondida_em
  ) values (
    p.id, registrar_recotacao.rodada, registrar_recotacao.guincheiro_id, p.frota_cotada_id,
    frota_nova, registrar_recotacao.km_ate_veiculo,
    p.preco_total, registrar_recotacao.preco_total, p.tabela_precos_versao,
    registrar_recotacao.preco_taxa_base, registrar_recotacao.preco_ate_veiculo,
    registrar_recotacao.preco_rebocado, registrar_recotacao.preco_adicional_noturno,
    registrar_recotacao.preco_adicional_feriado, registrar_recotacao.preco_ajuste_minimo,
    desfecho,
    case when exige_aprovacao
      then now() + make_interval(
        secs => (select m.prazo_aprovacao_preco_segundos from public.parametros_match m))
    end,
    case when exige_aprovacao then null else now() end
  )
  returning id into nova;

  if exige_aprovacao then
    -- O Match pausa: nenhuma oferta sai até o Cliente responder.
    update public.pedidos x set estado = 'aguardando_aprovacao_preco' where x.id = p.id;
  else
    perform public.valer_recotacao(nova);
  end if;
  return desfecho;
end;
$$;

comment on function public.registrar_recotacao is
  'Grava a recotação do Pedido redirecionado a outra Frota (ADR-0013): menor ou igual vale na hora; maior pausa o Match até o Cliente aprovar. Só service_role.';

-- Encerra o Pedido que aguardava aprovação: estorno integral da autorização e `estornado`.
-- O Pedido já vem travado pelo chamador.
create function public.encerrar_por_novo_preco(pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pagamentos pg set estado = 'estornado'
  where pg.pedido_id = encerrar_por_novo_preco.pedido_id and pg.estado = 'autorizado';
  update public.pedidos p set estado = 'estornado'
  where p.id = encerrar_por_novo_preco.pedido_id;
end;
$$;

-- Trava o Pedido do Cliente logado que aguarda a aprovação e a recotação pendente dele.
create function public.travar_aprovacao_pendente(pedido_id uuid)
returns public.recotacoes_pedido
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recotacoes_pedido;
begin
  perform 1 from public.pedidos p
  where p.id = travar_aprovacao_pendente.pedido_id
    and p.cliente_id = (select auth.uid())
    and p.estado = 'aguardando_aprovacao_preco'
  for update;
  if not found then
    raise exception 'Pedido aguardando aprovação do novo preço não encontrado'
      using errcode = 'P0002';
  end if;
  select * into r from public.recotacoes_pedido x
  where x.pedido_id = travar_aprovacao_pendente.pedido_id and x.resultado = 'pendente'
  for update;
  if not found then
    raise exception 'Pedido aguardando aprovação do novo preço não encontrado'
      using errcode = 'P0002';
  end if;
  return r;
end;
$$;

-- O Cliente aprova o novo preço: ele e a Frota nova valem, a autorização sobe e o Match
-- continua com essa Frota.
create function public.aprovar_novo_preco(pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recotacoes_pedido;
begin
  r := public.travar_aprovacao_pendente(aprovar_novo_preco.pedido_id);
  if r.expira_em <= now() then
    raise exception 'O prazo para aprovar o novo preço venceu' using errcode = 'GRC01';
  end if;
  update public.recotacoes_pedido x
  set resultado = 'aprovada', respondida_em = now()
  where x.id = r.id;
  perform public.valer_recotacao(r.id);
  update public.pedidos p set estado = 'em_match' where p.id = aprovar_novo_preco.pedido_id;
  perform public.disparar_ofertar_proximo(aprovar_novo_preco.pedido_id);
end;
$$;

comment on function public.aprovar_novo_preco is
  'O Cliente aprova o novo preço do Pedido redirecionado a outra Frota: o Match continua com ela (ADR-0013).';

-- O Cliente desiste: estorno integral, sem custo.
create function public.desistir_do_novo_preco(pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recotacoes_pedido;
begin
  r := public.travar_aprovacao_pendente(desistir_do_novo_preco.pedido_id);
  update public.recotacoes_pedido x
  set resultado = 'desistida', respondida_em = now()
  where x.id = r.id;
  perform public.encerrar_por_novo_preco(desistir_do_novo_preco.pedido_id);
end;
$$;

comment on function public.desistir_do_novo_preco is
  'O Cliente desiste do novo preço: estorno integral e Pedido estornado (ADR-0013).';

-- Sem resposta no prazo, vale como desistência. Roda no pg_cron; devolve os Pedidos
-- encerrados. `skip locked`: duas varreduras, ou uma resposta do Cliente em curso, não
-- encerram o mesmo Pedido duas vezes.
create function public.varrer_aprovacoes_de_preco()
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  vencida record;
begin
  for vencida in
    select r.id, r.pedido_id from public.recotacoes_pedido r
    where r.resultado = 'pendente' and r.expira_em <= now()
  loop
    -- Pedido antes da recotação, a mesma ordem de travas de `travar_aprovacao_pendente`.
    perform 1 from public.pedidos p
    where p.id = vencida.pedido_id and p.estado = 'aguardando_aprovacao_preco'
    for update skip locked;
    continue when not found;

    update public.recotacoes_pedido x
    set resultado = 'expirada', respondida_em = now()
    where x.id = vencida.id and x.resultado = 'pendente';
    continue when not found;

    perform public.encerrar_por_novo_preco(vencida.pedido_id);
    return next vencida.pedido_id;
  end loop;
end;
$$;

comment on function public.varrer_aprovacoes_de_preco is
  'Job match-aprovacao-varrer do pg_cron: prazo vencido sem resposta do Cliente vale como desistência.';

select cron.schedule(
  'match-aprovacao-varrer', '5 seconds', 'select public.varrer_aprovacoes_de_preco()'
);

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

revoke execute on function
  public.gravar_cotacao(uuid, uuid, text, numeric, integer, integer, integer, integer, integer, integer, integer, integer, timestamptz, uuid),
  public.valer_recotacao(bigint),
  public.registrar_recotacao(uuid, integer, integer, uuid, numeric, integer, integer, integer, integer, integer, integer, integer, boolean),
  public.encerrar_por_novo_preco(uuid),
  public.travar_aprovacao_pendente(uuid),
  public.aprovar_novo_preco(uuid),
  public.desistir_do_novo_preco(uuid),
  public.varrer_aprovacoes_de_preco()
from public, anon, authenticated;

grant execute on function
  public.gravar_cotacao(uuid, uuid, text, numeric, integer, integer, integer, integer, integer, integer, integer, integer, timestamptz, uuid),
  public.registrar_recotacao(uuid, integer, integer, uuid, numeric, integer, integer, integer, integer, integer, integer, integer, boolean)
to service_role;

grant execute on function
  public.aprovar_novo_preco(uuid),
  public.desistir_do_novo_preco(uuid)
to authenticated;
