import { useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ErroApi, type Perfil } from '@guinchei/api';
import { cepValido, emailValido, mascararCep } from '@guinchei/documentos';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { mascararCpf } from '../cpf';
import { celularDoLogin, useFluxo } from '../fluxo';
import { MensagemDeErro } from '../MensagemDeErro';
import { campo, rotuloCampo } from './Cadastro';

// Cadastro no app (ADR-0010, revisão de 2026-10-22): o que veio do emergencial, mais o
// e-mail. Nunca bloqueia um Pedido: é uma tela de consulta e ajuste, aberta pelo início e
// pelo fim da Corrida. CPF e celular (do login) são só leitura.

const somenteLeitura: CSSProperties = { ...campo, background: 'var(--fundo-2, #f1f1ef)' };

export function MeuCadastro() {
  const { perfil } = useFluxo();
  // Dentro de ExigePerfil o perfil já existe; isto só acalma o tipo.
  return perfil ? <Formulario perfil={perfil} /> : null;
}

function Formulario({ perfil }: { perfil: Perfil }) {
  const api = useApi();
  const ir = useNavigate();
  const { key } = useLocation();
  const { setPerfil, avisar } = useFluxo();
  const [nome, setNome] = useState(perfil.nome);
  const [cep, setCep] = useState(perfil.cep ?? '');
  const [email, setEmail] = useState(perfil.email ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Volta para onde o Cliente estava; aberta direto pelo endereço, vai para o início.
  const voltar = () => (key === 'default' ? ir('/pedido/1', { replace: true }) : ir(-1));
  const pronto = nome.trim().length > 0 && cep.length === 8;

  async function salvar() {
    const emailLimpo = email.trim();
    if (!cepValido(cep)) return setErro('CEP inválido. Confira os números.');
    if (emailLimpo && !emailValido(emailLimpo)) {
      return setErro('E-mail inválido. Confira o endereço.');
    }
    setErro(null);
    setSalvando(true);
    try {
      setPerfil(await api.atualizarMeuCadastro({ nome, cep, email: emailLimpo }));
      avisar('Cadastro salvo.');
      voltar();
    } catch (e) {
      const motivo = e instanceof ErroApi ? e.motivo : null;
      setErro(
        motivo === 'cep_invalido'
          ? 'CEP inválido. Confira os números.'
          : motivo === 'email_invalido'
            ? 'E-mail inválido. Confira o endereço.'
            : 'Não foi possível salvar o cadastro. Tente de novo.',
      );
      setSalvando(false);
    }
  }

  return (
    <Tela rotulo="Meu cadastro" semRodape>
      <Corpo style={{ padding: '16px 24px 32px', gap: 18 }}>
        <Rotulo style={{ marginTop: 16 }}>Conta</Rotulo>
        <h1 className="titulo">Meu cadastro</h1>
        <p className="apoio">Mantenha seus dados em dia. Isso nunca atrapalha um Pedido.</p>
        <label style={rotuloCampo}>
          Nome completo
          <input
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={campo}
          />
        </label>
        <label style={rotuloCampo}>
          CPF
          <input readOnly value={mascararCpf(perfil.cpf)} style={somenteLeitura} />
        </label>
        <label style={rotuloCampo}>
          Celular
          <input readOnly value={celularDoLogin(perfil.telefone)} style={somenteLeitura} />
        </label>
        <label style={rotuloCampo}>
          CEP
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={mascararCep(cep)}
            onChange={(e) => {
              setCep(e.target.value.replace(/\D/g, '').slice(0, 8));
              setErro(null);
            }}
            aria-invalid={erro?.startsWith('CEP') || undefined}
            style={campo}
          />
        </label>
        <label style={rotuloCampo}>
          E-mail (opcional)
          <input
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErro(null);
            }}
            aria-invalid={erro?.startsWith('E-mail') || undefined}
            style={campo}
          />
        </label>
        <MensagemDeErro>{erro}</MensagemDeErro>
        <div className="espaco" />
        <Botao disabled={!pronto || salvando} onClick={salvar}>
          Salvar
        </Botao>
        <Link centro onClick={voltar}>
          Voltar
        </Link>
      </Corpo>
    </Tela>
  );
}
