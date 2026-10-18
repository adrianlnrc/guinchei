import { useState } from 'react';
import { cnpjValido, cpfValido, mascararCnpj, mascararCpf } from '@guinchei/documentos';
import { Corpo, Segmentado } from '@guinchei/ui';
import { mascararCelular } from '../../celular';
import { CabecalhoDaEtapa, Campo, RodapeDaEtapa, type PropsDaEtapa } from './campos';

type TipoDeDocumento = 'cpf' | 'mei';

const TIPOS = [
  { valor: 'cpf', rotulo: 'CPF' },
  { valor: 'mei', rotulo: 'CNPJ do MEI' },
] as const;

const soDigitos = (texto: string, limite: number) => texto.replace(/\D/g, '').slice(0, limite);

/** Etapa 1: o documento da Frota (CPF ou CNPJ do MEI) e o representante. */
export function Dados({ dados, telefone, continuar, voltar }: PropsDaEtapa) {
  const [tipo, setTipo] = useState<TipoDeDocumento>(
    (dados.documento?.length ?? 0) > 11 ? 'mei' : 'cpf',
  );
  const [documento, setDocumento] = useState(dados.documento ?? '');
  const [nome, setNome] = useState(dados.nome ?? '');
  const [representanteNome, setRepresentanteNome] = useState(dados.representanteNome ?? '');
  const [representanteCpf, setRepresentanteCpf] = useState(dados.representanteCpf ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const mei = tipo === 'mei';
  const completo =
    documento.length > 0 &&
    nome.trim().length > 0 &&
    (!mei || (representanteNome.trim().length > 0 && representanteCpf.length > 0));

  function trocarTipo(novo: TipoDeDocumento) {
    if (novo === tipo) return;
    setTipo(novo);
    setDocumento('');
    setErro(null);
  }

  async function seguir() {
    if (mei ? !cnpjValido(documento) : !cpfValido(documento)) {
      setErro(`${mei ? 'CNPJ' : 'CPF'} inválido. Confira os números.`);
      return;
    }
    if (mei && !cpfValido(representanteCpf)) {
      setErro('CPF do representante inválido. Confira os números.');
      return;
    }
    setErro(null);
    setEnviando(true);
    // No autônomo de CPF o representante é a própria pessoa.
    const falha = await continuar({
      documento,
      nome: nome.trim(),
      representanteNome: mei ? representanteNome.trim() : nome.trim(),
      representanteCpf: mei ? representanteCpf : documento,
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
        titulo="Dados da sua Frota"
        apoio="Autônomo, com CPF ou MEI. A Frota é você; os documentos de Guincheiro vêm depois."
      />
      <Segmentado opcoes={TIPOS} valor={tipo} onChange={trocarTipo} style={{ marginBottom: 4 }} />
      <Campo
        rotulo={mei ? 'CNPJ do MEI' : 'CPF'}
        inputMode={mei ? 'text' : 'numeric'}
        autoComplete="off"
        placeholder={mei ? '00.000.000/0000-00' : '000.000.000-00'}
        value={mei ? mascararCnpj(documento) : mascararCpf(documento)}
        onChange={(e) => {
          setDocumento(
            mei
              ? e.target.value
                  .toUpperCase()
                  .replace(/[^0-9A-Z]/g, '')
                  .slice(0, 14)
              : soDigitos(e.target.value, 11),
          );
          setErro(null);
        }}
        aria-invalid={erro?.includes('inválido') || undefined}
      />
      <Campo
        rotulo={mei ? 'Razão social ou nome fantasia' : 'Nome completo'}
        autoComplete={mei ? 'organization' : 'name'}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      {mei && (
        <>
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
          />
        </>
      )}
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
