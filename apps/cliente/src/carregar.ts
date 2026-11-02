import { useCallback, useEffect, useState } from 'react';

type Estado<T> = { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'pronto'; dados: T };

/**
 * Carrega dados do banco ao abrir a tela. `carregar` precisa ter identidade estável
 * (`useCallback`): quando ela muda, a leitura recomeça. `recarregar` volta ao "carregando".
 */
export function useCarregar<T>(carregar: () => Promise<T>) {
  const [estado, setEstado] = useState<Estado<T>>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vigente = true;
    carregar().then(
      (dados) => {
        if (vigente) setEstado({ tipo: 'pronto', dados });
      },
      () => {
        if (vigente) setEstado({ tipo: 'erro' });
      },
    );
    return () => {
      vigente = false;
    };
  }, [carregar, tentativa]);

  const recarregar = useCallback(() => {
    setEstado({ tipo: 'carregando' });
    setTentativa((n) => n + 1);
  }, []);

  return { estado, recarregar };
}
