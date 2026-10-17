import { useState } from 'react';
import { formatarReais } from '@guinchei/ui';
import { DISPUTA } from '@guinchei/mock';
import { useOperacao } from '../operacao';

export function Disputa() {
  const { disputasAbertas, resolverDisputa, avisar } = useOperacao();
  const [lado, setLado] = useState<string>('Traseira');
  const [decisao, setDecisao] = useState<string | undefined>(DISPUTA.decisoes[0]);
  const resolvida = disputasAbertas === 0;
  const fotos = DISPUTA.fotos.Traseira;

  return (
    <main className="conteudo">
      <header className="topo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="topo__titulo">{DISPUTA.titulo}</span>
          <span className="topo__sub">{DISPUTA.subtitulo}</span>
        </div>
        <span className={`etiqueta ${resolvida ? 'etiqueta--ok' : 'etiqueta--alerta'}`}>
          {resolvida ? 'Resolvida' : 'Em análise'}
        </span>
      </header>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '28px 32px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 400px',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="rotulo rotulo--12">Fotos de estado · {lado.toLowerCase()}</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              ['antes de carregar', fotos.antes],
              ['depois de entregar', fotos.depois],
            ].map(([legenda, f]) => {
              const foto = f as typeof fotos.antes;
              return (
                <div
                  key={legenda as string}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <div className="foto" style={{ height: 280, fontSize: 12 }}>
                    {lado === 'Foto do Cliente'
                      ? 'foto enviada pelo Cliente'
                      : `${legenda as string} · ${lado.toLowerCase()}`}
                  </div>
                  <span style={{ font: '600 14px var(--fonte-texto)' }}>{foto.quando}</span>
                  <span className="mono">{foto.gps}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Lado do veículo">
            {DISPUTA.lados.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={l === lado}
                onClick={() => setLado(l)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  font: '500 13px var(--fonte-texto)',
                  ...(l === lado
                    ? { background: 'var(--tinta)', color: 'var(--off-white)' }
                    : { background: '#fff', border: '1px solid var(--linha)' }),
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 4 }}>
            {[
              [`Relato do Cliente · ${DISPUTA.relatoCliente.autor}`, DISPUTA.relatoCliente.texto],
              [
                `Relato do Guincheiro · ${DISPUTA.relatoGuincheiro.autor}`,
                DISPUTA.relatoGuincheiro.texto,
              ],
            ].map(([titulo, texto]) => (
              <div
                key={titulo}
                className="cartao"
                style={{
                  padding: 16,
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span style={{ font: '600 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                  {titulo}
                </span>
                <span style={{ font: '400 14px/1.5 var(--fonte-texto)' }}>{texto}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="rotulo rotulo--12">Linha do tempo</span>
          <div className="cartao" style={{ borderRadius: 14, padding: '6px 18px' }}>
            {DISPUTA.linhaDoTempo.map(([evento, hora]) => (
              <div
                key={evento}
                className="valores__linha"
                style={{ padding: '11px 0', fontSize: 14 }}
              >
                <span style={{ color: 'var(--tinta)' }}>{evento}</span>
                <span style={{ color: 'var(--tinta-2)' }}>{hora}</span>
              </div>
            ))}
          </div>
          <div className="cartao" style={{ borderRadius: 14, padding: '6px 18px' }}>
            <div className="valores__linha" style={{ padding: '11px 0', fontSize: 14 }}>
              <span>Preço fechado</span>
              <span>{formatarReais(DISPUTA.precoFechado)}</span>
            </div>
            <div className="valores__linha" style={{ padding: '11px 0', fontSize: 14 }}>
              <span>Guincheiro · nota · Corridas</span>
              <span>{DISPUTA.guincheiroResumo}</span>
            </div>
          </div>
          <div className="espaco" />
          <span className="rotulo rotulo--12">Decisão</span>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            role="radiogroup"
            aria-label="Decisão"
          >
            {DISPUTA.decisoes.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={d === decisao}
                className="escolha"
                disabled={resolvida}
                onClick={() => setDecisao(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="acao acao--tinta"
            disabled={resolvida}
            onClick={() => {
              resolverDisputa();
              avisar('Decisão registrada. Cliente e Guincheiro foram avisados.');
            }}
          >
            {resolvida ? 'Decisão registrada' : 'Registrar decisão e avisar as partes'}
          </button>
        </div>
      </div>
    </main>
  );
}
