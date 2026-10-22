import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi } from '@guinchei/api';
import { ApiContexto } from '../api';
import { PlantaoProvider } from '../plantao';
import { ROTA_DADOS_PESSOAIS, ROTA_DOCUMENTOS } from '../rotas';
import { CODIGO_CERTO, PERFIL_RAFAEL, apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';
import { DadosPessoais } from './DadosPessoais';

afterEach(cleanup);

const CPF = '52998224725';
const CONVITE = { frotaNome: 'Reboque Planalto' };

const tocar = (nome: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nome }));
const preencher = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const tela = (nome: string) => screen.findByRole('main', { name: nome });

/** A tela do primeiro acesso com a rota de documentos do #47 simulada, para ver para onde segue. */
function renderPrimeiroAcesso(api: ReturnType<typeof apiFalsa>) {
  return render(
    <MemoryRouter initialEntries={[ROTA_DADOS_PESSOAIS]}>
      <ApiContexto.Provider value={api}>
        <PlantaoProvider>
          <Routes>
            <Route path={ROTA_DADOS_PESSOAIS} element={<DadosPessoais />} />
            <Route path={ROTA_DOCUMENTOS} element={<main aria-label="Documentos" />} />
          </Routes>
        </PlantaoProvider>
      </ApiContexto.Provider>
    </MemoryRouter>,
  );
}

const convidado = (extra: Parameters<typeof apiFalsa>[0] = {}) =>
  apiFalsa({ sessao: true, perfil: null, convite: CONVITE, ...extra });

describe('Entrada do Guincheiro convidado', () => {
  it('o número convidado, depois do código, abre os dados pessoais (não o cadastro de Frota)', async () => {
    const api = apiFalsa({ perfil: null, convite: CONVITE });
    renderEm('/', api);
    fireEvent.change(await screen.findByLabelText('Celular com DDD'), {
      target: { value: '(61) 90000-0046' },
    });
    tocar('Receber código');
    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), {
      target: { value: CODIGO_CERTO },
    });
    tocar('Confirmar');

    expect(await tela('Dados pessoais')).toBeTruthy();
    expect(await screen.findByText(/A Frota Reboque Planalto convidou você/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Como você atende?' })).toBeNull();
    expect(api.sair).not.toHaveBeenCalled();
  });

  it('o número sem convite continua indo ao cadastro de Frota', async () => {
    const api = apiFalsa({ perfil: null });
    renderEm('/', api);
    fireEvent.change(await screen.findByLabelText('Celular com DDD'), {
      target: { value: '(61) 90000-0008' },
    });
    tocar('Receber código');
    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), {
      target: { value: CODIGO_CERTO },
    });
    tocar('Confirmar');

    expect(await screen.findByRole('heading', { name: 'Como você atende?' })).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'Dados pessoais' })).toBeNull();
  });

  it('o número de Cliente continua recebendo o aviso de não cadastrado', async () => {
    const api = apiFalsa({ perfil: PERFIL_RAFAEL, convite: CONVITE });
    renderEm('/', api);
    fireEvent.change(await screen.findByLabelText('Celular com DDD'), {
      target: { value: '(61) 90000-0001' },
    });
    tocar('Receber código');
    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), {
      target: { value: CODIGO_CERTO },
    });
    tocar('Confirmar');

    expect(
      await screen.findByText('Este número não está cadastrado como Guincheiro.'),
    ).toBeTruthy();
    expect(api.sair).toHaveBeenCalled();
  });

  it('com a sessão guardada, qualquer rota de Guincheiro leva ao primeiro acesso do convidado', async () => {
    renderEm('/corrida', convidado());
    expect(await tela('Dados pessoais')).toBeTruthy();
  });

  it('o convite que venceu ou foi cancelado leva ao cadastro de Frota, não aos dados pessoais', async () => {
    renderEm('/guincheiro/dados', apiFalsa({ sessao: true, perfil: null, convite: null }));
    expect(await screen.findByRole('heading', { name: 'Como você atende?' })).toBeTruthy();
  });
});

describe('Dados pessoais do convidado', () => {
  it('só libera o botão com nome, CPF e o aceite dos termos', async () => {
    renderPrimeiroAcesso(convidado());
    await tela('Dados pessoais');
    const continuar = screen.getByRole<HTMLButtonElement>('button', { name: 'Continuar' });
    expect(continuar.disabled).toBe(true);

    preencher('Nome completo', 'Carla Dias');
    preencher('CPF', '529.982.247-25');
    expect(continuar.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Li e aceito os termos de uso.'));
    expect(continuar.disabled).toBe(false);
  });

  it('mostra os termos de uso quando a pessoa quer ler', async () => {
    renderPrimeiroAcesso(convidado());
    await tela('Dados pessoais');
    expect(screen.queryByLabelText('Termos de uso', { selector: 'section' })).toBeNull();
    tocar('Ler os termos de uso');
    expect(screen.getByLabelText('Termos de uso', { selector: 'section' })).toBeTruthy();
    tocar('Esconder os termos de uso');
    expect(screen.queryByLabelText('Termos de uso', { selector: 'section' })).toBeNull();
  });

  it('CPF inválido é recusado na tela, sem chamar o servidor', async () => {
    const api = convidado();
    renderPrimeiroAcesso(api);
    await tela('Dados pessoais');
    preencher('Nome completo', 'Carla Dias');
    preencher('CPF', '52998224724');
    fireEvent.click(screen.getByLabelText('Li e aceito os termos de uso.'));
    tocar('Continuar');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'CPF inválido. Confira os números.',
    );
    expect(api.aceitarConvite).not.toHaveBeenCalled();
  });

  it('conclui o primeiro acesso e segue para a etapa de documentos', async () => {
    const api = convidado();
    renderPrimeiroAcesso(api);
    await tela('Dados pessoais');
    preencher('Nome completo', '  Carla Dias ');
    preencher('CPF', CPF);
    fireEvent.click(screen.getByLabelText('Li e aceito os termos de uso.'));
    tocar('Continuar');

    expect(await tela('Documentos')).toBeTruthy();
    expect(api.aceitarConvite).toHaveBeenCalledWith({
      nome: 'Carla Dias',
      cpf: CPF,
      termosVersao: 'provisoria-2026-10',
    });
    // A conta nasceu: Guincheiro da Frota que convidou, fora do plantão.
    expect(await api.buscarMeuGuincheiro()).toEqual({
      nome: 'Carla Dias',
      frota: 'Reboque Planalto',
      disponivel: false,
    });
  });

  it('CPF de outra conta e convite vencido têm mensagem clara e deixam tentar de novo', async () => {
    const api = convidado();
    api.aceitarConvite.mockRejectedValueOnce(
      new ErroApi('cpf_ja_cadastrado', 'CPF já cadastrado em outra conta'),
    );
    renderPrimeiroAcesso(api);
    await tela('Dados pessoais');
    preencher('Nome completo', 'Carla Dias');
    preencher('CPF', CPF);
    fireEvent.click(screen.getByLabelText('Li e aceito os termos de uso.'));
    tocar('Continuar');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Este CPF já está cadastrado em outra conta.',
    );

    api.aceitarConvite.mockRejectedValueOnce(
      new ErroApi('convite_vencido', 'O convite venceu. Peça à sua Frota que o convide de novo.'),
    );
    tocar('Continuar');
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'O convite venceu. Peça à sua Frota que o convide de novo.',
      ),
    );

    api.aceitarConvite.mockRejectedValueOnce(new ErroApi('falha', 'detalhe técnico'));
    tocar('Continuar');
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Não foi possível concluir. Tente de novo.',
      ),
    );
  });

  it('quem desiste sai da sessão e volta para a entrada', async () => {
    const api = convidado();
    renderEm('/guincheiro/dados', api);
    await tela('Dados pessoais');
    tocar('Sair');
    expect(await screen.findByLabelText('Celular com DDD')).toBeTruthy();
    expect(api.sair).toHaveBeenCalled();
  });
});
