-- O Cliente volta às perguntas e confirma de novo sem abrir outro Pedido (revisão do #8).
--
-- Mesmo padrão de abrir_pedido: SECURITY DEFINER, só Cliente com perfil, e só as três
-- respostas. Atualiza apenas o Pedido do próprio Cliente e só enquanto está em `cotado`
-- (depois de confirmado, as respostas ficam como o Cliente viu o Preço fechado).
-- O Cliente continua sem UPDATE direto em `pedidos`.

create function public.atualizar_pedido_cotado(
  pedido_id uuid,
  tipo_veiculo public.tipo_veiculo,
  situacao public.situacao_veiculo,
  rodas_giram public.rodas_giram
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.perfil_tem_papel((select auth.uid()), 'cliente') then
    raise exception 'Só um Cliente com cadastro atualiza Pedido' using errcode = '42501';
  end if;

  update public.pedidos p
  set tipo_veiculo = atualizar_pedido_cotado.tipo_veiculo,
      situacao = atualizar_pedido_cotado.situacao,
      rodas_giram = atualizar_pedido_cotado.rodas_giram
  where p.id = atualizar_pedido_cotado.pedido_id
    and p.cliente_id = (select auth.uid())
    and p.estado = 'cotado';

  -- Pedido de outro Cliente e Pedido já confirmado dão o mesmo erro: não revela qual é.
  if not found then
    raise exception 'Pedido em cotado não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.atualizar_pedido_cotado is
  'O Cliente troca as três respostas do próprio Pedido enquanto está em cotado (RF03).';

revoke execute on function public.atualizar_pedido_cotado from public, anon;
grant execute on function public.atualizar_pedido_cotado to authenticated;
