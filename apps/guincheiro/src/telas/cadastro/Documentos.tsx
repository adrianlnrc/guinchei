import { useState } from 'react';
import { ErroApi, TAMANHO_MAXIMO_DOCUMENTO_BYTES } from '@guinchei/api';
import { Corpo } from '@guinchei/ui';
import { useApi } from '../../api';
import { CabecalhoDaEtapa, Campo, RodapeDaEtapa, type PropsDaEtapa } from './campos';
import { erroDaValidadeDaApolice, validadeMinimaDaApolice } from './regras';

type Documento = 'alvaraArquivo' | 'apoliceArquivo';

const LIMITE_EM_MB = TAMANHO_MAXIMO_DOCUMENTO_BYTES / (1024 * 1024);

function CartaoDeDocumento({
  titulo,
  rotuloDoArquivo,
  enviado,
  ocupado,
  aoEscolher,
}: {
  titulo: string;
  rotuloDoArquivo: string;
  enviado: boolean;
  ocupado: boolean;
  aoEscolher: (arquivo: File) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        borderRadius: 14,
        background: 'var(--superficie-escura)',
        border: '1px solid var(--borda-escura)',
      }}
    >
      <div style={{ font: '600 16px var(--fonte-texto)' }}>{titulo}</div>
      <div
        style={{
          font: '500 14px var(--fonte-texto)',
          color: enviado ? 'var(--sucesso)' : 'var(--cinza-medio)',
        }}
      >
        {enviado ? 'Documento enviado' : 'Ainda não enviado'}
      </div>
      <input
        type="file"
        accept="application/pdf,image/*"
        aria-label={rotuloDoArquivo}
        disabled={ocupado}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) aoEscolher(arquivo);
          // Deixa escolher o mesmo arquivo de novo depois de um erro.
          e.target.value = '';
        }}
        style={{ font: '400 14px var(--fonte-texto)' }}
      />
    </div>
  );
}

/**
 * Etapa 3: alvará e apólice de responsabilidade civil por avaria, com a validade da apólice
 * (ADR-0007). Cada documento vai ao bucket assim que é escolhido e o caminho fica no
 * rascunho, para a pessoa poder sair e voltar.
 */
export function Documentos({ dados, continuar, salvar, voltar }: PropsDaEtapa) {
  const api = useApi();
  const [validade, setValidade] = useState(dados.apoliceValidade ?? '');
  const [enviados, setEnviados] = useState<Record<Documento, boolean>>({
    alvaraArquivo: Boolean(dados.alvaraArquivo),
    apoliceArquivo: Boolean(dados.apoliceArquivo),
  });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviarDocumento(campo: Documento, arquivo: File) {
    setOcupado(true);
    setErro(null);
    try {
      const caminho = await api.enviarDocumentoDaFrota(arquivo);
      const falha = await salvar({ [campo]: caminho });
      if (falha) setErro(falha);
      else setEnviados((atual) => ({ ...atual, [campo]: true }));
    } catch (e) {
      setErro(
        e instanceof ErroApi && (e.motivo === 'arquivo_invalido' || e.motivo === 'arquivo_grande')
          ? e.message
          : `Não foi possível enviar o documento. Use um PDF ou uma foto de até ${LIMITE_EM_MB} MB e tente de novo.`,
      );
    } finally {
      setOcupado(false);
    }
  }

  async function seguir() {
    const recusa = erroDaValidadeDaApolice(validade);
    if (recusa) {
      setErro(recusa);
      return;
    }
    setErro(null);
    setOcupado(true);
    const falha = await continuar({ apoliceValidade: validade });
    if (falha) {
      setErro(falha);
      setOcupado(false);
    }
  }

  return (
    <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
      <CabecalhoDaEtapa
        numero={3}
        titulo="Documentos da Frota"
        apoio={`PDF ou foto de até ${LIMITE_EM_MB} MB. A operação confere cada documento antes de ativar a sua Frota.`}
      />
      <CartaoDeDocumento
        titulo="Alvará de funcionamento"
        rotuloDoArquivo="Alvará (PDF ou foto)"
        enviado={enviados.alvaraArquivo}
        ocupado={ocupado}
        aoEscolher={(arquivo) => enviarDocumento('alvaraArquivo', arquivo)}
      />
      <CartaoDeDocumento
        titulo="Apólice de responsabilidade civil por avaria"
        rotuloDoArquivo="Apólice de responsabilidade civil (PDF ou foto)"
        enviado={enviados.apoliceArquivo}
        ocupado={ocupado}
        aoEscolher={(arquivo) => enviarDocumento('apoliceArquivo', arquivo)}
      />
      <Campo
        rotulo="Validade da apólice"
        type="date"
        min={validadeMinimaDaApolice()}
        value={validade}
        onChange={(e) => {
          setValidade(e.target.value);
          setErro(null);
        }}
      />
      <RodapeDaEtapa
        erro={erro}
        desabilitado={!enviados.alvaraArquivo || !enviados.apoliceArquivo || !validade || ocupado}
        aoContinuar={seguir}
        aoVoltar={voltar}
      />
    </Corpo>
  );
}
