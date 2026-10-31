import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { MeusDocumentos } from '@guinchei/api';
import { Botao, Corpo, Link, Progresso, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../../api';
import { MensagemDeErro } from '../../MensagemDeErro';
import { usePlantao } from '../../plantao';
import { ROTA_DADOS_PESSOAIS, ROTA_DOCUMENTOS } from '../../rotas';
import { AVISO_NAO_E_GUINCHEIRO, useSessao } from '../../sessao';
import { LIMITE_EM_MB } from './regras';

/** Dados pessoais, CNH, antecedentes e selfie. */
export const TOTAL_DE_ETAPAS = 4;

/**
 * Telas de documentos: só o Guincheiro. Quem não tem sessão ou conta vai à entrada ou ao
 * cadastro; o convidado, aos dados pessoais; o representante de Frota autônoma abre a etapa
 * (e ganha a linha de Guincheiro); o de empresa volta à própria Frota, onde convida Guincheiros.
 */
export function ExigeDocumentos({ children }: { children: ReactNode }) {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_guincheiro') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_GUINCHEIRO }} />;
  }
  if (estado === 'convidado') return <Navigate to={ROTA_DADOS_PESSOAIS} replace />;
  if (estado === 'sem_perfil') return <Navigate to="/cadastro" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  if (estado === 'representante') return <AbrirEtapaDoAutonomo />;
  return children;
}

/**
 * O autônomo não passa por convite: ao começar esta etapa, o servidor cria a linha de
 * Guincheiro dele na própria Frota (indisponível, fora do Match até a homologação).
 */
function AbrirEtapaDoAutonomo() {
  const api = useApi();
  const ir = useNavigate();
  const { setGuincheiro } = usePlantao();
  const [destino, setDestino] = useState<'/cadastro' | '/frota' | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vigente = true;
    (async () => {
      const frota = await api.buscarMinhaFrota();
      if (!vigente) return;
      if (!frota) return setDestino('/cadastro');
      if (frota.tipo !== 'autonomo') return setDestino('/frota');
      await api.criarMeuGuincheiro();
      const meu = await api.buscarMeuGuincheiro();
      if (!vigente) return;
      if (meu) setGuincheiro(meu);
      else setFalhou(true);
    })().catch(() => {
      if (vigente) setFalhou(true);
    });
    return () => {
      vigente = false;
    };
  }, [api, setGuincheiro, tentativa]);

  if (destino) return <Navigate to={destino} replace />;
  if (!falhou) return <Tela rotulo="Carregando">{null}</Tela>;
  return (
    <Tela escura rotulo="Documentos">
      <Corpo style={{ padding: '28px 24px 32px', gap: 16 }}>
        <div className="marca">guinchei</div>
        <h1 className="titulo">Não foi possível abrir os documentos</h1>
        <p role="alert" className="apoio">
          Algo falhou do nosso lado. Tente de novo; se continuar, volte mais tarde.
        </p>
        <div className="espaco" />
        <Botao
          variante="claro"
          grande
          onClick={() => {
            setFalhou(false);
            setTentativa((n) => n + 1);
          }}
        >
          Tentar de novo
        </Botao>
        <Link centro onClick={() => ir('/frota')}>
          Voltar à minha Frota
        </Link>
      </Corpo>
    </Tela>
  );
}

/** Lê os documentos do Guincheiro logado; `undefined` enquanto lê, `null` se a leitura falhou. */
export function useMeusDocumentos() {
  const api = useApi();
  const [documentos, setDocumentos] = useState<MeusDocumentos | null | undefined>(undefined);

  const recarregar = useCallback(async () => {
    try {
      setDocumentos(await api.buscarMeusDocumentos());
    } catch {
      setDocumentos(null);
    }
  }, [api]);

  useEffect(() => {
    let vigente = true;
    api.buscarMeusDocumentos().then(
      (lidos) => vigente && setDocumentos(lidos),
      () => vigente && setDocumentos(null),
    );
    return () => {
      vigente = false;
    };
  }, [api]);

  return { documentos, recarregar };
}

/** Cabeçalho de uma etapa: progresso, "Etapa N de 4", título e uma frase de apoio. */
export function CabecalhoDoDocumento({
  numero,
  titulo,
  apoio,
}: {
  numero: 2 | 3 | 4;
  titulo: string;
  apoio: ReactNode;
}) {
  return (
    <>
      <div className="marca">guinchei</div>
      <Progresso total={TOTAL_DE_ETAPAS} feitos={numero} />
      <Rotulo
        style={{ color: 'var(--cinza-medio)' }}
      >{`Etapa ${numero} de ${TOTAL_DE_ETAPAS}`}</Rotulo>
      <h1 className="titulo" style={{ font: '700 28px/1.12 var(--fonte-titulo)' }}>
        {titulo}
      </h1>
      <p className="apoio" style={{ fontSize: 15 }}>
        {apoio}
      </p>
    </>
  );
}

/** Quando a operação recusou: o motivo, em destaque, antes do formulário de reenvio. */
export function AvisoDeRecusa({ motivo }: { motivo: string | null }) {
  return (
    <div
      role="status"
      style={{
        padding: 14,
        borderRadius: 14,
        background: 'var(--superficie-escura)',
        border: '1px solid var(--alerta)',
        display: 'grid',
        gap: 4,
        font: '400 15px/1.45 var(--fonte-texto)',
      }}
    >
      <strong style={{ color: 'var(--alerta-texto)' }}>A operação recusou este documento</strong>
      <span>{motivo ?? 'Sem motivo informado.'}</span>
      <span style={{ color: 'var(--cinza-medio)' }}>Corrija e envie de novo abaixo.</span>
    </div>
  );
}

/**
 * Escolha de arquivo com botão grande (o campo nativo some). Com `camera`, o celular abre a
 * câmera em vez da galeria; no computador cai no seletor de arquivos.
 */
export function CampoDeArquivo({
  rotulo,
  texto,
  aceita,
  camera,
  arquivo,
  desabilitado,
  aoEscolher,
}: {
  rotulo: string;
  texto: string;
  aceita: string;
  camera?: 'user' | 'environment';
  arquivo: File | null;
  desabilitado?: boolean;
  aoEscolher: (arquivo: File) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label className="botao botao--contorno-escuro botao--grande" style={{ cursor: 'pointer' }}>
        <input
          type="file"
          accept={aceita}
          capture={camera}
          aria-label={rotulo}
          disabled={desabilitado}
          onChange={(e) => {
            const escolhido = e.target.files?.[0];
            if (escolhido) aoEscolher(escolhido);
            // Deixa escolher o mesmo arquivo de novo depois de um erro.
            e.target.value = '';
          }}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
        />
        {texto}
      </label>
      <span
        style={{
          font: '400 14px var(--fonte-texto)',
          color: arquivo ? 'var(--sucesso)' : 'var(--cinza-medio)',
        }}
      >
        {arquivo
          ? `Arquivo escolhido: ${arquivo.name}`
          : `Nenhum arquivo escolhido. PDF ou foto de até ${LIMITE_EM_MB} MB.`}
      </span>
    </div>
  );
}

/** Rodapé das telas de documento: erro, botão de enviar e voltar ao resumo. */
export function RodapeDoDocumento({
  erro,
  enviar,
  desabilitado,
  aoEnviar,
  aoVoltar,
}: {
  erro: string | null;
  enviar: string;
  desabilitado: boolean;
  aoEnviar: () => void;
  aoVoltar: () => void;
}) {
  return (
    <>
      <MensagemDeErro>{erro}</MensagemDeErro>
      <div className="espaco" />
      <Botao variante="claro" grande disabled={desabilitado} onClick={aoEnviar}>
        {enviar}
      </Botao>
      <Link centro onClick={aoVoltar}>
        Voltar aos documentos
      </Link>
    </>
  );
}

/** Documento já enviado e em análise (ou aprovado): sem formulário, com a volta ao resumo. */
export function JaEnviado({ nome, aprovado }: { nome: string; aprovado: boolean }) {
  const ir = useNavigate();
  return (
    <>
      <p role="status" className="apoio">
        {aprovado
          ? `${nome}: aprovado pela operação. Não precisa enviar de novo.`
          : `${nome}: a operação está conferindo. Quando ela decidir, o resultado aparece nos seus documentos.`}
      </p>
      <div className="espaco" />
      <Botao variante="claro" grande onClick={() => ir(ROTA_DOCUMENTOS)}>
        Voltar aos documentos
      </Botao>
    </>
  );
}
