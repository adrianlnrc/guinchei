-- Hora do aceite dos termos de uso sempre do servidor (ADR-0010, revisão do #8).
--
-- Mesmo padrão de fotos_estado.criado_em: o app não tem GRANT para escrever a coluna, e um
-- trigger descarta qualquer valor enviado. O app manda só a versão aceita; a hora muda
-- quando a versão muda (novo aceite) e em nenhum outro caso.

alter table public.perfis alter column aceite_termos_em set default now();

create function public.perfis_aceite_termos_na_hora_do_servidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.aceite_termos_versao is distinct from old.aceite_termos_versao then
    new.aceite_termos_em := now();
  else
    new.aceite_termos_em := old.aceite_termos_em;
  end if;
  return new;
end;
$$;

create trigger perfis_aceite_termos_na_hora_do_servidor
before insert or update on public.perfis
for each row execute function public.perfis_aceite_termos_na_hora_do_servidor();

revoke insert (aceite_termos_em), update (aceite_termos_em) on public.perfis from authenticated;
