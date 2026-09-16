# Pesquisa: preços de guincho no Distrito Federal

**Data da pesquisa:** setembro de 2026 · **Método:** fontes secundárias (desk research)
**Uso no projeto:** calibração do Preço fechado (ver [ADR-0003](../adr/0003-preco-fechado-definido-pela-plataforma.md)) e do ticket médio em [unit-economics.md](../negocio/unit-economics.md).

> ⚠️ Todos os valores abaixo vêm de fontes secundárias e reportagens. Nenhuma empresa de guincho de Brasília publica tabela fixa — todas orçam na hora. Tratar como **faixas direcionais**, não como preço tabelado.

---

## 1. Tarifa regulada do DETRAN-DF (veículo apreendido)

| Item | Valor | Vigência |
|---|---|---|
| Remoção/reboque de veículo leve (até 15 km) | R$ 336,98 | jan/2023 |
| Km excedente | R$ 21,19/km | jan/2023 |
| Diária de pátio — automóvel | R$ 57,00 | jun/2025 |
| Diária de pátio — motocicleta | R$ 45,00 | jun/2025 |
| Diária de pátio — trailer/reboque | até R$ 131,00 | jun/2025 |
| Taxa de liberação | R$ 52,98 | jan/2023 |

Reajuste anual pelo INPC. Extrapolando os reajustes sobre os R$ 336,98 de 2023, a remoção estaria hoje em torno de **R$ 370–390** — estimativa não confirmada.

**Não confirmado:** o valor exato e atualizado (2025/2026) da taxa de remoção. O PDF oficial da tabela do DETRAN-DF estava indisponível no acesso (site migrado, links redirecionando para a home).

**Mudança legal relevante:** a Lei Distrital nº 7.687/2025 proíbe cobrar diária de veículo retirado no mesmo dia do recolhimento, se todas as pendências forem quitadas no mesmo dia. Há ainda o PL federal 5206/20, que pretende limitar pátio + remoção a 20% do valor FIPE — ainda não é lei.

---

## 2. Preço de mercado — guincho particular em Brasília

Este é o parâmetro que importa para a precificação do Guinchei.

| Item | Faixa | Mediana aprox. |
|---|---|---|
| Saída/bandeirada — carro de passeio | R$ 120–250 | ~R$ 180–200 |
| Saída — SUV / picape / van | R$ 180–400 | — |
| Saída — moto | R$ 100–180 | — |
| R$/km — carro de passeio | R$ 3–8/km | ~R$ 5–6/km |
| R$/km — moto | R$ 4–6/km | — |
| R$/km — SUV / van | R$ 7–10/km | — |
| Reboque urbano curto (~10 km) | R$ 150–300 | ~R$ 200 |
| Reboque urbano médio (~30 km) | R$ 280–450 | ~R$ 350 |
| Adicional noturno / feriado | +20% a +50% | — |

Observações relevantes para o motor de preço:
- A "saída" normalmente **já inclui os primeiros 10–20 km**.
- O km costuma ser cobrado **nos dois sentidos** (deslocamento até o cliente + trecho rebocado + retorno à base). Isso explica por que a estrutura do Guinchei separa `R$/km até o veículo` de `R$/km rebocado`.
- Faixa geral citada para serviços básicos em Brasília: **R$ 150–500**.

**Posicionamento adotado:** ticket médio de R$ 300, cerca de 10–15% abaixo da média ponderada do mercado. Ver [ADR-0003](../adr/0003-preco-fechado-definido-pela-plataforma.md).

---

## 3. Assistência 24h / seguradora

- Com seguro auto ou plano de assistência, o reboque é **gratuito para o segurado** dentro da franquia de km contratada. Planos comuns: 100, 200, 400 km ou ilimitado; alguns planos só-guincho até 600 ou 1.000 km.
- Excedente de km, quando há limite: cerca de **R$ 5–10/km** pagos pelo cliente.
- Planos básicos cobrem tipicamente **2 a 4 acionamentos** de guincho por ano.
- **Não encontrado:** preço tabelado que a seguradora paga ao prestador — é custo interno e contrato B2B não divulgado.

**Implicação estratégica:** confirma que o público-alvo do MVP é quem **não tem** cobertura. Quem tem seguro não paga pelo reboque e não é convertível por preço.

---

## 4. Intermunicipal e rodovia

- Rodovias com pedágio/concessão: guincho para pane e acidente costuma ser gratuito, já incluso na tarifa (padrão ANTT/concessionárias).
- **No DF e entorno imediato as BRs não têm pedágio/concessão** (BR-060, BR-070, BR-251, DF-001). Não há guincho gratuito de concessionária — o usuário aciona e paga guincho particular.
- Faixas de mercado para trechos longos (não específicas do DF): 50 km R$ 380–600 · 100 km R$ 700–1.100 · 200 km R$ 1.300–2.000 · geral intermunicipal R$ 400–1.200.
- **Não encontrado:** tarifa oficial de R$/km de guincho em rodovia do DER-DF.

---

## Fontes

- Metrópoles — "Detran não poderá cobrar diária de veículos apreendidos por um dia", 12/06/2025 — https://www.metropoles.com/distrito-federal/detran-nao-podera-cobrar-diaria-de-veiculos-apreendidos-por-um-dia
- Correio Braziliense — "Serviços ficarão mais caros no Detran-DF a partir de 1º de janeiro de 2023", 28/12/2022 — https://www.correiobraziliense.com.br/cidades-df/2022/12/5061903-servicos-ficarao-mais-caros-no-detran-df-a-partir-de-1-de-janeiro-de-2023.html
- Câmara Legislativa do DF — Lei nº 7.687/2025 — https://www.cl.df.gov.br/-/detran-nao-podera-cobrar-diaria-de-veiculos-buscados-no-mesmo-dia-no-deposito
- Autopapo — PL 5206/20, teto de 20% da FIPE — https://autopapo.com.br/curta/patio-do-detran-valor-limitado/
- DETRAN-DF — Tabela de Preços (PDFs indisponíveis no acesso) — http://www.detran.df.gov.br/tabela-de-precos/
- Guincho Três Irmãos — "Quanto Custa um Guincho em Brasília? Preços e Fatores 2025" — https://www.guichotresirmaos.com.br/quanto-custa-um-guincho-em-brasilia-precos-e-fatores-em-2025/
- Blog Ache Guincho — "Quanto Custa um Guincho em 2026? Tabela de Preços" — https://blog.acheguincho.com.br/preco-guincho-reboque-2026/
- Guincho Brasília 24h — https://guinchobrasilia24hs.com.br/quanto-custa-guincho-brasilia/
- Youse Seguros — guincho 24h, franquias de km — https://www.youse.com.br/seguro-auto/duvidas/assistencias/como-funciona-o-servico-de-guincho-24h-da-assistencia-a-automovel/
- Allianz — "Guincho 24h: por que essa cobertura é essencial", 2025 — https://www.allianz.com.br/Blog/2025/guincho-24h-entenda-essa-cobertura-importante-do-seguro-auto.html
- Porto Seguro — assistência 24h, franquia de km — https://www.portoseguro.com.br/faqs/como-funciona-o-plano-de-assistencia-24h-no-seguro-auto-frota
- ANTT — Perguntas frequentes, guincho incluído no pedágio em rodovia concedida — https://portal.antt.gov.br/en/perguntas-frequentes/-/categories/362330
- DER-DF — Sistema Rodoviário (sem tabela de guincho localizada) — https://www.der.df.gov.br/sistema-rodoviario

## Fonte descartada

- consultadeplaca.net (2026) cita "R$ 300 de remoção + R$ 36/dia de pátio" para o DF. Conflita com a diária de R$ 57 noticiada pela imprensa local em 2025. **Tratada como não confiável.**
