import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { mascararCelular, useFluxo } from '../fluxo';

export function BoasVindas() {
  const ir = useNavigate();
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
  const { celular, setCelular } = useFluxo();
  const completo = celular.replace(/\D/g, '').length === 11;
  return (
    <Tela rotulo="Celular">
      <Corpo style={{ padding: '16px 24px 32px', gap: 18 }}>
        <Link onClick={() => ir('/')}>Voltar</Link>
        <Rotulo style={{ marginTop: 16 }}>Só um passo</Rotulo>
        <h1 className="titulo">Qual é o seu celular?</h1>
        <p className="apoio">
          Vamos mandar um código por SMS. É por esse número que avisamos quando o guincho estiver
          chegando.
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
        <div className="espaco" />
        <p className="apoio" style={{ fontSize: 13, textAlign: 'center' }}>
          Seus dados são tratados conforme a LGPD.
        </p>
        <Botao disabled={!completo} onClick={() => ir('/codigo')}>
          Receber código
        </Botao>
      </Corpo>
    </Tela>
  );
}

const TAMANHO_CODIGO = 6;

export function Codigo() {
  const ir = useNavigate();
  const { celular } = useFluxo();
  const [codigo, setCodigo] = useState('');
  const [espera, setEspera] = useState(30);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  return (
    <Tela rotulo="Código SMS">
      <Corpo style={{ padding: '16px 24px 32px', gap: 18 }}>
        <Link onClick={() => ir('/entrar')}>Voltar</Link>
        <Rotulo style={{ marginTop: 16 }}>Confirmação</Rotulo>
        <h1 className="titulo">Digite o código</h1>
        <p className="apoio">Enviado para {mascararCelular(celular) || 'seu celular'}.</p>
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
          <Link style={{ fontSize: 15 }} onClick={() => setEspera(30)}>
            Reenviar código
          </Link>
        )}
        <div className="espaco" />
        {/* Modo mock: qualquer código de 6 dígitos entra. */}
        <Botao disabled={codigo.length < TAMANHO_CODIGO} onClick={() => ir('/pedido/1')}>
          Confirmar
        </Botao>
      </Corpo>
    </Tela>
  );
}
