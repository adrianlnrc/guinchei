# Guinchei

Plataforma digital que conecta, sob demanda, motoristas com veículo avariado a empresas de guincho homologadas — modelo de intermediação estilo Uber, com **preço fechado exibido antes da confirmação** e chegada em menos de 30 minutos.

- **Praça inicial:** Distrito Federal
- **Público inicial:** motoristas sem seguro auto / sem assistência 24h (B2C)
- **Escopo do MVP:** apenas reboque
- **Receita:** comissão de 20% por atendimento
- **Status:** concepção e planejamento. Validação ainda documental — sem entrevistas, protótipo ou piloto.

---

## Contexto do projeto

Este repositório é a fonte de verdade do produto. Comece por:

| Documento | O que contém |
|---|---|
| [CONTEXT.md](CONTEXT.md) | Domínio, linguagem ubíqua, regras e invariantes. **Leia primeiro.** |
| [docs/adr/](docs/adr/) | Decisões estruturais, com contexto, alternativas e consequências |
| [docs/produto/requisitos.md](docs/produto/requisitos.md) | Requisitos funcionais e não funcionais, fluxo principal |
| [docs/produto/PRD.md](docs/produto/PRD.md) | PRD do walking skeleton: recorte mínimo do MVP para construir primeiro, com critérios de aceite |
| [docs/negocio/unit-economics.md](docs/negocio/unit-economics.md) | Modelo financeiro, ponto de equilíbrio, KPIs |
| [docs/negocio/persona-e-segmentos.md](docs/negocio/persona-e-segmentos.md) | Cliente ideal, persona, segmentos-alvo |
| [docs/negocio/go-to-market.md](docs/negocio/go-to-market.md) | Bootstrap de oferta e demanda, posicionamento, riscos |
| [docs/marca/identidade-visual.md](docs/marca/identidade-visual.md) | Paleta, tipografia, regras de uso |
| [docs/pesquisa/](docs/pesquisa/) | Pesquisa de preços do DF e requisitos regulatórios, com fontes |

Configuração para agentes de IA: [CLAUDE.md](CLAUDE.md) e [docs/agents/](docs/agents/).

---

## Decisões estruturais (ADRs)

| ADR | Decisão |
|---|---|
| [0001](docs/adr/0001-praca-inicial-somente-df.md) | Praça inicial restrita ao Distrito Federal |
| [0002](docs/adr/0002-match-auto-atribuicao-mais-proximo.md) | Match por auto-atribuição ao guincheiro mais próximo |
| [0003](docs/adr/0003-preco-fechado-definido-pela-plataforma.md) | Preço definido pela plataforma, fechado antes da confirmação |
| [0004](docs/adr/0004-pagamentos-via-psp-com-split.md) | Pagamentos via PSP com split, sem custódia própria |
| [0005](docs/adr/0005-mvp-em-pwa.md) | MVP em PWA para as três superfícies |
| [0006](docs/adr/0006-oferta-via-frotas-ancora.md) | Oferta via frotas âncora com ganho mínimo garantido |
| [0007](docs/adr/0007-travas-de-conformidade-do-mvp.md) | Travas de conformidade do MVP |
| [0008](docs/adr/0008-stack-tecnica-do-skeleton.md) | Stack técnica do walking skeleton |

---

## Entregáveis produzidos

### Acadêmico — UCB, Engenharia de Software, disciplina de Startups
Turno matutino, quinta-feira · Professor: Luan da Silva Borges

Fundadores: Adrian de Alencar Stelo (produto e arquitetura), Carlos Eduardo Ribeiro de Lima (back-end e integrações), Arthur Escorcio (front-end — app do cliente), Arthur Murillo (front-end — app do prestador e painel), Gabriel Porto (operação e praça), Arthur Andre (growth e aquisição).

Versões finais entregues:

- **`Guinchei-Documento-de-Projeto-de-Startup.pdf`** — 12 páginas, versão entregue
- **`Guinchei-Documento-de-Projeto-de-Startup.docx`** — fonte editável das 15 seções
- **`Guinchei-Apresentacao.pdf`** — 10 slides, versão entregue (editada no Claude Design)

### Marca
- Paleta visual: https://claude.ai/code/artifact/0fbca5c9-e8ac-469a-93ca-f1bfca61a9b0
- Tokens e regras de uso: [docs/marca/identidade-visual.md](docs/marca/identidade-visual.md)

---

## Pendências conhecidas

**Validação (crítico — nada foi validado empiricamente):**
- 15–20 entrevistas com motoristas do DF que acionaram guincho sem seguro nos últimos 12 meses
- 5–8 entrevistas com empresas de guincho do DF: interesse, capacidade ociosa, aceitação da comissão de 20%
- Protótipo navegável testado com ao menos 10 usuários do perfil-alvo

**Dados a confirmar com fonte oficial:**
- Frota registrada no DF (DETRAN-DF / RENAVAM)
- Percentual de veículos sem seguro auto (CNseg)
- Tarifa atual de remoção do DETRAN-DF (o PDF oficial estava indisponível na pesquisa)

**Jurídico e regulatório a confirmar:**
- Categoria de CNH exigida por faixa de PBT do conjunto (CTB art. 143 e resoluções CONTRAN)
- Norma distrital de credenciamento de guincho particular no DF, além do alvará geral
- Estrutura contratual da apólice com a plataforma como cossegurada
- Posição da SEFAZ-DF sobre CT-e e ICMS-transporte, caso a praça se estenda ao entorno goiano
