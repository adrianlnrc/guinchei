import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiGuinchei } from '@guinchei/api';
import { App } from '../App';

/** Abre o app do Cliente numa rota, com a API dada. */
export function renderEm(rota: string, api: ApiGuinchei, extra?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App api={api} />
      {extra}
    </MemoryRouter>,
  );
}
