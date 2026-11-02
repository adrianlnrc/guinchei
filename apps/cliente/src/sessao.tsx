import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Tela } from '@guinchei/ui';
import { useApi } from './api';
import { useFluxo } from './fluxo';

export const AVISO_NAO_E_CLIENTE =
  'Este número é de outro tipo de conta. Para pedir guincho, entre com o celular de um Cliente.';

/**
 * Em que ponto da entrada está quem abre o app. `nao_e_cliente`: o perfil é de Guincheiro,
 * representante ou operação; a sessão é encerrada (uma conta tem um papel só).
 */
export type EstadoSessao =
  | 'verificando'
  | 'sem_sessao'
  | 'nao_e_cliente'
  | 'sem_perfil'
  | 'pronto';

/** Carrega o perfil da sessão guardada no aparelho, se ainda não estiver no fluxo. */
export function useSessao(): EstadoSessao {
  const api = useApi();
  const { perfil, setPerfil } = useFluxo();
  const [estado, setEstado] = useState<EstadoSessao>('verificando');

  useEffect(() => {
    if (perfil) return;
    let vigente = true;
    (async () => {
      const meu = await api.buscarMeuPerfil();
      if (!vigente) return;
      if (meu && meu.papel !== 'cliente') {
        await api.sair();
        if (vigente) setEstado('nao_e_cliente');
      } else if (meu) setPerfil(meu);
      else setEstado((await api.temSessao()) ? 'sem_perfil' : 'sem_sessao');
    })().catch(() => {
      if (vigente) setEstado('sem_sessao');
    });
    return () => {
      vigente = false;
    };
  }, [api, perfil, setPerfil]);

  return perfil ? 'pronto' : estado;
}

/** Telas que pedem Cliente com cadastro urgente: sem sessão, entrar; sem perfil, cadastrar. */
export function ExigePerfil({ children }: { children: ReactNode }) {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_cliente') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_CLIENTE }} />;
  }
  if (estado === 'sem_perfil') return <Navigate to="/cadastro" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  return children;
}
