import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PERFIL_RAFAEL, apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const logado = () => apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });

describe('Perfil', () => {
  it('mostra nome, celular, CPF mascarado e a versão dos termos aceitos', async () => {
    renderEm('/perfil', logado());
    const tela = await screen.findByRole('main', { name: 'Perfil' });
    expect(within(tela).getAllByText('Rafael Souza').length).toBeGreaterThan(0);
    expect(tela.textContent).toContain('(61) 90000-0001');
    expect(tela.textContent).toContain('***.***.***-62');
    expect(tela.textContent).toContain('provisoria-2026-10');
  });

  it('nunca mostra o CPF completo, nem só os dígitos', async () => {
    renderEm('/perfil', logado());
    const tela = await screen.findByRole('main', { name: 'Perfil' });
    expect(tela.textContent).not.toContain('12345678062');
    expect(tela.textContent).not.toContain('123.456.780-62');
    expect(tela.textContent).not.toContain('123456');
  });

  it('diz, sem alarde, que os dados são só de leitura', async () => {
    renderEm('/perfil', logado());
    expect(await screen.findByText(/só podem ser consultados aqui/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('abre e fecha os termos de uso provisórios', async () => {
    renderEm('/perfil', logado());
    const botao = await screen.findByRole('button', { name: 'Termos de uso (provisórios)' });
    expect(screen.queryByRole('region', { name: 'Termos de uso provisórios' })).toBeNull();
    fireEvent.click(botao);
    expect(screen.getByRole('region', { name: 'Termos de uso provisórios' }).textContent).toContain(
      'Texto provisório',
    );
    fireEvent.click(botao);
    expect(screen.queryByRole('region', { name: 'Termos de uso provisórios' })).toBeNull();
  });

  it('a barra de abas marca "Perfil"', async () => {
    renderEm('/perfil', logado());
    const barra = await screen.findByRole('navigation', { name: 'Navegação do Cliente' });
    expect(within(barra).getByRole('button', { name: 'Perfil' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('"Sair" encerra a sessão e volta às Boas-vindas', async () => {
    const api = logado();
    renderEm('/perfil', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: /Carro parou\? Respira/ })).toBeTruthy();
    expect(api.sair).toHaveBeenCalledTimes(1);
    expect(await api.temSessao()).toBe(false);
  });

  it('depois de sair, abrir o app de novo mostra as Boas-vindas, não o Início', async () => {
    const api = logado();
    renderEm('/perfil', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    await screen.findByRole('heading', { name: /Carro parou\? Respira/ });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Olá, Rafael' })).toBeNull());
  });

  it('se não consegue sair, avisa e continua no Perfil', async () => {
    const api = logado();
    api.sair.mockRejectedValueOnce(new Error('rede'));
    renderEm('/perfil', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível sair/);
    expect(screen.getByRole('main', { name: 'Perfil' })).toBeTruthy();
  });

  it('sem sessão, o Perfil manda entrar', async () => {
    renderEm('/perfil', apiFalsa());
    expect(await screen.findByRole('main', { name: 'Celular' })).toBeTruthy();
  });
});
