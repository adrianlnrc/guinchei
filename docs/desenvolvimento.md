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
  pagamento/    GatewayPagamento (autorizar, capturar, estornar) e o adaptador mock
  estados/      máquinas de estado do Pedido e da Corrida (TS puro)
  tipos/        tipos compartilhados e gerados do schema
  api/          cliente Supabase compartilhado
  ui/           tokens da identidade visual e componentes React
  mock/         dados do cenário do protótipo navegável (o preço vem de @guinchei/preco)
supabase/
  config.toml   config do Supabase CLI (auth por telefone, números de teste)
  functions/    Edge Functions (Deno): cotar-pedido, confirmar-pedido, ofertar-proximo e estornar-pedido
  migrations/   schema, transições de estado, RLS e bucket de Fotos de estado
  seeds/        dados de referência e usuários de teste
  tests/        testes de banco (pgTAP)
```

Os pacotes não têm etapa de build: os apps importam o TypeScript direto (`@guinchei/<pacote>`) e o Vite compila.

## Primeira vez

```bash
pnpm install
pnpm supabase start          # sobe Postgres, Auth, Storage, Realtime e as Edge Functions em Docker
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
| `pnpm typecheck` | `tsc --noEmit` em todos os workspaces e nas Edge Functions |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier (`format:check` só verifica) |
| `pnpm build` | build de produção dos três apps |
| `pnpm test:db` | testes de banco (pgTAP) no Supabase local |
| `pnpm gen:tipos` | regera `packages/tipos/src/database.ts` a partir do schema local |
| `pnpm supabase db reset` | recria o banco local: migrações + seed |
| `pnpm supabase functions serve` | serve as Edge Functions com recarga ao salvar (veja [Edge Functions](#edge-functions)) |
| `pnpm supabase stop` | desliga o Supabase local |

Para testar um pacote só: `pnpm --filter @guinchei/preco test`.

O `@guinchei/api` tem um teste de integração (`packages/api/src/integracao.test.ts`) que só roda com `SUPABASE_URL` definida; sem ela, fica pulado (o CI ainda não sobe o Supabase). Com o Supabase local de pé, passe as chaves que o `pnpm supabase status -o env` mostra:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<ANON_KEY> SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY> \
  pnpm --filter @guinchei/api test
```

Ele entra como o Rafael e como o 5561900000006 (cadastro urgente); a `service_role` só apaga esse segundo usuário antes, para o teste poder rodar de novo sem `db reset`, e desliga por um instante os Guincheiros no teste de "sem guincho disponível" (e os religa no fim). O teste também passa pelas Edge Functions: abre o Pedido, grava o trajeto, cota, confirma e confere que o preço devolvido pela cotação, o gravado no Pedido e o valor autorizado são o mesmo, e que a cotação responde em menos de 2 s (RNF08). Por fim, percorre o Match (veja [Match](#match)) com os três Guincheiros do seed: confirmar oferta ao Marcos, a recusa passa ao Wagner (com quatro chamadas simultâneas a `ofertar-proximo` que não abrem uma segunda oferta) e o aceite cria a Corrida; e o esgotamento (recusa, expiração pelo pg_cron, recusa) até `sem_guincheiro`, seguido de "tentar de novo" com aceite e, noutro Pedido, do estorno. Para não esperar 30 s, ele baixa `parametros_match.timeout_oferta_segundos` para 3 s durante o bloco e devolve o valor anterior no fim (o bloco leva ~15 s). Um bloco final cobre o acompanhamento do Cliente (veja [Acompanhamento do Cliente](#acompanhamento-do-cliente)): o Cliente assina o Realtime, o Guincheiro aceita e avança a Corrida e o Cliente recebe cada etapa; o Cliente B (o 5561900000006, que ganha perfil se ainda não tiver) não recebe nenhum evento do Pedido do Rafael. Depende das Edge Functions servidas e do disparo pelo pg_net, que localmente já vem configurado pelo seed `03_match_local.sql`; se você criou uma função nova, rode `pnpm supabase functions serve` antes.

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
| `*_cotacao_do_pedido.sql` | `dados_da_cotacao` e `gravar_cotacao`, só para `service_role` (Edge Function `cotar-pedido`) |
| `*_pagamentos.sql` | tabela `pagamentos`; `preco_para_confirmar` e `registrar_pagamento`, só para `service_role` (Edge Function `confirmar-pedido`) |
| `*_match.sql` | pg_cron e pg_net; `parametros_match`; colunas do Match (`pedidos.rodada_match` e `cotado_em`, `tentativas_match.km_ate_veiculo`, `expira_em` e `respondida_em`, `corridas.repasse`); `dados_do_match`, `registrar_tentativa`, `encerrar_rodada_sem_guincheiro`, `pagamento_para_estornar` e `registrar_estorno` (só `service_role`); `aceitar_oferta`, `recusar_oferta` e `tentar_de_novo` (pela API); `varrer_match` e os jobs `match-varrer` e `match-limpar-historico-cron` |
| `*_corrida_do_guincheiro.sql` | trigger que devolve o Guincheiro ao plantão (`disponivel = true`) quando a Corrida chega a `entregue`; `hora_do_servidor()` (o app conta o prazo da oferta pela hora do banco); `tentativas_match` e `corridas` na publicação `supabase_realtime`, de forma idempotente (bloco `DO` que confere `pg_publication_tables`) |
| `*_acompanhamento.sql` | `pedidos` e `corridas` na publicação `supabase_realtime` (idempotente, para não colidir com outras migrações que adicionem tabelas); `contraparte_da_corrida` (só nome e Frota, só para quem participa da Corrida) |

Mudança de schema: `pnpm supabase migration new <nome>`, escreva o SQL, `pnpm supabase db reset`, `pnpm test:db` e `pnpm gen:tipos` (commite o `database.ts` gerado; ele já sai formatado pelo Prettier).

Regras que o banco garante (e que os testes de banco cobrem):

- **RLS:** o Cliente lê só os próprios Pedidos e Corridas; o Guincheiro lê os Pedidos oferecidos a ele (uma tentativa de Match que não foi `pulada_teto`) e a própria Corrida; a operação lê tudo. Ninguém lê perfil, Frota ou posição de outro, a não ser a operação. Cotar e confirmar o Pedido, registrar pagamento, registrar ofertas e estornar ficam com `service_role` (Edge Functions). O Cliente lê os pagamentos do próprio Pedido; ninguém escreve em `pagamentos` pela API. Pela API, o usuário só cria o próprio perfil de Cliente (com o telefone verificado no login), edita os dados opcionais, o Cliente abre o próprio Pedido por `abrir_pedido` e, se voltar às perguntas, troca as respostas por `atualizar_pedido_cotado` (só as três respostas, só em `cotado`), grava origem e destino por `definir_trajeto_pedido` (só em `cotado`, só no DF; nada de INSERT ou UPDATE direto em `pedidos`), o Guincheiro liga a disponibilidade, aceita ou recusa a oferta feita a ele (`aceitar_oferta`, que cria a Corrida, e `recusar_oferta`) e avança a própria Corrida, e o Cliente pede outra rodada do Match por `tentar_de_novo`.
- **Pedido antes da cotação:** o Pedido nasce `cotado` sem origem, destino, distâncias nem Preço fechado; o Cliente grava o trajeto pelo mapa (`definir_trajeto_pedido`, #9) e a cotação (`cotar-pedido`, #10) preenche distância até o veículo e preço pelo servidor. O banco exige o Preço fechado inteiro ou nenhum, cotação só com trajeto completo, e preço em todo Pedido fora de `cotado`. No app, voltar às perguntas e confirmar de novo atualiza o mesmo Pedido (o id fica no fluxo) em vez de abrir outro.
- **Cotação (RF05):** o preço é calculado no servidor, nunca no app: a Edge Function `cotar-pedido` chama `dados_da_cotacao` (Guincheiro elegível mais próximo, tabela vigente, feriados de perto da data de Brasília e a hora do servidor), calcula com `@guinchei/preco` e grava a decomposição inteira, com a versão da tabela e o ajuste do piso, por `gravar_cotacao`; o Pedido continua `cotado`. A gravação confere o `atualizado_em` lido: se o trajeto mudou no meio, nada é gravado (`GCT03`). Sem Guincheiro elegível, `GCT01` e o app mostra "Nenhum guincho disponível agora". Cada visita à tela de Preço cota de novo. **Provisório:** a distância até o veículo é a linha reta (PostGIS `geography`) do Guincheiro elegível mais próximo até a origem, e o km rebocado é o que o app gravou com o trajeto; a rota real no servidor depende do token de servidor do Mapbox.
- **Confirmação e pagamento (RF06):** a Edge Function `confirmar-pedido` lê o Preço fechado gravado (`preco_para_confirmar`), autoriza esse mesmo valor no `GatewayPagamento` (`@guinchei/pagamento`, adaptador mock) e registra o resultado em `pagamentos` (`registrar_pagamento`, que confere de novo o valor com o Pedido travado). Autorizado: o Pedido vai de `cotado` a `confirmado` e, na mesma transação, entra no Match (`em_match`, rodada 1; veja [Match](#match)). Recusado: o pagamento fica registrado como `recusado`, o Pedido continua `cotado` e o app mostra o erro. No máximo um pagamento `autorizado` ou `capturado` por Pedido. O mock autoriza sempre. Para testar a recusa, ele tem a opção `recusarValoresTerminadosEm99` (desligada por padrão), que a Edge Function só liga com `PAGAMENTO_MOCK_RECUSA_TESTE=1` (veja [Edge Functions](#edge-functions)); assim nenhum Preço fechado real é recusado; o estorno é chamado pela Edge Function `estornar-pedido` (sem Guincheiro, #11) e a captura fica para o fim da Corrida (#14).
- **Match (RF07):** veja [Match](#match). O banco garante: no máximo uma oferta aberta por Pedido (índice único parcial), cada Guincheiro no máximo uma vez por rodada, oferta só com prazo, aceite e recusa só pelo Guincheiro ofertado e com a oferta aberta e no prazo, "tentar de novo" e estorno só pelo dono e só em `sem_guincheiro`. O Guincheiro não vê a tentativa `pulada_teto` (nem o Pedido, por ela).
- **Só no DF (ADR-0001, trava 1 do ADR-0007):** `definir_trajeto_pedido` recusa origem ou destino fora do DF com o erro `GDF01` (o app mostra "O Guinchei atende só no Distrito Federal por enquanto."). O polígono é o de `packages/geo/src/limiteDF.ts` (IBGE, malha municipal, simplificado a ~55 m; a fonte está no cabeçalho do arquivo). `packages/geo/src/sincronia-sql.test.ts` confere que a migração tem os mesmos vértices e que o pgTAP (`supabase/tests/trajeto_do_pedido.test.sql`) testa os mesmos pontos de referência do Vitest. Trocar o trajeto de um Pedido apaga uma cotação anterior. Provisório: `km_rebocado` vem da rota do Mapbox calculada no app, e a cotação usa esse valor (veja acima).
- **Aceite dos termos:** `aceite_termos_em` é sempre a hora do servidor, como `fotos_estado.criado_em`; o app não tem permissão de mandar a coluna e só grava `aceite_termos_versao`. A hora muda quando a versão muda.
- **Transições:** a fonte da verdade é `packages/estados`. O banco tem a mesma tabela; `packages/estados/src/sincronia-sql.test.ts` (Vitest) compara a TS com a migração e `supabase/tests/transicoes.test.sql` (pgTAP) percorre todos os pares de estados e confere que o trigger aceita exatamente os da tabela. Mudou a máquina? Altere a TS, crie migração nova ajustando as tabelas e aponte o teste de sincronia para ela.
- **Fotos de estado:** objeto em `fotos-estado/<corrida_id>/<arquivo>` e uma linha em `fotos_estado`. `criado_em` é sempre a hora do servidor e `papel_autor` vem da Corrida; o app não consegue enviar nenhum dos dois. Cliente e Guincheiro da Corrida leem e enviam; a operação lê; não há update nem delete.

### Seed

`supabase db reset` carrega, em ordem, os arquivos de `supabase/seeds/`:

- `01_referencia.sql`: tabela de preços versão 1 (valores do ADR-0009) e feriados nacionais e do DF de 2026 e 2027. Carnaval e Corpus Christi ficam de fora por serem ponto facultativo. É o único seed que vale para staging.
- `02_usuarios_de_teste.sql`: os usuários abaixo, a Frota empresa "Reboque Planalto" e a Frota autônoma "Rita Campos", ambas ativas, e os três Guincheiros disponíveis com posição fixa. Só local.
- `03_match_local.sql`: os dois segredos do Vault que o Match usa para chamar a Edge Function `ofertar-proximo` pelo pg_net (URL `http://kong:8000/functions/v1` e a `service_role` padrão do Supabase CLI local). Só local; em staging, veja [Match](#match).

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
| `guinchei-server` | segredo das Edge Functions (rota real na cotação, ainda não usado) | nunca vai para o navegador |

Os tokens web são públicos (`pk.*`, só escopos públicos) e vão para o navegador; mesmo assim nenhum token entra no repositório, só no `.env.local` e na Vercel. Sem `VITE_MAPBOX_TOKEN`, a tela de origem e destino mostra o mapa esquemático do protótipo, a busca desligada e o aviso "Mapa indisponível: configure VITE_MAPBOX_TOKEN", e o fluxo segue com os dados do protótipo (sem gravar trajeto).

A busca só devolve endereços dentro do polígono do DF (o `bbox` do DF inclui Águas Lindas e Valparaíso, em Goiás). O Geocoding v6 não tem POIs: oficina pelo nome não aparece; busque pelo endereço ou marque no mapa.

Pendências que dependem do token (ainda não verificadas contra o Mapbox real): a qualidade dos endereços do DF (quadras, SQS/QNA, cidades-satélite; anotar na issue #9 e, se ruim, reabrir a escolha de provedor do ADR-0008), o formato real das respostas contra as fixtures de `packages/geo/src/mapbox.test.ts`, e os termos de armazenamento: o endereço vai gravado no Pedido, e o Geocoding separa resultado temporário (padrão) de permanente (`permanent=true`, cobrado à parte).

## Edge Functions

Ficam em `supabase/functions/` (Deno), uma pasta por função, com a base comum em `_compartilhado/servidor.ts`:

| Função | Corpo | O que faz |
|---|---|---|
| `cotar-pedido` | `{ pedido_id }` | calcula o Preço fechado com `@guinchei/preco` e grava no Pedido (RF05) |
| `confirmar-pedido` | `{ pedido_id, metodo: 'pix' \| 'cartao' }` | autoriza o Preço fechado gravado no `GatewayPagamento` mock, leva o Pedido a `confirmado` e `em_match` e faz a primeira oferta (RF06, RF07) |
| `ofertar-proximo` | `{ pedido_id }` | um passo do Match: oferta ao próximo Guincheiro ou leva o Pedido a `sem_guincheiro` (RF07). Só para o backend (exige a `service_role`); quem chama é o banco, pelo pg_net |
| `estornar-pedido` | `{ pedido_id }` | o Cliente desiste do Pedido em `sem_guincheiro`: estorna no `GatewayPagamento` mock e leva pagamento e Pedido a `estornado` |

`cotar-pedido`, `confirmar-pedido` e `estornar-pedido` exigem o JWT do Cliente (o `supabase-js` manda sozinho em `functions.invoke`), conferem quem é no Auth e falam com o banco pela `service_role`, só por funções do banco. Erro volta como `{ erro, mensagem }`; o `@guinchei/api` traduz `erro` em `ErroApi.motivo`.

As regras não são copiadas: as funções importam `packages/preco/src/index.ts`, `packages/pagamento/src/index.ts` e `packages/match/src/index.ts` por caminho relativo (os três pacotes são TS puro, sem imports). Por isso esses pacotes não podem ganhar dependências nem imports sem extensão `.ts`.

- **Local:** o `pnpm supabase start` já serve as funções que existem em `supabase/functions/`. Para recarregar ao salvar (ou depois de criar uma função nova), rode `pnpm supabase functions serve` num terminal à parte. Os logs aparecem nesse terminal.
- **Tipos:** o host não tem Deno; `pnpm typecheck` roda `tsc -p supabase/functions` com uma declaração mínima do runtime (`supabase/functions/deno.d.ts`).
- **Teste:** o teste de integração do `@guinchei/api` (acima) passa pelas duas funções. Ele cota um Preço fechado terminado em 99 centavos (com uma versão temporária da tabela, apagada no fim) e confere a confirmação nos dois modos do mock:
  - padrão (`pnpm supabase start`, sem variável): autorizado, como em staging;
  - recusa de teste: sirva as funções com `pnpm supabase functions serve --env-file supabase/testes-recusa.env` e rode o teste com `PAGAMENTO_MOCK_RECUSA_TESTE=1` também no ambiente do Vitest (ele só diz ao teste qual resultado esperar): recusado, e o Pedido continua `cotado`.
- **Staging:** `pnpm supabase functions deploy cotar-pedido confirmar-pedido ofertar-proximo estornar-pedido --project-ref <ref>`, e a configuração do [Match](#configuração-em-staging). O deploy empacota os imports relativos de `packages/`; confira no primeiro deploy. O Supabase injeta sozinho `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`, que é o que as funções usam hoje. **`PAGAMENTO_MOCK_RECUSA_TESTE` não deve existir em staging** (nem em nenhum ambiente com Cliente de verdade): com ela, o mock recusa todo Preço fechado terminado em 99 centavos. Segredos que vão existir (`pnpm supabase secrets set ...`): o token de servidor do Mapbox (`guinchei-server`) quando a cotação passar a usar a rota real, e as chaves do PSP real (RF12). Nenhum deles entra no repositório.

## Match

Match por auto-atribuição ao Guincheiro elegível mais próximo (RF07, [ADR-0002](adr/0002-match-auto-atribuicao-mais-proximo.md)), com o repasse pela distância de quem recebe ([ADR-0009](adr/0009-tabela-de-precos-inicial-e-repasse-por-distancia.md)) e o desfecho sem aceite da nota de revisão do [ADR-0008](adr/0008-stack-tecnica-do-skeleton.md).

### Ciclo

1. **Início.** A `confirmar-pedido` autoriza o pagamento; `registrar_pagamento` leva o Pedido a `confirmado` e, na mesma transação, a `em_match` na rodada 1. A primeira oferta sai na mesma requisição (a lógica do Match roda no processo da `confirmar-pedido`); se falhar, a varredura tenta de novo.
2. **Um passo** (`supabase/functions/_compartilhado/match.ts`, servido por `ofertar-proximo`): lê `dados_do_match` (candidatos de `guincheiros_elegiveis_proximos`, só Frotas ativas e Guincheiros disponíveis, com a distância de cada um; as tentativas da rodada; a tabela, os feriados e o instante da cotação) e decide com `decidirProximo` de `@guinchei/match`:
   - **ofertar** ao mais próximo que ainda não recebeu nesta rodada: recalcula o preço com a distância dele (`calcularPrecoFechado`) e avalia com `avaliarOfertaAoGuincheiro`. Se a absorção passa da Comissão inteira, grava `pulada_teto` e segue para o próximo (não conta como tentativa). Senão grava a oferta (`oferecida`, com o preço recalculado, o repasse e `expira_em = now() + timeout`);
   - **aguardar**, se já há oferta aberta;
   - **esgotado**: teto de tentativas (recusa e expiração contam) ou ninguém novo para receber → `sem_guincheiro`.
3. **Resposta do Guincheiro** pela API (`aceitarOferta`/`recusarOferta` do `@guinchei/api`): aceitar cria a Corrida `aceita` com o repasse oferecido, leva o Pedido a `atribuido` e o Guincheiro a indisponível; recusar marca `recusada` e pede a próxima oferta na hora. Ofertas abertas: `buscarOfertasAbertas` (um Guincheiro pode ter ofertas de Pedidos diferentes ao mesmo tempo).
4. **Expiração.** O job `match-varrer` do pg_cron roda `varrer_match()` a cada **5 s** (o pg_cron 1.6 do Supabase aceita intervalos em segundos): marca `expirada` as ofertas vencidas e pede a próxima oferta. A expiração acontece entre o timeout e o timeout + 5 s.
5. **Sem aceite.** O Pedido fica em `sem_guincheiro` com o pagamento **ainda autorizado**. O Cliente escolhe `tentarDeNovo` (rodada nova, mesmo Preço fechado e mesma autorização; todos os elegíveis podem receber de novo) ou `estornarPedido` (Edge Function `estornar-pedido`: `estornar` do `GatewayPagamento` mock, pagamento e Pedido `estornado`). Sem broadcast nem atribuição manual.

**Como o banco pede a próxima oferta.** Recusa, "tentar de novo" e a varredura chamam `disparar_ofertar_proximo(pedido_id)`, que faz um POST assíncrono pelo **pg_net** para `<match_url_funcoes>/ofertar-proximo` com `Authorization: Bearer <match_chave_servico>`; o pg_net só envia depois do commit. A varredura também repete o pedido para Pedidos em `em_match` sem oferta aberta e parados há mais de 15 s (um POST perdido, uma primeira oferta que falhou).

**Sem corrida.** Disparos simultâneos para o mesmo Pedido (o POST da recusa, a varredura, uma repetição) não abrem duas ofertas: `registrar_tentativa` e `encerrar_rodada_sem_guincheiro` travam o Pedido (`for update`) e conferem estado, rodada, a quantidade de tentativas lidas e que não há oferta aberta; se outra execução gravou antes, falham com `GMT03` e a Edge Function relê e decide de novo. O índice único parcial `tentativas_match_uma_aberta_por_pedido` é a última barreira. A varredura expira com `for update skip locked`, então duas varreduras não expiram a mesma oferta. Aceitar e recusar travam o Pedido antes da oferta, na mesma ordem.

### Parâmetros

`parametros_match` (uma linha, só `service_role`): `timeout_oferta_segundos` (padrão **30**) e `limite_tentativas` (padrão **3**, por rodada). Mudam sem deploy:

```sql
update public.parametros_match set timeout_oferta_segundos = 3;  -- timeout curto para testar à mão
update public.parametros_match set timeout_oferta_segundos = 30; -- de volta ao padrão
```

O teste de integração faz isso sozinho. `LIMITE_TENTATIVAS_PADRAO` em `@guinchei/match` documenta o valor de referência; o valor em uso é o do banco.

### Configuração em staging

As migrações já criam as extensões `pg_cron` e `pg_net` e os dois jobs. Falta só, uma vez por projeto, dizer ao banco onde estão as Edge Functions e com que chave chamá-las, no Vault (SQL Editor do projeto):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'match_url_funcoes',
  'URL base das Edge Functions, para o Match pedir a próxima oferta');
select vault.create_secret('<service_role key do projeto>', 'match_chave_servico',
  'service_role usada pelo Match para chamar a Edge Function ofertar-proximo');
```

- A chave tem de ser **a mesma `SUPABASE_SERVICE_ROLE_KEY` que o Supabase injeta nas Edge Functions** (a `service_role` JWT legada, em Settings → API): `ofertar-proximo` compara o `Authorization` com ela e recusa qualquer outra. Trocou a chave do projeto? Atualize o segredo: `select vault.update_secret((select id from vault.secrets where name = 'match_chave_servico'), '<nova>');`.
- Sem os dois segredos, `disparar_ofertar_proximo` só registra um aviso (`raise warning`) e nada avança depois da primeira oferta: recusa e expiração ficam paradas.
- Deploy das quatro funções (veja [Edge Functions](#edge-functions)). `ofertar-proximo` fica com a verificação de JWT padrão; a `service_role` passa.
- Conferir: `select jobname, schedule from cron.job;` (`match-varrer` a cada 5 s; `match-limpar-historico-cron` às 03:17 UTC, que apaga o histórico do pg_cron com mais de um dia) e, depois de uma recusa, `select status_code, content from net._http_response order by id desc limit 5;`.

### Provisório

- Um Guincheiro pode receber ofertas de Pedidos diferentes ao mesmo tempo; ao aceitar uma, fica indisponível e as outras falham com `guincheiro_indisponivel` (`GMT02`) até expirarem.
- Estorno: se o Cliente pedir "tentar de novo" entre o estorno no provedor e o registro, o registro falha com o valor já estornado. Com o PSP real (RF12), conciliar.
- O Painel do protótipo ainda mostra "atribuição manual" para Pedido sem aceite; a decisão do ADR-0008 é não ter atribuição manual.

## App do Guincheiro

`apps/guincheiro` (porta 5174), PWA instalável (manifest, ícones e service worker do `vite-plugin-pwa`). Para rodar contra o Supabase local: `cp apps/guincheiro/.env.example apps/guincheiro/.env.local`, preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e rode `pnpm dev:guincheiro`. Sem as duas variáveis, o app mostra "App sem configuração do servidor".

- **Entrada:** telefone + código (ADR-0010), com os números do seed (Marcos 61 90000-0002, Wagner …03, Rita …04; código 123456). O Guincheiro não se cadastra pelo app: telefone verificado sem perfil de Guincheiro (Cliente, operação ou número sem perfil) encerra a sessão e mostra "Este número não está cadastrado como Guincheiro". Rotas do app exigem Guincheiro (`ExigeGuincheiro`).
- **Plantão:** o interruptor grava `guincheiros.disponivel` (`definirDisponibilidade`); a tela relê o valor do banco ao abrir. O chamado só abre com o plantão ligado.
- **Chamado em tempo real:** `assinarOfertas` (Supabase Realtime, Postgres Changes em `tentativas_match`, sem filtro: a RLS entrega só as ofertas feitas ao Guincheiro) avisa a cada mudança e uma vez ao conectar; a tela relê `buscarOfertasAbertas`. A contagem regressiva usa `expira_em` e a hora do servidor (`hora_do_servidor()`, com o desvio medido a cada leitura), nunca o relógio do aparelho. Aceitar e recusar são `aceitarOferta` e `recusarOferta` (#11). O valor mostrado é o repasse gravado na oferta, pela distância do próprio Guincheiro.
- **Corrida:** um botão por etapa, na ordem: "Saí para o local" (`aceita → a_caminho`), "Cheguei" (`no_local`), "Carreguei" (`carregado`), "Entreguei" (`entregue`), por `avancarCorrida` (UPDATE de `corridas.estado`; a RLS limita à Corrida dele e o trigger do #6 confere a transição). Se a Corrida já estava em outra etapa (outra aba, a operação), o app avisa e mostra a etapa certa. `minhaCorridaAtual` retoma a Corrida ao abrir ou recarregar; `assinarCorrida` atualiza a tela por Realtime. Ao `entregue`, o banco devolve o Guincheiro ao plantão e a tela de repasse (`/repasse/:id`) mostra o valor gravado na Corrida. A captura do pagamento fica fora (#14).
- **Fotos de estado (#13):** as telas de fotos do protótipo continuam como prévia opcional ("Fotos de estado (opcional)" nas etapas no local e carregado): não gravam nada e não bloqueiam nenhuma etapa (ADR-0011). Avaliação do Cliente e histórico/ganhos do plantão também seguem do protótipo (dados de exemplo, só na sessão).
- **Push com a tela bloqueada:** fora, depende do spike #3. O app não promete tocar com a tela bloqueada; precisa ficar aberto.
- **Testes:** Vitest de componente com a API dublada (`apps/guincheiro/src/teste/apiFalsa.ts`: login, chamado, contagem, aceitar, recusar, expirar, ordem dos botões, repasse); pgTAP `corrida_do_guincheiro.test.sql` (avanço, disponibilidade, `hora_do_servidor`, publicação Realtime); integração do `@guinchei/api` (Cliente confirma, a oferta chega pelo Realtime só a quem a recebeu, aceita e avança até `entregue`).

## Acompanhamento do Cliente

Substituto do RF09 no skeleton (issue #14): a tela do Cliente mostra a **etapa** do Pedido e da Corrida e muda sozinha, sem mapa em tempo real nem GPS ao vivo (RF09 completo é do Incremento 1).

- **Etapas:** `em_match` (procurando guincho) → `aceita` ("Guincheiro aceitou, saindo em instantes") → `a_caminho` → `no_local` → `carregado` → `entregue`. `sem_guincheiro` oferece **Tentar de novo** (`tentarDeNovo`) e **Estornar o pagamento** (`estornarPedido`); `estornado` mostra o desfecho e leva a um novo Pedido.
- **Realtime (Postgres Changes):** `pedidos` e `corridas` estão na publicação `supabase_realtime`. O Realtime confere a RLS de cada linha para cada assinante, então o Cliente só recebe eventos do próprio Pedido e da própria Corrida (o pgTAP confere a publicação; o teste de integração confere que o Cliente B não recebe nada). As migrações que adicionam tabelas à publicação (esta, e a do app do Guincheiro com `tentativas_match`) checam `pg_publication_tables` antes, em qualquer ordem.
- **`@guinchei/api`:** `buscarAcompanhamento(pedidoId)` lê o estado (Pedido, Corrida e o Guincheiro); `buscarAcompanhamentoEmAndamento()` devolve o Pedido mais recente que ainda não terminou (pago e sem estorno nem entrega), para reabrir o app; `acompanharPedido(pedidoId, aoMudar)` assina o Realtime e devolve a função que cancela. Cada evento (e cada reconexão) relê o estado inteiro, então a Corrida e o nome do Guincheiro chegam juntos e uma leitura atrasada não sobrepõe uma mais nova.
- **O que o Cliente vê do Guincheiro:** só o nome e o nome da Frota, por `contraparte_da_corrida` (o perfil tem CPF e telefone e a RLS não o expõe). O schema não tem placa do guincho, então ela não aparece; e, sem o telefone, o app não oferece "Ligar" nem "Mensagem" (voltam com o contato mascarado, no Incremento 1).
- **Cancelar o Pedido (RN05, RF14)** fica fora do skeleton: o botão aparece desabilitado, "Cancelar Pedido · em breve".
- **Ao recarregar,** a tela de acompanhamento (`/acompanhamento`) recupera o Pedido em andamento do Cliente; sem nenhum, volta ao início do Pedido.

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
