import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { CorridaDoGuincheiro } from '@guinchei/api';
import { formatarHora, formatarKm, formatarReais, formatarPercentual } from '@guinchei/ui';
import { TABELA_PADRAO } from '@guinchei/preco';
import { Botao, Corpo, Heroi, Nota, Ponto, Segmentado, Tela, Valores } from '@guinchei/ui';
import { useApi } from '../api';
import { usePlantao } from '../plantao';
import { AbasGuincheiro, somaRepasses } from './comum';

export function Repasse() {
  const ir = useNavigate();
  const api = useApi();
  const { id } = useParams();
  const { encerrar, setGuincheiro } = usePlantao();
  // undefined: ainda lendo; null: Corrida não encontrada.
  const [corrida, setCorrida] = useState<CorridaDoGuincheiro | null | undefined>(undefined);
  const [nota, setNota] = useState<number | null>(null);

  useEffect(() => {
    let vigente = true;
    api
      .buscarCorrida(id ?? '')
      .catch(() => null)
      .then((c) => vigente && setCorrida(c));
    // Entregue, o banco devolveu o Guincheiro ao plantão: traz isso para a tela já.
    api
      .buscarMeuGuincheiro()
      .then((meu) => vigente && meu && setGuincheiro(meu))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [api, id, setGuincheiro]);

  if (corrida === undefined)
    return (
      <Tela escura rotulo="Carregando">
        {null}
      </Tela>
    );
  if (corrida === null || corrida.estado !== 'entregue') return <Navigate to="/" replace />;

  const fim = new Date(corrida.atualizadoEm);
  const { pedido } = corrida;

  return (
    <Tela escura rotulo="Repasse e avaliação do Cliente">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Ponto style={{ marginTop: 12 }}>Corrida encerrada às {formatarHora(fim)}</Ponto>
        <span style={{ font: '400 15px var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
          Seu repasse
        </span>
        <Heroi centavos={corrida.repasse} tamanho={64} />
        <Valores
          escuro
          style={{ padding: '4px 18px' }}
          linhas={[
            ...(corrida.precoRecalculado !== null
              ? ([
                  ['Preço pela sua distância', formatarReais(corrida.precoRecalculado)],
                  [
                    `Comissão Guinchei · ${formatarPercentual(TABELA_PADRAO.comissao)}`,
                    `− ${formatarReais(corrida.precoRecalculado - corrida.repasse)}`,
                  ],
                ] as [string, string][])
              : []),
            ['Cai na conta da Frota', 'em até 1 dia útil'],
          ]}
        />
        <div style={{ height: 1, background: 'var(--linha-escura)', margin: '4px 0' }} />
        <span style={{ font: '600 20px var(--fonte-titulo)' }}>Como foi com o Cliente?</span>
        <Nota escura valor={nota} onChange={setNota} />
        <p className="apoio" style={{ fontSize: 13 }}>
          Prévia: a avaliação ainda não é enviada.
        </p>
        <div className="espaco" />
        <Botao
          variante="claro"
          grande
          onClick={() => {
            encerrar({
              quando: formatarHora(fim),
              km: formatarKm((corrida.kmAteVeiculo ?? 0) + (pedido.kmRebocado ?? 0)),
              trecho: `${pedido.origemEndereco ?? 'Origem'} → ${pedido.destinoEndereco ?? 'Destino'}`,
              pessoa: 'Cliente',
              nota: nota ?? undefined,
              valor: corrida.repasse,
              estado: 'Entregue',
            });
            ir('/', { replace: true });
          }}
        >
          Voltar ao plantão
        </Botao>
      </Corpo>
    </Tela>
  );
}

type Periodo = 'hoje' | 'semana' | 'mes';

export function Historico() {
  const { historico } = usePlantao();
  const [periodo, setPeriodo] = useState<Periodo>('hoje');
  return (
    <Tela rotulo="Histórico de Corridas" semRodape>
      <Corpo style={{ padding: '16px 20px 16px', gap: 14 }}>
        <h1 className="titulo" style={{ margin: '8px 4px 0', lineHeight: 1.2 }}>
          Suas Corridas
        </h1>
        <Segmentado
          valor={periodo}
          onChange={setPeriodo}
          opcoes={[
            { valor: 'hoje', rotulo: 'Hoje' },
            { valor: 'semana', rotulo: 'Semana' },
            { valor: 'mes', rotulo: 'Mês' },
          ]}
        />
        {periodo === 'hoje' ? (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '4px 4px 0',
              }}
            >
              <span style={{ font: '500 15px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                {historico.length} Corridas · repasses
              </span>
              <span style={{ font: '700 26px var(--fonte-titulo)' }}>
                {formatarReais(somaRepasses(historico))}
              </span>
            </div>
            {historico.map((c, i) => (
              <div
                key={i}
                className="cartao"
                style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    font: '500 13px var(--fonte-texto)',
                    color: 'var(--tinta-2)',
                  }}
                >
                  <span>
                    {c.quando} · {c.km}
                  </span>
                  <span style={{ color: 'var(--sucesso-texto)' }}>{c.estado}</span>
                </div>
                <div style={{ font: '600 16px/1.3 var(--fonte-titulo)' }}>{c.trecho}</div>
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
            ))}
          </>
        ) : (
          <p className="apoio" style={{ fontSize: 15, padding: '8px 4px' }}>
            No protótipo só há as Corridas de hoje. Semana e mês entram com o back-end.
          </p>
        )}
      </Corpo>
      <AbasGuincheiro atual="corridas" />
    </Tela>
  );
}
