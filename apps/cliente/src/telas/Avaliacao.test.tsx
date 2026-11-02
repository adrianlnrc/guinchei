import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi } from '@guinchei/api';
import { PERFIL_RAFAEL, apiFalsa, detalheDoPedido } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const ROTA = '/corridas/pedido-1/avaliar';

function abrir(detalhe = detalheDoPedido()) {
  const api = apiFalsa({
    sessao: true,
    perfil: PERFIL_RAFAEL,
    detalhes: { [detalhe.pedidoId]: detalhe },
    corridas: [],
  });
  renderEm(ROTA, api);
  return api;
}

const estrela = (n: number) =>
  screen.findByRole('radio', { name: n === 1 ? '1 estrela' : `${n} estrelas` });
const enviar = () => screen.getByRole('button', { name: 'Enviar avaliação' }) as HTMLButtonElement;

describe('Avaliação da Corrida', () => {
  it('pergunta "Como foi o atendimento?" com o nome do Guincheiro e cinco estrelas', async () => {
    abrir();
    expect(await screen.findByRole('heading', { name: 'Como foi o atendimento?' })).toBeTruthy();
    expect(screen.getByText(/Wagner Lopes/)).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    // Fim do fluxo: sem a barra de abas.
    expect(screen.queryByRole('navigation', { name: 'Navegação do Cliente' })).toBeNull();
  });

  it('só habilita "Enviar avaliação" depois de escolher a nota', async () => {
    abrir();
    await estrela(1);
    expect(enviar().disabled).toBe(true);
    fireEvent.click(await estrela(4));
    expect(enviar().disabled).toBe(false);
  });

  it('as estrelas são um grupo de rádios acessível, com a nota anunciada', async () => {
    abrir();
    const grupo = await screen.findByRole('group', { name: /Nota do atendimento/ });
    const radios = within(grupo).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      '1 estrela',
      '2 estrelas',
      '3 estrelas',
      '4 estrelas',
      '5 estrelas',
    ]);
    // Todos no mesmo grupo: o teclado troca a nota com as setas.
    expect(new Set(radios.map((r) => r.getAttribute('name'))).size).toBe(1);
    fireEvent.click(radios[4]!);
    expect((radios[4] as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Excelente')).toBeTruthy();
  });

  it('envia a nota e o comentário, avisa o agradecimento e volta ao Início', async () => {
    const api = abrir();
    fireEvent.click(await estrela(5));
    fireEvent.change(screen.getByLabelText(/Comentário/), {
      target: { value: 'Chegou rápido e cuidou do carro.' },
    });
    fireEvent.click(enviar());

    expect(await screen.findByRole('heading', { name: 'Olá, Rafael' })).toBeTruthy();
    expect(api.avaliarCorrida).toHaveBeenCalledWith(
      'corrida-1',
      5,
      'Chegou rápido e cuidou do carro.',
    );
    expect(await screen.findByText('Obrigado! Sua avaliação foi enviada.')).toBeTruthy();
  });

  it('o comentário é opcional', async () => {
    const api = abrir();
    fireEvent.click(await estrela(3));
    fireEvent.click(enviar());
    await screen.findByRole('heading', { name: 'Olá, Rafael' });
    expect(api.avaliarCorrida).toHaveBeenCalledWith('corrida-1', 3, '');
  });

  it('limita o comentário a 280 caracteres e mostra o contador', async () => {
    abrir();
    const campo = (await screen.findByLabelText(/Comentário/)) as HTMLTextAreaElement;
    expect(campo.maxLength).toBe(280);
    fireEvent.change(campo, { target: { value: 'abc' } });
    expect(screen.getByLabelText('3 de 280 caracteres')).toBeTruthy();
  });

  it('"Agora não" volta ao Início sem enviar nada', async () => {
    const api = abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }));
    expect(await screen.findByRole('heading', { name: 'Olá, Rafael' })).toBeTruthy();
    expect(api.avaliarCorrida).not.toHaveBeenCalled();
  });

  it('se o envio falha, avisa, mantém a nota e deixa tentar de novo', async () => {
    const api = abrir();
    api.avaliarCorrida.mockRejectedValueOnce(
      new ErroApi('falha', 'Não foi possível enviar a avaliação'),
    );
    fireEvent.click(await estrela(2));
    fireEvent.click(enviar());

    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível enviar/);
    expect(((await estrela(2)) as HTMLInputElement).checked).toBe(true);
    expect(enviar().disabled).toBe(false);

    fireEvent.click(enviar());
    expect(await screen.findByRole('heading', { name: 'Olá, Rafael' })).toBeTruthy();
    expect(api.avaliarCorrida).toHaveBeenCalledTimes(2);
  });

  it('mostra a mensagem do servidor quando ela é conhecida', async () => {
    const api = abrir();
    api.avaliarCorrida.mockRejectedValueOnce(
      new ErroApi(
        'avaliacao_invalida',
        'A nota vai de 1 a 5 e o comentário tem até 280 caracteres',
      ),
    );
    fireEvent.click(await estrela(2));
    fireEvent.click(enviar());
    expect((await screen.findByRole('alert')).textContent).toMatch(/A nota vai de 1 a 5/);
  });

  it('Corrida já avaliada aparece só para leitura, sem estrelas para trocar', async () => {
    const api = abrir(
      detalheDoPedido({
        avaliacao: {
          corridaId: 'corrida-1',
          nota: 4,
          comentario: 'Bom atendimento.',
          criadoEm: '2026-10-20T19:00:00Z',
        },
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Sua avaliação' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Nota 4 de 5' })).toBeTruthy();
    expect(screen.getByText('Bom atendimento.')).toBeTruthy();
    expect(screen.getByText(/não podem ser editadas/)).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enviar avaliação' })).toBeNull();
    expect(api.avaliarCorrida).not.toHaveBeenCalled();
  });

  it('se outra tela já avaliou no meio, mostra a avaliação gravada', async () => {
    const api = abrir();
    fireEvent.click(await estrela(1));
    // A avaliação chega ao banco por outro caminho; o envio desta tela é recusado.
    await api.avaliarCorrida('corrida-1', 5, 'Enviada em outro aparelho');
    fireEvent.click(enviar());

    expect(await screen.findByRole('heading', { name: 'Sua avaliação' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Nota 5 de 5' })).toBeTruthy();
    expect(screen.getByText('Enviada em outro aparelho')).toBeTruthy();
  });

  it('Corrida ainda não entregue não pode ser avaliada', async () => {
    abrir(
      detalheDoPedido({
        etapa: 'a_caminho',
        corrida: {
          id: 'corrida-1',
          estado: 'a_caminho',
          aceitaEm: '2026-10-20T17:35:00Z',
          atualizadaEm: '2026-10-20T17:40:00Z',
          guincheiro: { nome: 'Wagner Lopes', frota: 'Reboque Planalto' },
        },
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Ainda não dá para avaliar' })).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao Início' }));
    expect(await screen.findByRole('heading', { name: 'Olá, Rafael' })).toBeTruthy();
  });

  it('Pedido que não é do Cliente avisa que não foi encontrado', async () => {
    renderEm('/corridas/outro/avaliar', apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL }));
    expect(await screen.findByText('Não encontramos esta Corrida.')).toBeTruthy();
  });

  it('se a Corrida não carrega, avisa e deixa tentar de novo', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_RAFAEL,
      detalhes: { 'pedido-1': detalheDoPedido() },
    });
    api.buscarDetalheDoPedido.mockRejectedValueOnce(new Error('rede'));
    renderEm(ROTA, api);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível carregar/);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Como foi o atendimento?' })).toBeTruthy(),
    );
  });

  it('sem sessão, manda entrar', async () => {
    renderEm(ROTA, apiFalsa());
    expect(await screen.findByRole('main', { name: 'Celular' })).toBeTruthy();
  });
});
