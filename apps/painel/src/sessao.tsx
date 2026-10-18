import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { MeuOperador } from '@guinchei/api';
import { useApi } from './api';

export const AVISO_NAO_E_OPERACAO = 'Este número não está cadastrado como operação';

interface Sessao {
  celular: string;
  setCelular: (v: string) => void;
  /** O operador logado; `null` até a sessão ser conferida. */
  operador: MeuOperador | null;
  setOperador: (o: MeuOperador | null) => void;
}

const Contexto = createContext<Sessao | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [celular, setCelular] = useState('');
  const [operador, setOperador] = useState<MeuOperador | null>(null);
  const valor = useMemo(
    () => ({ celular, setCelular, operador, setOperador }),
    [celular, operador],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSessao fora do SessaoProvider');
  return ctx;
}

/** Em que ponto da entrada está quem abre o Painel. */
type EstadoSessao = 'verificando' | 'sem_sessao' | 'nao_e_operacao' | 'pronto';

/**
 * Carrega o operador da sessão guardada no aparelho. Sessão de quem não é da operação
 * (um Cliente ou um Guincheiro que entrou aqui) é encerrada: o Painel é só da operação.
 */
function useEstadoDaSessao(): EstadoSessao {
  const api = useApi();
  const { operador, setOperador } = useSessao();
  const [estado, setEstado] = useState<EstadoSessao>('verificando');

  useEffect(() => {
    if (operador) return;
    let vigente = true;
    (async () => {
      if (!(await api.temSessao())) {
        if (vigente) setEstado('sem_sessao');
        return;
      }
      const meu = await api.buscarMeuOperador();
      if (!vigente) return;
      if (meu) {
        setOperador(meu);
        return;
      }
      await api.sair();
      if (vigente) setEstado('nao_e_operacao');
    })().catch(() => {
      if (vigente) setEstado('sem_sessao');
    });
    return () => {
      vigente = false;
    };
  }, [api, operador, setOperador]);

  return operador ? 'pronto' : estado;
}

/** Rotas do Painel logado: sem sessão (ou sem perfil da operação), manda entrar. */
export function ExigeOperacao() {
  const estado = useEstadoDaSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_operacao') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_OPERACAO }} />;
  }
  if (estado === 'verificando') {
    return (
      <main className="entrada" aria-label="Carregando">
        {null}
      </main>
    );
  }
  return <Outlet />;
}
