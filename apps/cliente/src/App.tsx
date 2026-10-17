import { Navigate, Route, Routes } from 'react-router-dom';
import { Moldura } from '@guinchei/ui';
import { FluxoProvider } from './fluxo';
import { AvisoGlobal } from './AvisoGlobal';
import { BoasVindas, Celular, Codigo } from './telas/Entrada';
import { PedidoEtapa } from './telas/Pedido';
import { Local, Pagamento, Preco } from './telas/Preco';
import { Corrida } from './telas/Corrida';
import { Entregue, Historico } from './telas/Depois';

export function App() {
  return (
    <FluxoProvider>
      <Moldura>
        <Routes>
          <Route path="/" element={<BoasVindas />} />
          <Route path="/entrar" element={<Celular />} />
          <Route path="/codigo" element={<Codigo />} />
          <Route path="/pedido/:etapa" element={<PedidoEtapa />} />
          <Route path="/local" element={<Local />} />
          <Route path="/preco" element={<Preco />} />
          <Route path="/pagamento" element={<Pagamento />} />
          <Route path="/corrida" element={<Corrida />} />
          <Route path="/entregue" element={<Entregue />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AvisoGlobal />
      </Moldura>
    </FluxoProvider>
  );
}
