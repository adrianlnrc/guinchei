import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErroApi, type CorridaDoGuincheiro, type EstadoCorrida } from '@guinchei/api';
import { Botao, Corpo, IndicadorHome, Mapa, Ponto, Tela, formatarKm } from '@guinchei/ui';
import { useApi } from '../api';
import { usePlantao } from '../plantao';
import { Chips, Navegacao, chipsDoPedido } from './comum';

/** O botão de cada etapa: o próximo estado e o texto, na ordem da Corrida (ADR-0008). */
const PROXIMA_ETAPA: Record<
  Exclude<EstadoCorrida, 'entregue'>,
  { para: EstadoCorrida; botao: string }
> = {
  aceita: { para: 'a_caminho', botao: 'Saí para o local' },
  a_caminho: { para: 'no_local', botao: 'Cheguei' },
  no_local: { para: 'carregado', botao: 'Carreguei' },
  carregado: { para: 'entregue', botao: 'Entreguei' },
};

export function Corrida() {
  const ir = useNavigate();
  const api = useApi();
  const { avisar } = usePlantao();
  // undefined: ainda lendo; null: não há Corrida em andamento.
  const [corrida, setCorrida] = useState<CorridaDoGuincheiro | null | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const id = corrida?.id;

  const recarregar = useCallback(async () => {
    try {
      setCorrida(await api.minhaCorridaAtual());
    } catch {
      setCorrida((atual) => atual ?? null);
      avisar('Não foi possível ler a Corrida. Tente de novo.');
    }
  }, [api, avisar]);

  useEffect(() => {
    let vigente = true;
    api
      .minhaCorridaAtual()
      .then((c) => vigente && setCorrida(c))
      .catch(() => {
        if (!vigente) return;
        setCorrida((atual) => atual ?? null);
        avisar('Não foi possível ler a Corrida. Tente de novo.');
      });
    return () => {
      vigente = false;
    };
  }, [api, avisar]);

  // A Corrida pode mudar fora desta tela (outra aba, a operação): o Realtime avisa.
  useEffect(() => {
    if (!id) return;
    return api.assinarCorrida(
      id,
      (estado) => {
        if (estado === 'entregue') ir(`/repasse/${id}`, { replace: true });
        else setCorrida((atual) => (atual?.id === id ? { ...atual, estado } : atual));
      },
      () => void recarregar(),
    );
  }, [api, id, ir, recarregar]);

  async function avancar(atual: CorridaDoGuincheiro, para: EstadoCorrida) {
    setEnviando(true);
    try {
      const novo = await api.avancarCorrida(atual.id, para);
      if (novo === 'entregue') {
        ir(`/repasse/${atual.id}`, { replace: true });
        return;
      }
      setCorrida({ ...atual, estado: novo });
    } catch (e) {
      if (e instanceof ErroApi && e.motivo === 'transicao_invalida') {
        // A Corrida já estava em outra etapa (outra aba, a operação): mostra a etapa certa.
        avisar('A Corrida está em outra etapa. Atualizamos a tela.');
        const real = await api.buscarCorrida(atual.id).catch(() => null);
        if (real?.estado === 'entregue') ir(`/repasse/${atual.id}`, { replace: true });
        else if (real) setCorrida(real);
      } else if (e instanceof ErroApi && e.motivo === 'corrida_indisponivel') {
        avisar('Esta Corrida não está mais com você.');
        ir('/', { replace: true });
      } else {
        avisar('Não foi possível atualizar a Corrida. Tente de novo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  if (corrida === undefined)
    return (
      <Tela escura rotulo="Carregando">
        {null}
      </Tela>
    );
  if (corrida === null || corrida.estado === 'entregue') return <Navigate to="/" replace />;

  const etapa = PROXIMA_ETAPA[corrida.estado];
  const { pedido } = corrida;
  const passo = (
    <Botao variante="claro" grande disabled={enviando} onClick={() => avancar(corrida, etapa.para)}>
      {etapa.botao}
    </Botao>
  );
  const fotos = (e: 'antes' | 'depois') => (
    <Botao variante="contorno-escuro" onClick={() => ir(`/fotos/${e}`)}>
      Fotos de estado (opcional)
    </Botao>
  );

  if (corrida.estado === 'aceita' || corrida.estado === 'a_caminho') {
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
        <Navegacao rotulo="Vá até o Cliente" endereco={pedido.origemEndereco ?? 'Origem'} />
        <div className="folha folha--escura">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ font: '700 24px var(--fonte-titulo)' }}>
              {corrida.estado === 'aceita' ? 'Corrida aceita' : 'A caminho'}
            </span>
            {corrida.kmAteVeiculo !== null && (
              <span style={{ font: '500 15px var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
                {formatarKm(corrida.kmAteVeiculo)} de você
              </span>
            )}
          </div>
          <Chips itens={chipsDoPedido(pedido)} />
          {passo}
          <IndicadorHome />
        </div>
      </Tela>
    );
  }

  if (corrida.estado === 'no_local') {
    return (
      <Tela escura rotulo="No local">
        <Corpo style={{ padding: '12px 24px 32px', gap: 16 }}>
          <Ponto style={{ marginTop: 12 }}>No local do Cliente</Ponto>
          <h1 className="titulo" style={{ font: '700 28px/1.12 var(--fonte-titulo)' }}>
            Confira o veículo e carregue
          </h1>
          <p className="apoio" style={{ fontSize: 15 }}>
            Fotografar o veículo antes de carregar protege você numa reclamação de avaria. É
            opcional e não trava a Corrida.
          </p>
          <Chips itens={chipsDoPedido(pedido)} />
          <div className="espaco" />
          {fotos('antes')}
          {passo}
        </Corpo>
      </Tela>
    );
  }

  return (
    <Tela mapa escura rotulo="Em transporte">
      <Mapa
        escuro
        ruas={[
          { top: 260, esp: 16, giro: -18 },
          { left: 110, esp: 12 },
          { left: 280, esp: 10, giro: -6 },
        ]}
        rota="292,460 290,290 116,300 116,150"
        rotaEspessura={6}
        marcadores={[
          { left: 276, top: 444, tamanho: 32, tipo: 'guincho' },
          { left: 104, top: 138, tamanho: 24, tipo: 'destino' },
        ]}
      />
      <Navegacao rotulo="Leve o veículo até" endereco={pedido.destinoEndereco ?? 'Destino'} />
      <div className="folha folha--escura" style={{ gap: 14 }}>
        <Ponto>Carregado</Ponto>
        {pedido.kmRebocado !== null && (
          <span style={{ font: '500 15px var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
            {formatarKm(pedido.kmRebocado)} de reboque
          </span>
        )}
        {fotos('depois')}
        {passo}
        <IndicadorHome />
      </div>
    </Tela>
  );
}
