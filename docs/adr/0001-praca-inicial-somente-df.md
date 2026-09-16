# ADR-0001: Praça inicial restrita ao Distrito Federal

- Status: aceito
- Data: 2026-09-03
- Decisores: (a definir)

## Contexto

Marketplace de duas pontas precisa de densidade para funcionar. Recursos de MVP são limitados. Uma Corrida entre Brasília e cidade do entorno goiano cruza divisa estadual, o que puxa a operação para o regime ANTT/RNTRC, CT-e e ICMS-transporte — muito mais pesado do que reboque de assistência intramunicipal.

## Decisão

O MVP atende somente Pedidos com origem **e** destino dentro do Distrito Federal. O produto bloqueia geograficamente Corridas fora dessa área e comunica o limite ao Cliente.

## Alternativas consideradas

- **DF + entorno goiano (RIDE):** amplia mercado, mas ativa regime de transporte de cargas interestadual.
- **Múltiplas capitais desde o início:** dilui oferta e demanda, inviável com o time do MVP.

## Consequências

- (+) Elimina exposição a ANTT/RNTRC e ICMS-transporte no MVP.
- (+) Concentra oferta e demanda numa área única.
- (−) Perde Corridas intermunicipais, potencialmente as de maior ticket.
- (−) Exige bloqueio geográfico no produto e mensagem clara de indisponibilidade.
