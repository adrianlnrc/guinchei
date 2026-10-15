# PRD — Walking Skeleton do Guinchei

Vocabulário conforme [CONTEXT.md](../../CONTEXT.md). Requisitos completos do MVP em [requisitos.md](requisitos.md). Decisões estruturais em [docs/adr/](../adr/).

Este PRD **não substitui** `requisitos.md` — ele recorta, dentro do MVP já especificado, o menor fluxo ponta-a-ponta que vale a pena construir primeiro (o "walking skeleton"), com critérios de aceite e sequenciamento. Escolhas de stack técnica (framework, banco, provedor de mapas, PSP específico) ficam fora deste documento e devem virar um ADR técnico à parte.

## Problema

O time tem um MVP de 3 superfícies e 18 requisitos funcionais totalmente especificado (`requisitos.md`), mas nenhuma linha de código. Construir as 3 superfícies completas de uma vez adia demais o primeiro momento em que o fluxo central do produto — Cliente pede, vê Preço fechado, é atendido por um Guincheiro, registra Fotos de estado — pode ser demonstrado e testado.

## Objetivos

- Ter, o quanto antes, um fluxo de Pedido → Corrida funcionando de ponta a ponta, mesmo que com dados sintéticos e sem integrações financeiras reais.
- Provar cedo os pontos de maior risco técnico: cálculo de Preço fechado, Match por proximidade real e captura de Fotos de estado.
- Servir de base sobre a qual os incrementos seguintes (RF02, RF08, RF09, RF12–RF18) são construídos, em vez de refeitos.

## Não-objetivos

- Não é um piloto com Frota parceira real nem com usuários reais.
- Não busca atingir as métricas de negócio do MVP (chegada em <30 min, 300–1.500 Corridas/mês) — essas seguem sendo a meta do MVP completo, não do skeleton.
- Não decide stack técnica específica (linguagem, framework, banco, provedor de mapas, PSP). Ver "Questões em aberto".
- Não cobre conformidade regulatória (LGPD, apólice de avaria, credenciamento de guincho no DF) — ver `CONTEXT.md § Questões em aberto`.

## Histórias de usuário

- Como **Cliente**, quero abrir um Pedido informando tipo de veículo, situação e origem/destino num mapa, para saber quanto vou pagar antes de confirmar.
- Como **Cliente**, quero ver o Preço fechado antes de confirmar, para não ser surpreendido por negociação na rua.
- Como **Guincheiro**, quero receber automaticamente o Pedido mais próximo de mim (entre os Guincheiros de teste disponíveis), para simular o Match real do produto.
- Como **Guincheiro**, quero registrar Fotos de estado do veículo antes de carregar e depois de entregar, para que a Corrida só possa ser encerrada com esse registro.
- Como **Cliente**, quero acompanhar a Corrida por status (ex.: "a caminho" → "carregado" → "entregue"), mesmo sem um mapa em tempo real nesta primeira versão.

## Especificação funcional do skeleton

Recorte dentro dos requisitos de `requisitos.md`:

| RF | Descrição | Recorte no skeleton |
|---|---|---|
| RF01 | Cadastro e autenticação de Clientes | Versão simplificada, suficiente para identificar um Cliente de teste |
| RF03 | Abertura de Pedido em três toques | Completo: tipo de veículo, situação, condição das rodas |
| RF04 | Seleção de origem/destino | **Mapa real** (Google Maps/Mapbox — provedor definido em ADR técnico), não input de texto |
| RF05 | Cálculo e exibição do Preço fechado antes da confirmação | Completo, com a fórmula de `requisitos.md` (taxa base + R$/km) |
| RF06 | Pagamento integrado | **Mockado/sandbox** — sem PSP real, sem split real (isso é RF12) |
| RF07 | Match automático ao Guincheiro mais próximo | Completo em lógica: 2–3 Guincheiros de teste com **coordenadas fixas/seed** (não GPS ao vivo), cálculo real de distância decide o mais próximo |
| RF10 | Registro fotográfico obrigatório (antes/depois) | Completo |
| RF11 | Encerramento da Corrida condicionado às Fotos de estado | Completo |

Como o Cliente acompanha a Corrida no skeleton (substituto do RF09 nesta fase): atualização de **status por etapa** (Pedido aberto → Guincheiro a caminho → no local → veículo carregado → entregue; ver ADR-0008), sem mapa em tempo real nem GPS ao vivo do Guincheiro.

## Critérios de aceite (Definition of Done)

O skeleton está pronto quando, em ambiente de desenvolvimento/staging, com dados sintéticos:

1. Um Cliente de teste abre um Pedido, seleciona origem/destino num mapa real, e vê o Preço fechado calculado antes de confirmar.
2. Ao confirmar, o pagamento é processado em modo mock/sandbox (sem mover dinheiro real).
3. O Pedido é atribuído automaticamente ao mais próximo entre 2–3 Guincheiros de teste com coordenadas fixas, com base em cálculo real de distância.
4. O Guincheiro de teste registra uma Foto de estado antes de carregar e outra depois de entregar; a Corrida não pode ser encerrada sem as duas.
5. O Cliente vê o status da Corrida avançar por etapas até "entregue".
6. Todo o fluxo roda sem erro, validado pelo próprio time — não depende de teste com usuários reais nem de Frota parceira.

## Métricas de sucesso

Não se aplicam ao skeleton em si (ver Não-objetivos). Seguem sendo a meta do MVP completo, herdadas de `CONTEXT.md`:

- **Métrica-estrela:** percentual de Pedidos atendidos em menos de 30 minutos.
- Secundárias: nota média ≥ 4,6 · CAC por Corrida · margem de contribuição por Corrida · recompra em 6 meses.

## Fora de escopo (fica para incrementos depois do skeleton)

- **RF02** — Homologação self-service de Frotas e Guincheiros (as 3–5 Frotas âncora do MVP são cadastradas manualmente pela operação).
- **RF08** — Broadcast como fallback quando a auto-atribuição se esgota.
- **RF09** — Rastreamento em tempo real no mapa do Cliente, com GPS ao vivo do Guincheiro (ver tensão registrada em "Questões em aberto").
- **RF12** — Liquidação com split real via PSP.
- **RF13** — Avaliação mútua Cliente/Guincheiro.
- **RF14** — Cálculo e cobrança de taxa de cancelamento.
- **RF15–RF16** — Painel de operação (homologação de Frota, monitor de Corridas, Disputa, gestão de tabela de preços).
- **RF17** — Bloqueio de Pedidos fora do DF.
- **RF18** — Histórico de Corridas.
- Todos os requisitos não funcionais (RNF01–RNF08: 24×7, LGPD, responsividade offline, PWA instalável, auditoria, tempo de resposta) — o skeleton é um protótipo funcional, não um build de produção.

## Questões em aberto

- **Tensão RF09 (não resolvida, registrada para revisão):** durante a definição deste PRD, foi levantado que o rastreamento em tempo real é percebido como parte central da proposta de valor ("previsibilidade estilo Uber"), mas ficou fora do skeleton pelo risco técnico documentado de GPS em segundo plano fraco no iOS/PWA (ver `requisitos.md § Stack técnica proposta`). Antes de comunicar prazos a investidores ou parceiros, revisitar se RF09 deveria ser antecipado para logo após o skeleton, e se isso exige o invólucro nativo para o app do Guincheiro já cogitado em `requisitos.md`.
- Provedor de mapas específico (Google Maps vs. Mapbox vs. outro) — decisão técnica, vai para ADR.
- PSP específico entre as 4 opções listadas em ADR-0004 — decisão técnica, vai para ADR, mesmo com RF06/RF12 mockados no skeleton.
- Demais questões regulatórias e de dados já registradas em `CONTEXT.md § Questões em aberto` não são bloqueantes para o skeleton, mas seguem abertas para o MVP completo.

## Sequência de entrega

Sem responsáveis nem datas atribuídos neste documento (ver decisão registrada na sessão de grilling que originou este PRD).

1. **Walking skeleton** (este documento) — RF01, RF03–RF07, RF10–RF11.
2. **Incremento 1** — RF09 (rastreamento em tempo real) e RF08 (broadcast fallback), já que ambos aprofundam o Match/acompanhamento do skeleton.
3. **Incremento 2** — RF12 (split real), RF13 (avaliação), RF14 (cancelamento).
4. **Incremento 3** — RF02 (homologação self-service), RF15–RF18 (Painel de operação completo, histórico, bloqueio geográfico).
5. **Endurecimento** — RNF01–RNF08 (produção: 24×7, LGPD, PWA instalável, auditoria etc.), aplicados sobre o que já existe.
