import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  DURACAO_MAXIMA_VIDEO_SEGUNDOS,
  ErroApi,
  LIMITE_FOTOS_POR_ETAPA,
  type Acompanhamento,
  type EtapaDoAcompanhamento,
  type RecotacaoDoPedido,
} from '@guinchei/api';
import { etapaDaFoto } from '@guinchei/estados';
import { formatarReais } from '@guinchei/ui';
import {
  Avatar,
  Botao,
  Corpo,
  GaleriaFotosEstado,
  Link,
  Ponto,
  RegistrarFotoEstado,
  Tela,
  useFotosEstado,
} from '@guinchei/ui';
import { useApi } from '../api';
import { useFluxo } from '../fluxo';
import { MensagemDeErro } from '../MensagemDeErro';
import { ExigePerfil } from '../sessao';

// Acompanhamento do Cliente por status (RF09 enxuto, issue #14). A tela lê o Pedido e a
// Corrida reais e muda de etapa sozinha pelo Supabase Realtime (`acompanharPedido`). Sem
// mapa em tempo real nem GPS ao vivo (Incremento 1). Cancelar o Pedido (RN05, RF14) fica
// fora do skeleton: o botão aparece desabilitado, "em breve".

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'nenhum' }
  | { tipo: 'pronto'; acompanhamento: Acompanhamento };

/**
 * Lê o estado do Pedido do fluxo (ou, ao reabrir o app, o mais recente em andamento) e
 * assina o Realtime. `atualizar` relê na hora, para depois de "tentar de novo" e "estornar".
 */
function useAcompanhamento(pedidoId: string | null) {
  const api = useApi();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vigente = true;
    let cancelar = () => {};
    (async () => {
      const inicial = pedidoId
        ? await api.buscarAcompanhamento(pedidoId)
        : await api.buscarAcompanhamentoEmAndamento();
      if (!vigente) return;
      if (!inicial) {
        setEstado({ tipo: 'nenhum' });
        return;
      }
      setEstado({ tipo: 'pronto', acompanhamento: inicial });
      cancelar = api.acompanharPedido(inicial.pedidoId, (acompanhamento) => {
        if (vigente) setEstado({ tipo: 'pronto', acompanhamento });
      });
    })().catch(() => {
      if (vigente) setEstado({ tipo: 'erro' });
    });
    return () => {
      vigente = false;
      cancelar();
    };
  }, [api, pedidoId, tentativa]);

  const atualizar = useCallback(
    async (id: string) => {
      const atual = await api.buscarAcompanhamento(id);
      if (atual) setEstado({ tipo: 'pronto', acompanhamento: atual });
    },
    [api],
  );

  return {
    estado,
    atualizar,
    recarregar: () => {
      setEstado({ tipo: 'carregando' });
      setTentativa((n) => n + 1);
    },
  };
}

export function AcompanhamentoDoPedido() {
  return (
    <ExigePerfil>
      <Acompanhando />
    </ExigePerfil>
  );
}

function Acompanhando() {
  const { pedidoId } = useFluxo();
  const { estado, atualizar, recarregar } = useAcompanhamento(pedidoId);

  switch (estado.tipo) {
    case 'carregando':
      return <Tela rotulo="Carregando">{null}</Tela>;
    case 'nenhum':
      // Nada em andamento (nem no fluxo, nem no banco): começa um Pedido novo.
      return <Navigate to="/pedido/1" replace />;
    case 'erro':
      return (
        <Tela rotulo="Acompanhamento">
          <Corpo style={{ padding: '24px', gap: 16 }}>
            <MensagemDeErro>
              Não foi possível carregar o acompanhamento. Verifique a conexão e tente de novo.
            </MensagemDeErro>
            <Botao onClick={recarregar}>Recarregar</Botao>
          </Corpo>
        </Tela>
      );
    case 'pronto':
      return <Etapa acompanhamento={estado.acompanhamento} atualizar={atualizar} />;
  }
}

/** As etapas que a linha do tempo mostra, na ordem. `sem_guincheiro` e `estornado` ficam de fora. */
const LINHA_DO_TEMPO = [
  ['em_match', 'Procurando guincho'],
  ['aceita', 'Guincheiro aceitou'],
  ['a_caminho', 'A caminho'],
  ['no_local', 'No local'],
  ['carregado', 'Veículo carregado'],
  ['entregue', 'Entregue'],
] as const satisfies readonly (readonly [EtapaDoAcompanhamento, string])[];

function Etapa({
  acompanhamento,
  atualizar,
}: {
  acompanhamento: Acompanhamento;
  atualizar: (pedidoId: string) => Promise<void>;
}) {
  switch (acompanhamento.etapa) {
    case 'cotado':
      // Ainda não pagou: volta ao preço.
      return <Navigate to="/preco" replace />;
    case 'em_match':
      return <Procurando preco={acompanhamento.precoTotal} recotacao={acompanhamento.recotacao} />;
    case 'aguardando_aprovacao_preco':
      return <AprovarNovoPreco acompanhamento={acompanhamento} atualizar={atualizar} />;
    case 'sem_guincheiro':
      return <SemGuincheiro pedidoId={acompanhamento.pedidoId} atualizar={atualizar} />;
    case 'estornado':
      return <Estornado valor={acompanhamento.precoTotal} />;
    default:
      return <NaCorrida acompanhamento={acompanhamento} etapa={acompanhamento.etapa} />;
  }
}

function Procurando({
  preco,
  recotacao,
}: {
  preco: number | null;
  recotacao: RecotacaoDoPedido | null;
}) {
  return (
    <Tela escura rotulo="Procurando guincho">
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          padding: '0 32px',
        }}
      >
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: '50%',
            border: '1px solid var(--linha-escura)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="pulso"
        >
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: '50%',
              border: '1px solid var(--borda-escura)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--superficie-escura)',
                border: '1px solid var(--tinta-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--off-white)',
                }}
              />
            </div>
          </div>
        </div>
        <h1
          className="titulo"
          style={{
            textAlign: 'center',
            font: '700 28px/1.15 var(--fonte-titulo)',
            letterSpacing: '-.01em',
          }}
        >
          Chamando o guincho mais próximo
        </h1>
        <p className="apoio" style={{ textAlign: 'center' }} aria-live="polite">
          Pagamento confirmado. Estamos falando com um Guincheiro.
          {preco !== null && ` Seu preço já está travado em ${formatarReais(preco)}.`}
        </p>
        <AvisoDeReducao recotacao={recotacao} escura />
      </div>
      <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column' }}>
        <CancelarEmBreve escura />
      </div>
    </Tela>
  );
}

/**
 * Aviso de que outra empresa vai atender por um preço menor (ADR-0013): o novo preço já vale e
 * a diferença volta ao Cliente. Só a recotação `aplicada` que de fato baixou o preço.
 */
function AvisoDeReducao({
  recotacao,
  escura,
}: {
  recotacao: RecotacaoDoPedido | null;
  escura?: boolean;
}) {
  if (recotacao?.estado !== 'aplicada' || recotacao.precoNovo >= recotacao.precoAnterior) {
    return null;
  }
  return (
    <p
      role="status"
      className="apoio"
      style={{
        textAlign: escura ? 'center' : undefined,
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--linha)',
      }}
    >
      <strong>Outra empresa vai atender.</strong> O preço baixou de{' '}
      {formatarReais(recotacao.precoAnterior)} para {formatarReais(recotacao.precoNovo)}. A
      diferença de {formatarReais(recotacao.precoAnterior - recotacao.precoNovo)} será estornada.
    </p>
  );
}

/** Horário de Brasília do prazo, para a tela dizer até quando o Cliente pode responder. */
function horaDeBrasilia(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function LinhaDoPreco({ rotulo, centavos }: { rotulo: string; centavos: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{rotulo}</span>
      <span>{formatarReais(centavos)}</span>
    </div>
  );
}

/**
 * Pedido redirecionado a outra empresa por um preço maior (ADR-0013): o Match pausou e o
 * Cliente aprova o novo preço (a diferença é autorizada) ou desiste (estorno integral, sem
 * custo). Sem resposta no prazo, vale como desistência.
 */
function AprovarNovoPreco({
  acompanhamento,
  atualizar,
}: {
  acompanhamento: Acompanhamento;
  atualizar: (pedidoId: string) => Promise<void>;
}) {
  const api = useApi();
  const { pedidoId, recotacao } = acompanhamento;
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function agir(acao: () => Promise<unknown>, padrao: string) {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
      await atualizar(pedidoId);
    } catch (e) {
      setErro(mensagemDaAcao(e, padrao));
      // O prazo pode ter vencido: a tela relê e mostra o desfecho.
      if (e instanceof ErroApi && e.motivo === 'prazo_vencido') await atualizar(pedidoId);
    } finally {
      setOcupado(false);
    }
  }

  // Sem a recotação (ainda não chegou na leitura), a tela espera a próxima atualização.
  if (recotacao?.estado !== 'pendente') {
    return (
      <Tela rotulo="Aprovar novo preço">
        <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
          <p className="apoio" aria-live="polite">
            Carregando o novo preço…
          </p>
        </Corpo>
      </Tela>
    );
  }

  const { decomposicao: d } = recotacao;
  return (
    <Tela rotulo="Aprovar novo preço">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <h1
          className="titulo"
          style={{
            font: '700 30px/1.12 var(--fonte-titulo)',
            letterSpacing: '-.01em',
            marginTop: 28,
          }}
        >
          Outra empresa vai atender
        </h1>
        <p className="apoio">
          A empresa que cotou o seu preço não pôde atender. A próxima empresa fica mais longe do seu
          veículo, então o preço muda. Nada é oferecido a ela até você decidir.
        </p>
        <div
          className="cartao"
          style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <LinhaDoPreco rotulo="Preço anterior" centavos={recotacao.precoAnterior} />
          <LinhaDoPreco rotulo="Novo preço" centavos={recotacao.precoNovo} />
          <LinhaDoPreco
            rotulo="Diferença"
            centavos={recotacao.precoNovo - recotacao.precoAnterior}
          />
        </div>
        <div
          role="group"
          aria-label="Decomposição do novo preço"
          className="apoio"
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <LinhaDoPreco rotulo="Taxa base" centavos={d.taxaBase} />
          <LinhaDoPreco rotulo="Até o veículo" centavos={d.ateVeiculo} />
          <LinhaDoPreco rotulo="Reboque" centavos={d.rebocado} />
          {d.adicionalNoturno > 0 && (
            <LinhaDoPreco rotulo="Adicional noturno" centavos={d.adicionalNoturno} />
          )}
          {d.adicionalFeriado > 0 && (
            <LinhaDoPreco rotulo="Adicional de feriado" centavos={d.adicionalFeriado} />
          )}
          {d.ajusteMinimo > 0 && (
            <LinhaDoPreco rotulo="Ajuste ao preço mínimo" centavos={d.ajusteMinimo} />
          )}
        </div>
        {recotacao.expiraEm && (
          <p className="apoio">
            Responda até as {horaDeBrasilia(recotacao.expiraEm)}. Sem resposta, o Pedido é encerrado
            e o pagamento é estornado por inteiro.
          </p>
        )}
        <div className="espaco" />
        <MensagemDeErro>{erro}</MensagemDeErro>
        <Botao
          disabled={ocupado}
          onClick={() =>
            agir(
              () => api.aprovarNovoPreco(pedidoId),
              'Não foi possível aprovar o novo preço. Tente outra vez.',
            )
          }
        >
          Aprovar {formatarReais(recotacao.precoNovo)}
        </Botao>
        <Botao
          variante="contorno"
          disabled={ocupado}
          onClick={() =>
            agir(
              () => api.desistirDoNovoPreco(pedidoId),
              'Não foi possível desistir agora. Tente outra vez.',
            )
          }
        >
          Desistir e estornar
        </Botao>
      </Corpo>
    </Tela>
  );
}

/** RN05 e RF14 ficam para depois do skeleton: o botão existe, mas ainda não cancela. */
function CancelarEmBreve({ escura }: { escura?: boolean }) {
  return (
    <Link
      centro
      disabled
      style={{
        fontSize: 15,
        opacity: 0.55,
        cursor: 'not-allowed',
        color: escura ? 'var(--cinza-claro)' : undefined,
      }}
    >
      Cancelar Pedido · em breve
    </Link>
  );
}

/** Mensagem de erro de uma ação do Cliente: a do servidor, quando conhecida. */
function mensagemDaAcao(e: unknown, padrao: string): string {
  return e instanceof ErroApi && e.motivo !== 'falha' ? e.message : padrao;
}

function SemGuincheiro({
  pedidoId,
  atualizar,
}: {
  pedidoId: string;
  atualizar: (pedidoId: string) => Promise<void>;
}) {
  const api = useApi();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function agir(acao: () => Promise<unknown>, padrao: string) {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
      await atualizar(pedidoId);
    } catch (e) {
      setErro(mensagemDaAcao(e, padrao));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Tela rotulo="Sem Guincheiro">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <h1
          className="titulo"
          style={{
            font: '700 30px/1.12 var(--fonte-titulo)',
            letterSpacing: '-.01em',
            marginTop: 28,
          }}
        >
          Nenhum Guincheiro aceitou
        </h1>
        <p className="apoio">
          Ninguém aceitou o seu Pedido agora. Seu pagamento continua reservado e o preço segue
          travado: tente de novo ou estorne o valor.
        </p>
        <div className="espaco" />
        <MensagemDeErro>{erro}</MensagemDeErro>
        <Botao
          disabled={ocupado}
          onClick={() =>
            agir(
              () => api.tentarDeNovo(pedidoId),
              'Não foi possível tentar de novo. Tente outra vez.',
            )
          }
        >
          Tentar de novo
        </Botao>
        <Botao
          variante="contorno"
          disabled={ocupado}
          onClick={() =>
            agir(
              () => api.estornarPedido(pedidoId),
              'Não foi possível estornar o pagamento. Tente outra vez.',
            )
          }
        >
          Estornar o pagamento
        </Botao>
      </Corpo>
    </Tela>
  );
}

function NovoPedido() {
  const ir = useNavigate();
  const { novoPedido } = useFluxo();
  return (
    <Botao
      onClick={() => {
        novoPedido();
        ir('/pedido/1');
      }}
    >
      Fazer novo Pedido
    </Botao>
  );
}

function Estornado({ valor }: { valor: number | null }) {
  return (
    <Tela rotulo="Pagamento estornado">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Ponto verde style={{ marginTop: 16 }}>
          Estornado
        </Ponto>
        <h1
          className="titulo"
          style={{ font: '700 30px/1.12 var(--fonte-titulo)', letterSpacing: '-.01em' }}
        >
          Pagamento estornado
        </h1>
        <p className="apoio">
          {valor !== null ? `${formatarReais(valor)} voltam` : 'O valor volta'} para você. Quando
          quiser, é só fazer um novo Pedido.
        </p>
        <div className="espaco" />
        <NovoPedido />
      </Corpo>
    </Tela>
  );
}

type EtapaDaCorrida = NonNullable<Acompanhamento['corrida']>['estado'];

const TEXTOS: Record<
  EtapaDaCorrida,
  { rotulo: string; titulo: string; apoio: (a: Acompanhamento, nome: string) => ReactNode }
> = {
  aceita: {
    rotulo: 'Guincheiro aceitou',
    titulo: 'Guincheiro aceitou, saindo em instantes',
    apoio: (_, nome) => `${nome} aceitou o seu Pedido e já vai sair para o local.`,
  },
  a_caminho: {
    rotulo: 'Guincho a caminho',
    titulo: 'Guincho a caminho',
    apoio: (a, nome) =>
      `${nome} está indo até você${a.origemEndereco ? `, em ${a.origemEndereco}` : ''}.`,
  },
  no_local: {
    rotulo: 'No local',
    titulo: 'O guincho chegou ao seu veículo',
    apoio: (_, nome) => `${nome} está no local e vai carregar o seu veículo.`,
  },
  carregado: {
    rotulo: 'Veículo carregado',
    titulo: 'Veículo carregado, a caminho do destino',
    apoio: (a, nome) =>
      `Seu veículo está seguro no guincho de ${nome}${a.destinoEndereco ? `, rumo a ${a.destinoEndereco}` : ''}.`,
  },
  entregue: {
    rotulo: 'Entregue',
    titulo: 'Entregue. Seu veículo chegou ao destino.',
    apoio: (a) =>
      a.precoTotal !== null ? `Total do Pedido: ${formatarReais(a.precoTotal)}.` : null,
  },
};

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]!.toUpperCase())
    .join('');
}

function NaCorrida({
  acompanhamento,
  etapa,
}: {
  acompanhamento: Acompanhamento;
  etapa: EtapaDaCorrida;
}) {
  const texto = TEXTOS[etapa];
  const guincheiro = acompanhamento.corrida?.guincheiro ?? null;
  const nome = guincheiro?.nome ?? 'O Guincheiro';
  const atual = LINHA_DO_TEMPO.findIndex(([e]) => e === etapa);
  const entregue = etapa === 'entregue';

  return (
    <Tela rotulo={texto.rotulo}>
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Ponto verde style={{ marginTop: 16 }}>
          {entregue ? 'Concluído' : 'Ao vivo'}
        </Ponto>
        <h1
          className="titulo"
          style={{ font: '700 30px/1.12 var(--fonte-titulo)', letterSpacing: '-.01em' }}
          aria-live="polite"
        >
          {texto.titulo}
        </h1>
        <p className="apoio">{texto.apoio(acompanhamento, nome)}</p>
        <AvisoDeReducao recotacao={acompanhamento.recotacao} />
        <ol
          aria-label="Etapas do Pedido"
          style={{
            listStyle: 'none',
            margin: '4px 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {LINHA_DO_TEMPO.map(([, rotulo], i) => (
            <li
              key={rotulo}
              aria-current={i === atual ? 'step' : undefined}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                font: `${i === atual ? 600 : 400} 16px var(--fonte-texto)`,
                color: i <= atual ? 'var(--tinta)' : 'var(--tinta-2)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  flex: 'none',
                  background: i <= atual ? 'var(--sucesso)' : 'transparent',
                  border: `2px solid ${i <= atual ? 'var(--sucesso)' : 'var(--linha)'}`,
                }}
              />
              {rotulo}
            </li>
          ))}
        </ol>
        {guincheiro && (
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
        )}
        {acompanhamento.corrida && (
          <FotosDaCorrida corridaId={acompanhamento.corrida.id} estado={etapa} />
        )}
        <div className="espaco" />
        {entregue ? <NovoPedido /> : <CancelarEmBreve />}
      </Corpo>
    </Tela>
  );
}

const AVISO_DAS_FOTOS = 'Registrar fotos protege você se houver reclamação de avaria.';

/** Quando o app sugere, em destaque, o Cliente registrar fotos (o resto do tempo é opcional). */
const SUGESTAO_DAS_FOTOS: Partial<Record<EtapaDaCorrida, string>> = {
  no_local: 'O guincho chegou. Registre fotos do seu veículo antes do carregamento.',
  entregue: 'Seu veículo foi entregue. Registre fotos dele na entrega.',
};

/**
 * Fotos de estado da Corrida (ADR-0011): o Cliente registra de `aceita` a `entregue`, com
 * sugestão em destaque na chegada e na entrega, e vê as dos dois lados. Opcionais: nada
 * aqui trava a Corrida.
 */
function FotosDaCorrida({ corridaId, estado }: { corridaId: string; estado: EtapaDaCorrida }) {
  const api = useApi();
  const [aberto, setAberto] = useState(false);
  // Relê a galeria a cada mudança de etapa: assim chegam as fotos que o Guincheiro registrou.
  const { fotos, erro, recarregar } = useFotosEstado(api, corridaId, estado);
  const sugestao = SUGESTAO_DAS_FOTOS[estado];

  return (
    <section
      aria-label="Fotos da Corrida"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <h2 style={{ font: '600 18px var(--fonte-titulo)', margin: 0 }}>Fotos da Corrida</h2>
      {sugestao && (
        <div
          role="note"
          className="cartao"
          style={{
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            border: '2px solid var(--tinta)',
          }}
        >
          <span style={{ font: '600 16px/1.35 var(--fonte-texto)' }}>{sugestao}</span>
          <span className="apoio" style={{ fontSize: 14 }}>
            {AVISO_DAS_FOTOS}
          </span>
        </div>
      )}
      {aberto ? (
        <>
          <p className="apoio" style={{ fontSize: 14, margin: 0 }}>
            São opcionais e valem para a etapa em que a Corrida está. Recomendado: pelo menos 2
            fotos antes do carregamento e 2 na entrega. Vídeos de até{' '}
            {DURACAO_MAXIMA_VIDEO_SEGUNDOS} s.
          </p>
          <RegistrarFotoEstado
            api={api}
            corridaId={corridaId}
            etapa={etapaDaFoto(estado)}
            papel="cliente"
            fotos={fotos}
            limite={LIMITE_FOTOS_POR_ETAPA}
            duracaoMaximaSegundos={DURACAO_MAXIMA_VIDEO_SEGUNDOS}
            aoRegistrar={recarregar}
          />
          <Link centro onClick={() => setAberto(false)}>
            Fechar
          </Link>
        </>
      ) : (
        <Botao variante={sugestao ? 'primario' : 'contorno'} onClick={() => setAberto(true)}>
          Registrar fotos
        </Botao>
      )}
      {erro && (
        <p role="alert" className="apoio" style={{ fontSize: 14, margin: 0 }}>
          Não foi possível carregar as fotos da Corrida.
        </p>
      )}
      <GaleriaFotosEstado fotos={fotos} />
    </section>
  );
}
