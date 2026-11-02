-- Avaliação da Corrida (RF13, lado Cliente → Guincheiro; invariante 6 do CONTEXT.md).
--
-- Ao fim da Corrida (`entregue`) o Cliente dá uma nota de 1 a 5 ao Guincheiro, com um
-- comentário opcional de até 280 caracteres. Uma avaliação por Corrida e por autor: depois de
-- gravada, não muda (como as Fotos de estado, ela entra em Disputa).
--
-- A tabela já guarda o papel do autor, para o lado Guincheiro → Cliente entrar depois sem
-- migração de estrutura (a unicidade é por Corrida e papel). Hoje só o Cliente avalia.
--
-- Escrita só pela RPC `avaliar_corrida`; ninguém escreve direto na tabela. Leitura (RLS):
--   - o Cliente lê as que ele mesmo fez (as do próprio Pedido);
--   - o Guincheiro lê as que recebeu (feitas pelo Cliente nas Corridas dele);
--   - a operação lê todas.
--
-- `nota_media_desde(desde)` calcula a média e a contagem das avaliações que o chamador
-- consegue ler: para a operação, todas (indicador "Nota média · 7 dias" do Monitor); para o
-- Guincheiro, as que recebeu; para o Cliente, as que fez. Roda com os direitos de quem chama,
-- então a RLS decide o que entra na conta.
--
-- Códigos de erro próprios de `avaliar_corrida`:
--   GAV01  a Corrida não existe ou não é do Pedido de quem chamou
--   GAV02  a Corrida ainda não foi entregue
--   GAV03  a Corrida já foi avaliada por este autor
--   GAV04  a nota não está entre 1 e 5
--   GAV05  o comentário passa de 280 caracteres

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------

create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.corridas (id),
  -- Quem avaliou e em que papel; a RPC preenche os dois a partir de quem chama.
  autor_id uuid not null references public.perfis (id),
  papel_autor public.papel not null check (papel_autor in ('cliente', 'guincheiro')),
  nota smallint not null check (nota between 1 and 5),
  comentario text check (
    comentario is null
    or (length(btrim(comentario)) > 0 and char_length(comentario) <= 280)
  ),
  -- Hora do servidor; o valor enviado é descartado (trigger abaixo).
  criado_em timestamptz not null default now(),
  -- Uma avaliação por Corrida e por papel: hoje, a do Cliente.
  constraint avaliacoes_uma_por_corrida_e_papel unique (corrida_id, papel_autor)
);

comment on table public.avaliacoes is
  'Avaliação de 1 a 5 ao fim da Corrida (RF13). Hoje só o Cliente avalia o Guincheiro. Imutável; escrita só por avaliar_corrida().';

create index avaliacoes_criado_em_idx on public.avaliacoes (criado_em);

-- Hora gravada pelo servidor, mesmo que alguém com service_role mande outra.
create function public.avaliacoes_criado_em_do_servidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.criado_em := now();
  return new;
end;
$$;

create trigger avaliacoes_criado_em_do_servidor
before insert on public.avaliacoes
for each row execute function public.avaliacoes_criado_em_do_servidor();

-- Avaliação gravada não muda: vale para qualquer papel, inclusive service_role. Como nas
-- Fotos de estado, apagar não é possível pela API (sem GRANT de DELETE); só a manutenção
-- (service_role) apaga, o que os testes usam para limpar o banco.
create function public.avaliacoes_imutaveis()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Avaliações não podem ser alteradas' using errcode = 'check_violation';
end;
$$;

create trigger avaliacoes_imutaveis
before update on public.avaliacoes
for each row execute function public.avaliacoes_imutaveis();

-- ---------------------------------------------------------------------------
-- RLS: leitura por papel; ninguém escreve pela API
-- ---------------------------------------------------------------------------

revoke all on public.avaliacoes from anon, authenticated;
grant select on public.avaliacoes to authenticated;
alter table public.avaliacoes enable row level security;

-- `participo_da_corrida` já confere Cliente ou Guincheiro da Corrida. A avaliação do Cliente
-- (papel_autor = 'cliente') é lida por ele (autor) e pelo Guincheiro que a recebeu; a de
-- outro papel, só por quem a fez (o lado Guincheiro → Cliente, quando existir, é decisão futura).
create policy "avaliacoes: o Cliente lê as que fez; o Guincheiro, as que recebeu; a operação lê todas"
on public.avaliacoes for select to authenticated
using (
  (
    public.participo_da_corrida(corrida_id)
    and (papel_autor = 'cliente' or autor_id = (select auth.uid()))
  )
  or (select public.eh_operacao())
);

-- ---------------------------------------------------------------------------
-- avaliar_corrida
-- ---------------------------------------------------------------------------

create function public.avaliar_corrida(
  corrida_id uuid,
  nota smallint,
  comentario text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem uuid := (select auth.uid());
  estado_atual public.estado_corrida;
  texto text := nullif(btrim(avaliar_corrida.comentario), '');
begin
  -- Só o Cliente do Pedido da Corrida avalia. A linha da Corrida fica travada até o fim da
  -- função: duas chamadas simultâneas não gravam duas avaliações.
  select c.estado
  into estado_atual
  from public.corridas c
  join public.pedidos p on p.id = c.pedido_id
  where c.id = avaliar_corrida.corrida_id
    and p.cliente_id = quem
  for update of c;
  if not found then
    raise exception 'Corrida não encontrada' using errcode = 'GAV01';
  end if;

  if estado_atual <> 'entregue' then
    raise exception 'A Corrida ainda não foi entregue' using errcode = 'GAV02';
  end if;

  if exists (
    select 1 from public.avaliacoes a
    where a.corrida_id = avaliar_corrida.corrida_id and a.papel_autor = 'cliente'
  ) then
    raise exception 'Esta Corrida já foi avaliada' using errcode = 'GAV03';
  end if;

  if avaliar_corrida.nota is null or avaliar_corrida.nota not between 1 and 5 then
    raise exception 'A nota deve ser de 1 a 5' using errcode = 'GAV04';
  end if;

  if char_length(texto) > 280 then
    raise exception 'O comentário deve ter no máximo 280 caracteres' using errcode = 'GAV05';
  end if;

  insert into public.avaliacoes (corrida_id, autor_id, papel_autor, nota, comentario)
  values (avaliar_corrida.corrida_id, quem, 'cliente', avaliar_corrida.nota, texto);
end;
$$;

comment on function public.avaliar_corrida is
  'O Cliente do Pedido avalia o Guincheiro (nota de 1 a 5 e comentário de até 280 caracteres) depois de a Corrida ser entregue. Uma vez por Corrida (RF13).';

revoke execute on function public.avaliar_corrida(uuid, smallint, text) from public, anon;
grant execute on function public.avaliar_corrida(uuid, smallint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- nota_media_desde
-- ---------------------------------------------------------------------------

-- Média (duas casas) e quantidade das avaliações criadas a partir de `desde` que o chamador
-- lê pela RLS. Sem avaliação, a média é nula e o total é 0. SECURITY INVOKER (o padrão): a
-- RLS da tabela decide o que entra na conta.
create function public.nota_media_desde(desde timestamptz)
returns table (media numeric, total bigint)
language sql
stable
set search_path = ''
as $$
  select round(avg(a.nota), 2), count(*)
  from public.avaliacoes a
  where a.criado_em >= nota_media_desde.desde;
$$;

comment on function public.nota_media_desde is
  'Média e total das avaliações desde um instante, entre as que o chamador lê pela RLS (a operação lê todas).';

revoke execute on function public.nota_media_desde(timestamptz) from public, anon;
grant execute on function public.nota_media_desde(timestamptz) to authenticated;
