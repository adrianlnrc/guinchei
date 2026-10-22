import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi } from '@guinchei/api';
import { PERFIL_RAFAEL, apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const logado = (parcial: Partial<typeof PERFIL_RAFAEL> = {}) =>
  apiFalsa({ sessao: true, perfil: { ...PERFIL_RAFAEL, ...parcial } });

const campo = (nome: string) => screen.getByLabelText<HTMLInputElement>(nome);
const salvar = () => screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement;

describe('Meu cadastro', () => {
  it('mostra o que veio do cadastro emergencial; CPF e celular são só leitura', async () => {
    renderEm('/meu-cadastro', logado({ cep: '70040010', email: 'rafael@exemplo.com' }));
    await screen.findByRole('heading', { name: 'Meu cadastro' });

    expect(campo('Nome completo').value).toBe('Rafael Souza');
    expect(campo('CPF').value).toBe('123.456.780-62');
    expect(campo('CPF').readOnly).toBe(true);
    expect(campo('Celular').value).toBe('(61) 90000-0001');
    expect(campo('Celular').readOnly).toBe(true);
    expect(campo('CEP').value).toBe('70040-010');
    expect(campo('E-mail (opcional)').value).toBe('rafael@exemplo.com');
  });

  it('perfil anterior ao CEP abre com o campo vazio e não deixa salvar sem ele', async () => {
    renderEm('/meu-cadastro', logado());
    await screen.findByRole('heading', { name: 'Meu cadastro' });
    expect(campo('CEP').value).toBe('');
    expect(salvar().disabled).toBe(true);
    fireEvent.change(campo('CEP'), { target: { value: '70040010' } });
    expect(salvar().disabled).toBe(false);
  });

  it('salva nome, CEP e e-mail, avisa e volta ao início', async () => {
    const api = logado({ cep: '70040010' });
    renderEm('/meu-cadastro', api);
    await screen.findByRole('heading', { name: 'Meu cadastro' });
    fireEvent.change(campo('Nome completo'), { target: { value: 'Rafael S. Souza' } });
    fireEvent.change(campo('CEP'), { target: { value: '72000-000' } });
    fireEvent.change(campo('E-mail (opcional)'), { target: { value: ' rafael@exemplo.com ' } });
    fireEvent.click(salvar());

    expect(
      await screen.findByRole('heading', { name: 'Oi, Rafael. Qual veículo precisa de reboque?' }),
    ).toBeTruthy();
    expect(api.atualizarMeuCadastro).toHaveBeenCalledWith({
      nome: 'Rafael S. Souza',
      cep: '72000000',
      email: 'rafael@exemplo.com',
    });
    expect(screen.getByText('Cadastro salvo.')).toBeTruthy();
  });

  it('e-mail em branco é opcional', async () => {
    const api = logado({ cep: '70040010', email: 'velho@exemplo.com' });
    renderEm('/meu-cadastro', api);
    await screen.findByRole('heading', { name: 'Meu cadastro' });
    fireEvent.change(campo('E-mail (opcional)'), { target: { value: '' } });
    fireEvent.click(salvar());
    await screen.findByRole('heading', { name: /Qual veículo precisa de reboque/ });
    expect(api.atualizarMeuCadastro).toHaveBeenCalledWith(expect.objectContaining({ email: '' }));
  });

  it('recusa e-mail de formato inválido e CEP de dígitos iguais sem enviar', async () => {
    const api = logado({ cep: '70040010' });
    renderEm('/meu-cadastro', api);
    await screen.findByRole('heading', { name: 'Meu cadastro' });

    fireEvent.change(campo('E-mail (opcional)'), { target: { value: 'sem-arroba' } });
    fireEvent.click(salvar());
    expect((await screen.findByRole('alert')).textContent).toMatch(/E-mail inválido/);

    fireEvent.change(campo('E-mail (opcional)'), { target: { value: '' } });
    fireEvent.change(campo('CEP'), { target: { value: '11111111' } });
    fireEvent.click(salvar());
    expect((await screen.findByRole('alert')).textContent).toMatch(/CEP inválido/);
    expect(api.atualizarMeuCadastro).not.toHaveBeenCalled();
  });

  it('mostra o erro do servidor e mantém o que foi digitado', async () => {
    const api = logado({ cep: '70040010' });
    api.atualizarMeuCadastro.mockRejectedValueOnce(new ErroApi('falha', 'x'));
    renderEm('/meu-cadastro', api);
    await screen.findByRole('heading', { name: 'Meu cadastro' });
    fireEvent.change(campo('Nome completo'), { target: { value: 'Outro Nome' } });
    fireEvent.click(salvar());
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível salvar/);
    expect(campo('Nome completo').value).toBe('Outro Nome');
    expect(salvar().disabled).toBe(false);
  });

  it('é aberto pelo início do Pedido e o Voltar leva de volta', async () => {
    renderEm('/pedido/1', logado());
    fireEvent.click(await screen.findByRole('button', { name: 'Meu cadastro' }));
    await screen.findByRole('heading', { name: 'Meu cadastro' });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(
      await screen.findByRole('heading', { name: /Qual veículo precisa de reboque/ }),
    ).toBeTruthy();
  });

  it('sem sessão, manda entrar com o celular', async () => {
    renderEm('/meu-cadastro', apiFalsa());
    expect(await screen.findByRole('heading', { name: 'Qual é o seu celular?' })).toBeTruthy();
  });
});
