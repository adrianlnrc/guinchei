import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Botao, Corpo, Link, Progresso, Rotulo, Tela } from '@guinchei/ui';
import { CLIENTE, RODAS, SITUACOES, VEICULOS } from '@guinchei/mock';
import { useFluxo } from '../fluxo';

// Variação 1a do design: três toques em etapas (RF03).

const tituloEtapa = { font: '700 30px/1.12 var(--fonte-titulo)' };

export function PedidoEtapa() {
  const { etapa } = useParams();
  const n = Number(etapa);
  if (n === 1) return <Veiculo />;
  if (n === 2) return <Situacao />;
  if (n === 3) return <RodasGiram />;
  return <Navigate to="/pedido/1" replace />;
}

function Cabecalho({ n }: { n: number }) {
  return (
    <>
      <Progresso total={3} feitos={n} />
      <Rotulo style={{ marginTop: 12 }}>{n} de 3</Rotulo>
    </>
  );
}

function Veiculo() {
  const ir = useNavigate();
  const { veiculo, setVeiculo } = useFluxo();
  return (
    <Tela rotulo="Pedido: veículo">
      <Corpo style={{ padding: '12px 24px 32px', gap: 16 }}>
        <Cabecalho n={1} />
        <h1 className="titulo" style={tituloEtapa}>
          Oi, {CLIENTE.nome}. Qual veículo precisa de reboque?
        </h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {VEICULOS.map((v) => (
            <button
              key={v.valor}
              type="button"
              className="opcao"
              aria-pressed={veiculo === v.valor}
              onClick={() => {
                setVeiculo(v.valor);
                ir('/pedido/2');
              }}
            >
              {v.rotulo}
              {veiculo === v.valor && <span className="opcao__marca" />}
            </button>
          ))}
        </div>
        <div className="espaco" />
        <p className="apoio" style={{ fontSize: 14, textAlign: 'center' }}>
          Um toque já leva para a próxima pergunta.
        </p>
      </Corpo>
    </Tela>
  );
}

function Situacao() {
  const ir = useNavigate();
  const { situacao, setSituacao } = useFluxo();
  return (
    <Tela rotulo="Pedido: situação">
      <Corpo style={{ padding: '12px 24px 32px', gap: 16 }}>
        <Cabecalho n={2} />
        <h1 className="titulo" style={tituloEtapa}>
          O que aconteceu com o carro?
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
          {SITUACOES.map((s) => (
            <button
              key={s.valor}
              type="button"
              className="opcao"
              aria-pressed={situacao === s.valor}
              onClick={() => {
                setSituacao(s.valor);
                ir('/pedido/3');
              }}
              style={{
                height: 120,
                padding: situacao === s.valor ? 17 : 18,
                alignItems: 'flex-end',
                font: '600 17px/1.2 var(--fonte-titulo)',
              }}
            >
              {s.rotulo}
            </button>
          ))}
        </div>
        <div className="espaco" />
        <Link centro onClick={() => ir('/pedido/1')}>
          Voltar
        </Link>
      </Corpo>
    </Tela>
  );
}

function RodasGiram() {
  const ir = useNavigate();
  const { rodas, setRodas } = useFluxo();
  const [sim, nao, naoSei] = RODAS;
  const grande = { height: 140, justifyContent: 'center', font: '700 28px var(--fonte-titulo)' };
  return (
    <Tela rotulo="Pedido: rodas">
      <Corpo style={{ padding: '12px 24px 32px', gap: 16 }}>
        <Cabecalho n={3} />
        <h1 className="titulo" style={tituloEtapa}>
          As 4 rodas giram?
        </h1>
        <p className="apoio">
          Isso define o tipo de guincho que vamos mandar. Se não tiver certeza, tudo bem.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
          {[sim, nao].map((r) => (
            <button
              key={r.valor}
              type="button"
              className="opcao"
              aria-pressed={rodas === r.valor}
              onClick={() => setRodas(r.valor)}
              style={grande}
            >
              {r.rotulo}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="opcao"
          aria-pressed={rodas === naoSei.valor}
          onClick={() => setRodas(naoSei.valor)}
          style={{
            justifyContent: 'center',
            padding: rodas === naoSei.valor ? 17 : 18,
            font: '600 17px var(--fonte-titulo)',
          }}
        >
          {naoSei.rotulo}
        </button>
        <div className="espaco" />
        <Botao disabled={!rodas} onClick={() => ir('/local')}>
          Confirmar local no mapa
        </Botao>
      </Corpo>
    </Tela>
  );
}
