# ADR-0011: Fotos de estado opcionais, registradas pelo Cliente e pelo Guincheiro

- Status: aceito
- Data: 2026-10-17
- Decisores: Adrian de Alencar Stelo (produto e arquitetura)
- Substitui: RN04 / invariante 5 do CONTEXT ("a Corrida só encerra com as Fotos de estado") e o "mínimo de 1 por etapa" do ADR-0008

## Contexto

Exigir fotos para encerrar trava a operação quando o Guincheiro não consegue fotografar (chuva, noite, pressa na via). O registro também protege o Cliente, que hoje não participa dele.

## Decisão

- **Fotos e vídeos de estado são opcionais.** A Corrida encerra sem eles.
- **Cliente e Guincheiro** podem registrar fotos e vídeos em qualquer momento da Corrida (de `aceita` a `entregue`). Recomendação exibida: no mínimo 2 fotos antes do carregamento e 2 na entrega. Vídeo de até 30 s; até 6 itens por etapa.
- **Aviso explícito** nos dois apps, no carregamento e na entrega: registrar fotos protege você se houver reclamação de avaria. O Guincheiro confirma o aviso para seguir sem fotos.
- Cada item guarda **hora gravada pelo servidor**, coordenadas do navegador e autor (Cliente ou Guincheiro).
- **Disputa** sem fotos: a operação decide caso a caso com as provas existentes (fotos ou vídeos de qualquer lado, horários, histórico e relato). Não há presunção automática a favor de nenhum lado. O Painel mostra quem registrou o quê e quando.

## Alternativas consideradas

- **Obrigatórias (RN04 original):** prova forte, mas trava a operação.
- **Opcionais com presunção a favor do Cliente:** incentivo forte, mas injusto quando o Cliente também poderia ter registrado.

## Consequências

- (+) Nenhuma Corrida fica presa por falta de foto.
- (+) O Cliente participa da prova.
- (−) Disputas sem prova ficam mais difíceis; dependem do aviso para manter o hábito de registrar.
- (−) Vídeo aumenta custo de storage.
