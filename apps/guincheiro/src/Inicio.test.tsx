import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Inicio } from './Inicio';

afterEach(cleanup);

function abrir(config: { supabaseUrl?: string; supabaseAnonKey?: string }) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Inicio {...config} />
    </MemoryRouter>,
  );
}

describe('Abertura do app do Guincheiro', () => {
  it('sem as variáveis do Supabase, mostra o aviso de configuração', () => {
    abrir({});
    const aviso = screen.getByRole('main', { name: 'Sem configuração' });
    expect(aviso.textContent).toContain('App sem configuração do servidor');
    expect(aviso.textContent).toContain('VITE_SUPABASE_URL');
    expect(aviso.textContent).toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('com só uma das variáveis, também mostra o aviso', () => {
    abrir({ supabaseUrl: 'http://127.0.0.1:54321', supabaseAnonKey: '' });
    expect(screen.getByRole('main', { name: 'Sem configuração' })).toBeTruthy();
  });

  it('com as variáveis e sem sessão, pede o celular', async () => {
    abrir({ supabaseUrl: 'http://127.0.0.1:54321', supabaseAnonKey: 'chave-de-teste' });
    expect(await screen.findByLabelText('Celular com DDD')).toBeTruthy();
  });
});
