# ADR-0004: Pagamentos via PSP com split, sem custódia própria

- Status: aceito
- Data: 2026-09-03
- Decisores: (a definir)

## Contexto

Reter e repassar o valor integral das Corridas em conta própria pode caracterizar atividade de instituição de pagamento, sujeita à Resolução BCB nº 80/2021 (capital mínimo de R$ 2 milhões por modalidade e pedido de autorização ao Banco Central). PSPs/subadquirentes já operam sob autorização e oferecem split nativo.

## Decisão

Usar um PSP com split de pagamento (Pagar.me / Asaas / Iugu / Mercado Pago). Meios: cartão e Pix. O split liquida direto para cada recebedor, já descontada a Comissão; repasse D+1 ou semanal configurado no provedor. A plataforma nunca movimenta o valor integral em conta própria. Qualquer retenção/escrow é estruturada dentro do PSP.

## Alternativas consideradas

- **Conta de pagamento própria / escrow manual:** mais controle sobre o fluxo, mas cria risco regulatório e operacional e pode exigir autorização do BC.

## Consequências

- (+) Sem necessidade de autorização do Banco Central no MVP.
- (+) Conformidade, antifraude e conciliação terceirizados.
- (−) Taxa do PSP (~3%) entra no unit economics de cada Corrida.
- (−) Dependência de um fornecedor; troca futura tem custo de migração.
