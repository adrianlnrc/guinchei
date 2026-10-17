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
| [docs/desenvolvimento.md](docs/desenvolvimento.md) | Como rodar o monorepo localmente, comandos e deploy |

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
| [0009](docs/adr/0009-tabela-de-precos-inicial-e-repasse-por-distancia.md) | Tabela de preços inicial, piso e repasse pela distância de quem aceita (provisório) |
| [0010](docs/adr/0010-login-por-telefone-e-cadastro-em-duas-etapas.md) | Login por telefone com código (WhatsApp) e cadastro em duas etapas |
| [0011](docs/adr/0011-fotos-de-estado-opcionais-cliente-e-guincheiro.md) | Fotos de estado opcionais, registradas pelo Cliente e pelo Guincheiro |
| [0012](docs/adr/0012-cadastro-de-prestadores-empresa-e-autonomo.md) | Cadastro de prestadores: empresa e autônomo, com verificação manual |

---

## Protótipo navegável

Os três apps em `apps/` trazem as telas do protótipo do Claude Design (App do Cliente, App do Guincheiro e Painel de operação), navegáveis e com dados mock do cenário do Rafael: Eixo Monumental → Taguatinga Norte, Preço fechado de R$ 297,62. Supabase e Mapbox ainda não estão ligados. As issues F4 a F10 trocam o mock pelos dados reais.

- **Cliente:** login por SMS, Pedido em três toques (variação 1a do design), Preço fechado, Pix, acompanhamento da Corrida, cancelamento com taxa, avaliação e histórico.
- **Guincheiro:** plantão, chamado com aceite em 30 s, Fotos de estado antes e depois (a Corrida só encerra com elas), transporte, repasse e histórico.
- **Painel:** monitor de Corridas com atribuição manual, homologação de Frota (RN03), Disputa e tabela de preços com simulador.

`packages/ui` guarda os tokens da identidade visual e os componentes compartilhados. `packages/mock` guarda os dados do cenário e dublês do cálculo de preço e das transições; ele sai quando `preco` (#7) e `estados` (#6) estiverem prontos.

Em tela larga, os apps do Cliente e do Guincheiro aparecem dentro de uma moldura de iPhone, útil para pitch e teste com usuário. No celular, ocupam a tela inteira. No mock, qualquer código SMS de 6 dígitos entra, o Pix "cai" alguns segundos depois de copiar o código e a Corrida avança sozinha. Como rodar: [docs/desenvolvimento.md](docs/desenvolvimento.md).

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
