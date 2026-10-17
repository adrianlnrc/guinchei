import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatarHora, formatarKm, formatarReais, formatarPercentual } from '@guinchei/ui';
import { TABELA_PADRAO } from '@guinchei/mock';
import { CLIENTE, LADOS, PRECO, REPASSE, TRECHO } from '@guinchei/mock';
import { Botao, Corpo, Foto, Heroi, Nota, Ponto, Segmentado, Tela, Valores } from '@guinchei/ui';
import { contarFotos, usePlantao } from '../plantao';
import { AbasGuincheiro, somaRepasses } from './comum';

export function ConfirmarEntrega() {
  const ir = useNavigate();
  const { fotos, avancar } = usePlantao();
  const antes = contarFotos(fotos.antes);
  const depois = contarFotos(fotos.depois);
  const completo = antes === LADOS.length && depois === LADOS.length;
  const cor = (n: number) => (n === LADOS.length ? 'var(--sucesso-texto)' : 'var(--tinta)');

  return (
    <Tela rotulo="Confirmar entrega">
      <Corpo style={{ padding: '12px 24px 32px', gap: 16 }}>
        <span className="rotulo">Depois de entregar</span>
        <h1
          className="titulo"
          style={{ font: '700 28px/1.12 var(--fonte-titulo)', letterSpacing: '-.01em' }}
        >
          Carro descarregado. Faltam as fotos finais.
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LADOS.map((lado, i) => {
            const foto = fotos.depois[i];
            return (
              <button
                key={lado}
                type="button"
                onClick={() => ir(`/camera/depois/${i}`)}
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                aria-label={foto ? `${lado}, foto feita` : `Fotografar ${lado}`}
              >
                {foto ? (
                  <Foto altura={110} style={{ width: '100%' }} />
                ) : (
                  <Foto altura={110} vazia legenda="Tirar foto" style={{ width: '100%' }} />
                )}
                <span style={{ font: '400 12px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                  {foto ? `${lado} · ${foto.hora}` : lado}
                </span>
              </button>
            );
          })}
        </div>
        <div
          className="cartao"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              font: '500 15px var(--fonte-texto)',
            }}
          >
            <span>Fotos antes</span>
            <span style={{ color: cor(antes) }}>
              {antes} de {LADOS.length}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              font: '500 15px var(--fonte-texto)',
            }}
          >
            <span>Fotos depois</span>
            <span style={{ color: cor(depois) }}>
              {depois} de {LADOS.length}
            </span>
          </div>
        </div>
        <div className="espaco" />
        <p className="apoio" style={{ fontSize: 13, textAlign: 'center' }}>
          A Corrida só encerra com todas as Fotos de estado.
        </p>
        <Botao
          grande
          disabled={!completo}
          onClick={() => {
            avancar('entregue');
            ir('/repasse', { replace: true });
          }}
        >
          Encerrar Corrida
        </Botao>
      </Corpo>
    </Tela>
  );
}

export function Repasse() {
  const ir = useNavigate();
  const { encerrar } = usePlantao();
  const [nota, setNota] = useState<number | null>(null);
  const [fim] = useState(() => new Date());

  return (
    <Tela escura rotulo="Repasse e avaliação do Cliente">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Ponto style={{ marginTop: 12 }}>Corrida encerrada às {formatarHora(fim)}</Ponto>
        <span style={{ font: '400 15px var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
          Seu repasse
        </span>
        <Heroi centavos={REPASSE.repasse} tamanho={64} />
        <Valores
          escuro
          style={{ padding: '4px 18px' }}
          linhas={[
            ['Preço fechado', formatarReais(PRECO.total)],
            [
              `Comissão Guinchei · ${formatarPercentual(TABELA_PADRAO.comissao)}`,
              `− ${formatarReais(REPASSE.comissao)}`,
            ],
            ['Cai na conta da Frota', 'em até 1 dia útil'],
          ]}
        />
        <div style={{ height: 1, background: 'var(--linha-escura)', margin: '4px 0' }} />
        <span style={{ font: '600 20px var(--fonte-titulo)' }}>Como foi com o {CLIENTE.nome}?</span>
        <Nota escura valor={nota} onChange={setNota} />
        <div className="espaco" />
        <Botao
          variante="claro"
          grande
          disabled={nota === null}
          onClick={() => {
            encerrar({
              quando: formatarHora(fim),
              km: formatarKm(TRECHO.kmDeslocamento + TRECHO.kmReboque),
              trecho: 'Eixo Monumental → Taguatinga Norte',
              pessoa: CLIENTE.nomeCurto,
              nota: nota ?? undefined,
              valor: REPASSE.repasse,
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
