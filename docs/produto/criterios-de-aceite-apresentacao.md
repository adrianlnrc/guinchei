# Critérios de aceite da apresentação

Meta (`/goal`): deixar o Guinchei funcionando de ponta a ponta, em ambiente local com dados sintéticos, para a apresentação ao professor. Este documento define quando isso está pronto. Cada critério é verificável: um comando que passa ou um passo de demo que o professor consegue ver.

## Escopo

**Dentro:** os três apps (Cliente, Guincheiro, Painel) rodando contra o Supabase local, com os fluxos do skeleton e do Incremento 1 (cadastro e homologação de prestadores, ADR-0012) e a recotação de preço (ADR-0013).

**Fora, e dito na apresentação como limitação conhecida** (ver também [limitações do skeleton](limitacoes-do-skeleton.md)):

- Deploy online na Vercel (#2) e Mapbox real (#9): dependem de contas do time. A demo é local; sem `VITE_MAPBOX_TOKEN` o mapa cai no esquemático do protótipo.
- Pagamento mock, sem PSP nem split (RF12).
- Push e GPS em segundo plano no iOS (#3).
- Termos de uso definitivos (#23): o texto é provisório.

## A. Ambiente sobe do zero

- [ ] `pnpm install`, `pnpm supabase start` e `pnpm supabase db reset` terminam sem erro.
- [ ] `pnpm dev:cliente`, `pnpm dev:guincheiro` e `pnpm dev:painel` abrem nas portas documentadas, sem a tela "App sem configuração do servidor".
- [ ] O guia [`docs/desenvolvimento.md`](../desenvolvimento.md) basta para outra pessoa repetir isso (números de teste, código `123456`).

## B. Qualidade automatizada

- [ ] CI da `main` verde: `verificar` (format, lint, typecheck, test, build) e `integracao-e-e2e` (pgTAP, integração do `@guinchei/api`, Playwright).
- [ ] Nenhum teste pulado, removido ou enfraquecido para passar.
- [ ] Nenhum segredo no repositório.

## C. Fluxo do Cliente (skeleton)

- [ ] Cliente entra por telefone, abre o Pedido em três toques e vê o **Preço fechado** antes de pagar.
- [ ] Paga em modo mock; o valor mostrado, o gravado e o autorizado são o mesmo.
- [ ] Só o Guincheiro mais próximo recebe a oferta, em tempo real; aceita, e o Cliente acompanha cada etapa até "entregue" sem recarregar.
- [ ] Fotos de estado dos dois lados, com aviso (e não bloqueio) quando faltam.
- [ ] Sem Guincheiro disponível: o Cliente escolhe entre tentar de novo e estornar.

## D. Cadastro e homologação de prestadores (Incremento 1)

- [ ] **Autônomo** (+55 61 90000-0008): cadastra a Frota (dados, alvará, apólice com validade, Pix, termos).
- [ ] Cadastra um **veículo** (placa, RENAVAM, CRLV, tipo, PBT, fotos); placa duplicada dá erro claro.
- [ ] Completa os documentos de **Guincheiro** (CNH com categoria e validade, antecedentes de até 12 meses, selfie).
- [ ] **Convite:** a operação ou o representante convida um Guincheiro por telefone (+55 61 90000-0046 / 0047) e a conta nasce vinculada à Frota certa.
- [ ] **CNH × PBT:** vincular CNH B a veículo de 4.200 kg é bloqueado com explicação; CNH C é aceita; B a 3.500 kg é aceita (#48).
- [ ] **Painel:** a operação vê a fila, abre cada item, aprova ou recusa com motivo, e a decisão fica na trilha de auditoria.
- [ ] Recusado pode ser reenviado e volta a `pendente`.
- [ ] **Vencimentos:** aba "Vencendo" no Painel lista itens a vencer em até 30 dias e os vencidos, o mais urgente primeiro; o contador da lateral reflete (#49).
- [ ] **Match só com Frota ativa:** a Frota só fica ativa com tudo homologado e vigente; Guincheiro não homologado não recebe oferta nem entra na cotação (#50).
- [ ] O autônomo recém-homologado liga o plantão e **recebe a oferta** de um Pedido (#51).

## E. Recotação de preço (ADR-0013)

- [ ] Mesma Frota: nada muda para o Cliente.
- [ ] Outra Frota mais barata: segue sem pausa, aviso de redução no acompanhamento.
- [ ] Outra Frota mais cara: a oferta pausa; o Cliente vê o preço anterior, o novo e a decomposição, e aprova ou desiste. Sem resposta no prazo vale como desistência.
- [ ] O Painel (Monitor) mostra o Pedido aguardando aprovação com os dois valores.

## F. Apresentação

- [ ] Roteiro de demo de 10 a 15 minutos em `docs/produto/roteiro-de-demo.md`, com a ordem das telas, os números de teste e o que dizer em cada passo.
- [ ] Plano B: `pnpm supabase db reset` volta ao estado inicial em menos de 2 minutos; o roteiro lista o que fazer se um serviço não subir.
- [ ] Estados vazios, de carregamento e de erro das telas do roteiro têm texto claro em português; nenhum "undefined", nenhum erro no console durante a demo.
- [ ] A lista de limitações conhecidas está atualizada e é dita em voz alta.
- [ ] Cada issue entregue está fechada e a spec #24 e o mapa #1 refletem o estado real.

## Critério de parada

O trabalho de código está concluído quando **B, C, D e E estiverem marcados**. F fecha a preparação. Itens que dependem de conta ou aparelho do time (#2, #3, #9, #15, #23) ficam registrados como pendências do time, não como falha desta entrega.
