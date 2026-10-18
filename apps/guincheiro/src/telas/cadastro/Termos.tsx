import { useState } from 'react';
import { Corpo, Link } from '@guinchei/ui';
import { CabecalhoDaEtapa, RodapeDaEtapa, type PropsDaEtapa } from './campos';
import { TERMOS_PRESTADORES_TEXTO, TERMOS_PRESTADORES_VERSAO } from './termos';

/**
 * Etapa 5: aceite dos termos para prestadores e envio. O app manda só a versão aceita; a
 * hora do aceite é a do servidor (como no aceite dos termos de uso, ADR-0010).
 */
export function Termos({
  salvar,
  voltar,
  enviar,
}: PropsDaEtapa & { enviar: () => Promise<string | null> }) {
  const [aceite, setAceite] = useState(false);
  const [verTermos, setVerTermos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviarCadastro() {
    setErro(null);
    setEnviando(true);
    const falha = (await salvar({ termosVersao: TERMOS_PRESTADORES_VERSAO })) ?? (await enviar());
    if (falha) {
      setErro(falha);
      setEnviando(false);
    }
  }

  return (
    <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
      <CabecalhoDaEtapa
        numero={5}
        titulo="Termos para prestadores"
        apoio="Falta só o aceite. Depois do envio, a operação verifica os documentos."
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
        Li e aceito os termos para prestadores.
      </label>
      <Link style={{ fontSize: 15 }} onClick={() => setVerTermos((v) => !v)}>
        {verTermos ? 'Esconder os termos para prestadores' : 'Ler os termos para prestadores'}
      </Link>
      {verTermos && (
        <section
          aria-label="Termos para prestadores"
          style={{
            padding: 16,
            borderRadius: 14,
            background: 'var(--superficie-escura)',
            border: '1px solid var(--borda-escura)',
            font: '400 14px/1.5 var(--fonte-texto)',
            color: 'var(--cinza-claro)',
          }}
        >
          {TERMOS_PRESTADORES_TEXTO.map((paragrafo) => (
            <p key={paragrafo} style={{ margin: '0 0 8px' }}>
              {paragrafo}
            </p>
          ))}
        </section>
      )}
      <RodapeDaEtapa
        erro={erro}
        continuar="Enviar cadastro"
        desabilitado={!aceite || enviando}
        aoContinuar={enviarCadastro}
        aoVoltar={voltar}
      />
    </Corpo>
  );
}
