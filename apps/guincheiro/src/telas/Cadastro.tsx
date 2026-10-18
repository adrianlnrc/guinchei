import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ErroApi,
  type DadosCadastroFrota,
  type EtapaCadastroFrota,
  type RascunhoFrota,
} from '@guinchei/api';
import { Botao, Corpo, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { AVISO_NAO_E_GUINCHEIRO, useSessao } from '../sessao';
import { Dados } from './cadastro/Dados';
import { Documentos } from './cadastro/Documentos';
import { Endereco } from './cadastro/Endereco';
import { Pix } from './cadastro/Pix';
import { Termos } from './cadastro/Termos';
import type { PropsDaEtapa } from './cadastro/campos';

const ROTULO_DA_ETAPA: Record<EtapaCadastroFrota, string> = {
  1: 'Cadastro: dados',
  2: 'Cadastro: endereço',
  3: 'Cadastro: documentos',
  4: 'Cadastro: Pix',
  5: 'Cadastro: termos',
};

const FALHA_AO_SALVAR = 'Não foi possível salvar o cadastro. Tente de novo.';

/** A mensagem que a pessoa lê quando o servidor recusa o envio do cadastro. */
function mensagemDoEnvio(e: unknown): string {
  if (!(e instanceof ErroApi)) return 'Não foi possível enviar o cadastro. Tente de novo.';
  switch (e.motivo) {
    case 'cpf_ja_cadastrado':
      return 'Este CPF já está cadastrado em outra conta.';
    case 'documento_ja_cadastrado':
      return 'Este documento já tem uma Frota cadastrada.';
    case 'documento_invalido':
    case 'cpf_representante_invalido':
    case 'dados_incompletos':
    case 'apolice_curta':
    case 'termos_nao_aceitos':
    case 'documento_ausente':
    case 'cadastro_indisponivel':
      return e.message;
    default:
      return 'Não foi possível enviar o cadastro. Tente de novo.';
  }
}

/**
 * Cadastro da Frota autônoma (ADR-0012): para quem entrou por telefone e ainda não é
 * prestador. Quem já enviou o cadastro vai para a própria Frota.
 */
export function Cadastro() {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_guincheiro') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_GUINCHEIRO }} />;
  }
  if (estado === 'pronto') return <Navigate to="/" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  return <Assistente />;
}

interface Carga {
  rascunho: RascunhoFrota | null;
  telefone: string | null;
}

function Assistente() {
  const api = useApi();
  const ir = useNavigate();
  // undefined: lendo; 'enviada': a Frota já existe.
  const [carga, setCarga] = useState<Carga | 'enviada' | undefined>(undefined);
  const [falhou, setFalhou] = useState(false);
  const [etapa, setEtapa] = useState<EtapaCadastroFrota | null>(null);
  const [dados, setDados] = useState<DadosCadastroFrota>({});
  // O que já foi gravado, para cada gravação partir do dado mais novo mesmo em chamadas seguidas.
  const gravado = useRef<DadosCadastroFrota>({});

  useEffect(() => {
    let vigente = true;
    Promise.all([api.buscarMinhaFrota(), api.buscarRascunhoFrota(), api.telefoneDaSessao()])
      .then(([frota, rascunho, telefone]) => {
        if (vigente) setCarga(frota ? 'enviada' : { rascunho, telefone });
      })
      .catch(() => vigente && setFalhou(true));
    return () => {
      vigente = false;
    };
  }, [api]);

  const gravar = useCallback(
    async (parcial: DadosCadastroFrota, naEtapa: EtapaCadastroFrota): Promise<string | null> => {
      const novos = { ...gravado.current, ...parcial };
      try {
        await api.salvarRascunhoFrota({ etapa: naEtapa, dados: novos });
      } catch (e) {
        return e instanceof ErroApi && e.motivo === 'cadastro_indisponivel'
          ? e.message
          : FALHA_AO_SALVAR;
      }
      gravado.current = novos;
      setDados(novos);
      return null;
    },
    [api],
  );

  if (falhou) {
    return (
      <Tela escura rotulo="Cadastro de Frota">
        <Corpo style={{ padding: '28px 24px 32px', gap: 16 }}>
          <h1 className="titulo">Não foi possível abrir o cadastro</h1>
          <p className="apoio">Confira a conexão e tente de novo.</p>
          <div className="espaco" />
          <Botao variante="claro" grande onClick={() => globalThis.location.reload()}>
            Tentar de novo
          </Botao>
        </Corpo>
      </Tela>
    );
  }
  if (carga === undefined) return <Tela rotulo="Carregando">{null}</Tela>;
  if (carga === 'enviada') return <Navigate to="/frota" replace />;

  const { rascunho, telefone } = carga;
  const comecar = () => {
    gravado.current = rascunho?.dados ?? {};
    setDados(gravado.current);
    setEtapa(rascunho?.etapa ?? 1);
  };

  if (etapa === null) {
    const retomar = rascunho !== null;
    return (
      <Tela escura rotulo="Cadastro de Frota">
        <Corpo style={{ padding: '28px 24px 32px', gap: 18 }}>
          <div className="marca">guinchei</div>
          <Rotulo style={{ marginTop: 24, color: 'var(--cinza-medio)' }}>Prestador</Rotulo>
          <h1 className="titulo">Cadastre a sua Frota</h1>
          <p className="apoio">
            Este número ainda não está em nenhuma Frota. Se você atende sozinho, com CPF ou MEI,
            cadastre a sua em cinco etapas curtas: dados, endereço, documentos, Pix e termos. Você
            pode parar e continuar depois.
          </p>
          <div className="espaco" />
          <Botao variante="claro" grande onClick={comecar}>
            {retomar ? 'Continuar meu cadastro' : 'Cadastrar minha Frota'}
          </Botao>
        </Corpo>
      </Tela>
    );
  }

  const propsComuns: PropsDaEtapa = {
    dados,
    telefone,
    continuar: async (parcial) => {
      const proxima = Math.min(etapa + 1, 5) as EtapaCadastroFrota;
      const falha = await gravar(parcial, proxima);
      if (!falha) setEtapa(proxima);
      return falha;
    },
    salvar: (parcial) => gravar(parcial, etapa),
    voltar: () => (etapa === 1 ? setEtapa(null) : setEtapa((etapa - 1) as EtapaCadastroFrota)),
  };

  async function enviar(): Promise<string | null> {
    try {
      await api.enviarCadastroFrota();
    } catch (e) {
      return mensagemDoEnvio(e);
    }
    ir('/frota', { replace: true });
    return null;
  }

  return (
    <Tela escura rotulo={ROTULO_DA_ETAPA[etapa]}>
      {etapa === 1 && <Dados {...propsComuns} />}
      {etapa === 2 && <Endereco {...propsComuns} />}
      {etapa === 3 && <Documentos {...propsComuns} />}
      {etapa === 4 && <Pix {...propsComuns} />}
      {etapa === 5 && <Termos {...propsComuns} enviar={enviar} />}
    </Tela>
  );
}
