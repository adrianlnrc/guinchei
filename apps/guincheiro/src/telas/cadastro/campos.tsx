import type { CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import type { DadosCadastroFrota, EtapaCadastroFrota } from '@guinchei/api';
import { Botao, Link, Progresso, Rotulo } from '@guinchei/ui';
import { MensagemDeErro } from '../../MensagemDeErro';

export const TOTAL_DE_ETAPAS = 5;

/** O que cada etapa recebe do assistente. As funções devolvem a mensagem de erro, se falharem. */
export interface PropsDaEtapa {
  dados: DadosCadastroFrota;
  /** Telefone do login (dígitos, com o 55). */
  telefone: string | null;
  /** Grava o rascunho já na etapa seguinte e abre essa etapa. */
  continuar(parcial: DadosCadastroFrota): Promise<string | null>;
  /** Grava o rascunho sem sair da etapa (por exemplo, depois de enviar um documento). */
  salvar(parcial: DadosCadastroFrota): Promise<string | null>;
  voltar(): void;
}

const estiloRotulo: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  font: '600 14px var(--fonte-texto)',
  color: 'var(--cinza-medio)',
};

const estiloCampo: CSSProperties = {
  width: '100%',
  height: 56,
  padding: '0 16px',
  borderRadius: 14,
  background: 'var(--superficie-escura)',
  color: 'var(--off-white)',
  border: '1px solid var(--borda-escura)',
  font: '500 17px var(--fonte-texto)',
  outline: 'none',
};

/** Campo de texto com o rótulo por cima. */
export function Campo({
  rotulo,
  ...resto
}: { rotulo: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={estiloRotulo}>
      {rotulo}
      <input style={estiloCampo} {...resto} />
    </label>
  );
}

/** Lista de escolha com o rótulo por cima, no mesmo desenho do `Campo`. */
export function CampoDeSelecao({
  rotulo,
  children,
  ...resto
}: { rotulo: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label style={estiloRotulo}>
      {rotulo}
      <select style={estiloCampo} {...resto}>
        {children}
      </select>
    </label>
  );
}

export function CabecalhoDaEtapa({
  numero,
  titulo,
  apoio,
}: {
  numero: EtapaCadastroFrota;
  titulo: string;
  apoio?: ReactNode;
}) {
  return (
    <>
      <Progresso total={TOTAL_DE_ETAPAS} feitos={numero} />
      <Rotulo
        style={{ color: 'var(--cinza-medio)' }}
      >{`Etapa ${numero} de ${TOTAL_DE_ETAPAS}`}</Rotulo>
      <h1 className="titulo" style={{ font: '700 28px/1.12 var(--fonte-titulo)' }}>
        {titulo}
      </h1>
      {apoio && (
        <p className="apoio" style={{ fontSize: 15 }}>
          {apoio}
        </p>
      )}
    </>
  );
}

export function RodapeDaEtapa({
  erro,
  continuar = 'Continuar',
  desabilitado,
  aoContinuar,
  aoVoltar,
}: {
  erro: string | null;
  continuar?: string;
  desabilitado: boolean;
  aoContinuar: () => void;
  aoVoltar: () => void;
}) {
  return (
    <>
      <MensagemDeErro>{erro}</MensagemDeErro>
      <div className="espaco" />
      <Botao variante="claro" grande disabled={desabilitado} onClick={aoContinuar}>
        {continuar}
      </Botao>
      <Link centro onClick={aoVoltar}>
        Voltar
      </Link>
    </>
  );
}
