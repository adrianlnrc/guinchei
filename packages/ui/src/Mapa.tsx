import type { CSSProperties } from 'react';

/** Rua: horizontal (`top`) ou vertical (`left`), com espessura e giro em graus. */
export type Rua =
  { top: number; esp: number; giro?: number } | { left: number; esp: number; giro?: number };
export interface Quadra {
  left: number;
  top: number;
  w: number;
  h: number;
}
export interface Marcador {
  left: number;
  top: number;
  tamanho: number;
  tipo: 'origem' | 'destino' | 'guincho' | 'alerta';
}

interface MapaProps {
  ruas: Rua[];
  quadras?: Quadra[];
  /** Pontos no sistema 370×824 da tela */
  rota?: string;
  rotaTracejada?: boolean;
  rotaEspessura?: number;
  marcadores?: Marcador[];
  escuro?: boolean;
  /** Espaço de coordenadas do SVG da rota */
  viewBox?: string;
  style?: CSSProperties;
  borda?: number;
  /** Área de desenho; fica centralizada na horizontal */
  largura?: number;
  altura?: number;
}

/** Mapa esquemático do protótipo; dá lugar ao Mapbox no skeleton (ADR-0008). */
export function Mapa({
  ruas,
  quadras = [],
  rota,
  rotaTracejada,
  rotaEspessura = 5,
  marcadores = [],
  escuro,
  viewBox,
  style,
  borda = 40,
  largura = 370,
  altura = 824,
}: MapaProps) {
  const corRua = escuro ? '#2A2F39' : '#FFFFFF';
  const anel = escuro ? '#14161B' : '#FFFFFF';
  return (
    <div className={`mapa${escuro ? ' mapa--escuro' : ''}`} style={style} aria-hidden>
      <div className="mapa__area" style={{ width: largura, height: altura }}>
        {ruas.map((r, i) =>
          'top' in r ? (
            <div
              key={i}
              style={{
                left: -borda,
                right: -borda,
                top: r.top,
                height: r.esp,
                background: corRua,
                transform: r.giro ? `rotate(${r.giro}deg)` : undefined,
              }}
            />
          ) : (
            <div
              key={i}
              style={{
                top: -borda,
                bottom: -borda,
                left: r.left,
                width: r.esp,
                background: corRua,
                transform: r.giro ? `rotate(${r.giro}deg)` : undefined,
              }}
            />
          ),
        )}
        {quadras.map((q, i) => (
          <div
            key={i}
            style={{
              left: q.left,
              top: q.top,
              width: q.w,
              height: q.h,
              borderRadius: 8,
              background: 'var(--mapa-quadra)',
            }}
          />
        ))}
        {rota && (
          <svg
            viewBox={viewBox ?? `0 0 ${largura} ${altura}`}
            style={{ inset: 0, width: '100%', height: '100%' }}
          >
            <polyline
              points={rota}
              fill="none"
              stroke="#2E90FA"
              strokeWidth={rotaEspessura}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={rotaTracejada ? '1 10' : undefined}
            />
          </svg>
        )}
        {marcadores.map((m, i) => {
          const fundo =
            m.tipo === 'guincho'
              ? '#2E90FA'
              : m.tipo === 'alerta'
                ? '#F04438'
                : escuro
                  ? '#F6F7F9'
                  : '#0B0C0F';
          return (
            <div
              key={i}
              style={{
                left: m.left,
                top: m.top,
                width: m.tamanho,
                height: m.tamanho,
                borderRadius: m.tipo === 'destino' ? 0 : '50%',
                background: fundo,
                border: `4px solid ${anel}`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
