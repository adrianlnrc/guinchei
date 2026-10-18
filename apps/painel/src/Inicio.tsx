import { useMemo } from 'react';
import { criarApiPainel, criarClienteApi } from '@guinchei/api';
import { Rotulo } from '@guinchei/ui';
import { App } from './App';

interface ConfigServidor {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

/**
 * Liga o Painel ao Supabase do ambiente. Sem as duas variáveis (ex.: um deploy antes de
 * cadastrá-las), mostra um aviso em vez de quebrar.
 */
export function Inicio({ supabaseUrl, supabaseAnonKey }: ConfigServidor) {
  const api = useMemo(
    () =>
      supabaseUrl && supabaseAnonKey
        ? criarApiPainel(criarClienteApi({ supabaseUrl, supabaseAnonKey }))
        : null,
    [supabaseUrl, supabaseAnonKey],
  );
  return api ? <App api={api} /> : <SemConfiguracao />;
}

function SemConfiguracao() {
  return (
    <main className="entrada" aria-label="Sem configuração">
      <div className="entrada__cartao">
        <div className="marca">
          guinchei <small>operação</small>
        </div>
        <Rotulo>Configuração</Rotulo>
        <h1 className="titulo">App sem configuração do servidor</h1>
        <p className="apoio">
          Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente e publique de novo.
        </p>
      </div>
    </main>
  );
}
