# ADR-0002: Match por auto-atribuição ao Guincheiro mais próximo

- Status: aceito
- Data: 2026-09-03
- Decisores: (a definir)

## Contexto

O valor central do produto é tempo de chegada previsível ("guincho em menos de 30 min"). O modelo de Match define isso. Broadcast a todos os Guincheiros gera corrida-do-ouro e cherry-picking (só pegam a Corrida boa). Leilão de preço é lento e desloca o foco para preço, não para velocidade.

## Decisão

A plataforma atribui o Pedido ao Guincheiro disponível mais próximo. Ele aceita ou recusa em ~30s; recusa ou timeout passa para o próximo. Se ninguém aceitar após N tentativas, o Pedido vai a broadcast para os Guincheiros próximos como fallback.

## Alternativas consideradas

- **Broadcast puro:** primeiro a aceitar leva. Simples, mas incentiva cherry-picking e deixa Corridas ruins sem atendimento.
- **Leilão:** Guincheiros cotam, Cliente escolhe. Lento e contra o posicionamento de Preço fechado (ADR-0003).

## Consequências

- (+) ETA previsível e experiência tipo Uber.
- (+) Distribui Corridas boas e ruins de forma mais uniforme.
- (−) Exige geolocalização e sinal de disponibilidade confiáveis.
- (−) GPS em segundo plano no PWA iOS é fraco (ver ADR-0005) — mitigar com atualização por etapa como fallback.
