-- Guarda de disponibilidade (issue #35; ADR-0008 com a nota de 2026-10-17).
--
-- O Guincheiro grava `guincheiros.disponivel` direto pela API (RLS do #6), e só a tela
-- esconde o interruptor durante a Corrida: em outra aba ele podia ligar o plantão e receber
-- uma segunda oferta. O banco passa a recusar `disponivel = true` enquanto o Guincheiro
-- tem Corrida não terminal (aceita, a_caminho, no_local, carregado), por qualquer caminho.
--
--   GDP01  o Guincheiro tem uma Corrida em andamento e não pode ficar disponível
--
-- Só a mudança para `true` é conferida; `disponivel = false` é sempre permitido (o aceite
-- do Match o usa). A volta ao plantão ao entregar (`devolver_guincheiro_ao_plantao`, #12)
-- passa: o trigger roda AFTER UPDATE da Corrida, que já está `entregue` e deixou de contar.

create function public.recusar_disponivel_em_corrida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.corridas c
    where c.guincheiro_id = new.id
      and c.estado in ('aceita', 'a_caminho', 'no_local', 'carregado')
  ) then
    raise exception 'Termine a Corrida em andamento antes de ficar disponível'
      using errcode = 'GDP01';
  end if;
  return new;
end;
$$;

comment on function public.recusar_disponivel_em_corrida is
  'Trigger: recusa guincheiros.disponivel = true com Corrida não terminal do próprio Guincheiro (GDP01).';

revoke execute on function public.recusar_disponivel_em_corrida() from public, anon, authenticated;

create trigger guincheiros_disponivel_sem_corrida
before update of disponivel on public.guincheiros
for each row
when (new.disponivel and old.disponivel is distinct from new.disponivel)
execute function public.recusar_disponivel_em_corrida();
