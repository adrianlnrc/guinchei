import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { OPERADOR } from '@guinchei/mock';
import { LimiteDeErro } from '@guinchei/ui';
import { OperacaoProvider, useOperacao } from './operacao';
import { Monitor } from './telas/Monitor';
import { Homologacao } from './telas/Homologacao';
import { Disputa } from './telas/Disputa';
import { TabelaDePrecos } from './telas/TabelaDePrecos';

function Lateral() {
  const { homologacoesPendentes, disputasAbertas } = useOperacao();
  return (
    <nav className="lateral" aria-label="Painel de operação">
      <div className="lateral__marca">
        guinchei <small>operação</small>
      </div>
      <NavLink to="/monitor">Monitor de Corridas</NavLink>
      <NavLink to="/homologacao">
        Homologação
        {homologacoesPendentes > 0 && (
          <span className="lateral__contagem">{homologacoesPendentes}</span>
        )}
      </NavLink>
      <NavLink to="/disputas">
        Disputas
        {disputasAbertas > 0 && (
          <span className="lateral__contagem lateral__contagem--alerta">{disputasAbertas}</span>
        )}
      </NavLink>
      <NavLink to="/precos">Tabela de preços</NavLink>
      <span className="lateral__inativo" title="Fora do recorte do protótipo">
        Frotas
      </span>
      <div className="espaco" />
      <div
        style={{ padding: 12, font: '400 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}
      >
        {OPERADOR}
      </div>
    </nav>
  );
}

function AvisoPainel() {
  const { aviso } = useOperacao();
  return aviso ? (
    <div className="aviso-painel" role="status">
      {aviso}
    </div>
  ) : null;
}

export function App() {
  return (
    <OperacaoProvider>
      <LimiteDeErro>
        <div className="painel">
          <Lateral />
          <Routes>
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/homologacao" element={<Homologacao />} />
            <Route path="/disputas" element={<Disputa />} />
            <Route path="/precos" element={<TabelaDePrecos />} />
            <Route path="*" element={<Navigate to="/monitor" replace />} />
          </Routes>
          <AvisoPainel />
        </div>
      </LimiteDeErro>
    </OperacaoProvider>
  );
}
