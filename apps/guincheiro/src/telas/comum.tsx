import { useNavigate } from 'react-router-dom';
import type { OfertaAberta } from '@guinchei/api';
import { RODAS, SITUACOES, VEICULOS } from '@guinchei/mock';
import { Abas, IndicadorHome } from '@guinchei/ui';

export function AbasGuincheiro({
  atual,
  escura,
}: {
  atual: 'plantao' | 'corridas';
  escura?: boolean;
}) {
  const ir = useNavigate();
  return (
    <Abas
      escura={escura}
      abas={[
        { valor: 'plantao', rotulo: 'Plantão' },
        { valor: 'corridas', rotulo: 'Corridas' },
        { valor: 'conta', rotulo: 'Conta', emBreve: true },
      ]}
      atual={atual}
      onChange={(aba) => {
        if (aba === 'plantao') ir('/');
        if (aba === 'corridas') ir('/corridas');
      }}
    >
      <IndicadorHome />
    </Abas>
  );
}

export const somaRepasses = (lista: { valor: number }[]) => lista.reduce((s, c) => s + c.valor, 0);

/** Os três chips do Pedido: veículo, situação e "as 4 rodas giram?". */
export function chipsDoPedido(pedido: OfertaAberta['pedido']): string[] {
  return [
    VEICULOS.find((v) => v.valor === pedido.tipoVeiculo)?.rotulo ?? pedido.tipoVeiculo,
    SITUACOES.find((s) => s.valor === pedido.situacao)?.curto ?? pedido.situacao,
    RODAS.find((r) => r.valor === pedido.rodasGiram)?.chip ?? pedido.rodasGiram,
  ];
}

export function Chips({ itens }: { itens: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {itens.map((c) => (
        <span
          key={c}
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            background: 'var(--superficie-escura)',
            font: '500 14px var(--fonte-texto)',
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export function Navegacao({ rotulo, endereco }: { rotulo: string; endereco: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: 'calc(max(var(--topo), 0px) + 10px)',
        padding: '16px 18px',
        borderRadius: 16,
        background: 'var(--grafite)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        zIndex: 1,
      }}
      className="navegacao"
    >
      <span style={{ font: '400 14px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
        {rotulo}
      </span>
      <span style={{ font: '700 22px/1.2 var(--fonte-titulo)' }}>{endereco}</span>
    </div>
  );
}
