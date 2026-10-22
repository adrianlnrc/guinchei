import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Tela } from '@guinchei/ui';
import { useApi } from './api';
import { usePlantao } from './plantao';
import { ROTA_DADOS_PESSOAIS } from './rotas';

export const AVISO_NAO_E_GUINCHEIRO = 'Este número não está cadastrado como Guincheiro.';

/**
 * Em que ponto da entrada está quem abre o app:
 * - `pronto`: Guincheiro de uma Frota;
 * - `sem_perfil`: telefone verificado, mas sem perfil de nada: pode cadastrar a própria Frota;
 * - `convidado`: telefone verificado, sem perfil, com convite pendente de uma Frota: o primeiro
 *   acesso (nome, CPF e termos) cria o Guincheiro na Frota que convidou (#46);
 * - `representante`: perfil de representante (já enviou o cadastro da Frota), ainda sem a linha
 *   de Guincheiro, que vem com os documentos de Guincheiro;
 * - `nao_e_guincheiro`: perfil de Cliente ou da operação.
 */
export type EstadoSessao =
  | 'verificando'
  | 'sem_sessao'
  | 'nao_e_guincheiro'
  | 'sem_perfil'
  | 'convidado'
  | 'representante'
  | 'pronto';

/**
 * Carrega o Guincheiro da sessão guardada no aparelho. Sessão de Cliente ou da operação
 * (por exemplo, um Cliente que entrou aqui) é encerrada: uma conta tem um papel só.
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
      const perfil = await api.buscarMeuPerfil();
      if (!vigente) return;
      if (!perfil) {
        // O número convidado vale mais do que o cadastro da própria Frota.
        const convite = await api.buscarMeuConvite();
        if (vigente) setEstado(convite ? 'convidado' : 'sem_perfil');
        return;
      }
      if (perfil.papel === 'representante') {
        setEstado('representante');
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

/**
 * Telas do Guincheiro logado: sem sessão (ou com perfil de outro papel), manda entrar; quem
 * ainda não tem Frota vai ao cadastro (ou, se foi convidado, ao primeiro acesso), e quem já a
 * cadastrou, à própria Frota.
 */
export function ExigeGuincheiro({ children }: { children: ReactNode }) {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_guincheiro') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_GUINCHEIRO }} />;
  }
  if (estado === 'convidado') return <Navigate to={ROTA_DADOS_PESSOAIS} replace />;
  if (estado === 'sem_perfil') return <Navigate to="/cadastro" replace />;
  if (estado === 'representante') return <Navigate to="/frota" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  return children;
}
