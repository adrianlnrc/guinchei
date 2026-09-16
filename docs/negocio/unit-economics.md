# Unit economics e modelo financeiro

> ⚠️ **Valores direcionais.** Baseados em [pesquisa de preços do DF](../pesquisa/precos-guincho-df.md) (fontes secundárias) e em premissas ainda não validadas empiricamente. Nenhuma entrevista, protótipo ou piloto foi realizado.

---

## Por Corrida

| Linha | Valor | Origem |
|---|---:|---|
| Ticket médio (Preço fechado ao Cliente) | R$ 300,00 | ~12% abaixo da média ponderada do mercado do DF |
| Comissão da plataforma (20%) | + R$ 60,00 | [ADR-0003](../adr/0003-preco-fechado-definido-pela-plataforma.md) |
| Processamento de pagamento (~3% do ticket) | − R$ 9,00 | [ADR-0004](../adr/0004-pagamentos-via-psp-com-split.md) |
| **Líquido por Corrida (antes de opex)** | **R$ 51,00** | |
| Subsídio de disponibilidade (meses 1–6) | − R$ 25,00 | [ADR-0006](../adr/0006-oferta-via-frotas-ancora.md) |
| **Margem de contribuição — fase inicial** | **~R$ 26,00** | |
| **Margem de contribuição — maturidade** (sem subsídio) | **~R$ 48,00** | |

**Repasse ao Guincheiro:** R$ 240,00 por Corrida (80% do ticket), mais o rateio do Ganho mínimo garantido durante os 90 dias iniciais.

---

## Ponto de equilíbrio

O produto é desenvolvido pelos próprios fundadores — seis estudantes de Engenharia de Software. Isso muda a estrutura de custo fixo de forma decisiva.

### Cenário A — fase acadêmica, sem pró-labore

Custos fixos mensais: **R$ 5.500** (infraestrutura e mapas, contabilidade, seguro de RC, verba base de aquisição).

| Margem/Corrida | Corridas/mês para equilíbrio |
|---|---:|
| R$ 26 (inicial, com subsídio) | **~212** |
| R$ 48 (maturidade) | **~115** |

A meta de 90 dias (300–500 Corridas/mês) **supera** o equilíbrio nos dois casos. O modelo se sustenta desde a fase inicial enquanto a equipe não é remunerada.

### Cenário B — com equipe remunerada

Assumindo duas contratações dedicadas (operação e growth) e pró-labore mínimo, os fixos sobem para **~R$ 18.000/mês**:

| Margem/Corrida | Corridas/mês para equilíbrio |
|---|---:|
| R$ 48 (maturidade) | **~375** |

Patamar compatível com a meta do primeiro trimestre de operação.

No mês 12, com ~1.500 Corridas/mês e margem madura de R$ 48, a margem de contribuição chega a **~R$ 72.000/mês** — cobre os fixos em qualquer dos dois cenários e permite reinvestir na expansão.

---

## Projeção de volume

| Marco | Corridas/mês | Frotas ativas | GMV/mês | Receita de intermediação/mês |
|---|---:|---:|---:|---:|
| Fim do MVP (mês 3) | 300–500 | ≥ 5 | ~R$ 120 mil | ~R$ 24 mil |
| Mês 12 | ~1.500 | 10–15 | ~R$ 450 mil | ~R$ 90 mil |

---

## Investimento

### Cenário 1 — MVP, 6 meses: ~R$ 65 mil

O desenvolvimento é feito pelos seis fundadores. Isso elimina o maior item de custo de um MVP de software e reduz o investimento a operação, conformidade e aquisição.

| Item | Valor |
|---|---:|
| Desenvolvimento do PWA (três superfícies) | **R$ 0** — bootstrap pelos fundadores |
| Infraestrutura, mapas, hospedagem e ferramentas (6 meses) | R$ 7.000 |
| Constituição da empresa e contabilidade (6 meses) | R$ 5.000 |
| Jurídico: contrato de parceria, termos de uso, política de privacidade | R$ 6.000 |
| Seguro de responsabilidade civil da operação (6 meses) | R$ 9.000 |
| Subsídio às Frotas âncora (3 frotas, 90 dias) | R$ 18.000 |
| Marketing de aquisição — teste de canal (6 meses) | R$ 12.000 |
| Reserva de contingência | R$ 8.000 |
| **Total** | **R$ 65.000** |

O desenvolvimento representa **custo de oportunidade, não caixa**.

### Cenário 2 — expansão pós-validação, 12 meses: R$ 300–450 mil

Acionado **somente** após o MVP demonstrar margem de contribuição positiva e taxa de match acima de 90%. Acrescenta duas contratações dedicadas (operação e growth), ampliação do subsídio para 8–10 Frotas, orçamento de aquisição escalado e reserva para a segunda praça.

### Fontes de financiamento consideradas
- Bootstrapping (recursos e trabalho dos fundadores) nas fases de descoberta, prototipação e desenvolvimento
- Programas de incubação e aceleração universitária (UCB e ecossistema do DF)
- Editais de fomento à inovação: FAP-DF, FINEP, Sebrae
- Investimento anjo e rodada pré-seed, após validação do MVP com dados reais

---

## Estrutura de custos

**Variáveis (por Corrida)**
- Processamento de pagamento pelo PSP: ~3% do ticket
- Subsídio de disponibilidade (meses 1–6): ~R$ 25
- CAC (majoritariamente mídia de busca)
- Custo de suporte e resolução de Disputa

**Fixos (mensais)**
- Equipe: produto e engenharia, operação e praça, growth
- Infraestrutura, serviço de mapas e ferramentas
- Seguro de RC da própria operação
- Serviços jurídicos e contábeis

---

## KPIs

**Métrica-estrela:** percentual de Pedidos atendidos em menos de 30 minutos.

| Indicador | Meta |
|---|---|
| Taxa de match (Pedidos atendidos / Pedidos abertos) | > 90% |
| Nota média do atendimento | ≥ 4,6 / 5 |
| CAC por Corrida | a definir com dados reais |
| Margem de contribuição por Corrida | ≥ R$ 26 (inicial) → R$ 48 (maturidade) |
| Recompra em 6 meses | a definir — reboque é serviço de baixa frequência |
| Utilização da oferta (Corridas por guincho ativo/dia) | a definir |
| Taxa de cancelamento | monitorar |
| Taxa de Disputa por avaria | monitorar |

**Nota sobre retenção:** reboque tem frequência baixa por Cliente. A retenção é medida por recompra em janela de 6 a 12 meses e complementada por indicação — não por frequência mensal.

---

## Gatilhos de contingência

- Se ao fim de 90 dias a **taxa de match** ficar abaixo de 85% **ou** o tempo médio de chegada superar 40 min → reduzir a área de cobertura às regiões de maior densidade antes de ampliar investimento em demanda.
- Se a validação de disposição a pagar indicar que o Preço fechado não é competitivo → revisar a tabela e, se necessário, testar comissão sobre preço cotado pelo Guincheiro (revisita o [ADR-0003](../adr/0003-preco-fechado-definido-pela-plataforma.md)).
- Se a captação de Frotas âncora não se concretizar → iniciar com escopo geográfico ainda menor e uma única Frota, priorizando aprendizado sobre volume.
