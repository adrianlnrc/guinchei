import { useState } from 'react';
import { Corpo } from '@guinchei/ui';
import { CabecalhoDaEtapa, Campo, RodapeDaEtapa, type PropsDaEtapa } from './campos';

/** Etapa 4: a chave Pix que vai receber o repasse. */
export function Pix({ dados, continuar, voltar }: PropsDaEtapa) {
  const [chave, setChave] = useState(dados.chavePix ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function seguir() {
    setErro(null);
    setEnviando(true);
    const falha = await continuar({ chavePix: chave.trim() });
    if (falha) {
      setErro(falha);
      setEnviando(false);
    }
  }

  return (
    <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
      <CabecalhoDaEtapa
        numero={4}
        titulo="Chave Pix para receber"
        apoio="O repasse das Corridas cai nessa chave. Pode ser CPF, CNPJ, e-mail, celular ou chave aleatória."
      />
      <Campo
        rotulo="Chave Pix"
        autoComplete="off"
        maxLength={77}
        value={chave}
        onChange={(e) => setChave(e.target.value)}
      />
      <RodapeDaEtapa
        erro={erro}
        desabilitado={chave.trim().length === 0 || enviando}
        aoContinuar={seguir}
        aoVoltar={voltar}
      />
    </Corpo>
  );
}
