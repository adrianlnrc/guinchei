import { useCallback, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DetalheDoPedido, ResumoDoPedido } from '@guinchei/api';
import {
  Avatar,
  Botao,
  EstrelasLeitura,
  Link,
  Rotulo,
  Trecho,
  Valores,
  formatarKm,
  formatarReais,
} from '@guinchei/ui';
import { useApi } from '../api';
import { TelaComAbas } from '../AbasDoCliente';
import { useCarregar } from '../carregar';
import { useFluxo } from '../fluxo';
import { MensagemDeErro } from '../MensagemDeErro';
import { dataEHora, iniciais, pedidoAtivo, rotuloDaEtapa } from '../rotulos';
import { ExigePerfil } from '../sessao';

// Aba "Corridas": os Pedidos do Cliente, do mais recente ao mais antigo, e o detalhe de cada
// um (preço decomposto, Guincheiro, linha do tempo e avaliação).

/** Cor do estado: verde na entrega, vermelho no que não deu certo, neutro no resto. */
function corDoEstado(etapa: ResumoDoPedido['etapa']): string {
  if (etapa === 'entregue') return 'var(--sucesso-texto)';
  if (etapa === 'estornado' || etapa === 'sem_guincheiro') return 'var(--alerta-texto)';
  return 'var(--tinta-2)';
}

export function Corridas() {
  return (
    <ExigePerfil>
      <Lista />
    </ExigePerfil>
  );
}

function Lista() {
  const api = useApi();
  const ir = useNavigate();
  const { novoPedido } = useFluxo();
  const carregar = useCallback(() => api.listarMinhasCorridas(), [api]);
  const { estado, recarregar } = useCarregar(carregar);

  return (
    <TelaComAbas aba="corridas" rotulo="Corridas">
      <h1 className="titulo" style={{ margin: '8px 4px 6px', lineHeight: 1.2 }}>
        Suas Corridas
      </h1>
      {estado.tipo === 'carregando' && (
        <p className="apoio" role="status" aria-live="polite">
          Carregando suas Corridas…
        </p>
      )}
      {estado.tipo === 'erro' && (
        <>
          <MensagemDeErro>Não foi possível carregar suas Corridas.</MensagemDeErro>
          <Botao variante="contorno" onClick={recarregar}>
            Tentar de novo
          </Botao>
        </>
      )}
      {estado.tipo === 'pronto' && estado.dados.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="apoio">
            Nenhuma Corrida ainda. Quando você pedir um guincho, ele aparece aqui, com o preço e a
            avaliação.
          </p>
          <Botao
            onClick={() => {
              novoPedido();
              ir('/pedido/1');
            }}
          >
            Pedir guincho
          </Botao>
        </div>
      )}
      {estado.tipo === 'pronto' &&
        estado.dados.map((c) => (
          <CartaoDaCorrida
            key={c.pedidoId}
            corrida={c}
            onClick={() => ir(`/corridas/${c.pedidoId}`)}
          />
        ))}
    </TelaComAbas>
  );
}

function CartaoDaCorrida({
  corrida: c,
  onClick,
}: {
  corrida: ResumoDoPedido;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="cartao"
      onClick={onClick}
      style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}
    >
      <span
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          font: '500 13px var(--fonte-texto)',
          color: 'var(--tinta-2)',
        }}
      >
        <span>{dataEHora(c.criadoEm)}</span>
        <span style={{ color: corDoEstado(c.etapa) }}>{rotuloDaEtapa(c.etapa)}</span>
      </span>
      <span style={{ font: '600 16px/1.3 var(--fonte-titulo)' }}>
        {c.origemEndereco ?? 'Origem não informada'} →{' '}
        {c.destinoEndereco ?? 'Destino não informado'}
      </span>
      <span
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          font: '400 14px var(--fonte-texto)',
          color: 'var(--tinta-2)',
        }}
      >
        {c.nota !== null ? (
          <EstrelasLeitura nota={c.nota} />
        ) : (
          <span>{c.etapa === 'entregue' ? 'Sem avaliação' : ''}</span>
        )}
        {c.precoTotal !== null && (
          <span style={{ font: '600 16px var(--fonte-titulo)', color: 'var(--tinta)' }}>
            {formatarReais(c.precoTotal)}
          </span>
        )}
      </span>
    </button>
  );
}

export function DetalheDaCorrida() {
  return (
    <ExigePerfil>
      <Detalhe />
    </ExigePerfil>
  );
}

function Detalhe() {
  const api = useApi();
  const ir = useNavigate();
  const { pedidoId = '' } = useParams();
  const { setPedidoId } = useFluxo();
  const carregar = useCallback(() => api.buscarDetalheDoPedido(pedidoId), [api, pedidoId]);
  const { estado, recarregar } = useCarregar(carregar);

  const voltar = (
    <Link onClick={() => ir('/corridas')} style={{ alignSelf: 'flex-start' }}>
      Voltar às Corridas
    </Link>
  );

  if (estado.tipo === 'carregando') {
    return (
      <TelaComAbas aba="corridas" rotulo="Detalhe da Corrida">
        {voltar}
        <p className="apoio" role="status" aria-live="polite">
          Carregando a Corrida…
        </p>
      </TelaComAbas>
    );
  }
  if (estado.tipo === 'erro') {
    return (
      <TelaComAbas aba="corridas" rotulo="Detalhe da Corrida">
        {voltar}
        <MensagemDeErro>Não foi possível carregar a Corrida.</MensagemDeErro>
        <Botao variante="contorno" onClick={recarregar}>
          Tentar de novo
        </Botao>
      </TelaComAbas>
    );
  }
  const d = estado.dados;
  if (!d) {
    return (
      <TelaComAbas aba="corridas" rotulo="Detalhe da Corrida">
        {voltar}
        <p className="apoio">Não encontramos esta Corrida.</p>
      </TelaComAbas>
    );
  }

  return (
    <TelaComAbas aba="corridas" rotulo="Detalhe da Corrida" estiloDoCorpo={{ gap: 18 }}>
      {voltar}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Rotulo>{dataEHora(d.criadoEm)}</Rotulo>
        <h1 className="titulo" style={{ font: '700 28px/1.12 var(--fonte-titulo)' }}>
          {rotuloDaEtapa(d.etapa)}
        </h1>
      </div>
      <Trecho
        origem={d.origemEndereco ?? 'Não informada'}
        destino={d.destinoEndereco ?? 'Não informado'}
        rotuloOrigem="Origem"
        rotuloDestino="Destino"
      />
      {pedidoAtivo(d.etapa) && (
        <Botao
          onClick={() => {
            setPedidoId(d.pedidoId);
            ir('/acompanhamento');
          }}
        >
          Acompanhar
        </Botao>
      )}
      <Preco d={d} />
      {d.corrida?.guincheiro && <Guincheiro guincheiro={d.corrida.guincheiro} />}
      <LinhaDoTempo d={d} />
      <Avaliacao d={d} onAvaliar={() => ir(`/corridas/${d.pedidoId}/avaliar`)} />
    </TelaComAbas>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 style={{ font: '600 18px var(--fonte-titulo)', margin: 0 }}>{titulo}</h2>
      {children}
    </section>
  );
}

function Preco({ d }: { d: DetalheDoPedido }) {
  const p = d.preco;
  const linhas: [ReactNode, ReactNode][] = [
    ['Taxa base', formatarReais(p.taxaBase)],
    ['Do guincho até o veículo', formatarReais(p.ateVeiculo)],
    ['Reboque', formatarReais(p.rebocado)],
  ];
  if (p.adicionalNoturno > 0) linhas.push(['Adicional noturno', formatarReais(p.adicionalNoturno)]);
  if (p.adicionalFeriado > 0)
    linhas.push(['Adicional de feriado', formatarReais(p.adicionalFeriado)]);
  if (p.ajusteMinimo > 0) linhas.push(['Ajuste ao preço mínimo', formatarReais(p.ajusteMinimo)]);
  if (d.precoTotal !== null) {
    linhas.push([
      <strong key="t">Total</strong>,
      <strong key="v">{formatarReais(d.precoTotal)}</strong>,
    ]);
  }
  return (
    <Secao titulo="Preço">
      <Valores linhas={linhas} />
      {d.kmAteVeiculo !== null && d.kmRebocado !== null && (
        <p className="apoio" style={{ fontSize: 14 }}>
          {formatarKm(d.kmAteVeiculo)} do guincho até o veículo · {formatarKm(d.kmRebocado)}{' '}
          rebocados
        </p>
      )}
    </Secao>
  );
}

function Guincheiro({ guincheiro }: { guincheiro: { nome: string; frota: string | null } }) {
  return (
    <Secao titulo="Guincheiro">
      <div
        className="cartao"
        style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}
      >
        <Avatar iniciais={iniciais(guincheiro.nome)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ font: '600 17px var(--fonte-titulo)' }}>{guincheiro.nome}</span>
          {guincheiro.frota && (
            <span style={{ font: '400 14px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
              {guincheiro.frota}
            </span>
          )}
        </div>
      </div>
    </Secao>
  );
}

/** O banco guarda o horário do Pedido e da Corrida (aceite e última mudança), não cada etapa. */
function LinhaDoTempo({ d }: { d: DetalheDoPedido }) {
  const eventos: { rotulo: string; quando: string | null }[] = [
    { rotulo: 'Pedido aberto', quando: d.criadoEm },
  ];
  if (d.corrida) {
    eventos.push({ rotulo: 'Guincheiro aceitou', quando: d.corrida.aceitaEm });
    if (d.corrida.estado === 'entregue') {
      eventos.push({ rotulo: 'Entregue', quando: d.corrida.atualizadaEm });
    } else {
      eventos.push({ rotulo: `Agora: ${rotuloDaEtapa(d.etapa)}`, quando: null });
    }
  } else if (d.etapa === 'estornado') {
    eventos.push({ rotulo: 'Pagamento estornado', quando: d.atualizadoEm });
  } else {
    eventos.push({ rotulo: `Agora: ${rotuloDaEtapa(d.etapa)}`, quando: null });
  }
  return (
    <Secao titulo="Linha do tempo">
      <ol
        aria-label="Linha do tempo da Corrida"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}
      >
        {eventos.map((e) => (
          <li
            key={e.rotulo}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              font: '400 15px var(--fonte-texto)',
            }}
          >
            <span>{e.rotulo}</span>
            {e.quando && <span style={{ color: 'var(--tinta-2)' }}>{dataEHora(e.quando)}</span>}
          </li>
        ))}
      </ol>
    </Secao>
  );
}

function Avaliacao({ d, onAvaliar }: { d: DetalheDoPedido; onAvaliar: () => void }) {
  if (d.avaliacao) {
    return (
      <Secao titulo="Sua avaliação">
        <div
          className="cartao"
          style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <EstrelasLeitura nota={d.avaliacao.nota} />
          <p style={{ font: '400 15px/1.4 var(--fonte-texto)', margin: 0 }}>
            {d.avaliacao.comentario ?? 'Sem comentário.'}
          </p>
          <span className="apoio" style={{ fontSize: 13 }}>
            Enviada em {dataEHora(d.avaliacao.criadoEm)}. Avaliações não podem ser editadas.
          </span>
        </div>
      </Secao>
    );
  }
  if (d.corrida?.estado === 'entregue') {
    return (
      <Secao titulo="Sua avaliação">
        <p className="apoio">Você ainda não avaliou o atendimento.</p>
        <Botao variante="contorno" onClick={onAvaliar}>
          Avaliar atendimento
        </Botao>
      </Secao>
    );
  }
  return null;
}
