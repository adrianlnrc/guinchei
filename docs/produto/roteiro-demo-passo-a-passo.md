# Roteiro da demo, passo a passo (produção)

Versão enxuta para apresentar o Guinchei em produção, **testada pelas telas em 19/11/2026**. Cerca de 15 minutos. O roteiro completo, com as falas e as limitações, está em [roteiro-apresentacao.md](roteiro-apresentacao.md).

**Código de login: sempre `123456`.** Os números são de teste do Supabase Auth; nenhuma mensagem é enviada.

## Antes de entrar na sala

1. No SQL Editor do Supabase (projeto Guinchei), volte o banco ao estado bom:

   ```sql
   select demo.restaurar();
   ```

   Estado esperado: 0 Pedidos, 0 avaliações, só o **Marcos** disponível, Cerrado Guinchos inativa e 3 vínculos (os do seed).

2. Abra **5 janelas**, uma por pessoa (perfil ou janela anônima), porque a sessão fica no navegador, por endereço. Entre em cada uma com o código `123456`.

| Janela | Endereço | Quem | Celular |
|---|---|---|---|
| 1 | https://guinchei.vercel.app | Rafael Souza (Cliente) | `(61) 90000-0001` |
| 2 | https://guinchei-guincheiro.vercel.app | Marcos Alves (Reboque Planalto) | `(61) 90000-0002` |
| 3 | https://guinchei-painel.vercel.app | Operação Guinchei | `(61) 90000-0005` |
| 4 | https://guinchei-guincheiro.vercel.app | Helena Duarte (representante da Cerrado) | `(61) 90000-0060` |
| 5 | https://guinchei-guincheiro.vercel.app | Cláudia Brito (CNH C, Cerrado) | `(61) 90000-0061` |

3. Confira: o Marcos está **Disponível**; o mapa carrega (sem "Mapa indisponível"); zoom e fonte grandes; um PDF e um JPG à mão.

## Cuidados que valem na sala

- **Espere cerca de 3 segundos entre tocar em "Receber código" e digitar o código.**
- **Não toque no interruptor de plantão logo ao abrir a tela.** Espere a tela carregar. Se tocar no instante em que ela abre, a tela pode mostrar "Fora do plantão" enquanto o banco guarda "disponível", e a pessoa perde o chamado.
- Cada app só aceita o papel dele: número de Guincheiro no app Cliente é barrado.
- A oferta ao Guincheiro vale **30 segundos**.
- Se algo travar: `select demo.restaurar();` e F5 nas janelas.

## Roteiro

### 1. Abertura (1 min)

Diga: app estilo Uber para guincho no DF; o Cliente vê o **Preço fechado antes de pagar**; o guincho mais próximo é chamado automaticamente; só entra quem a operação homologou. Roda em produção, com dados fictícios; o que é simulado, eu aviso.

### 2. Cliente pede e vê o Preço fechado (2 min), janela 1

1. Toque em **Pedir guincho agora**, entre com `(61) 90000-0001` e o código.
2. No Início, toque em **Pedir guincho**.
3. Três toques: **Carro de passeio**, **Parou e não liga**, **Sim**. Depois, **Confirmar local no mapa**.
4. **Deixe a origem como está** (dela depende quem é o guincho mais próximo). Busque o destino (por exemplo "QNA 12 Taguatinga") e escolha a sugestão. Aparecem a rota e a distância (23,9 km nos testes).
5. Toque em **Ver preço fechado**.

**Esperado (nos testes):** R$ 279,37 = taxa base R$ 110,00 + deslocamento (5,2 km) R$ 25,85 + reboque (23,9 km) R$ 143,52. "Guincho mais próximo a 5,2 km". Os valores variam com a origem, o dia e a hora (noturno 20h às 6h: +15%; feriado: +20%).

**Dizer:** o preço é calculado no **servidor**, com tabela versionada; é o mesmo que será gravado e autorizado.

### 3. Pagamento e Match (1 min), janelas 1 e 2

1. Janela 2: entre como Marcos; ele já aparece **Disponível**.
2. Janela 1: **Confirmar e pagar**, depois **Copiar código Pix**. Aparece "Chamando o guincho mais próximo".
3. Janela 2: **Novo chamado** aparece sozinho, com contagem de 30 s e "Você recebe R$ 223,50".

**Dizer:** o pagamento é **mock** (sem PSP; o Pix é ilustrativo). Só o Guincheiro mais próximo recebe a oferta, em tempo real.

### 4. Corrida do aceite à entrega (2 min), janelas 2 e 1 lado a lado

1. Janela 2: **Aceitar Corrida**. Janela 1: "Guincheiro aceitou, saindo em instantes".
2. Janela 2: **Saí para o local**, depois **Cheguei** (Cliente: "O guincho chegou ao seu veículo").
3. Opcional, 20 s: fotos de estado (Cliente em **Registrar fotos**; Guincheiro em **Fotos de estado**). São opcionais e recomendadas.
4. Janela 2: **Carreguei**, depois **Entreguei**. Se pedir fotos, **Seguir sem fotos**.

**Esperado:** repasse do Guincheiro: preço R$ 279,37, comissão de 20% (− R$ 55,87), **R$ 223,50** para a Frota em até 1 dia útil. Cliente: "Entregue. Seu veículo chegou ao destino."

### 4b. Cliente avalia o atendimento (1 min), janela 1

1. Na tela "Entregue", toque em **Avaliar o atendimento**.
2. Escolha as estrelas, escreva um comentário (até 280 caracteres) e toque em **Enviar avaliação**. O app volta ao Início.
3. Aba **Corridas**: abra a Corrida. Aparecem o preço decomposto, o Marcos, a linha do tempo e a avaliação, só para leitura ("Avaliações não podem ser editadas").

### 5. Prestador: vínculo entre Guincheiro e veículo (3 min), janela 4

1. Entre como Helena. Cai em **Minha Frota**: Cerrado Guinchos, "Em análise pela operação" e "Falta 1 item para ativar a Frota".
2. Toque em **Vincular Guincheiros a veículos**.
3. **Diego Ferraz** (CNH B): escolha a plataforma `CRB-4G56 · 4.200 kg`. O app **bloqueia**: "CNH B não cobre guincho de 4.200 kg: exige categoria C ou superior", com o que fazer. Troque para a lança `CRB-5H67 · 3.500 kg`: aceito. **Confirmar vínculo**.
4. **Cláudia Brito** (CNH C): plataforma `CRB-4G56`, **Confirmar vínculo**.
5. Volte a **Minha Frota**: "Tudo aprovado. Falta só a operação ativar a Frota."

**Dizer:** regra CNH × PBT (B até 3.500 kg; acima disso, C ou superior). O app avisa antes e o banco recusa mesmo se alguém burlar o app. Mesmo com tudo aprovado, **a Frota não se ativa sozinha**.

### 6. Cláudia ainda não pode receber chamado (1 min), janela 5

Entre como Cláudia e toque no interruptor de disponibilidade: **"Plantão bloqueado até a homologação"**, com o motivo ("A Frota Cerrado Guinchos ainda não está ativa...").

### 7. Painel: homologação e ativação (2 min), janela 3

1. Entre como Operação. **Monitor de Corridas** (dados reais, atualiza a cada 5 s): o Pedido entregue, a nota média e a avaliação enviada.
2. **Homologação**: **Guincho Capital** (itens pendentes) e **Cerrado Guinchos** com **Pronta para ativar**.
3. Abra a Guincho Capital: **Ver documento** (aparece "Documento indisponível": os arquivos do seed não existem no Storage). **Recusar** um item com motivo (por exemplo "Apólice sem a plataforma como cossegurada") e **Confirmar recusa**. **Aprovar** outro item.
4. Abra a **Cerrado Guinchos**: "Tudo aprovado: pode ativar". Toque em **Ativar Frota**.

**Dizer:** a operação aprova ou recusa item por item, sempre com motivo na recusa, e cada decisão fica numa trilha de auditoria.

### 8. Recusa e reencaminhamento do Pedido (3 min), janelas 5, 1, 3 e 2

1. Janela 5 (Cláudia): atualize a tela, **espere ela carregar** e ligue **Disponível**.
2. Janela 1: novo Pedido (mesmos três toques, mesma origem, mesmo destino) e **Ver preço fechado**. O preço **baixa** e o guincho mais próximo passa a ser a Cláudia.
   **Esperado:** R$ 263,32 (deslocamento 2,0 km, R$ 9,80).
3. Pague. Janela 5: **Novo chamado** (R$ 263,32; você recebe R$ 210,66); toque em **Recusar**.
4. O próximo candidato é o Marcos, de **outra Frota** e mais longe. Janela 1 mostra **"Outra empresa vai atender"**: preço anterior R$ 263,32, novo preço R$ 279,37, diferença R$ 16,05, com **Aprovar R$ 279,37** e **Desistir e estornar**.
   Janela 3 (Painel): o Monitor mostra o Pedido **"Aguardando aprovação do Cliente"** com os dois valores.
5. Janela 1: **Aprovar**. Janela 2: **Novo chamado** para o Marcos (R$ 223,50).

**Desfecho A, o Marcos aceita:** janela 2, **Aceitar Corrida**. Janela 1: "Guincheiro aceitou, saindo em instantes", com Marcos Alves e Reboque Planalto. A Corrida segue como no passo 4.

**Desfecho B, ninguém mais aceita:** janela 2, **Recusar**. Janela 1: **"Nenhum Guincheiro aceitou"**: "Seu pagamento continua reservado e o preço segue travado: tente de novo ou estorne o valor", com **Tentar de novo** e **Estornar o pagamento**.

**Dizer:** o Cliente nunca é surpreendido: se o Pedido passa a outra empresa e o preço **sobe**, a oferta pausa até ele aprovar; sem resposta no prazo, vale como desistência, com estorno. Se o preço cair, segue direto, com aviso. Se for a mesma Frota, nada muda.

### 9. Fechamento e limitações (1 min)

Diga em voz alta:

1. **Pagamento é mock.** Não há PSP nem split; o Pix é ilustrativo.
2. **Sem push nem GPS em segundo plano.** O app do Guincheiro precisa estar aberto para a oferta aparecer.
3. Login com números de teste e código fixo; o WhatsApp real não está ligado.
4. Posição dos Guincheiros fixa (do seed); a distância até o veículo é em linha reta.
5. O Painel é em parte protótipo: Homologação e Ativação são reais; o Monitor lê o banco; a Disputa mostra dados de exemplo.
6. Só o lado Cliente → Guincheiro da avaliação existe.
7. Tabela de preços, comissão e tempo de chegada são hipóteses, **não validadas com usuários**.

Feche com: "O que é real hoje: preço no servidor, Match por proximidade e por homologação, tempo real, avaliação, cadastro e homologação de prestadores, e um Monitor com dados reais. O que falta está dito."

## Plano B

| Situação | O que fazer |
|---|---|
| Algo ficou estranho ou o ensaio sujou o estado | `select demo.restaurar();` e F5 nas janelas. Se ficarem vazias, saia e entre de novo. |
| "Receber código" falha, ou "Não foi possível entrar" | Espere uns 5 s entre pedir e digitar o código; um segundo envio em menos de 5 s falha. |
| Entra no Cliente e cai em "outro tipo de conta" | O número é de Guincheiro ou da operação. Use `0001` no Cliente. |
| Preço não aparece | **Tentar de novo**. Se persistir, veja os logs da função `cotar-pedido`. |
| A oferta não chega ao Marcos | Ele precisa estar **Disponível** e com o app aberto. Se outro Guincheiro mais perto estiver disponível, o chamado vai para ele e expira em 30 s. |
| Tela de vínculos com "Não foi possível ler os vínculos" | Falha de rede passageira. Volte e entre de novo na tela. |
| Mapa não carrega | Use o endereço de produção (`https://guinchei.vercel.app`): o token do Mapbox é restrito a ele. |
| Painel sem a Cerrado "pronta para ativar" | Falta vínculo ativo entre Guincheiro e veículo: volte ao passo 5. |
| Nada funciona a 5 minutos | Conte o fluxo pelo [PRD](PRD.md) e mostre o CI verde da `main`. |

## Depois da apresentação

`select demo.restaurar();` deixa o banco pronto para a próxima. Nada precisa ser desligado.

> **Lembrete:** o projeto Supabase gratuito pode ser pausado por inatividade. Se ficar `INACTIVE`, restaure-o no painel do Supabase antes de apresentar. O plano gratuito permite 2 projetos ativos; o `calendario` é o outro.
