import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  FILA_HOMOLOGACAO,
  MONITOR,
  TAXA_CANCELAMENTO,
  type CorridaMonitor,
  type FrotaHomologacao,
} from '@guinchei/mock';
import { TABELA_PADRAO, type TabelaPrecos } from '@guinchei/preco';

/** Tabela de preços do pacote mais a taxa de cancelamento, que a operação edita junto. */
export interface TabelaDoPainel extends TabelaPrecos {
  taxaCancelamento: number;
}

const TABELA_INICIAL: TabelaDoPainel = { ...TABELA_PADRAO, taxaCancelamento: TAXA_CANCELAMENTO };

interface Operacao {
  corridas: CorridaMonitor[];
  fila: FrotaHomologacao[];
  atualizarFrota: (f: FrotaHomologacao) => void;
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
  const corridas = MONITOR;
  const [fila, setFila] = useState(FILA_HOMOLOGACAO);
  const [decisaoDisputa, setDecisaoDisputa] = useState<string | null>(null);
  const disputasAbertas = decisaoDisputa === null ? 1 : 0;
  const [tabela, setTabela] = useState(TABELA_INICIAL);
  const [aviso, setAviso] = useState<string | null>(null);

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso((atual) => (atual === texto ? null : atual)), 3600);
  }, []);

  const atualizarFrota = useCallback(
    (f: FrotaHomologacao) => setFila((fs) => fs.map((x) => (x.id === f.id ? f : x))),
    [],
  );
  const resolverDisputa = useCallback((decisao: string) => setDecisaoDisputa(decisao), []);
  const publicarTabela = useCallback(
    (t: TabelaDoPainel) => setTabela({ ...t, versao: t.versao + 1 }),
    [],
  );

  const homologacoesPendentes = fila.filter((f) => !f.ativada).length;

  const valor = useMemo(
    () => ({
      corridas,
      fila,
      atualizarFrota,
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
      fila,
      atualizarFrota,
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
