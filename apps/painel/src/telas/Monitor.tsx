import type { IndicadoresDoMonitor } from '@guinchei/api';
import { Mapa, formatarReais, type Marcador } from '@guinchei/ui';
import { useOperacao } from '../operacao';
import { projetarNoMapa } from '../projecao';

const ROTULO_ESTADO = {
  em_match: 'Procurando Guincheiro',
  sem_guincheiro: 'Sem Guincheiro',
  aceita: 'Aceita',
  a_caminho: 'A caminho',
  no_local: 'No local',
  carregado: 'Carregado',
  entregue: 'Entregue',
} as const;

const COLUNAS = '88px 1fr 110px 70px';
/** Onde cabem os marcadores no mapa de 604×700 (borda de 60 e marcador de 26). */
const AREA_DO_MAPA = { left: 60, top: 60, largura: 604 - 120 - 26, altura: 700 - 120 - 26 };

/** "86%" e "25 de 29 Corridas aceitas hoje"; "—" enquanto não há Corrida aceita hoje. */
function atendidosRapido(indicadores: IndicadoresDoMonitor | null) {
  if (!indicadores) return { pct: '—', de: 'Lendo…' };
  const { atendidos, total } = indicadores.atendidosRapido;
  if (total === 0) return { pct: '—', de: 'Nenhuma Corrida aceita hoje' };
  return {
    pct: `${Math.round((atendidos / total) * 100)}%`,
    de: `${atendidos} de ${total} ${total === 1 ? 'Corrida aceita' : 'Corridas aceitas'} hoje`,
  };
}

/** "4,6" e "12 avaliações em 7 dias"; "—" enquanto nenhuma Corrida foi avaliada na janela. */
function notaMedia(indicadores: IndicadoresDoMonitor | null) {
  if (!indicadores) return { valor: '—', legenda: 'Lendo…' };
  const { media, total } = indicadores.notaMedia;
  if (media === null || total === 0)
    return { valor: '—', legenda: 'Nenhuma avaliação nos últimos 7 dias' };
  return {
    valor: media.toFixed(1).replace('.', ','),
    legenda: `${total} ${total === 1 ? 'avaliação' : 'avaliações'} de Clientes em 7 dias`,
  };
}

/** Horário de Brasília do prazo para o Cliente responder. */
function horaDeBrasilia(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export function Monitor() {
  const { corridas: lidas, indicadores, erroMonitor, aguardandoAprovacao } = useOperacao();
  const corridas = lidas ?? [];
  const aguardando = aguardandoAprovacao ?? [];
  const semGuincheiro = corridas.filter((c) => c.estado === 'sem_guincheiro');
  const emMatch = corridas.filter((c) => c.estado === 'em_match');
  const destacado = [...semGuincheiro].sort((a, b) => b.minutos - a.minutos)[0];
  const rapido = atendidosRapido(indicadores);
  const nota = notaMedia(indicadores);
  // Um marcador por Pedido com origem legível, na posição projetada do DF.
  const marcadores = corridas.flatMap((c) =>
    c.origem
      ? [
          {
            pedidoId: c.pedidoId,
            marcador: {
              ...projetarNoMapa(c.origem, AREA_DO_MAPA),
              tamanho: 26,
              tipo: c.estado === 'sem_guincheiro' ? 'alerta' : 'guincho',
            } satisfies Marcador,
          },
        ]
      : [],
  );
  const posicaoDoDestacado = marcadores.find((m) => m.pedidoId === destacado?.pedidoId)?.marcador;
  const cartoes: [string, string | number, string | null][] = [
    ['Corridas em curso', indicadores?.corridasEmCurso ?? '—', null],
    ['Guincheiros disponíveis', indicadores?.guincheirosDisponiveis ?? '—', null],
    ['Nota média · 7 dias', nota.valor, nota.legenda],
  ];

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
          {erroMonitor
            ? 'Não foi possível atualizar: mostrando a última leitura'
            : 'Dados reais · atualiza a cada 5 s'}
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
            {rapido.pct}
          </span>
          <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
            {rapido.de}
          </span>
          <span style={{ font: '400 12px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
            Do Pedido à Corrida aceita
          </span>
        </div>
        {cartoes.map(([rotulo, valor, nota]) => (
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
            {nota && (
              <span style={{ font: '400 12px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                {nota}
              </span>
            )}
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
            marcadores={marcadores.map((m) => m.marcador)}
          />
          {destacado && posicaoDoDestacado && (
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
                  left: Math.min(posicaoDoDestacado.left + 34, 340),
                  top: Math.max(posicaoDoDestacado.top - 6, 8),
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'var(--tinta)',
                  color: 'var(--off-white)',
                  font: '600 12px var(--fonte-texto)',
                  whiteSpace: 'nowrap',
                }}
              >
                #{destacado.idCurto} · sem Guincheiro {destacado.minutos} min
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
            {aguardando.map((a) => (
              <div
                key={a.pedidoId}
                role="row"
                aria-label={`Pedido ${a.pedidoId.slice(0, 8)} aguardando aprovação do novo preço`}
                className="linha-tabela"
                style={{
                  gridTemplateColumns: COLUNAS,
                  background: 'var(--alerta-fundo)',
                }}
              >
                <span style={{ font: '600 14px var(--fonte-mono)' }}>{a.pedidoId.slice(0, 8)}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ font: '500 14px var(--fonte-texto)' }}>
                    {a.origemEndereco ?? 'Origem'} → {a.destinoEndereco ?? 'Destino'}
                  </span>
                  <span style={{ font: '400 12px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                    Preço anterior {formatarReais(a.precoAnterior)} · novo preço{' '}
                    {formatarReais(a.precoNovo)}
                  </span>
                </div>
                <span style={{ font: '600 13px var(--fonte-texto)', color: 'var(--alerta-texto)' }}>
                  Aguardando aprovação do Cliente
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    font: '600 12px var(--fonte-titulo)',
                    color: 'var(--alerta-texto)',
                  }}
                >
                  até {horaDeBrasilia(a.expiraEm)}
                </span>
              </div>
            ))}
            {lidas && lidas.length === 0 && aguardando.length === 0 && (
              <div
                style={{
                  padding: '24px 18px',
                  font: '400 14px var(--fonte-texto)',
                  color: 'var(--tinta-2)',
                }}
              >
                Nenhum Pedido em andamento nas últimas 24 h.
              </div>
            )}
            {corridas.map((c) => {
              const alerta = c.estado === 'sem_guincheiro';
              return (
                <div
                  key={c.pedidoId}
                  role="row"
                  aria-label={`Pedido ${c.idCurto}`}
                  className="linha-tabela"
                  style={{
                    gridTemplateColumns: COLUNAS,
                    background: alerta ? 'var(--alerta-fundo)' : undefined,
                  }}
                >
                  <span style={{ font: '600 14px var(--fonte-mono)' }}>{c.idCurto}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: '500 14px var(--fonte-texto)' }}>
                      {c.origemEndereco ?? 'Origem'} → {c.destinoEndereco ?? 'Destino'}
                    </span>
                    <span style={{ font: '400 12px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                      {c.guincheiro
                        ? `${c.guincheiro}${c.frota ? ` · ${c.frota}` : ''}`
                        : c.estado === 'em_match'
                          ? `Procurando há ${c.minutos} min`
                          : 'Aguardando o Cliente: tentar de novo ou estornar'}
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
                {aguardando.length} aguardando aprovação de novo preço
              </span>
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
