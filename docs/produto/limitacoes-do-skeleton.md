# Limitações conhecidas do walking skeleton

Lista para a demo (issue #15): o que o skeleton faz de verdade, o que é simulado e o que fica de fora. Tudo sai do que já está documentado em [PRD](PRD.md), [docs/desenvolvimento.md](../desenvolvimento.md) e nos [ADRs](../adr/). O fluxo coberto pelo e2e (`pnpm e2e`) é o da seção "E2E" do guia de desenvolvimento.

## O que é real na demo

- Login por telefone com código, Pedido em três toques, trajeto gravado pelo mapa, Preço fechado calculado no servidor antes de pagar.
- Match pelo Guincheiro mais próximo dos três de teste (distância calculada no banco), oferta que chega por Realtime, aceite, Corrida por etapas e acompanhamento do Cliente sem recarregar.
- Fotos de estado dos dois lados, com hora do servidor, em Storage real.
- Sem Guincheiro: o Cliente escolhe entre tentar de novo e estornar.

## Simulado

- **Pagamento é mock.** O adaptador do `GatewayPagamento` autoriza sempre e estorna; não há PSP, split nem Pix de verdade (QR code e "copia e cola" são ilustrativos). O PSP não foi escolhido (ADR-0004) e a liquidação com split é o RF12. A captura do pagamento ao fim da Corrida também não existe.
- **Mapbox sem verificação real.** O mapa, a busca e a rota estão implementados e testados com respostas imitadas, mas não foram conferidos contra o Mapbox real: qualidade dos endereços do DF (quadras, SQS/QNA, cidades-satélite), formato real das respostas e termos de armazenamento do endereço (resultado temporário x permanente). Se a qualidade for ruim, a escolha do provedor (ADR-0008) pode ser reaberta. No e2e, o Mapbox é respondido por fixtures.
- **Guincheiros e posições são do seed.** Três Guincheiros de teste com posição fixa, em duas Frotas do seed; o Guincheiro não se cadastra pelo app e não há GPS ao vivo.
- **Login com números de teste.** O código é sempre 123456 e nada é enviado; o canal real (WhatsApp, ADR-0010) não está ligado.
- **Termos de uso provisórios.** O aceite no cadastro urgente grava a versão, mas o texto é provisório (issue #23).

## Aproximações no preço e no Match

- **Distância na cotação é em linha reta.** A distância do Guincheiro até o veículo é a linha reta (PostGIS) do mais próximo elegível; o km rebocado é o que o app calculou pela rota do Mapbox. A rota real no servidor depende do token de servidor do Mapbox.
- **Tabela de preços, piso e repasse são provisórios** (ADR-0009), a revisar com dados do piloto. Quem aceita recebe pela própria distância e a plataforma absorve a diferença até o teto da Comissão.
- Um Guincheiro pode receber ofertas de Pedidos diferentes ao mesmo tempo; ao aceitar uma, as outras falham até expirarem.
- Estorno: se o Cliente pedir "tentar de novo" entre o estorno no provedor e o registro, o registro falha; com PSP real é preciso conciliar.
- Quando ninguém aceita, não há broadcast (RF08 é do Incremento 1) e o Painel não atribui: o Cliente decide entre tentar de novo e estornar.

## Fora do skeleton

- **Push e GPS no iOS ficam pendentes do spike #3.** O app do Guincheiro precisa ficar aberto para receber chamados; não promete avisar com a tela bloqueada, e não há rastreamento ao vivo (RF09) no mapa do Cliente, só a etapa.
- **Painel de operação ainda é protótipo.** Mostra dados de exemplo (inclusive fotos; o Monitor mostra Pedidos no Match e sem Guincheiro só para leitura); a RLS já permite à operação ler tudo.
- **Cancelar o Pedido** (RN05, RF14) e a taxa de cancelamento: o botão aparece desabilitado.
- Avaliação mútua (RF13), histórico de Corridas (RF18), homologação de Frotas (RF02) e histórico/ganhos do plantão do Guincheiro (dados de exemplo, só na sessão).
- Cadastro de prestadores, empresa e autônomo (ADR-0012): Incremento 1.
- Requisitos não funcionais de produção: 24x7, LGPD, auditoria, operação offline.

## Fotos de estado

- Opcionais (ADR-0011): encerrar sem elas exige confirmar o aviso. Não há proteção contra GPS ou galeria forjados (`capture` é só uma dica; o servidor não confere EXIF), nem confirmação de que o arquivo existe no bucket ou da duração do vídeo.
- A galeria do Cliente não é em tempo real: atualiza a cada mudança de etapa; não há notificação ao outro lado quando chega foto nova.
- Arquivo enviado cuja limpeza falhou pode ficar órfão no bucket.

## Ambiente e validação

- **Staging:** o e2e roda contra o Supabase local; "roda em staging" ainda depende de configurar o projeto (segredos do Vault do Match, deploy das quatro Edge Functions) e garantir que `PAGAMENTO_MOCK_RECUSA_TESTE` não exista lá.
- **Nada foi validado com usuários nem com Frota real** (CONTEXT, "Estado da validação"): disposição a pagar, Comissão de 20% e chegada em menos de 30 minutos seguem hipóteses.
- O e2e não cobre expiração de oferta por tempo, recusa pelo Guincheiro, os outros dois Guincheiros nem o Painel; esses caminhos têm teste de integração (`@guinchei/api`) e de banco.
