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
  geo/          regra do DF (TS puro) e ServicoMapas: adaptador Mapbox e dublê em memória
  match/        decisão do Match (TS puro)
  estados/      máquinas de estado do Pedido e da Corrida (TS puro)
  tipos/        tipos compartilhados e gerados do schema
  api/          cliente Supabase compartilhado
  ui/           tokens da identidade visual e componentes React
  mock/         dados do cenário do protótipo navegável (o preço vem de @guinchei/preco)
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

`pnpm supabase status` mostra as chaves de novo. Para o mapa real na tela de origem e destino, preencha também `VITE_MAPBOX_TOKEN` (veja [Mapbox](#mapbox)); sem ele o app funciona com o mapa esquemático do protótipo. O Studio local fica em http://localhost:54323.

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

O `@guinchei/api` tem um teste de integração (`packages/api/src/integracao.test.ts`) que só roda com `SUPABASE_URL` definida; sem ela, fica pulado (o CI ainda não sobe o Supabase). Com o Supabase local de pé, passe as chaves que o `pnpm supabase status -o env` mostra:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<ANON_KEY> SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY> \
  pnpm --filter @guinchei/api test
```

Ele entra como o Rafael e como o 5561900000006 (cadastro urgente); a `service_role` só apaga esse segundo usuário antes, para o teste poder rodar de novo sem `db reset`.

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
| `*_abrir_pedido.sql` | `abrir_pedido(tipo_veiculo, situacao, rodas_giram)` para o Cliente; trajeto e Preço fechado nulos até a cotação |
| `*_aceite_termos_hora_do_servidor.sql` | `perfis.aceite_termos_em` gravado pelo servidor (o app manda só a versão dos termos) |
| `*_atualizar_pedido_cotado.sql` | `atualizar_pedido_cotado(pedido_id, ...)`: o Cliente troca as três respostas do próprio Pedido em `cotado` |
| `*_trajeto_do_pedido.sql` | `limite_df()` e `ponto_no_df(latitude, longitude)` (polígono do DF); `definir_trajeto_pedido(pedido_id, origem_lat, origem_lng, origem_endereco, destino_lat, destino_lng, destino_endereco, km_rebocado)`: o Cliente grava o trajeto do próprio Pedido em `cotado`, só dentro do DF |

Mudança de schema: `pnpm supabase migration new <nome>`, escreva o SQL, `pnpm supabase db reset`, `pnpm test:db` e `pnpm gen:tipos` (commite o `database.ts` gerado; ele já sai formatado pelo Prettier).

Regras que o banco garante (e que os testes de banco cobrem):

- **RLS:** o Cliente lê só os próprios Pedidos e Corridas; o Guincheiro lê os Pedidos oferecidos a ele (uma tentativa de Match que não foi `pulada_teto`) e a própria Corrida; a operação lê tudo. Ninguém lê perfil, Frota ou posição de outro, a não ser a operação. Cotar e avançar o Pedido, registrar ofertas e criar Corrida ficam com `service_role` (Edge Functions). Pela API, o usuário só cria o próprio perfil de Cliente (com o telefone verificado no login), edita os dados opcionais, o Cliente abre o próprio Pedido por `abrir_pedido` e, se voltar às perguntas, troca as respostas por `atualizar_pedido_cotado` (só as três respostas, só em `cotado`), grava origem e destino por `definir_trajeto_pedido` (só em `cotado`, só no DF; nada de INSERT ou UPDATE direto em `pedidos`), e o Guincheiro liga a disponibilidade e avança a própria Corrida.
- **Pedido antes da cotação:** o Pedido nasce `cotado` sem origem, destino, distâncias nem Preço fechado; o Cliente grava o trajeto pelo mapa (`definir_trajeto_pedido`, #9) e a cotação (#10) preenche distância até o veículo e preço pelo servidor. O banco exige o Preço fechado inteiro ou nenhum, cotação só com trajeto completo, e preço em todo Pedido fora de `cotado`. No app, voltar às perguntas e confirmar de novo atualiza o mesmo Pedido (o id fica no fluxo) em vez de abrir outro.
- **Só no DF (ADR-0001, trava 1 do ADR-0007):** `definir_trajeto_pedido` recusa origem ou destino fora do DF com o erro `GDF01` (o app mostra "O Guinchei atende só no Distrito Federal por enquanto."). O polígono é o de `packages/geo/src/limiteDF.ts` (IBGE, malha municipal, simplificado a ~55 m; a fonte está no cabeçalho do arquivo). `packages/geo/src/sincronia-sql.test.ts` confere que a migração tem os mesmos vértices e que o pgTAP (`supabase/tests/trajeto_do_pedido.test.sql`) testa os mesmos pontos de referência do Vitest. Trocar o trajeto de um Pedido apaga uma cotação anterior. Provisório: `km_rebocado` vem da rota do Mapbox calculada no app; a cotação (#10) recalcula no servidor com o token de servidor.
- **Aceite dos termos:** `aceite_termos_em` é sempre a hora do servidor, como `fotos_estado.criado_em`; o app não tem permissão de mandar a coluna e só grava `aceite_termos_versao`. A hora muda quando a versão muda.
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
| Cliente sem perfil | (nenhum) | +55 61 90000-0006 | só em `[auth.sms.test_otp]`, sem usuário nem perfil no seed: no primeiro login cai no cadastro urgente |

No app do Cliente, digite o celular com DDD, sem o +55 (ex.: `(61) 90000-0001`); o app envia em E.164 (`+5561900000001`). Os ids fixos dos usuários estão no seed, e os testes de banco contam com eles: rode `pnpm supabase db reset` antes de `pnpm test:db` se tiver mexido nos dados locais.

## Mapbox

Mapa (`mapbox-gl`), busca de endereço (Geocoding v6) e rota (Directions v5) ficam atrás da interface `ServicoMapas` de `@guinchei/geo` (ADR-0008). São três tokens, criados na conta do Mapbox:

| Token | Onde | Restrição |
|---|---|---|
| `guinchei-web-dev` | `VITE_MAPBOX_TOKEN` no `.env.local` e nos previews da Vercel | sem restrição de URL (localhost e URLs de preview mudam) |
| `guinchei-web-prod` | `VITE_MAPBOX_TOKEN` do ambiente Production do `guinchei-cliente` na Vercel | restrito ao domínio de produção do app |
| `guinchei-server` | segredo das Edge Functions (cotação, #10) | nunca vai para o navegador |

Os tokens web são públicos (`pk.*`, só escopos públicos) e vão para o navegador; mesmo assim nenhum token entra no repositório, só no `.env.local` e na Vercel. Sem `VITE_MAPBOX_TOKEN`, a tela de origem e destino mostra o mapa esquemático do protótipo, a busca desligada e o aviso "Mapa indisponível: configure VITE_MAPBOX_TOKEN", e o fluxo segue com os dados do protótipo (sem gravar trajeto).

A busca só devolve endereços dentro do polígono do DF (o `bbox` do DF inclui Águas Lindas e Valparaíso, em Goiás). O Geocoding v6 não tem POIs: oficina pelo nome não aparece; busque pelo endereço ou marque no mapa.

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
