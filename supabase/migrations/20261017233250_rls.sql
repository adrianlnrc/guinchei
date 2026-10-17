-- RLS por papel (issue #6, ADR-0008).
--
-- Regra geral: anon não lê nada; authenticated lê só o que lhe diz respeito; a operação
-- lê tudo (sem escrever pela API). Escritas que mexem em dinheiro ou no Match (criar
-- Pedido com Preço fechado, avançar o Pedido, ofertas, criar Corrida) ficam com
-- service_role, nas Edge Functions de #7 e #11. Pela API o usuário só:
--   - cria o próprio perfil de Cliente (cadastro urgente, ADR-0010) e edita os dados
--     opcionais do cadastro completo;
--   - Guincheiro: liga/desliga `disponivel` e avança a própria Corrida (o trigger de
--     transição continua valendo);
--   - Cliente e Guincheiro da Corrida: registram Fotos de estado (ADR-0011).
-- Além das políticas, os GRANTs limitam as colunas que cada escrita pode tocar.

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer para não recursar entre políticas)
-- ---------------------------------------------------------------------------

create function public.eh_operacao()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis where id = (select auth.uid()) and papel = 'operacao'
  );
$$;

create function public.sou_cliente_do_pedido(pedido_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pedidos where id = pedido_id and cliente_id = (select auth.uid())
  );
$$;

-- O Guincheiro vê o Pedido que lhe foi oferecido (em qualquer rodada) ou que virou a
-- Corrida dele. `pulada_teto` não conta: o Pedido não chegou a ser oferecido (ADR-0009).
create function public.pedido_oferecido_a_mim(pedido_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tentativas_match t
    where t.pedido_id = pedido_oferecido_a_mim.pedido_id
      and t.guincheiro_id = (select auth.uid())
      and t.resultado <> 'pulada_teto'
  ) or exists (
    select 1 from public.corridas c
    where c.pedido_id = pedido_oferecido_a_mim.pedido_id
      and c.guincheiro_id = (select auth.uid())
  );
$$;

-- Cliente ou Guincheiro da Corrida.
create function public.participo_da_corrida(corrida_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.corridas c
    join public.pedidos p on p.id = c.pedido_id
    where c.id = corrida_id
      and (select auth.uid()) in (c.guincheiro_id, p.cliente_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- GRANTs: começa do zero e libera só o necessário
-- ---------------------------------------------------------------------------

revoke all on
  public.perfis, public.frotas, public.guincheiros, public.tabela_precos, public.feriados,
  public.pedidos, public.corridas, public.tentativas_match, public.fotos_estado,
  public.transicoes_pedido, public.transicoes_corrida
from anon, authenticated;

grant select on
  public.perfis, public.frotas, public.guincheiros, public.tabela_precos, public.feriados,
  public.pedidos, public.corridas, public.tentativas_match, public.fotos_estado,
  public.transicoes_pedido, public.transicoes_corrida
to authenticated;

grant insert (
  id, papel, nome, telefone, cpf, aceite_termos_em, aceite_termos_versao,
  email, data_nascimento, telefone_secundario
) on public.perfis to authenticated;
grant update (
  nome, aceite_termos_em, aceite_termos_versao, email, data_nascimento, telefone_secundario
) on public.perfis to authenticated;

grant update (disponivel) on public.guincheiros to authenticated;
grant update (estado) on public.corridas to authenticated;

-- Sem criado_em nem papel_autor: o servidor grava os dois.
grant insert (id, corrida_id, autor_id, tipo, caminho, latitude, longitude)
  on public.fotos_estado to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------

alter table public.perfis enable row level security;
alter table public.frotas enable row level security;
alter table public.guincheiros enable row level security;
alter table public.tabela_precos enable row level security;
alter table public.feriados enable row level security;
alter table public.pedidos enable row level security;
alter table public.corridas enable row level security;
alter table public.tentativas_match enable row level security;
alter table public.fotos_estado enable row level security;
alter table public.transicoes_pedido enable row level security;
alter table public.transicoes_corrida enable row level security;

-- perfis
create policy "perfis: cada um lê o seu; a operação lê todos"
on public.perfis for select to authenticated
using (id = (select auth.uid()) or (select public.eh_operacao()));

-- Cadastro urgente: só como Cliente e com o telefone verificado no login.
create policy "perfis: o usuário cria o próprio perfil de Cliente"
on public.perfis for insert to authenticated
with check (
  id = (select auth.uid())
  and papel = 'cliente'
  and telefone = (select auth.jwt() ->> 'phone')
);

create policy "perfis: o usuário edita o próprio perfil"
on public.perfis for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- frotas
create policy "frotas: o Guincheiro lê a própria Frota; a operação lê todas"
on public.frotas for select to authenticated
using (
  (select public.eh_operacao())
  or id = (select g.frota_id from public.guincheiros g where g.id = (select auth.uid()))
);

-- guincheiros
create policy "guincheiros: cada um lê o seu; a operação lê todos"
on public.guincheiros for select to authenticated
using (id = (select auth.uid()) or (select public.eh_operacao()));

create policy "guincheiros: o Guincheiro muda a própria disponibilidade"
on public.guincheiros for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- tabela_precos, feriados e transições: referência, leitura para qualquer usuário logado
create policy "tabela_precos: leitura para usuários logados"
on public.tabela_precos for select to authenticated using (true);

create policy "feriados: leitura para usuários logados"
on public.feriados for select to authenticated using (true);

create policy "transicoes_pedido: leitura para usuários logados"
on public.transicoes_pedido for select to authenticated using (true);

create policy "transicoes_corrida: leitura para usuários logados"
on public.transicoes_corrida for select to authenticated using (true);

-- pedidos
create policy "pedidos: o Cliente lê os seus; o Guincheiro, os oferecidos a ele; a operação, todos"
on public.pedidos for select to authenticated
using (
  cliente_id = (select auth.uid())
  or public.pedido_oferecido_a_mim(id)
  or (select public.eh_operacao())
);

-- corridas
create policy "corridas: Cliente e Guincheiro leem a sua; a operação lê todas"
on public.corridas for select to authenticated
using (
  guincheiro_id = (select auth.uid())
  or public.sou_cliente_do_pedido(pedido_id)
  or (select public.eh_operacao())
);

create policy "corridas: o Guincheiro avança a própria Corrida"
on public.corridas for update to authenticated
using (guincheiro_id = (select auth.uid()))
with check (guincheiro_id = (select auth.uid()));

-- tentativas_match
create policy "tentativas_match: o Guincheiro lê as ofertas feitas a ele; a operação lê todas"
on public.tentativas_match for select to authenticated
using (
  (guincheiro_id = (select auth.uid()) and resultado <> 'pulada_teto')
  or (select public.eh_operacao())
);

-- fotos_estado
create policy "fotos_estado: Cliente e Guincheiro da Corrida leem; a operação lê todas"
on public.fotos_estado for select to authenticated
using (public.participo_da_corrida(corrida_id) or (select public.eh_operacao()));

create policy "fotos_estado: Cliente e Guincheiro da Corrida registram, como autores"
on public.fotos_estado for insert to authenticated
with check (autor_id = (select auth.uid()) and public.participo_da_corrida(corrida_id));
