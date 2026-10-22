import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const semPerfil = () => apiFalsa({ sessao: true });

async function preencher({
  nome = 'Ana Lima',
  cpf = '52998224725',
  cep = '70040010',
  aceitar = true,
} = {}) {
  fireEvent.change(await screen.findByLabelText('Nome completo'), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText('CPF'), { target: { value: cpf } });
  fireEvent.change(screen.getByLabelText('CEP'), { target: { value: cep } });
  if (aceitar) fireEvent.click(screen.getByRole('checkbox', { name: /Li e aceito os termos/ }));
}

const continuar = () => screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement;

describe('Cadastro emergencial', () => {
  it('mostra o celular do login como informação, não como campo', async () => {
    renderEm('/cadastro', semPerfil());
    expect((await screen.findByText('(61) 90000-0006')).tagName).toBe('STRONG');
    expect(screen.queryByLabelText(/Celular/)).toBeNull();
  });

  it('grava nome, CPF e CEP sem máscara e a versão dos termos, e segue para o Pedido', async () => {
    const api = semPerfil();
    renderEm('/cadastro', api);
    await preencher();
    expect(screen.getByLabelText<HTMLInputElement>('CPF').value).toBe('529.982.247-25');
    expect(screen.getByLabelText<HTMLInputElement>('CEP').value).toBe('70040-010');
    fireEvent.click(continuar());

    expect(
      await screen.findByRole('heading', { name: 'Oi, Ana. Qual veículo precisa de reboque?' }),
    ).toBeTruthy();
    expect(api.criarPerfilUrgente).toHaveBeenCalledWith({
      nome: 'Ana Lima',
      cpf: '52998224725',
      cep: '70040010',
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

  it.each(['11111111', '00000000'])('recusa o CEP %s (dígitos iguais) sem enviar', async (cep) => {
    const api = semPerfil();
    renderEm('/cadastro', api);
    await preencher({ cep });
    fireEvent.click(continuar());

    expect((await screen.findByRole('alert')).textContent).toMatch(/CEP inválido/);
    expect(api.criarPerfilUrgente).not.toHaveBeenCalled();
  });

  it('sem os 8 dígitos do CEP não continua; aceita CEP de fora do DF', async () => {
    const api = semPerfil();
    renderEm('/cadastro', api);
    await preencher({ cep: '7004001' });
    expect(continuar().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '01310-100' } });
    expect(continuar().disabled).toBe(false);
    fireEvent.click(continuar());
    await screen.findByRole('heading', { name: /Qual veículo precisa de reboque/ });
    expect(api.criarPerfilUrgente).toHaveBeenCalledWith(
      expect.objectContaining({ cep: '01310100' }),
    );
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
