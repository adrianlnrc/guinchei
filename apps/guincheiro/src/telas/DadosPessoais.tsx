import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErroApi } from '@guinchei/api';
import { cpfValido, mascararCpf } from '@guinchei/documentos';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { MensagemDeErro } from '../MensagemDeErro';
import { ROTA_DOCUMENTOS } from '../rotas';
import { AVISO_NAO_E_GUINCHEIRO, useSessao } from '../sessao';
import { TERMOS_TEXTO, TERMOS_VERSAO } from '../termos';
import { Campo } from './cadastro/campos';

/**
 * Primeiro acesso do Guincheiro convidado (#46): nome, CPF e aceite dos termos de uso. Ao
 * concluir, o servidor cria o perfil e o Guincheiro na Frota que o convidou, e o app segue
 * para a etapa de documentos.
 */
export function DadosPessoais() {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_guincheiro') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_GUINCHEIRO }} />;
  }
  // Sem convite (nunca houve, venceu ou foi cancelado): a oferta de cadastrar a própria Frota.
  if (estado === 'sem_perfil') return <Navigate to="/cadastro" replace />;
  if (estado === 'representante') return <Navigate to="/frota" replace />;
  if (estado === 'pronto') return <Navigate to="/" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  return <Formulario />;
}

/** A mensagem que a pessoa lê quando o servidor recusa o primeiro acesso. */
function mensagemDoAceite(e: unknown): string {
  if (!(e instanceof ErroApi)) return 'Não foi possível concluir. Tente de novo.';
  switch (e.motivo) {
    case 'cpf_ja_cadastrado':
      return 'Este CPF já está cadastrado em outra conta.';
    case 'cpf_invalido':
    case 'dados_incompletos':
    case 'sem_convite':
    case 'convite_vencido':
    case 'numero_ja_tem_conta':
      return e.message;
    default:
      return 'Não foi possível concluir. Tente de novo.';
  }
}

function Formulario() {
  const api = useApi();
  const ir = useNavigate();
  const [frota, setFrota] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [aceite, setAceite] = useState(false);
  const [verTermos, setVerTermos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    api
      .buscarMeuConvite()
      .then((convite) => vigente && setFrota(convite?.frotaNome ?? null))
      // O nome da Frota é só informativo: sem ele o formulário continua valendo.
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [api]);

  const completo = nome.trim().length > 0 && cpf.length === 11 && aceite;

  async function continuar() {
    if (!cpfValido(cpf)) {
      setErro('CPF inválido. Confira os números.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await api.aceitarConvite({ nome: nome.trim(), cpf, termosVersao: TERMOS_VERSAO });
      ir(ROTA_DOCUMENTOS, { replace: true });
    } catch (e) {
      setErro(mensagemDoAceite(e));
      setEnviando(false);
    }
  }

  async function sair() {
    await api.sair();
    ir('/entrar', { replace: true });
  }

  return (
    <Tela escura rotulo="Dados pessoais">
      <Corpo style={{ padding: '28px 24px 32px', gap: 18 }}>
        <div className="marca">guinchei</div>
        <Rotulo style={{ marginTop: 16, color: 'var(--cinza-medio)' }}>Primeiro acesso</Rotulo>
        <h1 className="titulo">Quem é você?</h1>
        <p className="apoio">
          {frota ? `A Frota ${frota} convidou você. ` : ''}
          Informe os seus dados para criar a sua conta de Guincheiro. Em seguida, você envia os
          documentos para a operação aprovar.
        </p>
        <Campo
          rotulo="Nome completo"
          autoComplete="name"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Campo
          rotulo="CPF"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={mascararCpf(cpf)}
          onChange={(e) => {
            setCpf(e.target.value.replace(/\D/g, '').slice(0, 11));
            setErro(null);
          }}
          aria-invalid={erro?.startsWith('CPF') || undefined}
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
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            style={{ width: 22, height: 22, marginTop: 1, accentColor: 'var(--ambar)' }}
          />
          Li e aceito os termos de uso.
        </label>
        <Link style={{ fontSize: 15 }} onClick={() => setVerTermos((v) => !v)}>
          {verTermos ? 'Esconder os termos de uso' : 'Ler os termos de uso'}
        </Link>
        {verTermos && (
          <section
            aria-label="Termos de uso"
            style={{
              padding: 16,
              borderRadius: 14,
              background: 'var(--superficie-escura)',
              border: '1px solid var(--borda-escura)',
              font: '400 14px/1.5 var(--fonte-texto)',
              color: 'var(--cinza-claro)',
            }}
          >
            {TERMOS_TEXTO.map((paragrafo) => (
              <p key={paragrafo} style={{ margin: '0 0 8px' }}>
                {paragrafo}
              </p>
            ))}
          </section>
        )}
        <MensagemDeErro>{erro}</MensagemDeErro>
        <div className="espaco" />
        <Botao variante="claro" grande disabled={!completo || enviando} onClick={continuar}>
          Continuar
        </Botao>
        <Link centro onClick={sair}>
          Sair
        </Link>
      </Corpo>
    </Tela>
  );
}
