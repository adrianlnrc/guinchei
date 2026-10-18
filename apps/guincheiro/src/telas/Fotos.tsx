import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { DURACAO_MAXIMA_VIDEO_SEGUNDOS, LIMITE_FOTOS_POR_ETAPA } from '@guinchei/api';
import type { CorridaDoGuincheiro } from '@guinchei/api';
import { etapaDaFoto } from '@guinchei/estados';
import {
  Botao,
  Corpo,
  GaleriaFotosEstado,
  Link,
  RegistrarFotoEstado,
  Rotulo,
  Tela,
  useFotosEstado,
} from '@guinchei/ui';
import { useApi } from '../api';
import { usePlantao } from '../plantao';

const TEXTO_DA_ETAPA = {
  antes: {
    rotulo: 'Antes de carregar',
    titulo: 'Fotografe o veículo antes de carregar',
    recomendacao: 'Recomendado: pelo menos 2 fotos, de ângulos diferentes.',
  },
  depois: {
    rotulo: 'Na entrega',
    titulo: 'Fotografe o veículo na entrega',
    recomendacao: 'Recomendado: pelo menos 2 fotos do veículo já no destino.',
  },
} as const;

/**
 * Fotos de estado (ADR-0011): opcionais, não travam nenhuma etapa da Corrida. A etapa vem
 * do estado da Corrida ("antes" até carregar; "depois" de carregado em diante) e o banco
 * confere a mesma regra. Mostra as fotos dos dois lados.
 */
export function Fotos() {
  const ir = useNavigate();
  const api = useApi();
  const { avisar } = usePlantao();
  // undefined: ainda lendo; null: não há Corrida em andamento.
  const [corrida, setCorrida] = useState<CorridaDoGuincheiro | null | undefined>(undefined);

  useEffect(() => {
    let vigente = true;
    api
      .minhaCorridaAtual()
      .then((c) => vigente && setCorrida(c))
      .catch(() => {
        if (!vigente) return;
        setCorrida(null);
        avisar('Não foi possível ler a Corrida. Tente de novo.');
      });
    return () => {
      vigente = false;
    };
  }, [api, avisar]);

  const lista = useFotosEstado(api, corrida?.id ?? null);

  if (corrida === undefined)
    return (
      <Tela escura rotulo="Carregando">
        {null}
      </Tela>
    );
  if (corrida === null) return <Navigate to="/corrida" replace />;

  const etapa = etapaDaFoto(corrida.estado);
  const texto = TEXTO_DA_ETAPA[etapa];

  return (
    <Tela escura rotulo={`Fotos de estado: ${texto.rotulo.toLowerCase()}`}>
      <Corpo style={{ padding: '12px 24px 32px', gap: 16 }}>
        <Rotulo>{texto.rotulo}</Rotulo>
        <h1
          className="titulo"
          style={{ font: '700 28px/1.12 var(--fonte-titulo)', letterSpacing: '-.01em' }}
        >
          {texto.titulo}
        </h1>
        <p className="apoio" style={{ fontSize: 15 }}>
          Registrar fotos protege você se houver reclamação de avaria. São opcionais: a Corrida
          segue sem elas. {texto.recomendacao}
        </p>
        <RegistrarFotoEstado
          escura
          api={api}
          corridaId={corrida.id}
          etapa={etapa}
          papel="guincheiro"
          fotos={lista.fotos}
          limite={LIMITE_FOTOS_POR_ETAPA}
          duracaoMaximaSegundos={DURACAO_MAXIMA_VIDEO_SEGUNDOS}
          aoRegistrar={lista.recarregar}
        />
        {lista.erro && (
          <p role="alert" className="apoio" style={{ fontSize: 14 }}>
            Não foi possível carregar as fotos da Corrida.
          </p>
        )}
        <GaleriaFotosEstado escura etapa={etapa} fotos={lista.fotos} />
        <div className="espaco" />
        {lista.fotos.some((f) => f.papelAutor === 'guincheiro' && f.etapa === etapa) ? (
          <Botao variante="claro" grande onClick={() => ir('/corrida')}>
            Voltar à Corrida
          </Botao>
        ) : (
          <Link centro onClick={() => ir('/corrida')}>
            Voltar à Corrida
          </Link>
        )}
      </Corpo>
    </Tela>
  );
}
