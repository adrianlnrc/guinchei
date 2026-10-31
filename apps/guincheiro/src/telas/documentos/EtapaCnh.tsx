import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mascararCnh } from '@guinchei/documentos';
import { Corpo, Tela } from '@guinchei/ui';
import { useApi } from '../../api';
import { ROTA_DOCUMENTOS } from '../../rotas';
import { Campo, CampoDeSelecao } from '../cadastro/campos';
import { dataIso } from '../cadastro/regras';
import {
  AvisoDeRecusa,
  CabecalhoDoDocumento,
  CampoDeArquivo,
  ExigeDocumentos,
  JaEnviado,
  RodapeDoDocumento,
  useMeusDocumentos,
} from './comum';
import {
  CATEGORIAS_DO_FORMULARIO,
  erroDaCnh,
  mensagemDoEnvio,
  podeEnviar,
  situacaoDe,
} from './regras';

/** Etapa 2: CNH definitiva com número, categoria, validade, observação EAR e foto. */
export function EtapaCnh() {
  return (
    <ExigeDocumentos>
      <Tela escura rotulo="CNH">
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
  const item = documentos?.cnh ?? null;
  const situacao = situacaoDe(item);
  return (
    <>
      <CabecalhoDoDocumento
        numero={2}
        titulo="Sua CNH"
        apoio="Use a CNH definitiva, dentro da validade e com a observação EAR. A categoria define quais guinchos você pode conduzir."
      />
      {!podeEnviar(situacao) ? (
        <JaEnviado nome="CNH" aprovado={situacao === 'aprovado'} />
      ) : (
        <>
          {item?.estado === 'recusado' && <AvisoDeRecusa motivo={item.motivo} />}
          <Formulario inicial={documentos?.cnh?.dados ?? null} />
        </>
      )}
    </>
  );
}

function Formulario({
  inicial,
}: {
  inicial: { numero: string; categoria: string; validade: string } | null;
}) {
  const api = useApi();
  const ir = useNavigate();
  const [numero, setNumero] = useState(inicial?.numero ?? '');
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '');
  const [validade, setValidade] = useState('');
  const [ear, setEar] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // O arquivo que já chegou ao bucket, para a nova tentativa não enviá-lo de novo.
  const enviado = useRef<{ arquivo: File; caminho: string } | null>(null);

  async function enviar() {
    const recusa = erroDaCnh({ numero, categoria, validade, ear, arquivo });
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
      await api.enviarCnh({ numero, categoria, validade, ear, arquivo: caminho });
      ir(ROTA_DOCUMENTOS, { replace: true, state: { enviado: 'cnh' } });
    } catch (e) {
      setErro(mensagemDoEnvio(e));
      setEnviando(false);
    }
  }

  return (
    <>
      <Campo
        rotulo="Número da CNH"
        inputMode="numeric"
        autoComplete="off"
        placeholder="11 dígitos"
        value={numero}
        onChange={(e) => {
          setNumero(mascararCnh(e.target.value));
          setErro(null);
        }}
      />
      <CampoDeSelecao
        rotulo="Categoria"
        value={categoria}
        onChange={(e) => {
          setCategoria(e.target.value);
          setErro(null);
        }}
      >
        <option value="">Escolha a categoria</option>
        {CATEGORIAS_DO_FORMULARIO.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </CampoDeSelecao>
      <Campo
        rotulo="Validade da CNH"
        type="date"
        min={dataIso(new Date())}
        value={validade}
        onChange={(e) => {
          setValidade(e.target.value);
          setErro(null);
        }}
      />
      <label
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          font: '400 15px/1.45 var(--fonte-texto)',
        }}
      >
        <input
          type="checkbox"
          checked={ear}
          onChange={(e) => {
            setEar(e.target.checked);
            setErro(null);
          }}
          style={{ width: 22, height: 22, marginTop: 1, accentColor: 'var(--ambar)' }}
        />
        <span>
          A minha CNH tem a observação EAR (exerce atividade remunerada).
          <br />
          <span style={{ color: 'var(--cinza-medio)', fontSize: 14 }}>
            Ela aparece no campo de observações da CNH.
          </span>
        </span>
      </label>
      <CampoDeArquivo
        rotulo="Foto da CNH"
        texto={arquivo ? 'Trocar a foto da CNH' : 'Escolher a foto da CNH'}
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
        enviar="Enviar CNH"
        desabilitado={enviando}
        aoEnviar={() => void enviar()}
        aoVoltar={() => ir(ROTA_DOCUMENTOS)}
      />
    </>
  );
}
