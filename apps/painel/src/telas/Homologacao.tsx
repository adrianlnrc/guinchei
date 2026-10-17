import { useState } from 'react';
import type { SituacaoItem } from '@guinchei/mock';
import { useOperacao } from '../operacao';

const COR: Record<SituacaoItem, string | undefined> = {
  Aprovado: 'var(--sucesso-texto)',
  Revisar: undefined,
  Pendente: 'var(--alerta-texto)',
};

export function Homologacao() {
  const { fila, atualizarFrota, avisar } = useOperacao();
  const [selecionada, setSelecionada] = useState(fila[0]?.id);
  const frota = fila.find((f) => f.id === selecionada) ?? fila[0];
  if (!frota) return null;
  const ok = frota.itens.filter((i) => i.situacao === 'Aprovado').length;
  const faltam = frota.itens.length - ok;
  const completa = faltam === 0;
  const ativa = !!frota.ativada;
  const emRevisao = frota.itens.findIndex((i) => i.situacao === 'Revisar');

  const bloquearGuincheiro = () => {
    if (!frota.emRevisao || emRevisao < 0) return;
    const itens = frota.itens.map((item, i) =>
      i === emRevisao
        ? { ...item, status: '3 de 4 · 1 bloqueado', situacao: 'Aprovado' as const }
        : item,
    );
    atualizarFrota({ ...frota, itens });
    avisar(`${frota.emRevisao.guincheiro} bloqueado até enviar a CNH renovada.`);
  };

  return (
    <>
      <aside
        style={{
          width: 340,
          flex: 'none',
          borderRight: '1px solid var(--linha-suave)',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            height: 72,
            flex: 'none',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--linha-suave)',
          }}
          className="topo__titulo"
        >
          Fila de homologação
        </div>
        {fila.map((f) => {
          const atual = f.id === frota.id;
          const okF = f.itens.filter((i) => i.situacao === 'Aprovado').length;
          return (
            <button
              key={f.id}
              type="button"
              aria-current={atual}
              onClick={() => setSelecionada(f.id)}
              style={{
                padding: atual ? '18px 24px 18px 21px' : '18px 24px',
                borderBottom: '1px solid var(--linha-fina)',
                background: atual ? 'var(--off-white)' : undefined,
                borderLeft: atual ? '3px solid var(--tinta)' : undefined,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span style={{ font: '600 16px var(--fonte-titulo)' }}>{f.nome}</span>
              <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                {f.enviado} · {f.resumo}
              </span>
              <span
                style={{
                  font: '500 13px var(--fonte-texto)',
                  color: f.emEnvio ? 'var(--tinta-2)' : undefined,
                }}
              >
                {f.ativada
                  ? 'Ativa'
                  : okF === f.itens.length
                    ? 'Pronta para ativar'
                    : f.emEnvio
                      ? 'Documentos em envio'
                      : `${okF} de ${f.itens.length} itens ok`}
              </span>
            </button>
          );
        })}
      </aside>
      <main className="conteudo">
        <header className="topo">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="topo__titulo">{frota.nome}</span>
            <span className="mono" style={{ fontSize: 13 }}>
              CNPJ {frota.cnpj} · {frota.cidade}
            </span>
          </div>
          <span className={`etiqueta${ativa ? ' etiqueta--ok' : ''}`}>
            {ativa ? 'Ativa' : 'Pendente'}
          </span>
        </header>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: '20px 32px',
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) 380px',
            gap: 24,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="rotulo rotulo--12">Checklist obrigatório · RN03</span>
            <div className="cartao" style={{ borderRadius: 14 }}>
              {frota.itens.map((item, i) => (
                <div
                  key={item.nome}
                  className="linha-tabela"
                  style={{
                    gridTemplateColumns: 'minmax(0,1fr) 116px 72px',
                    gap: 16,
                    padding: '11px 20px',
                    background: i === emRevisao ? 'var(--off-white)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: '600 15px var(--fonte-texto)' }}>{item.nome}</span>
                    <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                      {item.detalhe}
                    </span>
                  </div>
                  <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                    {item.status}
                  </span>
                  <span style={{ font: '600 13px var(--fonte-texto)', color: COR[item.situacao] }}>
                    {item.situacao}
                  </span>
                </div>
              ))}
            </div>
            <div className="espaco" />
            <div style={{ display: 'grid', gap: 10 }}>
              <button
                type="button"
                className="acao acao--contorno"
                disabled={completa}
                onClick={() => avisar(`Pedido de correção enviado à ${frota.nome}.`)}
              >
                Pedir correção à Frota
              </button>
              <button
                type="button"
                className="acao acao--tinta"
                disabled={!completa || ativa}
                onClick={() => {
                  atualizarFrota({ ...frota, ativada: true });
                  avisar(`${frota.nome} ativa. Os Guincheiros já entram no Match.`);
                }}
              >
                {ativa
                  ? 'Frota ativa'
                  : completa
                    ? 'Ativar Frota'
                    : `Ativar Frota · faltam ${faltam} ${faltam === 1 ? 'item' : 'itens'}`}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="rotulo rotulo--12">Documento em revisão</span>
            {frota.emRevisao && emRevisao >= 0 ? (
              <div
                className="cartao"
                style={{
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div className="foto" style={{ height: 180, borderRadius: 10, fontSize: 12 }}>
                  {frota.emRevisao.documento}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    font: '400 14px var(--fonte-texto)',
                  }}
                >
                  {[
                    ['Guincheiro', frota.emRevisao.guincheiro],
                    ['Categoria', frota.emRevisao.categoria],
                  ].map(([r, v]) => (
                    <div key={r} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--tinta-2)' }}>{r}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--tinta-2)' }}>Validade</span>
                    <span style={{ color: 'var(--alerta-texto)', fontWeight: 600 }}>
                      {frota.emRevisao.validade}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'var(--linha-fina)',
                    font: '400 13px/1.5 var(--fonte-texto)',
                  }}
                >
                  {frota.emRevisao.nota}
                </div>
                <button type="button" className="acao acao--contorno" onClick={bloquearGuincheiro}>
                  Bloquear Guincheiro e aprovar item
                </button>
              </div>
            ) : (
              <p className="apoio" style={{ fontSize: 14 }}>
                Nenhum documento aguardando revisão.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
