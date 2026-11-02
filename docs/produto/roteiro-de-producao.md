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
- O **mapa** é real: o token do Mapbox está configurado no Cliente (veja [Configuração do mapa](#configuração-do-mapa-mapbox)). O passo 2 mostra mapa do DF, busca de endereço e rota. Se o mapa falhar na sala, o plano B é a fala sobre o mapa esquemático (veja o [plano B](#plano-b)).
- O preço do dia aparece com os adicionais do calendário: noturno (20h às 6h, 15%) e feriado (20%). O exemplo do roteiro local (R$ 258,80) é de dia útil; em feriado o valor sobe.
- **Não existe `db reset` em produção.** Veja [Estado e ensaio](#estado-e-ensaio).
- O 401 do Match ("Só o backend chama esta função") foi corrigido na `ofertar-proximo` (versão 2 publicada); se a oferta não chegar ao Marcos, veja o [plano B](#plano-b).

## Quem recebe o chamado (leia antes de ensaiar)

O Match oferece ao Guincheiro **disponível mais próximo da origem**, e a oferta vale 30 segundos. No banco hospedado, **só o Marcos está disponível**: Rita, Wagner, Paulo, Cláudia e Diego ficam indisponíveis (preparação de 2 de novembro de 2026), porque só o Marcos tem uma janela aberta na sala. Com isso o Marcos é sempre o primeiro, esteja a origem onde estiver.

- Ao ativar a Cerrado (passo 8 do roteiro), a Cláudia precisa ligar **Disponível** na janela dela; senão ela não recebe o chamado e a recotação não acontece.
- Se alguém ligar a disponibilidade de outra pessoa sem ter a janela aberta, o chamado vai para ela, expira em 30 s e o Cliente cai na **aprovação de novo preço** (o próximo candidato é de outra Frota e mais longe). Foi o que aconteceu num ensaio com a Rita: a tela "Outra empresa vai atender" apareceu e, depois do **Aprovar**, o chamado foi ao Marcos.
- Para o passo 3 (pedido simples), use a origem padrão "Pela sua localização" (Eixo Monumental, próx. Torre de TV) e troque só o destino. A origem pode ser qualquer lugar do DF, mas muda a distância e o preço.

## Configuração do mapa (Mapbox)

**Estado: configurado em 2 de novembro de 2026.** O token público `guinchei-web-prod` (conta Mapbox do dono) está em `VITE_MAPBOX_TOKEN` no projeto `guinchei` da Vercel, em Production e Preview, restrito a `https://guinchei.vercel.app`. Valor e escopos ficam no painel do Mapbox (Access tokens), não neste repositório. Para trocar o token, repita o passo 3 abaixo e faça Redeploy.

O mapa, a busca de endereço e a rota só existem no app **Cliente**. Guincheiro e Painel não usam Mapbox.

1. Crie a conta em mapbox.com e, em **Tokens**, **Create a token**.
2. Nome: `guinchei-web-prod`. Marque só os escopos **públicos** padrão (nenhum escopo secreto). Em **URL restrictions**, adicione `https://guinchei.vercel.app`. O token começa com `pk.`.
3. Na Vercel, projeto **guinchei** (o do Cliente): Settings, Environment Variables, nova variável `VITE_MAPBOX_TOKEN` com o token, nos ambientes Production e Preview. Depois, **Redeploy** do último deploy de produção (variável `VITE_*` só entra no build).
4. Confira em https://guinchei.vercel.app: no passo de local, o aviso "Mapa indisponível" some, o mapa é real, a busca por endereço do DF funciona e o trecho vira rota de carro (a distância rebocada passa a vir do Mapbox).

Observações: token público vai para o navegador (por isso a restrição de URL); nunca coloque token secreto (`sk.`) em variável `VITE_*`. O app só aceita origem e destino dentro do DF. A cotação no servidor continua usando linha reta até o Guincheiro (a rota real no servidor depende de um token de servidor, fora desta entrega). A qualidade dos endereços do DF no Mapbox real ainda não foi verificada: confira antes da apresentação com 3 ou 4 endereços (por exemplo "Eixo Monumental", "QNA 12 Taguatinga", "CLN 405") e anote na issue #9.

Sem token, tudo funciona com o mapa esquemático e o trecho do cenário (Eixo Monumental até Taguatinga Norte, 21,3 km), e isso deve ser dito em voz alta.

## Estado e ensaio

Não existe `db reset` em produção, mas há uma **recarga em segundos**: [`supabase/ferramentas/foto_da_demo.sql`](../../supabase/ferramentas/foto_da_demo.sql) cria `demo.salvar()` (tira uma foto de todas as tabelas de `public`) e `demo.restaurar()` (devolve o banco à foto). A foto do estado bom da demonstração (seeds carregados, nenhum Pedido de teste, só o Marcos disponível) já está tirada no Supabase hospedado.

No SQL Editor do Supabase, projeto Guinchei:

```sql
select demo.restaurar();   -- volta ao estado bom; leva poucos segundos
```

- Pode ensaiar tudo, inclusive os passos 5 a 8 (Frota Cerrado, vínculos, ativação, recotação): ao fim, `select demo.restaurar();` desfaz tudo. Faça isso também **antes de entrar na sala**.
- Para atualizar a foto (por exemplo, depois de mudar a disponibilidade de alguém de propósito): ajuste o estado, confira, e rode `select demo.salvar();`.
- A recarga não mexe em usuários e sessões do Auth, arquivos do Storage, segredos do Vault, jobs do pg_cron nem Edge Functions. Um número cadastrado durante a demonstração (como o autônomo `0008`) continua no Auth e volta como pessoa sem cadastro. Uma janela do navegador que estava aberta com o estado antigo deve ser recarregada (F5); se mostrar tela vazia, saia e entre de novo.
- Se só quiser limpar Pedidos, sem tocar em mais nada: `truncate table public.pedidos cascade;`.
- Se mudar o schema (uma migração nova), tire a foto de novo depois de aplicá-la; uma foto antiga com colunas diferentes é restaurada só nas colunas em comum.
- Antes de entrar na sala: Marcos precisa estar **Disponível**; ele volta sozinho ao plantão ao fim de cada Corrida.

## Checagem de 10 minutos antes

- [ ] Os três endereços abrem, sem "App sem configuração do servidor".
- [ ] Login com `(61) 90000-0001` e código `123456` no Cliente entra no Pedido (se pedir cadastro, o número não está nos números de teste do Auth).
- [ ] Pedido de ponta a ponta até "Guincheiro aceitou" (limpe com o `truncate` acima depois).
- [ ] Mapa real no passo de local de https://guinchei.vercel.app (sem o aviso "Mapa indisponível"), com 3 ou 4 endereços do DF testados na busca.
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
| Mapa não carrega, busca sem resultado ou rota falha | Token do Mapbox recusado (URL fora da restrição, por exemplo um preview) ou limite da conta. Abra `https://guinchei.vercel.app` (o endereço de produção). Se persistir, remova `VITE_MAPBOX_TOKEN` da Vercel e faça Redeploy: o app volta ao mapa esquemático e ao trecho do cenário. |
| Nada funciona a 5 minutos | Conte o fluxo pelo PRD e mostre o CI verde da `main` (pgTAP, integração e Playwright). |

## Testado nas telas em produção (2 de novembro de 2026)

Passado pelo navegador contra o Supabase e a Vercel de produção: Cliente (login, três perguntas, mapa real, busca de endereço, preço fechado, pagamento Pix mock, aprovação de novo preço, acompanhamento até "Entregue"), Guincheiro (plantão, chamado, Corrida até a tela de repasse: R$ 281,36 menos 20% de comissão, R$ 225,09 para a Frota) e o estorno automático de um Pedido cujo novo preço não foi aprovado a tempo. **Não passaram pelas telas:** Painel (Monitor, Homologação, ativação da Frota) e o fluxo da Frota Cerrado (passos 5 a 8 do roteiro).

## Testado no servidor em produção (2 de novembro de 2026)

Verificado contra o Supabase hospedado: login por número de teste, entrada do Cliente, abertura do Pedido, cotação pelo servidor (R$ 310,44 em feriado, tabela v1), pagamento mock autorizado, Pedido em `em_match`, oferta ao Marcos pelo Match (Edge Function `ofertar-proximo`), aceite, Corrida até `entregue` e Marcos de volta ao plantão. O aceite e as etapas da Corrida foram executados pelo banco com o papel do Marcos, não pelas telas do Guincheiro; as telas do Guincheiro, do Painel e o tempo real nelas ainda precisam do seu ensaio no navegador.
