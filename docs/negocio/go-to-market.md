# Go-to-market

Marketplace de dois lados só funciona com densidade. A regra que organiza tudo aqui: **oferta antes de demanda.** App aberto sem guincho disponível destrói a marca no dia 1 — e no serviço de urgência não há segunda chance.

---

## Posicionamento

> **"Preço justo, mostrado antes de você pedir."**

Três atributos, nesta ordem: **transparência · rapidez · confiança.**

O fosso competitivo é a combinação de: preço transparente definido pela plataforma + velocidade do Match + densidade local construída antes de os grandes chegarem ao DF.

### Diferenciação

| | Guinchei | Cadê Guincho | Guincho tradicional | Assistência 24h |
|---|:---:|:---:|:---:|:---:|
| Preço definido **pela plataforma** antes de pedir | ✓ | ✗ | ✗ | ✗ |
| Transparência de preço e ETA | ✓ | parcial | ✗ | parcial |
| Foco 100% em Brasília agora | ✓ | ✗ | — | — |
| Atende quem **não tem** seguro | ✓ | ✓ | ✓ | ✗ |

Ver [pesquisa regulatória, seção 5](../pesquisa/regulatorio-plataforma-guincho.md) para o detalhamento dos concorrentes.

---

## Lado da oferta — bootstrap

**Meta:** 10–20 guinchos ativos no dia do lançamento, via **3–5 Frotas âncora**.

**Mecanismo:** contrato com **Ganho mínimo garantido por plantão disponível** nos primeiros 90 dias, independentemente do volume de Corridas. Custo fixo antes da receita — assumido conscientemente ([ADR-0006](../adr/0006-oferta-via-frotas-ancora.md)).

**Argumento de venda ao Guincheiro:**
- Demanda qualificada sem custo de entrada nem mensalidade
- Pagamento garantido via PSP — sem calote, sem negociação na rua
- Ganho mínimo garantido nos primeiros 90 dias
- Redução de ociosidade da frota

**Requisitos de homologação** (ver [ADR-0007](../adr/0007-travas-de-conformidade-do-mvp.md)): CNPJ ativo · contrato assinado · registro do veículo como reboque no DETRAN · CNH do Guincheiro · **apólice de RC por avaria com a plataforma como cossegurada**. Verificação manual pela operação.

**Alternativas descartadas:** recrutar guincheiro a guincheiro (oferta pulverizada, verificação cara, qualidade irregular) e parceria com pátio/associação (menos controle sobre SLA e experiência).

---

## Lado da demanda — bootstrap

O Cliente chega sem app instalado, em pânico, buscando no Google. O canal precisa estar **no momento da busca**, não na memória da marca.

### Canal 1 — Intenção de busca (principal)
- **Google Ads** sobre termos de intenção imediata: `guincho brasília`, `guincho 24h df`, `reboque perto de mim`, `guincho taguatinga`
- **SEO local:** páginas por região administrativa do DF + perfil de empresa no Google otimizado

### Canal 2 — Rede de indicação remunerada
Oficinas, borracharias, autoelétricas, estacionamentos e concessionárias recebem **comissão por atendimento gerado** via QR code exclusivo.

Racional: esses estabelecimentos são o ponto onde o carro quebrado aparece — ou de onde ele precisa sair.

### Canal 3 — Comunidades locais
Grupos de bairro e de motoristas de aplicativo no DF.

**Marca institucional fica para depois.** Investimento em brand antes de ter oferta e conversão é desperdício.

---

## Retenção

Reboque é serviço de **baixa frequência por Cliente**. Não se mede retenção mensal.

- Cadastro e meio de pagamento salvos → novo pedido em poucos toques
- Histórico de Corridas com Fotos de estado e comprovantes — útil em manutenção e sinistro
- Programa de indicação entre Clientes, com crédito para quem indica e quem é indicado
- Ampliação do escopo de serviços na Fase 2 (bateria, pneu, pane seca, chaveiro) → mais ocasiões de uso

**Métrica:** recompra em janela de 6 a 12 meses + Corridas originadas por indicação.

---

## Dimensionamento de mercado

Método **bottom-up**:

```
frota do DF
  × parcela sem cobertura de assistência
  × frequência anual de acionamento de reboque
  × ticket médio de R$ 300
```

| | Definição |
|---|---|
| **TAM** | Gasto anual com reboque particular por motoristas do DF |
| **SAM** | Parcela originada por motoristas sem seguro / sem assistência 24h |
| **SOM (12 meses)** | ~1.500 Corridas/mês → GMV ~R$ 450 mil/mês → receita ~R$ 90 mil/mês |

⚠️ **Números absolutos pendentes de fonte oficial:** frota registrada no DF (DETRAN-DF / RENAVAM) e índice de veículos sem seguro (CNseg). Até a checagem, o dimensionamento é estimativa direcional.

---

## Barreiras de entrada que estamos construindo

1. **Densidade local de oferta** — o valor depende de haver guincho perto; construir a rede primeiro cria vantagem para quem chega antes em cada praça
2. **Homologação e seguro** — exigir documentação e apólice eleva o custo de entrada e a qualidade da rede
3. **Capital para subsídio** — garantir ganho mínimo exige caixa antes da receita
4. **Marca de confiança** — em serviço de urgência com guarda de bem de alto valor, reputação não se replica rápido
5. **Conformidade regulatória** — estrutura que entrante informal não tem

---

## Roadmap

| Fase | Escopo |
|---|---|
| **Fase 1 — MVP** | Reboque · DF · B2C · PWA · Frotas parceiras |
| **Fase 2** | Assistência completa (bateria, pneu, pane seca, chaveiro) · Guincheiros autônomos verificados · app nativo |
| **Fase 3** | Contratos B2B2C com seguradoras e assistências · novas praças (Goiânia, entorno) |

### Cronograma de validação e construção

| Período | Etapa |
|---|---|
| Meses 1–2 | Descoberta: entrevistas com motoristas e com Frotas, dimensionamento com fontes citadas |
| Meses 2–3 | Modelagem e protótipo navegável validado com usuários |
| Meses 3–6 | Desenvolvimento do MVP e contratos com as Frotas âncora |
| Meses 6–9 | Operação assistida, primeiros atendimentos reais, medição dos KPIs |

### Metas

- **Curto prazo (0–3 meses):** validar o problema e a disposição a pagar; carta de intenção de 3–5 Frotas; protótipo concluído
- **Médio prazo (3–12 meses):** MVP em operação; 300–500 Corridas/mês no primeiro trimestre e ~1.500/mês no mês 12; margem de contribuição positiva
- **Longo prazo (12–36 meses):** assistência completa; autônomos verificados; app nativo; primeiro contrato B2B2C; expansão para Goiânia e entorno

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Oferta insuficiente no lançamento | Frotas âncora com ganho mínimo garantido; área de cobertura inicial restrita às regiões de maior densidade; broadcast como fallback do Match |
| Responsabilidade solidária por avaria (CDC arts. 7º, 14, 25) | Apólice obrigatória do parceiro com plataforma cossegurada; seguro de RC da operação; Fotos de estado obrigatórias com hora e GPS |
| Erro de precificação em caso atípico | Tabela por faixas; revisão periódica com base no histórico; regra de exceção no Painel de operação |
| Limitação do PWA no iOS (push e GPS em 2º plano) | Atualização por etapa como fallback; antecipar invólucro nativo para o app do Guincheiro se comprometer o tempo de aceite |
| Enquadramento como transporte de cargas em corrida interestadual | Operação restrita ao DF ([ADR-0001](../adr/0001-praca-inicial-somente-df.md)) |
| Desintermediação (Cliente e Guincheiro combinam por fora) | Garantia, Fotos de estado e histórico só dentro do app; preço competitivo; penalidade contratual |
| Entrada de concorrente consolidado no DF | Velocidade na captura da oferta local; relacionamento próximo com as Frotas; marca regional antecipada |
| Fraude e inadimplência | Pagamento integralmente no app via PSP, com pré-autorização, sem acerto direto entre as partes |
