import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Corpo, Tela } from '@guinchei/ui';
import { useApi } from '../../api';
import { ROTA_DOCUMENTOS } from '../../rotas';
import {
  AvisoDeRecusa,
  CabecalhoDoDocumento,
  CampoDeArquivo,
  ExigeDocumentos,
  JaEnviado,
  RodapeDoDocumento,
  useMeusDocumentos,
} from './comum';
import { mensagemDoEnvio, podeEnviar, situacaoDe } from './regras';

/** Etapa 4: selfie tirada na hora, com a câmera do aparelho (sem escolher da galeria no celular). */
export function EtapaSelfie() {
  return (
    <ExigeDocumentos>
      <Tela escura rotulo="Selfie">
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
  const item = documentos?.selfie ?? null;
  const situacao = situacaoDe(item);
  return (
    <>
      <CabecalhoDoDocumento
        numero={4}
        titulo="Sua selfie"
        apoio="Tire uma foto sua, de frente, com o rosto inteiro visível e boa luz. Sem óculos escuros, boné ou máscara. A operação compara com a foto da CNH."
      />
      {!podeEnviar(situacao) ? (
        <JaEnviado nome="Selfie" aprovado={situacao === 'aprovado'} />
      ) : (
        <>
          {item?.estado === 'recusado' && <AvisoDeRecusa motivo={item.motivo} />}
          <Formulario />
        </>
      )}
    </>
  );
}

function Formulario() {
  const api = useApi();
  const ir = useNavigate();
  const [foto, setFoto] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviado = useRef<{ arquivo: File; caminho: string } | null>(null);

  // Prévia da foto tirada; liberada ao trocar de foto e ao sair da tela.
  const previa = useMemo(
    () => (foto && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(foto) : null),
    [foto],
  );
  useEffect(
    () => () => {
      if (previa) URL.revokeObjectURL(previa);
    },
    [previa],
  );

  async function enviar() {
    if (!foto) {
      setErro('Tire a selfie antes de enviar.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const caminho =
        enviado.current?.arquivo === foto
          ? enviado.current.caminho
          : await api.enviarArquivoDoGuincheiro(foto);
      enviado.current = { arquivo: foto, caminho };
      await api.enviarSelfie(caminho);
      ir(ROTA_DOCUMENTOS, { replace: true, state: { enviado: 'selfie' } });
    } catch (e) {
      setErro(mensagemDoEnvio(e));
      setEnviando(false);
    }
  }

  return (
    <>
      {previa && (
        <img
          src={previa}
          alt="Prévia da selfie"
          style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 14 }}
        />
      )}
      <CampoDeArquivo
        rotulo="Foto da selfie"
        texto={foto ? 'Tirar outra selfie' : 'Tirar a selfie'}
        aceita="image/*"
        camera="user"
        arquivo={foto}
        desabilitado={enviando}
        aoEscolher={(a) => {
          setFoto(a);
          setErro(null);
        }}
      />
      <RodapeDoDocumento
        erro={erro}
        enviar="Enviar selfie"
        desabilitado={enviando}
        aoEnviar={() => void enviar()}
        aoVoltar={() => ir(ROTA_DOCUMENTOS)}
      />
    </>
  );
}
