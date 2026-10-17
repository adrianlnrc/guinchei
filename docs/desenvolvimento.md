# Desenvolvimento

Como subir o Guinchei do zero. A stack está no [ADR-0008](adr/0008-stack-tecnica-do-skeleton.md).

## Pré-requisitos

- Node 22 (veja `.nvmrc`)
- pnpm 10: `corepack enable` (a versão vem do campo `packageManager` do `package.json`)
- Docker em execução, para o Supabase local

## Estrutura

```
apps/
  cliente/      PWA do Cliente      (porta 5173)
  guincheiro/   PWA do Guincheiro   (porta 5174)
  painel/       PWA da operação     (porta 5175)
packages/
  preco/        Preço fechado (TS puro)
  match/        decisão do Match (TS puro)
  estados/      máquinas de estado do Pedido e da Corrida (TS puro)
  tipos/        tipos compartilhados e gerados do schema
  api/          cliente Supabase compartilhado
  ui/           tokens da identidade visual e componentes React
  mock/         dados do cenário do protótipo navegável (o preço vem de @guinchei/preco)
supabase/       config, migrações e seed do Supabase CLI
```

Os pacotes não têm etapa de build: os apps importam o TypeScript direto (`@guinchei/<pacote>`) e o Vite compila.

## Primeira vez

```bash
pnpm install
pnpm supabase start          # sobe Postgres, Auth, Storage e Realtime em Docker
```

O `supabase start` imprime a `API URL` e a `Publishable key` (a `anon key` legada também funciona). Para cada app que for rodar:

```bash
cp apps/cliente/.env.example apps/cliente/.env.local
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY com a API URL e a Publishable key
```

`pnpm supabase status` mostra as chaves de novo. O Studio local fica em http://localhost:54323.

## Dia a dia

| Comando | O que faz |
|---|---|
| `pnpm dev:cliente` (ou `dev:guincheiro`, `dev:painel`) | servidor de desenvolvimento do app |
| `pnpm test` | Vitest em todos os apps e pacotes |
| `pnpm typecheck` | `tsc --noEmit` em todos os workspaces |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier (`format:check` só verifica) |
| `pnpm build` | build de produção dos três apps |
| `pnpm supabase stop` | desliga o Supabase local |

Para testar um pacote só: `pnpm --filter @guinchei/preco test`.

O CI (`.github/workflows/ci.yml`) roda `format:check`, `lint`, `typecheck`, `test` e `build` em todo PR.

## Convenções

- Termos de domínio em português, exatamente como no [CONTEXT.md](../CONTEXT.md): `Pedido`, `Corrida`, `Guincheiro`, `precoFechado`. Termos técnicos em inglês. UI em PT-BR.
- Regras de negócio ficam em `packages/preco`, `match` e `estados`, sem I/O, com testes antes do código.
- Segredos nunca entram no repositório. Nos apps só vão chaves públicas (`VITE_*`); a `service_role` do Supabase e o token de servidor do Mapbox ficam nos segredos das Edge Functions.

## Deploy (Vercel)

Um projeto Vercel por app, todos apontando para este repositório:

| Projeto | Root Directory |
|---|---|
| `guinchei-cliente` | `apps/cliente` |
| `guinchei-guincheiro` | `apps/guincheiro` |
| `guinchei-painel` | `apps/painel` |

O preset é Vite, detectado pelo `vercel.json` de cada app, que também redireciona as rotas da SPA para o `index.html`. Deixe ligado "Include source files outside of the Root Directory", porque os apps usam `packages/*`. As variáveis `VITE_*` são cadastradas em cada projeto.

Para um push num app não rebuildar os três, use em Settings → Git → Ignored Build Step (exemplo do cliente):

```bash
git diff HEAD^ HEAD --quiet -- . ../../packages ../../pnpm-lock.yaml
```
