import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { ItemHomologacao, MinhaFrota as Frota } from '@guinchei/api';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { ROTA_CONVITES, ROTA_DADOS_PESSOAIS } from '../rotas';
import { AVISO_NAO_E_GUINCHEIRO, useSessao } from '../sessao';
import { formatarData } from './cadastro/regras';

const NOME_DO_ITEM: Record<ItemHomologacao['tipo'], string> = {
  alvara: 'Alvará de funcionamento',
  apolice_rc: 'Apólice de responsabilidade civil',
  crlv: 'CRLV do veículo',
  foto_veiculo: 'Foto do veículo',
  cnh: 'CNH',
  antecedentes: 'Certidão de antecedentes',
  selfie: 'Selfie',
};

const NOME_DO_ESTADO: Record<ItemHomologacao['estado'], string> = {
  pendente: 'Em análise',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  vencido: 'Vencido',
};

const COR_DO_ESTADO: Record<ItemHomologacao['estado'], string> = {
  pendente: 'var(--cinza-claro)',
  aprovado: 'var(--sucesso)',
  recusado: 'var(--alerta)',
  vencido: 'var(--alerta)',
};

/** A Frota de quem a cadastrou: o andamento da homologação, item por item. */
export function MinhaFrota() {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_guincheiro') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_GUINCHEIRO }} />;
  }
  if (estado === 'convidado') return <Navigate to={ROTA_DADOS_PESSOAIS} replace />;
  if (estado === 'sem_perfil') return <Navigate to="/cadastro" replace />;
  if (estado === 'pronto') return <Navigate to="/" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  return <Andamento />;
}

function Andamento() {
  const api = useApi();
  const ir = useNavigate();
  // undefined: lendo; null: ainda não enviou o cadastro.
  const [frota, setFrota] = useState<Frota | null | undefined>(undefined);
  const [erro, setErro] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let vigente = true;
    api
      .buscarMinhaFrota()
      .then((f) => vigente && setFrota(f))
      .catch(() => vigente && setErro(true));
    return () => {
      vigente = false;
    };
  }, [api]);

  async function sair() {
    setSaindo(true);
    try {
      await api.sair();
      ir('/entrar', { replace: true });
    } finally {
      setSaindo(false);
    }
  }

  if (frota === null) return <Navigate to="/cadastro" replace />;
  if (frota === undefined && !erro) return <Tela rotulo="Carregando">{null}</Tela>;

  return (
    <Tela escura rotulo="Minha Frota">
      <Corpo style={{ padding: '28px 24px 32px', gap: 16 }}>
        <div className="marca">guinchei</div>
        <Rotulo style={{ marginTop: 16, color: 'var(--cinza-medio)' }}>Minha Frota</Rotulo>
        {frota ? (
          <>
            <h1 className="titulo">{frota.nome}</h1>
            <p className="apoio">
              {frota.ativa
                ? 'Frota ativa.'
                : 'Em análise pela operação. Você começa a receber chamados quando a Frota for ativada e os documentos de Guincheiro forem aprovados.'}
            </p>
            <ul
              style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}
              aria-label="Documentos da Frota"
            >
              {frota.itens.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    background: 'var(--superficie-escura)',
                    border: '1px solid var(--borda-escura)',
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <div style={{ font: '600 16px var(--fonte-texto)' }}>
                    {NOME_DO_ITEM[item.tipo]}
                  </div>
                  <div
                    style={{
                      font: '600 14px var(--fonte-texto)',
                      color: COR_DO_ESTADO[item.estado],
                    }}
                  >
                    {NOME_DO_ESTADO[item.estado]}
                  </div>
                  {item.validade && (
                    <div
                      style={{ font: '400 14px var(--fonte-texto)', color: 'var(--cinza-medio)' }}
                    >
                      Validade: {formatarData(item.validade)}
                    </div>
                  )}
                  {item.motivo && (
                    <div style={{ font: '400 14px var(--fonte-texto)' }}>{item.motivo}</div>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p role="alert" className="apoio">
            Não foi possível ler a sua Frota. Tente de novo.
          </p>
        )}
        <div className="espaco" />
        <Botao variante="claro" grande disabled={saindo} onClick={sair}>
          Sair
        </Botao>
        {frota && (
          <Link centro onClick={() => ir(ROTA_CONVITES)}>
            Convidar Guincheiros
          </Link>
        )}
        <Link centro onClick={() => globalThis.location.reload()}>
          Atualizar
        </Link>
      </Corpo>
    </Tela>
  );
}
