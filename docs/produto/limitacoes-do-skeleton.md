# Limitações conhecidas do walking skeleton

Lista para a demo (issue #15), atualizada com o Incremento 1 (cadastro e homologação de prestadores, ADR-0012) e a recotação de preço (ADR-0013): o que o produto faz de verdade, o que é simulado e o que fica de fora. Tudo sai do que já está documentado em [PRD](PRD.md), [docs/desenvolvimento.md](../desenvolvimento.md) e nos [ADRs](../adr/). O fluxo coberto pelo e2e (`pnpm e2e`) é o da seção "E2E" do guia de desenvolvimento. O roteiro da apresentação, que diz estas limitações em voz alta, é o [roteiro de demo](roteiro-de-demo.md).

## O que é real na demo

- Login por telefone com código, Pedido em três toques, trajeto gravado pelo mapa, Preço fechado calculado no servidor antes de pagar.
- Match pelo Guincheiro mais próximo dos três de teste (distância calculada no banco), oferta que chega por Realtime, aceite, Corrida por etapas e acompanhamento do Cliente sem recarregar.
- Fotos de estado dos dois lados, com hora do servidor, em Storage real.
- Sem Guincheiro: o Cliente escolhe entre tentar de novo e estornar.
- Cadastro de Frota autônoma, de veículo e de documentos do Guincheiro pelo app; convite de Guincheiro por telefone; vínculo Guincheiro × veículo com o bloqueio CNH × PBT (B até 3.500 kg, C ou superior acima).
- Homologação por item no Painel (aprova, recusa com motivo, trilha de auditoria imutável), vencimentos com alerta de 30 dias e Frota que só entra no Match depois de **ativada** pela operação.
- Recotação do preço quando o Pedido passa a outra Frota: o Cliente aprova ou desiste quando o preço sobe.

## Simulado

- **Pagamento é mock.** O adaptador do `GatewayPagamento` autoriza sempre e estorna; não há PSP, split nem Pix de verdade (QR code e "copia e cola" são ilustrativos). O PSP não foi escolhido (ADR-0004) e a liquidação com split é o RF12. A captura do pagamento ao fim da Corrida também não existe.
- **Mapbox sem verificação real.** O mapa, a busca e a rota estão implementados e testados com respostas imitadas, mas não foram conferidos contra o Mapbox real: qualidade dos endereços do DF (quadras, SQS/QNA, cidades-satélite), formato real das respostas e termos de armazenamento do endereço (resultado temporário x permanente). Se a qualidade for ruim, a escolha do provedor (ADR-0008) pode ser reaberta. No e2e, o Mapbox é respondido por fixtures.
- **Posições dos Guincheiros são fixas.** Os Guincheiros de teste do seed têm posição fixa e não há GPS ao vivo (RF09). O cadastro de Frota, veículo e documentos é pelo app, mas os arquivos que o seed "enviou" não existem no Storage: o Painel mostra "Documento indisponível" neles (os enviados ao vivo abrem normalmente).
- **Login com números de teste.** O código é sempre 123456 e nada é enviado; o canal real (WhatsApp, ADR-0010) não está ligado.
- **Termos de uso provisórios.** O aceite no cadastro urgente e o dos prestadores gravam a versão, mas o texto é provisório (issue #23).
- **Deploy online e Mapbox real dependem de contas do time.** A demo é local (Vercel, issue #2, fora); sem `VITE_MAPBOX_TOKEN` o mapa cai no esquemático do protótipo (issue #9).
- **Documentos de prestadores não passam por validação externa.** CNPJ, CNH, antecedentes, apólice e registro DETRAN são conferidos por uma pessoa da operação olhando o arquivo; só o dígito verificador de CPF, CNPJ, placa e RENAVAM e a regra CNH × PBT são automáticos.

## Aproximações no preço e no Match

- **Distância na cotação é em linha reta.** A distância do Guincheiro até o veículo é a linha reta (PostGIS) do mais próximo elegível; o km rebocado é o que o app calculou pela rota do Mapbox. A rota real no servidor depende do token de servidor do Mapbox.
- **Tabela de preços, piso e repasse são provisórios** (ADR-0009), a revisar com dados do piloto. Dentro da Frota cotada, quem aceita recebe pela própria distância e a plataforma absorve a diferença até o teto da Comissão; ao passar a outra Frota, o preço é refeito e, se subir, o Cliente aprova ou desiste (ADR-0013).
- **Recotação sem PSP real.** A autorização da diferença e o estorno ao refazer o preço, ao desistir ou ao vencer o prazo só atualizam `pagamentos` (o GatewayPagamento mock não guarda estado); com o PSP real (RF12) passam por uma Edge Function que chama o PSP.
- **Vencimento de documento: avisar não é reenviar.** Um item aprovado que está a até 30 dias de vencer **só avisa** (aba "Vencendo" no Painel, aviso nos apps); o botão de enviar documento novo só aparece quando o item **vence** (ou é recusado), porque o reenvio de item aprovado e ainda vigente poderia trocar o que a operação conferiu. Decisão de design da #49.
- **Homologação completa não ativa a Frota sozinha.** Com tudo aprovado e um vínculo ativo, a Frota fica "pronta para ativar" no Painel; quem ativa é a operação, com o botão "Ativar Frota". Ela volta a inativa sozinha se um item vence, é recusado ou reenviado, ou o vínculo cai.
- Um Guincheiro pode receber ofertas de Pedidos diferentes ao mesmo tempo; ao aceitar uma, as outras falham até expirarem.
- Estorno: se o Cliente pedir "tentar de novo" entre o estorno no provedor e o registro, o registro falha; com PSP real é preciso conciliar.
- Quando ninguém aceita, não há broadcast (RF08 é do Incremento 1) e o Painel não atribui: o Cliente decide entre tentar de novo e estornar.

## Fora do skeleton

- **Push e GPS no iOS ficam pendentes do spike #3.** O app do Guincheiro precisa ficar aberto para receber chamados; não promete avisar com a tela bloqueada, e não há rastreamento ao vivo (RF09) no mapa do Cliente, só a etapa.
- **Parte do Painel de operação ainda é protótipo.** Homologação, vencimentos, ativação da Frota e tabela de preços usam o banco de verdade. O Monitor de Corridas, os indicadores ("atendidos em menos de 30 min", Guincheiros disponíveis, nota média) e a Disputa mostram dados de exemplo (inclusive fotos); só a linha de Pedido aguardando aprovação de novo preço (ADR-0013) é real.
- **Cancelar o Pedido** (RN05, RF14) e a taxa de cancelamento: o botão aparece desabilitado.
- Avaliação mútua (RF13), histórico de Corridas (RF18) e histórico/ganhos do plantão do Guincheiro (dados de exemplo, só na sessão).
- Cadastro de Frota **empresa** pelo app (o app cadastra o autônomo; a empresa nasce pela operação, ou, no seed, pelo banco) e liquidação do repasse ao prestador (RF12, depende do PSP).
- **Push no iOS** (spike #3, ver acima): o app do Guincheiro precisa estar aberto para a oferta aparecer.
- Requisitos não funcionais de produção: 24x7, LGPD, auditoria, operação offline.

## Fotos de estado

- Opcionais (ADR-0011): encerrar sem elas exige confirmar o aviso. Não há proteção contra GPS ou galeria forjados (`capture` é só uma dica; o servidor não confere EXIF), nem confirmação de que o arquivo existe no bucket ou da duração do vídeo.
- A galeria do Cliente não é em tempo real: atualiza a cada mudança de etapa; não há notificação ao outro lado quando chega foto nova.
- Arquivo enviado cuja limpeza falhou pode ficar órfão no bucket.

## Ambiente e validação

- **Staging:** o e2e roda contra o Supabase local; "roda em staging" ainda depende de configurar o projeto (segredos do Vault do Match, deploy das quatro Edge Functions) e garantir que `PAGAMENTO_MOCK_RECUSA_TESTE` não exista lá.
- **Nada foi validado com usuários nem com Frota real** (CONTEXT, "Estado da validação"): disposição a pagar, Comissão de 20% e chegada em menos de 30 minutos seguem hipóteses.
- O e2e não cobre expiração de oferta por tempo, recusa pelo Guincheiro, os outros dois Guincheiros nem o Painel; esses caminhos têm teste de integração (`@guinchei/api`) e de banco.
