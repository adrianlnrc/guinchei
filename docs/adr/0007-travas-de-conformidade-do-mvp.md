# ADR-0007: Travas de conformidade do MVP

- Status: aceito
- Data: 2026-09-03
- Decisores: (a definir)

## Contexto

Pela jurisprudência aplicada a plataformas de intermediação (Uber, 99, iFood) e pelo CDC (arts. 7º, 14 e 25), o Guinchei pode responder **solidariamente** por avaria causada pelo Guincheiro parceiro ao veículo do Cliente. Avaria em transporte é a disputa nº 1 do setor. Além disso, transporte de veículo entre estados aciona o regime ANTT/RNTRC/CT-e.

## Decisão

Três travas inegociáveis no MVP:

1. **Geografia:** só Corridas com origem e destino no DF (reforça ADR-0001) — evita o regime de transporte de cargas interestadual.
2. **Seguro:** apólice de responsabilidade civil por avaria em transporte obrigatória para toda Frota, com o Guinchei como cossegurado; mais seguro de RC da própria operação.
3. **Dinheiro:** exclusivamente via PSP regulado (reforça ADR-0004).

Verificação documental **manual** de cada Frota antes da ativação: CNPJ, contrato, registro do veículo como reboque no DETRAN, CNH do Guincheiro, apólice.

## Alternativas consideradas

- **Operar primeiro e formalizar depois:** acelera o lançamento, mas expõe a empresa a responsabilização sem cobertura e a autuação.
- **Terceirizar todo o risco no contrato com a Frota:** cláusula de regresso ajuda, mas não afasta a solidariedade perante o Cliente pelo CDC.

## Consequências

- (+) Reduz a exposição a responsabilização por avaria e ao regime de cargas.
- (−) Aumenta o atrito de cadastro de Frota.
- (−) Custo do seguro de RC da operação.
- (−) Exige time e processo de verificação desde o início.
