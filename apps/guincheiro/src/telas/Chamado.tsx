import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErroApi, type OfertaAberta } from '@guinchei/api';
import { Botao, Corpo, Heroi, Link, Rotulo, Tela, formatarKm, formatarReais } from '@guinchei/ui';
import { useApi } from '../api';
import { usePlantao } from '../plantao';
import { Chips, chipsDoPedido } from './comum';

/** Prazo padrão da oferta (`parametros_match.timeout_oferta_segundos`), para a barra de tempo. */
const PRAZO_ACEITE = 30;

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** Segundos que faltam para `expiraEm`, pelo relógio do servidor. */
function useSegundosRestantes(expiraEm: string) {
  const { agoraNoServidor } = usePlantao();
  const [agora, setAgora] = useState(agoraNoServidor);
  useEffect(() => {
    const id = setInterval(() => setAgora(agoraNoServidor()), 250);
    return () => clearInterval(id);
  }, [agoraNoServidor]);
  return Math.max(0, Math.ceil((Date.parse(expiraEm) - agora) / 1000));
}

export function Chamado() {
  const { oferta, atualizarOferta } = usePlantao();
  const [lido, setLido] = useState(false);

  // Aberto direto (ou recarregado) sem a oferta na memória: relê as ofertas abertas.
  useEffect(() => {
    if (oferta) return;
    let vigente = true;
    atualizarOferta()
      .catch(() => {})
      .finally(() => vigente && setLido(true));
    return () => {
      vigente = false;
    };
  }, [oferta, atualizarOferta]);

  if (oferta) return <ChamadoAberto oferta={oferta} />;
  if (lido) return <Navigate to="/" replace />;
  return (
    <Tela escura rotulo="Carregando">
      {null}
    </Tela>
  );
}

function ChamadoAberto({ oferta }: { oferta: OfertaAberta }) {
  const ir = useNavigate();
  const api = useApi();
  const { agoraNoServidor, descartarOferta, avisar, setGuincheiro } = usePlantao();
  const [enviando, setEnviando] = useState(false);
  const restante = useSegundosRestantes(oferta.expiraEm);
  const { pedido } = oferta;

  // Vencido o prazo (pelo relógio do servidor), a oferta passa ao próximo Guincheiro.
  useEffect(() => {
    const expirar = () => {
      descartarOferta(oferta.tentativaId);
      avisar('O chamado expirou e passou ao próximo Guincheiro.');
      ir('/', { replace: true });
    };
    const falta = Date.parse(oferta.expiraEm) - agoraNoServidor();
    if (falta <= 0) {
      expirar();
      return;
    }
    const id = setTimeout(expirar, falta);
    return () => clearTimeout(id);
  }, [oferta.expiraEm, oferta.tentativaId, agoraNoServidor, descartarOferta, avisar, ir]);

  function aoFalharResposta(e: unknown, acao: 'aceitar' | 'recusar') {
    if (e instanceof ErroApi && e.motivo === 'oferta_indisponivel') {
      descartarOferta(oferta.tentativaId);
      avisar('Esta oferta não está mais disponível.');
      ir('/', { replace: true });
    } else if (e instanceof ErroApi && e.motivo === 'guincheiro_indisponivel') {
      avisar('Você está fora do plantão. Ligue a disponibilidade para aceitar.');
      ir('/', { replace: true });
    } else {
      avisar(`Não foi possível ${acao} o chamado. Tente de novo.`);
      setEnviando(false);
    }
  }

  async function aceitar() {
    setEnviando(true);
    try {
      await api.aceitarOferta(oferta.tentativaId);
      // Quem aceita fica indisponível no banco até entregar.
      setGuincheiro((g) => (g ? { ...g, disponivel: false } : g));
      descartarOferta(oferta.tentativaId);
      ir('/corrida', { replace: true });
    } catch (e) {
      aoFalharResposta(e, 'aceitar');
    }
  }

  async function recusar() {
    setEnviando(true);
    try {
      await api.recusarOferta(oferta.tentativaId);
      descartarOferta(oferta.tentativaId);
      avisar('Chamado recusado. Ele passa ao próximo Guincheiro.');
      ir('/', { replace: true });
    } catch (e) {
      aoFalharResposta(e, 'recusar');
    }
  }

  return (
    <Tela escura rotulo="Novo chamado">
      <Corpo style={{ padding: '12px 24px 32px', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Rotulo>Novo chamado</Rotulo>
          <span style={{ font: '600 15px var(--fonte-titulo)' }} aria-live="off">
            {Math.floor(restante / 60)}:{doisDigitos(restante % 60)}
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: 'var(--linha-escura)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(1, restante / PRAZO_ACEITE) * 100}%`,
              height: '100%',
              background: 'var(--off-white)',
              transition: 'width 1s linear',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <span style={{ font: '400 15px var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
            Você recebe
          </span>
          <Heroi centavos={oferta.repasse} tamanho={64} />
          <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
            {oferta.precoRecalculado !== null
              ? `Preço pela sua distância ${formatarReais(oferta.precoRecalculado)} · já descontada a Comissão`
              : 'Já descontada a Comissão'}
          </span>
        </div>
        <div className="cartao cartao--escuro" style={{ padding: '4px 18px' }}>
          <div
            style={{
              display: 'flex',
              gap: 14,
              padding: '14px 0',
              borderBottom: '1px solid var(--linha-escura)',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--off-white)',
                marginTop: 5,
                flex: 'none',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ font: '500 16px var(--fonte-texto)' }}>
                {pedido.origemEndereco ?? 'Origem não informada'}
              </span>
              {oferta.kmAteVeiculo !== null && (
                <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
                  {formatarKm(oferta.kmAteVeiculo)} de você
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, padding: '14px 0' }}>
            <span
              style={{
                width: 10,
                height: 10,
                background: 'var(--off-white)',
                marginTop: 5,
                flex: 'none',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ font: '500 16px var(--fonte-texto)' }}>
                {pedido.destinoEndereco ?? 'Destino não informado'}
              </span>
              {pedido.kmRebocado !== null && (
                <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
                  {formatarKm(pedido.kmRebocado)} de reboque
                </span>
              )}
            </div>
          </div>
        </div>
        <Chips itens={chipsDoPedido(pedido)} />
        <div className="espaco" />
        <Botao
          variante="claro"
          disabled={enviando}
          style={{ height: 64, borderRadius: 16, font: '700 20px var(--fonte-titulo)' }}
          onClick={aceitar}
        >
          Aceitar Corrida
        </Botao>
        <Link centro style={{ fontSize: 15 }} disabled={enviando} onClick={recusar}>
          Recusar
        </Link>
      </Corpo>
    </Tela>
  );
}
