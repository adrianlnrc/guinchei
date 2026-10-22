import { useState } from 'react';
import { cnpjValido, cpfValido, mascararCnpj, mascararCpf } from '@guinchei/documentos';
import { Corpo } from '@guinchei/ui';
import { mascararCelular } from '../../celular';
import { CabecalhoDaEtapa, Campo, RodapeDaEtapa, type PropsDaEtapa } from './campos';

const soDigitos = (texto: string, limite: number) => texto.replace(/\D/g, '').slice(0, limite);

/**
 * Etapa 1 da Frota empresa: o CNPJ (numérico ou alfanumérico) e a razão social, e o
 * representante, que é quem entra no app e não precisa dirigir. As demais etapas são as da
 * Frota autônoma.
 */
export function DadosEmpresa({ dados, telefone, continuar, voltar }: PropsDaEtapa) {
  const [cnpj, setCnpj] = useState(dados.documento ?? '');
  const [razaoSocial, setRazaoSocial] = useState(dados.nome ?? '');
  const [representanteNome, setRepresentanteNome] = useState(dados.representanteNome ?? '');
  const [representanteCpf, setRepresentanteCpf] = useState(dados.representanteCpf ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const completo =
    cnpj.length > 0 &&
    razaoSocial.trim().length > 0 &&
    representanteNome.trim().length > 0 &&
    representanteCpf.length > 0;

  async function seguir() {
    if (!cnpjValido(cnpj)) {
      setErro('CNPJ inválido. Confira os números.');
      return;
    }
    if (!cpfValido(representanteCpf)) {
      setErro('CPF do representante inválido. Confira os números.');
      return;
    }
    setErro(null);
    setEnviando(true);
    const falha = await continuar({
      documento: cnpj,
      nome: razaoSocial.trim(),
      representanteNome: representanteNome.trim(),
      representanteCpf,
    });
    if (falha) {
      setErro(falha);
      setEnviando(false);
    }
  }

  return (
    <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
      <CabecalhoDaEtapa
        numero={1}
        titulo="Dados da empresa"
        apoio="O representante é quem entra no app e acompanha a verificação da Frota. Ele não precisa dirigir; os Guincheiros entram depois."
      />
      <Campo
        rotulo="CNPJ"
        inputMode="text"
        autoComplete="off"
        placeholder="00.000.000/0000-00"
        value={mascararCnpj(cnpj)}
        onChange={(e) => {
          setCnpj(
            e.target.value
              .toUpperCase()
              .replace(/[^0-9A-Z]/g, '')
              .slice(0, 14),
          );
          setErro(null);
        }}
        aria-invalid={erro?.startsWith('CNPJ') || undefined}
      />
      <Campo
        rotulo="Razão social"
        autoComplete="organization"
        value={razaoSocial}
        onChange={(e) => setRazaoSocial(e.target.value)}
      />
      <Campo
        rotulo="Nome do representante"
        autoComplete="name"
        value={representanteNome}
        onChange={(e) => setRepresentanteNome(e.target.value)}
      />
      <Campo
        rotulo="CPF do representante"
        inputMode="numeric"
        placeholder="000.000.000-00"
        value={mascararCpf(representanteCpf)}
        onChange={(e) => {
          setRepresentanteCpf(soDigitos(e.target.value, 11));
          setErro(null);
        }}
        aria-invalid={erro?.startsWith('CPF') || undefined}
      />
      <p className="apoio" style={{ fontSize: 14 }}>
        Celular do representante: {telefone ? mascararCelular(telefone.replace(/^55/, '')) : '—'} (o
        mesmo do login)
      </p>
      <RodapeDaEtapa
        erro={erro}
        desabilitado={!completo || enviando}
        aoContinuar={seguir}
        aoVoltar={voltar}
      />
    </Corpo>
  );
}
