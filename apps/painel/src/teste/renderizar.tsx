import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiPainel } from '@guinchei/api';
import { App } from '../App';

/** Abre o Painel numa rota, com a API dada. */
export function renderEm(rota: string, api: ApiPainel) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App api={api} />
    </MemoryRouter>,
  );
}
