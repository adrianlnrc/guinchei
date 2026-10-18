-- Papel de quem gere uma Frota (issue #43, ADR-0012).
--
-- O representante cadastra a Frota e responde por ela; pode não dirigir (o de uma empresa) e por
-- isso é distinto de `guincheiro`. O autônomo é representante + Guincheiro de uma Frota própria,
-- na mesma conta: o perfil tem papel `representante` e a linha em `guincheiros` vem no ticket
-- de documentos do Guincheiro.
--
-- Num arquivo só, porque um valor novo de enum não pode ser usado na transação que o cria:
-- a migração seguinte (`cadastro_de_frota`) é quem o usa.

alter type public.papel add value 'representante';
