import { Navigate, Route, Routes } from 'react-router-dom';
import type { ApiGuincheiro } from '@guinchei/api';
import { Aviso, LimiteDeErro, Moldura } from '@guinchei/ui';
import { ApiContexto } from './api';
import { PlantaoProvider, usePlantao } from './plantao';
import { ExigeGuincheiro } from './sessao';
import { Cadastro } from './telas/Cadastro';
import { NovoVeiculo } from './telas/NovoVeiculo';
import { Veiculos } from './telas/Veiculos';
import { MinhaFrota } from './telas/MinhaFrota';
import { Convites } from './telas/Convites';
import { DadosPessoais } from './telas/DadosPessoais';
import { ROTA_CONVITES, ROTA_DADOS_PESSOAIS } from './rotas';
import { Celular, Codigo } from './telas/Entrada';
import { Plantao } from './telas/Plantao';
import { Chamado } from './telas/Chamado';
import { Corrida } from './telas/Corrida';
import { Fotos } from './telas/Fotos';
import { Historico, Repasse } from './telas/Entrega';

function AvisoGlobal() {
  const { aviso } = usePlantao();
  return aviso ? <Aviso>{aviso}</Aviso> : null;
}

export function App({ api }: { api: ApiGuincheiro }) {
  return (
    <ApiContexto.Provider value={api}>
      <PlantaoProvider>
        <Moldura>
          <LimiteDeErro>
            <Routes>
              <Route path="/entrar" element={<Celular />} />
              <Route path="/codigo" element={<Codigo />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/frota" element={<MinhaFrota />} />
              <Route path={ROTA_CONVITES} element={<Convites />} />
              <Route path={ROTA_DADOS_PESSOAIS} element={<DadosPessoais />} />
              <Route path="/veiculos" element={<Veiculos />} />
              <Route path="/veiculos/novo" element={<NovoVeiculo />} />
              <Route
                path="/"
                element={
                  <ExigeGuincheiro>
                    <Plantao />
                  </ExigeGuincheiro>
                }
              />
              <Route
                path="/chamado"
                element={
                  <ExigeGuincheiro>
                    <Chamado />
                  </ExigeGuincheiro>
                }
              />
              <Route
                path="/corrida"
                element={
                  <ExigeGuincheiro>
                    <Corrida />
                  </ExigeGuincheiro>
                }
              />
              <Route
                path="/fotos"
                element={
                  <ExigeGuincheiro>
                    <Fotos />
                  </ExigeGuincheiro>
                }
              />
              <Route
                path="/repasse/:id"
                element={
                  <ExigeGuincheiro>
                    <Repasse />
                  </ExigeGuincheiro>
                }
              />
              <Route
                path="/corridas"
                element={
                  <ExigeGuincheiro>
                    <Historico />
                  </ExigeGuincheiro>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <AvisoGlobal />
          </LimiteDeErro>
        </Moldura>
      </PlantaoProvider>
    </ApiContexto.Provider>
  );
}
