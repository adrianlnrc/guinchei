import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatarHora, formatarReais } from '@guinchei/ui';
import { CLIENTE, GUINCHEIRO, PRECO, type CorridaHistorico } from '@guinchei/mock';
import { Abas, Botao, Corpo, Foto, IndicadorHome, Nota, Ponto, Tela } from '@guinchei/ui';
import { useFluxo } from '../fluxo';
import { dataHistorico } from './Corrida';

export function Entregue() {
  const ir = useNavigate();
  const { registrar } = useFluxo();
  const [nota, setNota] = useState<number | null>(null);
  const [entrega] = useState(() => new Date());
  const hora = formatarHora(entrega);

  function enviar() {
    registrar({
      quando: dataHistorico(entrega),
      trecho: 'Eixo Monumental → Taguatinga Norte',
      pessoa: GUINCHEIRO.nome,
      nota: nota ?? undefined,
      valor: PRECO.total,
      estado: 'Entregue',
    });
    ir('/historico', { replace: true });
  }

  return (
    <Tela rotulo="Entregue: avaliação">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Ponto verde style={{ marginTop: 16 }}>
          Entregue às {hora}
        </Ponto>
        <h1
          className="titulo"
          style={{ font: '700 30px/1.12 var(--fonte-titulo)', letterSpacing: '-.01em' }}
        >
          Pronto, {CLIENTE.nome}. Seu carro chegou à oficina.
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <Foto key={i} altura={72} pequena />
          ))}
        </div>
        <div style={{ font: '400 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
          Fotos de estado depois da entrega · {hora}
        </div>
        <div style={{ height: 1, background: 'var(--linha-suave)', margin: '4px 0' }} />
        <div style={{ font: '600 20px var(--fonte-titulo)' }}>
          Como foi com o {GUINCHEIRO.primeiroNome}?
        </div>
        <Nota valor={nota} onChange={setNota} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            font: '400 13px var(--fonte-texto)',
            color: 'var(--tinta-2)',
          }}
        >
          <span>Ruim</span>
          <span>Excelente</span>
        </div>
        <div className="espaco" />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            font: '500 15px var(--fonte-texto)',
          }}
        >
          <span style={{ color: 'var(--tinta-2)' }}>Total pago via Pix</span>
          <span>{formatarReais(PRECO.total)}</span>
        </div>
        <Botao disabled={nota === null} onClick={enviar}>
          Enviar avaliação
        </Botao>
      </Corpo>
    </Tela>
  );
}

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
