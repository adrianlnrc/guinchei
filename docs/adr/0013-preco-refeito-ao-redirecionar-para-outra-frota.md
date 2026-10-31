# ADR-0013: Preço fechado refeito quando o Pedido é redirecionado a outra Frota

- Status: aceito (provisório; revisar com dados do piloto)
- Data: 2026-10-22
- Decisores: Adrian de Alencar Stelo (produto e arquitetura)
- Revisa: ADR-0009 (repasse quando outra Frota aceita) e a invariante 2 do CONTEXT.md

## Contexto

O ADR-0009 manteve o Preço fechado da cotação mesmo quando quem aceita é outro Guincheiro: o repasse segue a distância dele e a plataforma absorve a diferença com a própria Comissão, até um teto. A opção B, em que o Cliente aprova um novo valor antes da oferta à próxima Frota, foi descartada "por ora", com a decisão marcada para ser revisitada.

Em 22/out/2026 o Adrian revisitou: **quando o Pedido é redirecionado para outra empresa de guincho, o preço é refeito.** O custo da absorção cai sobre a margem justamente quando a Frota mais próxima recusa, e a Frota que atende deve ser paga pela distância que percorre sem a plataforma cobrir a diferença.

## Decisão

- O Preço fechado é cotado com o Guincheiro elegível mais próximo, como no ADR-0003 e no ADR-0009. A Frota desse Guincheiro é a **Frota cotada** (`pedidos.frota_cotada_id`).
- Enquanto o Match oferece a Guincheiros **da mesma Frota cotada**, nada muda para o Cliente: o repasse segue a distância de quem aceita, dentro do teto da Comissão (ADR-0009, inalterado).
- Quando o Match precisa passar para um Guincheiro **de outra Frota** (recusa, expiração ou "tentar de novo"), o preço é **recalculado** com a distância desse Guincheiro até o veículo, com a mesma tabela (a da cotação), o mesmo instante e o mesmo trajeto rebocado:
  - **Novo preço menor ou igual:** segue sem pausa. O Pedido passa a valer o novo preço (com a nova decomposição), a Frota dele passa a ser a Frota cotada, a diferença é estornada e o Cliente vê o aviso no acompanhamento. O repasse é 80% do novo preço, sem absorção.
  - **Novo preço maior:** a oferta pausa e o Pedido vai ao estado **`aguardando_aprovacao_preco`**. Nenhuma oferta sai. O Cliente vê "Outra empresa vai atender" com o preço anterior, o novo e a decomposição, e escolhe:
    - **aprova:** a diferença é autorizada, o novo preço e a nova Frota cotada passam a valer, o Pedido volta a `em_match` e a oferta sai para essa Frota;
    - **desiste:** estorno integral, sem custo; o Pedido vai a `estornado`.
  - **Sem resposta no prazo** (configurável, 120 s por padrão em `parametros_match.prazo_aprovacao_preco_segundos`), vale como desistência.
- Cada recotação fica registrada em `recotacoes_pedido` (preços anterior e novo, decomposição, as duas Frotas, o desfecho `aplicada`, `pendente`, `aprovada`, `desistida` ou `expirada`) para auditoria e para o Painel.
- A decisão "recotar ou não, e se precisa de aprovação" é função pura em `@guinchei/match` (`decidirRecotacao`); o banco confere na gravação que a decisão é coerente com o Pedido (mesma Frota não recota; preço maior só segue aprovado).
- O teto de absorção do ADR-0009 continua valendo dentro da Frota cotada. Depois de uma recotação, a diferença para os próximos Guincheiros da nova Frota é calculada contra o preço novo.

Pedido cotado antes desta decisão (sem Frota cotada) mantém o comportamento do ADR-0009.

## Alternativas consideradas

- **Manter a opção A do ADR-0009 (a plataforma absorve):** protege a promessa de preço fechado, mas corrói a margem quando a Frota mais próxima recusa, justo o caso que o piloto precisa medir.
- **Recotar sempre, até na mesma Frota:** encareceria o Cliente por diferenças de poucos metros dentro de uma Frota que ele já aceitou; a Frota cotada é a fronteira da promessa.
- **Aprovar também a redução:** o Cliente não ganha nada em parar para aprovar um preço menor; o aviso basta.
- **Cobrar a diferença sem pausar:** quebraria a confiança no momento de maior estresse; a aprovação explícita é o ponto da decisão.

## Consequências

- (+) A plataforma não absorve mais a diferença quando a Frota que atende é outra; a margem fica previsível.
- (+) O Cliente nunca paga mais sem aprovar, e quando o preço cai, recebe a diferença.
- (+) Histórico de recotações permite medir no piloto a frequência e o tamanho do desvio.
- (−) O Preço fechado deixa de ser "só muda se o destino mudar": agora também muda ao trocar de Frota. A promessa vale dentro da Frota cotada.
- (−) Mais uma espera no momento de maior estresse (o Cliente decide com a tela do novo preço); pode derrubar a métrica-estrela de atendimento em 30 minutos.
- (−) Provisório (RF12): a autorização da diferença e o estorno só alteram `pagamentos`, porque o GatewayPagamento mock não guarda estado. Com o PSP real, as respostas do Cliente e o prazo vencido passam por uma Edge Function que chama o PSP antes de gravar.

## Revisar no piloto

Medir: taxa de Pedidos que passam a outra Frota; quantos recotam para mais (e quantos o Cliente aprova, desiste ou deixa vencer); tempo extra até a oferta; diferença média da redução. Se a desistência for alta, reavaliar cotar com a Frota âncora mais próxima ou aproximar a primeira cotação do pior caso.
