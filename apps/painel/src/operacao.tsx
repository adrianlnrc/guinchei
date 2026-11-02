import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  agruparVencimentosPorFrota,
  type AlertaDeVencimento,
  type CorridaDoMonitor,
  type FrotaComVencimentos,
  type FrotaNaFila,
  type IndicadoresDoMonitor,
  type PedidoAguardandoAprovacao,
} from '@guinchei/api';
import { TAXA_CANCELAMENTO } from '@guinchei/mock';
import { TABELA_PADRAO, type TabelaPrecos } from '@guinchei/preco';
import { useApi } from './api';

/** Tabela de preços do pacote mais a taxa de cancelamento, que a operação edita junto. */
export interface TabelaDoPainel extends TabelaPrecos {
  taxaCancelamento: number;
}

const TABELA_INICIAL: TabelaDoPainel = { ...TABELA_PADRAO, taxaCancelamento: TAXA_CANCELAMENTO };

interface Operacao {
  /**
   * Pedidos dos últimos 24 h em Match ou atribuídos, lidos do banco a cada 5 s; `null` até a
   * primeira leitura chegar.
   */
  corridas: CorridaDoMonitor[] | null;
  /** Indicadores do topo do Monitor, na mesma cadência; `null` até chegarem. */
  indicadores: IndicadoresDoMonitor | null;
  /** A última leitura do Monitor falhou (a tela mostra a última lista boa, se houver). */
  erroMonitor: boolean;
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
  /** Itens aprovados vencendo no prazo do alerta e os vencidos; `null` até carregar. */
  vencimentos: AlertaDeVencimento | null;
  /** Os mesmos itens por Frota, a mais urgente primeiro. */
  frotasVencendo: FrotaComVencimentos[];
  /** A leitura dos vencimentos falhou (a tela não deve mostrar "nada vencendo"). */
  erroVencimentos: boolean;
  recarregarVencimentos: () => Promise<void>;
  /** Frotas com item pendente. */
  homologacoesPendentes: number;
  /** O contador da lateral: Frotas com item pendente mais Frotas com documento vencendo. */
  homologacoesEmAtencao: number;
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
  const [corridas, setCorridas] = useState<CorridaDoMonitor[] | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadoresDoMonitor | null>(null);
  const [erroMonitor, setErroMonitor] = useState(false);
  const [fila, setFila] = useState<FrotaNaFila[] | null>(null);
  const [erroFila, setErroFila] = useState(false);
  const [vencimentos, setVencimentos] = useState<AlertaDeVencimento | null>(null);
  const [erroVencimentos, setErroVencimentos] = useState(false);
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

  const recarregarVencimentos = useCallback(async () => {
    try {
      setVencimentos(await api.listarVencimentos());
      setErroVencimentos(false);
    } catch {
      setErroVencimentos(true);
    }
  }, [api]);
  useEffect(() => {
    let vigente = true;
    api.listarVencimentos().then(
      (lidos) => {
        if (!vigente) return;
        setVencimentos(lidos);
        setErroVencimentos(false);
      },
      () => {
        if (vigente) setErroVencimentos(true);
      },
    );
    return () => {
      vigente = false;
    };
  }, [api]);
  const frotasVencendo = useMemo(
    () => agruparVencimentosPorFrota(vencimentos?.itens ?? []),
    [vencimentos],
  );
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

  // O Monitor relê as Corridas e os indicadores a cada 5 s (polling; o Realtime fica para a
  // Corrida do Cliente e do Guincheiro). Falha mantém a última leitura boa e avisa na tela.
  useEffect(() => {
    let vigente = true;
    const ler = () =>
      Promise.all([api.listarCorridasDoMonitor(), api.lerIndicadoresDoMonitor()]).then(
        ([lidas, lidos]) => {
          if (!vigente) return;
          setCorridas(lidas);
          setIndicadores(lidos);
          setErroMonitor(false);
        },
        () => {
          if (vigente) setErroMonitor(true);
        },
      );
    void ler();
    const ciclo = setInterval(() => void ler(), 5_000);
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
  const homologacoesEmAtencao = homologacoesPendentes + frotasVencendo.length;

  const valor = useMemo(
    () => ({
      corridas,
      indicadores,
      erroMonitor,
      aguardandoAprovacao,
      fila,
      erroFila,
      recarregarFila,
      vencimentos,
      frotasVencendo,
      erroVencimentos,
      recarregarVencimentos,
      homologacoesPendentes,
      homologacoesEmAtencao,
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
      indicadores,
      erroMonitor,
      aguardandoAprovacao,
      fila,
      erroFila,
      recarregarFila,
      vencimentos,
      frotasVencendo,
      erroVencimentos,
      recarregarVencimentos,
      homologacoesPendentes,
      homologacoesEmAtencao,
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
