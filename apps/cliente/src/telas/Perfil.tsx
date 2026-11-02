import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Botao, Link, Valores } from '@guinchei/ui';
import { useApi } from '../api';
import { TelaComAbas } from '../AbasDoCliente';
import { mascararCelular, useFluxo } from '../fluxo';
import { MensagemDeErro } from '../MensagemDeErro';
import { cpfMascarado, dataEHora, iniciais } from '../rotulos';
import { ExigePerfil } from '../sessao';
import { TERMOS_TEXTO } from '../termos';

// Aba "Perfil": os dados do cadastro urgente, só para leitura, e a saída da conta.

export function Perfil() {
  return (
    <ExigePerfil>
      <DadosDoPerfil />
    </ExigePerfil>
  );
}

function DadosDoPerfil() {
  const api = useApi();
  const ir = useNavigate();
  const { perfil, limparSessao } = useFluxo();
  const [verTermos, setVerTermos] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function sair() {
    setErro(null);
    setSaindo(true);
    try {
      await api.sair();
      // Volta às Boas-vindas e esquece o perfil e o rascunho do Pedido.
      ir('/', { replace: true });
      limparSessao();
    } catch {
      setErro('Não foi possível sair. Tente de novo.');
      setSaindo(false);
    }
  }

  if (!perfil) return null;
  // O telefone vem em E.164 sem o "+" (55 + DDD + número).
  const celular = mascararCelular(perfil.telefone.replace(/^55/, ''));

  return (
    <TelaComAbas aba="perfil" rotulo="Perfil" estiloDoCorpo={{ gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
        <Avatar iniciais={iniciais(perfil.nome)} />
        <h1 className="titulo" style={{ font: '700 26px/1.15 var(--fonte-titulo)' }}>
          {perfil.nome}
        </h1>
      </div>
      <Valores
        linhas={[
          ['Nome', perfil.nome],
          ['Celular', celular],
          ['CPF', cpfMascarado(perfil.cpf)],
          [
            'Termos aceitos',
            <span key="termos" title={`Aceitos em ${dataEHora(perfil.aceite_termos_em)}`}>
              {perfil.aceite_termos_versao}
            </span>,
          ],
        ]}
      />
      <p className="apoio" style={{ fontSize: 13 }}>
        Por enquanto, os dados do perfil só podem ser consultados aqui.
      </p>
      <Link onClick={() => setVerTermos((v) => !v)} aria-expanded={verTermos}>
        Termos de uso (provisórios)
      </Link>
      {verTermos && (
        <section
          aria-label="Termos de uso provisórios"
          className="cartao"
          style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {TERMOS_TEXTO.map((paragrafo) => (
            <p key={paragrafo} className="apoio" style={{ fontSize: 14 }}>
              {paragrafo}
            </p>
          ))}
        </section>
      )}
      <div className="espaco" />
      <MensagemDeErro>{erro}</MensagemDeErro>
      <Botao variante="contorno" disabled={saindo} onClick={sair}>
        Sair
      </Botao>
    </TelaComAbas>
  );
}
