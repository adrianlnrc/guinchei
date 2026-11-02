import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PERFIL_RAFAEL, apiFalsa, detalheDoPedido, resumoDoPedido } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const NOVA = resumoDoPedido({
  pedidoId: 'pedido-2',
  etapa: 'a_caminho',
  criadoEm: '2026-10-25T15:00:00Z',
  precoTotal: 31250,
  corridaId: 'corrida-2',
});
const ENTREGUE_AVALIADA = resumoDoPedido({ pedidoId: 'pedido-1', nota: 4 });
const ENTREGUE_SEM_NOTA = resumoDoPedido({
  pedidoId: 'pedido-0',
  criadoEm: '2026-10-10T12:00:00Z',
  origemEndereco: 'Asa Sul',
  destinoEndereco: 'Guará II',
  precoTotal: 18000,
});

describe('Corridas', () => {
  it('lista as Corridas na ordem recebida, com data, trecho, valor, estado e nota', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_RAFAEL,
      corridas: [NOVA, ENTREGUE_AVALIADA, ENTREGUE_SEM_NOTA],
    });
    renderEm('/corridas', api);
    const cartoes = await screen.findAllByRole('button', { name: /→/ });
    expect(cartoes).toHaveLength(3);

    const [nova, avaliada, semNota] = cartoes as [HTMLElement, HTMLElement, HTMLElement];
    expect(nova.textContent).toContain('25/10/2026 · 12:00');
    expect(nova.textContent).toContain('Guincho a caminho');
    expect(nova.textContent).toContain('R$ 312,50');

    expect(avaliada.textContent).toContain('Eixo Monumental, Brasília → QNA 12, Taguatinga Norte');
    expect(avaliada.textContent).toContain('Entregue');
    expect(avaliada.textContent).toContain('R$ 235,00');
    expect(within(avaliada).getByRole('img', { name: 'Nota 4 de 5' })).toBeTruthy();

    expect(semNota.textContent).toContain('Asa Sul → Guará II');
    expect(semNota.textContent).toContain('Sem avaliação');
    expect(within(semNota).queryByRole('img')).toBeNull();
  });

  it('sem Corridas, mostra o estado vazio com o convite a pedir', async () => {
    renderEm('/corridas', apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL }));
    expect(await screen.findByText(/Nenhuma Corrida ainda/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir guincho' }));
    expect(
      await screen.findByRole('heading', { name: 'Oi, Rafael. Qual veículo precisa de reboque?' }),
    ).toBeTruthy();
  });

  it('avisa enquanto carrega e quando falha, e tenta de novo', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL, corridas: [ENTREGUE_AVALIADA] });
    api.listarMinhasCorridas.mockRejectedValueOnce(new Error('rede'));
    renderEm('/corridas', api);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível carregar/);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('button', { name: /→/ })).toBeTruthy();
  });

  it('a barra de abas marca "Corridas"', async () => {
    renderEm('/corridas', apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL }));
    const barra = await screen.findByRole('navigation', { name: 'Navegação do Cliente' });
    expect(
      within(barra).getByRole('button', { name: 'Corridas' }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('o endereço antigo /historico leva às Corridas', async () => {
    renderEm('/historico', apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL }));
    expect(await screen.findByRole('heading', { name: 'Suas Corridas' })).toBeTruthy();
  });

  it('tocar numa Corrida abre o detalhe', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_RAFAEL,
      corridas: [ENTREGUE_AVALIADA],
      detalhes: { 'pedido-1': detalheDoPedido() },
    });
    renderEm('/corridas', api);
    fireEvent.click(await screen.findByRole('button', { name: /→/ }));
    expect(await screen.findByRole('heading', { name: 'Entregue' })).toBeTruthy();
    expect(api.buscarDetalheDoPedido).toHaveBeenCalledWith('pedido-1');
  });
});

describe('Detalhe da Corrida', () => {
  function abrir(detalhe = detalheDoPedido()) {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_RAFAEL,
      detalhes: { [detalhe.pedidoId]: detalhe },
    });
    renderEm(`/corridas/${detalhe.pedidoId}`, api);
    return api;
  }

  it('decompõe o preço como o banco guarda e mostra o total', async () => {
    abrir();
    const preco = await screen.findByRole('region', { name: 'Preço' });
    expect(within(preco).getByText('Taxa base').nextSibling?.textContent).toBe('R$ 110,00');
    expect(within(preco).getByText('Do guincho até o veículo').nextSibling?.textContent).toBe(
      'R$ 19,35',
    );
    expect(within(preco).getByText('Reboque').nextSibling?.textContent).toBe('R$ 75,00');
    expect(within(preco).getByText('Adicional noturno').nextSibling?.textContent).toBe('R$ 30,65');
    expect(preco.textContent).toContain('TotalR$ 235,00');
    // Adicional que não se aplicou não aparece.
    expect(within(preco).queryByText('Adicional de feriado')).toBeNull();
    expect(within(preco).queryByText('Ajuste ao preço mínimo')).toBeNull();
    expect(preco.textContent).toContain('3,9 km do guincho até o veículo');
    expect(preco.textContent).toContain('12,5 km rebocados');
  });

  it('mostra o Guincheiro e a Frota', async () => {
    abrir();
    const guincheiro = await screen.findByRole('region', { name: 'Guincheiro' });
    expect(guincheiro.textContent).toContain('Wagner Lopes');
    expect(guincheiro.textContent).toContain('Reboque Planalto');
  });

  it('mostra a linha do tempo com abertura, aceite e entrega', async () => {
    abrir();
    const tempo = await screen.findByRole('list', { name: 'Linha do tempo da Corrida' });
    const itens = within(tempo).getAllByRole('listitem');
    expect(itens.map((i) => i.textContent)).toEqual([
      'Pedido aberto20/10/2026 · 14:30',
      'Guincheiro aceitou20/10/2026 · 14:35',
      'Entregue20/10/2026 · 15:40',
    ]);
  });

  it('sem avaliação, convida a avaliar a Corrida entregue', async () => {
    abrir();
    const avaliacao = await screen.findByRole('region', { name: 'Sua avaliação' });
    expect(avaliacao.textContent).toContain('Você ainda não avaliou');
    fireEvent.click(within(avaliacao).getByRole('button', { name: 'Avaliar atendimento' }));
    expect(await screen.findByRole('heading', { name: 'Como foi o atendimento?' })).toBeTruthy();
  });

  it('com avaliação, mostra nota e comentário só para leitura', async () => {
    abrir(
      detalheDoPedido({
        avaliacao: {
          corridaId: 'corrida-1',
          nota: 5,
          comentario: 'Chegou rápido e cuidou do carro.',
          criadoEm: '2026-10-20T19:00:00Z',
        },
      }),
    );
    const avaliacao = await screen.findByRole('region', { name: 'Sua avaliação' });
    expect(within(avaliacao).getByRole('img', { name: 'Nota 5 de 5' })).toBeTruthy();
    expect(avaliacao.textContent).toContain('Chegou rápido e cuidou do carro.');
    expect(avaliacao.textContent).toContain('não podem ser editadas');
    expect(within(avaliacao).queryByRole('button')).toBeNull();
  });

  it('Pedido em andamento tem "Acompanhar" e não pede avaliação', async () => {
    const api = abrir(
      detalheDoPedido({
        pedidoId: 'pedido-2',
        etapa: 'a_caminho',
        corrida: {
          id: 'corrida-2',
          estado: 'a_caminho',
          aceitaEm: '2026-10-25T15:05:00Z',
          atualizadaEm: '2026-10-25T15:10:00Z',
          guincheiro: { nome: 'Wagner Lopes', frota: 'Reboque Planalto' },
        },
      }),
    );
    api.buscarAcompanhamento.mockResolvedValue({
      pedidoId: 'pedido-2',
      etapa: 'a_caminho',
      precoTotal: 23500,
      origemEndereco: 'Eixo Monumental, Brasília',
      destinoEndereco: 'QNA 12, Taguatinga Norte',
      recotacao: null,
      corrida: { id: 'corrida-2', estado: 'a_caminho', guincheiro: null },
    });
    expect(await screen.findByRole('list', { name: 'Linha do tempo da Corrida' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Sua avaliação' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Acompanhar' }));
    expect(await screen.findByRole('heading', { name: 'Guincho a caminho' })).toBeTruthy();
  });

  it('Pedido estornado mostra o estorno na linha do tempo, sem Guincheiro', async () => {
    abrir(detalheDoPedido({ pedidoId: 'pedido-3', etapa: 'estornado', corrida: null }));
    const tempo = await screen.findByRole('list', { name: 'Linha do tempo da Corrida' });
    expect(tempo.textContent).toContain('Pagamento estornado');
    expect(screen.queryByRole('region', { name: 'Guincheiro' })).toBeNull();
  });

  it('Pedido que não é do Cliente avisa que não foi encontrado', async () => {
    renderEm('/corridas/outro-pedido', apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL }));
    expect(await screen.findByText('Não encontramos esta Corrida.')).toBeTruthy();
  });

  it('se a leitura falha, avisa e deixa tentar de novo', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_RAFAEL,
      detalhes: { 'pedido-1': detalheDoPedido() },
    });
    api.buscarDetalheDoPedido.mockRejectedValueOnce(new Error('rede'));
    renderEm('/corridas/pedido-1', api);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível carregar/);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Entregue' })).toBeTruthy();
  });

  it('"Voltar às Corridas" volta à lista', async () => {
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Voltar às Corridas' }));
    expect(await screen.findByRole('heading', { name: 'Suas Corridas' })).toBeTruthy();
  });
});
