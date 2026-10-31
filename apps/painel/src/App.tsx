import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { ErroApi, type ApiPainel } from '@guinchei/api';
import { LimiteDeErro } from '@guinchei/ui';
import { ApiContexto, useApi } from './api';
import { OperacaoProvider, useOperacao } from './operacao';
import { ExigeOperacao, SessaoProvider, useSessao } from './sessao';
import { Celular, Codigo } from './telas/Entrada';
import { Monitor } from './telas/Monitor';
import { Homologacao } from './telas/Homologacao';
import { Disputa } from './telas/Disputa';
import { TabelaDePrecos } from './telas/TabelaDePrecos';

function Lateral() {
  const { homologacoesEmAtencao, disputasAbertas, avisar } = useOperacao();
  const { operador, setOperador } = useSessao();
  const api = useApi();
  const navigate = useNavigate();

  async function sair() {
    try {
      await api.sair();
    } catch (e) {
      avisar(e instanceof ErroApi ? e.message : 'Não foi possível sair');
      return;
    }
    setOperador(null);
    navigate('/entrar', { replace: true });
  }
  return (
    <nav className="lateral" aria-label="Painel de operação">
      <div className="lateral__marca">
        guinchei <small>operação</small>
      </div>
      <NavLink to="/monitor">Monitor de Corridas</NavLink>
      <NavLink to="/homologacao">
        Homologação
        {homologacoesEmAtencao > 0 && (
          <span
            className="lateral__contagem"
            title="Frotas com item pendente mais Frotas com documento vencendo ou vencido"
          >
            {homologacoesEmAtencao}
          </span>
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
        {operador?.nome}
      </div>
      <button type="button" className="lateral__sair" onClick={() => void sair()}>
        Sair
      </button>
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

function PainelLogado() {
  return (
    <OperacaoProvider>
      <LimiteDeErro>
        <div className="painel">
          <Lateral />
          <Outlet />
          <AvisoPainel />
        </div>
      </LimiteDeErro>
    </OperacaoProvider>
  );
}

export function App({ api }: { api: ApiPainel }) {
  return (
    <ApiContexto.Provider value={api}>
      <SessaoProvider>
        <Routes>
          <Route path="/entrar" element={<Celular />} />
          <Route path="/codigo" element={<Codigo />} />
          <Route element={<ExigeOperacao />}>
            <Route element={<PainelLogado />}>
              <Route path="/monitor" element={<Monitor />} />
              <Route path="/homologacao" element={<Homologacao />} />
              <Route path="/disputas" element={<Disputa />} />
              <Route path="/precos" element={<TabelaDePrecos />} />
              <Route path="*" element={<Navigate to="/monitor" replace />} />
            </Route>
          </Route>
        </Routes>
      </SessaoProvider>
    </ApiContexto.Provider>
  );
}
