import { useNavigate } from 'react-router-dom';
import { formatarReais } from '@guinchei/ui';
import type { CorridaHistorico } from '@guinchei/mock';
import { Abas, Corpo, IndicadorHome, Tela } from '@guinchei/ui';
import { useFluxo } from '../fluxo';

export function CartaoCorrida({ c, compacto }: { c: CorridaHistorico; compacto?: boolean }) {
  const cancelada = c.estado === 'Cancelada';
  return (
    <div
      className="cartao"
      style={{
        padding: compacto ? 16 : 18,
        display: 'flex',
        flexDirection: 'column',
        gap: compacto ? 8 : 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          font: '500 13px var(--fonte-texto)',
          color: 'var(--tinta-2)',
        }}
      >
        <span>{c.km ? `${c.quando} · ${c.km}` : c.quando}</span>
        <span style={{ color: cancelada ? 'var(--alerta-texto)' : 'var(--sucesso-texto)' }}>
          {c.estado}
        </span>
      </div>
      <div style={{ font: `600 ${compacto ? 16 : 17}px/1.3 var(--fonte-titulo)` }}>{c.trecho}</div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          font: '400 14px var(--fonte-texto)',
          color: 'var(--tinta-2)',
        }}
      >
        <span>{c.nota ? `${c.pessoa} · você deu ${c.nota}` : c.pessoa}</span>
        <span style={{ font: '600 16px var(--fonte-titulo)', color: 'var(--tinta)' }}>
          {formatarReais(c.valor)}
        </span>
      </div>
    </div>
  );
}

export function Historico() {
  const ir = useNavigate();
  const { historico, novoPedido } = useFluxo();
  return (
    <Tela rotulo="Histórico de Corridas" semRodape>
      <Corpo style={{ padding: '16px 20px 16px', gap: 14 }}>
        <h1 className="titulo" style={{ margin: '8px 4px 6px', lineHeight: 1.2 }}>
          Suas Corridas
        </h1>
        {historico.map((c, i) => (
          <CartaoCorrida key={i} c={c} />
        ))}
      </Corpo>
      <Abas
        abas={[
          { valor: 'pedir', rotulo: 'Pedir' },
          { valor: 'historico', rotulo: 'Histórico' },
          { valor: 'conta', rotulo: 'Conta', emBreve: true },
        ]}
        atual="historico"
        onChange={(aba) => {
          if (aba !== 'pedir') return;
          novoPedido();
          ir('/pedido/1');
        }}
      >
        <IndicadorHome />
      </Abas>
    </Tela>
  );
}
