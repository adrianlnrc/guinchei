# ADR-0010: Login por telefone com código e cadastro em duas etapas

- Status: aceito
- Data: 2026-10-17
- Decisores: Adrian de Alencar Stelo (produto e arquitetura)
- Substitui: o item "Auth (e-mail + senha)" do ADR-0008

## Contexto

O Cliente pede guincho com o carro parado na rua. E-mail e senha são atrito nesse momento. O protótipo do Claude Design já usava telefone e código. SMS tem custo por mensagem (~US$ 0,05 no Brasil) e não há opção gratuita; o WhatsApp é onipresente no DF.

## Decisão

- **Login por telefone + código de verificação**, via Supabase Auth (phone OTP).
- **Canal do código:** WhatsApp pela **uazapi** (API não oficial), chamada por um *Send SMS hook* do Supabase (Edge Function nossa). Número **dedicado**, nunca o principal da empresa. **SMS pago como reserva** se a uazapi falhar ou o número for banido. Trocar pela API oficial da Meta no mesmo hook, sem mexer nos apps, se o volume justificar.
- **Skeleton, local e CI:** números de teste do Supabase com código fixo; nenhum envio real.
- **Cadastro urgente** (Cliente): nome, telefone, CPF (validado por dígito verificador, único por conta) e **aceite dos termos de uso**. Basta para pedir.
- **Cadastro completo** (Cliente, opcional, sugerido após a primeira Corrida): e-mail, data de nascimento (exige 18+), telefone secundário. Nunca bloqueia um Pedido.
- Os **termos de uso** são redigidos pelo time (issue própria); até lá, texto provisório.

## Alternativas consideradas

- **E-mail + senha** (ADR-0008): gratuito, mas atrito alto para quem está com o carro parado.
- **SMS via Twilio/Vonage:** confiável, ~7× mais caro que WhatsApp.
- **API oficial do WhatsApp:** ~US$ 0,0068 por código, exige verificação da empresa na Meta; fica como evolução.
- **Firebase Phone Auth:** 10 SMS/dia grátis, mas segundo sistema de identidade ao lado do Supabase.

## Consequências

- (+) Entrada em segundos, com o canal que o Cliente já usa.
- (+) Custo baixo por login.
- (−) Risco de banimento do número na API não oficial; mitigado por número dedicado e SMS de reserva.
- (−) CPF é dado pessoal: tratamento conforme LGPD (RNF03).

## Nota de revisão (2026-10-22)

Decisão do dono do produto (issue #57), que ajusta as duas etapas do cadastro sem mudar o login:

- **Cadastro emergencial** (antes do primeiro Pedido): telefone (do login, só informação na tela), CPF, **CEP** e nome, mais o aceite dos termos. O CEP entra com 8 dígitos (máscara 00000-000 na tela, só dígitos no banco), não pode ter todos os dígitos iguais e **não se restringe ao DF**: o CEP é do Cliente, não do Pedido (a praça do ADR-0001 vale para origem e destino).
- **Cadastro no app** (completo, nunca bloqueia um Pedido): tela "Meu cadastro" com nome, CPF e telefone (só leitura), CEP e e-mail (formato simples, opcional). Acessível pelo início do Pedido e ao fim da Corrida. Substitui o "cadastro completo" acima: **data de nascimento (18+) e telefone secundário saem da tela** e do fluxo. As colunas `data_nascimento` e `telefone_secundario` continuam em `perfis`, sem uso.
- No banco, `perfis.cep` (check de 8 dígitos, não todos iguais) é obrigatório só na criação do perfil de Cliente (política de INSERT); perfis anteriores, do seed e de prestadores, ficam com `cep` nulo. A atualização passa pela função `atualizar_cadastro_cliente(nome, cep, email)`, só do próprio Cliente; CPF, telefone e papel não têm GRANT de UPDATE.
