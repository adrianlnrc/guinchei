import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ErroApi } from '@guinchei/api';
import { Botao, Link, Rotulo } from '@guinchei/ui';
import { useApi } from '../api';
import { mascararCelular, telefoneE164 } from '../celular';
import { AVISO_NAO_E_OPERACAO, useSessao } from '../sessao';

function MensagemDeErro({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  return (
    <p role="alert" className="entrada__erro">
      {children}
    </p>
  );
}

function Cartao({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <main className="entrada" aria-label={rotulo}>
      <div className="entrada__cartao">
        <div className="marca">
          guinchei <small>operação</small>
        </div>
        {children}
      </div>
    </main>
  );
}

/** A operação não se cadastra pelo Painel: só entra quem já tem perfil `operacao`. */
export function Celular() {
  const ir = useNavigate();
  const api = useApi();
  const { state } = useLocation() as { state: { erro?: string } | null };
  const { celular, setCelular } = useSessao();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(state?.erro ?? null);
  const completo = celular.replace(/\D/g, '').length === 11;

  async function receberCodigo() {
    setEnviando(true);
    setErro(null);
    try {
      await api.enviarCodigo(telefoneE164(celular));
      ir('/codigo');
    } catch {
      setErro('Não foi possível enviar o código. Confira o número e tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <Cartao rotulo="Celular">
      <Rotulo>Operação</Rotulo>
      <h1 className="titulo">Qual é o seu celular?</h1>
      <p className="apoio">
        Use o número cadastrado como operação no Guinchei. Vamos mandar um código pelo WhatsApp.
      </p>
      <div className="entrada__linha">
        <div className="entrada__ddi">+55</div>
        <input
          className="entrada__campo"
          aria-label="Celular com DDD"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus
          placeholder="(61) 99999-9999"
          value={mascararCelular(celular)}
          onChange={(e) => setCelular(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <MensagemDeErro>{erro}</MensagemDeErro>
      <Botao variante="claro" disabled={!completo || enviando} onClick={receberCodigo}>
        Receber código
      </Botao>
    </Cartao>
  );
}

const TAMANHO_CODIGO = 6;

export function Codigo() {
  const ir = useNavigate();
  const api = useApi();
  const { celular, setOperador } = useSessao();
  const [codigo, setCodigo] = useState('');
  const [espera, setEspera] = useState(30);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.confirmarCodigo(telefoneE164(celular), codigo);
      const meu = await api.buscarMeuOperador();
      if (!meu) {
        // Telefone verificado, mas sem perfil da operação: não fica logado aqui.
        await api.sair();
        setErro(AVISO_NAO_E_OPERACAO);
        setEnviando(false);
        return;
      }
      setOperador(meu);
      ir('/', { replace: true });
    } catch (e) {
      setErro(
        e instanceof ErroApi && e.motivo === 'codigo_invalido'
          ? 'Código incorreto ou expirado. Confira e tente de novo.'
          : 'Não foi possível entrar. Tente de novo.',
      );
      setEnviando(false);
    }
  }

  async function reenviar() {
    setEspera(30);
    setErro(null);
    try {
      await api.enviarCodigo(telefoneE164(celular));
    } catch {
      setErro('Não foi possível reenviar o código. Tente de novo em instantes.');
    }
  }

  return (
    <Cartao rotulo="Código do WhatsApp">
      <Link onClick={() => ir('/entrar')}>Voltar</Link>
      <Rotulo>Confirmação</Rotulo>
      <h1 className="titulo">Digite o código</h1>
      <p className="apoio">
        Enviamos um código pelo WhatsApp para {mascararCelular(celular) || 'seu celular'}.
      </p>
      <input
        className="entrada__campo entrada__campo--codigo"
        aria-label="Código de 6 dígitos"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={TAMANHO_CODIGO}
        placeholder="000000"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, TAMANHO_CODIGO))}
      />
      {espera > 0 ? (
        <div className="apoio">Reenviar em 0:{String(espera).padStart(2, '0')}</div>
      ) : (
        <Link onClick={reenviar}>Reenviar código</Link>
      )}
      <MensagemDeErro>{erro}</MensagemDeErro>
      <Botao
        variante="claro"
        disabled={codigo.length < TAMANHO_CODIGO || enviando}
        onClick={confirmar}
      >
        Confirmar
      </Botao>
    </Cartao>
  );
}
