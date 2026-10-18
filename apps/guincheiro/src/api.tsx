import { createContext, useContext } from 'react';
import type { ApiGuincheiro } from '@guinchei/api';

// O app recebe a API pronta (o Inicio cria a real; os testes passam uma falsa).
export const ApiContexto = createContext<ApiGuincheiro | null>(null);

export function useApi(): ApiGuincheiro {
  const api = useContext(ApiContexto);
  if (!api) throw new Error('useApi fora do ApiContexto');
  return api;
}
