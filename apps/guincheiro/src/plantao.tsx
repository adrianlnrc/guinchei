import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { transitarCorrida } from '@guinchei/mock';
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
  avancar: (para: EstadoCorrida) => void;
  registrarFoto: (etapa: Etapa, lado: number, foto: FotoEstado) => void;
  encerrar: (c: CorridaHistorico) => void;
  historico: CorridaHistorico[];
  aviso: string | null;
  avisar: (texto: string) => void;
}

const Contexto = createContext<Plantao | null>(null);

export const contarFotos = (lista: (FotoEstado | null)[]) => lista.filter(Boolean).length;

export function PlantaoProvider({ children }: { children: ReactNode }) {
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

  // Lança TransicaoInvalida se faltar Foto de estado: a tela só chama quando pode.
  const avancar = useCallback(
    (para: EstadoCorrida) => {
      setEstado((de) =>
        transitarCorrida(de ?? 'aceita', para, {
          antes: contarFotos(fotos.antes),
          depois: contarFotos(fotos.depois),
        }),
      );
    },
    [fotos],
  );

  const registrarFoto = useCallback((etapa: Etapa, lado: number, foto: FotoEstado) => {
    setFotos((f) => ({ ...f, [etapa]: f[etapa].map((atual, i) => (i === lado ? foto : atual)) }));
  }, []);

  const encerrar = useCallback((c: CorridaHistorico) => {
    setHistorico((h) => [c, ...h]);
    setEstado(null);
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
