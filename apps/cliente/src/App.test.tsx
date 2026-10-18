import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { PERFIL_RAFAEL, apiFalsa } from './teste/apiFalsa';
import { renderEm as renderComApi } from './teste/renderizar';

afterEach(cleanup);

let navegar: NavigateFunction;
function Navegador() {
  const ir = useNavigate();
  useEffect(() => {
    navegar = ir;
  }, [ir]);
  return null;
}

/** O Rafael logado; sem VITE_MAPBOX_TOKEN, a tela de local usa o mapa do protótipo. */
function renderEm(rota: string) {
  return renderComApi(rota, apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL }), <Navegador />);
}

describe('App cliente', () => {
  it('"Pedir" a partir do Histórico começa um Pedido sem as respostas anteriores', async () => {
    renderEm('/pedido/1');
    fireEvent.click(await screen.findByRole('button', { name: 'Carro de passeio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Parou e não liga' }));
    fireEvent.click(screen.getByRole('button', { name: 'Não sei' }));
    act(() => void navegar('/historico'));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir' }));
    const carro = screen.getByRole('button', { name: 'Carro de passeio' });
    expect(carro.getAttribute('aria-pressed')).toBe('false');
  });
});
