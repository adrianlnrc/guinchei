# ADR-0009: Tabela de preços inicial, piso e repasse pela distância de quem aceita

- Status: aceito (provisório; revisar com dados do piloto)
- Data: 2026-10-17
- Decisores: Adrian de Alencar Stelo (produto e arquitetura)

## Contexto

O ADR-0003 define a estrutura do Preço fechado, mas não os valores. A nota de revisão do ADR-0003 resolveu o "R$/km até o veículo" cotando com o Guincheiro disponível mais próximo e deixando a plataforma absorver o desvio. Na sessão de grilling de 2026-10-17 ficou claro que a prioridade do lançamento é **atrair as Frotas** (oferta), e que a Frota que aceita depois de uma recusa não pode receber pela distância de outra.

## Decisão

**Fórmula** (mantém o ADR-0003): `subtotal = taxa base + km até o veículo × R$/km + km rebocado × R$/km`. Adicionais noturno e feriado incidem sobre o subtotal e somam entre si, sem cascata. Sem franquia de km. O tipo de veículo não altera o preço no MVP.

**Valores iniciais** (para teste, ajustáveis pela tabela de preços versionada):

| Parâmetro | Valor |
|---|---|
| Taxa base | R$ 110,00 |
| Até o veículo | R$ 5,00/km |
| Rebocado | R$ 6,00/km |
| Adicional noturno | +15%, das 20h às 6h |
| Adicional feriado | +20% (feriados nacionais e do DF) |
| Preço fechado mínimo | R$ 180,00, aplicado depois dos adicionais |
| Comissão | 20% (RN09) |

**Cálculo:** valores em centavos, cada parcela arredondada, de modo que a decomposição exibida soma o total. Noturno e feriado são decididos no fuso `America/Sao_Paulo`; a lista de feriados vem do banco. O cálculo é um pacote TS puro (`@guinchei/preco`).

**Repasse quando outra Frota aceita** (opção A do grilling):

- O Cliente mantém o Preço fechado da cotação.
- A oferta a cada Guincheiro mostra o valor recalculado com **a distância dele** até o veículo, e o repasse é 80% desse valor.
- A plataforma absorve a diferença com a própria Comissão.
- **Teto:** se a diferença ultrapassar a Comissão inteira da Corrida, o Pedido não é oferecido àquele Guincheiro e o Match segue para o próximo.

## Alternativas consideradas

- **Valores mais baixos (R$ 85 / 5 / 6,50)**: 12–13% abaixo do mercado em todos os trechos, mas reduz o repasse; descartado porque a prioridade é a oferta.
- **Preço do Cliente muda a cada recusa (opção B)**: o Cliente aprova o novo valor antes da oferta à próxima Frota. Quebra a promessa de preço fechado no momento de maior estresse; descartado por ora.
- **Cotar com a Frota mais distante entre as candidatas**: protege a margem, mas encarece o caso comum.

## Consequências

- (+) A Frota sempre recebe pela distância que de fato percorre.
- (+) O Cliente mantém a promessa do Preço fechado.
- (−) A plataforma perde margem quando a primeira Frota recusa; o teto impede margem negativa.
- (−) Preço próximo do mercado em trechos curtos: o atrativo para o Cliente passa a ser a transparência, não o desconto.

## Revisar no piloto

Medir: taxa de recusa da Frota mais próxima; diferença média absorvida por Corrida; Take efetivo. Se a absorção corroer a margem, reavaliar a opção B ou a cotação por Frota âncora mais próxima. **Decisão marcada pelo Adrian para ser revisitada.**
