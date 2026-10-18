import { useMemo } from 'react';
import { criarApiGuincheiro, criarClienteApi } from '@guinchei/api';
import { Corpo, Moldura, Rotulo, Tela } from '@guinchei/ui';
import { App } from './App';

interface ConfigServidor {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

/**
 * Liga o app ao Supabase do ambiente. Sem as duas variáveis (ex.: um deploy antes de
 * cadastrá-las), mostra um aviso em vez de quebrar.
 */
export function Inicio({ supabaseUrl, supabaseAnonKey }: ConfigServidor) {
  const api = useMemo(
    () =>
      supabaseUrl && supabaseAnonKey
        ? criarApiGuincheiro(criarClienteApi({ supabaseUrl, supabaseAnonKey }))
        : null,
    [supabaseUrl, supabaseAnonKey],
  );
  return api ? <App api={api} /> : <SemConfiguracao />;
}

function SemConfiguracao() {
  return (
    <Moldura>
      <Tela escura rotulo="Sem configuração">
        <Corpo style={{ padding: '28px 28px 40px', gap: 20 }}>
          <div className="marca">guinchei</div>
          <div className="espaco" />
          <Rotulo style={{ color: 'var(--cinza-medio)' }}>Configuração</Rotulo>
          <h1 className="titulo">App sem configuração do servidor</h1>
          <p className="apoio">
            Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente e publique de novo.
          </p>
        </Corpo>
      </Tela>
    </Moldura>
  );
}
