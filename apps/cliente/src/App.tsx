import { Navigate, Route, Routes } from 'react-router-dom';
import type { ApiGuinchei } from '@guinchei/api';
import { LimiteDeErro, Moldura } from '@guinchei/ui';
import { ApiContexto } from './api';
import { FluxoProvider } from './fluxo';
import { MapasContexto, type Mapas } from './mapas';
import { ExigePerfil } from './sessao';
import { AvisoGlobal } from './AvisoGlobal';
import { BoasVindas, Celular, Codigo } from './telas/Entrada';
import { Cadastro } from './telas/Cadastro';
import { PedidoEtapa } from './telas/Pedido';
import { Local } from './telas/Local';
import { Pagamento, Preco } from './telas/Preco';
import { Corrida } from './telas/Corrida';
import { Entregue, Historico } from './telas/Depois';

/** `mapas` é `null` sem VITE_MAPBOX_TOKEN: a tela de local usa o mapa do protótipo. */
export function App({ api, mapas }: { api: ApiGuinchei; mapas: Mapas | null }) {
  return (
    <ApiContexto.Provider value={api}>
      <MapasContexto.Provider value={mapas}>
        <FluxoProvider>
          <Moldura>
            <LimiteDeErro>
              <Routes>
                <Route path="/" element={<BoasVindas />} />
                <Route path="/entrar" element={<Celular />} />
                <Route path="/codigo" element={<Codigo />} />
                <Route path="/cadastro" element={<Cadastro />} />
                <Route
                  path="/pedido/:etapa"
                  element={
                    <ExigePerfil>
                      <PedidoEtapa />
                    </ExigePerfil>
                  }
                />
                <Route path="/local" element={<Local />} />
                <Route path="/preco" element={<Preco />} />
                <Route path="/pagamento" element={<Pagamento />} />
                <Route path="/corrida" element={<Corrida />} />
                <Route path="/entregue" element={<Entregue />} />
                <Route path="/historico" element={<Historico />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <AvisoGlobal />
            </LimiteDeErro>
          </Moldura>
        </FluxoProvider>
      </MapasContexto.Provider>
    </ApiContexto.Provider>
  );
}
