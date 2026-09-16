# Persona e segmentos

> ⚠️ Persona construída a partir de pesquisa documental. **Ainda não validada por entrevista.** Ver pendências no [README](../../README.md).

---

## Cliente ideal

Motorista pessoa física residente no Distrito Federal, entre 25 e 55 anos, proprietário de veículo de passeio com mais de oito anos de uso, que **não possui seguro auto** ou possui apólice **sem cobertura de assistência 24 horas**. É digitalmente ativo, resolve serviços pelo celular e usa Pix como meio de pagamento habitual.

---

## Persona: Rafael

**34 anos · analista administrativo · mora em Taguatinga, trabalha no Plano Piloto**

Dirige um sedã 2013 já quitado. Optou por não contratar seguro por causa do custo anual — o carro já vale pouco e a apólice não compensava na conta dele.

Numa terça-feira à noite o carro morre no Eixo Monumental. Ele procura *"guincho Brasília"* no celular, liga para três números, recebe três respostas evasivas sobre preço ("depende, chegando lá a gente vê") e escolhe o que prometeu chegar mais rápido. O guincho chega 50 minutos depois e o valor cobrado é superior ao que foi combinado por telefone. Rafael paga porque não tem alternativa — o carro está na via, é noite, e ele quer resolver.

### Dores
- Não saber quanto vai pagar
- Não saber quanto vai esperar
- Sensação de estar sendo explorado num momento de vulnerabilidade
- Medo de que o carro seja danificado durante o transporte, sem nenhuma prova

### Desejos
- Resolver rápido
- Pagar um preço justo e **conhecido de antemão**
- Ter segurança de que o prestador é confiável e responde pelo que faz

### Comportamentos
- Busca no Google **no momento exato da necessidade** — não pesquisa antes, não tem app instalado
- Decide em poucos minutos
- Prioriza rapidez sobre preço quando está parado na via
- Valoriza avaliação e reputação visíveis

> **Implicação de produto:** o Cliente chega sem app instalado, em pânico, com uma mão no celular. Isso justifica o PWA ([ADR-0005](../adr/0005-mvp-em-pwa.md)) — abre por link, sem loja — e o pedido em três toques.
>
> **Implicação de GTM:** o canal principal precisa capturar intenção de busca, não construir marca antecipada. Ver [go-to-market.md](go-to-market.md).

---

## Segmentos-alvo

| Segmento | Descrição | Fase |
|---|---|---|
| **Primário** | Motoristas pessoa física sem seguro ou sem assistência 24h no DF | MVP |
| **Secundário** | Motoristas de aplicativo e pequenas frotas — alta exposição a pane e forte pressão por tempo de retorno à operação | MVP / Fase 2 |
| **Futuro** | Seguradoras, empresas de assistência e locadoras, no modelo B2B2C com contratos de fornecimento de capacidade | Fase 3 |

### Por que o segmento primário é quem não tem seguro

A [pesquisa de preços](../pesquisa/precos-guincho-df.md) confirmou: quem tem seguro ou plano de assistência **não paga pelo reboque** dentro da franquia de km contratada. Esse público não é convertível por preço nem por conveniência — já tem o problema resolvido, e de graça.

O mercado endereçável do MVP é, por definição, o contingente sem cobertura.

### Sobre o segmento futuro

A Reboque.me percorreu exatamente esse caminho: começou B2C atendendo quem não tem seguro e migrou para B2B com seguradoras (foi acelerada pela Oxigênio, da Porto Seguro). É a validação de que a sequência de fases faz sentido — e também o alerta de que esse é o destino natural do mercado, ou seja, há uma janela para chegar antes.
