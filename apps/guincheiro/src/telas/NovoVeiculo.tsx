import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ErroApi,
  LIMITE_FOTOS_VEICULO,
  PBT_MAXIMO_KG,
  PBT_MINIMO_KG,
  TAMANHO_MAXIMO_DOCUMENTO_BYTES,
  type MotivoErroApi,
  type TipoVeiculoGuincho,
} from '@guinchei/api';
import { mascararPlaca, normalizarPlaca, normalizarRenavam } from '@guinchei/documentos';
import { Botao, Corpo, Link, Progresso, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { MensagemDeErro } from '../MensagemDeErro';
import { ExigeRepresentante } from '../sessao';
import { Campo } from './cadastro/campos';
import { erroDaPlaca, erroDoPbt, erroDoRenavam, NOME_DO_TIPO, TIPOS } from './veiculo/regras';

const LIMITE_EM_MB = TAMANHO_MAXIMO_DOCUMENTO_BYTES / (1024 * 1024);

/** Erros do servidor que pedem corrigir a etapa 1 (os dados do veículo). */
const ERROS_DA_ETAPA_DOS_DADOS: MotivoErroApi[] = [
  'placa_invalida',
  'renavam_invalido',
  'veiculo_dados_invalidos',
  'veiculo_duplicado',
];

const MENSAGEM_DO_SERVIDOR: MotivoErroApi[] = [
  ...ERROS_DA_ETAPA_DOS_DADOS,
  'sem_frota',
  'fotos_do_veiculo',
  'documento_ausente',
];

/**
 * Cadastro de veículo da Frota (ADR-0012), só para o representante: etapa 1 com placa, RENAVAM,
 * tipo e PBT; etapa 2 com o CRLV e as fotos. Cada arquivo vai ao bucket assim que é escolhido;
 * o cadastro só é gravado no fim, e o CRLV e as fotos viram itens da fila de homologação.
 */
export function NovoVeiculo() {
  return (
    <ExigeRepresentante>
      <Assistente />
    </ExigeRepresentante>
  );
}

function Assistente() {
  const api = useApi();
  const ir = useNavigate();
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [placa, setPlaca] = useState('');
  const [renavam, setRenavam] = useState('');
  const [tipo, setTipo] = useState<TipoVeiculoGuincho>('plataforma');
  const [pbt, setPbt] = useState('');
  const [crlv, setCrlv] = useState<string | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  if (pronto) return <Navigate to="/veiculos" replace />;

  function seguirParaOsArquivos() {
    const recusa = erroDaPlaca(placa) ?? erroDoRenavam(renavam) ?? erroDoPbt(pbt);
    setErro(recusa);
    if (!recusa) setEtapa(2);
  }

  async function enviarArquivo(arquivo: File, finalidade: 'crlv' | 'foto') {
    setOcupado(true);
    setErro(null);
    try {
      const caminho = await api.enviarArquivoDoVeiculo(arquivo, finalidade);
      if (finalidade === 'crlv') setCrlv(caminho);
      else setFotos((atuais) => [...atuais, caminho]);
    } catch (e) {
      setErro(
        e instanceof ErroApi && (e.motivo === 'arquivo_invalido' || e.motivo === 'arquivo_grande')
          ? e.message
          : `Não foi possível enviar o arquivo. Use ${
              finalidade === 'crlv' ? 'um PDF ou uma foto' : 'uma foto'
            } de até ${LIMITE_EM_MB} MB e tente de novo.`,
      );
    } finally {
      setOcupado(false);
    }
  }

  async function cadastrar() {
    if (!crlv || fotos.length === 0) return;
    setOcupado(true);
    setErro(null);
    try {
      await api.cadastrarVeiculo({
        placa: normalizarPlaca(placa),
        renavam: normalizarRenavam(renavam),
        tipo,
        pbtKg: Number(pbt),
        crlvArquivo: crlv,
        fotosArquivos: fotos,
      });
      setPronto(true);
    } catch (e) {
      const motivo = e instanceof ErroApi ? e.motivo : null;
      setErro(
        e instanceof ErroApi && motivo && MENSAGEM_DO_SERVIDOR.includes(motivo)
          ? e.message
          : 'Não foi possível cadastrar o veículo. Tente de novo.',
      );
      if (motivo && ERROS_DA_ETAPA_DOS_DADOS.includes(motivo)) setEtapa(1);
      setOcupado(false);
    }
  }

  return (
    <Tela escura rotulo={etapa === 1 ? 'Veículo: dados' : 'Veículo: documentos'}>
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Progresso total={2} feitos={etapa} />
        <Rotulo style={{ color: 'var(--cinza-medio)' }}>{`Etapa ${etapa} de 2`}</Rotulo>
        {etapa === 1 ? (
          <>
            <h1 className="titulo" style={{ font: '700 28px/1.12 var(--fonte-titulo)' }}>
              Dados do veículo
            </h1>
            <p className="apoio" style={{ fontSize: 15 }}>
              Placa, RENAVAM e PBT como constam no CRLV. O PBT define quem pode dirigir o veículo
              (categoria da CNH).
            </p>
            <Campo
              rotulo="Placa"
              value={mascararPlaca(placa)}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => {
                setPlaca(e.target.value);
                setErro(null);
              }}
            />
            <Campo
              rotulo="RENAVAM"
              inputMode="numeric"
              maxLength={11}
              value={renavam}
              onChange={(e) => {
                setRenavam(e.target.value.replace(/\D/g, ''));
                setErro(null);
              }}
            />
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                font: '600 14px var(--fonte-texto)',
                color: 'var(--cinza-medio)',
              }}
            >
              Tipo do guincho
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoVeiculoGuincho)}
                style={{
                  height: 56,
                  padding: '0 16px',
                  borderRadius: 14,
                  background: 'var(--superficie-escura)',
                  color: 'var(--off-white)',
                  border: '1px solid var(--borda-escura)',
                  font: '500 17px var(--fonte-texto)',
                }}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {NOME_DO_TIPO[t]}
                  </option>
                ))}
              </select>
            </label>
            <Campo
              rotulo="PBT em kg"
              inputMode="numeric"
              placeholder={`${PBT_MINIMO_KG} a ${PBT_MAXIMO_KG}`}
              value={pbt}
              onChange={(e) => {
                setPbt(e.target.value.replace(/\D/g, '').slice(0, 5));
                setErro(null);
              }}
            />
            <MensagemDeErro>{erro}</MensagemDeErro>
            <div className="espaco" />
            <Botao
              variante="claro"
              grande
              disabled={!placa || !renavam || !pbt}
              onClick={seguirParaOsArquivos}
            >
              Continuar
            </Botao>
            <Link centro onClick={() => ir('/veiculos')}>
              Voltar
            </Link>
          </>
        ) : (
          <>
            <h1 className="titulo" style={{ font: '700 28px/1.12 var(--fonte-titulo)' }}>
              CRLV e fotos
            </h1>
            <p className="apoio" style={{ fontSize: 15 }}>
              {`A operação confere o CRLV, inclusive o registro como reboque no DETRAN. PDF ou foto de até ${LIMITE_EM_MB} MB; as fotos do veículo, de 1 a ${LIMITE_FOTOS_VEICULO}.`}
            </p>
            <div className="cartao-arquivo" style={estiloCartao}>
              <div style={{ font: '600 16px var(--fonte-texto)' }}>CRLV do veículo</div>
              <div
                style={{
                  font: '500 14px var(--fonte-texto)',
                  color: crlv ? 'var(--sucesso)' : 'var(--cinza-medio)',
                }}
              >
                {crlv ? 'CRLV enviado' : 'CRLV ainda não enviado'}
              </div>
              <input
                type="file"
                accept="application/pdf,image/*"
                aria-label="CRLV (PDF ou foto)"
                disabled={ocupado}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) void enviarArquivo(arquivo, 'crlv');
                  e.target.value = '';
                }}
                style={{ font: '400 14px var(--fonte-texto)' }}
              />
            </div>
            <div className="cartao-arquivo" style={estiloCartao}>
              <div style={{ font: '600 16px var(--fonte-texto)' }}>Fotos do veículo</div>
              <div
                style={{
                  font: '500 14px var(--fonte-texto)',
                  color: fotos.length > 0 ? 'var(--sucesso)' : 'var(--cinza-medio)',
                }}
              >
                {fotos.length === 0
                  ? 'Nenhuma foto enviada'
                  : `${fotos.length} de ${LIMITE_FOTOS_VEICULO} ${fotos.length === 1 ? 'foto enviada' : 'fotos enviadas'}`}
              </div>
              <input
                type="file"
                accept="image/*"
                aria-label="Adicionar foto do veículo"
                disabled={ocupado || fotos.length >= LIMITE_FOTOS_VEICULO}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) void enviarArquivo(arquivo, 'foto');
                  e.target.value = '';
                }}
                style={{ font: '400 14px var(--fonte-texto)' }}
              />
            </div>
            <MensagemDeErro>{erro}</MensagemDeErro>
            <div className="espaco" />
            <Botao
              variante="claro"
              grande
              disabled={!crlv || fotos.length === 0 || ocupado}
              onClick={() => void cadastrar()}
            >
              Cadastrar veículo
            </Botao>
            <Link
              centro
              onClick={() => {
                setErro(null);
                setEtapa(1);
              }}
            >
              Voltar
            </Link>
          </>
        )}
      </Corpo>
    </Tela>
  );
}

const estiloCartao = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 16,
  borderRadius: 14,
  background: 'var(--superficie-escura)',
  border: '1px solid var(--borda-escura)',
} as const;
