# Roteiro de demo para a apresentação

Demo local de 10 a 15 minutos: Supabase local, os três apps (Cliente, Guincheiro e Painel de operação) e dados sintéticos. Cobre os critérios C, D, E e F de [criterios-de-aceite-apresentacao.md](criterios-de-aceite-apresentacao.md). Tudo o que é simulado está em [Limitações conhecidas](#limitações-conhecidas) e deve ser dito em voz alta.

Os números de teste são fictícios, o **código é sempre `123456`** e nada é enviado por SMS.

## Antes de começar

### Preparação (faça uma vez, de manhã, e de novo 15 minutos antes)

Pré-requisitos: Docker em execução, Node 22 e `corepack enable` (veja [desenvolvimento.md](../desenvolvimento.md)).

```bash
git checkout main && git pull
pnpm install
pnpm supabase start            # Postgres, Auth, Storage, Realtime e Edge Functions; a primeira vez baixa as imagens (minutos)
pnpm supabase db reset         # migrações + seeds (inclui os dados da demo); termina em menos de 2 minutos
pnpm supabase status -o env    # copie API_URL e ANON_KEY (ou Publishable key)
```

Crie o `.env.local` dos três apps (nenhum token vai para o repositório):

```bash
for app in cliente guincheiro painel; do cp apps/$app/.env.example apps/$app/.env.local; done
# em cada apps/<app>/.env.local:
#   VITE_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_SUPABASE_ANON_KEY=<ANON_KEY do status>
#   VITE_MAPBOX_TOKEN=            # deixe vazio: o mapa esquemático do protótipo funciona (veja Limitações)
```

Em três terminais:

```bash
pnpm dev:cliente      # http://localhost:5173
pnpm dev:guincheiro   # http://localhost:5174
pnpm dev:painel       # http://localhost:5175
```

Confira, antes de entrar na sala:

- [ ] Os três endereços abrem **sem** a tela "App sem configuração do servidor".
- [ ] `db reset` rodado **depois** de qualquer ensaio (o ensaio gasta o estado: Frota ativada, Pedidos, convites).
- [ ] Um arquivo qualquer (PDF e JPG) à mão na área de trabalho, para mostrar o envio de documento.
- [ ] O relógio do notebook: entre 20h e 6h o preço ganha o adicional noturno de 15% e em feriado, 20%. Os valores abaixo são de dia útil.
- [ ] Zoom do navegador e fonte grandes o bastante para a sala.

### Janelas e pessoas

A sessão fica no navegador, por endereço. Como o mesmo app do Guincheiro recebe várias pessoas, use **um perfil (ou janela anônima) do navegador por pessoa**, ou saia pelo botão "Sair" da Minha Frota entre uma pessoa e outra. Disposição sugerida:

| Janela | Endereço | Quem | Telefone (digitado com DDD) |
|---|---|---|---|
| 1 | `localhost:5173` (Cliente) | Rafael Souza, Cliente | `(61) 90000-0001` |
| 2 | `localhost:5174` (Guincheiro) | Marcos Alves, Reboque Planalto, o mais próximo | `(61) 90000-0002` |
| 3 | `localhost:5175` (Painel) | Operação Guinchei | `(61) 90000-0005` |
| 4 | `localhost:5174` (Guincheiro, outro perfil) | Helena Duarte, representante da Cerrado Guinchos | `(61) 90000-0060` |
| 5 | `localhost:5174` (Guincheiro, outro perfil) | Cláudia Brito, Guincheira da Cerrado Guinchos (CNH C) | `(61) 90000-0061` |

Outros números úteis: Wagner Lopes `0003` e Rita Campos `0004` (Guincheiros do seed), Paulo Mendes `0007` (Guincho Capital, Frota pendente), Diego Ferraz `0062` (CNH B, Cerrado), `0006` Cliente sem perfil (cadastro urgente), `0008` pessoa nova (cadastro de Frota autônoma), `0046` convidado da Reboque Planalto e `0047` pessoa sem convite. A lista completa está em [desenvolvimento.md](../desenvolvimento.md#usuários-de-teste).

O Auth aceita um envio de código por número a cada 5 segundos: se "Receber código" falhar logo depois de outro, espere um instante e toque de novo.

## O que o `db reset` deixa pronto

- O Cliente Rafael Souza e três Guincheiros ativos e disponíveis, a distâncias diferentes do cenário do protótipo (Eixo Monumental): Marcos (Cruzeiro, ~4,2 km) e Wagner (Asa Norte, ~4,9 km), da empresa Reboque Planalto, e Rita (Guará, ~9,6 km), a autônoma. Os três têm documentos aprovados e veículo vinculado.
- **Guincho Capital**: Frota empresa pendente de homologação (itens a aprovar no Painel).
- **Cerrado Guinchos**: Frota empresa **inativa** e sem vínculos, com a representante Helena, dois Guincheiros (Cláudia, CNH C; Diego, CNH B), a plataforma `CRB-4G56` de **4.200 kg** e a lança `CRB-5H67` de **3.500 kg**, tudo aprovado. É ela que a demo leva de "sem vínculo" até "ativa e recebendo oferta".

## Roteiro (cerca de 14 minutos)

Cada passo diz **onde**, **o que fazer** e **o que dizer**. Fale o que está em "Dizer" com suas palavras; os números e nomes são os do seed.

### 1. Abertura (1 min)

**Dizer:** "O Guinchei é um app estilo Uber para guincho no Distrito Federal. O Cliente vê o **Preço fechado antes de pagar**, o guincho mais próximo é chamado automaticamente, e só entra na plataforma quem a operação homologou. O que vão ver roda local, com dados fictícios; o que é simulado eu aviso quando aparecer, e no fim resumo tudo."

### 2. Cliente pede e vê o Preço fechado (2 min) — janela 1

1. Abrir `localhost:5173`, tocar em **Pedir guincho agora**, entrar com `(61) 90000-0001` e o código `123456`.
2. Em **três toques**: **Carro de passeio**, **Parou e não liga**, **Sim** (as 4 rodas giram). Em seguida **Confirmar local no mapa**.
3. Tela de origem e destino: mapa esquemático, com a nota "Mapa indisponível: configure VITE_MAPBOX_TOKEN". Tocar em **Ver preço fechado**.
4. Tela **Preço fechado**: mostrar o valor em destaque (cerca de R$ 258,80 de dia útil: taxa base R$ 110 + 4,2 km até o veículo × R$ 5 + 21,3 km rebocados × R$ 6), a decomposição e "Guincho mais próximo a 4,2 km".

**Dizer:** "Três toques e o preço aparece antes de qualquer cobrança. Esse valor é calculado no **servidor**, não no app, com a tabela de preços versionada, e é o mesmo que será gravado e autorizado. Aqui o mapa é o esquemático, porque a conta do Mapbox ainda não foi criada; o trecho usado é o do cenário, mas o preço e a distância ao guincho são calculados de verdade no banco."

### 3. Pagamento e Match (1 min) — janelas 1 e 2

1. Janela 2: entrar como Marcos, `(61) 90000-0002`. Deixar o plantão **Disponível**.
2. Janela 1: **Confirmar e pagar**, **Copiar código Pix**. O Cliente cai no acompanhamento, "Chamando o guincho mais próximo".
3. Janela 2: aparece **Novo chamado** sozinho, sem recarregar.

**Dizer:** "O pagamento é um **mock**: não há PSP ainda, o código Pix é ilustrativo. O Pedido entrou no Match e só o Guincheiro mais próximo, o Marcos, recebeu a oferta, em tempo real."

### 4. Corrida do aceite à entrega (2 min) — janelas 2 e 1, lado a lado

1. Janela 2: **Aceitar Corrida**. Janela 1 muda para "Guincheiro aceitou, saindo em instantes" com o nome do Marcos.
2. Janela 2: **Saí para o local** (Cliente vê "Guincho a caminho"), **Cheguei**.
3. Opcional, 20 s: Cliente em **Registrar fotos**; Guincheiro em **Fotos de estado**. Mostrar o aviso (e não bloqueio) "Registrar fotos protege você se houver reclamação de avaria".
4. Janela 2: **Carreguei**, **Entreguei** (se pedir, **Seguir sem fotos**). Janela 1: "Entregue. Seu veículo chegou ao destino".

**Dizer:** "Cada etapa chega ao Cliente sem recarregar a página. As fotos de estado são opcionais, mas recomendadas: servem de prova numa disputa por avaria. O Guincheiro volta sozinho ao plantão."

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

1. Entrar como Operação, `(61) 90000-0005`. Abrir **Homologação**. Mostrar a fila: **Guincho Capital** (itens "Em análise") e **Cerrado Guinchos** com a etiqueta **Pronta para ativar**.
2. Abrir a Guincho Capital: item por item, **Ver documento** (os arquivos do seed não existem no Storage: aparece "Documento indisponível"), **Recusar** com motivo (por exemplo "Apólice sem a plataforma como cossegurada") e **Aprovar** outro. A lista "O que falta para ativar a Frota" mostra que ainda faltam fotos, certidão, selfie e vínculo.
3. Abrir a **Cerrado Guinchos**: "Tudo aprovado: pode ativar". Tocar em **Ativar Frota**.
4. Opcional: aba **Vencendo** (vazia no seed: "Nenhuma apólice, certidão ou CNH vence nos próximos 30 dias"). Para mostrar um item vencendo, faça antes da sala `docker exec -i supabase_db_guinchei psql -U postgres -c "update public.itens_homologacao set validade = current_date + 10 where frota_id = 'f0000000-0000-4000-8000-000000000001' and tipo = 'apolice_rc';"` e `db reset` depois.

**Dizer:** "A operação aprova ou recusa **item por item**, sempre com motivo na recusa, e cada decisão fica numa trilha de auditoria que ninguém consegue apagar. Só quando a regra vale a Frota pode ser ativada, e ela volta a inativa sozinha se um documento vence ou o vínculo cai. Aqui a decisão de design da #49: documento **vencendo** só avisa; o reenvio abre quando ele **vence** (ou é recusado)."

### 8. O prestador recém-ativado recebe oferta; recotação (2 min) — janelas 5, 1 e 3

1. Janela 5 (Cláudia): atualizar a tela; o interruptor agora liga. Deixar **Disponível**.
2. Janela 2 (Marcos) segue em plantão. Janela 1: abrir um novo Pedido (a partir da tela final, ou recarregando `localhost:5173`; mesmos três toques) e tocar em **Ver preço fechado**. O preço **baixou** (cerca de R$ 245: só a distância até o veículo mudou) e o guincho mais próximo é a Cláudia, a 1,4 km: ela, recém-homologada, é agora a Frota cotada.
3. Pagar. Janela 5: **Novo chamado**; tocar em **Recusar**.
4. O próximo candidato é o Marcos, de **outra Frota** e mais longe. O Cliente (janela 1) vê "Outra empresa vai atender": preço anterior, novo preço (cerca de R$ 258,80), diferença e a decomposição, com **Aprovar** e **Desistir e estornar**. Na janela 3, o **Monitor de Corridas** mostra o Pedido "Aguardando aprovação do Cliente" com os dois valores.
5. Janela 1: **Aprovar**. A oferta vai ao Marcos.

**Dizer:** "O Cliente nunca é surpreendido: se o Pedido passa a outra empresa e o preço **sobe**, a oferta pausa até ele aprovar a diferença; sem resposta no prazo vale como desistência, com estorno. Se o preço **cair**, segue direto, com aviso. Se for a mesma Frota, nada muda."

### 9. Fechamento e limitações (1 min)

**Dizer** (leia a lista de [Limitações conhecidas](#limitações-conhecidas), ao menos os cinco primeiros itens) e encerre com: "O que é real hoje: preço no servidor, Match por proximidade e por homologação, tempo real, fotos com hora do servidor, cadastro e homologação de prestadores. O que falta está dito. Nada disso foi validado com usuários: as hipóteses de preço, comissão e tempo de chegada continuam hipóteses."

Se sobrar tempo: o Cliente sem Guincheiro disponível pode **Tentar de novo** ou **Estornar o pagamento** (desligue o plantão de todos e peça um Pedido novo); o autônomo novo (`0008`) cadastrando a Frota, em 5 etapas, é o caminho completo de entrada de um prestador, mas leva mais de 5 minutos e envio de arquivos.

## Plano B

| Situação | O que fazer |
|---|---|
| Dados estragados, ensaio sujou o estado, Pedido preso | `pnpm supabase db reset` (menos de 2 minutos). Depois, recarregue as três janelas e **saia e entre de novo**, porque o reset apaga os usuários. |
| `supabase start` não sobe | Docker está em execução? `docker ps`. Portas 54321 a 54329 livres? `pnpm supabase stop --no-backup && pnpm supabase start`. Sem memória: feche outros containers. |
| App abre "App sem configuração do servidor" | O `.env.local` desse app está faltando ou sem `VITE_SUPABASE_ANON_KEY`. Preencha com `pnpm supabase status -o env` e reinicie o `pnpm dev:*` daquele app. |
| Código `123456` recusado ou "Receber código" falha | Número fora de `[auth.sms.test_otp]` do `supabase/config.toml`, ou segundo envio em menos de 5 s. Espere e tente de novo. |
| Cotação ou confirmação dá erro ("Não foi possível calcular o preço") | As Edge Functions não estão servidas: `pnpm supabase functions serve` num terminal à parte e tente de novo (botão **Tentar de novo**). |
| Oferta não chega ao Guincheiro | Marcos precisa estar **Disponível**. O Match depende do pg_net chamando as Edge Functions (segredos do `03_match_local.sql`): `db reset` repõe. O banco também varre sozinho (pg_cron) e tenta de novo em ~30 s. |
| Painel não lista a Frota "pronta para ativar" | Falta um vínculo ativo: volte ao passo 5. Confira também o contador ao lado de "Homologação". |
| Mapbox quer token | Não é necessário. Se alguém preencher `VITE_MAPBOX_TOKEN`, o mapa real entra e a busca de endereço passa a funcionar; sem internet, deixe vazio. |
| Nada funciona a 5 minutos da apresentação | Conte o fluxo com o `Guinchei-Apresentacao.pdf` e o [PRD](PRD.md) e mostre as evidências automatizadas: o CI da `main` roda pgTAP, a integração do `@guinchei/api` e o Playwright com os dois navegadores. |

Em dúvida sobre o estado, o `db reset` é sempre seguro.

## Limitações conhecidas

Dizer em voz alta. Esta lista complementa e atualiza [limitacoes-do-skeleton.md](limitacoes-do-skeleton.md).

**Fora do escopo desta entrega** (dependem de conta ou aparelho do time, issues #2, #3, #9, #15 e #23):

1. **Sem deploy online (Vercel, #2).** A demo é local.
2. **Mapbox real não verificado (#9).** Sem token, o mapa é o esquemático e o trecho é o do cenário (Eixo Monumental até Taguatinga Norte); a qualidade dos endereços do DF, o formato real das respostas e os termos de armazenamento do endereço não foram conferidos contra o Mapbox real.
3. **Pagamento é mock.** Não há PSP nem split (RF12); o Pix é ilustrativo; a captura ao fim da Corrida e o estorno ao refazer o preço só atualizam o registro de pagamentos.
4. **Push e GPS em segundo plano no iOS (#3)** pendentes. O app do Guincheiro precisa estar aberto para a oferta aparecer, e não há rastreamento ao vivo no mapa do Cliente.
5. **Termos de uso provisórios (#23).** O aceite grava a versão, mas o texto não é o definitivo.

**Aproximações e simulações:**

6. Login com números de teste e código fixo; o canal real (WhatsApp, ADR-0010) não está ligado.
7. Posição dos Guincheiros fixa (do seed); a distância até o veículo é em **linha reta**, e o km rebocado vem do app (a rota no servidor depende do token de servidor do Mapbox).
8. Tabela de preços, piso e repasse provisórios (ADR-0009), a revisar com o piloto.
9. Os arquivos de documentos do seed não existem no Storage ("Documento indisponível" no Painel); os enviados ao vivo abrem normalmente.
10. A operação confere os documentos olhando: CNPJ ativo, CNH, antecedentes, apólice e registro DETRAN **não** são consultados em fonte oficial. São automáticos só os dígitos verificadores (CPF, CNPJ, placa, RENAVAM) e a regra CNH × PBT.
11. **Painel ainda é em parte protótipo**: homologação, vencimentos, ativação e tabela de preços são reais; o Monitor de Corridas (as linhas), os indicadores e a Disputa mostram dados de exemplo. Só a linha "aguardando aprovação do novo preço" é real.
12. Cadastro de Frota **empresa** pelo app não existe (o app cadastra o autônomo); histórico de Corridas, ganhos do plantão (dados de exemplo), avaliação mútua (RF13), cancelamento (RN05, botão desabilitado) e rastreamento ao vivo (RF09) ficam para depois.
13. Quando ninguém aceita não há broadcast (RF08): o Cliente decide entre tentar de novo e estornar, e o Painel não atribui.
14. Requisitos de produção fora: 24x7, LGPD, auditoria completa, operação offline.

**Decisões de design que parecem falha, mas são escolhas:**

15. **Documento vencendo só avisa; reenvia quando vence.** Item aprovado a até 30 dias do fim aparece na aba "Vencendo" e nos apps, mas o botão de enviar documento novo só aparece quando ele vence (ou é recusado), para não trocar por baixo o que a operação já conferiu (#49).
16. **Homologação completa não ativa a Frota sozinha.** Quando tudo está aprovado e há vínculo ativo a Frota fica "pronta para ativar"; a operação clica **Ativar Frota**. Ela volta a inativa sozinha se um item vence, é recusado ou reenviado, ou o vínculo cai (#50).
17. **Sem validação com usuários nem Frota real.** Disposição a pagar ~R$ 300, aceitação da Comissão de 20% e chegada em menos de 30 minutos são hipóteses (CONTEXT, "Estado da validação").

## Depois da apresentação

- `pnpm supabase stop` desliga o Supabase local. Para recomeçar do zero, `pnpm supabase db reset`.
- Os dados da demo vivem em [`supabase/seeds/05_demonstracao.sql`](../../supabase/seeds/05_demonstracao.sql) (puramente aditivo; só local, não vai para staging) e em `[auth.sms.test_otp]` do `supabase/config.toml` (`0060`, `0061`, `0062`).
