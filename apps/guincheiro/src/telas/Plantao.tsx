import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatarReais } from '@guinchei/ui';
import { GUINCHEIRO } from '@guinchei/mock';
import { Avatar, Corpo, Heroi, Link, Ponto, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { usePlantao } from '../plantao';
import { AbasGuincheiro, somaRepasses } from './comum';
import { AvisoDeHomologacao } from './documentos/AvisoDeHomologacao';

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

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]!.toUpperCase())
    .join('');

export function Plantao() {
  const ir = useNavigate();
  const api = useApi();
  const { guincheiro, setGuincheiro, definirDisponivel, atualizarOferta, historico } = usePlantao();
  const disponivel = guincheiro?.disponivel ?? false;
  const ganho = somaRepasses(historico);

  // Ao abrir (e ao voltar de uma Corrida), o banco é a fonte: disponibilidade e Corrida em curso.
  useEffect(() => {
    let vigente = true;
    (async () => {
      const [meu, corrida] = await Promise.all([
        api.buscarMeuGuincheiro(),
        api.minhaCorridaAtual(),
      ]);
      if (!vigente) return;
      if (meu) setGuincheiro(meu);
      if (corrida) ir('/corrida', { replace: true });
    })().catch(() => {});
    return () => {
      vigente = false;
    };
  }, [api, ir, setGuincheiro]);

  // Chamado em tempo real: a assinatura avisa a cada mudança nas ofertas dele (e ao conectar,
  // para não perder as que chegaram antes), e a tela relê as ofertas abertas.
  useEffect(() => {
    if (!disponivel) return;
    let vigente = true;
    const verificar = () => {
      atualizarOferta()
        .then((oferta) => {
          if (vigente && oferta) ir('/chamado');
        })
        .catch(() => {});
    };
    const cancelar = api.assinarOfertas(verificar);
    // Rede de segurança: se o Realtime perder um aviso, a oferta aparece na próxima leitura.
    const relido = setInterval(verificar, 5000);
    return () => {
      vigente = false;
      clearInterval(relido);
      cancelar();
    };
  }, [api, disponivel, atualizarOferta, ir]);

  return (
    <Tela escura rotulo="Em plantão" semRodape>
      <Corpo style={{ padding: '12px 24px 0', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="marca" style={{ fontSize: 22, letterSpacing: 0 }}>
            guinchei
          </span>
          <Avatar
            iniciais={iniciais(guincheiro?.nome ?? '')}
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
                {guincheiro ? `${guincheiro.nome} · ${guincheiro.frota}` : ''}
              </span>
            </div>
            <Interruptor ligado={disponivel} onChange={(v) => void definirDisponivel(v)} />
          </div>
          <div style={{ height: 1, background: 'var(--linha-escura)' }} />
          <div style={{ font: '400 14px/1.5 var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
            {disponivel
              ? 'Mantenha o app aberto para receber chamados. Avisos com a tela bloqueada ainda não estão disponíveis.'
              : 'Você não recebe chamados enquanto estiver indisponível.'}
          </div>
        </div>
        {!disponivel && guincheiro && <AvisoDeHomologacao />}
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
        <Link
          style={{ alignSelf: 'flex-start', fontSize: 14 }}
          onClick={async () => {
            await api.sair().catch(() => {});
            setGuincheiro(null);
            ir('/entrar', { replace: true });
          }}
        >
          Sair
        </Link>
      </Corpo>
      <AbasGuincheiro atual="plantao" escura />
    </Tela>
  );
}
