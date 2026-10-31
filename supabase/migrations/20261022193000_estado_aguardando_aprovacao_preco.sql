-- Estado novo do Pedido para a recotação (issue #58, ADR-0013).
--
-- Fica num arquivo só: um valor novo de enum não pode ser usado na transação que o cria, e
-- `20261022193100_recotacao_do_preco.sql` já o usa (transições, funções).

alter type public.estado_pedido add value if not exists 'aguardando_aprovacao_preco';
