# ADR-0008: Stack técnica do walking skeleton

- Status: aceito
- Data: 2026-10-15
- Decisores: Adrian de Alencar Stelo (produto e arquitetura)

## Contexto

O PRD do walking skeleton ([PRD.md](../produto/PRD.md)) deixou a stack técnica para um ADR à parte. O time tem seis pessoas, prazo acadêmico e nenhuma stack definida. As três superfícies são PWA ([ADR-0005](0005-mvp-em-pwa.md)), o pagamento é mockado no skeleton ([ADR-0004](0004-pagamentos-via-psp-com-split.md)) e o Match precisa de distância real ([ADR-0002](0002-match-auto-atribuicao-mais-proximo.md)).

## Decisão

- **Linguagem:** TypeScript de ponta a ponta.
- **Estrutura:** monorepo (pnpm workspaces) com três apps — `cliente`, `guincheiro`, `painel` — e pacotes compartilhados (tipos, `preco`, `match`, `estados`, cliente de API). Cada PWA tem manifest e escopo de instalação próprios.
- **Front-end:** Vite + React + `vite-plugin-pwa` (Workbox) + TanStack Query. Sem SSR: as superfícies são autenticadas e não precisam de SEO.
- **Back-end:** Supabase — Postgres com PostGIS, Auth (e-mail + senha), Storage (bucket privado para Fotos de estado) e Realtime (status da Corrida).
- **Lógica crítica:** regras de negócio em pacotes TS puros, testados com Vitest (TDD). Proximidade do Match via PostGIS (`ST_Distance`). Orquestração do Match (timeout de ~30s e passagem ao próximo) em Edge Function agendada por `pg_cron`.
- **Mapas:** Mapbox (mapa, geocoding e rotas).
- **Pagamento:** interface `GatewayPagamento` com adaptador mock no skeleton. A escolha do PSP fica para o Incremento 2 (RF12).
- **Testes e ambientes:** Vitest nos pacotes puros; Playwright para um e2e que automatiza os critérios de aceite do PRD. Supabase CLI local, um projeto Supabase de staging, PWAs na Vercel. Sem produção no skeleton.
- **Linguagem do código:** termos de domínio em português exatamente como no [CONTEXT.md](../../CONTEXT.md) (`Pedido`, `Corrida`, `Guincheiro`, `precoFechado`); termos técnicos em inglês. UI em PT-BR.

### Regras de domínio fixadas junto

- **Máquina de estados.** Pedido: `cotado → confirmado → em_match → atribuído | sem_guincheiro`. Corrida: `aceita → a_caminho → no_local → carregado → entregue`. `carregado` exige Fotos de estado "antes"; `entregue` exige Fotos "depois" e é terminal (equivale a encerrada, RN04). Transições são uma tabela em módulo TS puro e são reforçadas no banco.
- **Sem aceite.** Se todos os Guincheiros elegíveis recusarem ou expirarem (teto de 3 tentativas, cada Guincheiro recebe o Pedido no máximo uma vez), o Pedido vai a `sem_guincheiro`, o pagamento mock é estornado e o Cliente pode tentar de novo. O broadcast (RF08) substitui esse desfecho depois.
- **Preço × Match.** O Preço fechado usa a distância do Guincheiro disponível mais próximo no momento da cotação. O preço é travado; se o Match atribuir um Guincheiro mais distante, a plataforma absorve a diferença. Ver nota de revisão no [ADR-0003](0003-preco-fechado-definido-pela-plataforma.md).
- **Modelo de dados mínimo:** `perfis` (cliente / guincheiro / operação), `frotas` (`ativa`), `guincheiros` (Frota, posição fixa, `disponivel`), `pedidos`, `corridas`, `fotos_estado`, `tabela_precos`, `tentativas_match`. O Match só considera Guincheiros de Frotas ativas (invariante 3). RLS por papel.
- **Fotos de estado:** mínimo de 1 por etapa (até 6); hora gravada pelo servidor; GPS vindo do navegador. Fraude de GPS e de galeria fica fora do skeleton.
- **Tabela de preços** em banco, populada por seed, sem UI (a UI é o RF16). Valores iniciais validados por Adrian a partir de [precos-guincho-df.md](../pesquisa/precos-guincho-df.md), com o desconto de 10–15% do ADR-0003.

## Alternativas consideradas

- **Next.js:** traz SSR sem necessidade aqui e deixa o service worker e o manifest por superfície mais trabalhosos.
- **API própria (NestJS/Fastify) + Postgres gerenciado:** mais controle, mas exige construir auth, storage e realtime do zero. Mitigação da escolha atual: regras em pacotes TS puros, trocáveis.
- **Um app único com três áreas:** menos configuração, mas manifests e escopos de instalação colidem, e os dois devs de front trabalhariam no mesmo app.
- **Google Maps ou MapLibre/OSRM:** Google tem melhor cobertura no DF, mas cobra por uso e exige cartão; MapLibre é gratuito, mas dá mais trabalho. Reavaliar o Google se a qualidade de endereço no DF decepcionar.

## Consequências

- (+) Uma linguagem; tipos compartilhados entre front e API reduzem erro de contrato.
- (+) Pouca infraestrutura própria; foco em provar o fluxo.
- (+) Regras críticas testáveis e independentes do fornecedor.
- (−) Dependência do Supabase (Edge Functions e `pg_cron` têm limites; migração para API própria tem custo).
- (−) Três apps no monorepo exigem disciplina nos pacotes compartilhados.
- (−) iOS/PWA continua com push e GPS em segundo plano fracos; o spike da Fase 0 decide se o app do Guincheiro precisa de invólucro nativo (Capacitor).

## Nota de revisão (2026-10-17)

Decisões do grilling de 2026-10-17 que alteram este ADR:

- **Auth:** "e-mail + senha" foi substituído por telefone + código ([ADR-0010](0010-login-por-telefone-e-cadastro-em-duas-etapas.md)). No skeleton, só números de teste.
- **Fotos de estado:** deixam de ser condição para `carregado` e `entregue` ([ADR-0011](0011-fotos-de-estado-opcionais-cliente-e-guincheiro.md)). A máquina de estados da Corrida continua a mesma, sem guarda de fotos.
- **`aceita → a_caminho`:** é uma ação explícita do Guincheiro ("Saí para o local"). Cancelar antes dela não tem custo para o Cliente (RN05).
- **Sem aceite:** em `sem_guincheiro`, o Cliente escolhe entre **tentar de novo** (mesmo Preço fechado e mesma autorização de pagamento; nova rodada de Match em que todos os Guincheiros elegíveis podem receber o Pedido de novo) e **estornar**. Não há atribuição manual pelo Painel.
- **Preço × Match:** a nota do ADR-0003 é detalhada no [ADR-0009](0009-tabela-de-precos-inicial-e-repasse-por-distancia.md): o Guincheiro que aceita recebe pela própria distância, com teto na Comissão.
