import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ItemHomologacao, MeusDocumentos } from '@guinchei/api';
import { Botao, Corpo, Link, Progresso, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../../api';
import {
  ROTA_DOCUMENTOS_ANTECEDENTES,
  ROTA_DOCUMENTOS_CNH,
  ROTA_DOCUMENTOS_SELFIE,
} from '../../rotas';
import { formatarData } from '../cadastro/regras';
import { ExigeDocumentos, TOTAL_DE_ETAPAS, useMeusDocumentos } from './comum';
import {
  NOME_DA_SITUACAO,
  NOME_DO_DOCUMENTO,
  podeEnviar,
  situacaoDe,
  type SituacaoDoDocumento,
  type TipoDeDocumento,
} from './regras';

const COR_DA_SITUACAO: Record<SituacaoDoDocumento, string> = {
  nao_enviado: 'var(--cinza-medio)',
  pendente: 'var(--cinza-claro)',
  aprovado: 'var(--sucesso)',
  recusado: 'var(--alerta-texto)',
  vencido: 'var(--alerta-texto)',
};

const ROTA_DO_DOCUMENTO: Record<TipoDeDocumento, string> = {
  cnh: ROTA_DOCUMENTOS_CNH,
  antecedentes: ROTA_DOCUMENTOS_ANTECEDENTES,
  selfie: ROTA_DOCUMENTOS_SELFIE,
};

const AVISO_DE_ENVIO: Record<TipoDeDocumento, string> = {
  cnh: 'CNH enviada. A operação vai conferir.',
  antecedentes: 'Certidão enviada. A operação vai conferir.',
  selfie: 'Selfie enviada. A operação vai conferir.',
};

/** Etapas 2 a 4 da homologação do Guincheiro: o resumo dos três documentos e o que fazer. */
export function Documentos() {
  return (
    <ExigeDocumentos>
      <Resumo />
    </ExigeDocumentos>
  );
}

/** O que a pessoa precisa saber agora, em uma frase, conforme o estado dos três documentos. */
export function resumoDosDocumentos(docs: MeusDocumentos): { titulo: string; texto: string } {
  const itens = [docs.cnh, docs.antecedentes, docs.selfie];
  const faltam = itens.filter((i) => i === null).length;
  const reenviar = itens.filter((i) => i && (i.estado === 'recusado' || i.estado === 'vencido'));
  if (itens.every((i) => i?.estado === 'aprovado')) {
    return {
      titulo: 'Documentos aprovados',
      texto:
        'A operação aprovou os seus três documentos. Você passa a receber chamados quando a sua Frota também estiver ativa.',
    };
  }
  if (reenviar.length > 0) {
    return {
      titulo: 'Há documento para reenviar',
      texto:
        'A operação recusou um documento, ou a validade dele passou. Veja o motivo abaixo e envie de novo.',
    };
  }
  if (faltam === 3) {
    return {
      titulo: 'Envie os seus documentos',
      texto:
        'Você ainda não enviou nenhum documento. Comece pela CNH. A operação confere cada um antes de liberar você para receber chamados.',
    };
  }
  if (faltam > 0) {
    return {
      titulo: 'Falta pouco',
      texto: `Faltam ${faltam} de 3 documentos. Você só recebe chamados depois que a operação aprovar todos.`,
    };
  }
  return {
    titulo: 'Aguardando homologação',
    texto:
      'A operação está conferindo os seus documentos. Você ainda não recebe chamados; assim que ela decidir, o resultado aparece aqui.',
  };
}

function Resumo() {
  const api = useApi();
  const ir = useNavigate();
  const { state } = useLocation() as { state: { enviado?: TipoDeDocumento } | null };
  const { documentos, recarregar } = useMeusDocumentos();
  const [temFrota, setTemFrota] = useState(false);

  // Só o representante tem Frota para ver (o autônomo); para os demais a leitura vem vazia.
  useEffect(() => {
    let vigente = true;
    api
      .buscarMinhaFrota()
      .then((f) => vigente && setTemFrota(f !== null))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [api]);

  if (documentos === undefined) return <Tela rotulo="Carregando">{null}</Tela>;

  const enviados = documentos
    ? [documentos.cnh, documentos.antecedentes, documentos.selfie].filter((i) => i !== null).length
    : 0;
  const resumo = documentos ? resumoDosDocumentos(documentos) : null;

  return (
    <Tela escura rotulo="Documentos">
      <Corpo style={{ padding: '28px 24px 32px', gap: 16 }}>
        <div className="marca">guinchei</div>
        <Progresso total={TOTAL_DE_ETAPAS} feitos={1 + enviados} />
        <Rotulo style={{ marginTop: 8, color: 'var(--cinza-medio)' }}>Seus documentos</Rotulo>
        {documentos && resumo ? (
          <>
            <h1 className="titulo" style={{ font: '700 28px/1.12 var(--fonte-titulo)' }}>
              {resumo.titulo}
            </h1>
            <p className="apoio" style={{ fontSize: 15 }}>
              {resumo.texto}
            </p>
            {state?.enviado && (
              <p
                role="status"
                style={{ margin: 0, font: '600 15px var(--fonte-texto)', color: 'var(--sucesso)' }}
              >
                {AVISO_DE_ENVIO[state.enviado]}
              </p>
            )}
            <ul
              aria-label="Documentos do Guincheiro"
              style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}
            >
              <CartaoDoDocumento
                tipo="cnh"
                item={documentos.cnh}
                detalhe={detalheDaCnh(documentos)}
              />
              <CartaoDoDocumento
                tipo="antecedentes"
                item={documentos.antecedentes}
                detalhe={detalheDosAntecedentes(documentos)}
              />
              <CartaoDoDocumento tipo="selfie" item={documentos.selfie} detalhe={null} />
            </ul>
          </>
        ) : (
          <>
            <h1 className="titulo">Não foi possível ler os documentos</h1>
            <p role="alert" className="apoio">
              Confira a conexão e tente de novo.
            </p>
          </>
        )}
        <div className="espaco" />
        <Botao variante="claro" grande onClick={() => ir('/')}>
          Voltar ao plantão
        </Botao>
        <Link centro onClick={() => void recarregar()}>
          Atualizar
        </Link>
        {temFrota && (
          <Link centro onClick={() => ir('/frota')}>
            Ver a minha Frota
          </Link>
        )}
      </Corpo>
    </Tela>
  );
}

function detalheDaCnh(docs: MeusDocumentos): string | null {
  const cnh = docs.cnh;
  if (!cnh) return null;
  if (cnh.dados) {
    return `Categoria ${cnh.dados.categoria} · validade ${formatarData(cnh.dados.validade)}`;
  }
  return cnh.validade ? `Validade ${formatarData(cnh.validade)}` : null;
}

function detalheDosAntecedentes(docs: MeusDocumentos): string | null {
  const a = docs.antecedentes;
  if (!a) return null;
  if (a.emissao && a.validade) {
    return `Emitida em ${formatarData(a.emissao)} · vale 12 meses, até ${formatarData(a.validade)}`;
  }
  return a.validade ? `Vale até ${formatarData(a.validade)}` : null;
}

function CartaoDoDocumento({
  tipo,
  item,
  detalhe,
}: {
  tipo: TipoDeDocumento;
  item: ItemHomologacao | null;
  detalhe: string | null;
}) {
  const ir = useNavigate();
  const situacao = situacaoDe(item);
  const nome = NOME_DO_DOCUMENTO[tipo];
  return (
    <li
      aria-label={nome}
      style={{
        padding: 16,
        borderRadius: 14,
        background: 'var(--superficie-escura)',
        border: '1px solid var(--borda-escura)',
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ font: '600 17px var(--fonte-texto)' }}>{nome}</span>
        <span style={{ font: '600 14px var(--fonte-texto)', color: COR_DA_SITUACAO[situacao] }}>
          {NOME_DA_SITUACAO[situacao]}
        </span>
      </div>
      {detalhe && (
        <span style={{ font: '400 14px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
          {detalhe}
        </span>
      )}
      {item?.estado === 'recusado' && (
        <span style={{ font: '400 15px/1.45 var(--fonte-texto)' }}>
          Motivo da recusa: {item.motivo ?? 'sem motivo informado'}
        </span>
      )}
      {item?.estado === 'vencido' && (
        <span style={{ font: '400 15px/1.45 var(--fonte-texto)' }}>
          A validade passou. Envie um documento novo.
        </span>
      )}
      {item?.estado === 'pendente' && (
        <span style={{ font: '400 14px/1.45 var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
          Aguardando a operação conferir.
        </span>
      )}
      {podeEnviar(situacao) && (
        <Botao
          variante="contorno-escuro"
          aria-label={`${item ? 'Reenviar' : 'Enviar'} ${nome}`}
          onClick={() => ir(ROTA_DO_DOCUMENTO[tipo])}
        >
          {item ? 'Reenviar' : 'Enviar'}
        </Botao>
      )}
    </li>
  );
}
