import { useEffect, useState, type CSSProperties } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErroApi, type CotacaoPedido, type MotivoErroApi } from '@guinchei/api';
import type { MetodoPagamento } from '@guinchei/pagamento';
import { formatarKm, formatarPercentual, formatarReais } from '@guinchei/ui';
import { Botao, Corpo, Heroi, Link, Rotulo, Segmentado, Tela, Valores } from '@guinchei/ui';
import { useApi } from '../api';
import { useFluxo } from '../fluxo';
import { MensagemDeErro } from '../MensagemDeErro';

// Preço fechado (RF05) e pagamento (RF06). O preço é calculado e gravado pelo servidor
// (Edge Function cotar-pedido); a tela só mostra o que voltou. Confirmar autoriza o mesmo
// valor (pagamento mock) e leva o Pedido a `confirmado`.

type EstadoCotacao =
  | { tipo: 'carregando' }
  | { tipo: 'pronta'; cotacao: CotacaoPedido }
  | { tipo: 'erro'; motivo: MotivoErroApi; mensagem: string };

/** Motivos em que a mensagem do servidor já é a que o Cliente deve ler. */
const MOTIVOS_COM_MENSAGEM_DO_SERVIDOR: readonly MotivoErroApi[] = [
  'sem_guincheiro',
  'sem_trajeto',
  'sem_cotacao',
  'pagamento_recusado',
  'pedido_indisponivel',
];

function mensagemDoErro(e: unknown, padrao: string): { motivo: MotivoErroApi; mensagem: string } {
  if (e instanceof ErroApi && MOTIVOS_COM_MENSAGEM_DO_SERVIDOR.includes(e.motivo)) {
    return { motivo: e.motivo, mensagem: e.message };
  }
  return { motivo: 'falha', mensagem: padrao };
}

function linhasDaCotacao({
  preco,
  kmAteVeiculo,
  kmRebocado,
  adicionalNoturno,
  adicionalFeriado,
}: CotacaoPedido): [string, string][] {
  const linhas: [string, string][] = [
    ['Taxa base', formatarReais(preco.taxaBase)],
    [`Deslocamento até você · ${formatarKm(kmAteVeiculo)}`, formatarReais(preco.deslocamento)],
    [`Reboque · ${formatarKm(kmRebocado)}`, formatarReais(preco.reboque)],
  ];
  if (preco.adicionalNoturno)
    linhas.push([
      `Adicional noturno · ${formatarPercentual(adicionalNoturno)}`,
      formatarReais(preco.adicionalNoturno),
    ]);
  if (preco.adicionalFeriado)
    linhas.push([
      `Adicional feriado · ${formatarPercentual(adicionalFeriado)}`,
      formatarReais(preco.adicionalFeriado),
    ]);
  if (preco.ajustePiso)
    linhas.push(['Ajuste para o Preço fechado mínimo', formatarReais(preco.ajustePiso)]);
  return linhas;
}

export function Preco() {
  const { pedidoId } = useFluxo();
  if (!pedidoId) return <Navigate to="/pedido/1" replace />;
  return <PrecoDoPedido pedidoId={pedidoId} />;
}

function PrecoDoPedido({ pedidoId }: { pedidoId: string }) {
  const ir = useNavigate();
  const api = useApi();
  const { setCotacao, novoPedido } = useFluxo();
  const [estado, setEstado] = useState<EstadoCotacao>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  // Cada visita cota de novo: o servidor regrava o preço (ex.: o trajeto mudou).
  useEffect(() => {
    let vigente = true;
    api.cotarPedido(pedidoId).then(
      (cotacao) => {
        if (!vigente) return;
        setCotacao(cotacao);
        setEstado({ tipo: 'pronta', cotacao });
      },
      (e: unknown) => {
        if (!vigente) return;
        setCotacao(null);
        setEstado({
          tipo: 'erro',
          ...mensagemDoErro(
            e,
            'Não foi possível calcular o preço. Verifique a conexão e tente de novo.',
          ),
        });
      },
    );
    return () => {
      vigente = false;
    };
  }, [api, pedidoId, tentativa, setCotacao]);

  function tentarDeNovo() {
    setEstado({ tipo: 'carregando' });
    setTentativa((n) => n + 1);
  }

  const cotacao = estado.tipo === 'pronta' ? estado.cotacao : null;

  return (
    <Tela escura rotulo="Preço fechado">
      <Corpo style={{ padding: '16px 24px 32px', gap: 14 }}>
        <Link onClick={() => ir('/local')}>Voltar</Link>
        <Rotulo style={{ marginTop: 20, color: 'var(--cinza-medio)' }}>Preço fechado</Rotulo>
        {estado.tipo === 'carregando' && (
          <p className="apoio" aria-live="polite">
            Calculando o preço fechado…
          </p>
        )}
        {estado.tipo === 'erro' && (
          <>
            <div style={estiloCaixaDeErro}>
              <MensagemDeErro>{estado.mensagem}</MensagemDeErro>
            </div>
            {estado.motivo === 'sem_trajeto' ? (
              <Botao variante="contorno-escuro" onClick={() => ir('/local')}>
                Voltar ao mapa
              </Botao>
            ) : estado.motivo === 'pedido_indisponivel' ? (
              <Botao
                variante="contorno-escuro"
                onClick={() => {
                  novoPedido();
                  ir('/pedido/1');
                }}
              >
                Começar outro Pedido
              </Botao>
            ) : (
              <Botao variante="contorno-escuro" onClick={tentarDeNovo}>
                Tentar de novo
              </Botao>
            )}
          </>
        )}
        {cotacao && (
          <>
            <Heroi centavos={cotacao.preco.total} />
            <p className="apoio">
              Esse é o valor final. Ninguém vai renegociar na rua. Só muda se você trocar o destino
              durante a Corrida.
            </p>
            <Valores escuro linhas={linhasDaCotacao(cotacao)} style={{ marginTop: 12 }} />
            <div style={estiloGuinchoProximo}>
              <span style={estiloPontoVerde} />
              Guincho mais próximo a {formatarKm(cotacao.kmAteVeiculo)}
            </div>
          </>
        )}
        <div className="espaco" />
        <Botao variante="claro" disabled={!cotacao} onClick={() => ir('/pagamento')}>
          Confirmar e pagar
        </Botao>
      </Corpo>
    </Tela>
  );
}

const estiloCaixaDeErro: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: 'var(--alerta-fundo)',
  border: '1px solid var(--alerta-borda)',
};
const estiloGuinchoProximo: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  font: '500 15px var(--fonte-texto)',
  color: 'var(--cinza-claro)',
};
const estiloPontoVerde: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: 'var(--sucesso)',
  flex: 'none',
};

// Código Pix de exemplo; o PSP gera o real (ADR-0004).
const PIX_COPIA_E_COLA =
  '00020126580014br.gov.bcb.pix0136a7f2c1d0-5b8e-4e2a-9c61-3f0d2b7a9e415204000053039865406297.625802BR5908GUINCHEI6008BRASILIA62070503***6304B1C2';

export function Pagamento() {
  const { pedidoId, cotacao } = useFluxo();
  if (!pedidoId || !cotacao) return <Navigate to="/preco" replace />;
  return <PagamentoDoPedido pedidoId={pedidoId} total={cotacao.preco.total} />;
}

function PagamentoDoPedido({ pedidoId, total }: { pedidoId: string; total: number }) {
  const ir = useNavigate();
  const api = useApi();
  const { avisar } = useFluxo();
  const [meio, setMeio] = useState<MetodoPagamento>('pix');
  const [restante, setRestante] = useState(9 * 60 + 42);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setRestante((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // Pagamento mock: a autorização acontece na hora, no servidor (confirmar-pedido).
  async function confirmar(metodo: MetodoPagamento) {
    setErro(null);
    setConfirmando(true);
    try {
      await api.confirmarPedido(pedidoId, metodo);
      avisar('Pagamento autorizado. Chamando o guincho…');
      ir('/corrida');
    } catch (e) {
      setConfirmando(false);
      setErro(
        mensagemDoErro(
          e,
          'Não foi possível confirmar o pagamento. Verifique a conexão e tente de novo.',
        ).mensagem,
      );
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(PIX_COPIA_E_COLA);
    } catch {
      // Sem permissão de área de transferência: segue o fluxo mesmo assim.
    }
    await confirmar('pix');
  }

  return (
    <Tela rotulo="Pagamento">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Link onClick={() => ir('/preco')}>Voltar</Link>
        <Segmentado
          style={{ marginTop: 8 }}
          valor={meio}
          onChange={setMeio}
          opcoes={[
            { valor: 'pix', rotulo: 'Pix' },
            { valor: 'cartao', rotulo: 'Cartão' },
          ]}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 4,
          }}
        >
          <span style={{ font: '700 26px var(--fonte-titulo)' }}>
            {meio === 'pix' ? 'Pague com Pix' : 'Pague com cartão'}
          </span>
          <span style={{ font: '600 20px var(--fonte-titulo)' }}>{formatarReais(total)}</span>
        </div>
        {meio === 'pix' ? (
          <>
            <div
              style={{
                alignSelf: 'center',
                width: 220,
                height: 220,
                borderRadius: 16,
                border: '1px solid var(--linha)',
                background: 'repeating-linear-gradient(135deg,#E3E6EB 0 8px,#EEF0F3 8px 16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="mono"
            >
              QR code Pix
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: '500 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                Pix copia e cola
              </span>
              <div
                className="mono"
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: '#fff',
                  border: '1px solid var(--linha)',
                  fontSize: 13,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {PIX_COPIA_E_COLA}
              </div>
            </div>
          </>
        ) : (
          <p className="apoio" style={{ fontSize: 15 }}>
            O cartão real entra junto com o PSP (RF12). Por enquanto, o pagamento com cartão é
            simulado.
          </p>
        )}
        <p className="apoio" style={{ fontSize: 14 }}>
          Assim que o pagamento cair, chamamos o guincho. Se nenhum guincho aceitar, devolvemos o
          valor na hora.
        </p>
        <div className="espaco" />
        <div
          style={{
            textAlign: 'center',
            font: '500 14px var(--fonte-texto)',
            color: 'var(--tinta-2)',
          }}
        >
          Expira em {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}
        </div>
        <MensagemDeErro>{erro}</MensagemDeErro>
        {meio === 'pix' ? (
          <Botao disabled={confirmando || restante === 0} onClick={copiar}>
            {confirmando ? 'Confirmando pagamento…' : 'Copiar código Pix'}
          </Botao>
        ) : (
          <Botao disabled={confirmando} onClick={() => confirmar('cartao')}>
            {confirmando ? 'Confirmando pagamento…' : 'Pagar com cartão'}
          </Botao>
        )}
      </Corpo>
    </Tela>
  );
}
