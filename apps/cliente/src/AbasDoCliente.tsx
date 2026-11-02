import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Abas, Corpo, IndicadorHome, Tela } from '@guinchei/ui';

type Aba = 'inicio' | 'corridas' | 'perfil';

const ABAS = [
  { valor: 'inicio', rotulo: 'Início' },
  { valor: 'corridas', rotulo: 'Corridas' },
  { valor: 'perfil', rotulo: 'Perfil' },
] as const satisfies readonly { valor: Aba; rotulo: string }[];

const ROTAS: Record<Aba, string> = {
  inicio: '/inicio',
  corridas: '/corridas',
  perfil: '/perfil',
};

/**
 * Tela das três abas do Cliente (Início, Corridas e Perfil), com a barra inferior. O fluxo do
 * Pedido (perguntas, local, preço, pagamento, acompanhamento e avaliação) não usa a barra.
 */
export function TelaComAbas({
  aba,
  rotulo,
  children,
  estiloDoCorpo,
}: {
  aba: Aba;
  rotulo: string;
  children: ReactNode;
  estiloDoCorpo?: CSSProperties;
}) {
  const ir = useNavigate();
  return (
    <Tela rotulo={rotulo} semRodape>
      <Corpo style={{ padding: '16px 20px 20px', gap: 14, ...estiloDoCorpo }}>{children}</Corpo>
      <Abas
        rotulo="Navegação do Cliente"
        abas={ABAS}
        atual={aba}
        onChange={(destino) => {
          if (destino !== aba) ir(ROTAS[destino]);
        }}
      >
        <IndicadorHome />
      </Abas>
    </Tela>
  );
}
