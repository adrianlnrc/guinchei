import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiGuincheiro } from '@guinchei/api';
import { App } from '../App';

/** Abre o app do Guincheiro numa rota, com a API dada. */
export function renderEm(rota: string, api: ApiGuincheiro) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App api={api} />
    </MemoryRouter>,
  );
}
