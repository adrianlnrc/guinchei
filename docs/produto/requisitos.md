# Requisitos e fluxo do produto

Escopo: MVP (Fase 1). Vocabulário conforme [CONTEXT.md](../../CONTEXT.md).

---

## As três superfícies

Todas entregues como PWA no MVP ([ADR-0005](../adr/0005-mvp-em-pwa.md)).

### 1. App do Cliente
Abertura do Pedido, Preço fechado, pagamento, rastreio no mapa, Fotos de estado visíveis, avaliação.

### 2. App do Guincheiro
Recebimento do chamado com aceite em ~30s, navegação até o local, checklist fotográfico obrigatório, confirmação de entrega, recebimento.

### 3. Painel de operação
Homologação de Frotas, monitor de Corridas em curso, resolução de Disputa, gestão da tabela de preços.

---

## Fluxo principal

```
1. Cliente abre o Pedido
   └─ tipo de veículo · situação · "as 4 rodas giram?" · origem · destino no mapa

2. Plataforma calcula o Preço fechado
   └─ taxa base + R$/km até o veículo + R$/km rebocado + multiplicador noturno/feriado

3. Cliente confirma e paga (pré-autorização via PSP)

4. Match: auto-atribuição ao Guincheiro disponível mais próximo
   ├─ aceita em ~30s  → segue
   ├─ recusa/timeout  → próximo Guincheiro
   └─ ninguém aceita após N tentativas → broadcast aos próximos

5. Guincheiro a caminho — Cliente acompanha no mapa com ETA

6. Guincheiro registra as Fotos de estado (antes de carregar)

7. Transporte até o destino

8. Guincheiro registra as Fotos de estado (depois de entregar)
   └─ obrigatório para encerrar a Corrida

9. Liquidação do pagamento via split; repasse ao Guincheiro já com a Comissão descontada

10. Cliente e Guincheiro se avaliam de 1 a 5
```

---

## Requisitos funcionais

| # | Requisito |
|---|---|
| RF01 | Cadastro e autenticação de Clientes |
| RF02 | Cadastro de Frotas e Guincheiros, com upload de documentos para homologação |
| RF03 | Abertura de Pedido em três toques: tipo de veículo, situação e condição das rodas |
| RF04 | Seleção de origem (geolocalização) e destino (mapa) |
| RF05 | Cálculo e exibição do Preço fechado **antes** da confirmação |
| RF06 | Pagamento integrado (cartão e Pix) com pré-autorização via PSP |
| RF07 | Match: atribuição automática ao Guincheiro disponível mais próximo, com repasse ao próximo em caso de recusa ou timeout |
| RF08 | Broadcast como fallback quando a auto-atribuição se esgota |
| RF09 | Rastreamento da Corrida em tempo real, com ETA, no app do Cliente |
| RF10 | Registro fotográfico obrigatório antes e depois do transporte, com data, hora e coordenadas |
| RF11 | Encerramento da Corrida condicionado às Fotos de estado completas |
| RF12 | Liquidação com split: repasse ao Guincheiro já descontada a Comissão |
| RF13 | Avaliação mútua de 1 a 5 ao fim da Corrida |
| RF14 | Cálculo e cobrança de taxa de cancelamento conforme as regras de negócio |
| RF15 | Painel de operação: homologação de Frota, monitor de Corridas, resolução de Disputa |
| RF16 | Gestão da tabela de preços pelo Painel de operação |
| RF17 | Bloqueio de Pedidos com origem ou destino fora do DF |
| RF18 | Histórico de Corridas para Cliente e Guincheiro |

## Requisitos não funcionais

| # | Requisito |
|---|---|
| RNF01 | Disponibilidade contínua, 24×7 |
| RNF02 | Tempo médio de atendimento inferior a 30 minutos (métrica-estrela) |
| RNF03 | Conformidade com a LGPD (Lei nº 13.709/2018) |
| RNF04 | Responsividade e operação em rede móvel instável |
| RNF05 | Instalável como PWA, sem passar por loja de aplicativos |
| RNF06 | Rastreabilidade e auditoria de toda Corrida, incluindo mídias com carimbo de hora e GPS |
| RNF07 | Nenhum valor transita em conta da plataforma — todo fluxo financeiro pelo PSP |
| RNF08 | Tempo de resposta do cálculo de preço abaixo de 2 segundos |

---

## Regras de negócio

| # | Regra |
|---|---|
| RN01 | Toda Corrida tem origem **e** destino dentro do DF |
| RN02 | O Preço fechado só muda se o destino mudar durante a Corrida |
| RN03 | Uma Frota só recebe Corridas após homologação manual completa e com apólice vigente |
| RN04 | A Corrida só encerra com as Fotos de estado (antes e depois) enviadas |
| RN05 | Cancelamento pelo Cliente após "a caminho": taxa de ~R$ 30 repassada ao Guincheiro |
| RN06 | Não comparecimento do Guincheiro: sem repasse, penalidade no score, re-Match sem nova cobrança ao Cliente |
| RN07 | Serviço impossível por erro de descrição do Cliente: cobra deslocamento. Por erro do Guincheiro: não cobra |
| RN08 | Casos ambíguos vão para Disputa, resolvida pelo Painel de operação com base nas Fotos de estado e no histórico |
| RN09 | Comissão da plataforma: 20% do Preço fechado |

---

## Stack técnica proposta

| Camada | Escolha |
|---|---|
| Front-end | PWA responsiva, instalável, com funcionamento em rede instável |
| Back-end | API REST + banco relacional (Pedidos, Corridas, Frotas, avaliações) |
| Geolocalização e rotas | Serviço de mapas para distância, ETA e rastreamento |
| Precificação | Motor de regras: taxa base + R$/km até o veículo + R$/km rebocado + multiplicador |
| Pagamentos | PSP com split — Pagar.me / Asaas / Iugu / Mercado Pago ([ADR-0004](../adr/0004-pagamentos-via-psp-com-split.md)) |
| Notificações | Web Push para chamados e mudanças de status |
| Mídia | Armazenamento de Fotos de estado com carimbo de data, hora e coordenadas |

> ⚠️ **Risco técnico conhecido:** no iOS, o PWA tem push limitado e GPS em segundo plano fraco. Isso afeta principalmente o **app do Guincheiro**, que precisa receber chamado com a tela bloqueada. Fallback: atualização de status por etapa em vez de rastreamento contínuo. Se comprometer o tempo de aceite, antecipar um invólucro nativo só para essa superfície. Ver [ADR-0005](../adr/0005-mvp-em-pwa.md).

---

## Fora do escopo do MVP

- Assistência leve: bateria, troca de pneu, pane seca, chaveiro → Fase 2
- Guincheiros autônomos (pessoa física) → Fase 2
- App nativo → Fase 2
- Corridas intermunicipais / interestaduais → depende de enquadramento ANTT, ver [ADR-0001](../adr/0001-praca-inicial-somente-df.md)
- Contratos B2B2C com seguradoras → Fase 3
