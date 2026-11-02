import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErroApi, LIMITE_COMENTARIO_AVALIACAO, type DetalheDoPedido } from '@guinchei/api';
import { Botao, Corpo, Estrelas, EstrelasLeitura, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { useCarregar } from '../carregar';
import { useFluxo } from '../fluxo';
import { MensagemDeErro } from '../MensagemDeErro';
import { dataEHora } from '../rotulos';
import { ExigePerfil } from '../sessao';

// Fim do fluxo do Pedido: o Cliente avalia o Guincheiro da Corrida entregue (RF13, lado
// Cliente → Guincheiro). Uma avaliação por Corrida, sem edição; "Agora não" volta ao Início e
// a avaliação segue disponível pelo cartão do Início e pelo detalhe da Corrida.

const FRASE_DA_NOTA = ['Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente'] as const;

export function AvaliarCorrida() {
  return (
    <ExigePerfil>
      <Avaliando />
    </ExigePerfil>
  );
}

function Avaliando() {
  const api = useApi();
  const ir = useNavigate();
  const { pedidoId = '' } = useParams();
  const carregar = useCallback(() => api.buscarDetalheDoPedido(pedidoId), [api, pedidoId]);
  const { estado, recarregar } = useCarregar(carregar);

  if (estado.tipo === 'carregando') {
    return (
      <Tela rotulo="Avaliação">
        <Corpo style={{ padding: '24px', gap: 16 }}>
          <p className="apoio" role="status" aria-live="polite">
            Carregando…
          </p>
        </Corpo>
      </Tela>
    );
  }
  if (estado.tipo === 'erro') {
    return (
      <Tela rotulo="Avaliação">
        <Corpo style={{ padding: '24px', gap: 16 }}>
          <MensagemDeErro>Não foi possível carregar a Corrida.</MensagemDeErro>
          <Botao onClick={recarregar}>Tentar de novo</Botao>
          <Link centro onClick={() => ir('/inicio')}>
            Voltar ao Início
          </Link>
        </Corpo>
      </Tela>
    );
  }
  const d = estado.dados;
  if (!d || d.corrida?.estado !== 'entregue') {
    return (
      <Tela rotulo="Avaliação">
        <Corpo style={{ padding: '24px', gap: 16 }}>
          <h1
            className="titulo"
            style={{ font: '700 28px/1.12 var(--fonte-titulo)', marginTop: 28 }}
          >
            Ainda não dá para avaliar
          </h1>
          <p className="apoio">
            {d
              ? 'A avaliação abre quando a Corrida for entregue.'
              : 'Não encontramos esta Corrida.'}
          </p>
          <div className="espaco" />
          <Botao onClick={() => ir('/inicio')}>Voltar ao Início</Botao>
        </Corpo>
      </Tela>
    );
  }
  if (d.avaliacao) return <JaAvaliada d={d} />;
  return <Formulario d={d} corridaId={d.corrida.id} aoJaAvaliada={recarregar} />;
}

/** A avaliação já enviada, só para ler: não se edita. */
function JaAvaliada({ d }: { d: DetalheDoPedido }) {
  const ir = useNavigate();
  const a = d.avaliacao!;
  return (
    <Tela rotulo="Sua avaliação">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Rotulo style={{ marginTop: 16 }}>Avaliação enviada</Rotulo>
        <h1 className="titulo" style={{ font: '700 28px/1.12 var(--fonte-titulo)' }}>
          Sua avaliação
        </h1>
        <EstrelasLeitura nota={a.nota} />
        <p style={{ font: '400 16px/1.5 var(--fonte-texto)', margin: 0 }}>
          {a.comentario ?? 'Sem comentário.'}
        </p>
        <p className="apoio" style={{ fontSize: 14 }}>
          Enviada em {dataEHora(a.criadoEm)}. Avaliações não podem ser editadas depois de enviadas.
        </p>
        <div className="espaco" />
        <Botao onClick={() => ir('/inicio')}>Voltar ao Início</Botao>
      </Corpo>
    </Tela>
  );
}

function Formulario({
  d,
  corridaId,
  aoJaAvaliada,
}: {
  d: DetalheDoPedido;
  corridaId: string;
  aoJaAvaliada: () => void;
}) {
  const api = useApi();
  const ir = useNavigate();
  const { avisar } = useFluxo();
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const guincheiro = d.corrida?.guincheiro?.nome;

  async function enviar() {
    if (nota === null) return;
    setErro(null);
    setEnviando(true);
    try {
      await api.avaliarCorrida(corridaId, nota, comentario);
      avisar('Obrigado! Sua avaliação foi enviada.');
      ir('/inicio', { replace: true });
    } catch (e) {
      if (e instanceof ErroApi && e.motivo === 'ja_avaliada') {
        // Outra tela ou aparelho já enviou: mostra a avaliação gravada.
        aoJaAvaliada();
        return;
      }
      setErro(
        e instanceof ErroApi && e.motivo !== 'falha'
          ? e.message
          : 'Não foi possível enviar a avaliação. Tente de novo.',
      );
      setEnviando(false);
    }
  }

  return (
    <Tela rotulo="Avaliação">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Rotulo style={{ marginTop: 16 }}>Corrida entregue</Rotulo>
        <h1 className="titulo" style={{ font: '700 30px/1.12 var(--fonte-titulo)' }}>
          Como foi o atendimento?
        </h1>
        <p className="apoio">
          {guincheiro
            ? `Dê uma nota para ${guincheiro}. Ela ajuda a manter só bons guincheiros no Guinchei.`
            : 'Sua nota ajuda a manter só bons guincheiros no Guinchei.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <Estrelas
            valor={nota}
            onChange={setNota}
            nome="nota-do-atendimento"
            rotulo="Nota do atendimento, de 1 a 5 estrelas"
          />
          <p
            className="apoio"
            aria-live="polite"
            style={{ textAlign: 'center', minHeight: 24, fontWeight: 600 }}
          >
            {nota !== null ? FRASE_DA_NOTA[nota - 1] : 'Toque nas estrelas para avaliar'}
          </p>
        </div>
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            font: '600 14px var(--fonte-texto)',
            color: 'var(--tinta-2)',
          }}
        >
          Comentário (opcional)
          <textarea
            value={comentario}
            maxLength={LIMITE_COMENTARIO_AVALIACAO}
            rows={4}
            onChange={(e) => setComentario(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 14,
              background: '#fff',
              border: '1px solid var(--linha)',
              font: '400 16px/1.4 var(--fonte-texto)',
              color: 'var(--tinta)',
              resize: 'vertical',
            }}
          />
          <span
            style={{ alignSelf: 'flex-end', fontWeight: 400 }}
            aria-label={`${comentario.length} de ${LIMITE_COMENTARIO_AVALIACAO} caracteres`}
          >
            {comentario.length}/{LIMITE_COMENTARIO_AVALIACAO}
          </span>
        </label>
        <div className="espaco" />
        <MensagemDeErro>{erro}</MensagemDeErro>
        <Botao disabled={nota === null || enviando} onClick={enviar}>
          Enviar avaliação
        </Botao>
        <Link centro disabled={enviando} onClick={() => ir('/inicio')}>
          Agora não
        </Link>
      </Corpo>
    </Tela>
  );
}
