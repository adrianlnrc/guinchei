import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ErroApi } from '@guinchei/api';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { mascararCelular, telefoneE164 } from '../celular';
import { MensagemDeErro } from '../MensagemDeErro';
import { usePlantao } from '../plantao';
import { ROTA_DADOS_PESSOAIS } from '../rotas';
import { AVISO_NAO_E_GUINCHEIRO } from '../sessao';

/**
 * Entra o Guincheiro que a Frota já cadastrou. Quem foi convidado por telefone é levado, depois
 * do código, ao primeiro acesso (#46); quem não tem perfil nem convite, a cadastrar a própria
 * Frota, como pessoa física ou empresa (ADR-0012).
 */
export function Celular() {
  const ir = useNavigate();
  const api = useApi();
  const { state } = useLocation() as { state: { erro?: string } | null };
  const { celular, setCelular } = usePlantao();
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
    <Tela escura rotulo="Celular">
      <Corpo style={{ padding: '28px 24px 32px', gap: 18 }}>
        <div className="marca">guinchei</div>
        <Rotulo style={{ marginTop: 24, color: 'var(--cinza-medio)' }}>Guincheiro</Rotulo>
        <h1 className="titulo">Qual é o seu celular?</h1>
        <p className="apoio">
          Use o número que a sua Frota informou ao Guinchei. Se você ainda não é prestador, entre
          com o seu celular e cadastre a sua Frota como pessoa física (se você tem um guincho) ou
          como empresa (CNPJ). Vamos mandar um código pelo WhatsApp.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <div
            style={{
              height: 60,
              padding: '0 16px',
              borderRadius: 14,
              background: 'var(--superficie-escura)',
              border: '1px solid var(--linha-escura)',
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
              background: 'var(--superficie-escura)',
              color: 'var(--off-white)',
              border: '2px solid var(--off-white)',
              font: '500 20px var(--fonte-titulo)',
              letterSpacing: '.02em',
              outline: 'none',
            }}
          />
        </div>
        <MensagemDeErro>{erro}</MensagemDeErro>
        <div className="espaco" />
        <Botao variante="claro" disabled={!completo || enviando} onClick={receberCodigo}>
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
  const { celular, setGuincheiro } = usePlantao();
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
      const meu = await api.buscarMeuGuincheiro();
      if (meu) {
        setGuincheiro(meu);
        ir('/', { replace: true });
        return;
      }
      const perfil = await api.buscarMeuPerfil();
      if (!perfil) {
        // Número convidado: primeiro acesso na Frota que convidou. Sem convite: cadastra a
        // própria Frota (autônomo, ADR-0012).
        const convite = await api.buscarMeuConvite();
        ir(convite ? ROTA_DADOS_PESSOAIS : '/cadastro', { replace: true });
        return;
      }
      if (perfil.papel === 'representante') {
        // Acompanha a Frota que já enviou.
        ir('/frota', { replace: true });
        return;
      }
      // Telefone verificado de Cliente ou da operação: não fica logado aqui.
      await api.sair();
      setErro(AVISO_NAO_E_GUINCHEIRO);
      setEnviando(false);
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
    <Tela escura rotulo="Código do WhatsApp">
      <Corpo style={{ padding: '16px 24px 32px', gap: 18 }}>
        <Link onClick={() => ir('/entrar')}>Voltar</Link>
        <Rotulo style={{ marginTop: 16, color: 'var(--cinza-medio)' }}>Confirmação</Rotulo>
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
                  background: 'var(--superficie-escura)',
                  border: atual ? '2px solid var(--off-white)' : '1px solid var(--linha-escura)',
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
          <div style={{ font: '500 15px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
            Reenviar em 0:{String(espera).padStart(2, '0')}
          </div>
        ) : (
          <Link style={{ fontSize: 15 }} onClick={reenviar}>
            Reenviar código
          </Link>
        )}
        <MensagemDeErro>{erro}</MensagemDeErro>
        <div className="espaco" />
        <Botao
          variante="claro"
          disabled={codigo.length < TAMANHO_CODIGO || enviando}
          onClick={confirmar}
        >
          Confirmar
        </Botao>
      </Corpo>
    </Tela>
  );
}
