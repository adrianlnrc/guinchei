# Roteiro da apresentação em produção

Versão de [roteiro-de-demo.md](roteiro-de-demo.md) para o ambiente hospedado (Supabase `vxpjfrtdllmwwztnpglm` + 3 projetos na Vercel). Os passos, as falas e as limitações são os do roteiro local; aqui ficam o que muda: endereços, preparação, estado e plano B. Guia de infraestrutura: [producao.md](../producao.md).

**Código de login: sempre `123456`** (números de teste do Supabase Auth; nenhuma mensagem é enviada).

## Endereços e pessoas

| App | Endereço | Quem entra | Celular (com DDD) |
|---|---|---|---|
| Cliente | https://guinchei.vercel.app | Rafael Souza (Cliente) | `(61) 90000-0001` |
| Guincheiro | https://guinchei-guincheiro.vercel.app | Marcos Alves (Reboque Planalto, o mais próximo) | `(61) 90000-0002` |
| Guincheiro | idem, outro perfil do navegador | Helena Duarte (representante da Cerrado Guinchos) | `(61) 90000-0060` |
| Guincheiro | idem, outro perfil do navegador | Cláudia Brito (CNH C, Cerrado) | `(61) 90000-0061` |
| Painel | https://guinchei-painel.vercel.app | Operação Guinchei | `(61) 90000-0005` |

Cada app só aceita o papel dele: um número de Guincheiro no app Cliente é barrado com aviso e a sessão é encerrada. Use **um perfil (ou janela anônima) por pessoa**, porque a sessão fica no navegador, por endereço.

## O que mudou em relação ao roteiro local

- Os passos 1 a 9 do [roteiro local](roteiro-de-demo.md#roteiro-cerca-de-14-minutos) valem como estão, trocando `localhost:517x` pelos endereços acima.
- O **mapa** é o esquemático até o token do Mapbox ser configurado (próxima seção). Com o token, o passo 2 mostra mapa real, busca de endereço do DF e rota.
- O preço do dia aparece com os adicionais do calendário: noturno (20h às 6h, 15%) e feriado (20%). O exemplo do roteiro local (R$ 258,80) é de dia útil; em feriado o valor sobe.
- **Não existe `db reset` em produção.** Veja [Estado e ensaio](#estado-e-ensaio).
- O 401 do Match ("Só o backend chama esta função") foi corrigido na `ofertar-proximo` (versão 2 publicada); se a oferta não chegar ao Marcos, veja o [plano B](#plano-b).

## Configuração do mapa (Mapbox)

O mapa, a busca de endereço e a rota só existem no app **Cliente**. Guincheiro e Painel não usam Mapbox.

1. Crie a conta em mapbox.com e, em **Tokens**, **Create a token**.
2. Nome: `guinchei-web-prod`. Marque só os escopos **públicos** padrão (nenhum escopo secreto). Em **URL restrictions**, adicione `https://guinchei.vercel.app`. O token começa com `pk.`.
3. Na Vercel, projeto **guinchei** (o do Cliente): Settings, Environment Variables, nova variável `VITE_MAPBOX_TOKEN` com o token, nos ambientes Production e Preview. Depois, **Redeploy** do último deploy de produção (variável `VITE_*` só entra no build).
4. Confira em https://guinchei.vercel.app: no passo de local, o aviso "Mapa indisponível" some, o mapa é real, a busca por endereço do DF funciona e o trecho vira rota de carro (a distância rebocada passa a vir do Mapbox).

Observações: token público vai para o navegador (por isso a restrição de URL); nunca coloque token secreto (`sk.`) em variável `VITE_*`. O app só aceita origem e destino dentro do DF. A cotação no servidor continua usando linha reta até o Guincheiro (a rota real no servidor depende de um token de servidor, fora desta entrega). A qualidade dos endereços do DF no Mapbox real ainda não foi verificada: confira antes da apresentação com 3 ou 4 endereços (por exemplo "Eixo Monumental", "QNA 12 Taguatinga", "CLN 405") e anote na issue #9.

Sem token, tudo funciona com o mapa esquemático e o trecho do cenário (Eixo Monumental até Taguatinga Norte, 21,3 km), e isso deve ser dito em voz alta.

## Estado e ensaio

- Os passos 2 a 4 (pedido, pagamento, Match, corrida) só geram Pedidos. Podem ser ensaiados à vontade; para limpar, apague os Pedidos (os dados de teste somem em cascata, os cadastros ficam):

  ```sql
  truncate table public.pedidos cascade;
  ```

- Os passos 5 a 8 **consomem o estado da Cerrado Guinchos** (vínculos criados, Frota ativada) e as decisões no Painel. Não ensaie esses passos em produção, ou o ensaio não pode ser desfeito sem recarregar o banco (apagar o schema `public`, reaplicar as 28 migrations e os seeds `01`, `02`, `04` e `05`; leva uns 10 minutos com o Claude). Se precisar, ensaie num Supabase local (`pnpm supabase db reset`).
- Antes de entrar na sala: Marcos precisa estar **Disponível**; ele volta sozinho ao plantão ao fim de cada Corrida.

## Checagem de 10 minutos antes

- [ ] Os três endereços abrem, sem "App sem configuração do servidor".
- [ ] Login com `(61) 90000-0001` e código `123456` no Cliente entra no Pedido (se pedir cadastro, o número não está nos números de teste do Auth).
- [ ] Pedido de ponta a ponta até "Guincheiro aceitou" (limpe com o `truncate` acima depois).
- [ ] `VITE_MAPBOX_TOKEN` configurado, ou a fala sobre o mapa esquemático em mente.
- [ ] Um PDF e um JPG à mão para mostrar o envio de documento.
- [ ] Zoom do navegador e fonte grandes o bastante para a sala.

## Plano B

| Situação | O que fazer |
|---|---|
| "Receber código" falha | Provedor de telefone do Auth desligado, número fora da lista de números de teste, ou segundo envio em menos de 5 s. Auth, Sign In / Providers, Phone. |
| Entra no Cliente e cai no aviso "outro tipo de conta" | O número é de Guincheiro ou da operação. Use `0001` (Rafael) no Cliente. |
| Preço não aparece ("Não foi possível calcular o preço") | A Edge Function `cotar-pedido` caiu ou o Pedido está sem trajeto. Toque em **Tentar de novo**; veja os logs de função no Supabase. |
| Oferta não chega ao Marcos | Ele precisa estar **Disponível**. O Match varre a cada 5 s pelo pg_cron e chama `ofertar-proximo`; confira no SQL Editor `select status_code, content, created from net._http_response order by created desc limit 5;` (200 com `ofertado` é o esperado; 401 indica o segredo `match_chave_servico` do Vault errado). |
| Painel sem a Frota "pronta para ativar" | Falta vínculo ativo entre Guincheiro e veículo: volte ao passo 5. |
| Nada funciona a 5 minutos | Conte o fluxo pelo PRD e mostre o CI verde da `main` (pgTAP, integração e Playwright). |

## Testado em produção (2 de novembro de 2026)

Verificado contra o Supabase hospedado: login por número de teste, entrada do Cliente, abertura do Pedido, cotação pelo servidor (R$ 310,44 em feriado, tabela v1), pagamento mock autorizado, Pedido em `em_match`, oferta ao Marcos pelo Match (Edge Function `ofertar-proximo`), aceite, Corrida até `entregue` e Marcos de volta ao plantão. O aceite e as etapas da Corrida foram executados pelo banco com o papel do Marcos, não pelas telas do Guincheiro; as telas do Guincheiro, do Painel e o tempo real nelas ainda precisam do seu ensaio no navegador.
