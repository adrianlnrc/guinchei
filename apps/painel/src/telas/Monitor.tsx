import { INDICADORES } from '@guinchei/mock';
import { Mapa, type Marcador } from '@guinchei/ui';
import { useOperacao } from '../operacao';

const ROTULO_ESTADO = {
  em_match: 'Procurando Guincheiro',
  sem_guincheiro: 'Sem Guincheiro',
  aceita: 'Aceita',
  a_caminho: 'A caminho',
  no_local: 'No local',
  carregado: 'Carregado',
  entregue: 'Entregue',
} as const;

const COLUNAS = '64px 1fr 110px 70px';
const POSICOES: Record<number, { left: number; top: number }> = {
  2318: { left: 90, top: 220 },
  2317: { left: 340, top: 150 },
  2316: { left: 230, top: 90 },
  2315: { left: 150, top: 330 },
  2314: { left: 470, top: 410 },
  2312: { left: 250, top: 470 },
  2311: { left: 380, top: 560 },
};

export function Monitor() {
  const { corridas } = useOperacao();
  const semGuincheiro = corridas.filter((c) => c.estado === 'sem_guincheiro');
  const emMatch = corridas.filter((c) => c.estado === 'em_match');
  const emCurso = corridas.length - semGuincheiro.length - emMatch.length;
  const destacado = semGuincheiro[0];
  const marcadores: Marcador[] = corridas.map((c) => ({
    ...(POSICOES[c.id] ?? { left: 0, top: 0 }),
    tamanho: 26,
    tipo: c.estado === 'sem_guincheiro' ? 'alerta' : 'guincho',
  }));

  const resumo = `${emMatch.length} ${emMatch.length === 1 ? 'Pedido procurando' : 'Pedidos procurando'} Guincheiro · ${semGuincheiro.length} sem Guincheiro, aguardando o Cliente`;

  return (
    <main className="conteudo">
      <header className="topo">
        <span className="topo__titulo" style={{ fontSize: 24 }}>
          Monitor de Corridas
        </span>
        <span
          className="ponto"
          style={{ font: '500 14px var(--fonte-texto)', color: 'var(--tinta-2)' }}
        >
          Ao vivo · terça, 21:58
        </span>
      </header>
      <div
        style={{
          padding: '24px 32px 0',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
          gap: 16,
        }}
      >
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            background: 'var(--grafite)',
            color: 'var(--off-white)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <span className="rotulo rotulo--12" style={{ color: 'var(--cinza-medio)' }}>
            Atendidos em menos de 30 min · hoje
          </span>
          <span className="heroi" style={{ fontSize: 44, letterSpacing: '-.02em' }}>
            {INDICADORES.atendidos30.pct}
          </span>
          <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
            {INDICADORES.atendidos30.de}
          </span>
        </div>
        {[
          ['Corridas em curso', emCurso],
          ['Guincheiros disponíveis', INDICADORES.disponiveis],
          ['Nota média · 7 dias', INDICADORES.notaMedia],
        ].map(([rotulo, valor]) => (
          <div
            key={rotulo}
            className="cartao"
            style={{
              padding: 20,
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span style={{ font: '500 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
              {rotulo}
            </span>
            <span style={{ font: '700 36px var(--fonte-titulo)' }}>{valor}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '20px 32px 28px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 520px',
          gap: 20,
        }}
      >
        <div
          style={{
            borderRadius: 14,
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid var(--linha-suave)',
          }}
        >
          <Mapa
            largura={604}
            altura={700}
            borda={60}
            ruas={[
              { top: 220, esp: 20, giro: -10 },
              { top: 420, esp: 14, giro: 5 },
              { left: 200, esp: 14, giro: 12 },
              { left: 430, esp: 12 },
            ]}
            quadras={[
              { left: 260, top: 280, w: 120, h: 80 },
              { left: 80, top: 100, w: 90, h: 70 },
            ]}
            marcadores={marcadores}
          />
          {destacado && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                width: 604,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 120,
                  top: 190,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'var(--tinta)',
                  color: 'var(--off-white)',
                  font: '600 12px var(--fonte-texto)',
                  whiteSpace: 'nowrap',
                }}
              >
                #{destacado.id} · sem Guincheiro {destacado.minutos} min
              </div>
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              display: 'flex',
              gap: 16,
              padding: '10px 14px',
              borderRadius: 10,
              background: '#fff',
              font: '500 13px var(--fonte-texto)',
            }}
          >
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span
                style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--apoio)' }}
              />
              Corrida em curso
            </span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span
                style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--alerta)' }}
              />
              Sem Guincheiro
            </span>
          </div>
        </div>
        <div
          className="cartao"
          style={{
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            className="linha-tabela"
            style={{
              gridTemplateColumns: COLUNAS,
              borderBottom: '1px solid var(--linha-suave)',
              font: '600 12px var(--fonte-titulo)',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'var(--tinta-2)',
            }}
          >
            <span>Pedido</span>
            <span>Trecho · Guincheiro</span>
            <span>Estado</span>
            <span style={{ textAlign: 'right' }}>Tempo</span>
          </div>
          <div style={{ overflowY: 'auto' }}>
            {corridas.map((c) => {
              const alerta = c.estado === 'sem_guincheiro';
              return (
                <div
                  key={c.id}
                  className="linha-tabela"
                  style={{
                    gridTemplateColumns: COLUNAS,
                    background: alerta ? 'var(--alerta-fundo)' : undefined,
                  }}
                >
                  <span style={{ font: '600 14px var(--fonte-mono)' }}>{c.id}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: '500 14px var(--fonte-texto)' }}>{c.trecho}</span>
                    <span style={{ font: '400 12px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                      {c.guincheiro ??
                        (c.estado === 'em_match'
                          ? `Tentativa ${c.tentativa} · há ${c.minutos} min`
                          : c.detalhe)}
                    </span>
                  </div>
                  <span
                    style={{
                      font: `${alerta ? 600 : 500} 13px var(--fonte-texto)`,
                      color: alerta ? 'var(--alerta-texto)' : undefined,
                    }}
                  >
                    {ROTULO_ESTADO[c.estado]}
                  </span>
                  <span
                    style={{
                      textAlign: 'right',
                      font: '600 14px var(--fonte-titulo)',
                      color: alerta ? 'var(--alerta-texto)' : undefined,
                    }}
                  >
                    {c.minutos} min
                  </span>
                </div>
              );
            })}
          </div>
          <div className="espaco" />
          <div
            style={{
              padding: '14px 18px',
              borderTop: '1px solid var(--linha-suave)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: '500 13px var(--fonte-texto)' }}>{resumo}</span>
              <span style={{ font: '400 12px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                O Match atribui o Guincheiro sozinho.
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
