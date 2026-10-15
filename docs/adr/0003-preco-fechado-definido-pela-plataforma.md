# ADR-0003: Preço definido pela plataforma e fechado antes da confirmação

- Status: aceito
- Data: 2026-09-03
- Decisores: (a definir)

## Contexto

No guincho tradicional o preço só aparece quando o guincheiro já está no local, quase sempre inflado. A concorrente Cadê Guincho deixa o guincheiro cotar cada pedido. O gancho de confiança do Guinchei é justamente eliminar essa incerteza.

## Decisão

A plataforma calcula o Preço fechado — taxa base + R$/km até o veículo + R$/km rebocado + multiplicador noturno/feriado — e mostra ao Cliente **antes** de confirmar o Pedido. O Guincheiro não negocia. O valor só muda se o destino mudar durante a Corrida. Posicionamento 10–15% abaixo do mercado no início para ganhar espaço.

## Alternativas consideradas

- **Guincheiro cota cada Pedido:** modelo da Cadê Guincho; recria a incerteza que queremos eliminar.
- **Tabela fixa por faixa de distância, sem dinâmica:** simples, mas não cobre bem horário e demanda.

## Consequências

- (+) Transparência de preço vira o principal argumento de marketing e diferenciação.
- (+) Previsibilidade total para o Cliente parado na rua.
- (−) A plataforma assume o risco de precificação em casos atípicos.
- (−) Exige uma engine de preço já no MVP.
- (−) O desconto inicial de 10–15% pressiona a margem enquanto dura o subsídio.

## Nota de revisão (2026-10-15)

A fórmula inclui "R$/km até o veículo", mas o Preço fechado é mostrado antes da confirmação, quando o Guincheiro ainda não foi atribuído. No walking skeleton ([ADR-0008](0008-stack-tecnica-do-skeleton.md)) isso é resolvido assim: a cotação usa a distância do Guincheiro disponível mais próximo naquele momento, o preço é travado e, se o Match atribuir um Guincheiro mais distante, a plataforma absorve a diferença.

**Revisar com dados reais do piloto:** medir a frequência e o custo desse desvio. Alternativas a reavaliar: distância da base da Frota âncora mais próxima, ou taxa de deslocamento fixa por zona.
