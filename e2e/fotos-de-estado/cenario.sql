-- Cenário do teste de navegador: Corrida do Rafael com o Marcos em no_local.
set session_replication_role = replica;
delete from public.fotos_estado;
delete from public.corridas where id = 'cccccccc-0000-4000-8000-0000000000e1';
delete from public.pedidos where id = 'aaaaaaaa-0000-4000-8000-0000000000e1';
insert into public.pedidos (
  id, cliente_id, tipo_veiculo, situacao, rodas_giram, estado,
  origem, origem_endereco, destino, destino_endereco, km_ate_veiculo, km_rebocado,
  tabela_precos_versao, preco_taxa_base, preco_ate_veiculo, preco_rebocado, preco_total
) values (
  'aaaaaaaa-0000-4000-8000-0000000000e1', '11111111-1111-4111-8111-111111111111',
  'carro', 'nao_liga', 'sim', 'atribuido',
  extensions.st_makepoint(-47.8921, -15.7903), 'Eixo Monumental',
  extensions.st_makepoint(-48.0560, -15.8100), 'QNA 12, Taguatinga Norte',
  4.2, 21.3, 1, 11000, 2100, 12780, 25880
);
insert into public.corridas (id, pedido_id, guincheiro_id, estado, repasse)
values ('cccccccc-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-0000000000e1',
        '22222222-2222-4222-8222-222222222201', 'no_local', 20984);
update public.guincheiros set disponivel = false where id = '22222222-2222-4222-8222-222222222201';
