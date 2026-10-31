import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { ItemHomologacao, MinhaFrota as Frota } from '@guinchei/api';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { ROTA_CONVITES, ROTA_DADOS_PESSOAIS, ROTA_DOCUMENTOS, ROTA_VINCULOS } from '../rotas';
import { AVISO_NAO_E_GUINCHEIRO, useSessao } from '../sessao';
import { formatarData } from './cadastro/regras';
import { AvisosDeVencimento } from './vencimentos/AvisosDeVencimento';

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

/**
 * Telas da Frota: quem não tem sessão ou conta vai à entrada ou ao cadastro; o convidado, aos
 * dados pessoais. O representante e o autônomo (que também é Guincheiro) seguem, e `children`
 * diz se a pessoa também é Guincheiro.
 */
export function ExigeSessaoDeFrota({
  children,
}: {
  children: (comoGuincheiro: boolean) => ReactNode;
}) {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_guincheiro') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_GUINCHEIRO }} />;
  }
  if (estado === 'convidado') return <Navigate to={ROTA_DADOS_PESSOAIS} replace />;
  if (estado === 'sem_perfil') return <Navigate to="/cadastro" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  // O autônomo vira Guincheiro da própria Frota (#47) e continua vendo a Frota dele aqui.
  return children(estado === 'pronto');
}

/**
 * O que falta para a operação poder ativar a Frota: documentos da Frota, um veículo, um
 * Guincheiro e o vínculo entre os dois (issue #50). Lista vazia = tudo aprovado, só falta a
 * operação ativar.
 */
function PendenciasDeAtivacao({ pendencias }: { pendencias: Frota['pendenciasDeAtivacao'] }) {
  if (pendencias.length === 0) {
    return (
      <p
        role="status"
        style={{ margin: 0, font: '600 15px var(--fonte-texto)', color: 'var(--sucesso)' }}
      >
        Tudo aprovado. Falta só a operação ativar a Frota.
      </p>
    );
  }
  return (
    <section
      aria-label="O que falta para ativar a Frota"
      style={{
        padding: 14,
        borderRadius: 14,
        background: 'var(--superficie-escura)',
        border: '1px solid var(--ambar)',
        display: 'grid',
        gap: 8,
      }}
    >
      <strong style={{ font: '600 16px var(--fonte-texto)' }}>
        {pendencias.length === 1
          ? 'Falta 1 item para ativar a Frota'
          : `Faltam ${pendencias.length} itens para ativar a Frota`}
      </strong>
      <ul
        style={{
          margin: 0,
          paddingLeft: 20,
          display: 'grid',
          gap: 4,
          font: '400 14px/1.5 var(--fonte-texto)',
        }}
      >
        {pendencias.map((p) => (
          <li key={p.descricao}>{p.descricao}</li>
        ))}
      </ul>
    </section>
  );
}

/** A Frota de quem a cadastrou: o andamento da homologação, item por item. */
export function MinhaFrota() {
  return (
    <ExigeSessaoDeFrota>
      {(comoGuincheiro) => <Andamento comoGuincheiro={comoGuincheiro} />}
    </ExigeSessaoDeFrota>
  );
}

function Andamento({ comoGuincheiro }: { comoGuincheiro: boolean }) {
  const api = useApi();
  const ir = useNavigate();
  const { state } = useLocation() as { state: { apoliceReenviada?: boolean } | null };
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

  // Guincheiro de empresa não tem Frota para gerir: volta ao plantão.
  if (frota === null) return <Navigate to={comoGuincheiro ? '/' : '/cadastro'} replace />;
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
            {!frota.ativa && <PendenciasDeAtivacao pendencias={frota.pendenciasDeAtivacao} />}
            {state?.apoliceReenviada && (
              <p
                role="status"
                style={{ margin: 0, font: '600 15px var(--fonte-texto)', color: 'var(--sucesso)' }}
              >
                Apólice enviada. A operação vai conferir.
              </p>
            )}
            <AvisosDeVencimento />
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
        {frota && (
          <Botao variante="claro" grande onClick={() => ir('/veiculos')}>
            Meus veículos
          </Botao>
        )}
        <Botao
          variante={frota ? 'contorno-escuro' : 'claro'}
          grande
          disabled={saindo}
          onClick={sair}
        >
          Sair
        </Botao>
        {frota?.tipo === 'autonomo' && (
          <Link centro onClick={() => ir(ROTA_DOCUMENTOS)}>
            Meus documentos de Guincheiro
          </Link>
        )}
        {frota && (
          <Link centro onClick={() => ir(ROTA_VINCULOS)}>
            Vincular Guincheiros a veículos
          </Link>
        )}
        {frota && (
          <Link centro onClick={() => ir(ROTA_CONVITES)}>
            Convidar Guincheiros
          </Link>
        )}
        {comoGuincheiro && (
          <Link centro onClick={() => ir('/')}>
            Voltar ao plantão
          </Link>
        )}
        <Link centro onClick={() => globalThis.location.reload()}>
          Atualizar
        </Link>
      </Corpo>
    </Tela>
  );
}
