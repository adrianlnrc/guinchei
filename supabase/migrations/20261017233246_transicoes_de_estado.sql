-- Transições de estado do Pedido e da Corrida reforçadas no banco (issue #6).
--
-- A fonte da verdade é `packages/estados/src/index.ts` (TRANSICOES_PEDIDO e
-- TRANSICOES_CORRIDA). As linhas abaixo repetem exatamente aquela tabela; o teste
-- `packages/estados/src/sincronia-sql.test.ts` lê este arquivo e falha se divergirem, e
-- `supabase/tests/transicoes.test.sql` percorre todos os pares de estados e confere que o
-- trigger aceita exatamente o que está nestas tabelas.
--
-- Mudou a máquina de estados? Altere a TS, crie uma migração nova que ajuste estas tabelas
-- e aponte o teste de sincronia para ela.
--
-- Pedido: cotado → confirmado → em_match → atribuido | sem_guincheiro. De sem_guincheiro o
-- Cliente tenta de novo (→ em_match) ou estorna (→ estornado, terminal). Sem estados de
-- cancelamento: RF14 está fora do skeleton.
-- Corrida: aceita → a_caminho ("Saí para o local") → no_local → carregado → entregue.
-- Sem guarda de Fotos de estado (ADR-0011).

create table public.transicoes_pedido (
  de public.estado_pedido not null,
  para public.estado_pedido not null,
  primary key (de, para)
);

create table public.transicoes_corrida (
  de public.estado_corrida not null,
  para public.estado_corrida not null,
  primary key (de, para)
);

comment on table public.transicoes_pedido is
  'Transições permitidas do Pedido; espelho de TRANSICOES_PEDIDO em @guinchei/estados.';
comment on table public.transicoes_corrida is
  'Transições permitidas da Corrida; espelho de TRANSICOES_CORRIDA em @guinchei/estados.';

-- inicio:transicoes_pedido
insert into public.transicoes_pedido (de, para) values
  ('cotado', 'confirmado'),
  ('confirmado', 'em_match'),
  ('em_match', 'atribuido'),
  ('em_match', 'sem_guincheiro'),
  ('sem_guincheiro', 'em_match'),
  ('sem_guincheiro', 'estornado');
-- fim:transicoes_pedido

-- inicio:transicoes_corrida
insert into public.transicoes_corrida (de, para) values
  ('aceita', 'a_caminho'),
  ('a_caminho', 'no_local'),
  ('no_local', 'carregado'),
  ('carregado', 'entregue');
-- fim:transicoes_corrida

-- Um Pedido nasce cotado; depois só muda de estado por uma transição da tabela.
-- Atualizar outras colunas sem mudar o estado não é transição e passa.
create function public.reforcar_transicao_pedido()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'cotado' then
      raise exception 'Pedido nasce cotado, não %', new.estado using errcode = 'check_violation';
    end if;
  elsif new.estado is distinct from old.estado and not exists (
    select 1 from public.transicoes_pedido t where t.de = old.estado and t.para = new.estado
  ) then
    raise exception 'Pedido não pode ir de % para %', old.estado, new.estado
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger pedidos_reforcar_transicao
before insert or update of estado on public.pedidos
for each row execute function public.reforcar_transicao_pedido();

-- Uma Corrida nasce aceita; depois só muda de estado por uma transição da tabela.
create function public.reforcar_transicao_corrida()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'aceita' then
      raise exception 'Corrida nasce aceita, não %', new.estado using errcode = 'check_violation';
    end if;
  elsif new.estado is distinct from old.estado and not exists (
    select 1 from public.transicoes_corrida t where t.de = old.estado and t.para = new.estado
  ) then
    raise exception 'Corrida não pode ir de % para %', old.estado, new.estado
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger corridas_reforcar_transicao
before insert or update of estado on public.corridas
for each row execute function public.reforcar_transicao_corrida();
