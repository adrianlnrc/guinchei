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
  cnh/          regra CNH × PBT do ADR-0012 (TS puro)
  documentos/   CPF, CNPJ e CEP: validação e máscara, com as mesmas regras do banco (TS puro)
  tipos/        tipos compartilhados e gerados do schema
  api/          cliente Supabase compartilhado
  ui/           tokens da identidade visual e componentes React
  mock/         dados do cenário do protótipo navegável (o preço vem de @guinchei/preco)
e2e/
  skeleton.spec.ts   e2e do walking skeleton (Playwright), rodado no CI; veja [E2E](#e2e)
supabase/
  config.toml   config do Supabase CLI (auth por telefone, números de teste)
  functions/    Edge Functions (Deno): cotar-pedido, confirmar-pedido, ofertar-proximo e estornar-pedido
  migrations/   schema, transições de estado, RLS, buckets de Fotos de estado e de documentos de prestadores, homologação, cadastro de Frota
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
| `pnpm e2e` | e2e do skeleton (Playwright), veja [E2E](#e2e) |
| `pnpm gen:tipos` | regera `packages/tipos/src/database.ts` a partir do schema local |
| `pnpm supabase db reset` | recria o banco local: migrações + seed |
| `pnpm supabase functions serve` | serve as Edge Functions com recarga ao salvar (veja [Edge Functions](#edge-functions)) |
| `pnpm supabase stop` | desliga o Supabase local |

Para testar um pacote só: `pnpm --filter @guinchei/preco test`.

O `@guinchei/api` tem um teste de integração (`packages/api/src/integracao.test.ts`) que só roda com `SUPABASE_URL` definida; sem ela, fica pulado nos comandos locais sem Supabase (o job `integracao-e-e2e` do CI sobe o Supabase e roda o teste). Com o Supabase local de pé, passe as chaves que o `pnpm supabase status -o env` mostra:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<ANON_KEY> SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY> \
  pnpm --filter @guinchei/api test
```

Ele entra como o Rafael e como o 5561900000006 (cadastro urgente); a `service_role` só apaga esse segundo usuário antes, para o teste poder rodar de novo sem `db reset`, e desliga por um instante os Guincheiros no teste de "sem guincho disponível" (e os religa no fim). O teste também passa pelas Edge Functions: abre o Pedido, grava o trajeto, cota, confirma e confere que o preço devolvido pela cotação, o gravado no Pedido e o valor autorizado são o mesmo, e que a cotação responde em menos de 2 s (RNF08). Por fim, percorre o Match (veja [Match](#match)) com os três Guincheiros do seed: confirmar oferta ao Marcos, a recusa passa ao Wagner (com quatro chamadas simultâneas a `ofertar-proximo` que não abrem uma segunda oferta) e o aceite cria a Corrida; e o esgotamento (recusa, expiração pelo pg_cron, recusa) até `sem_guincheiro`, seguido de "tentar de novo" com aceite e, noutro Pedido, do estorno. Para não esperar 30 s, ele baixa `parametros_match.timeout_oferta_segundos` para 3 s durante o bloco e devolve o valor anterior no fim (o bloco leva ~15 s). Um bloco final cobre o acompanhamento do Cliente (veja [Acompanhamento do Cliente](#acompanhamento-do-cliente)): o Cliente assina o Realtime, o Guincheiro aceita e avança a Corrida e o Cliente recebe cada etapa; o Cliente B (o 5561900000006, que ganha perfil se ainda não tiver) não recebe nenhum evento do Pedido do Rafael. Depende das Edge Functions servidas e do disparo pelo pg_net, que localmente já vem configurado pelo seed `03_match_local.sql`; se você criou uma função nova, rode `pnpm supabase functions serve` antes.

O CI (`.github/workflows/ci.yml`) roda `format:check`, `lint`, `typecheck`, `test` e `build` em todo PR. O job `integracao-e-e2e` (separado, para o `verificar` continuar rápido) sobe o Supabase local no Docker do runner e roda `pnpm test:db`, a integração do `@guinchei/api` e o [E2E](#e2e); o relatório e os traces do Playwright viram o artefato `playwright-report` quando falha.

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
| `*_fotos_de_estado_etapa_e_limite.sql` | enum `etapa_foto` e `fotos_estado.etapa`; `fotos_estado_preencher` passa a derivar a etapa do estado da Corrida (`GFT01` se o app mandar outra) e a limitar 6 itens por autor e etapa (`GFT02`); política de Storage que deixa quem enviou apagar o arquivo ainda sem registro |
| `*_acompanhamento.sql` | `pedidos` e `corridas` na publicação `supabase_realtime` (idempotente, para não colidir com outras migrações que adicionem tabelas); `contraparte_da_corrida` (só nome e Frota, só para quem participa da Corrida) |
| `*_guarda_disponivel.sql` | trigger `guincheiros_disponivel_sem_corrida`: recusa `disponivel = true` enquanto o Guincheiro tem Corrida não terminal (`GDP01`); `disponivel = false` é sempre permitido, e a volta ao plantão em `entregue` passa porque a Corrida já saiu dos estados não terminais |
| `*_cnh_pbt.sql` | `categoria_cnh_cobre_pbt(categoria, pbt_kg)`: regra CNH × PBT do ADR-0012 (B até 3.500 kg, C ou superior acima, A e ACC nada); `true`, `false` ou `null` para entrada inválida |
| `*_homologacao.sql` | itens de homologação (`itens_homologacao`), trilha imutável (`auditoria_homologacao`), bucket privado `documentos-prestadores`; `enviar_item_homologacao`, `reenviar_item_homologacao` (o dono) e `decidir_item_homologacao` (só a operação) pela API; `marcar_itens_vencidos` (só `service_role`) e o job `homologacao-vencer` do pg_cron |
| `*_papel_representante.sql` | valor `representante` no enum `papel` (a quem gere a Frota; distinto de `guincheiro`). Num arquivo só: o valor novo não pode ser usado na transação que o cria |
| `*_cadastro_de_frota.sql` | campos do ADR-0012 em `frotas` (`representante_id`, `base_cep`, `base_endereco`, `base_bairro`, `chave_pix`, `apolice_validade`, `termos_prestador_versao`, `termos_prestador_em`); tabela `rascunhos_frota`; `enviar_cadastro_frota()`; políticas do representante em `frotas`, `itens_homologacao` e no bucket `documentos-prestadores`; `enviar_item_homologacao` e `reenviar_item_homologacao` passam a reconhecer o representante como dono dos itens de Frota |

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
- **CNH × PBT:** a fonte da verdade é `packages/cnh` (`categoriaCobrePbt`; `cnhHabilitaConduzir` soma a pré-condição EAR). O banco tem `categoria_cnh_cobre_pbt`; `packages/cnh/src/sincronia-sql.test.ts` (Vitest) confere a tabela de verdade do pgTAP `supabase/tests/cnh_pbt.test.sql` contra a TS. Mudou a regra? Altere a TS, crie migração nova, e atualize a tabela do pgTAP e os imports do teste de sincronia. O vínculo Guincheiro × veículo (ticket próprio) usa os dois lados.
- **Cadastro de Frota (ADR-0012):** veja [Cadastro de Frota autônoma](#cadastro-de-frota-autônoma). A Frota nasce `ativa = false` e só a operação a ativa: o representante lê e edita (nome, endereço da base e Pix) a própria Frota enquanto ela não está ativa, mas não escreve `ativa`, `documento`, `representante_id`, `apolice_validade` nem a hora do aceite dos termos (sem GRANT de coluna) e não cria Frota direto (só por `enviar_cadastro_frota`).
- **Homologação (RN03, ADR-0012):** veja [Homologação por item](#homologação-por-item). Cada documento ou dado de uma Frota, de um Guincheiro ou de um veículo é um item em `itens_homologacao` (`pendente`, `aprovado`, `recusado` ou `vencido`). Só a operação decide, por `decidir_item_homologacao`; ninguém escreve na tabela direto e a trilha `auditoria_homologacao` não aceita update, delete nem truncate, nem do `service_role` (trigger).
- **Fotos de estado:** veja [Fotos de estado](#fotos-de-estado). Objeto em `fotos-estado/<corrida_id>/<arquivo>` e uma linha em `fotos_estado`. `criado_em` é sempre a hora do servidor, `papel_autor` vem da Corrida e `etapa` é conferida contra o estado da Corrida; o app não consegue forjar nenhum dos três. Cliente e Guincheiro da Corrida leem e enviam; a operação lê; não há update nem delete de foto registrada. Nenhuma transição da Corrida exige foto.

### Seed

`supabase db reset` carrega, em ordem, os arquivos de `supabase/seeds/`:

- `01_referencia.sql`: tabela de preços versão 1 (valores do ADR-0009) e feriados nacionais e do DF de 2026 e 2027. Carnaval e Corpus Christi ficam de fora por serem ponto facultativo. É o único seed que vale para staging.
- `02_usuarios_de_teste.sql`: os usuários abaixo, a Frota empresa "Reboque Planalto" e a Frota autônoma "Rita Campos", ambas ativas, e os três Guincheiros disponíveis com posição fixa; mais a Frota pendente "Guincho Capital" (inativa, com o Guincheiro Paulo Mendes indisponível) e quatro itens de homologação para a demo do Painel. Só local.
- `03_match_local.sql`: os dois segredos do Vault que o Match usa para chamar a Edge Function `ofertar-proximo` pelo pg_net (URL `http://kong:8000/functions/v1` e a `service_role` padrão do Supabase CLI local). Só local; em staging, veja [Match](#match).

### Usuários de teste

Login por telefone + código (ADR-0010). Os números são fictícios e estão em `[auth.sms.test_otp]` no `supabase/config.toml`: o código é sempre **123456** e nada é enviado. Para o Auth aceitar login por telefone, o Twilio fica ligado no config com credenciais de mentira; qualquer número fora da lista falha no envio.

| Papel | Nome | Telefone | Onde está |
|---|---|---|---|
| Cliente | Rafael Souza | +55 61 90000-0001 | (parado no Eixo Monumental no cenário do protótipo) |
| Guincheiro | Marcos Alves | +55 61 90000-0002 | Reboque Planalto · Cruzeiro, ~4,2 km do Eixo Monumental |
| Guincheiro | Wagner Lopes | +55 61 90000-0003 | Reboque Planalto · Asa Norte, ~4,9 km |
| Guincheiro | Rita Campos | +55 61 90000-0004 | autônoma · Guará, ~9,6 km |
| Operação | Operação Guinchei | +55 61 90000-0005 | entra no Painel (porta 5175) |
| Guincheiro | Paulo Mendes | +55 61 90000-0007 | Guincho Capital · Frota pendente de homologação (inativa, indisponível, fora do Match); dono dos itens da demo |
| Prestador novo, sem perfil | (nenhum) | +55 61 90000-0008 | só em `[auth.sms.test_otp]`, sem usuário nem perfil no seed: no app do Guincheiro cai no cadastro de Frota autônoma ([Cadastro de Frota autônoma](#cadastro-de-frota-autônoma)) |
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

- **Guarda de disponibilidade:** o banco recusa `guincheiros.disponivel = true` (`GDP01`, `em_corrida` na API) enquanto o Guincheiro tem Corrida em `aceita`, `a_caminho`, `no_local` ou `carregado`, por qualquer caminho (outra aba, SQL). O App do Guincheiro volta o interruptor e mostra "Termine a Corrida em andamento antes de ficar disponível".
- Um Guincheiro pode receber ofertas de Pedidos diferentes ao mesmo tempo; ao aceitar uma, fica indisponível e as outras falham com `guincheiro_indisponivel` (`GMT02`) até expirarem.
- Estorno: se o Cliente pedir "tentar de novo" entre o estorno no provedor e o registro, o registro falha com o valor já estornado. Com o PSP real (RF12), conciliar.
- O Monitor do Painel só observa o Match (Pedidos `em_match` e `sem_guincheiro`, sobre dados de exemplo) e não tem ação de atribuição; quem decide em `sem_guincheiro` é o Cliente. Ligar o Monitor ao banco fica para outro ticket.

## App do Guincheiro

`apps/guincheiro` (porta 5174), PWA instalável (manifest, ícones e service worker do `vite-plugin-pwa`). Para rodar contra o Supabase local: `cp apps/guincheiro/.env.example apps/guincheiro/.env.local`, preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e rode `pnpm dev:guincheiro`. Sem as duas variáveis, o app mostra "App sem configuração do servidor".

- **Entrada:** telefone + código (ADR-0010), com os números do seed (Marcos 61 90000-0002, Wagner …03, Rita …04; código 123456). Depois do código: Guincheiro vai ao plantão; telefone **sem perfil** vai ao cadastro da própria Frota (`/cadastro`, veja [Cadastro de Frota autônoma](#cadastro-de-frota-autônoma)); representante (já enviou o cadastro) vai à própria Frota (`/frota`); perfil de Cliente ou da operação encerra a sessão e mostra "Este número não está cadastrado como Guincheiro". As demais rotas do app exigem Guincheiro (`ExigeGuincheiro`, que redireciona quem ainda não é).
- **Plantão:** o interruptor grava `guincheiros.disponivel` (`definirDisponibilidade`); a tela relê o valor do banco ao abrir. O chamado só abre com o plantão ligado.
- **Chamado em tempo real:** `assinarOfertas` (Supabase Realtime, Postgres Changes em `tentativas_match`, sem filtro: a RLS entrega só as ofertas feitas ao Guincheiro) avisa a cada mudança e uma vez ao conectar; a tela relê `buscarOfertasAbertas`. A contagem regressiva usa `expira_em` e a hora do servidor (`hora_do_servidor()`, com o desvio medido a cada leitura), nunca o relógio do aparelho. Aceitar e recusar são `aceitarOferta` e `recusarOferta` (#11). O valor mostrado é o repasse gravado na oferta, pela distância do próprio Guincheiro.
- **Corrida:** um botão por etapa, na ordem: "Saí para o local" (`aceita → a_caminho`), "Cheguei" (`no_local`), "Carreguei" (`carregado`), "Entreguei" (`entregue`), por `avancarCorrida` (UPDATE de `corridas.estado`; a RLS limita à Corrida dele e o trigger do #6 confere a transição). Se a Corrida já estava em outra etapa (outra aba, a operação), o app avisa e mostra a etapa certa. `minhaCorridaAtual` retoma a Corrida ao abrir ou recarregar; `assinarCorrida` atualiza a tela por Realtime. Ao `entregue`, o banco devolve o Guincheiro ao plantão e a tela de repasse (`/repasse/:id`) mostra o valor gravado na Corrida. A captura do pagamento fica fora (#14).
- **Fotos de estado (#13):** a tela `/fotos` (botão "Fotos de estado (opcional)" nas etapas no local e carregado) grava de verdade, pela câmera do celular (veja [Fotos de estado](#fotos-de-estado)). Em "Carreguei" e "Entreguei", se o Guincheiro não tem foto **dele** na etapa (`listarFotosEstado`; se a leitura falhar, pergunta também), o app mostra o aviso "Registrar fotos protege você se houver reclamação de avaria." e só avança com "Seguir sem fotos"; com foto na etapa, avança direto. Avaliação do Cliente e histórico/ganhos do plantão seguem do protótipo (dados de exemplo, só na sessão).
- **Push com a tela bloqueada:** fora, depende do spike #3. O app não promete tocar com a tela bloqueada; precisa ficar aberto.
- **Testes:** Vitest de componente com a API dublada (`apps/guincheiro/src/teste/apiFalsa.ts`: login, chamado, contagem, aceitar, recusar, expirar, ordem dos botões, repasse); pgTAP `corrida_do_guincheiro.test.sql` (avanço, disponibilidade, `hora_do_servidor`, publicação Realtime); integração do `@guinchei/api` (Cliente confirma, a oferta chega pelo Realtime só a quem a recebeu, aceita e avança até `entregue`).

## Painel de operação

`apps/painel` (porta 5175), PWA de desktop. Para rodar contra o Supabase local: `cp apps/painel/.env.example apps/painel/.env.local`, preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (as mesmas dos outros apps; `VITE_MAPBOX_TOKEN` o Painel ainda não usa) e rode `pnpm dev:painel`. Sem as duas variáveis, o Painel mostra "App sem configuração do servidor" (o build do CI roda sem elas).

- **Entrada:** telefone + código (ADR-0010), com o número da operação do seed (**61 90000-0005**, "Operação Guinchei"; código 123456). Só entra quem tem perfil com papel `operacao`: telefone verificado de Cliente, Guincheiro ou sem perfil encerra a sessão e mostra "Este número não está cadastrado como operação". Todas as rotas do Painel exigem a operação (`ExigeOperacao`); uma sessão guardada de outro papel é encerrada ao abrir.
- **API:** `ApiPainel` em `@guinchei/api` (`criarApiPainel`): `enviarCodigo`, `confirmarCodigo`, `temSessao`, `buscarMeuPerfil`, `sair` e `buscarMeuOperador` (`null` se o perfil não é `operacao`). Os testes de integração estão em `packages/api/src/integracao.test.ts` (bloco "Painel de operação") e incluem a prova de que a RLS de `eh_operacao()` deixa a operação, e só ela, ler o perfil de outra pessoa. Os testes do app usam o dublê em memória `src/teste/apiFalsa.ts`.
- **Sair:** o botão "Sair" na lateral chama `ApiPainel.sair()` e volta para `/entrar`; se a chamada falhar, o Painel avisa e a sessão continua.
- **Dados:** o nome na lateral vem do perfil da sessão e a Homologação lê o banco (veja [Homologação por item](#homologação-por-item)). Monitor, Disputas e Tabela de preços continuam com dados de exemplo (`@guinchei/mock`).
- **Fora de escopo:** não há expiração visível da sessão; o e2e (`pnpm e2e`) ainda não cobre o Painel. A entrada "Frotas" da lateral segue inativa: a lista de Frotas ativas é de outro ticket, e apontá-la para a Homologação duplicaria o link.

## Homologação por item

ADR-0012, invariante 3 e RN03 (issue #42). A homologação é por **item**: um documento ou dado a verificar de uma Frota (alvará, apólice de RC), de um Guincheiro (CNH, certidão de antecedentes, selfie) ou de um veículo (CRLV, foto). Esta fatia só **decide itens**; ativar a Frota (`frotas.ativa`) é do ticket de elegibilidade.

- **Tabela `itens_homologacao`:** `frota_id`, `alvo` (`frota`, `guincheiro` ou `veiculo`) e `alvo_id`, `tipo`, `dono_id` (quem enviou e pode reenviar), `arquivo` (caminho no bucket, sempre `<dono_id>/<arquivo>`), `validade` (último dia, quando houver), `estado`, `motivo` e `enviado_em` (a ordem da fila). Um item por documento de cada alvo (`alvo`, `alvo_id`, `tipo`): refazer é reenviar. O veículo ainda não tem tabela, então `alvo_id` de veículo não tem FK.
- **Estados e transições:** `pendente` → `aprovado` ou `recusado` (a operação; recusar exige motivo); `aprovado` → `vencido` (job, quando a validade passa); `recusado` e `vencido` → `pendente` (o dono reenvia). Qualquer outra é recusada por trigger, até para o `service_role`: aprovar item `vencido` ou `recusado` sem reenvio não passa. O item nasce `pendente`. A validade vale até o fim do dia em Brasília; aprovar com validade já passada é recusado.
- **Funções (todas `security definer`):** `decidir_item_homologacao(item_id, decisao, motivo)` só para a operação; `enviar_item_homologacao(alvo, alvo_id, tipo, arquivo, validade)` e `reenviar_item_homologacao(item_id, arquivo, validade)` para o dono: o representante envia e reenvia os itens da Frota e dos veículos, o Guincheiro os dele (o arquivo precisa já estar no bucket, na pasta de quem envia; reenviar torna quem reenviou o dono do item); `marcar_itens_vencidos()` só para o `service_role` e para o job `homologacao-vencer` (pg_cron, 00:05 em Brasília). Quem não pode agir recebe `42501`; item inexistente ou de outro dono, `P0002`.
- **Erros:** `GHM03` transição inválida, `GHM04` recusa sem motivo, `GHM05` validade já vencida, `GHM06` arquivo fora do bucket, `GHM07` alvo inválido. A API os traduz em `ErroApi` (`transicao_invalida`, `motivo_obrigatorio`, `documento_vencido`, `sem_permissao`, `item_indisponivel`).
- **Auditoria (`auditoria_homologacao`):** um trigger grava uma linha na entrada do item e em cada mudança de estado: item, `de` (nulo na entrada), `para`, `motivo` (o da recusa; "Validade vencida em ..." no vencimento), `por` (quem agiu; nulo quando foi o job) e `em` (hora do servidor, `default now()`). Só a operação lê. Ninguém tem GRANT de escrita, e um trigger recusa update, delete e truncate para qualquer papel; o item não pode ser apagado porque a trilha o referencia.
- **Bucket `documentos-prestadores`:** privado, 10 MiB, PDF e imagens (JPEG, PNG, WebP, HEIC/HEIF). Objetos em `<dono_id>/<arquivo>`. O dono (Guincheiro ou representante) lê e envia na própria pasta, e quem está cadastrando a Frota (sem perfil, com rascunho aberto) também envia; a operação lê tudo; mais ninguém. Sem update nem delete pela API. Como no bucket de Fotos de estado, o banco confere na função que o arquivo existe, mas um arquivo enviado e nunca registrado fica órfão (limpeza periódica é melhoria futura).
- **RLS:** o dono e o representante da Frota leem os itens e a operação lê todos; a trilha é só da operação. Outro Guincheiro, Cliente ou `anon` não lê nada.
- **`@guinchei/api` (`ApiPainel`):** `listarFilaHomologacao()` (Frotas com item `pendente`, a de envio mais antigo primeiro, com a contagem de pendentes), `buscarFrotaHomologacao(frotaId)` (a Frota com todos os itens), `aprovarItem(itemId)`, `recusarItem(itemId, motivo)` e `urlDoDocumento(itemId)` (URL assinada de **5 min**, `VALIDADE_URL_DOCUMENTO_SEGUNDOS`).
- **Painel:** a tela Homologação mostra a fila à esquerda (só Frotas com item pendente; a Frota some quando todos os itens estão decididos, e o número ao lado de "Homologação" na lateral é o tamanho da fila), o detalhe da Frota com todos os itens, o estado de cada um (o vencido em destaque, sem Aprovar nem Recusar, "Aguardando novo envio do documento"), "Ver documento" (abre a URL assinada numa aba nova), "Aprovar" e "Recusar" (pede o motivo; o botão de confirmar só habilita com texto). Erros da API aparecem no aviso do Painel e o detalhe e a fila são relidos.
- **Demo:** `supabase db reset` cria a Frota pendente "Guincho Capital" (alvará aprovado; apólice de RC, CNH do Paulo e CRLV pendentes). Os arquivos do seed não existem no bucket, então "Ver documento" mostra "Documento indisponível" nela; para ver um documento de verdade, entre como Paulo (+55 61 90000-0007) num cliente Supabase, envie um PDF a `documentos-prestadores/<id do Paulo>/` e aponte o item para ele.
- **Dono do item:** o representante da Frota (#43, veja [Cadastro de Frota autônoma](#cadastro-de-frota-autônoma)) para alvará e apólice; o Guincheiro, para os documentos dele. A Frota de um item é a do representante ou do Guincheiro que o envia. As Frotas do seed (que antecedem o cadastro) não têm representante: os itens da "Guincho Capital" são do Paulo.
- **Provisório:** não há notificação ao dono quando o item é decidido, nem tela de reenvio de item recusado no app (a função `reenviar_item_homologacao` já existe).
- **Testes:** pgTAP `homologacao.test.sql` (transições, auditoria e imutabilidade, RLS da tabela e do bucket, job de vencimento); integração do `@guinchei/api` (bloco "Homologação por item", com Storage e URL assinada reais); Vitest do Painel (`Homologacao.test.tsx`: fila, detalhe, aprovar, recusar com motivo, documento, vencido destacado; `Entrada.test.tsx`: Sair).

## Cadastro de Frota autônoma

ADR-0012 e ADR-0007 (issue #43). A primeira fatia do cadastro: uma pessoa autônoma (CPF ou MEI) sem conta chega a uma Frota `pendente` na fila do Painel. O detalhamento do modelo está no [ADR-0012](adr/0012-cadastro-de-prestadores-empresa-e-autonomo.md).

- **Fluxo no app do Guincheiro (`/cadastro`):** telefone + código; sem perfil, o app oferece "Cadastrar minha Frota" e abre cinco etapas curtas: **dados** (CPF ou CNPJ do MEI, nome, representante; o celular vem do login), **endereço** da base (CEP, endereço, bairro), **documentos** (alvará e apólice de RC por avaria em PDF ou foto de até 10 MiB, com a validade da apólice), **Pix** e **termos** para prestadores. CPF e CNPJ são validados no app por `@guinchei/documentos`, a mesma regra de `cpf_valido`/`cnpj_valido`. Depois do envio o app mostra a Frota (`/frota`) com o estado de cada item.
- **Rascunho no banco:** a cada "Continuar" (e a cada documento enviado) o app grava `rascunhos_frota` (`etapa` e `dados`, um por conta). Quem sai e volta, em qualquer aparelho, vê "Continuar meu cadastro" na etapa em que parou. Só abre rascunho quem ainda não é prestador (sem perfil, ou representante sem Frota): Cliente, Guincheiro e operação recebem `42501`.
- **Documentos:** o app envia cada arquivo ao bucket `documentos-prestadores` (`<usuario>/<uuid>.<ext>`) assim que é escolhido e guarda o caminho no rascunho; o bucket limita tipo e tamanho (10 MiB; PDF, JPEG, PNG, WebP, HEIC/HEIF). O envio do cadastro confere que os dois arquivos existem na pasta de quem envia.
- **Envio (`enviar_cadastro_frota()`):** valida tudo no servidor e, numa transação, cria o perfil de representante (telefone do login, CPF e nome do representante; o aceite dos termos do perfil é a versão dos termos para prestadores), a Frota com `ativa = false` e todos os campos do ADR-0012, e um item `pendente` para o alvará e outro para a apólice (com a validade), que entram na trilha de auditoria e na fila do Painel. A hora do aceite dos termos (`frotas.termos_prestador_em`) é a do servidor: o app manda só a versão. Erros: `GCF01` sem cadastro em andamento, `GCF02` documento da Frota inválido, `GCF03` CPF do representante inválido (ou, no autônomo de CPF, diferente do documento), `GCF04` dado obrigatório ausente, `GCF05` apólice sem validade, vencida ou a vencer em menos de 30 dias, `GCF06` quem não pode cadastrar, `GCF07` termos não aceitos; CPF e documento já cadastrados voltam como `23505`. A API os traduz em `ErroApi` (`documento_invalido`, `cpf_representante_invalido`, `dados_incompletos`, `apolice_curta`, `termos_nao_aceitos`, `cpf_ja_cadastrado`, `documento_ja_cadastrado`, `documento_ausente`, `cadastro_indisponivel`).
- **Apólice (ADR-0007):** o formulário e o servidor recusam validade já vencida ou a vencer em menos de 30 dias ("A apólice vence em menos de 30 dias. Envie uma apólice com validade a partir de 17/11/2026."). A conta é pela data do aparelho no app e por Brasília no servidor, que é quem vale: quem tem o relógio adiantado vê a recusa do servidor com a mesma mensagem. `DIAS_MINIMOS_VALIDADE_APOLICE` (`@guinchei/api`) e `apolice_validade_aceitavel` (banco) guardam os 30 dias.
- **Depois do envio:** o representante lê a própria Frota (e só ela) e seus itens, com o motivo da recusa, e edita nome, endereço da base e Pix enquanto a Frota não está ativa (pendente ou recusada na homologação); não consegue se ativar nem mexer em documento, representante, apólice ou hora do aceite. A Frota aparece na fila do Painel ([Homologação por item](#homologação-por-item)). O autônomo ainda **não entra em plantão**: a linha em `guincheiros` vem com os documentos de Guincheiro (ticket próprio).
- **`@guinchei/api` (`ApiGuincheiro`):** `telefoneDaSessao`, `buscarRascunhoFrota`, `salvarRascunhoFrota`, `enviarDocumentoDaFrota`, `enviarCadastroFrota` e `buscarMinhaFrota`.
- **Seed e teste à mão:** o número **61 90000-0008** (código 123456) não tem usuário nem perfil: entre com ele no app do Guincheiro (`pnpm dev:guincheiro`) para percorrer o cadastro; a Frota aparece na Homologação do Painel. Para repetir, `pnpm supabase db reset`. A integração do `@guinchei/api` (bloco "Cadastro de Frota autônoma") usa o mesmo número e pode rodar de novo sem `db reset`: quem cadastrou uma Frota não pode ser apagado (a trilha de auditoria referencia os itens), então o teste troca o telefone do usuário anterior por um número aleatório antes de cada rodada.
- **Provisório / fora desta fatia:** formulário da empresa (CNPJ, vários Guincheiros), documentos de Guincheiro (CNH, antecedentes, selfie) e a linha em `guincheiros` do autônomo, reenvio de item recusado pelo app, notificação da decisão, e o texto definitivo dos termos para prestadores (versão `prestadores-provisoria-2026-10`).
- **Testes:** pgTAP `cadastro_frota.test.sql` (rascunho, envio e todas as recusas, itens e auditoria, RLS do representante, de quem é de fora e de `anon`, hora do aceite); integração do `@guinchei/api` (rascunho retomado em outro aparelho, upload, recusas, envio e a Frota na fila do Painel); Vitest do app por etapa (`Cadastro.test.tsx`: dados, endereço, documentos, Pix, termos, retomada, Minha Frota) e `@guinchei/documentos`.

## Acompanhamento do Cliente

Substituto do RF09 no skeleton (issue #14): a tela do Cliente mostra a **etapa** do Pedido e da Corrida e muda sozinha, sem mapa em tempo real nem GPS ao vivo (RF09 completo é do Incremento 1).

- **Etapas:** `em_match` (procurando guincho) → `aceita` ("Guincheiro aceitou, saindo em instantes") → `a_caminho` → `no_local` → `carregado` → `entregue`. `sem_guincheiro` oferece **Tentar de novo** (`tentarDeNovo`) e **Estornar o pagamento** (`estornarPedido`); `estornado` mostra o desfecho e leva a um novo Pedido.
- **Realtime (Postgres Changes):** `pedidos` e `corridas` estão na publicação `supabase_realtime`. O Realtime confere a RLS de cada linha para cada assinante, então o Cliente só recebe eventos do próprio Pedido e da própria Corrida (o pgTAP confere a publicação; o teste de integração confere que o Cliente B não recebe nada). As migrações que adicionam tabelas à publicação (esta, e a do app do Guincheiro com `tentativas_match`) checam `pg_publication_tables` antes, em qualquer ordem.
- **`@guinchei/api`:** `buscarAcompanhamento(pedidoId)` lê o estado (Pedido, Corrida e o Guincheiro); `buscarAcompanhamentoEmAndamento()` devolve o Pedido mais recente que ainda não terminou (pago e sem estorno nem entrega), para reabrir o app; `acompanharPedido(pedidoId, aoMudar)` assina o Realtime e devolve a função que cancela. Cada evento (e cada reconexão) relê o estado inteiro, então a Corrida e o nome do Guincheiro chegam juntos e uma leitura atrasada não sobrepõe uma mais nova.
- **O que o Cliente vê do Guincheiro:** só o nome e o nome da Frota, por `contraparte_da_corrida` (o perfil tem CPF e telefone e a RLS não o expõe). O schema não tem placa do guincho, então ela não aparece; e, sem o telefone, o app não oferece "Ligar" nem "Mensagem" (voltam com o contato mascarado, no Incremento 1).
- **Cancelar o Pedido (RN05, RF14)** fica fora do skeleton: o botão aparece desabilitado, "Cancelar Pedido · em breve".
- **Ao recarregar,** a tela de acompanhamento (`/acompanhamento`) recupera o Pedido em andamento do Cliente; sem nenhum, volta ao início do Pedido.

## Fotos de estado

ADR-0011 (issue #13): fotos e vídeos do veículo, **opcionais**, registrados pelo Cliente e pelo Guincheiro. A Corrida encerra sem eles: não há guarda nas transições (o pgTAP `fotos_estado_etapa.test.sql` percorre uma Corrida inteira sem foto).

- **Etapa:** "antes" enquanto a Corrida está em `aceita`, `a_caminho` ou `no_local` (até o Guincheiro tocar em "Carreguei"); "depois" em `carregado` e `entregue`. Quem decide é o servidor, pelo estado da Corrida no momento do registro (`fotos_estado_preencher`). O app manda a etapa que acha que é (`etapaDaFoto` de `@guinchei/estados`, a mesma regra em TS); se a Corrida mudou no meio, o banco recusa (`GFT01`, `etapa_mudou`) e a foto não cai na etapa errada.
- **Limite:** até **6 itens por etapa e por autor** (o Cliente e o Guincheiro têm 6 cada; foto e vídeo contam igual), garantido por trigger com trava de aconselhamento contra registros simultâneos (`GFT02`, `limite_de_fotos`). A tela também trava o botão no 6º. Recomendação exibida: pelo menos 2 antes do carregamento e 2 na entrega.
- **Vídeo:** até 30 s (`DURACAO_MAXIMA_VIDEO_SEGUNDOS`). O app lê a duração por `HTMLVideoElement` (metadados) antes de enviar e recusa o que passar; o banco só limita tipo e tamanho do bucket (50 MiB; JPEG, PNG, WebP, HEIC/HEIF, MP4, MOV, WebM). Se o aparelho não deixar ler a duração, o app não envia ("Não foi possível ler o vídeo").
- **Envio (`registrarFotoEstado(corridaId, arquivo, { etapa, latitude?, longitude? })`):** valida tipo e tamanho, envia ao Storage em `<corrida_id>/<uuid>.<ext>` e insere em `fotos_estado`. Se o insert falha (limite, etapa, rede), apaga o arquivo enviado: uma política de Storage deixa quem enviou apagar **só** o arquivo ainda sem linha em `fotos_estado`; arquivo registrado é prova de Disputa e ninguém apaga. Se a limpeza também falhar, o arquivo fica órfão no bucket, sem acesso por nenhuma tela (limpeza periódica de órfãos fica como melhoria).
- **Leitura (`listarFotosEstado(corridaId)`):** devolve as fotos dos dois lados, da mais antiga à mais nova, com URL assinada de **15 min** (`VALIDADE_URL_FOTO_SEGUNDOS`) gerada pelo Storage; as telas relêem a lista ao abrir e a cada mudança de etapa. Foto sem URL (falha ao assinar) aparece como "indisponível".
- **Captura:** `<input type="file" accept="image/*,video/*" capture="environment">` abre a câmera traseira no celular. As coordenadas vêm de `navigator.geolocation` (opcionais: negadas ou sem sinal em 4 s, a foto segue sem elas). A hora é a do servidor.
- **App do Cliente:** na `/acompanhamento`, a seção "Fotos da Corrida" tem o botão "Registrar fotos" de `aceita` a `entregue`, a sugestão em destaque (com o aviso de avaria) em `no_local` e `entregue`, e a galeria das fotos dos dois lados, por etapa, com autor e hora. A galeria não é em tempo real: relê ao abrir, ao registrar e a cada mudança de etapa da Corrida (as fotos que o Guincheiro tira chegam na próxima mudança de etapa ou ao recarregar).
- **RLS:** cada lado lê e registra só na própria Corrida; outro Cliente ou outro Guincheiro não lê nem registra (tabela e bucket); a operação lê tudo. O autor vem da sessão e o papel, da Corrida.
- **Componentes:** `@guinchei/ui` tem `useFotosEstado`, `RegistrarFotoEstado` e `GaleriaFotosEstado`, sem dependência do Supabase (recebem a API); os dois apps usam os mesmos.
- **Limitações (fora de escopo do skeleton):** o app não impede fraude de GPS (coordenadas do navegador, que o aparelho pode forjar) nem de galeria (`capture` é só uma dica: alguns navegadores deixam escolher arquivo da galeria, e o servidor não confere EXIF); o banco não confere que o arquivo existe no bucket nem a duração do vídeo; sem notificação ao outro lado quando chega foto nova; o Painel de operação ainda mostra as fotos do protótipo (a leitura pela operação já é permitida pela RLS).
- **Testes:** pgTAP `fotos_estado.test.sql` (hora do servidor, autor, RLS da tabela e do bucket) e `fotos_estado_etapa.test.sql` (etapa por estado, limite de 6 por autor, Corrida sem fotos); Vitest de componente nos dois apps (aviso só sem fotos da etapa, vídeo > 30 s recusado, limite de 6, galeria, sugestão do Cliente); integração do `@guinchei/api` com Storage real (cada lado lê a imagem do outro por URL assinada, outro Cliente não lê, 7º item recusado e arquivo limpo, arquivo registrado não se apaga, encerrar sem fotos); roteiro de navegador em `e2e/fotos-de-estado/` (Playwright, Chromium, `setInputFiles` com um PNG).

## E2E

`e2e/skeleton.spec.ts` é o Definition of Done do skeleton ([PRD](produto/PRD.md), com a nota de revisão de 2026-10-17) como teste: o app do Cliente e o do Guincheiro em **dois navegadores ao mesmo tempo** (Playwright, Chromium, viewport de celular), contra os apps em build de produção (`vite preview`), o Supabase local e as Edge Functions. Limitações conhecidas do skeleton: [limitacoes-do-skeleton.md](produto/limitacoes-do-skeleton.md).

Cenários (um banco limpo antes e depois de cada um):

1. **Fluxo completo.** O Guincheiro (Marcos, 5561900000002) entra e fica em plantão; o Cliente (Rafael, 5561900000001) entra com o número de teste, abre o Pedido em três toques, origem pela localização do aparelho e destino pela busca, vê o Preço fechado (igual ao gravado pelo servidor) antes de pagar e paga com Pix (mock). Só o Marcos, o mais próximo dos três, recebe a oferta, que aparece na tela dele sozinha (Realtime). Ele aceita, toca "Saí para o local", "Cheguei", registra uma foto (o Cliente também registra a dele), "Carreguei" sem aviso e, em "Entreguei" sem foto de depois, confirma o aviso. O Cliente vê o status até "entregue" e a foto do Guincheiro na galeria, e nenhuma das duas páginas é recarregada.
2. **Sem Guincheiro, tentar de novo.** Com todos fora do plantão depois da cotação, o Pedido vai a `sem_guincheiro` e o Cliente vê as duas opções; com os Guincheiros de volta, "Tentar de novo" abre a rodada 2 e o Marcos recebe a oferta.
3. **Sem Guincheiro, estornar.** "Estornar o pagamento" mostra o estorno; o pagamento e o Pedido ficam `estornado`.

O preparo e a conferência do banco usam a `service_role` (`e2e/suporte/banco.ts`); o fluxo em si passa só pelas telas. Cada cenário apaga as Corridas antes de religar o plantão (a guarda `GDP01` recusa `disponivel = true` com Corrida aberta). Os cenários não dependem da ordem. Nada espera tempo fixo: tudo é `expect(...)` com prazo de 30 s, e o Match sem Guincheiro conclui na hora (não depende do timeout de 30 s da oferta).

**Como rodar.** Com o Supabase de pé e o banco recriado:

```bash
pnpm supabase start
pnpm supabase db reset
pnpm e2e                    # builda Cliente e Guincheiro com as chaves locais e roda o Playwright
pnpm e2e --grep estorna     # um cenário só; argumentos vão para o `playwright test`
E2E_SEM_BUILD=1 pnpm e2e    # repete sem rebuildar os apps
```

Os navegadores vêm de `pnpm --filter @guinchei/e2e exec playwright install chromium` (o CI faz isso). Quem já tem um Chromium compatível pode usar `PLAYWRIGHT_BROWSERS_PATH=<pasta>` ou `CHROMIUM_PATH=<executável>`. O Playwright fixa `1.56.1`; troque o Chromium junto com a versão.

**Depurar.** Com `CI=1` (como no job) a falha guarda o trace em `e2e/resultados/<teste>/trace.zip` e o relatório em `e2e/playwright-report`; abra com `pnpm --filter @guinchei/e2e exec playwright show-trace e2e/resultados/<teste>/trace.zip`. Sem `CI`, o trace fica desligado; para ver o navegador, rode `pnpm --filter @guinchei/e2e exec playwright test --headed` depois do build. No GitHub, baixe o artefato `playwright-report` do job.

**O que é simulado.**

- **Mapbox:** o build do e2e usa o token falso `VITE_MAPBOX_TOKEN=pk.e2e` e o contexto do Cliente responde toda chamada a `api.mapbox.com` com fixtures (`e2e/suporte/mapbox.ts`): estilo vazio, Geocoding v6 (busca e reverso), Directions v5 (21,3 km, 28 min) e a telemetria. O mapa do `mapbox-gl` sobe de verdade (WebGL pelo SwiftShader) e o trajeto é gravado pela tela, mas endereços e rota não vêm do Mapbox real; o que ele responde para o DF segue pendente (veja [Mapbox](#mapbox)). Chamada ao Mapbox sem fixture reprova o cenário.
- **Pagamento:** o `GatewayPagamento` mock das Edge Functions (autoriza sempre, estorna). Nada de PSP.
- **Login:** os números de teste do Auth, código 123456. O Auth aceita um envio de código por número a cada 5 s, então o login repete o pedido até o código ser pedido.
- **Service worker** do PWA bloqueado no teste, para não ficar entre a página e as fixtures.

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
