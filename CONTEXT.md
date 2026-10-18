# CONTEXT — Guinchei

Contexto único (single-context). Não há `CONTEXT-MAP.md`.
Decisões estruturais ficam em `docs/adr/`. Regras de consumo destes docs: `docs/agents/domain.md`.

**Documentação relacionada:**
[requisitos e fluxo](docs/produto/requisitos.md) ·
[PRD do walking skeleton](docs/produto/PRD.md) ·
[unit economics](docs/negocio/unit-economics.md) ·
[persona e segmentos](docs/negocio/persona-e-segmentos.md) ·
[go-to-market](docs/negocio/go-to-market.md) ·
[identidade visual](docs/marca/identidade-visual.md) ·
[pesquisa de preços do DF](docs/pesquisa/precos-guincho-df.md) ·
[pesquisa regulatória](docs/pesquisa/regulatorio-plataforma-guincho.md) ·
[índice geral](README.md)

## Propósito

Guinchei intermedeia motoristas com veículo quebrado e empresas de guincho, sob demanda (modelo estilo Uber). O Cliente pede pelo app, vê o **Preço fechado antes de confirmar**, acompanha o guincho no mapa e paga pelo app.

- **Praça inicial:** Distrito Federal (ver ADR-0001).
- **Público inicial:** motoristas sem seguro auto / sem assistência 24h (B2C).
- **Escopo do MVP:** apenas reboque — não inclui assistência leve (bateria, pneu, pane seca, chaveiro).
- **Oferta inicial:** 3–5 empresas de guincho parceiras ("Frotas âncora").
- **Superfícies:** app do Cliente, app do Guincheiro, Painel de operação — todas em PWA no MVP (ver ADR-0005).

## Linguagem ubíqua

Use estes termos exatamente. Sinônimos a evitar estão anotados.

| Termo | Definição |
|---|---|
| **Cliente** | Pessoa com veículo parado que abre um Pedido. Evite "usuário", "passageiro". |
| **Guincheiro** | Operador que executa a Corrida. Pertence a uma Frota. Evite "motorista" (ambíguo com o Cliente). |
| **Frota** | Prestador de guincho cadastrado e verificado: empresa (CNPJ) ou autônomo (CPF/MEI, Frota de uma pessoa só). Ver ADR-0012. |
| **Representante** | Pessoa que cadastra e responde por uma Frota (nome, CPF e telefone no cadastro). Na empresa pode não dirigir; no autônomo é a própria pessoa, também Guincheiro da Frota de uma pessoa só. Papel `representante`, distinto de `guincheiro` (ver ADR-0012). |
| **Frota âncora** | Frota do lançamento, com Ganho mínimo garantido por plantão nos primeiros 90 dias. |
| **Pedido** | Solicitação de reboque criada pelo Cliente: tipo de veículo, situação, "as 4 rodas giram?", origem, destino. É o "chamado" antes do aceite. |
| **Corrida** | Um Pedido aceito e em execução por um Guincheiro, do aceite à entrega. Estados: aceita → a_caminho → no_local → carregado → entregue (ver ADR-0008). Evite "viagem". |
| **Match** | Processo que atribui um Pedido a um Guincheiro (ver ADR-0002). |
| **Preço fechado** | Valor total calculado pela plataforma e mostrado ao Cliente antes da confirmação. Não é orçamento; só muda se o destino mudar durante a Corrida (ver ADR-0003). |
| **Comissão** | Percentual do Preço fechado retido pela plataforma. MVP: 20%. |
| **Take efetivo** | Comissão menos os subsídios pagos naquela Corrida. |
| **Painel de operação** | Superfície interna: verificação de Frota, monitor de Corridas, resolução de Disputa. Evite "admin", "backoffice". |
| **Disputa** | Contestação de avaria, cobrança ou não comparecimento, resolvida caso a caso pela operação com as provas existentes (Fotos de estado de qualquer lado, horários, histórico). |
| **Fotos de estado** | Fotos e vídeos do veículo registrados pelo Cliente ou pelo Guincheiro durante a Corrida, com hora do servidor, GPS e autor. Opcionais, mas recomendados (ver ADR-0011). |
| **Ganho mínimo garantido** | Valor pago pela plataforma a uma Frota âncora por plantão disponível, independentemente do volume de Corridas, nos primeiros 90 dias. |
| **PSP** | Provedor de pagamento com split (Pagar.me / Asaas / Iugu / Mercado Pago). Recebe do Cliente e repassa ao Guincheiro já descontada a Comissão. A plataforma não retém valores em conta própria (ver ADR-0004). |

## Regras e invariantes

1. Toda Corrida tem origem **e** destino dentro do Distrito Federal (MVP).
2. O Cliente vê o Preço fechado antes de confirmar o Pedido; o valor só muda se o destino mudar durante a Corrida.
3. Uma Frota só fica ativa após verificação manual da operação: CNPJ ativo, contrato assinado, registro do veículo como reboque no DETRAN, CNH do Guincheiro, apólice de responsabilidade civil por avaria em transporte com a plataforma como cossegurada.
4. Nenhum valor transita em conta da plataforma — todo dinheiro passa pelo PSP com split.
5. Fotos de estado são opcionais e podem ser registradas pelo Cliente e pelo Guincheiro; os dois apps avisam que registrar protege numa reclamação de avaria (ADR-0011).
6. Cliente e Guincheiro se avaliam de 1 a 5 ao fim da Corrida.
7. Cancelamento pelo Cliente antes de o Guincheiro sair ("Saí para o local"): sem custo. Após "a caminho": taxa (~R$ 30) repassada ao Guincheiro. Não comparecimento do Guincheiro: sem repasse, penalidade no score, re-Match sem nova cobrança ao Cliente. Serviço impossível por erro de descrição do Cliente: cobra deslocamento; por erro do Guincheiro: não cobra. Casos ambíguos vão para a Disputa.

## Modelo de receita

- Comissão de 20% por Corrida, sem custo de entrada para o Guincheiro.
- Preço ao Cliente 10–15% abaixo do mercado no início, para ganhar espaço.
- Fase 2: contratos B2B2C com seguradoras e assistências 24h (receita recorrente).

## Unit economics (direcional)

Corrida média R$ 300 → Comissão R$ 60 → processamento −R$ 9 → **R$ 51 líquido/Corrida** antes de opex.
Subsídio meses 1–6 ~R$ 25/Corrida → contribuição ~R$ 26/Corrida no início, ~R$ 48 na maturidade.

## Métrica-estrela

**Percentual de Pedidos atendidos em menos de 30 minutos.**
Secundárias: nota média ≥ 4,6 · CAC por Corrida · margem de contribuição por Corrida · recompra em 6 meses.

## Roadmap

- **Fase 1 (MVP):** reboque · DF · B2C · PWA · Frotas parceiras.
- **Fase 2:** assistência completa · app nativo. (Autônomos verificados foram antecipados para o lançamento, ADR-0012.)
- **Fase 3:** contratos com seguradoras · novas praças (Goiânia, entorno).

## Contexto acadêmico

Este projeto também é o trabalho da disciplina de **Startups** — Universidade Católica de Brasília, Engenharia de Software, turno matutino, quinta-feira. Professor: Luan da Silva Borges.

Seis fundadores: Adrian de Alencar Stelo (produto e arquitetura), Carlos Eduardo Ribeiro de Lima (back-end e integrações), Arthur Escorcio (front-end — app do cliente), Arthur Murillo (front-end — app do prestador e painel de operação), Gabriel Porto (operação e praça), Arthur Andre (growth e aquisição).

Entregáveis acadêmicos e de investidor estão listados no [README](README.md).

## Estado da validação

⚠️ **Nada foi validado empiricamente.** Toda a base é pesquisa documental. Não houve entrevistas com clientes, protótipo testado nem operação piloto.

Hipóteses centrais ainda não validadas:
1. Disposição a pagar o Preço fechado de ~R$ 300
2. Aceitação da Comissão de 20% pelas empresas de guincho do DF
3. Viabilidade do tempo de chegada inferior a 30 minutos com a densidade de oferta planejada

## Questões em aberto

- Categoria de CNH por faixa de PBT: adotado B até 3.500 kg e C acima (CTB art. 143, ADR-0012); confirmar resoluções CONTRAN específicas de guincho.
- Norma distrital específica de credenciamento de guincho particular no DF, além do alvará geral.
- Estrutura contratual da apólice de avaria com a plataforma como cossegurada/beneficiária.
- Modelo de dados e SLA dos contratos com Frotas âncora.
- Preço fechado × Match: o Cliente paga a cotação com o Guincheiro mais próximo; quem aceita recebe pela própria distância e a plataforma absorve a diferença até o teto da Comissão (ADR-0009, provisório); medir no piloto.
- Escolha do PSP (ADR-0004 lista as opções; o skeleton usa adaptador mock).
- Posição da SEFAZ-DF sobre CT-e/ICMS-transporte caso a praça se estenda ao entorno goiano.
