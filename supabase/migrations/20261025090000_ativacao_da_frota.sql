-- Só Frota ativa com tudo homologado entra no Match (issue #50, ADR-0012, invariante 3 / RN03).
--
-- Até aqui a Frota nascia `ativa = false` e a ativação era um UPDATE à mão. Esta migração faz
-- da ativação uma consequência da homologação:
--
--   1. A Frota só passa a `ativa` pela função `ativar_frota` (a ação "Ativar" do Painel), que
--      confere a regra e recusa com a lista do que falta (GAT01). A regra:
--        - alvará e apólice de RC da Frota aprovados e vigentes;
--        - ao menos um veículo com todos os itens (CRLV e fotos) aprovados e vigentes;
--        - ao menos um Guincheiro com CNH, certidão de antecedentes e selfie aprovados e
--          vigentes, vinculado a esse veículo com vínculo `ativo` (CNH × PBT satisfeita).
--      "Vigente" é `item_vigente` (#49): aprovado e dentro da validade. O item aprovado cuja
--      validade passou não conta, mesmo antes de o job diário marcá-lo `vencido`.
--   2. A Frota volta a `ativa = false` sozinha, por trigger, quando a regra deixa de valer:
--      item recusado, vencido ou reenviado, vínculo desfeito ou derrubado.
--   3. A elegibilidade do Match passa a exigir, além de `disponivel` e Frota `ativa`, que o
--      Guincheiro esteja homologado e vinculado a um veículo homologado
--      (`guincheiro_habilitado`). Vale para a lista do Match (`guincheiros_elegiveis_proximos`,
--      que também alimenta a cotação do Preço fechado e `dados_do_match`) e para a conferência
--      que `registrar_tentativa` e `registrar_recotacao` fazem na hora de gravar. A conferência
--      é ao vivo (usa `item_vigente`), então a janela de até um dia entre a validade passar e
--      o job rodar não deixa documento vencido entrar no Match.
--   4. `avaliar_vinculo` (#48) passa a olhar `item_vigente` da CNH, não só `estado = 'aprovado'`.
--   5. `minha_elegibilidade` diz ao Guincheiro, em palavras, por que o plantão está bloqueado.
--
-- Erros (errcode): GAT01 a Frota ainda não cumpre a regra (a lista vem no DETAIL); quem não
-- pode agir recebe 42501 e Frota inexistente é P0002.
--
-- A coluna `frotas.ativa` continua existindo e continua sendo lida pelo Match; o app nunca
-- a escreve (a API não tem UPDATE nela). Quem opera o banco como superusuário (seed, suporte)
-- pode escrevê-la, e é para isso que a conferência ao vivo por Guincheiro existe.

-- ---------------------------------------------------------------------------
-- Vocabulário: o que cada alvo exige e como falar de um item
-- ---------------------------------------------------------------------------

-- Os tipos de item que cada alvo precisa ter, todos vigentes (ADR-0012).
create function public.tipos_exigidos(alvo public.alvo_homologacao)
returns public.tipo_item_homologacao[]
language sql
immutable
set search_path = ''
as $$
  select case alvo
    when 'frota' then array['alvara', 'apolice_rc']::public.tipo_item_homologacao[]
    when 'veiculo' then array['crlv', 'foto_veiculo']::public.tipo_item_homologacao[]
    when 'guincheiro' then array['cnh', 'antecedentes', 'selfie']::public.tipo_item_homologacao[]
  end;
$$;

create function public.nome_do_tipo(tipo public.tipo_item_homologacao)
returns text
language sql
immutable
set search_path = ''
as $$
  select case tipo
    when 'alvara' then 'Alvará'
    when 'apolice_rc' then 'Apólice de RC por avaria'
    when 'crlv' then 'CRLV'
    when 'foto_veiculo' then 'Foto do veículo'
    when 'cnh' then 'CNH'
    when 'antecedentes' then 'Certidão de antecedentes'
    when 'selfie' then 'Selfie'
  end;
$$;

-- Como o item aparece numa lista de pendências.
create function public.situacao_do_item(estado public.estado_homologacao, validade date)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when estado = 'pendente' then 'aguardando aprovação'
    when estado = 'recusado' then 'recusado'
    when estado = 'vencido' then 'vencido'
    when validade is not null and validade < public.hoje_em_brasilia()
      then 'vencido em ' || to_char(validade, 'DD/MM/YYYY')
    else estado::text
  end;
$$;

-- Os itens de um alvo que ainda não valem: existentes e não vigentes, mais os tipos exigidos
-- que nunca foram enviados.
create function public.itens_nao_vigentes(alvo public.alvo_homologacao, alvo_id uuid)
returns table (tipo public.tipo_item_homologacao, situacao text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.tipo, public.situacao_do_item(i.estado, i.validade)
  from public.itens_homologacao i
  where i.alvo = itens_nao_vigentes.alvo
    and i.alvo_id = itens_nao_vigentes.alvo_id
    and not public.item_vigente(i.estado, i.validade)
  union all
  select t.tipo, 'não enviado'
  from unnest(public.tipos_exigidos(itens_nao_vigentes.alvo)) as t (tipo)
  where not exists (
    select 1 from public.itens_homologacao i
    where i.alvo = itens_nao_vigentes.alvo
      and i.alvo_id = itens_nao_vigentes.alvo_id
      and i.tipo = t.tipo
  );
$$;

-- Todos os itens exigidos do alvo existem e valem.
create function public.alvo_homologado(alvo public.alvo_homologacao, alvo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.itens_nao_vigentes(alvo, alvo_id));
$$;

comment on function public.alvo_homologado is
  'Frota, Guincheiro ou veículo com todos os itens exigidos aprovados e vigentes (item_vigente).';

-- ---------------------------------------------------------------------------
-- #48: a CNH precisa estar vigente, não só aprovada
-- ---------------------------------------------------------------------------

create or replace function public.avaliar_vinculo(guincheiro uuid, veiculo uuid)
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
        and i.tipo = 'cnh' and public.item_vigente(i.estado, i.validade)
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
  'Situação do par Guincheiro × veículo: ativo (CNH aprovada e vigente cobre o PBT), pendente (CNH não vigente) ou bloqueado.';

-- ---------------------------------------------------------------------------
-- A regra de ativação: o que falta
-- ---------------------------------------------------------------------------

-- A lista do que falta para a Frota poder ser ativada; vazia quando a regra vale. Cada linha é
-- um item concreto a resolver. Quando falta um veículo ou um Guincheiro homologado, a lista
-- mostra o candidato mais perto de ficar pronto, não todos. Interna: o Painel e o app chamam
-- `pendencias_de_ativacao`.
create function public.frota_pendencias(frota uuid)
returns table (
  ordem integer,
  categoria text,
  descricao text,
  tipo public.tipo_item_homologacao,
  alvo_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  melhor uuid;
  melhor_texto text;
  tem_veiculo boolean;
  tem_guincheiro boolean;
  ha_par boolean;
begin
  -- 1. Itens da própria Frota.
  return query
  select 10, 'frota', public.nome_do_tipo(p.tipo) || ': ' || p.situacao, p.tipo, frota
  from public.itens_nao_vigentes('frota', frota) p
  order by p.tipo, p.situacao;

  -- 2. Ao menos um veículo homologado.
  tem_veiculo := exists (
    select 1 from public.veiculos v
    where v.frota_id = frota and public.alvo_homologado('veiculo', v.id)
  );
  if not tem_veiculo then
    select v.id, substr(v.placa, 1, 3) || '-' || substr(v.placa, 4) into melhor, melhor_texto
    from public.veiculos v
    where v.frota_id = frota
    order by (select count(*) from public.itens_nao_vigentes('veiculo', v.id)), v.criado_em, v.id
    limit 1;
    if melhor is null then
      return query select 20, 'veiculo', 'Nenhum veículo cadastrado', null::public.tipo_item_homologacao, null::uuid;
    else
      return query
      select 20, 'veiculo', public.nome_do_tipo(p.tipo) || ' (' || melhor_texto || '): ' || p.situacao,
             p.tipo, melhor
      from public.itens_nao_vigentes('veiculo', melhor) p
      order by p.tipo, p.situacao;
    end if;
  end if;

  -- 3. Ao menos um Guincheiro homologado.
  tem_guincheiro := exists (
    select 1 from public.guincheiros g
    where g.frota_id = frota and public.alvo_homologado('guincheiro', g.id)
  );
  if not tem_guincheiro then
    select g.id, p.nome into melhor, melhor_texto
    from public.guincheiros g
    join public.perfis p on p.id = g.id
    where g.frota_id = frota
    order by (select count(*) from public.itens_nao_vigentes('guincheiro', g.id)), g.criado_em, g.id
    limit 1;
    if melhor is null then
      return query select 30, 'guincheiro', 'Nenhum Guincheiro na Frota', null::public.tipo_item_homologacao, null::uuid;
    else
      return query
      select 30, 'guincheiro', public.nome_do_tipo(p.tipo) || ' de ' || melhor_texto || ': ' || p.situacao,
             p.tipo, melhor
      from public.itens_nao_vigentes('guincheiro', melhor) p
      order by p.tipo, p.situacao;
    end if;
  end if;

  -- 4. Um Guincheiro homologado vinculado (vínculo ativo: CNH × PBT) a um veículo homologado.
  ha_par := exists (
    select 1
    from public.vinculos_veiculo l
    where l.frota_id = frota
      and public.alvo_homologado('veiculo', l.veiculo_id)
      and public.alvo_homologado('guincheiro', l.guincheiro_id)
      and public.avaliar_vinculo(l.guincheiro_id, l.veiculo_id) = 'ativo'
  );
  if not ha_par and (
    (tem_veiculo and tem_guincheiro)
    or not exists (select 1 from public.vinculos_veiculo l where l.frota_id = frota)
  ) then
    return query
    select 40, 'vinculo', 'Nenhum Guincheiro homologado vinculado a um veículo homologado',
           null::public.tipo_item_homologacao, null::uuid;
  end if;
end;
$$;

comment on function public.frota_pendencias is
  'O que falta para a Frota poder ser ativada (vazio = regra satisfeita). Interna.';

create function public.frota_pronta(frota uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.frota_pendencias(frota));
$$;

-- Quem lê a lista: a operação (qualquer Frota) e o representante (a própria).
create function public.pendencias_de_ativacao(frota_id uuid)
returns table (
  ordem integer,
  categoria text,
  descricao text,
  tipo public.tipo_item_homologacao,
  alvo_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ((select public.eh_operacao()) or (select public.sou_representante_da_frota(frota_id))) then
    raise exception 'Só a operação e o representante da Frota leem as pendências' using errcode = '42501';
  end if;
  return query
  select p.ordem, p.categoria, p.descricao, p.tipo, p.alvo_id
  from public.frota_pendencias(pendencias_de_ativacao.frota_id) p
  order by p.ordem, p.tipo, p.descricao;
end;
$$;

comment on function public.pendencias_de_ativacao is
  'A lista do que falta para ativar a Frota ("faltam N itens" do Painel); vazia quando pode ser ativada.';

-- ---------------------------------------------------------------------------
-- Ativar e desativar
-- ---------------------------------------------------------------------------

-- A ação "Ativar" do Painel: só a operação, e só se a regra vale agora. Ativar de novo uma
-- Frota ativa não muda nada.
create function public.ativar_frota(frota_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  atual public.frotas;
  faltas text[];
begin
  if not (select public.eh_operacao()) then
    raise exception 'Só a operação ativa uma Frota' using errcode = '42501';
  end if;

  select * into atual from public.frotas f where f.id = ativar_frota.frota_id for update;
  if not found then
    raise exception 'Frota não encontrada' using errcode = 'P0002';
  end if;
  if atual.ativa and public.frota_pronta(atual.id) then
    return;
  end if;

  select array_agg(p.descricao order by p.ordem, p.tipo, p.descricao) into faltas
  from public.frota_pendencias(atual.id) p;
  if faltas is not null then
    raise exception 'Faltam % % para ativar a Frota',
      cardinality(faltas), case when cardinality(faltas) = 1 then 'item' else 'itens' end
      using errcode = 'GAT01', detail = array_to_string(faltas, '; ');
  end if;

  update public.frotas f set ativa = true where f.id = atual.id;
end;
$$;

comment on function public.ativar_frota is
  'Só a operação: ativa a Frota se a regra de homologação vale (GAT01 com a lista do que falta).';

-- Volta a Frota a inativa quando a regra deixou de valer. Interna: os triggers abaixo.
create function public.reavaliar_frota(frota uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.frotas f
  set ativa = false
  where f.id = reavaliar_frota.frota and f.ativa and not public.frota_pronta(f.id);
$$;

create function public.reavaliar_frota_do_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.reavaliar_frota(new.frota_id);
  return null;
end;
$$;

create trigger itens_homologacao_reavaliar_frota
after insert or update of estado, validade on public.itens_homologacao
for each row execute function public.reavaliar_frota_do_item();

create function public.reavaliar_frota_do_vinculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.reavaliar_frota(coalesce(new.frota_id, old.frota_id));
  return null;
end;
$$;

create trigger vinculos_veiculo_reavaliar_frota
after update or delete on public.vinculos_veiculo
for each row execute function public.reavaliar_frota_do_vinculo();

-- As Frotas que já cumprem a regra e esperam a operação ativar, para a fila do Painel.
-- `pronta_desde`: a última decisão da operação nos itens da Frota.
create function public.frotas_prontas_para_ativar()
returns table (id uuid, nome text, tipo public.tipo_frota, documento text, pronta_desde timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.eh_operacao()) then
    raise exception 'Só a operação lê a fila de ativação' using errcode = '42501';
  end if;
  return query
  select f.id, f.nome, f.tipo, f.documento,
         coalesce((select max(i.decidido_em) from public.itens_homologacao i where i.frota_id = f.id),
                  f.criado_em)
  from public.frotas f
  where not f.ativa and public.frota_pronta(f.id)
  order by 5, f.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Elegibilidade do Guincheiro
-- ---------------------------------------------------------------------------

-- Habilitado: a Frota tem alvará e apólice vigentes, o Guincheiro tem CNH, certidão e selfie
-- vigentes e está vinculado (vínculo `ativo` ao vivo: CNH vigente cobre o PBT) a um veículo
-- com todos os itens vigentes. Não olha `disponivel` nem `frotas.ativa`.
create function public.guincheiro_habilitado(guincheiro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guincheiros g
    join public.vinculos_veiculo l on l.guincheiro_id = g.id
    where g.id = guincheiro_habilitado.guincheiro
      and public.alvo_homologado('frota', g.frota_id)
      and public.alvo_homologado('guincheiro', g.id)
      and public.alvo_homologado('veiculo', l.veiculo_id)
      and public.avaliar_vinculo(g.id, l.veiculo_id) = 'ativo'
  );
$$;

comment on function public.guincheiro_habilitado is
  'Guincheiro com tudo homologado e vigente, vinculado a veículo homologado, de Frota com documentos vigentes. Não olha disponivel nem frotas.ativa.';

-- O Guincheiro entra no Match: disponível, de Frota ativa e habilitado.
create function public.guincheiro_elegivel(guincheiro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guincheiros g
    join public.frotas f on f.id = g.frota_id
    where g.id = guincheiro_elegivel.guincheiro
      and g.disponivel and f.ativa
      and public.guincheiro_habilitado(g.id)
  );
$$;

comment on function public.guincheiro_elegivel is
  'Elegível ao Match: disponivel, Frota ativa e Guincheiro habilitado (homologado e vinculado a veículo homologado).';

-- Por que o plantão do Guincheiro logado está bloqueado. Vazia = pode ligar o plantão.
create function public.minha_elegibilidade()
returns table (codigo text, descricao text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  frota public.frotas;
  veiculo record;
begin
  select f.* into frota
  from public.guincheiros g join public.frotas f on f.id = g.frota_id
  where g.id = eu;
  if not found then
    return;
  end if;

  return query
  select 'documento', public.nome_do_tipo(p.tipo) || ': ' || p.situacao
  from public.itens_nao_vigentes('guincheiro', eu) p
  order by p.tipo;

  select v.id, v.placa into veiculo
  from public.vinculos_veiculo l join public.veiculos v on v.id = l.veiculo_id
  where l.guincheiro_id = eu;
  if not found then
    return query select 'sem_veiculo',
      'Você ainda não está vinculado a um veículo da Frota.';
  elsif not public.alvo_homologado('veiculo', veiculo.id) then
    return query select 'veiculo_pendente',
      'O veículo ' || substr(veiculo.placa, 1, 3) || '-' || substr(veiculo.placa, 4)
      || ' ainda não foi aprovado pela operação.';
  end if;

  if not frota.ativa or not public.alvo_homologado('frota', frota.id) then
    return query select 'frota_inativa',
      'A Frota ' || frota.nome || ' ainda não está ativa. A operação ativa quando os documentos da Frota, um veículo e um Guincheiro estiverem aprovados.';
  end if;
end;
$$;

comment on function public.minha_elegibilidade is
  'Os motivos de o Guincheiro logado não poder receber chamados (documento, veículo, Frota); vazia se está habilitado.';

-- ---------------------------------------------------------------------------
-- GRANTs
-- ---------------------------------------------------------------------------

revoke execute on function
  public.tipos_exigidos, public.nome_do_tipo, public.situacao_do_item,
  public.itens_nao_vigentes, public.alvo_homologado, public.frota_pendencias,
  public.frota_pronta, public.pendencias_de_ativacao, public.ativar_frota,
  public.reavaliar_frota, public.reavaliar_frota_do_item, public.reavaliar_frota_do_vinculo,
  public.frotas_prontas_para_ativar, public.guincheiro_habilitado, public.guincheiro_elegivel,
  public.minha_elegibilidade
from public, anon, authenticated;
grant execute on function
  public.pendencias_de_ativacao, public.ativar_frota, public.frotas_prontas_para_ativar,
  public.minha_elegibilidade
to authenticated;
-- O Match roda como service_role: a lista de elegíveis e as conferências usam estas.
grant execute on function
  public.guincheiro_habilitado, public.guincheiro_elegivel, public.alvo_homologado,
  public.itens_nao_vigentes, public.tipos_exigidos, public.situacao_do_item,
  public.nome_do_tipo
to service_role;

-- ---------------------------------------------------------------------------
-- Match: elegibilidade e conferência na gravação
-- ---------------------------------------------------------------------------

-- Lista do Match e da cotação: além de disponível e de Frota ativa, o Guincheiro precisa estar
-- habilitado (homologado e vinculado a veículo homologado).
create or replace function public.guincheiros_elegiveis_proximos(
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
  where g.disponivel and f.ativa and public.guincheiro_habilitado(g.id)
  order by extensions.st_distance(g.posicao, ponto.g), g.id
  limit limite;
$$;

create or replace function public.registrar_tentativa(
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
    -- O candidato continua elegível (pode ter aceitado outro Pedido, ou perdido a homologação,
    -- desde a leitura).
    or not public.guincheiro_elegivel(registrar_tentativa.guincheiro_id)
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

create or replace function public.registrar_recotacao(
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
  from public.guincheiros g
  where g.id = registrar_recotacao.guincheiro_id
    and public.guincheiro_elegivel(g.id);
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
