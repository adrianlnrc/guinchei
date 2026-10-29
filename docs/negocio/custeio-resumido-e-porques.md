# Custeio do MVP: resumo e porquês

> ⚠️ **Nada foi validado empiricamente.** Os valores do orçamento completo vêm de `unit-economics.md` e são **premissas de planejamento**, sem cotação. Valores marcados com ⚠️ são **estimativas** que não constam nos documentos do projeto. A planilha com as contas é [`Guinchei-Custos-MVP.xlsx`](Guinchei-Custos-MVP.xlsx).

**Em uma frase:** o orçamento completo é de **R$ 65 mil em 6 meses**, mas ele só deve ser gasto **depois** de validar a demanda. Antes disso, o risco cabe em **no máximo ≈ R$ 13 mil** (e pode ser ≈ R$ 1,6 mil).

---

## 1. Custeio por fase

| Fase | O que acontece | Custo |
|---|---|---:|
| **0 · Validação** | Entrevistas com motoristas e guinchos, teste do preço e da comissão, protótipo com ferramentas gratuitas | R$ 0 a ≈ R$ 320 ⚠️ |
| **1 · Piloto fechado** | Poucas Corridas reais com Frotas parceiras, atendimento manual, CNPJ aberto | ≈ R$ 1,6 mil a ≈ R$ 12,7 mil ⚠️ |
| **2 · Investimento completo** | Seguro, jurídico, subsídio, marketing e reserva, só se a Fase 1 mostrar demanda | ≈ R$ 58 mil a R$ 65 mil |

**Gasto antes da decisão (fases 0 e 1): ≈ R$ 1,6 mil a ≈ R$ 13 mil.** Isso protege **80% a 97%** do orçamento completo.

### Critérios para liberar a Fase 2
- Clientes aceitam pagar o Preço fechado de ≈ R$ 300 (hipótese 1).
- Empresas de guincho aceitam a comissão de 20% (hipótese 2).
- Match acima de 90% e chegada abaixo de 30–40 minutos (hipótese 3).
- Margem de contribuição positiva por Corrida.

**Por que em fases:** o projeto é acadêmico e ainda não se sabe se vai para a prática. Gastar R$ 65 mil sem saber se há demanda seria assumir todo o risco antes de qualquer evidência. Assim, o gasto cresce só quando o risco diminui.

---

## 2. Fase 1 em detalhe e por quê

| Item | Mínimo | Máximo | Por quê |
|---|---:|---:|---|
| Abertura do CNPJ | R$ 300 | R$ 800 | Necessário para receber via PSP e contratar Frotas. MEI não serve ao modelo de intermediação |
| Contabilidade (3 meses) | R$ 1.200 | R$ 2.400 | Obrigação fiscal assim que existe CNPJ |
| Ferramentas (3 meses) | R$ 130 | ≈ R$ 1.470 | Mínimo: planos gratuitos e bot próprio. Máximo: planos pagos, porque o Vercel Hobby não permite uso comercial |
| Termos de uso e privacidade | R$ 0 | R$ 1.500 | Mínimo: modelo próprio, sem advogado. Máximo: revisão pontual |
| Seguro de RC da operação | R$ 0 | R$ 4.500 | Ver explicação abaixo |
| Marketing (teste de canal) | R$ 0 | R$ 2.000 | Mínimo: indicação e orgânico. Máximo: pequeno teste de Google Ads |
| Subsídio às Frotas | R$ 0 | R$ 0 | Sem garantia: a Frota ganha por Corrida, o que testa se ela aceita assim |
| **Total** | **≈ R$ 1.630** | **≈ R$ 12.670** | |

Todos os valores desta tabela são ⚠️ estimativas, exceto o seguro, que é proporcional ao orçamento original.

---

## 3. Os itens do orçamento completo (Fase 2): de onde vêm e por quê

| Item | Valor | De onde vem | Por que existe | Pode ser cortado? |
|---|---:|---|---|---|
| Subsídio às 3 Frotas âncora | R$ 18.000 | 3 Frotas × 90 dias × ≈ R$ 2.000 por mês. O R$ 2.000 é **arbitrado** no planejamento, sem cotação | Garantir guincho disponível no lançamento (Ganho mínimo garantido, ADR-0006) | Sim: testar com Frotas que ganham só por Corrida |
| Marketing de aquisição | R$ 12.000 | Premissa de planejamento, sem cotação | Testar o canal principal, o Google Ads com termos como "guincho brasília" | Em parte: indicação e comunidades custam menos |
| Seguro de RC da operação | R$ 9.000 | Estimativa de planejamento (≈ R$ 1.500/mês), sem cotação | Cobre a empresa se um Cliente processá-la por dano causado por um guincheiro parceiro (CDC: responsabilidade solidária, como Uber e iFood) | Só faz sentido com Corridas reais |
| Reserva de contingência | R$ 8.000 | ≈ 12% sobre os demais itens | Imprevistos. **Não é custo:** só é gasta se necessário | Sim, num projeto acadêmico |
| Jurídico | R$ 6.000 | Estimativa de planejamento | Contrato com Frotas, termos de uso, LGPD | Em parte: começa com modelos simples |
| Constituição e contabilidade (6 meses) | R$ 5.000 | Estimativa de planejamento | Abrir CNPJ e manter a contabilidade | Não, se houver CNPJ |
| Infraestrutura e ferramentas | R$ 7.000 | Estimativa de planejamento | Hospedagem, banco, mapas e mensagens | Sim: cenário enxuto custa ≈ R$ 260 em 6 meses |
| Desenvolvimento | R$ 0 | Feito pelos 6 fundadores | Custo de oportunidade, não caixa | Já está em zero |

**Total: R$ 65.000.** No cenário enxuto de ferramentas, **≈ R$ 58.300**.

### O que é o seguro de RC da operação
RC é responsabilidade civil. Existem dois seguros diferentes, e só um é custo seu:
- **Apólice de avaria da Frota:** cada Frota paga a sua e o Guinchei entra como cossegurado. **Não é custo do Guinchei.**
- **RC da própria operação:** é a que aparece no orçamento.

### Ferramentas: cenário enxuto e cenário de escala

| Cenário | Premissas | Por mês | 6 meses |
|---|---|---:|---:|
| **Enxuto** | Vercel Hobby, Supabase Free, Mapbox na cota gratuita, número dedicado com bot de WhatsApp | ≈ R$ 45 | ≈ R$ 260 |
| **Escala** | Vercel Pro, Supabase Pro, API oficial do WhatsApp | ≈ R$ 490 | ≈ R$ 2.950 |

**Cuidados com o enxuto:**
- Vercel Hobby é para uso não comercial. Supabase Free pausa o projeto por inatividade e não tem backup.
- Bot de WhatsApp em número comum (não oficial) pode ser bloqueado, e o login depende dele. Convém ter SMS ou a API oficial como alternativa.

---

## 4. Custo médio

| Referência | Valor |
|---|---:|
| Orçamento completo ÷ 6 meses | ≈ R$ 10,8 mil por mês |
| Custos fixos sem pró-labore | R$ 5,5 mil por mês |
| Custos fixos com 2 contratações | ≈ R$ 18 mil por mês |

**Por Corrida de R$ 300:** R$ 240 vão para o Guincheiro (não é custo), R$ 9 para o processamento do pagamento (≈ 3%) e ≈ R$ 25 de subsídio nos meses 1–6.

---

## 5. Fontes de receita

| Fonte | Fase | Detalhe |
|---|---|---|
| **Comissão de 20% por Corrida** | MVP | R$ 60 por Corrida de R$ 300 |
| Assistência completa (bateria, pneu, pane seca, chaveiro) | Fase 2 do produto | Mesma comissão |
| Contratos com seguradoras e assistências 24h | Fase 3 do produto | Receita recorrente |
| Novas praças (Goiânia e entorno) | Fase 3 do produto | Mesmo modelo, mais volume |

Fontes de capital, que **não são receita**: bootstrapping, incubação universitária (UCB), editais (FAP-DF, FINEP, Sebrae) e investimento anjo ou pré-seed.

### Quanto sobra por Corrida

| Linha | Valor |
|---|---:|
| Comissão (20%) | R$ 60 |
| Processamento (≈ 3%) | − R$ 9 |
| **Líquido** | **R$ 51** |
| Subsídio (meses 1–6) | − R$ 25 |
| **Contribuição inicial** | **≈ R$ 26** |
| **Contribuição na maturidade** | **≈ R$ 48** |

### Equilíbrio e projeção

| Cenário | Corridas por mês para equilíbrio |
|---|---:|
| Fixos de R$ 5,5 mil, com subsídio | ≈ 212 |
| Fixos de R$ 5,5 mil, maturidade | ≈ 115 |
| Fixos de R$ 18 mil, maturidade | ≈ 375 |

- **Mês 3:** 300–500 Corridas por mês, ≈ R$ 24 mil de receita por mês.
- **Mês 12:** ≈ 1.500 Corridas por mês, ≈ R$ 90 mil de receita por mês (contribuição ≈ R$ 72 mil).

Esses volumes são **metas**, não previsões: nenhuma foi testada com clientes reais.
