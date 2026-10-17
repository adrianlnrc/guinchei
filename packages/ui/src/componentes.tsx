import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { partesReais } from './formato';

type VarianteBotao = 'primario' | 'tinta' | 'claro' | 'contorno' | 'contorno-escuro' | 'perigo';

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  grande?: boolean;
}

export function Botao({
  variante = 'primario',
  grande,
  className,
  type = 'button',
  ...resto
}: BotaoProps) {
  const classes = ['botao', `botao--${variante}`, grande && 'botao--grande', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...resto} />;
}

export function Link({
  centro,
  className,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { centro?: boolean }) {
  return (
    <button
      type="button"
      className={['link', centro && 'link--centro', className].filter(Boolean).join(' ')}
      {...resto}
    />
  );
}

export function Rotulo({
  children,
  style,
  pequeno,
}: {
  children: ReactNode;
  style?: CSSProperties;
  pequeno?: boolean;
}) {
  return (
    <div className={`rotulo${pequeno ? ' rotulo--12' : ''}`} style={style}>
      {children}
    </div>
  );
}

/** Número-herói em âmbar, com centavos em meio tamanho. */
export function Heroi({
  centavos,
  tamanho = 72,
  cor,
  style,
}: {
  centavos: number;
  tamanho?: number;
  cor?: string;
  style?: CSSProperties;
}) {
  const { inteiro, centavos: dec } = partesReais(centavos);
  return (
    <span className="heroi" style={{ fontSize: tamanho, color: cor, ...style }}>
      {inteiro}
      <span style={{ fontSize: tamanho / 2 }}>{dec}</span>
    </span>
  );
}

export function Valores({
  linhas,
  escuro,
  style,
}: {
  linhas: [ReactNode, ReactNode][];
  escuro?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className={`cartao valores${escuro ? ' cartao--escuro' : ''}`} style={style}>
      {linhas.map(([rotulo, valor], i) => (
        <div className="valores__linha" key={i}>
          <span>{rotulo}</span>
          <span>{valor}</span>
        </div>
      ))}
    </div>
  );
}

export function Ponto({
  children,
  verde,
  style,
}: {
  children: ReactNode;
  verde?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span className={`ponto${verde ? ' ponto--verde' : ''}`} style={style}>
      {children}
    </span>
  );
}

export function Avatar({
  iniciais,
  tamanho = 52,
  fundo,
  style,
}: {
  iniciais: string;
  tamanho?: number;
  fundo?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className="avatar"
      style={{ width: tamanho, height: tamanho, background: fundo, ...style }}
      aria-hidden
    >
      {iniciais}
    </div>
  );
}

export function Foto({
  legenda,
  altura,
  pequena,
  vazia,
  style,
}: {
  legenda?: string;
  altura: number;
  pequena?: boolean;
  vazia?: boolean;
  style?: CSSProperties;
}) {
  const classes = ['foto', pequena && 'foto--pequena', vazia && 'foto--vazia']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} style={{ height: altura, ...style }}>
      {legenda}
    </div>
  );
}

export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  style,
}: {
  opcoes: readonly { valor: T; rotulo: string }[];
  valor: T;
  onChange: (v: T) => void;
  style?: CSSProperties;
}) {
  return (
    <div
      className="segmentado"
      style={{ gridTemplateColumns: `repeat(${opcoes.length}, 1fr)`, ...style }}
      role="group"
    >
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === valor}
          onClick={() => onChange(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export function Nota({
  valor,
  onChange,
  escura,
}: {
  valor: number | null;
  onChange: (n: number) => void;
  escura?: boolean;
}) {
  return (
    <div className={`nota${escura ? ' nota--escura' : ''}`} role="group" aria-label="Nota de 1 a 5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-pressed={valor === n} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
    </div>
  );
}

const ROTULOS_ETAPAS = ['A caminho', 'No local', 'Carregado', 'Entregue'] as const;

/** Barra de etapas da Corrida. `atual` vai de 0 (a caminho) a 3 (entregue). */
export function Etapas({ atual, escura }: { atual: number; escura?: boolean }) {
  return (
    <div className={`etapas${escura ? ' etapas--escura' : ''}`}>
      {ROTULOS_ETAPAS.map((rotulo, i) => (
        <div
          key={rotulo}
          className={[
            'etapas__item',
            i <= atual && 'etapas__item--feita',
            i === atual && 'etapas__item--atual',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-current={i === atual ? 'step' : undefined}
        >
          <div className="etapas__barra" />
          {rotulo}
        </div>
      ))}
    </div>
  );
}

export function Progresso({ total, feitos }: { total: number; feitos: number }) {
  return (
    <div className="progresso" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={i < feitos ? 'feito' : undefined} />
      ))}
    </div>
  );
}

export function Abas<T extends string>({
  abas,
  atual,
  onChange,
  escura,
  children,
}: {
  /** `emBreve` mostra a aba desabilitada, com a indicação "em breve". */
  abas: readonly { valor: T; rotulo: string; emBreve?: boolean }[];
  atual: T;
  onChange: (v: T) => void;
  escura?: boolean;
  children?: ReactNode;
}) {
  return (
    <nav className={`abas${escura ? ' abas--escura' : ''}`}>
      <div className="abas__grade">
        {abas.map((a) =>
          a.emBreve ? (
            <button
              key={a.valor}
              type="button"
              aria-disabled="true"
              aria-label={`${a.rotulo}, em breve`}
              className="abas__em-breve"
            >
              {a.rotulo}
              <small>em breve</small>
            </button>
          ) : (
            <button
              key={a.valor}
              type="button"
              aria-current={a.valor === atual ? 'page' : undefined}
              onClick={() => onChange(a.valor)}
            >
              {a.rotulo}
            </button>
          ),
        )}
      </div>
      {children}
    </nav>
  );
}

export function Trecho({
  origem,
  destino,
  rotuloOrigem,
  rotuloDestino,
  compacto,
}: {
  origem: string;
  destino: string;
  rotuloOrigem: string;
  rotuloDestino: string;
  compacto?: boolean;
}) {
  const pad = compacto ? { paddingTop: 12, paddingBottom: 12 } : undefined;
  const fonte = compacto ? { fontSize: 15 } : undefined;
  return (
    <div className="trecho">
      <div className="trecho__item" style={pad}>
        <span className="trecho__marca trecho__marca--origem" />
        <div className="trecho__texto" style={fonte}>
          <small>{rotuloOrigem}</small>
          {origem}
        </div>
      </div>
      <div className="trecho__item" style={pad}>
        <span className="trecho__marca" />
        <div className="trecho__texto" style={fonte}>
          <small>{rotuloDestino}</small>
          {destino}
        </div>
      </div>
    </div>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="aviso" role="status">
      {children}
    </div>
  );
}
