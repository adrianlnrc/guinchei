import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Tela } from '@guinchei/ui';
import { useApi } from './api';
import { usePlantao } from './plantao';

export const AVISO_NAO_E_GUINCHEIRO = 'Este número não está cadastrado como Guincheiro.';

/** Em que ponto da entrada está quem abre o app. */
export type EstadoSessao = 'verificando' | 'sem_sessao' | 'nao_e_guincheiro' | 'pronto';

/**
 * Carrega o Guincheiro da sessão guardada no aparelho. Sessão de quem não é Guincheiro
 * (por exemplo, um Cliente que entrou aqui) é encerrada: o Guincheiro não se cadastra pelo app.
 */
export function useSessao(): EstadoSessao {
  const api = useApi();
  const { guincheiro, setGuincheiro } = usePlantao();
  const [estado, setEstado] = useState<EstadoSessao>('verificando');

  useEffect(() => {
    if (guincheiro) return;
    let vigente = true;
    (async () => {
      if (!(await api.temSessao())) {
        if (vigente) setEstado('sem_sessao');
        return;
      }
      const meu = await api.buscarMeuGuincheiro();
      if (!vigente) return;
      if (meu) {
        setGuincheiro(meu);
        return;
      }
      await api.sair();
      if (vigente) setEstado('nao_e_guincheiro');
    })().catch(() => {
      if (vigente) setEstado('sem_sessao');
    });
    return () => {
      vigente = false;
    };
  }, [api, guincheiro, setGuincheiro]);

  return guincheiro ? 'pronto' : estado;
}

/** Telas do Guincheiro logado: sem sessão (ou sem perfil de Guincheiro), manda entrar. */
export function ExigeGuincheiro({ children }: { children: ReactNode }) {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_guincheiro') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_GUINCHEIRO }} />;
  }
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  return children;
}
