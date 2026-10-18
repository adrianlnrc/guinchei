-- Fotos de estado (ADR-0011, issue #13): etapa e limite de itens.
--
-- Etapa: "antes" vale enquanto a Corrida está em `aceita`, `a_caminho` ou `no_local` (até o
-- Guincheiro tocar em "Carreguei"); "depois" vale em `carregado` e `entregue`. O servidor
-- deriva a etapa do estado da Corrida no momento do registro. O app pode mandar a etapa que
-- acha que é; se ela não bater com a do servidor (a Corrida mudou no meio), o registro é
-- recusado (GFT01), para a foto não cair na etapa errada.
--
-- Limite: até 6 itens por etapa e por autor (o Cliente e o Guincheiro têm 6 cada) (GFT02).
-- Não há guarda de Fotos de estado nas transições da Corrida: ela encerra sem elas.

create type public.etapa_foto as enum ('antes', 'depois');

alter table public.fotos_estado add column etapa public.etapa_foto not null default 'antes';
alter table public.fotos_estado alter column etapa drop default;

comment on column public.fotos_estado.etapa is
  'antes: Corrida em aceita, a_caminho ou no_local; depois: carregado ou entregue. Derivada do estado da Corrida pelo servidor.';

create index fotos_estado_corrida_etapa_idx on public.fotos_estado (corrida_id, autor_id, etapa);

create or replace function public.fotos_estado_preencher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  estado_atual public.estado_corrida;
  etapa_atual public.etapa_foto;
  limite constant integer := 6;
begin
  new.criado_em := now();
  select case
      when p.cliente_id = new.autor_id then 'cliente'::public.papel
      when c.guincheiro_id = new.autor_id then 'guincheiro'::public.papel
    end,
    c.estado
  into new.papel_autor, estado_atual
  from public.corridas c
  join public.pedidos p on p.id = c.pedido_id
  where c.id = new.corrida_id;

  if new.papel_autor is null then
    raise exception 'O autor da Foto de estado precisa ser o Cliente ou o Guincheiro da Corrida'
      using errcode = 'check_violation';
  end if;

  etapa_atual := case
    when estado_atual in ('aceita', 'a_caminho', 'no_local') then 'antes'
    else 'depois'
  end::public.etapa_foto;
  if new.etapa is not null and new.etapa <> etapa_atual then
    raise exception 'A Corrida mudou de etapa; registre de novo' using errcode = 'GFT01';
  end if;
  new.etapa := etapa_atual;

  -- Dois registros simultâneos do mesmo autor não furam o limite.
  perform pg_advisory_xact_lock(
    hashtextextended(new.corrida_id::text || new.autor_id::text || new.etapa::text, 0)
  );
  if (
    select count(*) from public.fotos_estado f
    where f.corrida_id = new.corrida_id and f.autor_id = new.autor_id and f.etapa = new.etapa
  ) >= limite then
    raise exception 'Limite de % itens por etapa atingido', limite using errcode = 'GFT02';
  end if;
  return new;
end;
$$;

-- Sem criado_em nem papel_autor: o servidor grava os dois.
grant insert (etapa) on public.fotos_estado to authenticated;

-- Limpeza de arquivo órfão: se o registro em `fotos_estado` falha depois do envio, o app
-- apaga o arquivo que acabou de mandar. Só quem enviou apaga, e só enquanto nenhuma Foto de
-- estado aponta para ele; arquivo registrado é prova de Disputa e não sai.
create policy "fotos-estado: quem enviou apaga o arquivo ainda sem registro"
on storage.objects for delete to authenticated
using (
  bucket_id = 'fotos-estado'
  and owner_id = (select auth.uid())::text
  and not exists (select 1 from public.fotos_estado f where f.caminho = name)
);
