import { createContext, useContext } from 'react';
import type { ApiPainel } from '@guinchei/api';

// O app recebe a API pronta (o Inicio cria a real; os testes passam uma falsa).
export const ApiContexto = createContext<ApiPainel | null>(null);

export function useApi(): ApiPainel {
  const api = useContext(ApiContexto);
  if (!api) throw new Error('useApi fora do ApiContexto');
  return api;
}
