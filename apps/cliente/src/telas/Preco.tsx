import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRECO, TRECHO } from '@guinchei/mock';
import { TABELA_PADRAO } from '@guinchei/preco';
import { formatarKm, formatarPercentual, formatarReais } from '@guinchei/ui';
import { Botao, Corpo, Heroi, Link, Rotulo, Segmentado, Tela, Valores } from '@guinchei/ui';
import { useFluxo } from '../fluxo';

export function Preco() {
  const ir = useNavigate();
  const linhas: [string, string][] = [
    ['Taxa base', formatarReais(PRECO.taxaBase)],
    [
      `Deslocamento até você · ${formatarKm(TRECHO.kmDeslocamento)}`,
      formatarReais(PRECO.deslocamento),
    ],
    [`Reboque · ${formatarKm(TRECHO.kmReboque)}`, formatarReais(PRECO.reboque)],
  ];
  if (PRECO.adicionalNoturno)
    linhas.push([
      `Adicional noturno · ${formatarPercentual(TABELA_PADRAO.adicionalNoturno)}`,
      formatarReais(PRECO.adicionalNoturno),
    ]);
  if (PRECO.adicionalFeriado)
    linhas.push([
      `Adicional feriado · ${formatarPercentual(TABELA_PADRAO.adicionalFeriado)}`,
      formatarReais(PRECO.adicionalFeriado),
    ]);
  if (PRECO.ajustePiso)
    linhas.push(['Ajuste para o Preço fechado mínimo', formatarReais(PRECO.ajustePiso)]);

  return (
    <Tela escura rotulo="Preço fechado">
      <Corpo style={{ padding: '16px 24px 32px', gap: 14 }}>
        <Link onClick={() => ir('/local')}>Voltar</Link>
        <Rotulo style={{ marginTop: 20, color: 'var(--cinza-medio)' }}>Preço fechado</Rotulo>
        <Heroi centavos={PRECO.total} />
        <p className="apoio">
          Esse é o valor final. Ninguém vai renegociar na rua. Só muda se você trocar o destino
          durante a Corrida.
        </p>
        <Valores escuro linhas={linhas} style={{ marginTop: 12 }} />
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            font: '500 15px var(--fonte-texto)',
            color: 'var(--cinza-claro)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--sucesso)',
              flex: 'none',
            }}
          />
          Guincho mais próximo a {formatarKm(TRECHO.kmDeslocamento)} · chega em ~
          {TRECHO.minutosAteCliente} min
        </div>
        <div className="espaco" />
        <Botao variante="claro" onClick={() => ir('/pagamento')}>
          Confirmar e pagar
        </Botao>
      </Corpo>
    </Tela>
  );
}

// Código Pix de exemplo; o PSP gera o real (ADR-0004).
const PIX_COPIA_E_COLA =
  '00020126580014br.gov.bcb.pix0136a7f2c1d0-5b8e-4e2a-9c61-3f0d2b7a9e415204000053039865406297.625802BR5908GUINCHEI6008BRASILIA62070503***6304B1C2';

export function Pagamento() {
  const ir = useNavigate();
  const { avisar } = useFluxo();
  const [meio, setMeio] = useState<'pix' | 'cartao'>('pix');
  const [restante, setRestante] = useState(9 * 60 + 42);
  const [aguardando, setAguardando] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setRestante((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // Mock: o pagamento "cai" alguns segundos depois de copiar o código.
  useEffect(() => {
    if (!aguardando) return;
    const id = setTimeout(() => ir('/corrida'), 3500);
    return () => clearTimeout(id);
  }, [aguardando, ir]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(PIX_COPIA_E_COLA);
    } catch {
      // Sem permissão de área de transferência: segue o fluxo mesmo assim.
    }
    avisar('Código copiado. Aguardando o pagamento…');
    setAguardando(true);
  }

  return (
    <Tela rotulo="Pagamento Pix">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Link onClick={() => ir('/preco')}>Voltar</Link>
        <Segmentado
          style={{ marginTop: 8 }}
          valor={meio}
          onChange={setMeio}
          opcoes={[
            { valor: 'pix', rotulo: 'Pix' },
            { valor: 'cartao', rotulo: 'Cartão' },
          ]}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 4,
          }}
        >
          <span style={{ font: '700 26px var(--fonte-titulo)' }}>
            {meio === 'pix' ? 'Pague com Pix' : 'Pague com cartão'}
          </span>
          <span style={{ font: '600 20px var(--fonte-titulo)' }}>{formatarReais(PRECO.total)}</span>
        </div>
        {meio === 'pix' ? (
          <>
            <div
              style={{
                alignSelf: 'center',
                width: 220,
                height: 220,
                borderRadius: 16,
                border: '1px solid var(--linha)',
                background: 'repeating-linear-gradient(135deg,#E3E6EB 0 8px,#EEF0F3 8px 16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="mono"
            >
              QR code Pix
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: '500 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                Pix copia e cola
              </span>
              <div
                className="mono"
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: '#fff',
                  border: '1px solid var(--linha)',
                  fontSize: 13,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {PIX_COPIA_E_COLA}
              </div>
            </div>
          </>
        ) : (
          <p className="apoio" style={{ fontSize: 15 }}>
            O pagamento com cartão entra junto com o PSP real (RF12). No protótipo, use o Pix.
          </p>
        )}
        <p className="apoio" style={{ fontSize: 14 }}>
          Assim que o pagamento cair, chamamos o guincho. Se nenhum guincho aceitar, devolvemos o
          valor na hora.
        </p>
        <div className="espaco" />
        <div
          style={{
            textAlign: 'center',
            font: '500 14px var(--fonte-texto)',
            color: 'var(--tinta-2)',
          }}
        >
          Expira em {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}
        </div>
        <Botao disabled={meio !== 'pix' || aguardando || restante === 0} onClick={copiar}>
          {aguardando ? 'Aguardando pagamento…' : 'Copiar código Pix'}
        </Botao>
      </Corpo>
    </Tela>
  );
}
