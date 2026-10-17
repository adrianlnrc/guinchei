-- Transições de estado reforçadas no banco.
-- Percorre todos os pares (de, para) de estados distintos e confere que o trigger aceita
-- exatamente os pares das tabelas transicoes_pedido / transicoes_corrida. Que essas tabelas
-- são iguais às de @guinchei/estados é conferido em packages/estados/src/sincronia-sql.test.ts.
begin;
select plan(9);

-- Pedido e Corrida do Cliente e do Guincheiro do seed.
insert into public.pedidos (
  id, cliente_id, tipo_veiculo, situacao, rodas_giram,
  origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
  tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
) values (
  'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
  'carro', 'nao_liga', 'sim',
  extensions.st_makepoint(-47.8921, -15.7903), 'Eixo Monumental',
  extensions.st_makepoint(-48.0560, -15.8100), 'QNA 12, Taguatinga Norte',
  4.2, 21.3, 1, 11000, 2100, 12780, 25880
);
insert into public.corridas (id, pedido_id, guincheiro_id)
values ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        '22222222-2222-4222-8222-222222222201');

-- Para cada par, põe a linha no estado `de` sem o trigger e tenta ir para `para`.
create function pg_temp.transicoes_aceitas_pedido()
returns table (de public.estado_pedido, para public.estado_pedido)
language plpgsql
as $$
declare
  d public.estado_pedido;
  p public.estado_pedido;
begin
  foreach d in array enum_range(null::public.estado_pedido) loop
    foreach p in array enum_range(null::public.estado_pedido) loop
      continue when d = p;
      alter table public.pedidos disable trigger pedidos_reforcar_transicao;
      update public.pedidos set estado = d where id = 'aaaaaaaa-0000-4000-8000-000000000001';
      alter table public.pedidos enable trigger pedidos_reforcar_transicao;
      begin
        update public.pedidos set estado = p where id = 'aaaaaaaa-0000-4000-8000-000000000001';
        de := d;
        para := p;
        return next;
      exception when check_violation then
        null;
      end;
    end loop;
  end loop;
end;
$$;

create function pg_temp.transicoes_aceitas_corrida()
returns table (de public.estado_corrida, para public.estado_corrida)
language plpgsql
as $$
declare
  d public.estado_corrida;
  p public.estado_corrida;
begin
  foreach d in array enum_range(null::public.estado_corrida) loop
    foreach p in array enum_range(null::public.estado_corrida) loop
      continue when d = p;
      alter table public.corridas disable trigger corridas_reforcar_transicao;
      update public.corridas set estado = d where id = 'cccccccc-0000-4000-8000-000000000001';
      alter table public.corridas enable trigger corridas_reforcar_transicao;
      begin
        update public.corridas set estado = p where id = 'cccccccc-0000-4000-8000-000000000001';
        de := d;
        para := p;
        return next;
      exception when check_violation then
        null;
      end;
    end loop;
  end loop;
end;
$$;

select set_eq(
  'select * from pg_temp.transicoes_aceitas_pedido()',
  'select de, para from public.transicoes_pedido',
  'Pedido: o trigger aceita exatamente as transições da tabela e rejeita todas as outras'
);

select set_eq(
  'select * from pg_temp.transicoes_aceitas_corrida()',
  'select de, para from public.transicoes_corrida',
  'Corrida: o trigger aceita exatamente as transições da tabela e rejeita todas as outras'
);

-- Casos nomeados, para a mensagem de erro ficar documentada.
alter table public.pedidos disable trigger pedidos_reforcar_transicao;
update public.pedidos set estado = 'confirmado' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
alter table public.pedidos enable trigger pedidos_reforcar_transicao;

select throws_ok(
  $$ update public.pedidos set estado = 'atribuido' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514',
  'Pedido não pode ir de confirmado para atribuido',
  'Pedido não pula o Match'
);

select lives_ok(
  $$ update public.pedidos set km_rebocado = 21.3 where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'atualizar outra coluna sem mudar o estado não é transição'
);

alter table public.corridas disable trigger corridas_reforcar_transicao;
update public.corridas set estado = 'no_local' where id = 'cccccccc-0000-4000-8000-000000000001';
alter table public.corridas enable trigger corridas_reforcar_transicao;

select throws_ok(
  $$ update public.corridas set estado = 'entregue' where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  '23514',
  'Corrida não pode ir de no_local para entregue',
  'Corrida não pula o carregamento'
);

select lives_ok(
  $$ update public.corridas set estado = 'carregado' where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'no_local → carregado passa sem Fotos de estado (ADR-0011)'
);

select throws_ok(
  $$ update public.corridas set estado = 'aceita' where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  '23514',
  'Corrida não pode ir de carregado para aceita',
  'Corrida não volta'
);

select throws_ok(
  $$ insert into public.pedidos (
       cliente_id, estado, tipo_veiculo, situacao, rodas_giram,
       origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
       tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
     ) values (
       '11111111-1111-4111-8111-111111111111', 'atribuido', 'carro', 'nao_liga', 'sim',
       extensions.st_makepoint(-47.89, -15.79), 'A', extensions.st_makepoint(-48.05, -15.81), 'B',
       1, 1, 1, 11000, 500, 600, 12100
     ) $$,
  '23514',
  'Pedido nasce cotado, não atribuido',
  'Pedido não nasce fora de cotado'
);

select throws_ok(
  $$ insert into public.pedidos (
       cliente_id, tipo_veiculo, situacao, rodas_giram,
       origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
       tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
     ) values (
       '11111111-1111-4111-8111-111111111111', 'carro', 'nao_liga', 'sim',
       extensions.st_makepoint(-47.89, -15.79), 'A', extensions.st_makepoint(-48.05, -15.81), 'B',
       1, 1, 1, 11000, 500, 600, 99999
     ) $$,
  '23514',
  null,
  'a decomposição do Preço fechado precisa somar o total'
);

select * from finish();
rollback;
