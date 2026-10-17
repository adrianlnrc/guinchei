import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { TABELA_PADRAO, type TabelaPrecos } from '@guinchei/mock';
import {
  FILA_HOMOLOGACAO,
  MONITOR,
  type CorridaMonitor,
  type FrotaHomologacao,
} from '@guinchei/mock';

interface Operacao {
  corridas: CorridaMonitor[];
  atribuir: (id: number, guincheiro: string) => void;
  fila: FrotaHomologacao[];
  atualizarFrota: (f: FrotaHomologacao) => void;
  homologacoesPendentes: number;
  disputasAbertas: number;
  resolverDisputa: () => void;
  tabela: TabelaPrecos;
  publicarTabela: (t: TabelaPrecos) => void;
  aviso: string | null;
  avisar: (texto: string) => void;
}

const Contexto = createContext<Operacao | null>(null);

export function OperacaoProvider({ children }: { children: ReactNode }) {
  const [corridas, setCorridas] = useState(MONITOR);
  const [fila, setFila] = useState(FILA_HOMOLOGACAO);
  const [disputasAbertas, setDisputasAbertas] = useState(1);
  const [tabela, setTabela] = useState(TABELA_PADRAO);
  const [aviso, setAviso] = useState<string | null>(null);

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso((atual) => (atual === texto ? null : atual)), 3600);
  }, []);

  const atribuir = useCallback((id: number, guincheiro: string) => {
    setCorridas((cs) =>
      cs.map((c) =>
        c.id === id ? { ...c, estado: 'aceita', guincheiro, detalhe: undefined, minutos: 0 } : c,
      ),
    );
  }, []);

  const atualizarFrota = useCallback(
    (f: FrotaHomologacao) => setFila((fs) => fs.map((x) => (x.id === f.id ? f : x))),
    [],
  );
  const resolverDisputa = useCallback(() => setDisputasAbertas((n) => Math.max(0, n - 1)), []);
  const publicarTabela = useCallback(
    (t: TabelaPrecos) => setTabela({ ...t, versao: t.versao + 1 }),
    [],
  );

  const homologacoesPendentes = fila.filter((f) => !f.ativada).length;

  const valor = useMemo(
    () => ({
      corridas,
      atribuir,
      fila,
      atualizarFrota,
      homologacoesPendentes,
      disputasAbertas,
      resolverDisputa,
      tabela,
      publicarTabela,
      aviso,
      avisar,
    }),
    [
      corridas,
      atribuir,
      fila,
      atualizarFrota,
      homologacoesPendentes,
      disputasAbertas,
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
