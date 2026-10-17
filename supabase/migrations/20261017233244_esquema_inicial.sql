-- Esquema inicial do walking skeleton (issue #6).
-- Modelo de dados mínimo do ADR-0008, com as decisões do grilling de 2026-10-17
-- (ADR-0009 preço, ADR-0010 cadastro por telefone, ADR-0011 Fotos de estado, ADR-0012 Frotas).
-- Valores monetários em centavos (integer); frações (adicionais, Comissão) em numeric.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.papel as enum ('cliente', 'guincheiro', 'operacao');

-- Estados: ver packages/estados e a migração de transições.
-- `estornado` é o desfecho terminal de `sem_guincheiro` quando o Cliente desiste e o
-- pagamento é estornado (nota de revisão do ADR-0008). Sem estados de cancelamento (RF14).
create type public.estado_pedido as enum (
  'cotado', 'confirmado', 'em_match', 'atribuido', 'sem_guincheiro', 'estornado'
);
create type public.estado_corrida as enum (
  'aceita', 'a_caminho', 'no_local', 'carregado', 'entregue'
);

create type public.tipo_frota as enum ('empresa', 'autonomo');
create type public.abrangencia_feriado as enum ('nacional', 'df');
create type public.resultado_tentativa as enum (
  'oferecida', 'aceita', 'recusada', 'expirada', 'pulada_teto'
);
create type public.tipo_midia as enum ('foto', 'video');

-- Opções do Pedido em três toques (RF03), como no protótipo navegável.
create type public.tipo_veiculo as enum ('carro', 'suv', 'moto', 'van');
create type public.situacao_veiculo as enum ('nao_liga', 'batida', 'superaqueceu', 'outro');
create type public.rodas_giram as enum ('sim', 'nao', 'nao_sei');

-- ---------------------------------------------------------------------------
-- Validação de documentos
-- ---------------------------------------------------------------------------

-- CPF: 11 dígitos, sem máscara, com os dois dígitos verificadores corretos.
create function public.cpf_valido(cpf text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  d int[];
  soma int;
  dv int;
begin
  if cpf !~ '^\d{11}$' or cpf ~ '^(\d)\1{10}$' then
    return false;
  end if;
  d := array(select substr(cpf, i, 1)::int from generate_series(1, 11) as i);

  soma := 0;
  for i in 1..9 loop
    soma := soma + d[i] * (11 - i);
  end loop;
  dv := (soma * 10) % 11 % 10;
  if dv <> d[10] then
    return false;
  end if;

  soma := 0;
  for i in 1..10 loop
    soma := soma + d[i] * (12 - i);
  end loop;
  dv := (soma * 10) % 11 % 10;
  return dv = d[11];
end;
$$;

-- CNPJ: 14 caracteres sem máscara. Aceita o CNPJ alfanumérico (IN RFB 2.229/2024): as 12
-- primeiras posições podem ser [0-9A-Z], valendo o código ASCII menos 48; os dois
-- verificadores são sempre numéricos (módulo 11).
create function public.cnpj_valido(cnpj text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v int[];
  pesos1 int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  pesos2 int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma int;
  dv int;
begin
  if cnpj !~ '^[0-9A-Z]{12}\d{2}$' or cnpj ~ '^(\d)\1{13}$' then
    return false;
  end if;
  v := array(select ascii(substr(cnpj, i, 1)) - 48 from generate_series(1, 14) as i);

  soma := 0;
  for i in 1..12 loop
    soma := soma + v[i] * pesos1[i];
  end loop;
  dv := case when soma % 11 < 2 then 0 else 11 - soma % 11 end;
  if dv <> v[13] then
    return false;
  end if;

  soma := 0;
  for i in 1..13 loop
    soma := soma + v[i] * pesos2[i];
  end loop;
  dv := case when soma % 11 < 2 then 0 else 11 - soma % 11 end;
  return dv = v[14];
end;
$$;

-- Mantém `atualizado_em` nas tabelas que mudam de estado.
create function public.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfis (ADR-0010)
-- ---------------------------------------------------------------------------

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  papel public.papel not null,
  nome text not null check (length(trim(nome)) > 0),
  -- E.164 sem o "+", como o Supabase Auth grava em auth.users.phone.
  telefone text not null unique check (telefone ~ '^\d{10,15}$'),
  cpf text not null unique check (public.cpf_valido(cpf)),
  -- Cadastro urgente: aceite dos termos de uso (versão aceita e quando).
  aceite_termos_em timestamptz not null,
  aceite_termos_versao text not null check (length(trim(aceite_termos_versao)) > 0),
  -- Cadastro completo, opcional e nunca bloqueante.
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- 18+ quando preenchida. current_date num check é avaliado só na escrita da linha.
  data_nascimento date check (data_nascimento <= current_date - interval '18 years'),
  telefone_secundario text check (telefone_secundario ~ '^\d{10,15}$'),
  criado_em timestamptz not null default now()
);

comment on table public.perfis is
  'Uma linha por usuário do Auth: Cliente, Guincheiro ou operação (ADR-0010).';

-- Usado nos checks de guincheiros.id e pedidos.cliente_id. Como todo check que consulta
-- outra tabela, vale na escrita da linha; o papel de um perfil não muda pela API.
create function public.perfil_tem_papel(perfil_id uuid, esperado public.papel)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfis where id = perfil_id and papel = esperado);
$$;

-- ---------------------------------------------------------------------------
-- Frotas e Guincheiros (ADR-0012)
-- ---------------------------------------------------------------------------

create table public.frotas (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_frota not null,
  -- Empresa: CNPJ. Autônomo: CPF ou CNPJ do MEI. Sem máscara.
  documento text not null unique,
  nome text not null check (length(trim(nome)) > 0),
  -- Só a operação ativa uma Frota, após a verificação manual (invariante 3).
  ativa boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint frotas_documento_valido check (
    case tipo
      when 'empresa' then public.cnpj_valido(documento)
      when 'autonomo' then public.cpf_valido(documento) or public.cnpj_valido(documento)
    end
  )
);

create table public.guincheiros (
  -- O Guincheiro tem conta própria: o id é o do perfil.
  id uuid primary key references public.perfis (id) on delete cascade
    check (public.perfil_tem_papel(id, 'guincheiro')),
  frota_id uuid not null references public.frotas (id),
  -- Posição fixa do seed no skeleton (sem GPS ao vivo, RF09 fora).
  posicao extensions.geography(point, 4326) not null,
  disponivel boolean not null default false,
  criado_em timestamptz not null default now()
);

create index guincheiros_frota_id_idx on public.guincheiros (frota_id);
create index guincheiros_posicao_idx on public.guincheiros using gist (posicao);

-- ---------------------------------------------------------------------------
-- Tabela de preços versionada e feriados (ADR-0009)
-- ---------------------------------------------------------------------------

create table public.tabela_precos (
  versao integer primary key check (versao > 0),
  vigente_desde timestamptz not null unique,
  taxa_base integer not null check (taxa_base >= 0),
  por_km_ate_veiculo integer not null check (por_km_ate_veiculo >= 0),
  por_km_rebocado integer not null check (por_km_rebocado >= 0),
  adicional_noturno numeric(5, 4) not null check (adicional_noturno between 0 and 1),
  -- Horas locais (America/Sao_Paulo); `noturno_ate` é exclusivo e pode virar a meia-noite.
  noturno_das smallint not null check (noturno_das between 0 and 23),
  noturno_ate smallint not null check (noturno_ate between 0 and 23),
  adicional_feriado numeric(5, 4) not null check (adicional_feriado between 0 and 1),
  preco_minimo integer not null check (preco_minimo >= 0),
  comissao numeric(5, 4) not null check (comissao between 0 and 1),
  criado_em timestamptz not null default now()
);

comment on table public.tabela_precos is
  'Versões da tabela do Preço fechado (ADR-0009). A vigente é a de maior vigente_desde <= agora.';

-- Tabela vigente num instante (por padrão, agora).
create function public.tabela_precos_vigente(em timestamptz default now())
returns public.tabela_precos
language sql
stable
set search_path = ''
as $$
  select *
  from public.tabela_precos
  where vigente_desde <= em
  order by vigente_desde desc
  limit 1;
$$;

create table public.feriados (
  data date not null,
  nome text not null check (length(trim(nome)) > 0),
  abrangencia public.abrangencia_feriado not null,
  -- 21/04 é Tiradentes (nacional) e Fundação de Brasília (DF): a data sozinha não é única.
  primary key (data, abrangencia)
);

comment on table public.feriados is
  'Feriados nacionais e do DF que disparam o adicional de feriado (ADR-0009).';

-- ---------------------------------------------------------------------------
-- Pedidos e Corridas
-- ---------------------------------------------------------------------------

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfis (id)
    check (public.perfil_tem_papel(cliente_id, 'cliente')),
  estado public.estado_pedido not null default 'cotado',

  tipo_veiculo public.tipo_veiculo not null,
  situacao public.situacao_veiculo not null,
  rodas_giram public.rodas_giram not null,

  origem extensions.geography(point, 4326) not null,
  origem_endereco text not null,
  destino extensions.geography(point, 4326) not null,
  destino_endereco text not null,
  -- Distância do Guincheiro disponível mais próximo na cotação (nota do ADR-0003).
  km_ate_veiculo numeric(7, 2) not null check (km_ate_veiculo >= 0),
  km_rebocado numeric(7, 2) not null check (km_rebocado >= 0),

  -- Preço fechado travado na cotação, decomposto em centavos (ADR-0009).
  tabela_precos_versao integer not null references public.tabela_precos (versao),
  preco_taxa_base integer not null check (preco_taxa_base >= 0),
  preco_ate_veiculo integer not null check (preco_ate_veiculo >= 0),
  preco_rebocado integer not null check (preco_rebocado >= 0),
  preco_adicional_noturno integer not null default 0 check (preco_adicional_noturno >= 0),
  preco_adicional_feriado integer not null default 0 check (preco_adicional_feriado >= 0),
  -- Complemento até o Preço fechado mínimo, aplicado depois dos adicionais.
  preco_ajuste_minimo integer not null default 0 check (preco_ajuste_minimo >= 0),
  preco_total integer not null check (preco_total > 0),

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint pedidos_decomposicao_soma_o_total check (
    preco_taxa_base + preco_ate_veiculo + preco_rebocado + preco_adicional_noturno
      + preco_adicional_feriado + preco_ajuste_minimo = preco_total
  )
);

create index pedidos_cliente_id_idx on public.pedidos (cliente_id);

create trigger pedidos_atualizado_em
before update on public.pedidos
for each row execute function public.definir_atualizado_em();

create table public.corridas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos (id),
  guincheiro_id uuid not null references public.guincheiros (id),
  estado public.estado_corrida not null default 'aceita',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index corridas_guincheiro_id_idx on public.corridas (guincheiro_id);

create trigger corridas_atualizado_em
before update on public.corridas
for each row execute function public.definir_atualizado_em();

-- ---------------------------------------------------------------------------
-- Tentativas do Match (ADR-0002, ADR-0009)
-- ---------------------------------------------------------------------------

create table public.tentativas_match (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos (id),
  guincheiro_id uuid not null references public.guincheiros (id),
  -- Cada "tentar de novo" abre uma rodada nova, em que todos podem receber o Pedido de novo.
  rodada integer not null check (rodada >= 1),
  ordem integer not null check (ordem >= 1),
  resultado public.resultado_tentativa not null default 'oferecida',
  -- Preço recalculado com a distância deste Guincheiro e o repasse oferecido (ADR-0009).
  preco_recalculado integer not null check (preco_recalculado >= 0),
  repasse_oferecido integer not null check (repasse_oferecido >= 0),
  criado_em timestamptz not null default now(),
  unique (pedido_id, rodada, ordem),
  -- Numa rodada, cada Guincheiro recebe o Pedido no máximo uma vez.
  unique (pedido_id, rodada, guincheiro_id)
);

create index tentativas_match_guincheiro_id_idx on public.tentativas_match (guincheiro_id);

-- ---------------------------------------------------------------------------
-- Fotos de estado (ADR-0011)
-- ---------------------------------------------------------------------------

create table public.fotos_estado (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.corridas (id),
  autor_id uuid not null default auth.uid() references public.perfis (id),
  -- Preenchido pelo servidor a partir da Corrida (trigger abaixo).
  papel_autor public.papel not null check (papel_autor in ('cliente', 'guincheiro')),
  tipo public.tipo_midia not null,
  -- Objeto no bucket `fotos-estado`: "<corrida_id>/<arquivo>".
  caminho text not null unique,
  -- Hora do servidor; o valor enviado pelo cliente é descartado (trigger abaixo).
  criado_em timestamptz not null default now(),
  -- Coordenadas do navegador, opcionais e sempre em par.
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  constraint fotos_estado_lat_lng_em_par check ((latitude is null) = (longitude is null)),
  constraint fotos_estado_caminho_na_pasta_da_corrida check (
    caminho like corrida_id::text || '/_%'
  )
);

create index fotos_estado_corrida_id_idx on public.fotos_estado (corrida_id);

-- Hora gravada pelo servidor e papel do autor derivado da Corrida (não do cliente).
create function public.fotos_estado_preencher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.criado_em := now();
  select case
    when p.cliente_id = new.autor_id then 'cliente'::public.papel
    when c.guincheiro_id = new.autor_id then 'guincheiro'::public.papel
  end
  into new.papel_autor
  from public.corridas c
  join public.pedidos p on p.id = c.pedido_id
  where c.id = new.corrida_id;

  if new.papel_autor is null then
    raise exception 'O autor da Foto de estado precisa ser o Cliente ou o Guincheiro da Corrida'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger fotos_estado_preencher
before insert on public.fotos_estado
for each row execute function public.fotos_estado_preencher();

-- Prova de Disputa: Fotos de estado não mudam depois de gravadas.
create function public.fotos_estado_imutaveis()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Fotos de estado não podem ser alteradas' using errcode = 'check_violation';
end;
$$;

create trigger fotos_estado_imutaveis
before update on public.fotos_estado
for each row execute function public.fotos_estado_imutaveis();
