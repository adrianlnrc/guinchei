# Custos e receitas do MVP

> ⚠️ **Valores direcionais.** Nada foi validado empiricamente (sem entrevistas, protótipo ou piloto). Os números vêm de [unit-economics.md](unit-economics.md), dos ADRs 0001, 0004, 0006, 0007, 0008 e da [pesquisa regulatória](../pesquisa/regulatorio-plataforma-guincho.md). Itens marcados com ⚠️ são **estimativas** que não constam nesses documentos e precisam de cotação real.

**Resumo:** investimento de **R$ 65 mil em 6 meses** (≈ R$ 10,8 mil/mês), com desenvolvimento feito pelos fundadores. Receita principal: **comissão de 20%** por Corrida (R$ 60 sobre ticket de R$ 300). Equilíbrio operacional entre **115 e 212 Corridas/mês** no cenário sem pró-labore.

---

## 1. Investimento do MVP (6 meses)

| Item | Valor | % |
|---|---:|---:|
| Desenvolvimento do PWA (3 superfícies) | R$ 0 | 0% |
| Infraestrutura, mapas, hospedagem e ferramentas | R$ 7.000 | 11% |
| Constituição da empresa e contabilidade | R$ 5.000 | 8% |
| Jurídico (contrato de parceria, termos de uso, privacidade) | R$ 6.000 | 9% |
| Seguro de RC da operação | R$ 9.000 | 14% |
| Subsídio às 3 Frotas âncora (90 dias) | R$ 18.000 | 28% |
| Marketing de aquisição (teste de canal) | R$ 12.000 | 18% |
| Reserva de contingência | R$ 8.000 | 12% |
| **Total** | **R$ 65.000** | **100%** |

O desenvolvimento é feito pelos seis fundadores: é **custo de oportunidade, não caixa**.

Agrupando: **conformidade** (constituição + jurídico + seguro) = R$ 20.000 (31%); **operação e oferta** (infra + subsídio) = R$ 25.000 (38%); **aquisição** = R$ 12.000 (18%); **contingência** = R$ 8.000 (12%).

---

## 2. Stack técnica e custo de ferramentas

Definida no [ADR-0008](../adr/0008-stack-tecnica-do-skeleton.md). Preços ⚠️ estimados (dólar ≈ R$ 5,50).

| Camada | Tecnologia | Custo mensal ⚠️ |
|---|---|---:|
| Front-end (3 PWAs) | TypeScript, React, Vite, vite-plugin-pwa, TanStack Query | R$ 0 |
| Hospedagem | Vercel | R$ 0 (Hobby) a ~R$ 110 (Pro) |
| Back-end | Supabase: Postgres + PostGIS, Auth, Storage, Realtime, Edge Functions | R$ 0 (Free) a ~R$ 140 (Pro) |
| Mapas, geocoding e rotas | Mapbox | R$ 0 na cota gratuita; paga por uso acima |
| Login por telefone ([ADR-0010](../adr/0010-login-por-telefone-e-cadastro-em-duas-etapas.md)) | WhatsApp/SMS | ~R$ 0,30 por código |
| Testes | Vitest, Playwright | R$ 0 |
| Repositório e CI | GitHub | R$ 0 |
| Domínio | .com.br (Registro.br) | ~R$ 40 por ano |
| Pagamento | PSP com split (Pagar.me, Asaas, Iugu ou Mercado Pago) | sem mensalidade; ~3% por Corrida |

Total de ferramentas: **R$ 250–500/mês** (≈ R$ 1,5–3 mil em 6 meses; ver `Guinchei-Custos-MVP.xlsx`). A verba de R$ 7.000 cobre isso com folga para uso de mapas e mensagens.

---

## 3. Adequação a normas (custos iniciais)

| Exigência | Base | Custo |
|---|---|---|
| Constituir empresa (CNPJ, Junta, alvará via Rede Sim-DF) | Pesquisa regulatória | Dentro dos R$ 5.000 de constituição e contabilidade |
| Contabilidade mensal | Rotina fiscal | ⚠️ R$ 400–800/mês |
| Contratos, termos de uso, política de privacidade (LGPD) | CDC, LGPD | R$ 6.000 |
| Seguro de RC da operação | [ADR-0007](../adr/0007-travas-de-conformidade-do-mvp.md) | R$ 9.000 (≈ R$ 1.500/mês) |
| Apólice de avaria, com o Guinchei como cossegurado | ADR-0007, CDC arts. 7º, 14 e 25 | **Paga por cada Frota**, não pela plataforma |
| Verificação manual da Frota (CNPJ, DETRAN, CNH, apólice) | ADR-0007, Invariante 3 | Sem desembolso; custa horas da operação |
| Pagamentos via PSP, sem custódia | [ADR-0004](../adr/0004-pagamentos-via-psp-com-split.md), Res. BCB 80/2021 | Evita autorização do BC (capital mínimo R$ 2 mi) |
| Corridas só dentro do DF | [ADR-0001](../adr/0001-praca-inicial-somente-df.md) | Evita regime ANTT/RNTRC/CT-e |
| Registro da marca no INPI | Não consta no repositório | ⚠️ ~R$ 400–700 |

**Pendências a validar com advogado:** norma distrital de credenciamento de guincho; posição da SEFAZ-DF sobre CT-e/ICMS-transporte; estrutura da apólice cossegurada.

---

## 4. Custo médio

### Por mês

| Cenário | Custo |
|---|---:|
| MVP: R$ 65.000 ÷ 6 meses | ≈ **R$ 10.800/mês** |
| A: fixos sem pró-labore (infra, contabilidade, seguro, aquisição base) | **R$ 5.500/mês** |
| B: com duas contratações (operação e growth) | **≈ R$ 18.000/mês** |
| Expansão pós-validação (12 meses) | **R$ 300–450 mil** |

### Por Corrida (ticket médio R$ 300)

| Componente | Valor |
|---|---:|
| Repasse ao Guincheiro (80%) | R$ 240 (passa pela plataforma, não é custo) |
| Processamento de pagamento (~3%) | R$ 9 |
| Subsídio de disponibilidade (meses 1–6) | ~R$ 25 |
| CAC por Corrida | a definir com dados reais |
| Suporte e Disputa | não quantificado |

O subsídio das Frotas âncora equivale a ~R$ 2.000 por Frota por mês (R$ 18.000 ÷ 3 Frotas ÷ 3 meses) e é custo fixo antes da receita.

---

## 5. Fontes de receita

| Fonte | Fase | Detalhe |
|---|---|---|
| **Comissão de 20% por Corrida** | MVP | R$ 60 por Corrida de R$ 300; sem custo de entrada para o Guincheiro |
| Assistência completa (bateria, pneu, pane seca, chaveiro) | Fase 2 | Mesma comissão, mais categorias de serviço |
| **Contratos B2B2C** com seguradoras e assistências 24h | Fase 3 | Receita recorrente |
| Novas praças (Goiânia e entorno) | Fase 3 | Mesmo modelo, mais volume |

**Não são receita** (fontes de capital): bootstrapping dos fundadores, incubação universitária (UCB), editais (FAP-DF, FINEP, Sebrae), investimento anjo / pré-seed.

### Margem por Corrida

| Linha | Valor |
|---|---:|
| Comissão (20%) | R$ 60 |
| Processamento (~3%) | − R$ 9 |
| **Líquido antes de opex** | **R$ 51** |
| Subsídio (meses 1–6) | − R$ 25 |
| **Contribuição inicial** | **≈ R$ 26** |
| **Contribuição na maturidade** | **≈ R$ 48** |

### Projeção

| Marco | Corridas/mês | GMV/mês | Receita de intermediação/mês |
|---|---:|---:|---:|
| Fim do MVP (mês 3) | 300–500 | ≈ R$ 120 mil | ≈ R$ 24 mil |
| Mês 12 | ≈ 1.500 | ≈ R$ 450 mil | ≈ R$ 90 mil (contribuição ≈ R$ 72 mil) |

### Ponto de equilíbrio

| Cenário | Margem/Corrida | Corridas/mês |
|---|---:|---:|
| A (R$ 5.500 de fixos) | R$ 26 | ≈ 212 |
| A (R$ 5.500 de fixos) | R$ 48 | ≈ 115 |
| B (R$ 18.000 de fixos) | R$ 48 | ≈ 375 |

---

## 6. Riscos

- **Hipóteses não validadas:** disposição a pagar R$ 300; aceitação dos 20% pelas Frotas; chegada em menos de 30 minutos.
- **Gatilho de contingência:** aos 90 dias, taxa de match abaixo de 85% ou chegada média acima de 40 min reduz a área de cobertura.
- **Responsabilidade solidária por avaria** (CDC): mitigada por seguro, verificação das Frotas e Fotos de estado.
- **Baixa recorrência:** reboque é serviço de baixa frequência; a retenção se mede em recompra de 6 a 12 meses.
