import { useEffect, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatarHora, formatarKm, formatarReais } from '@guinchei/ui';
import { taxaDeCancelamento, transitarCorrida } from '@guinchei/mock';
import { GUINCHEIRO, LADOS, PRECO, TRECHO } from '@guinchei/mock';
import {
  Avatar,
  Botao,
  Corpo,
  Etapas,
  Foto,
  IndicadorHome,
  Link,
  Mapa,
  Ponto,
  Rotulo,
  Tela,
} from '@guinchei/ui';
import { useFluxo, type EstadoAcompanhamento } from '../fluxo';

// Simulação do protótipo: o status avança sozinho, como faria o Realtime do Supabase.
const DURACAO: Partial<Record<EstadoAcompanhamento, number>> = {
  em_match: 4000,
  a_caminho: 10000,
  carregado: 10000,
};
const INTERVALO_FOTO = 1500;
const MINUTOS_ATE_CLIENTE = 12;
const KM_ATE_DESTINO = 14.8;
const MINUTOS_ATE_DESTINO = 17;
const TELEFONE_GUINCHEIRO = '+5561999990000';

interface Sim {
  estado: EstadoAcompanhamento;
  inicio: number;
  fotosAntes: number;
  fotosDepois: number;
}

type Acao = { tipo: 'avancar' } | { tipo: 'foto' };

function proximo(sim: Sim, acao: Acao): Sim {
  const agora = Date.now();
  if (acao.tipo === 'foto') return { ...sim, fotosAntes: sim.fotosAntes + 1 };
  const fotos = { antes: sim.fotosAntes, depois: sim.fotosDepois };
  switch (sim.estado) {
    case 'em_match':
      return { ...sim, estado: transitarCorrida('aceita', 'a_caminho', fotos), inicio: agora };
    case 'a_caminho':
      return { ...sim, estado: transitarCorrida('a_caminho', 'no_local', fotos), inicio: agora };
    case 'no_local':
      return { ...sim, estado: transitarCorrida('no_local', 'carregado', fotos), inicio: agora };
    case 'carregado':
      // As fotos "depois" são feitas pelo Guincheiro na entrega.
      return {
        ...sim,
        estado: transitarCorrida('carregado', 'entregue', { ...fotos, depois: LADOS.length }),
        fotosDepois: LADOS.length,
        inicio: agora,
      };
    default:
      return sim;
  }
}

function useAgora(ativo: boolean) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(id);
  }, [ativo]);
  return agora;
}

export function Corrida() {
  const ir = useNavigate();
  const { registrar, avisar } = useFluxo();
  const [sim, despachar] = useReducer(proximo, undefined, () => ({
    estado: 'em_match' as EstadoAcompanhamento,
    inicio: Date.now(),
    fotosAntes: 0,
    fotosDepois: 0,
  }));
  const [cancelando, setCancelando] = useState(false);
  const [vendoFotos, setVendoFotos] = useState(false);
  const pausado = cancelando || vendoFotos;
  const agora = useAgora(!pausado);

  useEffect(() => {
    if (pausado) return;
    if (sim.estado === 'entregue') {
      ir('/entregue', { replace: true });
      return;
    }
    if (sim.estado === 'no_local') {
      const id = setTimeout(
        () => despachar(sim.fotosAntes < LADOS.length ? { tipo: 'foto' } : { tipo: 'avancar' }),
        INTERVALO_FOTO,
      );
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => despachar({ tipo: 'avancar' }), DURACAO[sim.estado] ?? 0);
    return () => clearTimeout(id);
  }, [sim, pausado, ir]);

  const fracao = Math.min(1, (agora - sim.inicio) / (DURACAO[sim.estado] ?? 1));

  function cancelar() {
    const taxa = taxaDeCancelamento(sim.estado) ?? 0;
    if (taxa > 0) {
      registrar({
        quando: dataHistorico(new Date()),
        trecho: 'Eixo Monumental → Taguatinga Norte',
        pessoa: 'Taxa de cancelamento',
        valor: taxa,
        estado: 'Cancelada',
      });
      avisar(`Pedido cancelado. ${formatarReais(PRECO.total - taxa)} voltam para sua conta.`);
      ir('/historico', { replace: true });
    } else {
      avisar('Pedido cancelado sem custo. O valor do Pix volta para sua conta.');
      ir('/preco', { replace: true });
    }
  }

  switch (sim.estado) {
    case 'em_match':
      return <Procurando onCancelar={cancelar} />;
    case 'aceita':
    case 'a_caminho': {
      const minutos = Math.max(1, Math.round(MINUTOS_ATE_CLIENTE * (1 - fracao)));
      return (
        <>
          <ACaminho agora={agora} minutos={minutos} onCancelar={() => setCancelando(true)} />
          {cancelando && (
            <FolhaCancelamento
              minutos={Math.max(1, minutos - 5)}
              taxa={taxaDeCancelamento(sim.estado) ?? 0}
              onManter={() => setCancelando(false)}
              onCancelar={cancelar}
            />
          )}
        </>
      );
    }
    case 'no_local':
      return <NoLocal fotos={sim.fotosAntes} />;
    case 'carregado':
    case 'entregue':
      return (
        <>
          <Carregado
            agora={agora}
            fracao={fracao}
            onVerFotos={() => setVendoFotos(true)}
            avisar={avisar}
          />
          {vendoFotos && <FolhaFotos onFechar={() => setVendoFotos(false)} />}
        </>
      );
  }
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function dataHistorico(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${formatarHora(d)}`;
}

function Procurando({ onCancelar }: { onCancelar: () => void }) {
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
        <p className="apoio" style={{ textAlign: 'center' }}>
          Pagamento confirmado. Estamos falando com um Guincheiro a{' '}
          {formatarKm(TRECHO.kmDeslocamento)} de você. Seu preço já está travado em{' '}
          {formatarReais(PRECO.total)}.
        </p>
      </div>
      <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column' }}>
        <Link centro style={{ fontSize: 15 }} onClick={onCancelar}>
          Cancelar sem custo
        </Link>
      </div>
    </Tela>
  );
}

function CartaoGuincheiro() {
  return (
    <div className="cartao" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
      <Avatar iniciais={GUINCHEIRO.iniciais} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ font: '600 17px var(--fonte-titulo)' }}>{GUINCHEIRO.nome}</span>
          <span className="selo">Verificado</span>
        </div>
        <span style={{ font: '400 14px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
          Nota {GUINCHEIRO.nota} · {GUINCHEIRO.corridas} Corridas
        </span>
      </div>
    </div>
  );
}

function ACaminho({
  agora,
  minutos,
  onCancelar,
}: {
  agora: number;
  minutos: number;
  onCancelar: () => void;
}) {
  const chegada = formatarHora(new Date(agora + minutos * 60_000));
  return (
    <Tela mapa rotulo="Guincho a caminho">
      <Mapa
        ruas={[
          { top: 220, esp: 18, giro: -12 },
          { left: 200, esp: 12, giro: 10 },
          { left: 60, esp: 10 },
        ]}
        quadras={[{ left: 240, top: 90, w: 90, h: 70 }]}
        rota="66,110 66,250 215,218 236,340"
        rotaTracejada
        marcadores={[
          { left: 52, top: 96, tamanho: 30, tipo: 'guincho' },
          { left: 224, top: 328, tamanho: 24, tipo: 'origem' },
        ]}
      />
      <div className="folha">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Ponto verde>Guincho a caminho</Ponto>
            <span style={{ font: '700 26px var(--fonte-titulo)' }} aria-live="polite">
              Chega em {minutos} min
            </span>
          </div>
          <span style={{ font: '500 14px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
            {chegada}
          </span>
        </div>
        <Etapas atual={0} />
        <CartaoGuincheiro />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Botao
            variante="tinta"
            style={{ height: 52, fontSize: 16 }}
            onClick={() => (window.location.href = `tel:${TELEFONE_GUINCHEIRO}`)}
          >
            Ligar
          </Botao>
          <Botao
            variante="contorno"
            style={{ height: 52, fontSize: 16 }}
            onClick={() => (window.location.href = `sms:${TELEFONE_GUINCHEIRO}`)}
          >
            Mensagem
          </Botao>
        </div>
        <Link centro style={{ fontSize: 14 }} onClick={onCancelar}>
          Cancelar Pedido
        </Link>
        <IndicadorHome />
      </div>
    </Tela>
  );
}

function FolhaCancelamento({
  minutos,
  taxa,
  onManter,
  onCancelar,
}: {
  minutos: number;
  taxa: number;
  onManter: () => void;
  onCancelar: () => void;
}) {
  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'rgba(11,12,15,.55)' }}
      onClick={onManter}
    >
      <div
        className="folha"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cancelar"
        style={{ padding: '28px 24px 10px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: 'var(--linha)',
            alignSelf: 'center',
            marginTop: -14,
          }}
        />
        <h1 id="titulo-cancelar" style={{ font: '700 26px/1.15 var(--fonte-titulo)' }}>
          Quer mesmo cancelar?
        </h1>
        <p className="apoio">
          O {GUINCHEIRO.primeiroNome} já saiu e está a {minutos} minutos de você. Se cancelar agora,
          cobramos {formatarReais(taxa)} para cobrir o deslocamento dele. O restante volta para sua
          conta.
        </p>
        <div className="cartao valores" style={{ padding: '4px 16px', borderRadius: 14 }}>
          <div className="valores__linha">
            <span>Taxa de cancelamento</span>
            <span>{formatarReais(taxa)}</span>
          </div>
          <div className="valores__linha" style={{ fontWeight: 600 }}>
            <span style={{ color: 'var(--tinta)' }}>Devolução</span>
            <span>{formatarReais(PRECO.total - taxa)}</span>
          </div>
        </div>
        <Botao
          variante="tinta"
          style={{ height: 56, fontSize: 17, marginTop: 6 }}
          onClick={onManter}
          autoFocus
        >
          Manter o guincho
        </Botao>
        <Botao variante="perigo" style={{ height: 56, fontSize: 17 }} onClick={onCancelar}>
          Cancelar e pagar {formatarReais(taxa).replace(',00', '')}
        </Botao>
        <IndicadorHome style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}

function NoLocal({ fotos }: { fotos: number }) {
  const hora = formatarHora(new Date());
  return (
    <Tela rotulo="No local: Fotos de estado">
      <Corpo style={{ padding: '12px 24px 32px', gap: 16 }}>
        <Etapas atual={1} />
        <h1
          className="titulo"
          style={{
            font: '700 28px/1.12 var(--fonte-titulo)',
            letterSpacing: '-.01em',
            marginTop: 12,
          }}
        >
          O {GUINCHEIRO.primeiroNome} chegou. Ele está fotografando seu carro.
        </h1>
        <p className="apoio">
          As fotos registram como o carro estava antes de subir no guincho, com hora e local. Elas
          protegem você.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LADOS.map((lado, i) => {
            const feita = i < fotos;
            return (
              <div key={lado} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {feita ? (
                  <Foto
                    altura={120}
                    legenda={`foto ${lado.toLowerCase().replace('esquerda', 'esq.').replace('direita', 'dir.')}`}
                  />
                ) : (
                  <Foto altura={120} vazia legenda="Aguardando" />
                )}
                <span style={{ font: '400 12px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                  {feita ? `${lado} · ${hora}` : lado}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mono">{TRECHO.coordenadas} · Eixo Monumental</div>
      </Corpo>
    </Tela>
  );
}

function Carregado({
  agora,
  fracao,
  onVerFotos,
  avisar,
}: {
  agora: number;
  fracao: number;
  onVerFotos: () => void;
  avisar: (t: string) => void;
}) {
  const km = KM_ATE_DESTINO * (1 - fracao);
  const previsao = formatarHora(new Date(agora + MINUTOS_ATE_DESTINO * (1 - fracao) * 60_000));

  async function compartilhar() {
    const texto = `Meu carro está no guincho do ${GUINCHEIRO.primeiroNome}, a caminho da ${TRECHO.oficina}. Previsão: ${previsao}.`;
    if (navigator.share) {
      await navigator.share({ title: 'Guinchei', text: texto }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(texto).catch(() => undefined);
      avisar('Link da Corrida copiado.');
    }
  }

  return (
    <Tela mapa escura rotulo="Carregado: em transporte">
      <Mapa
        escuro
        ruas={[
          { top: 260, esp: 16, giro: -18 },
          { top: 120, esp: 10, giro: 4 },
          { left: 110, esp: 12 },
          { left: 280, esp: 10, giro: -6 },
        ]}
        rota="310,110 290,290 116,300 116,430"
        marcadores={[
          { left: 276, top: 200, tamanho: 30, tipo: 'guincho' },
          { left: 104, top: 418, tamanho: 24, tipo: 'destino' },
        ]}
      />
      <div className="folha folha--escura" style={{ padding: '22px 20px 10px' }}>
        <Etapas atual={2} escura />
        <Rotulo style={{ marginTop: 4 }}>Previsão de entrega</Rotulo>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ font: '700 44px/1 var(--fonte-titulo)', letterSpacing: '-.02em' }}>
            {previsao}
          </span>
          <span style={{ font: '500 15px var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
            faltam {formatarKm(km)}
          </span>
        </div>
        <p className="apoio" style={{ fontSize: 15 }}>
          Seu carro está seguro no guincho do {GUINCHEIRO.primeiroNome}, a caminho da{' '}
          {TRECHO.oficina}, em {TRECHO.bairroDestino}.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Botao
            variante="contorno-escuro"
            style={{ height: 52, fontSize: 15 }}
            onClick={onVerFotos}
          >
            Ver fotos ({LADOS.length})
          </Botao>
          <Botao
            variante="contorno-escuro"
            style={{ height: 52, fontSize: 15 }}
            onClick={compartilhar}
          >
            Compartilhar
          </Botao>
        </div>
        <IndicadorHome />
      </div>
    </Tela>
  );
}

function FolhaFotos({ onFechar }: { onFechar: () => void }) {
  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'rgba(11,12,15,.55)' }}
      onClick={onFechar}
    >
      <div
        className="folha"
        role="dialog"
        aria-modal="true"
        aria-label="Fotos de estado"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ font: '700 22px var(--fonte-titulo)' }}>Fotos de estado · antes</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LADOS.map((lado) => (
            <div key={lado} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Foto altura={120} legenda={lado.toLowerCase()} />
              <span style={{ font: '400 12px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                {lado}
              </span>
            </div>
          ))}
        </div>
        <Botao variante="tinta" style={{ height: 52, fontSize: 16 }} onClick={onFechar} autoFocus>
          Fechar
        </Botao>
        <IndicadorHome />
      </div>
    </div>
  );
}
