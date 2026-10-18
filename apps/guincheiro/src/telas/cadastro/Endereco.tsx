import { useState } from 'react';
import { mascararCep } from '@guinchei/documentos';
import { Corpo } from '@guinchei/ui';
import { CabecalhoDaEtapa, Campo, RodapeDaEtapa, type PropsDaEtapa } from './campos';

/** Etapa 2: onde fica a base da Frota. */
export function Endereco({ dados, continuar, voltar }: PropsDaEtapa) {
  const [cep, setCep] = useState(dados.baseCep ?? '');
  const [endereco, setEndereco] = useState(dados.baseEndereco ?? '');
  const [bairro, setBairro] = useState(dados.baseBairro ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const completo = cep.length > 0 && endereco.trim().length > 0 && bairro.trim().length > 0;

  async function seguir() {
    if (cep.length !== 8) {
      setErro('O CEP tem 8 números.');
      return;
    }
    setErro(null);
    setEnviando(true);
    const falha = await continuar({
      baseCep: cep,
      baseEndereco: endereco.trim(),
      baseBairro: bairro.trim(),
    });
    if (falha) {
      setErro(falha);
      setEnviando(false);
    }
  }

  return (
    <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
      <CabecalhoDaEtapa
        numero={2}
        titulo="Endereço da base"
        apoio="Onde ficam o guincho e a sua operação, no Distrito Federal."
      />
      <Campo
        rotulo="CEP"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="00000-000"
        value={mascararCep(cep)}
        onChange={(e) => {
          setCep(e.target.value.replace(/\D/g, '').slice(0, 8));
          setErro(null);
        }}
      />
      <Campo
        rotulo="Endereço da base (rua e número)"
        autoComplete="street-address"
        value={endereco}
        onChange={(e) => setEndereco(e.target.value)}
      />
      <Campo rotulo="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
      <RodapeDaEtapa
        erro={erro}
        desabilitado={!completo || enviando}
        aoContinuar={seguir}
        aoVoltar={voltar}
      />
    </Corpo>
  );
}
