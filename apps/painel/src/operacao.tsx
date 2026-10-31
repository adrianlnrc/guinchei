import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { FrotaNaFila, PedidoAguardandoAprovacao } from '@guinchei/api';
import { MONITOR, TAXA_CANCELAMENTO, type CorridaMonitor } from '@guinchei/mock';
import { TABELA_PADRAO, type TabelaPrecos } from '@guinchei/preco';
import { useApi } from './api';

/** Tabela de preços do pacote mais a taxa de cancelamento, que a operação edita junto. */
export interface TabelaDoPainel extends TabelaPrecos {
  taxaCancelamento: number;
}

const TABELA_INICIAL: TabelaDoPainel = { ...TABELA_PADRAO, taxaCancelamento: TAXA_CANCELAMENTO };

interface Operacao {
  corridas: CorridaMonitor[];
  /**
   * Pedidos redirecionados a outra Frota por um preço maior, à espera de o Cliente aprovar
   * (ADR-0013); `null` até a leitura chegar. A leitura se repete a cada 10 s.
   */
  aguardandoAprovacao: PedidoAguardandoAprovacao[] | null;
  /** Frotas com item pendente, a mais antiga primeiro; `null` até a fila carregar. */
  fila: FrotaNaFila[] | null;
  /** A leitura da fila falhou (a tela não deve mostrar "fila vazia"). */
  erroFila: boolean;
  recarregarFila: () => Promise<void>;
  homologacoesPendentes: number;
  disputasAbertas: number;
  /** Decisão registrada na Disputa do protótipo; `null` enquanto está em análise. */
  decisaoDisputa: string | null;
  resolverDisputa: (decisao: string) => void;
  tabela: TabelaDoPainel;
  publicarTabela: (t: TabelaDoPainel) => void;
  aviso: string | null;
  avisar: (texto: string) => void;
}

const Contexto = createContext<Operacao | null>(null);

export function OperacaoProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const corridas = MONITOR;
  const [fila, setFila] = useState<FrotaNaFila[] | null>(null);
  const [erroFila, setErroFila] = useState(false);
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState<
    PedidoAguardandoAprovacao[] | null
  >(null);
  const [decisaoDisputa, setDecisaoDisputa] = useState<string | null>(null);
  const disputasAbertas = decisaoDisputa === null ? 1 : 0;
  const [tabela, setTabela] = useState(TABELA_INICIAL);
  const [aviso, setAviso] = useState<string | null>(null);

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso((atual) => (atual === texto ? null : atual)), 3600);
  }, []);

  const recarregarFila = useCallback(async () => {
    try {
      setFila(await api.listarFilaHomologacao());
      setErroFila(false);
    } catch {
      setErroFila(true);
    }
  }, [api]);
  useEffect(() => {
    let vigente = true;
    api.listarFilaHomologacao().then(
      (lida) => {
        if (!vigente) return;
        setFila(lida);
        setErroFila(false);
      },
      () => {
        if (vigente) setErroFila(true);
      },
    );
    return () => {
      vigente = false;
    };
  }, [api]);

  // O Monitor acompanha os Pedidos que o Match pausou à espera do Cliente. Falha de leitura
  // mantém a última lista boa e tenta de novo no próximo ciclo.
  useEffect(() => {
    let vigente = true;
    const ler = () =>
      api.listarPedidosAguardandoAprovacao().then(
        (lidos) => {
          if (vigente) setAguardandoAprovacao(lidos);
        },
        () => {},
      );
    void ler();
    const ciclo = setInterval(() => void ler(), 10_000);
    return () => {
      vigente = false;
      clearInterval(ciclo);
    };
  }, [api]);

  const resolverDisputa = useCallback((decisao: string) => setDecisaoDisputa(decisao), []);
  const publicarTabela = useCallback(
    (t: TabelaDoPainel) => setTabela({ ...t, versao: t.versao + 1 }),
    [],
  );

  const homologacoesPendentes = fila?.length ?? 0;

  const valor = useMemo(
    () => ({
      corridas,
      aguardandoAprovacao,
      fila,
      erroFila,
      recarregarFila,
      homologacoesPendentes,
      disputasAbertas,
      decisaoDisputa,
      resolverDisputa,
      tabela,
      publicarTabela,
      aviso,
      avisar,
    }),
    [
      corridas,
      aguardandoAprovacao,
      fila,
      erroFila,
      recarregarFila,
      homologacoesPendentes,
      disputasAbertas,
      decisaoDisputa,
      resolverDisputa,
      tabela,
      publicarTabela,
      aviso,
      avisar,
    ],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useOperacao() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useOperacao fora do OperacaoProvider');
  return ctx;
}
