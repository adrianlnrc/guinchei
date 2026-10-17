import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatarHora } from '@guinchei/ui';
import { LADOS, TRECHO } from '@guinchei/mock';
import { Botao, Corpo, Foto, IndicadorHome, Mapa, Ponto, Rotulo, Tela } from '@guinchei/ui';
import { contarFotos, usePlantao, type Etapa } from '../plantao';
import { Navegacao } from './Chamado';

// GPS de exemplo; no skeleton vem do navegador (ADR-0008).
const GPS = [
  '-15.7903, -47.8921',
  '-15.7903, -47.8921',
  '-15.7903, -47.8922',
  '-15.7903, -47.8922',
];
const GPS_DESTINO = '-15.8104, -48.0617';

export function Checklist() {
  const ir = useNavigate();
  const { fotos, avancar } = usePlantao();
  const feitas = contarFotos(fotos.antes);
  const proxima = fotos.antes.findIndex((f) => !f);
  const ladoProximo = LADOS[proxima];

  return (
    <Tela rotulo="Checklist antes de carregar">
      <Corpo style={{ padding: '12px 24px 32px', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Rotulo>Antes de carregar</Rotulo>
          <span style={{ font: '600 15px var(--fonte-titulo)' }}>
            {feitas} de {LADOS.length}
          </span>
        </div>
        <h1
          className="titulo"
          style={{ font: '700 28px/1.12 var(--fonte-titulo)', letterSpacing: '-.01em' }}
        >
          Fotografe os quatro lados do carro
        </h1>
        <p className="apoio" style={{ fontSize: 15 }}>
          As fotos guardam hora e GPS. Em caso de Disputa, são elas que protegem você.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LADOS.map((lado, i) => {
            const foto = fotos.antes[i];
            const destaque = i === proxima;
            return (
              <button
                key={lado}
                type="button"
                onClick={() => ir(`/camera/antes/${i}`)}
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  padding: destaque ? 9 : 10,
                  borderRadius: 14,
                  background: '#fff',
                  border: destaque ? '2px solid var(--tinta)' : '1px solid var(--linha-suave)',
                }}
              >
                {foto ? (
                  <Foto altura={64} pequena style={{ width: 64, flex: 'none' }} />
                ) : (
                  <Foto altura={64} vazia style={{ width: 64, flex: 'none', borderRadius: 10 }} />
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ font: '600 16px var(--fonte-titulo)' }}>{lado}</span>
                  {foto ? (
                    <span className="mono">
                      {foto.hora} · {foto.gps}
                    </span>
                  ) : (
                    <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                      {destaque ? 'Falta esta' : 'Falta'}
                    </span>
                  )}
                </div>
                {foto && (
                  <span
                    style={{ font: '600 13px var(--fonte-texto)', color: 'var(--sucesso-texto)' }}
                  >
                    Enviada
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--linha-fina)',
            font: '400 14px/1.45 var(--fonte-texto)',
          }}
        >
          Viu alguma avaria? Fotografe de perto e anote antes de carregar.
        </div>
        <div className="espaco" />
        {ladoProximo ? (
          <Botao grande onClick={() => ir(`/camera/antes/${proxima}`)}>
            Tirar foto da {ladoProximo.toLowerCase()}
          </Botao>
        ) : (
          <Botao
            grande
            onClick={() => {
              avancar('carregado');
              ir('/transporte', { replace: true });
            }}
          >
            Veículo carregado
          </Botao>
        )}
      </Corpo>
    </Tela>
  );
}

function useRelogioSegundos() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return `${formatarHora(agora)}:${String(agora.getSeconds()).padStart(2, '0')}`;
}

export function Camera() {
  const ir = useNavigate();
  const { etapa, lado } = useParams();
  const { registrarFoto } = usePlantao();
  const relogio = useRelogioSegundos();
  const indice = Number(lado);
  const nomeLado = LADOS[indice];
  if ((etapa !== 'antes' && etapa !== 'depois') || !nomeLado) return <Navigate to="/" replace />;
  const gps = (etapa === 'antes' ? GPS[indice] : undefined) ?? GPS_DESTINO;
  const voltar = etapa === 'antes' ? '/fotos/antes' : '/entrega';

  function disparar() {
    registrarFoto(etapa as Etapa, indice, { hora: formatarHora(new Date()), gps });
    ir(voltar, { replace: true });
  }

  return (
    <Tela mapa escura fundo="#000" rotulo={`Câmera: ${nomeLado}`}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 110,
          bottom: 220,
          background: 'repeating-linear-gradient(135deg,#1F232B 0 10px,#262A33 10px 20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="mono"
      >
        <span style={{ color: 'var(--cinza-medio)' }}>visor da câmera</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          top: 240,
          height: 240,
          border: '2px solid var(--off-white)',
          borderRadius: 16,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--topo) + 10px)',
          left: 20,
          right: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        className="navegacao"
      >
        <button
          type="button"
          style={{ font: '500 16px var(--fonte-texto)' }}
          onClick={() => ir(voltar, { replace: true })}
        >
          Fechar
        </button>
        <span style={{ font: '600 16px var(--fonte-titulo)' }}>{nomeLado}</span>
        <span style={{ width: 44 }} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          top: 500,
          textAlign: 'center',
          font: '500 15px var(--fonte-texto)',
        }}
      >
        Enquadre o carro inteiro dentro da moldura
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 220,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <span className="mono" style={{ color: 'var(--cinza-medio)' }}>
          {relogio} · {gps} · GPS ±4 m
        </span>
        <button
          type="button"
          aria-label="Tirar foto"
          onClick={disparar}
          style={{
            width: 78,
            height: 78,
            borderRadius: '50%',
            border: '4px solid var(--off-white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{ width: 62, height: 62, borderRadius: '50%', background: 'var(--off-white)' }}
          />
        </button>
        <IndicadorHome />
      </div>
    </Tela>
  );
}

export function Transporte() {
  const ir = useNavigate();
  return (
    <Tela mapa escura rotulo="Em transporte">
      <Mapa
        escuro
        ruas={[
          { top: 260, esp: 16, giro: -18 },
          { left: 110, esp: 12 },
          { left: 280, esp: 10, giro: -6 },
        ]}
        rota="292,460 290,290 116,300 116,150"
        rotaEspessura={6}
        marcadores={[
          { left: 276, top: 444, tamanho: 32, tipo: 'guincho' },
          { left: 104, top: 138, tamanho: 24, tipo: 'destino' },
        ]}
      />
      <Navegacao instrucao="Siga 8 km pela EPTG" via="Sentido Taguatinga" />
      <div className="folha folha--escura" style={{ gap: 14 }}>
        <Ponto>Carregado · Fotos de estado enviadas</Ponto>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ font: '700 28px var(--fonte-titulo)' }}>17 min</span>
          <span style={{ font: '500 15px var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
            14,8 km · chega 22:31
          </span>
        </div>
        <div
          className="cartao cartao--escuro"
          style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
            Destino
          </span>
          <span style={{ font: '500 16px var(--fonte-texto)' }}>{TRECHO.destino}</span>
        </div>
        <Botao variante="claro" grande onClick={() => ir('/entrega', { replace: true })}>
          Cheguei no destino
        </Botao>
        <IndicadorHome />
      </div>
    </Tela>
  );
}
