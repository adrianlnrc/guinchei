# Guinchei em produção (Supabase + Vercel)

Projeto Supabase: `vxpjfrtdllmwwztnpglm` (`https://vxpjfrtdllmwwztnpglm.supabase.co`).

## Já aplicado no Supabase

- Schema `public` recriado a partir das 28 migrations de `main` (23 tabelas, RLS em todas).
- pg_cron: `match-varrer`, `match-aprovacao-varrer`, `match-limpar-historico-cron`, `homologacao-vencer`.
- Buckets `fotos-estado` e `documentos-prestadores`.
- Seeds `01_referencia`, `02_usuarios_de_teste`, `04_convites`, `05_demonstracao` (o `03_match_local` é só local).
- Vault: `match_url_funcoes`.
- Edge Functions ativas (`verify_jwt`): `cotar-pedido`, `confirmar-pedido`, `ofertar-proximo`, `estornar-pedido`.
  Publicadas com os imports achatados (o bundler do deploy não aceita `../../../packages`); o repositório não muda.

Observação: o histórico remoto de migrations tem versões com o timestamp da aplicação, não os dos arquivos. Se for usar `supabase db push`, rode antes `migration repair`.

## Passos que dependem do dono

1. **Segredo do Match** (SQL Editor; a chave não passa pelo chat). Sem ele o Match não avança após a primeira oferta:
   ```sql
   select vault.create_secret('<service_role>', 'match_chave_servico', 'service_role usada pelo Match');
   ```
2. **Auth → Providers → Phone**: habilitar e cadastrar *Test phone numbers* com código `123456`:
   5561900000001 a 5561900000005, 5561900000007, 5561900000008, 5561900000046, 5561900000047, 5561900000060, 5561900000061, 5561900000062.
   Operação: 5561900000005. Demo: Helena …060, Cláudia …061, Diego …062.
3. **Vercel**: três projetos a partir do mesmo repositório.

   | Projeto | Root Directory |
   |---|---|
   | guinchei-cliente | `apps/cliente` |
   | guinchei-guincheiro | `apps/guincheiro` |
   | guinchei-painel | `apps/painel` |

   Em cada um: marcar *Include source files outside of the Root Directory* e definir
   `VITE_SUPABASE_URL=https://vxpjfrtdllmwwztnpglm.supabase.co` e
   `VITE_SUPABASE_ANON_KEY=<chave publicável>`. No Cliente, opcionalmente `VITE_MAPBOX_TOKEN`.
4. Confirmar que `PAGAMENTO_MOCK_RECUSA_TESTE` **não** existe nos secrets das Edge Functions.
5. Em Auth → URL Configuration, incluir as três URLs da Vercel.

## Smoke test (de uma máquina com acesso ao domínio)

- Função sem `Authorization` → 401 do gateway.
- Com a chave publicável e sem sessão: `cotar-pedido`, `confirmar-pedido`, `estornar-pedido` e `ofertar-proximo` → `{erro:"sem_sessao"}` 401.
- Fluxo: login Cliente → pedir guincho → Guincheiro (Marcos …002) aceita → Painel (…005) acompanha.
- Demo de homologação: no Painel, aprovar a Cerrado Guinchos e clicar *Ativar Frota*.

## Pendências conhecidas

- Advisor de segurança: 9 funções `SECURITY DEFINER` executáveis por `anon` (helpers de RLS e triggers). Revisar com cuidado antes de revogar, pois policies as chamam.
- Limitações a declarar na apresentação: pagamento mock, sem GPS ao vivo nem push, distância em linha reta, termos de uso provisórios.
