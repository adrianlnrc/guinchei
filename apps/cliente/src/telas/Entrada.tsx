import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErroApi } from '@guinchei/api';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { mascararCelular, telefoneE164, useFluxo } from '../fluxo';
import { MensagemDeErro } from '../MensagemDeErro';
import { useSessao } from '../sessao';

export function BoasVindas() {
  const ir = useNavigate();
  // Sessão guardada no aparelho: quem já tem perfil vai direto ao Pedido.
  const sessao = useSessao();
  if (sessao === 'pronto') return <Navigate to="/pedido/1" replace />;
  if (sessao === 'sem_perfil') return <Navigate to="/cadastro" replace />;
  return (
    <Tela escura rotulo="Boas-vindas">
      <Corpo style={{ padding: '28px 28px 40px', gap: 20 }}>
        <div className="marca">guinchei</div>
        <div className="espaco" />
        <Rotulo style={{ color: 'var(--cinza-medio)' }}>Reboque no Distrito Federal</Rotulo>
        <h1 className="titulo" style={{ fontSize: 40, lineHeight: 1.08 }}>
          Carro parou? Respira. A gente vai até você.
        </h1>
        <p className="apoio" style={{ fontSize: 17 }}>
          Você vê o preço fechado antes de confirmar, e um guincho verificado chega em menos de 30
          minutos.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <Botao onClick={() => ir('/entrar')}>Pedir guincho agora</Botao>
          <Botao
            variante="contorno-escuro"
            style={{ font: '500 16px var(--fonte-texto)' }}
            onClick={() => ir('/entrar')}
          >
            Já tenho conta
          </Botao>
        </div>
      </Corpo>
    </Tela>
  );
}

export function Celular() {
  const ir = useNavigate();
  const api = useApi();
  const { celular, setCelular } = useFluxo();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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
    <Tela rotulo="Celular">
      <Corpo style={{ padding: '16px 24px 32px', gap: 18 }}>
        <Link onClick={() => ir('/')}>Voltar</Link>
        <Rotulo style={{ marginTop: 16 }}>Só um passo</Rotulo>
        <h1 className="titulo">Qual é o seu celular?</h1>
        <p className="apoio">
          Vamos mandar um código pelo WhatsApp. É por esse número que avisamos quando o guincho
          estiver chegando.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <div
            style={{
              height: 60,
              padding: '0 16px',
              borderRadius: 14,
              background: '#fff',
              border: '1px solid var(--linha)',
              display: 'flex',
              alignItems: 'center',
              font: '500 18px var(--fonte-texto)',
            }}
          >
            +55
          </div>
          <input
            aria-label="Celular com DDD"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(61) 99999-9999"
            value={mascararCelular(celular)}
            onChange={(e) => setCelular(e.target.value.replace(/\D/g, ''))}
            style={{
              flex: 1,
              minWidth: 0,
              height: 60,
              padding: '0 16px',
              borderRadius: 14,
              background: '#fff',
              border: '2px solid var(--tinta)',
              font: '500 20px var(--fonte-titulo)',
              letterSpacing: '.02em',
              outline: 'none',
            }}
          />
        </div>
        <MensagemDeErro>{erro}</MensagemDeErro>
        <div className="espaco" />
        <p className="apoio" style={{ fontSize: 13, textAlign: 'center' }}>
          Seus dados são tratados conforme a LGPD.
        </p>
        <Botao disabled={!completo || enviando} onClick={receberCodigo}>
          Receber código
        </Botao>
      </Corpo>
    </Tela>
  );
}

const TAMANHO_CODIGO = 6;

export function Codigo() {
  const ir = useNavigate();
  const api = useApi();
  const { celular, setPerfil } = useFluxo();
  const [codigo, setCodigo] = useState('');
  const [espera, setEspera] = useState(30);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

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
      const perfil = await api.buscarMeuPerfil();
      if (perfil) {
        setPerfil(perfil);
        ir('/pedido/1');
      } else {
        ir('/cadastro');
      }
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
    <Tela rotulo="Código do WhatsApp">
      <Corpo style={{ padding: '16px 24px 32px', gap: 18 }}>
        <Link onClick={() => ir('/entrar')}>Voltar</Link>
        <Rotulo style={{ marginTop: 16 }}>Confirmação</Rotulo>
        <h1 className="titulo">Digite o código</h1>
        <p className="apoio">
          Enviamos um código pelo WhatsApp para {mascararCelular(celular) || 'seu celular'}.
        </p>
        <label
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: `repeat(${TAMANHO_CODIGO}, 1fr)`,
            gap: 8,
            marginTop: 8,
          }}
        >
          <input
            ref={campo}
            aria-label="Código de 6 dígitos"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={TAMANHO_CODIGO}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, TAMANHO_CODIGO))}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%' }}
          />
          {Array.from({ length: TAMANHO_CODIGO }, (_, i) => {
            const atual = i === Math.max(codigo.length - 1, 0);
            return (
              <div
                key={i}
                aria-hidden
                style={{
                  height: 64,
                  borderRadius: 12,
                  background: '#fff',
                  border: atual ? '2px solid var(--tinta)' : '1px solid var(--linha)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: '600 26px var(--fonte-titulo)',
                }}
              >
                {codigo[i]}
              </div>
            );
          })}
        </label>
        {espera > 0 ? (
          <div style={{ font: '500 15px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
            Reenviar em 0:{String(espera).padStart(2, '0')}
          </div>
        ) : (
          <Link style={{ fontSize: 15 }} onClick={reenviar}>
            Reenviar código
          </Link>
        )}
        <MensagemDeErro>{erro}</MensagemDeErro>
        <div className="espaco" />
        <Botao disabled={codigo.length < TAMANHO_CODIGO || enviando} onClick={confirmar}>
          Confirmar
        </Botao>
      </Corpo>
    </Tela>
  );
}
