# Pesquisa: requisitos legais e regulatórios

**Data da pesquisa:** setembro de 2026 · **Método:** fontes secundárias (desk research)
**Uso no projeto:** base do [ADR-0007](../adr/0007-travas-de-conformidade-do-mvp.md), do [ADR-0001](../adr/0001-praca-inicial-somente-df.md) e do [ADR-0004](../adr/0004-pagamentos-via-psp-com-split.md).

> ⚠️ **Resumo informativo, não parecer jurídico.** Antes de operar, validar com advogado regulatório e consultar diretamente DETRAN-DF, SEMOB-DF e o Banco Central.

---

## 1. O que a empresa de guincho precisa para operar

### Empresa e alvará
- CNPJ com CNAE de guincho: **5229-0/02** (serviços de reboque de veículos); há também menção a 5229-0/99.
- No DF, o processo é pela **Rede Sim DF** (Junta Comercial + Alvará de Funcionamento + Corpo de Bombeiros / vigilância / meio ambiente conforme o caso).

### Veículo
- **CTB art. 120:** todo reboque/semirreboque deve ser registrado no DETRAN do estado do proprietário — registro inicial, vistoria, CRV/CRLV.
- O veículo de socorro deve ser licenciado na **espécie/carroceria adequada** (reboque / guincho / plataforma) e atender requisitos CONTRAN de potência × peso rebocado e equipamentos obrigatórios.
- **Sinalização:** luz intermitente/rotativa **amarelo-âmbar** de prestação de serviço, regulada pela **Resolução CONTRAN nº 970/2022** (20/06/2022).

> 💡 É desta resolução que vem a cor primária da marca. Ver [identidade-visual.md](../marca/identidade-visual.md).

### Condutor
- Categoria de CNH conforme o PBT do conjunto: em geral **C** (carga acima de 3.500 kg), **E** quando o conjunto ultrapassa os limites ou o reboque passa de 6.000 kg. Guinchos leves (plataforma sobre chassi até 3.500 kg) podem exigir apenas **B**.
- ⚠️ **A confirmar** caso a caso (CTB art. 143 e resoluções CONTRAN). Não obtive página oficial específica.
- Para inscrição no RNTRC como TAC/responsável técnico: **3 anos de experiência comprovada OU curso específico de transporte (curso de TAC)**.
- **MOPP não se aplica** — é exigido para produtos perigosos, não para transporte de veículos.
- Cursos de operação de guincho/munck podem ser exigidos por **NR-11/NR-12** no aspecto trabalhista. Não pesquisado a fundo.

---

## 2. ANTT / RNTRC — quando o guincho vira transporte de carga

**Base legal:** Lei nº 11.442/2007; Resolução ANTT nº 5.982/2022; Resolução ANTT nº 6.068/2025 (atualiza o RNTRC); Portaria SUROC nº 27/2025 (procedimentos de seguro).

**Categorias:** TAC (autônomo, até 3 veículos), ETC (empresa), CTC (cooperativa). Exige ao menos 1 veículo de carga na categoria "aluguel".

### A distinção que define a estratégia do MVP

| Situação | Enquadramento |
|---|---|
| Guincho de **assistência/emergência** (pane, acidente, sinistro) | Entendido como serviço de socorro — geralmente **fora** da lógica de transporte de carga, sem CT-e |
| **Transporte de veículo sem emergência** entre municípios/estados | Aproxima-se de transporte de cargas → **exige RNTRC e CT-e**, com incidência de ICMS-transporte |

A interpretação varia por estado (a SEFAZ/SP trata guincho intermunicipal e interestadual como serviço de transporte).

⚠️ **Ponto crítico para o Guinchei:** o DF é unidade federativa própria. Quase toda corrida "Brasília ↔ cidade do entorno goiano" **cruza divisa estadual**, o que puxa para o regime ANTT/CT-e mais rigoroso. É exatamente por isso que o [ADR-0001](../adr/0001-praca-inicial-somente-df.md) restringe o MVP a origem e destino dentro do DF.

**A confirmar:** posição da SEFAZ-DF sobre CT-e e ICMS-transporte para guincho DF ↔ Goiás.

---

## 3. Responsabilidade civil por avaria

### Seguros no regime ANTT
- **RCTR-C** (Responsabilidade Civil do Transportador Rodoviário de Carga) — obrigatório no regime de cargas.
- **RC-DC / RCF-DC** (desaparecimento de carga) e **RC-V** — exigidos conforme a Portaria SUROC nº 27/2025.
- O mercado oferece apólice específica de **guincho / reboque / plataforma / cegonha**, cobrindo avarias ao veículo transportado.
- Para guincho puramente de assistência emergencial (não classificado como transporte de carga), o RCTR-C pode não incidir por lei — o seguro de avarias passa a ser **escolha contratual**, mas altamente recomendável e frequentemente exigido por seguradoras contratantes.

### Quem responde perante o cliente
- A relação é regida pelo **CDC**:
  - **Art. 14** — responsabilidade **objetiva** (independe de culpa) por defeito na prestação de serviço.
  - **Arts. 7º, parágrafo único, e 25, §1º** — **solidariedade** entre todos os integrantes da cadeia de fornecimento.
- A jurisprudência do STJ e dos tribunais estende essa responsabilidade às **plataformas de intermediação** (Uber, 99, iFood): a plataforma é vista como parte da cadeia de consumo / fornecedora aparente, respondendo solidariamente por danos causados pelo prestador parceiro ao usuário.

> **Conclusão:** sim, o Guinchei pode ser responsabilizado solidariamente pela avaria causada por um guincheiro parceiro.

**Mitigação adotada** (ver [ADR-0007](../adr/0007-travas-de-conformidade-do-mvp.md)):
1. Apólice de avaria obrigatória de toda Frota, com a plataforma como cossegurada/beneficiária.
2. Seguro de RC da própria operação.
3. Verificação documental prévia de cada Frota.
4. Fotos de estado obrigatórias (antes e depois, com hora e GPS) como meio de prova.

**Lacuna:** não localizei precedente judicial específico sobre app de guincho — a análise é por analogia com Uber/99/iFood.

---

## 4. Meios de pagamento — precisa ser instituição de pagamento?

**Não**, desde que a plataforma **não retenha nem faça transitar o valor integral em conta própria**.

O caminho padrão de marketplace é usar um **PSP/subadquirente/facilitador** (Pagar.me, Asaas, Iugu, Stripe Connect, Celcoin, Stark Bank) que já é ou opera sob instituição de pagamento autorizada, executando o **split** e liquidando direto para cada recebedor.

**Base regulatória:** Circular BCB 3.682/2013 (arranjos de pagamento) e **Resolução BCB nº 80/2021** (constituição e autorização de IPs; capital mínimo de R$ 2 milhões por modalidade a partir de 01/06/2023).

### Limites que obrigam pedido de autorização ao BC

| Modalidade | Gatilho |
|---|---|
| Emissor de moeda eletrônica (conta pré-paga) | R$ 300 mi em transações **ou** R$ 30 mi em recursos mantidos (patamar 2024, reduzindo até 2028; todos devem pedir autorização até 31/03/2029) |
| Credenciador / emissor pós-pago | R$ 500 mi de movimentação em 12 meses → autorização em até 90 dias |
| Iniciador de transação de pagamento (ITP) | **Sempre** exige autorização, independentemente de volume |

**Conclusão prática:** o Guinchei **não precisa** de autorização do BC usando PSP com split. Só precisaria se decidisse internalizar a operação de pagamentos e ultrapassar esses patamares. Escrow e retenção por dias devem ser estruturados **dentro do PSP**, para não configurar atividade de IP não autorizada.

---

## 5. Players existentes no Brasil

| Player | Modelo |
|---|---|
| **Cadê Guincho** | Marketplace on-demand tipo "Uber do guincho". Profissional recebe alerta e **envia proposta**; cliente escolhe e acompanha no mapa. Taxa ~20% por serviço. +190 mil serviços, +6 mil profissionais. Regiões metropolitanas de SP, RJ, BH e Curitiba. |
| **Reboque.me** | Assistência 24h sob demanda (guincho, pane seca, chaveiro, bateria, pneu) para quem não tem seguro (B2C) **e** B2B (seguradoras, locadoras, frotas). Acelerada pela Oxigênio (Porto Seguro) em 2017. Cliente vê preço, ETA e dados do prestador antes. Sem mensalidade para o parceiro. |
| **HelpCars** | Localiza o guincho mais próximo, atendimento em ~45 min, rastreamento em tempo real. |
| Guincho Auto Socorro, V-Guincho, Guincho Retorno, Achei Guincho | Apps menores/regionais; Achei Guincho é white-label/licenciamento para investidores. |

**Lacuna competitiva confirmada:** nenhum define o preço **pela própria plataforma** antes da solicitação, e nenhum tem operação consolidada no DF.

**Trajetória relevante:** a Reboque.me começou B2C atendendo quem não tem seguro e migrou para B2B com seguradoras — exatamente a sequência de fases planejada aqui.

**Nomes descartados:** não encontrei fontes confiáveis sobre "Guinchup" nem "Guincho Fácil" como apps ativos. "Zello" é app de rádio push-to-talk, **não** é serviço de guincho. App Guincho, CheckGuincho e Gaieviski são **ERP/checklist** para empresas de guincho, não marketplaces de demanda.

---

## Fontes

**Legislação e normas**
- Lei nº 8.078/1990 (CDC), arts. 7º, 14 e 25
- Lei nº 11.442/2007 — transporte rodoviário de cargas
- Resolução CONTRAN nº 970/2022 — https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-contran/resolucoes/resolucao9702022.pdf
- ANTT — RNTRC / Requisitos — https://www.gov.br/antt/pt-br/assuntos/cargas/rntrc-1/requisitos
- Resolução ANTT nº 6.068/2025 — https://setrans.com.br/resolucao-antt-no-6-068-2025-atualiza-procedimento-para-o-rntrc/
- Resolução BCB nº 80/2021 — https://www.legisweb.com.br/legislacao/?id=411674
- SINJ-DF — Instrução DETRAN nº 1524/2025 — https://www.sinj.df.gov.br/sinj/Norma/a3cf54ac3943419f8ba6592a0aceb22e/detran_ins_1524_2025.html

**Análises**
- Levy & Salomão — "Instituições de pagamento: quando pedir autorização?" — https://www.levysalomao.com.br/publicacoes/artigo/instituicoes-de-pagamento-quando-pedir-autorizacao
- Valim Advogados — "Guincho intermunicipal e interestadual: quando a remoção exige CT-e" — https://valimadvogados.com.br/guincho-intermunicipal-e-interestadual-quando-a-remocao-de-veiculo-passa-a-exigir-ct-e/
- Jusbrasil — Responsabilidade civil das plataformas de transporte por aplicativo — https://www.jusbrasil.com.br/artigos/responsabilidade-civil-das-plataformas-de-transporte-por-aplicativo-entre-os-riscos-da-atividade-e-a-protecao-do-usuario/4921247390
- Asaas — Split de pagamentos — https://blog.asaas.com/split-de-pagamento/
- Ittu Seguros — seguro para guincho/reboque/plataforma/cegonha — https://ittu.com.br/news/seguro-para-guincho-reboque-plataforma-e-cegonha-cotacao.html

**Players**
- Projeto Draft — Cadê Guincho — https://www.projetodraft.com/o-cade-guincho-conecta-motoristas-a-profissionais-de-guincho-e-reboque/
- Projeto Draft — Reboque.me — https://www.projetodraft.com/a-reboque-me-tem-uma-solucao-sob-demanda-para-quem-nao-tem-seguro-de-carro/
- https://cadeguincho.com · https://www.reboque.me/about.html · https://helpcars.com.br/aplicativo-de-guincho

---

## Lacunas a confirmar

- Norma distrital específica de credenciamento/licença de guincho particular no DF, além do alvará geral. Não localizei norma consolidada (diferente do guincho de remoção contratado pelo DER/DETRAN em blitz).
- Posição da SEFAZ-DF sobre CT-e / ICMS-transporte para guincho DF ↔ Goiás.
- Categoria exata de CNH por faixa de PBT.
- Texto integral da Resolução ANTT nº 6.068/2025 sobre quais seguros passaram a ser obrigatórios × facultativos.
- Ausência de precedente judicial específico sobre app de guincho.
