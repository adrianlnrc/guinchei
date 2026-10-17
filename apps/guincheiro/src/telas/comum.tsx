import { useNavigate } from 'react-router-dom';
import { Abas, IndicadorHome } from '@guinchei/ui';

export function AbasGuincheiro({
  atual,
  escura,
}: {
  atual: 'plantao' | 'corridas';
  escura?: boolean;
}) {
  const ir = useNavigate();
  return (
    <Abas
      escura={escura}
      abas={[
        { valor: 'plantao', rotulo: 'Plantão' },
        { valor: 'corridas', rotulo: 'Corridas' },
        { valor: 'conta', rotulo: 'Conta', emBreve: true },
      ]}
      atual={atual}
      onChange={(aba) => {
        if (aba === 'plantao') ir('/');
        if (aba === 'corridas') ir('/corridas');
      }}
    >
      <IndicadorHome />
    </Abas>
  );
}

export const somaRepasses = (lista: { valor: number }[]) => lista.reduce((s, c) => s + c.valor, 0);
