import { useState } from 'react';
import { calcularPrecoFechado, calcularRepasse, type TabelaPrecos } from '@guinchei/mock';
import { formatarKm, formatarPercentual, formatarReais } from '@guinchei/ui';
import { QUANDO, TRECHO } from '@guinchei/mock';
import { Heroi } from '@guinchei/ui';
import { useOperacao } from '../operacao';

type Tipo = 'reais' | 'reais_km' | 'pct';
type Chave =
  | 'taxaBase'
  | 'deslocamentoPorKm'
  | 'reboquePorKm'
  | 'adicionalNoturno'
  | 'adicionalFeriado'
  | 'taxaCancelamento';

const COMPONENTES: { chave: Chave; nome: string; detalhe: string; tipo: Tipo }[] = [
  { chave: 'taxaBase', nome: 'Taxa base', detalhe: 'Por Pedido, carro de passeio', tipo: 'reais' },
  {
    chave: 'deslocamentoPorKm',
    nome: 'Deslocamento até o veículo',
    detalhe: 'Cotado com o Guincheiro mais próximo',
    tipo: 'reais_km',
  },
  { chave: 'reboquePorKm', nome: 'Reboque', detalhe: 'Por km rebocado', tipo: 'reais_km' },
  {
    chave: 'adicionalNoturno',
    nome: 'Multiplicador noturno',
    detalhe: '20:00 às 06:00',
    tipo: 'pct',
  },
  {
    chave: 'adicionalFeriado',
    nome: 'Multiplicador feriado',
    detalhe: 'Calendário nacional e distrital',
    tipo: 'pct',
  },
  {
    chave: 'taxaCancelamento',
    nome: 'Taxa de cancelamento',
    detalhe: 'Após “a caminho”, repassada ao Guincheiro',
    tipo: 'reais',
  },
];

// Valor de exemplo do design; a referência real sai de docs/pesquisa/precos-guincho-df.md.
const MEDIA_MERCADO = '~R$ 340';

function exibir(valor: number, tipo: Tipo) {
  if (tipo === 'pct') return String(Math.round(valor * 100));
  return (valor / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function interpretar(texto: string, tipo: Tipo): number | null {
  const n = Number(
    texto
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, ''),
  );
  if (!Number.isFinite(n) || texto.trim() === '') return null;
  return tipo === 'pct' ? n / 100 : Math.round(n * 100);
}

function Campo({
  valor,
  tipo,
  alterado,
  onChange,
  rotulo,
}: {
  valor: number;
  tipo: Tipo;
  alterado: boolean;
  onChange: (v: number) => void;
  rotulo: string;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: alterado ? '11px 13px' : '12px 14px',
        borderRadius: 10,
        border: alterado ? '2px solid var(--tinta)' : '1px solid var(--linha)',
        background: '#fff',
        font: '600 16px var(--fonte-titulo)',
        cursor: 'text',
      }}
    >
      {tipo === 'pct' ? <span>+</span> : <span>R$</span>}
      <input
        aria-label={rotulo}
        inputMode="decimal"
        value={texto ?? exibir(valor, tipo)}
        onChange={(e) => {
          setTexto(e.target.value);
          const v = interpretar(e.target.value, tipo);
          if (v !== null) onChange(v);
        }}
        onBlur={() => setTexto(null)}
        style={{
          width: '100%',
          minWidth: 0,
          border: 0,
          outline: 'none',
          font: 'inherit',
          background: 'transparent',
          padding: 0,
        }}
      />
      {tipo === 'reais_km' && <span style={{ whiteSpace: 'nowrap' }}>/ km</span>}
      {tipo === 'pct' && <span>%</span>}
    </label>
  );
}

export function TabelaDePrecos() {
  const { tabela, publicarTabela, avisar } = useOperacao();
  const [rascunho, setRascunho] = useState<TabelaPrecos>(tabela);
  const alterada = COMPONENTES.some((c) => rascunho[c.chave] !== tabela[c.chave]);
  const preco = calcularPrecoFechado(
    { kmDeslocamento: TRECHO.kmDeslocamento, kmReboque: TRECHO.kmReboque, quando: QUANDO },
    rascunho,
  );
  const repasse = calcularRepasse(preco.total, rascunho);

  return (
    <main className="conteudo">
      <header className="topo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="topo__titulo">Tabela de preços · Distrito Federal</span>
          <span className="topo__sub">
            Versão {tabela.versao} · em vigor desde {tabela.versao === 4 ? '01/10/2026' : 'hoje'}
          </span>
        </div>
        <span style={{ font: '500 14px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
          Alterações valem só para Pedidos novos
        </span>
      </header>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '28px 32px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 420px',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="rotulo rotulo--12">Componentes do Preço fechado</span>
          <div className="cartao" style={{ borderRadius: 14 }}>
            {COMPONENTES.map((c) => {
              const mudou = rascunho[c.chave] !== tabela[c.chave];
              return (
                <div
                  key={c.chave}
                  className="linha-tabela"
                  style={{
                    gridTemplateColumns: '1fr 200px',
                    gap: 16,
                    padding: '18px 20px',
                    background: mudou ? 'var(--off-white)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: '600 15px var(--fonte-texto)' }}>{c.nome}</span>
                    <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                      {c.detalhe}
                    </span>
                  </div>
                  <Campo
                    rotulo={c.nome}
                    valor={rascunho[c.chave]}
                    tipo={c.tipo}
                    alterado={mudou}
                    onChange={(v) => setRascunho((r) => ({ ...r, [c.chave]: v }))}
                  />
                </div>
              );
            })}
            <div
              className="linha-tabela"
              style={{ gridTemplateColumns: '1fr 200px', gap: 16, padding: '18px 20px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ font: '600 15px var(--fonte-texto)' }}>Comissão da plataforma</span>
                <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                  RN09 · fixa no MVP
                </span>
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--linha-fina)',
                  font: '600 16px var(--fonte-titulo)',
                  color: 'var(--tinta-2)',
                }}
              >
                {formatarPercentual(rascunho.comissao)}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="rotulo rotulo--12">Simulador</span>
          <div
            style={{
              borderRadius: 14,
              background: 'var(--grafite)',
              color: 'var(--off-white)',
              padding: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Até o veículo', formatarKm(TRECHO.kmDeslocamento)],
                ['Rebocado', formatarKm(TRECHO.kmReboque)],
                ['Horário', '21:47 · noturno'],
                ['Veículo', 'Carro'],
              ].map(([r, v]) => (
                <div
                  key={r}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: 'var(--superficie-escura)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span
                    style={{ font: '400 12px var(--fonte-texto)', color: 'var(--cinza-medio)' }}
                  >
                    {r}
                  </span>
                  <span style={{ font: '600 16px var(--fonte-titulo)' }}>{v}</span>
                </div>
              ))}
            </div>
            <span style={{ font: '400 14px var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
              Preço fechado para o Cliente
            </span>
            <Heroi centavos={preco.total} tamanho={56} />
            <div
              className="cartao--escuro"
              style={{
                display: 'flex',
                flexDirection: 'column',
                font: '400 14px var(--fonte-texto)',
                background: 'none',
              }}
            >
              {[
                ['Repasse ao Guincheiro', formatarReais(repasse.repasse)],
                ['Comissão', formatarReais(repasse.comissao)],
                ['Média de mercado DF, mesmo trecho', MEDIA_MERCADO],
              ].map(([r, v], i, todos) => (
                <div
                  key={r}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom:
                      i < todos.length - 1 ? '1px solid var(--linha-escura)' : undefined,
                  }}
                >
                  <span style={{ color: 'var(--cinza-claro)' }}>{r}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="espaco" />
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="acao acao--contorno"
              style={{ flex: 1, padding: 14 }}
              disabled={!alterada}
              onClick={() => setRascunho(tabela)}
            >
              Descartar
            </button>
            <button
              type="button"
              className="acao acao--tinta"
              style={{ flex: 1, padding: 14 }}
              disabled={!alterada}
              onClick={() => {
                publicarTabela(rascunho);
                setRascunho({ ...rascunho, versao: rascunho.versao + 1 });
                avisar(`Versão ${tabela.versao + 1} publicada. Vale para os próximos Pedidos.`);
              }}
            >
              Publicar versão {tabela.versao + 1}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
