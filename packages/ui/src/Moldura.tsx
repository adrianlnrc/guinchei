import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { formatarHora } from './formato';

export function Moldura({ children }: { children: ReactNode }) {
  return <div className="moldura">{children}</div>;
}

function useRelogio() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return formatarHora(agora);
}

/** Barra de status simulada; só aparece na moldura de desktop. */
export function BarraStatus({ sobreposta = false, cor }: { sobreposta?: boolean; cor?: string }) {
  const hora = useRelogio();
  return (
    <>
      <div
        className={`barra-status${sobreposta ? ' barra-status--sobreposta' : ''}`}
        style={{ color: cor }}
        aria-hidden
      >
        <span>{hora}</span>
        <span className="barra-status__ilha" />
        <span>5G 41%</span>
      </div>
      {!sobreposta && <div className="barra-status--espaco" />}
    </>
  );
}

export function IndicadorHome({
  rodape = false,
  style,
}: {
  rodape?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`indicador-home${rodape ? ' indicador-home--rodape' : ''}`}
      style={style}
      aria-hidden
    />
  );
}

interface TelaProps {
  escura?: boolean;
  /** Mapa ocupa a tela; barra de status e folha ficam sobrepostas. */
  mapa?: boolean;
  fundo?: string;
  /** Sem indicador home no rodapé (a tela posiciona o seu). */
  semRodape?: boolean;
  children: ReactNode;
  rotulo?: string;
}

export function Tela({ escura, mapa, fundo, semRodape, children, rotulo }: TelaProps) {
  const classes = ['tela', escura && 'tela--escura', mapa && 'tela--mapa']
    .filter(Boolean)
    .join(' ');
  return (
    <main className={classes} style={fundo ? { background: fundo } : undefined} aria-label={rotulo}>
      <BarraStatus sobreposta={mapa} />
      {children}
      {!mapa && !semRodape && <IndicadorHome rodape />}
    </main>
  );
}

export function Corpo({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="tela__corpo" style={style}>
      {children}
    </div>
  );
}
