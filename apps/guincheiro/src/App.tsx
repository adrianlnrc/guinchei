import { Navigate, Route, Routes } from 'react-router-dom';
import { Aviso, LimiteDeErro, Moldura } from '@guinchei/ui';
import { PlantaoProvider, usePlantao } from './plantao';
import { ACaminho, Chamado, Plantao } from './telas/Chamado';
import { Camera, Checklist, Transporte } from './telas/Fotos';
import { ConfirmarEntrega, Historico, Repasse } from './telas/Entrega';

function AvisoGlobal() {
  const { aviso } = usePlantao();
  return aviso ? <Aviso>{aviso}</Aviso> : null;
}

export function App() {
  return (
    <PlantaoProvider>
      <Moldura>
        <LimiteDeErro>
          <Routes>
            <Route path="/" element={<Plantao />} />
            <Route path="/chamado" element={<Chamado />} />
            <Route path="/a-caminho" element={<ACaminho />} />
            <Route path="/fotos/antes" element={<Checklist />} />
            <Route path="/camera/:etapa/:lado" element={<Camera />} />
            <Route path="/transporte" element={<Transporte />} />
            <Route path="/entrega" element={<ConfirmarEntrega />} />
            <Route path="/repasse" element={<Repasse />} />
            <Route path="/corridas" element={<Historico />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <AvisoGlobal />
        </LimiteDeErro>
      </Moldura>
    </PlantaoProvider>
  );
}
