import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatarHora } from '@guinchei/ui';
import { LADOS } from '@guinchei/mock';
import { Botao, Corpo, Foto, IndicadorHome, Link, Rotulo, Tela } from '@guinchei/ui';
import { contarFotos, usePlantao, type Etapa } from '../plantao';

// GPS de exemplo; no skeleton vem do navegador (ADR-0008).
const GPS = [
  '-15.7903, -47.8921',
  '-15.7903, -47.8921',
  '-15.7903, -47.8922',
  '-15.7903, -47.8922',
];
const GPS_DESTINO = '-15.8104, -48.0617';

const TEXTO_DA_ETAPA: Record<Etapa, { rotulo: string; titulo: string }> = {
  antes: { rotulo: 'Antes de carregar', titulo: 'Fotografe os quatro lados do carro' },
  depois: { rotulo: 'Depois de descarregar', titulo: 'Fotografe o carro na entrega' },
};

/**
 * Prévia das Fotos de estado (ADR-0011): opcionais, não travam nenhuma etapa da Corrida e,
 * por enquanto, não são gravadas. O envio com hora do servidor e GPS entra na issue #13.
 */
export function Checklist() {
  const ir = useNavigate();
  const { etapa } = useParams();
  const { fotos } = usePlantao();
  if (etapa !== 'antes' && etapa !== 'depois') return <Navigate to="/corrida" replace />;
  const lista = fotos[etapa];
  const feitas = contarFotos(lista);
  const proxima = lista.findIndex((f) => !f);
  const ladoProximo = LADOS[proxima];
  const texto = TEXTO_DA_ETAPA[etapa];

  return (
    <Tela rotulo={`Fotos de estado: ${texto.rotulo.toLowerCase()}`}>
      <Corpo style={{ padding: '12px 24px 32px', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Rotulo>{texto.rotulo}</Rotulo>
          <span style={{ font: '600 15px var(--fonte-titulo)' }}>
            {feitas} de {LADOS.length}
          </span>
        </div>
        <h1
          className="titulo"
          style={{ font: '700 28px/1.12 var(--fonte-titulo)', letterSpacing: '-.01em' }}
        >
          {texto.titulo}
        </h1>
        <p className="apoio" style={{ fontSize: 15 }}>
          Em caso de Disputa, as fotos protegem você. São opcionais: a Corrida segue sem elas.
        </p>
        <div
          role="note"
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--linha-fina)',
            font: '400 14px/1.45 var(--fonte-texto)',
          }}
        >
          Prévia: as fotos ainda não são gravadas. O envio com hora e GPS do servidor chega na
          próxima versão.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LADOS.map((lado, i) => {
            const foto = lista[i];
            const destaque = i === proxima;
            return (
              <button
                key={lado}
                type="button"
                onClick={() => ir(`/camera/${etapa}/${i}`)}
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
                    Feita
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="espaco" />
        {ladoProximo ? (
          <>
            <Botao grande onClick={() => ir(`/camera/${etapa}/${proxima}`)}>
              Tirar foto da {ladoProximo.toLowerCase()}
            </Botao>
            <Link centro onClick={() => ir('/corrida')}>
              Voltar à Corrida
            </Link>
          </>
        ) : (
          <Botao grande onClick={() => ir('/corrida')}>
            Voltar à Corrida
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
  if ((etapa !== 'antes' && etapa !== 'depois') || !nomeLado) {
    return <Navigate to="/corrida" replace />;
  }
  const gps = (etapa === 'antes' ? GPS[indice] : undefined) ?? GPS_DESTINO;
  const voltar = `/fotos/${etapa}`;

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
          style={{ font: '500 16px var(--fonte-texto)', minWidth: 44, minHeight: 44 }}
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
