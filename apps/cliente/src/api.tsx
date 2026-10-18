import { createContext, useContext } from 'react';
import type { ApiGuinchei } from '@guinchei/api';

// O app recebe a API pronta (main.tsx cria a real; os testes passam uma falsa).
export const ApiContexto = createContext<ApiGuinchei | null>(null);

export function useApi(): ApiGuinchei {
  const api = useContext(ApiContexto);
  if (!api) throw new Error('useApi fora do ApiContexto');
  return api;
}
