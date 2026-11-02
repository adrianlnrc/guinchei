-- Foto e recarga do estado da demonstração (SÓ para o Supabase hospedado da apresentação).
--
-- NÃO é migração nem seed: fica fora de supabase/migrations e supabase/seeds, então
-- `supabase db reset` e o CI não o executam. Rode no SQL Editor do Supabase, como `postgres`.
--
-- Uso:
--   1. Rode este arquivo inteiro uma vez (cria o schema `demo` com as duas funções).
--   2. Com o banco no estado bom da demonstração (seeds carregados, nenhum Pedido de teste,
--      só o Marcos disponível), tire a foto:        select demo.salvar();
--   3. Depois de ensaiar ou apresentar, volte ao estado da foto:   select demo.restaurar();
--
-- A foto guarda todas as tabelas do schema `public` (cadastros, Frotas, vínculos, documentos
-- e a trilha de homologação, Pedidos, Corridas, pagamentos, parâmetros) em `demo_snap`.
-- `demo.restaurar()` apaga o conteúdo de `public` e devolve o da foto, em uma transação, com os
-- gatilhos de usuário desligados durante a recarga (para não regravar horas do servidor nem
-- recusar a trilha imutável) e religados no fim.
--
-- NÃO guarda: usuários e sessões do Auth (`auth.*`), arquivos enviados ao Storage, segredos do
-- Vault, jobs do pg_cron e Edge Functions. Um número novo cadastrado na demonstração (por
-- exemplo o autônomo 0008) continua existindo no Auth, mas perde o perfil: entra de novo como
-- pessoa sem cadastro.

create schema if not exists demo;
revoke all on schema demo from public, anon, authenticated;

create or replace function demo.salvar()
returns text
language plpgsql
as $$
declare
  t text;
  n integer := 0;
begin
  drop schema if exists demo_snap cascade;
  create schema demo_snap;
  revoke all on schema demo_snap from public, anon, authenticated;

  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('create table demo_snap.%I as table public.%I', t, t);
    n := n + 1;
  end loop;

  create table demo_snap._sequencias as
    select sequencename::text as nome, last_value
    from pg_sequences
    where schemaname = 'public';

  return format('%s tabelas salvas em demo_snap às %s', n, now());
end;
$$;

create or replace function demo.restaurar()
returns text
language plpgsql
as $$
declare
  t text;
  colunas text;
  n integer := 0;
  s record;
  pendentes text[];
  feitos text[] := '{}';
  progresso boolean;
begin
  if not exists (select 1 from pg_namespace where nspname = 'demo_snap') then
    raise exception 'Não há foto: rode select demo.salvar() antes.';
  end if;

  pendentes := array(select tablename::text from pg_tables where schemaname = 'public');

  -- Gatilhos de usuário desligados só nesta transação (o `postgres` do Supabase não pode
  -- mudar session_replication_role): sem regravar horas do servidor nem barrar a trilha imutável.
  foreach t in array pendentes loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;

  execute (
    select 'truncate table ' || string_agg(format('public.%I', tablename), ', ') || ' cascade'
    from pg_tables
    where schemaname = 'public'
  );

  -- Insere cada tabela depois das que ela referencia (chaves estrangeiras não adiáveis).
  while coalesce(array_length(pendentes, 1), 0) > 0 loop
    progresso := false;
    foreach t in array pendentes loop
      continue when exists (
        select 1
        from pg_constraint c
        join pg_class r on r.oid = c.confrelid
        join pg_namespace ns on ns.oid = r.relnamespace
        where c.contype = 'f'
          and c.conrelid = format('public.%I', t)::regclass
          and ns.nspname = 'public'
          and c.confrelid <> c.conrelid
          and r.relname::text <> all (feitos)
      );

      -- Só as colunas que existem nas duas pontas, sem as geradas.
      select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into colunas
      from pg_attribute a
      where a.attrelid = format('public.%I', t)::regclass
        and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
        and exists (
          select 1 from pg_attribute b
          where b.attrelid = format('demo_snap.%I', t)::regclass
            and b.attname = a.attname and not b.attisdropped
        );
      execute format(
        'insert into public.%I (%s) overriding system value select %s from demo_snap.%I',
        t, colunas, colunas, t
      );
      feitos := feitos || t;
      pendentes := array_remove(pendentes, t);
      progresso := true;
      n := n + 1;
    end loop;
    if not progresso then
      raise exception 'Ciclo de chaves estrangeiras entre: %', pendentes;
    end if;
  end loop;

  foreach t in array feitos loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;

  for s in select nome, last_value from demo_snap._sequencias where last_value is not null loop
    perform setval(format('public.%I', s.nome), s.last_value);
  end loop;

  return format('%s tabelas restauradas da foto', n);
end;
$$;

revoke all on function demo.salvar(), demo.restaurar() from public, anon, authenticated;
