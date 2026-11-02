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
import { AcompanhamentoDoPedido } from './telas/Acompanhamento';
import { PaginaInicial } from './telas/PaginaInicial';
import { Corridas, DetalheDaCorrida } from './telas/Corridas';
import { Perfil } from './telas/Perfil';
import { AvaliarCorrida } from './telas/Avaliacao';

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
                <Route path="/acompanhamento" element={<AcompanhamentoDoPedido />} />
                <Route path="/inicio" element={<PaginaInicial />} />
                <Route path="/corridas" element={<Corridas />} />
                <Route path="/corridas/:pedidoId" element={<DetalheDaCorrida />} />
                <Route path="/corridas/:pedidoId/avaliar" element={<AvaliarCorrida />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/historico" element={<Navigate to="/corridas" replace />} />
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
