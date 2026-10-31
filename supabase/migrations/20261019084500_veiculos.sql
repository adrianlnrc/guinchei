-- Cadastro e homologação de veículos da Frota (issue #45, ADR-0012, invariante 3).
--
-- O representante da Frota cadastra os veículos de guincho: placa (padrão antigo ou Mercosul),
-- RENAVAM, tipo (plataforma, asa-delta, lança) e PBT em kg, mais o CRLV e as fotos no bucket
-- `documentos-prestadores`. Cada veículo gera itens de homologação do #42: um `crlv` e um
-- `foto_veiculo` por foto (1 a 6), na fila do Painel. A operação confere o CRLV, inclusive o
-- registro como reboque no DETRAN, e aprova ou recusa com motivo. O PBT é numérico porque a
-- regra CNH × PBT (`categoria_cnh_cobre_pbt`) depende dele.
--
-- Erros de `cadastrar_veiculo` (errcode): GVE01 quem não é representante de uma Frota, GVE02
-- placa inválida, GVE03 RENAVAM inválido, GVE04 PBT fora da faixa, GVE05 de 1 a 6 fotos, GVE06
-- placa ou RENAVAM já cadastrados, GVE07 mudança de placa, RENAVAM, tipo ou PBT depois de
-- algum item aprovado. Arquivo que não está no bucket é GHM06 (como nos itens).

-- ---------------------------------------------------------------------------
-- Validação de placa e RENAVAM (mesmas regras de @guinchei/documentos)
-- ---------------------------------------------------------------------------

-- Placa sem hífen, em maiúsculas: AAA9999 (antiga) ou AAA9A99 (Mercosul).
create function public.placa_valida(placa text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select placa ~ '^[A-Z]{3}[0-9]{4}$' or placa ~ '^[A-Z]{3}[0-9][A-Z][0-9]{2}$';
$$;

-- 11 dígitos, com o dígito verificador (módulo 11, pesos 3 2 9 8 7 6 5 4 3 2 nos 10 primeiros).
-- Números de 9 ou 10 dígitos (emissões antigas) entram preenchidos com zeros à esquerda.
create function public.renavam_valido(renavam text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  pesos int[] := array[3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma int := 0;
begin
  if renavam !~ '^\d{11}$' or renavam ~ '^(\d)\1{10}$' then
    return false;
  end if;
  for i in 1..10 loop
    soma := soma + substr(renavam, i, 1)::int * pesos[i];
  end loop;
  return ((soma * 10) % 11) % 10 = substr(renavam, 11, 1)::int;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------

create type public.tipo_veiculo_guincho as enum ('plataforma', 'asa_delta', 'lanca');

create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  frota_id uuid not null references public.frotas (id),
  placa text not null unique check (public.placa_valida(placa)),
  renavam text not null unique check (public.renavam_valido(renavam)),
  tipo public.tipo_veiculo_guincho not null,
  -- Peso bruto total em kg: a regra CNH × PBT (CTB art. 143) usa este número.
  pbt_kg integer not null check (pbt_kg between 500 and 60000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index veiculos_frota_id_idx on public.veiculos (frota_id);

create trigger veiculos_atualizado_em
before update on public.veiculos
for each row execute function public.definir_atualizado_em();

comment on table public.veiculos is
  'Veículo de guincho de uma Frota (ADR-0012). A homologação é dos itens crlv e foto_veiculo.';

-- Um item por documento de cada alvo, menos as fotos: o veículo tem várias.
alter table public.itens_homologacao drop constraint itens_homologacao_um_por_tipo;
create unique index itens_homologacao_um_por_tipo
  on public.itens_homologacao (alvo, alvo_id, tipo) where tipo <> 'foto_veiculo';

-- Depois que a operação aprovou algum item, o que ela conferiu não muda por baixo dela.
create function public.veiculos_dados_conferidos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.placa, new.renavam, new.tipo, new.pbt_kg)
    is distinct from (old.placa, old.renavam, old.tipo, old.pbt_kg)
    and exists (
      select 1 from public.itens_homologacao i
      where i.alvo = 'veiculo' and i.alvo_id = old.id and i.estado = 'aprovado'
    ) then
    raise exception 'Veículo com item aprovado não muda placa, RENAVAM, tipo nem PBT'
      using errcode = 'GVE07';
  end if;
  return new;
end;
$$;

create trigger veiculos_dados_conferidos
before update on public.veiculos
for each row execute function public.veiculos_dados_conferidos();

-- ---------------------------------------------------------------------------
-- GRANTs e RLS: o representante lê e edita os da própria Frota; a operação lê todos
-- ---------------------------------------------------------------------------

revoke all on public.veiculos from anon, authenticated;
grant select on public.veiculos to authenticated;
grant update (placa, renavam, tipo, pbt_kg) on public.veiculos to authenticated;

alter table public.veiculos enable row level security;

create policy "veiculos: o representante lê os da própria Frota; a operação lê todos"
on public.veiculos for select to authenticated
using ((select public.sou_representante_da_frota(frota_id)) or (select public.eh_operacao()));

create policy "veiculos: o representante edita os da própria Frota"
on public.veiculos for update to authenticated
using ((select public.sou_representante_da_frota(frota_id)))
with check ((select public.sou_representante_da_frota(frota_id)));

-- ---------------------------------------------------------------------------
-- Cadastro
-- ---------------------------------------------------------------------------

-- O representante cadastra o veículo da própria Frota: cria a linha e os itens pendentes
-- (CRLV e uma foto por arquivo), que entram na fila do Painel. Devolve o id do veículo.
create function public.cadastrar_veiculo(
  placa text,
  renavam text,
  tipo public.tipo_veiculo_guincho,
  pbt_kg integer,
  crlv_arquivo text,
  fotos text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  frota uuid;
  placa_limpa text := upper(regexp_replace(coalesce(placa, ''), '[^A-Za-z0-9]', '', 'g'));
  renavam_limpo text := lpad(regexp_replace(coalesce(renavam, ''), '\D', '', 'g'), 11, '0');
  foto text;
  novo uuid;
begin
  select f.id into frota from public.frotas f where f.representante_id = eu;
  if frota is null then
    raise exception 'Só o representante de uma Frota cadastra veículos' using errcode = 'GVE01';
  end if;
  if not coalesce(public.placa_valida(placa_limpa), false) then
    raise exception 'Placa inválida' using errcode = 'GVE02';
  end if;
  if length(regexp_replace(coalesce(renavam, ''), '\D', '', 'g')) not between 9 and 11
    or not coalesce(public.renavam_valido(renavam_limpo), false) then
    raise exception 'RENAVAM inválido' using errcode = 'GVE03';
  end if;
  if tipo is null or pbt_kg is null or pbt_kg not between 500 and 60000 then
    raise exception 'Informe o tipo e o PBT em kg (de 500 a 60.000)' using errcode = 'GVE04';
  end if;
  if coalesce(cardinality(fotos), 0) not between 1 and 6 then
    raise exception 'Envie de 1 a 6 fotos do veículo' using errcode = 'GVE05';
  end if;
  if exists (
    select 1 from public.veiculos v where v.placa = placa_limpa or v.renavam = renavam_limpo
  ) then
    raise exception 'Placa ou RENAVAM já cadastrados' using errcode = 'GVE06';
  end if;

  perform public.conferir_arquivo_homologacao(eu, coalesce(crlv_arquivo, ''));
  foreach foto in array fotos loop
    perform public.conferir_arquivo_homologacao(eu, coalesce(foto, ''));
  end loop;

  insert into public.veiculos (frota_id, placa, renavam, tipo, pbt_kg)
  values (frota, placa_limpa, renavam_limpo, tipo, pbt_kg)
  returning id into novo;

  insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo)
  values (frota, 'veiculo', novo, 'crlv', eu, crlv_arquivo);
  foreach foto in array fotos loop
    insert into public.itens_homologacao (frota_id, alvo, alvo_id, tipo, dono_id, arquivo)
    values (frota, 'veiculo', novo, 'foto_veiculo', eu, foto);
  end loop;
  return novo;
end;
$$;

comment on function public.cadastrar_veiculo is
  'O representante cadastra o veículo da própria Frota; o CRLV e as fotos viram itens pendentes.';

revoke execute on function
  public.cadastrar_veiculo, public.placa_valida, public.renavam_valido
from public, anon, authenticated;
grant execute on function
  public.cadastrar_veiculo, public.placa_valida, public.renavam_valido
to authenticated;
