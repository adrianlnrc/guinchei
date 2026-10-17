-- Dados de referência: tabela de preços e feriados.
-- Valem para qualquer ambiente (local e staging); em staging, carregue só este arquivo.

-- Versão 1 da tabela de preços, com os valores iniciais do ADR-0009.
insert into public.tabela_precos (
  versao, vigente_desde, taxa_base, por_km_ate_veiculo, por_km_rebocado,
  adicional_noturno, noturno_das, noturno_ate, adicional_feriado, preco_minimo, comissao
) values (
  1, '2026-01-01 00:00:00-03', 11000, 500, 600,
  0.15, 20, 6, 0.20, 18000, 0.20
);

-- Feriados de 2026 e 2027 que disparam o adicional de feriado (ADR-0009):
-- - nacionais fixos (Lei 662/1949 e alterações; 12/10 pela Lei 6.802/1980; 20/11 pela
--   Lei 14.759/2023);
-- - Sexta-feira Santa, móvel (dois dias antes da Páscoa: 05/04/2026 e 28/03/2027);
-- - do DF: 21/04 Fundação de Brasília (mesmo dia de Tiradentes, por isso a chave inclui a
--   abrangência) e 30/11 Dia do Evangélico (Lei distrital 963/1995).
-- Fora da lista, de propósito: Carnaval e Corpus Christi, que são ponto facultativo, não
-- feriado nacional, e os demais pontos facultativos do GDF. Rever a cada ano.
insert into public.feriados (data, nome, abrangencia) values
  ('2026-01-01', 'Confraternização Universal', 'nacional'),
  ('2026-04-03', 'Sexta-feira Santa', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'nacional'),
  ('2026-04-21', 'Fundação de Brasília', 'df'),
  ('2026-05-01', 'Dia do Trabalho', 'nacional'),
  ('2026-09-07', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
  ('2026-11-30', 'Dia do Evangélico', 'df'),
  ('2026-12-25', 'Natal', 'nacional'),
  ('2027-01-01', 'Confraternização Universal', 'nacional'),
  ('2027-03-26', 'Sexta-feira Santa', 'nacional'),
  ('2027-04-21', 'Tiradentes', 'nacional'),
  ('2027-04-21', 'Fundação de Brasília', 'df'),
  ('2027-05-01', 'Dia do Trabalho', 'nacional'),
  ('2027-09-07', 'Independência do Brasil', 'nacional'),
  ('2027-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2027-11-02', 'Finados', 'nacional'),
  ('2027-11-15', 'Proclamação da República', 'nacional'),
  ('2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
  ('2027-11-30', 'Dia do Evangélico', 'df'),
  ('2027-12-25', 'Natal', 'nacional');
