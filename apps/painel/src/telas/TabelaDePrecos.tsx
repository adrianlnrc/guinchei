import { useState } from 'react';
import { COTACAO, TRECHO } from '@guinchei/mock';
import { TABELA_PADRAO, calcularPrecoFechado, calcularRepasse } from '@guinchei/preco';
import { formatarKm, formatarPercentual, formatarReais } from '@guinchei/ui';
import { Heroi } from '@guinchei/ui';
import { useOperacao, type TabelaDoPainel } from '../operacao';

type Tipo = 'reais' | 'reais_km' | 'pct';
type Chave =
  | 'taxaBase'
  | 'porKmAteVeiculo'
  | 'porKmRebocado'
  | 'adicionalNoturno'
  | 'adicionalFeriado'
  | 'precoMinimo'
  | 'taxaCancelamento';

const hora = (h: number) => `${String(h).padStart(2, '0')}:00`;

const COMPONENTES: { chave: Chave; nome: string; detalhe: string; tipo: Tipo }[] = [
  { chave: 'taxaBase', nome: 'Taxa base', detalhe: 'Por Pedido, carro de passeio', tipo: 'reais' },
  {
    chave: 'porKmAteVeiculo',
    nome: 'Deslocamento até o veículo',
    detalhe: 'Cotado com o Guincheiro mais próximo',
    tipo: 'reais_km',
  },
  { chave: 'porKmRebocado', nome: 'Reboque', detalhe: 'Por km rebocado', tipo: 'reais_km' },
  {
    chave: 'adicionalNoturno',
    nome: 'Multiplicador noturno',
    // O período noturno não é editável aqui; o detalhe acompanha a tabela do pacote.
    detalhe: `${hora(TABELA_PADRAO.noturnoDas)} às ${hora(TABELA_PADRAO.noturnoAte)}`,
    tipo: 'pct',
  },
  {
    chave: 'adicionalFeriado',
    nome: 'Multiplicador feriado',
    detalhe: 'Calendário nacional e distrital',
    tipo: 'pct',
  },
  {
    chave: 'precoMinimo',
    nome: 'Preço fechado mínimo',
    detalhe: 'Piso, aplicado depois dos adicionais',
    tipo: 'reais',
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
    useGrouping: false,
  });
}

// "7", "7,5", "7,50" ou "7.50": a vírgula ou um ponto único separam os centavos.
const VALOR_VALIDO = /^\d+(?:[.,]\d{1,2})?$/;

/** Texto digitado → centavos (ou fração, para %); `null` se não for um valor válido. */
function interpretar(texto: string, tipo: Tipo): number | null {
  const limpo = texto.trim();
  if (!VALOR_VALIDO.test(limpo)) return null;
  const n = Number(limpo.replace(',', '.'));
  // O pacote só aceita adicionais de 0 a 100%.
  if (tipo === 'pct') return n <= 100 ? n / 100 : null;
  return Math.round(n * 100);
}

function Campo({
  texto,
  tipo,
  alterado,
  invalido,
  onChange,
  onBlur,
  rotulo,
  idErro,
}: {
  texto: string;
  tipo: Tipo;
  alterado: boolean;
  invalido: boolean;
  onChange: (texto: string) => void;
  onBlur: () => void;
  rotulo: string;
  idErro: string;
}) {
  const destacado = alterado || invalido;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: destacado ? '11px 13px' : '12px 14px',
          borderRadius: 10,
          border: invalido
            ? '2px solid var(--alerta)'
            : alterado
              ? '2px solid var(--tinta)'
              : '1px solid var(--linha)',
          background: '#fff',
          font: '600 16px var(--fonte-titulo)',
          cursor: 'text',
        }}
      >
        {tipo === 'pct' ? <span>+</span> : <span>R$</span>}
        <input
          aria-label={rotulo}
          aria-invalid={invalido}
          aria-describedby={invalido ? idErro : undefined}
          inputMode="decimal"
          value={texto}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
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
      {invalido && (
        <span
          id={idErro}
          style={{ font: '500 13px var(--fonte-texto)', color: 'var(--alerta-texto)' }}
        >
          {tipo === 'pct' ? 'Use um número de 0 a 100, como 15' : 'Use só números, como 7,50'}
        </span>
      )}
    </div>
  );
}

export function TabelaDePrecos() {
  const { tabela, publicarTabela, avisar } = useOperacao();
  const [rascunho, setRascunho] = useState<TabelaDoPainel>(tabela);
  // Texto de cada campo em edição; um campo fora daqui mostra o valor do rascunho.
  const [textos, setTextos] = useState<Partial<Record<Chave, string>>>({});
  const invalido = ({ chave, tipo }: (typeof COMPONENTES)[number]) => {
    const texto = textos[chave];
    return texto !== undefined && interpretar(texto, tipo) === null;
  };
  const algumInvalido = COMPONENTES.some(invalido);
  const alterada = COMPONENTES.some((c) => rascunho[c.chave] !== tabela[c.chave]);
  const preco = calcularPrecoFechado(COTACAO, rascunho);
  const repasse = calcularRepasse(preco.total, rascunho);

  return (
    <main className="conteudo">
      <header className="topo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="topo__titulo">Tabela de preços · Distrito Federal</span>
          <span className="topo__sub">
            Versão {tabela.versao} · em vigor desde{' '}
            {tabela.versao === TABELA_PADRAO.versao ? '01/10/2026' : 'hoje'}
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
                    idErro={`erro-${c.chave}`}
                    texto={textos[c.chave] ?? exibir(rascunho[c.chave], c.tipo)}
                    tipo={c.tipo}
                    alterado={mudou}
                    invalido={invalido(c)}
                    onChange={(texto) => {
                      setTextos((t) => ({ ...t, [c.chave]: texto }));
                      const v = interpretar(texto, c.tipo);
                      if (v !== null) setRascunho((r) => ({ ...r, [c.chave]: v }));
                    }}
                    onBlur={() => {
                      // Ao sair de um campo válido, ele volta a mostrar o valor formatado.
                      if (invalido(c)) return;
                      setTextos((t) => {
                        const resto = { ...t };
                        delete resto[c.chave];
                        return resto;
                      });
                    }}
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
                ...(preco.ajustePiso > 0
                  ? [['Ajuste para o Preço fechado mínimo', formatarReais(preco.ajustePiso)]]
                  : []),
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
              disabled={!alterada && !algumInvalido}
              onClick={() => {
                setRascunho(tabela);
                setTextos({});
              }}
            >
              Descartar
            </button>
            <button
              type="button"
              className="acao acao--tinta"
              style={{ flex: 1, padding: 14 }}
              disabled={!alterada || algumInvalido}
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
