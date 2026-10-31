import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { validadeDosAntecedentes } from '@guinchei/documentos';
import { Corpo, Tela } from '@guinchei/ui';
import { useApi } from '../../api';
import { ROTA_DOCUMENTOS } from '../../rotas';
import { Campo } from '../cadastro/campos';
import { dataIso, formatarData } from '../cadastro/regras';
import {
  AvisoDeRecusa,
  CabecalhoDoDocumento,
  CampoDeArquivo,
  ExigeDocumentos,
  JaEnviado,
  RodapeDoDocumento,
  useMeusDocumentos,
} from './comum';
import { erroDaEmissao, mensagemDoEnvio, podeEnviar, situacaoDe } from './regras';

/** Etapa 3: certidão de antecedentes (PCDF e Polícia Federal), que vale 12 meses da emissão. */
export function EtapaAntecedentes() {
  return (
    <ExigeDocumentos>
      <Tela escura rotulo="Antecedentes">
        <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
          <Conteudo />
        </Corpo>
      </Tela>
    </ExigeDocumentos>
  );
}

function Conteudo() {
  const { documentos } = useMeusDocumentos();
  if (documentos === undefined) return <p className="apoio">Carregando…</p>;
  const item = documentos?.antecedentes ?? null;
  const situacao = situacaoDe(item);
  return (
    <>
      <CabecalhoDoDocumento
        numero={3}
        titulo="Certidão de antecedentes"
        apoio="Envie a certidão de antecedentes criminais da PCDF e da Polícia Federal. Se forem dois arquivos, junte em um só PDF. Ela vale 12 meses a partir da emissão."
      />
      {!podeEnviar(situacao) ? (
        <JaEnviado nome="Certidão de antecedentes" aprovado={situacao === 'aprovado'} />
      ) : (
        <>
          {item?.estado === 'recusado' && <AvisoDeRecusa motivo={item.motivo} />}
          {item?.estado === 'vencido' && (
            <p role="status" className="apoio">
              A certidão anterior venceu. Emita uma nova e envie abaixo.
            </p>
          )}
          <Formulario />
        </>
      )}
    </>
  );
}

function Formulario() {
  const api = useApi();
  const ir = useNavigate();
  const [emissao, setEmissao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviado = useRef<{ arquivo: File; caminho: string } | null>(null);

  // Enquanto a data é válida, mostra até quando a certidão vale.
  const validade = emissao && !erroDaEmissao(emissao) ? validadeDosAntecedentes(emissao) : null;

  async function enviar() {
    const recusa = erroDaEmissao(emissao) ?? (arquivo ? null : 'Anexe a certidão.');
    if (recusa || !arquivo) {
      setErro(recusa);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const caminho =
        enviado.current?.arquivo === arquivo
          ? enviado.current.caminho
          : await api.enviarArquivoDoGuincheiro(arquivo);
      enviado.current = { arquivo, caminho };
      await api.enviarAntecedentes({ emissao, arquivo: caminho });
      ir(ROTA_DOCUMENTOS, { replace: true, state: { enviado: 'antecedentes' } });
    } catch (e) {
      setErro(mensagemDoEnvio(e));
      setEnviando(false);
    }
  }

  return (
    <>
      <Campo
        rotulo="Data de emissão da certidão"
        type="date"
        max={dataIso(new Date())}
        value={emissao}
        onChange={(e) => {
          setEmissao(e.target.value);
          setErro(null);
        }}
      />
      {validade && (
        <p
          role="status"
          style={{ margin: 0, font: '500 15px var(--fonte-texto)', color: 'var(--sucesso)' }}
        >
          Vale 12 meses: até {formatarData(validade)}.
        </p>
      )}
      <CampoDeArquivo
        rotulo="Arquivo da certidão"
        texto={arquivo ? 'Trocar o arquivo da certidão' : 'Escolher o arquivo da certidão'}
        aceita="application/pdf,image/*"
        arquivo={arquivo}
        desabilitado={enviando}
        aoEscolher={(a) => {
          setArquivo(a);
          setErro(null);
        }}
      />
      <RodapeDoDocumento
        erro={erro}
        enviar="Enviar certidão"
        desabilitado={enviando}
        aoEnviar={() => void enviar()}
        aoVoltar={() => ir(ROTA_DOCUMENTOS)}
      />
    </>
  );
}
