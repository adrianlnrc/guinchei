import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { ErroApi, type MeuGuincheiro, type OfertaAberta } from '@guinchei/api';
import { HISTORICO_GUINCHEIRO, type CorridaHistorico } from '@guinchei/mock';
import { useApi } from './api';

interface Plantao {
  celular: string;
  setCelular: (v: string) => void;
  /** O Guincheiro logado; `null` até a sessão ser conferida. */
  guincheiro: MeuGuincheiro | null;
  setGuincheiro: Dispatch<SetStateAction<MeuGuincheiro | null>>;
  /** Liga ou desliga o plantão: grava `guincheiros.disponivel` (volta atrás se falhar). */
  definirDisponivel: (disponivel: boolean) => Promise<void>;
  /** Agora, pelo relógio do servidor (o do aparelho pode estar errado). */
  agoraNoServidor: () => number;
  /** A oferta aberta a ser mostrada, a que vence primeiro; `null` se não há. */
  oferta: OfertaAberta | null;
  /** Relê as ofertas e acerta o relógio do servidor; devolve a oferta a mostrar. */
  atualizarOferta: () => Promise<OfertaAberta | null>;
  /** A oferta foi respondida ou venceu: não volta a ser mostrada. */
  descartarOferta: (tentativaId: number) => void;
  /** Guarda a Corrida entregue no histórico da sessão (o histórico ainda é do protótipo). */
  encerrar: (c: CorridaHistorico) => void;
  historico: CorridaHistorico[];
  aviso: string | null;
  avisar: (texto: string) => void;
}

const Contexto = createContext<Plantao | null>(null);

export function PlantaoProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [celular, setCelular] = useState('');
  const [guincheiro, setGuincheiro] = useState<MeuGuincheiro | null>(null);
  const [oferta, setOferta] = useState<OfertaAberta | null>(null);
  const [historico, setHistorico] = useState(HISTORICO_GUINCHEIRO);
  const [aviso, setAviso] = useState<string | null>(null);
  // Diferença entre o relógio do servidor e o do aparelho, medida a cada leitura de ofertas.
  const desvio = useRef(0);
  const descartadas = useRef(new Set<number>());

  const agoraNoServidor = useCallback(() => Date.now() + desvio.current, []);

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso((atual) => (atual === texto ? null : atual)), 3200);
  }, []);

  const definirDisponivel = useCallback(
    async (disponivel: boolean) => {
      setGuincheiro((g) => (g ? { ...g, disponivel } : g));
      try {
        await api.definirDisponibilidade(disponivel);
      } catch (erro) {
        setGuincheiro((g) => (g ? { ...g, disponivel: !disponivel } : g));
        avisar(
          erro instanceof ErroApi && erro.motivo === 'em_corrida'
            ? erro.message
            : 'Não foi possível mudar a disponibilidade. Tente de novo.',
        );
      }
    },
    [api, avisar],
  );

  const atualizarOferta = useCallback(async () => {
    const antes = Date.now();
    const [lista, hora] = await Promise.all([api.buscarOfertasAbertas(), api.horaDoServidor()]);
    // Metade do tempo de ida e volta: o servidor leu a hora no meio da espera.
    desvio.current = Date.parse(hora) - (antes + Date.now()) / 2;
    const agora = Date.now() + desvio.current;
    const valida =
      lista.find(
        (o) => !descartadas.current.has(o.tentativaId) && Date.parse(o.expiraEm) > agora,
      ) ?? null;
    setOferta(valida);
    return valida;
  }, [api]);

  const descartarOferta = useCallback((tentativaId: number) => {
    descartadas.current.add(tentativaId);
    setOferta((atual) => (atual?.tentativaId === tentativaId ? null : atual));
  }, []);

  const encerrar = useCallback((c: CorridaHistorico) => {
    setHistorico((h) => [c, ...h]);
  }, []);

  const valor = useMemo(
    () => ({
      celular,
      setCelular,
      guincheiro,
      setGuincheiro,
      definirDisponivel,
      agoraNoServidor,
      oferta,
      atualizarOferta,
      descartarOferta,
      encerrar,
      historico,
      aviso,
      avisar,
    }),
    [
      celular,
      guincheiro,
      definirDisponivel,
      agoraNoServidor,
      oferta,
      atualizarOferta,
      descartarOferta,
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
