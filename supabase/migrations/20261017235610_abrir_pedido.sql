-- O Cliente abre o Pedido em três toques (issue #8, RF03).
--
-- O Pedido nasce `cotado` só com as três respostas (tipo de veículo, situação, "as 4 rodas
-- giram?"). Origem e destino chegam com o mapa (#9) e o Preço fechado com a cotação (#10),
-- ambos pelo servidor. Até lá esses campos ficam nulos.
--
-- O Cliente continua sem INSERT direto em `pedidos`: abre o Pedido por `abrir_pedido`, que
-- só recebe as três respostas e grava `cliente_id = auth.uid()`. Nenhum campo de trajeto
-- ou de preço passa pela função.

-- ---------------------------------------------------------------------------
-- Trajeto e Preço fechado opcionais até a cotação
-- ---------------------------------------------------------------------------

alter table public.pedidos
  alter column origem drop not null,
  alter column origem_endereco drop not null,
  alter column destino drop not null,
  alter column destino_endereco drop not null,
  alter column km_ate_veiculo drop not null,
  alter column km_rebocado drop not null,
  alter column tabela_precos_versao drop not null,
  alter column preco_taxa_base drop not null,
  alter column preco_ate_veiculo drop not null,
  alter column preco_rebocado drop not null,
  alter column preco_adicional_noturno drop not null,
  alter column preco_adicional_feriado drop not null,
  alter column preco_ajuste_minimo drop not null,
  alter column preco_total drop not null;

-- A decomposição só se confere quando há Preço fechado.
alter table public.pedidos drop constraint pedidos_decomposicao_soma_o_total;

alter table public.pedidos
  add constraint pedidos_decomposicao_soma_o_total check (
    preco_total is null
    or preco_taxa_base + preco_ate_veiculo + preco_rebocado + preco_adicional_noturno
      + preco_adicional_feriado + preco_ajuste_minimo = preco_total
  ),
  -- O Preço fechado é gravado inteiro, com a versão da tabela, ou não é gravado.
  add constraint pedidos_preco_inteiro_ou_nenhum check (
    num_nulls(
      tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado,
      preco_adicional_noturno, preco_adicional_feriado, preco_ajuste_minimo, preco_total
    ) in (0, 8)
  ),
  add constraint pedidos_origem_com_endereco check ((origem is null) = (origem_endereco is null)),
  add constraint pedidos_destino_com_endereco check (
    (destino is null) = (destino_endereco is null)
  ),
  -- Só se cota com origem, destino e as duas distâncias.
  add constraint pedidos_preco_exige_trajeto check (
    preco_total is null
    or num_nulls(origem, destino, km_ate_veiculo, km_rebocado) = 0
  ),
  -- O Cliente vê o Preço fechado antes de confirmar (invariante 2): fora de `cotado`, o
  -- Pedido tem preço.
  add constraint pedidos_confirmado_tem_preco check (
    estado = 'cotado' or preco_total is not null
  );

-- ---------------------------------------------------------------------------
-- abrir_pedido
-- ---------------------------------------------------------------------------

create function public.abrir_pedido(
  tipo_veiculo public.tipo_veiculo,
  situacao public.situacao_veiculo,
  rodas_giram public.rodas_giram
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo uuid;
begin
  if not public.perfil_tem_papel((select auth.uid()), 'cliente') then
    raise exception 'Só um Cliente com cadastro abre Pedido' using errcode = '42501';
  end if;

  -- Os adicionais e o ajuste têm default 0 para o servidor; aqui o preço fica todo nulo.
  insert into public.pedidos (
    cliente_id, tipo_veiculo, situacao, rodas_giram,
    preco_adicional_noturno, preco_adicional_feriado, preco_ajuste_minimo
  ) values (
    (select auth.uid()), abrir_pedido.tipo_veiculo, abrir_pedido.situacao,
    abrir_pedido.rodas_giram, null, null, null
  )
  returning id into novo;

  return novo;
end;
$$;

comment on function public.abrir_pedido is
  'O Cliente abre o próprio Pedido em cotado com as três respostas (RF03); sem trajeto nem preço.';

-- O Supabase dá EXECUTE a anon por padrão; aqui só usuários logados (e o papel é conferido
-- dentro da função).
revoke execute on function public.abrir_pedido from public, anon;
grant execute on function public.abrir_pedido to authenticated;
