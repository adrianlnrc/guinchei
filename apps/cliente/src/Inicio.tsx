import { lazy, useMemo } from 'react';
import { criarApi, criarClienteApi } from '@guinchei/api';
import { criarServicoMapbox } from '@guinchei/geo/mapbox';
import { Corpo, Moldura, Rotulo, Tela } from '@guinchei/ui';
import { App } from './App';
import type { Mapas, PropsMapaInterativo } from './mapas';

interface ConfigServidor {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Token público do Mapbox; sem ele, a tela de local usa o mapa do protótipo. */
  mapboxToken?: string;
}

/** Mapa e busca reais do Mapbox; o mapbox-gl só é baixado quando a tela de local abre. */
function criarMapas(token: string): Mapas {
  return {
    servico: criarServicoMapbox({ token }),
    MapaInterativo: lazy(async () => {
      const { default: MapaMapbox } = await import('./MapaMapbox');
      return { default: (props: PropsMapaInterativo) => <MapaMapbox token={token} {...props} /> };
    }),
  };
}

/**
 * Liga o app ao Supabase do ambiente. Sem as duas variáveis (ex.: um deploy antes de
 * cadastrá-las), mostra um aviso em vez de quebrar.
 */
export function Inicio({ supabaseUrl, supabaseAnonKey, mapboxToken }: ConfigServidor) {
  const api = useMemo(
    () =>
      supabaseUrl && supabaseAnonKey
        ? criarApi(criarClienteApi({ supabaseUrl, supabaseAnonKey }))
        : null,
    [supabaseUrl, supabaseAnonKey],
  );
  const mapas = useMemo(() => (mapboxToken ? criarMapas(mapboxToken) : null), [mapboxToken]);
  return api ? <App api={api} mapas={mapas} /> : <SemConfiguracao />;
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
