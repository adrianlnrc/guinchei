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
  mock/         dados do protótipo navegável e dublês de preço e estados
supabase/
  config.toml   config do Supabase CLI (auth por telefone, números de teste)
  migrations/   schema, transições de estado, RLS e bucket de Fotos de estado
  seeds/        dados de referência e usuários de teste
  tests/        testes de banco (pgTAP)
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
| `pnpm test:db` | testes de banco (pgTAP) no Supabase local |
| `pnpm gen:tipos` | regera `packages/tipos/src/database.ts` a partir do schema local |
| `pnpm supabase db reset` | recria o banco local: migrações + seed |
| `pnpm supabase stop` | desliga o Supabase local |

Para testar um pacote só: `pnpm --filter @guinchei/preco test`.

O CI (`.github/workflows/ci.yml`) roda `format:check`, `lint`, `typecheck`, `test` e `build` em todo PR. Os testes de banco ainda não rodam no CI (entram junto com o e2e); rode `pnpm test:db` antes de abrir PR que mexa em `supabase/`.

## Banco de dados

O schema está em `supabase/migrations/`, uma migração por assunto:

| Migração | Conteúdo |
|---|---|
| `*_esquema_inicial.sql` | PostGIS, enums, validação de CPF/CNPJ, tabelas (`perfis`, `frotas`, `guincheiros`, `tabela_precos`, `feriados`, `pedidos`, `corridas`, `tentativas_match`, `fotos_estado`) |
| `*_transicoes_de_estado.sql` | tabelas `transicoes_pedido` / `transicoes_corrida` e triggers que rejeitam transição inválida |
| `*_guincheiros_elegiveis.sql` | `guincheiros_elegiveis_proximos(latitude, longitude, limite)`, só para `service_role` |
| `*_rls.sql` | GRANTs e políticas de RLS por papel |
| `*_storage_fotos_estado.sql` | bucket privado `fotos-estado` e suas políticas |

Mudança de schema: `pnpm supabase migration new <nome>`, escreva o SQL, `pnpm supabase db reset`, `pnpm test:db` e `pnpm gen:tipos` (commite o `database.ts` gerado; ele já sai formatado pelo Prettier).

Regras que o banco garante (e que os testes de banco cobrem):

- **RLS:** o Cliente lê só os próprios Pedidos e Corridas; o Guincheiro lê os Pedidos oferecidos a ele (uma tentativa de Match que não foi `pulada_teto`) e a própria Corrida; a operação lê tudo. Ninguém lê perfil, Frota ou posição de outro, a não ser a operação. Criar Pedido, avançar o Pedido, registrar ofertas e criar Corrida ficam com `service_role` (Edge Functions). Pela API, o usuário só cria o próprio perfil de Cliente (com o telefone verificado no login), edita os dados opcionais, e o Guincheiro liga a disponibilidade e avança a própria Corrida.
- **Transições:** a fonte da verdade é `packages/estados`. O banco tem a mesma tabela; `packages/estados/src/sincronia-sql.test.ts` (Vitest) compara a TS com a migração e `supabase/tests/transicoes.test.sql` (pgTAP) percorre todos os pares de estados e confere que o trigger aceita exatamente os da tabela. Mudou a máquina? Altere a TS, crie migração nova ajustando as tabelas e aponte o teste de sincronia para ela.
- **Fotos de estado:** objeto em `fotos-estado/<corrida_id>/<arquivo>` e uma linha em `fotos_estado`. `criado_em` é sempre a hora do servidor e `papel_autor` vem da Corrida; o app não consegue enviar nenhum dos dois. Cliente e Guincheiro da Corrida leem e enviam; a operação lê; não há update nem delete.

### Seed

`supabase db reset` carrega, em ordem, os arquivos de `supabase/seeds/`:

- `01_referencia.sql`: tabela de preços versão 1 (valores do ADR-0009) e feriados nacionais e do DF de 2026 e 2027. Carnaval e Corpus Christi ficam de fora por serem ponto facultativo. É o único seed que vale para staging.
- `02_usuarios_de_teste.sql`: os usuários abaixo, a Frota empresa "Reboque Planalto" e a Frota autônoma "Rita Campos", ambas ativas, e os três Guincheiros disponíveis com posição fixa. Só local.

### Usuários de teste

Login por telefone + código (ADR-0010). Os números são fictícios e estão em `[auth.sms.test_otp]` no `supabase/config.toml`: o código é sempre **123456** e nada é enviado. Para o Auth aceitar login por telefone, o Twilio fica ligado no config com credenciais de mentira; qualquer número fora da lista falha no envio.

| Papel | Nome | Telefone | Onde está |
|---|---|---|---|
| Cliente | Rafael Souza | +55 61 90000-0001 | (parado no Eixo Monumental no cenário do protótipo) |
| Guincheiro | Marcos Alves | +55 61 90000-0002 | Reboque Planalto · Cruzeiro, ~4,2 km do Eixo Monumental |
| Guincheiro | Wagner Lopes | +55 61 90000-0003 | Reboque Planalto · Asa Norte, ~4,9 km |
| Guincheiro | Rita Campos | +55 61 90000-0004 | autônoma · Guará, ~9,6 km |
| Operação | Operação Guinchei | +55 61 90000-0005 | |

No app, informe o número como `+5561900000001` (E.164). Os ids fixos dos usuários estão no seed, e os testes de banco contam com eles: rode `pnpm supabase db reset` antes de `pnpm test:db` se tiver mexido nos dados locais.

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
