# Roteiro da apresentação (produção)

Roteiro único e completo para apresentar o Guinchei **em produção**: Supabase hospedado e três apps na Vercel, com dados fictícios. Cerca de 15 minutos. Bastidores (infraestrutura, mapa, plano B): [roteiro-de-producao.md](roteiro-de-producao.md) e [producao.md](../producao.md). Versão local, com Supabase no notebook: [roteiro-de-demo.md](roteiro-de-demo.md).

**Código de login: sempre `123456`.** Os números são de teste do Supabase Auth; nenhuma mensagem é enviada.

## Antes de entrar na sala

1. **Volte o banco ao estado bom** (SQL Editor do Supabase, projeto Guinchei):

   ```sql
   select demo.restaurar();
   ```

   Leva poucos segundos e desfaz qualquer ensaio, inclusive a ativação da Cerrado e os vínculos. Detalhes e limites: [Estado e ensaio](roteiro-de-producao.md#estado-e-ensaio).

2. **Abra as janelas.** A sessão fica no navegador, por endereço: use **um perfil (ou janela anônima) por pessoa** e dê F5 em janelas abertas antes do ensaio.

| Janela | Endereço | Quem | Celular (com DDD) |
|---|---|---|---|
| 1 | https://guinchei.vercel.app | Rafael Souza, Cliente | `(61) 90000-0001` |
| 2 | https://guinchei-guincheiro.vercel.app | Marcos Alves, Reboque Planalto, o mais próximo | `(61) 90000-0002` |
| 3 | https://guinchei-painel.vercel.app | Operação Guinchei | `(61) 90000-0005` |
| 4 | https://guinchei-guincheiro.vercel.app (outro perfil) | Helena Duarte, representante da Cerrado Guinchos | `(61) 90000-0060` |
| 5 | https://guinchei-guincheiro.vercel.app (outro perfil) | Cláudia Brito, Guincheira da Cerrado (CNH C) | `(61) 90000-0061` |

Cada app só aceita o papel dele: um número de Guincheiro no app Cliente é barrado com aviso e a sessão é encerrada. Outros números: Diego Ferraz `0062` (CNH B, Cerrado), Wagner `0003`, Rita `0004`, Paulo `0007`.

3. **Confira** (10 minutos antes):
   - [ ] Os três endereços abrem, sem "App sem configuração do servidor".
   - [ ] O Marcos está **Disponível**. Ele é o **único** Guincheiro disponível no banco: Rita, Wagner, Paulo, Cláudia e Diego ficam indisponíveis de propósito, porque só o Marcos tem janela aberta na sala. A Cláudia liga o próprio **Disponível** no passo 8.
   - [ ] Mapa real no passo de local (sem o aviso "Mapa indisponível") e busca de endereço funcionando, com 3 ou 4 endereços do DF.
   - [ ] Um PDF e um JPG à mão (envio de documento, se sobrar tempo).
   - [ ] Zoom do navegador e fonte grandes o bastante para a sala.
   - [ ] O relógio: de dia útil o preço é o base; entre 20h e 6h ganha 15% (noturno) e em feriado, 20%. Os valores variam com o dia e a hora.

## Roteiro

Cada passo diz **onde**, **o que fazer** e **o que dizer**. Fale o que está em "Dizer" com suas palavras.

### 1. Abertura (1 min)

**Dizer:** "O Guinchei é um app estilo Uber para guincho no Distrito Federal. O Cliente vê o **Preço fechado antes de pagar**, o guincho mais próximo é chamado automaticamente, e só entra na plataforma quem a operação homologou. O que vão ver roda **em produção**, na nuvem, com dados fictícios; o que é simulado eu aviso quando aparecer, e no fim resumo tudo."

### 2. Cliente pede e vê o Preço fechado (2 min) — janela 1

1. Abrir o app do Cliente, tocar em **Pedir guincho agora**, entrar com `(61) 90000-0001` e o código `123456`. O login leva ao **Início** ("Olá, Rafael", com a barra Início, Corridas e Perfil); tocar em **Pedir guincho**.
2. Em **três toques**: **Carro de passeio**, **Parou e não liga**, **Sim** (as 4 rodas giram). Em seguida **Confirmar local no mapa**.
3. Tela de origem e destino, com **mapa real do DF**. A origem é "Pela sua localização" (Eixo Monumental, próx. Torre de TV): **deixe a origem como está**, porque dela depende quem é o guincho mais próximo. Defina o destino **buscando um endereço** (por exemplo "Taguatinga" ou "QNA 12 Taguatinga") ou marcando o ponto no mapa. Aparecem a rota e a distância. Tocar em **Ver preço fechado**.
4. Tela **Preço fechado**: mostrar o valor em destaque, a decomposição (taxa base R$ 110, deslocamento até o veículo, reboque por km, adicionais de feriado ou noturno) e "Guincho mais próximo a cerca de 4,2 km".

**Dizer:** "Três toques e o preço aparece antes de qualquer cobrança. Esse valor é calculado no **servidor**, não no app, com a tabela de preços versionada, e é o mesmo que será gravado e autorizado. O mapa, a busca e a rota são do Mapbox; a distância até o guincho é em linha reta, calculada no banco."

### 3. Pagamento e Match (1 min) — janelas 1 e 2

1. Janela 2: entrar como Marcos, `(61) 90000-0002`. Deixar o plantão **Disponível**.
2. Janela 1: **Confirmar e pagar**, **Copiar código Pix**. O Cliente cai no acompanhamento, "Chamando o guincho mais próximo".
3. Janela 2: aparece **Novo chamado** sozinho, sem recarregar.

**Dizer:** "O pagamento é um **mock**: não há PSP ainda, o código Pix é ilustrativo. O Pedido entrou no Match e só o Guincheiro mais próximo, o Marcos, recebeu a oferta, em tempo real. Ele tem 30 segundos para aceitar."

### 4. Corrida do aceite à entrega (2 min) — janelas 2 e 1, lado a lado

1. Janela 2: **Aceitar Corrida**. Janela 1 muda para "Guincheiro aceitou, saindo em instantes" com o nome do Marcos.
2. Janela 2: **Saí para o local** (Cliente vê "Guincho a caminho"), **Cheguei**.
3. Opcional, 20 s: Cliente em **Registrar fotos**; Guincheiro em **Fotos de estado**. Mostrar o aviso (e não bloqueio) "Registrar fotos protege você se houver reclamação de avaria".
4. Janela 2: **Carreguei**, **Entreguei** (se pedir, **Seguir sem fotos**). A tela seguinte mostra o repasse: preço, menos a comissão de 20%, e quando cai na conta da Frota. Janela 1: "Entregue. Seu veículo chegou ao destino".

**Dizer:** "Cada etapa chega ao Cliente sem recarregar a página. As fotos de estado são opcionais, mas recomendadas: servem de prova numa disputa por avaria. O Guincheiro vê o repasse e volta sozinho ao plantão."

### 4b. Cliente avalia o atendimento (1 min) — janela 1

1. Na tela "Entregue", tocar em **Avaliar o atendimento**: "Como foi o atendimento?". Escolher as estrelas, escrever um comentário curto (até 280 caracteres) e tocar em **Enviar avaliação**. O app volta ao **Início**, que não pede mais a avaliação.
2. Na aba **Corridas**, abrir a Corrida: preço decomposto, Marcos e a Reboque Planalto, linha do tempo e a avaliação, agora só para leitura.
3. Opcional: **Agora não** em vez de enviar leva ao Início, onde o cartão **Avalie a corrida** continua até a nota ser dada. No Painel, o indicador **Nota média · 7 dias** passa a mostrar a nota.

**Dizer:** "Ao fim da Corrida o Cliente avalia o Guincheiro de 1 a 5. É uma por Corrida e não se edita, porque entra como prova numa disputa. A nota média da operação vem dessas avaliações. O lado inverso, o Guincheiro avaliar o Cliente, ainda não existe no app."

### 5. Prestador: vínculo entre Guincheiro e veículo (3 min) — janela 4

1. Entrar como Helena, `(61) 90000-0060`. Cai em **Minha Frota**: Cerrado Guinchos, "Em análise pela operação" e a caixa "Falta 1 item para ativar a Frota: Nenhum Guincheiro homologado vinculado a um veículo homologado".
2. Tocar em **Vincular Guincheiros a veículos** (a regra aparece no texto: B até 3.500 kg, C ou superior acima, CTB art. 143).
3. **Diego Ferraz** (CNH B · aprovada): escolher a plataforma `CRB-4G56 · 4.200 kg`. O app **bloqueia** com a explicação e o que fazer ("Vincule a este veículo um Guincheiro com CNH C ou superior, ou escolha para Diego Ferraz um veículo de até 3.500 kg"). Trocar para a lança `CRB-5H67 · 3.500 kg`: aceito, **Confirmar vínculo**.
4. **Cláudia Brito** (CNH C · aprovada): escolher a plataforma de 4.200 kg e **Confirmar vínculo**.
5. Voltar a **Minha Frota**: "Tudo aprovado. Falta só a operação ativar a Frota."

**Dizer:** "Aqui está a regra CNH × PBT: CNH B só vale até 3.500 kg, acima disso exige C. O app avisa **antes** e o banco recusa mesmo se alguém burlar o app. Quem responde pela Frota é a representante; o Guincheiro dirige um veículo. Mesmo com tudo aprovado, **a Frota não se ativa sozinha**: ativar é uma decisão da operação."

### 6. Cláudia ainda não pode receber chamado (1 min) — janela 5

1. Entrar como Cláudia, `(61) 90000-0061`. Tocar no interruptor "Disponível para chamados": **Plantão bloqueado até a homologação**, com a lista do que falta ("A Frota Cerrado Guinchos ainda não está ativa...").

**Dizer:** "O plantão só abre quando a Frota está ativa, os documentos estão vigentes e o Guincheiro tem veículo aprovado. O motivo vem do banco, em palavras."

### 7. Painel: homologação e ativação (2 min) — janela 3

1. Entrar como Operação, `(61) 90000-0005`. Mostrar o **Monitor de Corridas** (dados reais, atualizados a cada 5 s: o Pedido que acabou de ser entregue, os indicadores e a nota média). Abrir **Homologação**: **Guincho Capital** (itens "Em análise") e **Cerrado Guinchos** com a etiqueta **Pronta para ativar**.
2. Abrir a Guincho Capital: item por item, **Ver documento** (os arquivos do seed não existem no Storage: aparece "Documento indisponível"), **Recusar** com motivo (por exemplo "Apólice sem a plataforma como cossegurada") e **Aprovar** outro. A lista "O que falta para ativar a Frota" mostra que ainda faltam fotos, certidão, selfie e vínculo.
3. Abrir a **Cerrado Guinchos**: "Tudo aprovado: pode ativar". Tocar em **Ativar Frota**.
4. Opcional: aba **Vencendo** (vazia no seed). Para mostrar um item vencendo, antes da sala, no SQL Editor:
   `update public.itens_homologacao set validade = current_date + 10 where frota_id = 'f0000000-0000-4000-8000-000000000001' and tipo = 'apolice_rc';` e, depois, `select demo.restaurar();`.

**Dizer:** "A operação aprova ou recusa **item por item**, sempre com motivo na recusa, e cada decisão fica numa trilha de auditoria que ninguém consegue apagar. Só quando a regra vale a Frota pode ser ativada, e ela volta a inativa sozinha se um documento vence ou o vínculo cai. Documento **vencendo** só avisa; o reenvio abre quando ele **vence** (ou é recusado)."

### 8. O prestador recém-ativado recebe oferta; recotação (2 min) — janelas 5, 1 e 3

1. Janela 5 (Cláudia): atualizar a tela; o interruptor agora liga. Ligar **Disponível**. (Esse é o único Guincheiro que **você** liga: o Marcos já está disponível.)
2. Janela 1: abrir um novo Pedido (pelo **Pedir guincho** do Início; mesmos três toques, mesma origem do passo 2) e tocar em **Ver preço fechado**. O preço **baixou** (só a distância até o veículo mudou) e o guincho mais próximo é a Cláudia, a cerca de 1,4 km: ela, recém-homologada, é agora a Frota cotada.
3. Pagar. Janela 5: **Novo chamado**; tocar em **Recusar**.
4. O próximo candidato é o Marcos, de **outra Frota** e mais longe. O Cliente (janela 1) vê "Outra empresa vai atender": preço anterior, novo preço, diferença e a decomposição, com **Aprovar** e **Desistir e estornar**. Na janela 3, o **Monitor de Corridas** mostra o Pedido "Aguardando aprovação do Cliente" com os dois valores.
5. Janela 1: **Aprovar**. A oferta vai ao Marcos (janela 2).

**Dizer:** "O Cliente nunca é surpreendido: se o Pedido passa a outra empresa e o preço **sobe**, a oferta pausa até ele aprovar a diferença; sem resposta no prazo vale como desistência, com estorno. Se o preço **cair**, segue direto, com aviso. Se for a mesma Frota, nada muda."

### 9. Fechamento e limitações (1 min)

**Dizer** (leia ao menos os primeiros itens da lista abaixo) e encerre com: "O que é real hoje: preço no servidor, Match por proximidade e por homologação, tempo real, fotos com hora do servidor, avaliação do atendimento, cadastro e homologação de prestadores, e um Monitor de operação com dados reais. O que falta está dito. Nada disso foi validado com usuários: as hipóteses de preço, comissão e tempo de chegada continuam hipóteses."

Se sobrar tempo: o Cliente sem Guincheiro disponível pode **Tentar de novo** ou **Estornar o pagamento** (desligue o plantão de todos e peça um Pedido novo); o autônomo novo (`0008`) cadastrando a Frota, em 5 etapas, é o caminho completo de entrada de um prestador, mas leva mais de 5 minutos e envio de arquivos.

## Plano B

| Situação | O que fazer |
|---|---|
| Algo ficou estranho ou o ensaio sujou o estado | `select demo.restaurar();` no SQL Editor. Depois, F5 nas janelas; se ficarem vazias, saia e entre de novo. |
| "Receber código" falha | Segundo envio em menos de 5 s (espere e tente de novo), número fora da lista de números de teste do Auth, ou provedor de telefone desligado (Auth, Sign In / Providers, Phone). |
| Entra no Cliente e cai no aviso "outro tipo de conta" | O número é de Guincheiro ou da operação. Use `0001` (Rafael) no Cliente. |
| Preço não aparece ("Não foi possível calcular o preço") | Toque em **Tentar de novo**. Se persistir, veja os logs da função `cotar-pedido` no Supabase. |
| A oferta não chega ao Marcos | Ele precisa estar **Disponível** e com o app aberto. Se outra pessoa estiver disponível e mais perto, o chamado foi para ela e expira em 30 s; o Cliente cai na aprovação de novo preço. Para investigar: `select status_code, content, created from net._http_response order by created desc limit 5;` (200 com `ofertado` é o esperado; 401 indica segredo do Vault errado). |
| Painel sem a Frota "pronta para ativar" | Falta vínculo ativo entre Guincheiro e veículo: volte ao passo 5. |
| Mapa não carrega, busca sem resultado ou rota falha | Use o endereço de produção (`https://guinchei.vercel.app`): o token do Mapbox é restrito a ele. Sem mapa, marque o destino no mapa ou diga que o trecho é do cenário. |
| Nada funciona a 5 minutos | Conte o fluxo pelo [PRD](PRD.md) e mostre o CI verde da `main` (pgTAP, integração e Playwright). |

## Limitações conhecidas

Dizer em voz alta.

**Fora do escopo desta entrega** (dependem de conta ou aparelho do time):

1. **Pagamento é mock.** Não há PSP nem split (RF12); o Pix é ilustrativo; a captura ao fim da Corrida e o estorno ao refazer o preço só atualizam o registro de pagamentos.
2. **Sem push nem GPS em segundo plano (iOS).** O app do Guincheiro precisa estar aberto para a oferta aparecer, e não há rastreamento ao vivo no mapa do Cliente.
3. **Termos de uso provisórios.** O aceite grava a versão, mas o texto não é o definitivo.
4. **Mapbox:** a qualidade dos endereços do DF (quadras, SQS, QNA) varia; a busca acha cidades e vias principais melhor do que quadras.
5. **Sem validação com usuários nem Frota real.** Disposição a pagar ~R$ 300, aceitação da Comissão de 20% e chegada em menos de 30 minutos são hipóteses.

**Aproximações e simulações:**

6. Login com números de teste e código fixo; o canal real (WhatsApp) não está ligado, apesar de o texto do app dizer "código pelo WhatsApp".
7. Posição dos Guincheiros fixa (do seed); a distância até o veículo é em **linha reta**, e o km rebocado vem do trecho que o app calculou.
8. Tabela de preços, piso e repasse provisórios, a revisar com o piloto.
9. Os arquivos de documentos do seed não existem no Storage ("Documento indisponível" no Painel); os enviados ao vivo abrem normalmente.
10. A operação confere os documentos olhando: CNPJ ativo, CNH, antecedentes, apólice e registro DETRAN **não** são consultados em fonte oficial. São automáticos só os dígitos verificadores (CPF, CNPJ, placa, RENAVAM) e a regra CNH × PBT.
11. **O Painel é em parte protótipo:** Homologação, Vencimentos e Ativação são reais; o Monitor de Corridas lê o banco (Pedidos das últimas 24 h, relidos a cada 5 s; o mapa é um desenho esquemático, sem ruas); a Disputa mostra dados de exemplo. "Atendidos em menos de 30 min" conta do Pedido até a Corrida aceita, porque o banco não guarda a hora do pagamento.
12. **Avaliação:** só o lado Cliente → Guincheiro existe; o Guincheiro não vê as notas que recebeu nem avalia o Cliente. Cadastro de Frota **empresa** pelo app não existe (o app cadastra o autônomo); ganhos do plantão (dados de exemplo), cancelamento e rastreamento ao vivo ficam para depois.
13. Quando ninguém aceita não há broadcast: o Cliente decide entre tentar de novo e estornar, e o Painel não atribui.
14. Requisitos de produção fora: 24x7, LGPD, auditoria completa, operação offline.

**Decisões de design que parecem falha, mas são escolhas:**

15. **Documento vencendo só avisa; reenvia quando vence,** para não trocar por baixo o que a operação já conferiu.
16. **Homologação completa não ativa a Frota sozinha:** a operação clica **Ativar Frota**. Ela volta a inativa sozinha se um item vence, é recusado ou reenviado, ou o vínculo cai.
17. **Um número, um papel:** a mesma pessoa não é Cliente e Guincheiro com o mesmo celular; cada app barra o papel errado.

## Depois da apresentação

`select demo.restaurar();` deixa o banco pronto para a próxima. Para encerrar a exposição, nada precisa ser desligado: o Supabase e a Vercel continuam no ar.
