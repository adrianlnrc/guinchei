import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { EstadoCorrida } from '@guinchei/estados';
import {
  HISTORICO_CLIENTE,
  type CorridaHistorico,
  type Rodas,
  type Situacao,
  type Veiculo,
} from '@guinchei/mock';

export type EstadoAcompanhamento = 'em_match' | EstadoCorrida;

interface Fluxo {
  celular: string;
  setCelular: (v: string) => void;
  veiculo: Veiculo | null;
  setVeiculo: (v: Veiculo) => void;
  situacao: Situacao | null;
  setSituacao: (v: Situacao) => void;
  rodas: Rodas | null;
  setRodas: (v: Rodas) => void;
  /** Zera as respostas do rascunho para começar um Pedido novo. */
  novoPedido: () => void;
  historico: CorridaHistorico[];
  registrar: (c: CorridaHistorico) => void;
  aviso: string | null;
  avisar: (texto: string) => void;
}

const Contexto = createContext<Fluxo | null>(null);

export function FluxoProvider({ children }: { children: ReactNode }) {
  const [celular, setCelular] = useState('');
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [rodas, setRodas] = useState<Rodas | null>(null);
  const [historico, setHistorico] = useState(HISTORICO_CLIENTE);
  const [aviso, setAviso] = useState<string | null>(null);

  const novoPedido = useCallback(() => {
    setVeiculo(null);
    setSituacao(null);
    setRodas(null);
  }, []);
  const registrar = useCallback((c: CorridaHistorico) => setHistorico((h) => [c, ...h]), []);
  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso((atual) => (atual === texto ? null : atual)), 3200);
  }, []);

  const valor = useMemo(
    () => ({
      celular,
      setCelular,
      veiculo,
      setVeiculo,
      situacao,
      setSituacao,
      rodas,
      setRodas,
      novoPedido,
      historico,
      registrar,
      aviso,
      avisar,
    }),
    [celular, veiculo, situacao, rodas, novoPedido, historico, registrar, aviso, avisar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFluxo() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useFluxo fora do FluxoProvider');
  return ctx;
}

/** "61998124470" → "(61) 99812-4470" */
export function mascararCelular(digitos: string): string {
  const d = digitos.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
