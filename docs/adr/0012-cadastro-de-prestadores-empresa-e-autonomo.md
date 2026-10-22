# ADR-0012: Cadastro de prestadores: empresa e autônomo, com verificação manual

- Status: aceito
- Data: 2026-10-17
- Decisores: Adrian de Alencar Stelo (produto e arquitetura)
- Altera: ADR-0006 (autônomos deixam de ser só Fase 2)

## Contexto

O ADR-0006 lança só com Frotas âncora com CNPJ. A pesquisa de mercado (Cadê Guincho, Porto Seguro, Uber/99) mostrou que o padrão do setor aceita empresa e autônomo, com verificação manual, e que a Uber usa o modelo "empresa cadastra veículos e vincula motoristas com conta própria".

## Decisão

- **Dois formulários separados, com as mesmas informações:** empresa (CNPJ) e autônomo (CPF ou MEI). O autônomo é uma **Frota de uma pessoa só**.
- **Frota:** documento (CNPJ ou CPF/MEI) e razão social ou nome; representante (nome, CPF, telefone); endereço da base; alvará (upload); apólice de RC por avaria vigente (upload e validade, ADR-0007); chave Pix para recebimento (até o PSP do Incremento 2); aceite dos termos para prestadores.
- **Guincheiro:** conta própria (telefone + código, ADR-0010), convidado pela Frota. Nome, CPF, telefone, foto; CNH definitiva com número, categoria, validade, foto e observação EAR; certidão de antecedentes (PCDF e PF), renovada a cada 12 meses; selfie no cadastro.
- **Veículo:** placa, RENAVAM, foto do CRLV, tipo (plataforma, asa-delta, lança), PBT, fotos.
- **Regra legal automática:** o vínculo Guincheiro × veículo é bloqueado se a categoria da CNH não cobre o PBT (CTB art. 143: B até 3.500 kg, C acima).
- **Homologação manual** no Painel de Frota, veículos e Guincheiros antes de qualquer chamado (RN03).
- **Fora do skeleton:** o skeleton usa Frotas e Guincheiros do seed; o cadastro é spec do Incremento 1.

## Alternativas consideradas

- **Só empresas no lançamento (ADR-0006 original):** menos oferta e menos risco.
- **Integração com Serpro e selfie recorrente (Uber):** mais segurança; fica para depois do piloto.

## Consequências

- (+) Mais oferta desde o lançamento.
- (+) Cada Corrida fica vinculada a um Guincheiro identificado.
- (−) Verificação manual de autônomos é mais trabalhosa e o risco jurídico é maior; a apólice continua obrigatória.

## Detalhamento do modelo (issue #43, cadastro do autônomo)

Nada abaixo muda a decisão; só a precisa no banco e no app.

- **Papel de quem gere a Frota:** o enum de papéis ganha `representante`, distinto de `guincheiro`: o representante de uma empresa pode não dirigir. Uma conta tem um papel só (`perfis.papel`).
- **Autônomo:** é representante e Guincheiro de uma Frota própria, na mesma conta. O perfil tem papel `representante`; a linha em `guincheiros` (posição, plantão) é criada no ticket de documentos do Guincheiro, que também passa a aceitar esse papel em `guincheiros.id`. Até lá o autônomo cadastra e acompanha a Frota, mas não entra em plantão.
- **Representante na Frota:** `frotas.representante_id` aponta para o perfil (nome, CPF e telefone do representante ficam em `perfis`, o telefone é o verificado no login). É único por Frota e nulo só nas Frotas do seed, que antecedem o cadastro.
- **Campos da Frota:** `base_cep`, `base_endereco`, `base_bairro`, `chave_pix`, `apolice_validade`, `termos_prestador_versao` e `termos_prestador_em`. O grupo do cadastro (representante, endereço, Pix e termos) vem inteiro ou não vem (`frotas_cadastro_completo`). A hora do aceite é do servidor, no padrão de `perfis.aceite_termos_em`. `apolice_validade` espelha a validade do item de homologação da apólice (trigger), que é a fonte.
- **Rascunho no banco:** o cadastro em andamento fica em `rascunhos_frota` (um por conta, `etapa` e `dados` em JSON), para retomar em outro aparelho. Só abre rascunho quem ainda não é prestador (sem perfil, ou representante sem Frota).
- **Envio:** `enviar_cadastro_frota()` valida tudo no servidor e, numa transação, cria o perfil de representante, a Frota com `ativa = false` e um item `pendente` para o alvará e outro para a apólice (com validade). Ativar a Frota continua sendo só da operação.
- **Dono dos itens de Frota:** passa a ser o representante (antes, no #42, o Guincheiro que enviava). O representante envia e reenvia os itens da Frota e dos veículos; o Guincheiro, os dele. Reenviar torna quem reenviou o dono do item.
- **Apólice:** o formulário e o servidor recusam validade vencida ou a vencer em menos de 30 dias (ADR-0007), para não aprovar o que vence antes da ativação.
- **Termos para prestadores:** texto provisório, versionado como os termos de uso (ADR-0010); o perfil novo do representante grava essa versão como aceite dos termos.

## Detalhamento do convite de Guincheiro (issue #46)

- **Convite por telefone:** o representante convida um número (`convites_guincheiro`: telefone, Frota, estado `pendente`/`aceito`/`cancelado`, validade de 7 dias). Um número tem no máximo um convite pendente, então duas Frotas nunca disputam o mesmo número; número que já tem conta (Guincheiro, Cliente, representante ou operação) não é convidado.
- **Conta própria no primeiro login:** o convidado entra por telefone + código (ADR-0010) e, no primeiro acesso, informa nome e CPF e aceita os termos de uso; `aceitar_convite_guincheiro()` cria o perfil de Guincheiro e a linha em `guincheiros` na Frota que convidou, e marca o convite como aceito. O número convidado vale mais do que o cadastro da própria Frota autônoma.
- **Fora do Match até a homologação:** o Guincheiro nasce `disponivel = false`; CNH, antecedentes e selfie vêm na etapa de documentos (#47), e a operação homologa antes de qualquer chamado.
