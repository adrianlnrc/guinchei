# ADR-0005: MVP em PWA para as três superfícies

- Status: aceito
- Data: 2026-09-03
- Decisores: (a definir)

## Contexto

O MVP precisa provar o modelo rápido. São três superfícies: app do Cliente, app do Guincheiro e Painel de operação. Um app nativo por plataforma multiplica o tempo de build e o ciclo de release.

## Decisão

Entregar as três superfícies como PWA. Migração para app nativo prevista para a Fase 2.

## Alternativas consideradas

- **Nativo iOS + Android desde o MVP:** melhor acesso a push e GPS, mas dobra o esforço e adiciona o ciclo das lojas.
- **Híbrido (Flutter / React Native):** meio-termo; ainda assim mais lento que PWA para o primeiro corte.

## Consequências

- (+) Um código, deploy imediato, sem submissão a loja.
- (+) Atualização instantânea durante a fase de aprendizado.
- (−) Push e GPS em segundo plano fracos no iOS — crítico para o app do Guincheiro, que precisa receber chamado com a tela bloqueada. Risco conhecido do MVP; fallback é atualização por etapa (aceito → saiu → chegou).
- (−) Sensação "menos app" para o Cliente; aceitável no MVP.
