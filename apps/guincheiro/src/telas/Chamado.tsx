import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatarKm, formatarReais } from '@guinchei/ui';
import { CLIENTE, GUINCHEIRO, PRECO, REPASSE, RODAS, TRECHO } from '@guinchei/mock';
import {
  Avatar,
  Botao,
  Corpo,
  Heroi,
  IndicadorHome,
  Link,
  Mapa,
  Ponto,
  Rotulo,
  Tela,
} from '@guinchei/ui';
import { usePlantao } from '../plantao';
import { AbasGuincheiro, somaRepasses } from './comum';

const ESPERA_CHAMADO = 5000;
const PRAZO_ACEITE = 30;
const TELEFONE_CLIENTE = '+5561998124470';

function Interruptor({ ligado, onChange }: { ligado: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label="Disponível para chamados"
      onClick={() => onChange(!ligado)}
      style={{
        width: 58,
        height: 34,
        borderRadius: 17,
        background: ligado ? 'var(--sucesso)' : 'var(--borda-escura)',
        position: 'relative',
        transition: 'background .15s',
        flex: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: ligado ? 27 : 3,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left .15s',
        }}
      />
    </button>
  );
}

export function Plantao() {
  const ir = useNavigate();
  const { disponivel, setDisponivel, chamadoPendente, consumirChamado, estado, historico } =
    usePlantao();
  const ganho = somaRepasses(historico);

  // Mock do Match: com o Guincheiro disponível, o Pedido do Rafael chega em instantes.
  useEffect(() => {
    if (!disponivel || !chamadoPendente || estado) return;
    const id = setTimeout(() => {
      consumirChamado();
      ir('/chamado');
    }, ESPERA_CHAMADO);
    return () => clearTimeout(id);
  }, [disponivel, chamadoPendente, consumirChamado, estado, ir]);

  return (
    <Tela escura rotulo="Em plantão" semRodape>
      <Corpo style={{ padding: '12px 24px 0', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="marca" style={{ fontSize: 22, letterSpacing: 0 }}>
            guinchei
          </span>
          <Avatar
            iniciais={GUINCHEIRO.iniciais}
            tamanho={40}
            style={{ font: '600 14px var(--fonte-titulo)' }}
          />
        </div>
        <div
          className="cartao cartao--escuro"
          style={{
            padding: 22,
            borderRadius: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {disponivel ? (
                <Ponto style={{ fontSize: 15 }}>Disponível</Ponto>
              ) : (
                <span style={{ font: '600 15px var(--fonte-texto)' }}>Fora do plantão</span>
              )}
              <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
                {GUINCHEIRO.plantao}
              </span>
            </div>
            <Interruptor ligado={disponivel} onChange={setDisponivel} />
          </div>
          <div style={{ height: 1, background: 'var(--linha-escura)' }} />
          <div style={{ font: '400 14px/1.5 var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
            {disponivel
              ? 'Mantenha o app aberto. O chamado toca mesmo com a tela bloqueada.'
              : 'Você não recebe chamados enquanto estiver indisponível.'}
          </div>
        </div>
        <Rotulo style={{ marginTop: 8 }}>Hoje</Rotulo>
        <Heroi centavos={ganho} tamanho={56} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div
            className="cartao cartao--escuro"
            style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <span style={{ font: '700 26px var(--fonte-titulo)' }}>{historico.length}</span>
            <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
              Corridas
            </span>
          </div>
          <div
            className="cartao cartao--escuro"
            style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <span style={{ font: '700 26px var(--fonte-titulo)' }}>{GUINCHEIRO.nota}</span>
            <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
              Sua nota
            </span>
          </div>
        </div>
        <div style={{ font: '400 13px/1.5 var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
          Ganho mínimo garantido do plantão: {formatarReais(GUINCHEIRO.ganhoMinimo)}.{' '}
          {ganho >= GUINCHEIRO.ganhoMinimo
            ? 'Já superado.'
            : `Faltam ${formatarReais(GUINCHEIRO.ganhoMinimo - ganho)}.`}
        </div>
      </Corpo>
      <AbasGuincheiro atual="plantao" escura />
    </Tela>
  );
}

export function Chamado() {
  const ir = useNavigate();
  const { aceitar, avisar } = usePlantao();
  const [restante, setRestante] = useState(PRAZO_ACEITE);

  useEffect(() => {
    if (restante <= 0) {
      avisar('O chamado expirou e passou ao próximo Guincheiro.');
      ir('/', { replace: true });
      return;
    }
    const id = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [restante, avisar, ir]);

  const chips = ['Carro de passeio', 'Não liga', RODAS[0].chip];

  return (
    <Tela escura rotulo="Novo chamado">
      <Corpo style={{ padding: '12px 24px 32px', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Rotulo>Novo chamado</Rotulo>
          <span style={{ font: '600 15px var(--fonte-titulo)' }} aria-live="off">
            0:{String(restante).padStart(2, '0')}
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
              width: `${(restante / PRAZO_ACEITE) * 100}%`,
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
          <Heroi centavos={REPASSE.repasse} tamanho={64} />
          <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
            Preço fechado {formatarReais(PRECO.total)} · já descontada a Comissão
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
              <span style={{ font: '500 16px var(--fonte-texto)' }}>{TRECHO.origem}</span>
              <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
                {formatarKm(TRECHO.kmDeslocamento)} de você · ~{TRECHO.minutosAteCliente} min
              </span>
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
              <span style={{ font: '500 16px var(--fonte-texto)' }}>{TRECHO.destinoCurto}</span>
              <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
                {formatarKm(TRECHO.kmReboque)} de reboque
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chips.map((c) => (
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
        <div className="espaco" />
        <Botao
          variante="claro"
          style={{ height: 64, borderRadius: 16, font: '700 20px var(--fonte-titulo)' }}
          onClick={() => {
            aceitar();
            ir('/a-caminho', { replace: true });
          }}
        >
          Aceitar Corrida
        </Botao>
        <Link
          centro
          style={{ fontSize: 15 }}
          onClick={() => {
            avisar('Chamado recusado. Ele passa ao próximo Guincheiro.');
            ir('/', { replace: true });
          }}
        >
          Recusar
        </Link>
      </Corpo>
    </Tela>
  );
}

export function ACaminho() {
  const ir = useNavigate();
  const { avancar } = usePlantao();
  return (
    <Tela mapa escura rotulo="A caminho do Cliente">
      <Mapa
        escuro
        ruas={[
          { top: 240, esp: 18, giro: -12 },
          { left: 210, esp: 12, giro: 10 },
          { left: 70, esp: 10 },
        ]}
        rota="76,470 76,260 222,232 240,120"
        rotaEspessura={6}
        marcadores={[
          { left: 60, top: 454, tamanho: 32, tipo: 'guincho' },
          { left: 228, top: 108, tamanho: 24, tipo: 'origem' },
        ]}
      />
      <Navegacao instrucao="Em 600 m, vire à direita" via="Eixo Monumental, sentido Torre de TV" />
      <div className="folha folha--escura">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ font: '700 28px var(--fonte-titulo)' }}>11 min</span>
          <span style={{ font: '500 15px var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
            3,6 km · chega 22:06
          </span>
        </div>
        <div
          className="cartao cartao--escuro"
          style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}
        >
          <Avatar
            iniciais={CLIENTE.iniciais}
            tamanho={48}
            fundo="var(--linha-escura)"
            style={{ fontSize: 16 }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ font: '600 17px var(--fonte-titulo)' }}>{CLIENTE.nomeCurto}</span>
            <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
              {CLIENTE.veiculoDescricao}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Botao
            variante="contorno-escuro"
            style={{ height: 52, fontSize: 16 }}
            onClick={() => (window.location.href = `tel:${TELEFONE_CLIENTE}`)}
          >
            Ligar
          </Botao>
          <Botao
            variante="contorno-escuro"
            style={{ height: 52, fontSize: 16 }}
            onClick={() => (window.location.href = `sms:${TELEFONE_CLIENTE}`)}
          >
            Mensagem
          </Botao>
        </div>
        <Botao
          variante="claro"
          grande
          onClick={() => {
            avancar('no_local');
            ir('/fotos/antes', { replace: true });
          }}
        >
          Cheguei no local
        </Botao>
        <IndicadorHome />
      </div>
    </Tela>
  );
}

export function Navegacao({ instrucao, via }: { instrucao: string; via: string }) {
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
      <span style={{ font: '700 22px var(--fonte-titulo)' }}>{instrucao}</span>
      <span style={{ font: '400 14px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
        {via}
      </span>
    </div>
  );
}
