-- Cadastro do Cliente: emergencial com CEP e cadastro completo no app (issue #57).
--
-- O CEP entra no cadastro emergencial (ADR-0010, nota de revisão de 2026-10-22). Perfis
-- que já existem (seed, Guincheiros, Representantes) ficam com cep nulo; quem passa a
-- exigir é o INSERT do próprio Cliente (política abaixo). O e-mail já existia em `perfis`.

alter table public.perfis
  -- 8 dígitos, sem máscara, nunca todos iguais. Não se restringe ao DF.
  add column cep text constraint perfis_cep_check check (cep ~ '^\d{8}$' and cep !~ '^(\d)\1{7}$');

comment on column public.perfis.cep is
  'CEP do Cliente, 8 dígitos. Obrigatório no cadastro emergencial; nulo nos perfis anteriores a ele.';

-- Cadastro emergencial: o INSERT do app passa a mandar o CEP.
grant insert (cep) on public.perfis to authenticated;

drop policy "perfis: o usuário cria o próprio perfil de Cliente" on public.perfis;
create policy "perfis: o usuário cria o próprio perfil de Cliente"
on public.perfis for insert to authenticated
with check (
  id = (select auth.uid())
  and papel = 'cliente'
  and telefone = (select auth.jwt() ->> 'phone')
  and cep is not null
);

-- Cadastro no app (completo, nunca bloqueia Pedido). Só nome, CEP e e-mail mudam: CPF e
-- telefone seguem sem GRANT de UPDATE, e o CEP só muda por aqui (sempre preenchido).
create function public.atualizar_cadastro_cliente(nome text, cep text, email text default null)
returns public.perfis
language plpgsql
security definer
set search_path = ''
as $$
declare
  atualizado public.perfis;
begin
  if not public.perfil_tem_papel((select auth.uid()), 'cliente') then
    raise exception 'Só um Cliente com cadastro atualiza o cadastro' using errcode = '42501';
  end if;

  -- Os checks de nome, cep e e-mail da tabela rejeitam o que for inválido.
  update public.perfis p
  set nome = trim(atualizar_cadastro_cliente.nome),
      -- Nulo vira '' para o check recusar: o CEP, uma vez informado, não é apagado.
      cep = coalesce(atualizar_cadastro_cliente.cep, ''),
      email = nullif(trim(atualizar_cadastro_cliente.email), '')
  where p.id = (select auth.uid())
  returning p.* into atualizado;

  return atualizado;
end;
$$;

comment on function public.atualizar_cadastro_cliente is
  'O Cliente atualiza o próprio cadastro: nome, CEP (obrigatório) e e-mail (opcional). CPF e telefone não mudam.';

revoke execute on function public.atualizar_cadastro_cliente from public, anon;
grant execute on function public.atualizar_cadastro_cliente to authenticated;
