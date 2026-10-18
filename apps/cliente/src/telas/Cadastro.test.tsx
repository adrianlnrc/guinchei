import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const semPerfil = () => apiFalsa({ sessao: true });

async function preencher({ nome = 'Ana Lima', cpf = '52998224725', aceitar = true } = {}) {
  fireEvent.change(await screen.findByLabelText('Nome completo'), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText('CPF'), { target: { value: cpf } });
  if (aceitar) fireEvent.click(screen.getByRole('checkbox', { name: /Li e aceito os termos/ }));
}

const continuar = () => screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement;

describe('Cadastro urgente', () => {
  it('grava nome, CPF sem máscara e a versão dos termos, e segue para o Pedido', async () => {
    const api = semPerfil();
    renderEm('/cadastro', api);
    await preencher();
    expect(screen.getByLabelText<HTMLInputElement>('CPF').value).toBe('529.982.247-25');
    fireEvent.click(continuar());

    expect(
      await screen.findByRole('heading', { name: 'Oi, Ana. Qual veículo precisa de reboque?' }),
    ).toBeTruthy();
    expect(api.criarPerfilUrgente).toHaveBeenCalledWith({
      nome: 'Ana Lima',
      cpf: '52998224725',
      termosVersao: 'provisoria-2026-10',
    });
  });

  it('recusa CPF com dígito verificador errado sem enviar', async () => {
    const api = semPerfil();
    renderEm('/cadastro', api);
    await preencher({ cpf: '52998224724' });
    fireEvent.click(continuar());

    expect((await screen.findByRole('alert')).textContent).toMatch(/CPF inválido/);
    expect(api.criarPerfilUrgente).not.toHaveBeenCalled();
  });

  it('sem aceitar os termos de uso não continua', async () => {
    renderEm('/cadastro', semPerfil());
    await preencher({ aceitar: false });
    expect(continuar().disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Li e aceito os termos/ }));
    expect(continuar().disabled).toBe(false);
  });

  it('mostra os termos de uso marcados como provisórios', async () => {
    renderEm('/cadastro', semPerfil());
    fireEvent.click(await screen.findByRole('button', { name: 'Ler os termos de uso' }));
    expect(screen.getByRole('region', { name: 'Termos de uso' }).textContent).toMatch(
      /provisório/i,
    );
  });

  it('avisa quando o CPF já tem conta', async () => {
    renderEm('/cadastro', semPerfil());
    await preencher({ cpf: '12345678062' });
    fireEvent.click(continuar());
    expect((await screen.findByRole('alert')).textContent).toMatch(/já está cadastrado/);
  });

  it('sem sessão, manda entrar com o celular', async () => {
    renderEm('/cadastro', apiFalsa());
    expect(await screen.findByRole('heading', { name: 'Qual é o seu celular?' })).toBeTruthy();
  });
});
