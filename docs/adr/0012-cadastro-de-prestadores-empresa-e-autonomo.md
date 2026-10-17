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
