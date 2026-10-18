import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiGuinchei } from '@guinchei/api';
import { App } from '../App';
import type { Mapas } from '../mapas';

/** Abre o app do Cliente numa rota, com a API dada (e, se houver, os mapas). */
export function renderEm(rota: string, api: ApiGuinchei, extra?: ReactNode, mapas?: Mapas) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App api={api} mapas={mapas ?? null} />
      {extra}
    </MemoryRouter>,
  );
}
