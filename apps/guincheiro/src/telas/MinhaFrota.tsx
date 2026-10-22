import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ErroApi,
  TAMANHO_MAXIMO_DOCUMENTO_BYTES,
  type ItemHomologacao,
  type MinhaFrota as Frota,
} from '@guinchei/api';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { MensagemDeErro } from '../MensagemDeErro';
import { AVISO_NAO_E_GUINCHEIRO, useSessao } from '../sessao';
import { Campo } from './cadastro/campos';
import { erroDaValidadeDaApolice, formatarData, validadeMinimaDaApolice } from './cadastro/regras';

const LIMITE_EM_MB = TAMANHO_MAXIMO_DOCUMENTO_BYTES / (1024 * 1024);

/** O representante reenvia o que a operação recusou ou o que venceu. */
const PODE_REENVIAR: ReadonlySet<ItemHomologacao['estado']> = new Set(['recusado', 'vencido']);

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
  if (estado === 'sem_perfil') return <Navigate to="/cadastro" replace />;
  if (estado === 'pronto') return <Navigate to="/" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  return <Andamento />;
}

/**
 * Reenvio de um item da Frota recusado ou vencido: novo arquivo (e, na apólice, a nova
 * validade). Ao reenviar, o item volta a `pendente` e à fila do Painel.
 */
function Reenvio({ item, aoReenviar }: { item: ItemHomologacao; aoReenviar: () => void }) {
  const api = useApi();
  const nome = NOME_DO_ITEM[item.tipo];
  const apolice = item.tipo === 'apolice_rc';
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [validade, setValidade] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function reenviar() {
    if (!arquivo) return;
    if (apolice) {
      const recusa = erroDaValidadeDaApolice(validade);
      if (recusa) {
        setErro(recusa);
        return;
      }
    }
    setErro(null);
    setEnviando(true);
    try {
      await api.reenviarItemDaFrota(item.id, arquivo, apolice ? validade : undefined);
      aoReenviar();
    } catch (e) {
      setErro(
        e instanceof ErroApi &&
          [
            'arquivo_invalido',
            'arquivo_grande',
            'documento_vencido',
            'transicao_invalida',
          ].includes(e.motivo)
          ? e.message
          : `Não foi possível reenviar. Use um PDF ou uma foto de até ${LIMITE_EM_MB} MB e tente de novo.`,
      );
      setEnviando(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
      <input
        type="file"
        accept="application/pdf,image/*"
        aria-label={`Novo arquivo: ${nome}`}
        disabled={enviando}
        onChange={(e) => {
          setArquivo(e.target.files?.[0] ?? null);
          setErro(null);
        }}
        style={{ font: '400 14px var(--fonte-texto)' }}
      />
      {apolice && (
        <Campo
          rotulo="Nova validade da apólice"
          type="date"
          min={validadeMinimaDaApolice()}
          value={validade}
          onChange={(e) => {
            setValidade(e.target.value);
            setErro(null);
          }}
        />
      )}
      <MensagemDeErro>{erro}</MensagemDeErro>
      <Botao
        variante="claro"
        disabled={!arquivo || (apolice && !validade) || enviando}
        onClick={reenviar}
        aria-label={`Reenviar ${nome}`}
      >
        Reenviar documento
      </Botao>
    </div>
  );
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

  async function recarregar() {
    try {
      setFrota(await api.buscarMinhaFrota());
    } catch {
      setErro(true);
    }
  }

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
            <p className="apoio" style={{ fontSize: 14 }}>
              {frota.tipo === 'empresa' ? 'Frota empresa' : 'Frota autônoma'}
            </p>
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
                  {item.alvo === 'frota' && PODE_REENVIAR.has(item.estado) && (
                    <Reenvio item={item} aoReenviar={recarregar} />
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
        <Link centro onClick={() => globalThis.location.reload()}>
          Atualizar
        </Link>
      </Corpo>
    </Tela>
  );
}
