-- Disparo do Match no ambiente local (issue #11). Só local: em staging os dois segredos são
-- criados à mão, com a URL do projeto e a service_role dele (docs/desenvolvimento.md).
--
-- `disparar_ofertar_proximo` (recusa, "tentar de novo" e a varredura do pg_cron) faz um
-- POST pelo pg_net para a Edge Function `ofertar-proximo`. De dentro do container do
-- Postgres, o gateway do Supabase local responde em http://kong:8000. A chave é a
-- service_role padrão do Supabase CLI local (pública, a mesma em toda máquina, derivada do
-- JWT secret de desenvolvimento); a Edge Function confere que é a mesma que ela recebeu.
select vault.create_secret(
  'http://kong:8000/functions/v1',
  'match_url_funcoes',
  'URL base das Edge Functions, para o Match pedir a próxima oferta'
);
select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  'match_chave_servico',
  'service_role usada pelo Match para chamar a Edge Function ofertar-proximo'
);
