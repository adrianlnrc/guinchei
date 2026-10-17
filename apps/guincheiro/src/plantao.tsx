import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { TRANSICOES_CORRIDA, TransicaoInvalida, transitarCorrida } from '@guinchei/mock';
import { type EstadoCorrida } from '@guinchei/estados';
import { HISTORICO_GUINCHEIRO, LADOS, type CorridaHistorico } from '@guinchei/mock';

export type Etapa = 'antes' | 'depois';

export interface FotoEstado {
  hora: string;
  gps: string;
}

type Fotos = Record<Etapa, (FotoEstado | null)[]>;

const fotosVazias = (): Fotos => ({ antes: LADOS.map(() => null), depois: LADOS.map(() => null) });

interface Plantao {
  disponivel: boolean;
  setDisponivel: (v: boolean) => void;
  /** Mock do Match: um chamado por vez que o Guincheiro fica disponível. */
  chamadoPendente: boolean;
  consumirChamado: () => void;
  estado: EstadoCorrida | null;
  fotos: Fotos;
  aceitar: () => void;
  /**
   * Leva a Corrida ao estado `para` e abre `rota`. Se a transição não vale (o
   * Guincheiro voltou no navegador, recarregou a página, faltam fotos), avisa e
   * abre a tela do estado atual em vez de derrubar o app.
   */
  avancar: (para: EstadoCorrida, rota: string) => void;
  registrarFoto: (etapa: Etapa, lado: number, foto: FotoEstado) => void;
  encerrar: (c: CorridaHistorico) => void;
  historico: CorridaHistorico[];
  aviso: string | null;
  avisar: (texto: string) => void;
}

const Contexto = createContext<Plantao | null>(null);

export const contarFotos = (lista: (FotoEstado | null)[]) => lista.filter(Boolean).length;

/** Tela em que o Guincheiro retoma a Corrida em cada estado. */
const TELA_DO_ESTADO: Record<EstadoCorrida, string> = {
  aceita: '/a-caminho',
  a_caminho: '/a-caminho',
  no_local: '/fotos/antes',
  carregado: '/transporte',
  entregue: '/repasse',
};

export function PlantaoProvider({ children }: { children: ReactNode }) {
  const ir = useNavigate();
  const [disponivel, setDisponivelBruto] = useState(true);
  const [chamadoPendente, setChamadoPendente] = useState(true);
  const setDisponivel = useCallback((v: boolean) => {
    setDisponivelBruto(v);
    setChamadoPendente(v);
  }, []);
  const consumirChamado = useCallback(() => setChamadoPendente(false), []);
  const [estado, setEstado] = useState<EstadoCorrida | null>(null);
  const [fotos, setFotos] = useState<Fotos>(fotosVazias);
  const [historico, setHistorico] = useState(HISTORICO_GUINCHEIRO);
  const [aviso, setAviso] = useState<string | null>(null);

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso((atual) => (atual === texto ? null : atual)), 3200);
  }, []);

  const aceitar = useCallback(() => {
    setFotos(fotosVazias());
    setEstado(transitarCorrida('aceita', 'a_caminho', { antes: 0, depois: 0 }));
  }, []);

  const avancar = useCallback(
    (para: EstadoCorrida, rota: string) => {
      if (estado === null) {
        avisar('Nenhuma Corrida em andamento.');
        ir('/', { replace: true });
        return;
      }
      // Tocar de novo o botão de uma etapa já feita só reabre a tela dela.
      if (estado === para) {
        ir(rota, { replace: true });
        return;
      }
      try {
        const novo = transitarCorrida(estado, para, {
          antes: contarFotos(fotos.antes),
          depois: contarFotos(fotos.depois),
        });
        setEstado(novo);
        ir(rota, { replace: true });
      } catch (erro) {
        if (!(erro instanceof TransicaoInvalida)) throw erro;
        // Falta de Fotos de estado tem mensagem própria; fora de ordem, só leva de volta.
        const foraDeOrdem = !TRANSICOES_CORRIDA[estado].includes(para);
        avisar(foraDeOrdem ? 'A Corrida está em outra etapa. Voltamos para ela.' : erro.message);
        ir(TELA_DO_ESTADO[estado], { replace: true });
      }
    },
    [estado, fotos, avisar, ir],
  );

  const registrarFoto = useCallback((etapa: Etapa, lado: number, foto: FotoEstado) => {
    setFotos((f) => ({ ...f, [etapa]: f[etapa].map((atual, i) => (i === lado ? foto : atual)) }));
  }, []);

  const encerrar = useCallback((c: CorridaHistorico) => {
    setHistorico((h) => [c, ...h]);
    setEstado(null);
    setFotos(fotosVazias());
  }, []);

  const valor = useMemo(
    () => ({
      disponivel,
      setDisponivel,
      chamadoPendente,
      consumirChamado,
      estado,
      fotos,
      aceitar,
      avancar,
      registrarFoto,
      encerrar,
      historico,
      aviso,
      avisar,
    }),
    [
      disponivel,
      setDisponivel,
      chamadoPendente,
      consumirChamado,
      estado,
      fotos,
      aceitar,
      avancar,
      registrarFoto,
      encerrar,
      historico,
      aviso,
      avisar,
    ],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePlantao() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('usePlantao fora do PlantaoProvider');
  return ctx;
}
