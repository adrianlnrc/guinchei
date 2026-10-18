import { useState, type CSSProperties } from 'react';
import { Navigate } from 'react-router-dom';
import { ErroApi } from '@guinchei/api';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { cpfValido, mascararCpf } from '../cpf';
import { useFluxo } from '../fluxo';
import { MensagemDeErro } from '../MensagemDeErro';
import { useSessao } from '../sessao';
import { TERMOS_TEXTO, TERMOS_VERSAO } from '../termos';

// Cadastro urgente (ADR-0010): nome, CPF e aceite dos termos. O telefone vem do login.

const campo: CSSProperties = {
  width: '100%',
  height: 60,
  padding: '0 16px',
  borderRadius: 14,
  background: '#fff',
  border: '1px solid var(--linha)',
  font: '500 18px var(--fonte-texto)',
};

const rotuloCampo: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  font: '600 14px var(--fonte-texto)',
  color: 'var(--tinta-2)',
};

export function Cadastro() {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'pronto') return <Navigate to="/pedido/1" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  return <Formulario />;
}

function Formulario() {
  const api = useApi();
  const { setPerfil } = useFluxo();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [aceite, setAceite] = useState(false);
  const [verTermos, setVerTermos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const completo = nome.trim().length > 0 && cpf.length === 11 && aceite;

  async function continuar() {
    if (!cpfValido(cpf)) {
      setErro('CPF inválido. Confira os números.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      // Com o perfil no fluxo, o Cadastro redireciona para o Pedido.
      setPerfil(await api.criarPerfilUrgente({ nome, cpf, termosVersao: TERMOS_VERSAO }));
    } catch (e) {
      setErro(
        e instanceof ErroApi && e.motivo === 'cpf_ja_cadastrado'
          ? 'Este CPF já está cadastrado em outra conta.'
          : 'Não foi possível salvar o cadastro. Tente de novo.',
      );
      setEnviando(false);
    }
  }

  return (
    <Tela rotulo="Cadastro">
      <Corpo style={{ padding: '16px 24px 32px', gap: 18 }}>
        <Rotulo style={{ marginTop: 16 }}>Falta pouco</Rotulo>
        <h1 className="titulo">Quem está pedindo?</h1>
        <p className="apoio">Só o essencial para chamar o guincho. O resto fica para depois.</p>
        <label style={rotuloCampo}>
          Nome completo
          <input
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={campo}
          />
        </label>
        <label style={rotuloCampo}>
          CPF
          <input
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={mascararCpf(cpf)}
            onChange={(e) => {
              setCpf(e.target.value.replace(/\D/g, '').slice(0, 11));
              setErro(null);
            }}
            aria-invalid={erro?.startsWith('CPF') || undefined}
            style={campo}
          />
        </label>
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
            style={{ width: 22, height: 22, marginTop: 1, accentColor: 'var(--tinta)' }}
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
              background: '#fff',
              border: '1px solid var(--linha)',
              font: '400 14px/1.5 var(--fonte-texto)',
              color: 'var(--tinta-2)',
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
        <Botao disabled={!completo || enviando} onClick={continuar}>
          Continuar
        </Botao>
      </Corpo>
    </Tela>
  );
}
