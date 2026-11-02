import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PERFIL_RAFAEL, apiFalsa, detalheDoPedido, resumoDoPedido } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const logado = (corridas = [] as ReturnType<typeof resumoDoPedido>[]) =>
  apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL, corridas });

describe('Início', () => {
  it('cumprimenta pelo primeiro nome e oferece "Pedir guincho"', async () => {
    renderEm('/inicio', logado());
    expect(await screen.findByRole('heading', { name: 'Olá, Rafael' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pedir guincho' })).toBeTruthy();
  });

  it('mostra o resumo "como funciona" com o preço fechado e o guincho verificado', async () => {
    renderEm('/inicio', logado());
    const resumo = await screen.findByRole('region', { name: 'Como funciona' });
    expect(resumo.textContent).toContain('Preço fechado antes de pagar');
    expect(resumo.textContent).toContain('Guincho verificado');
  });

  it('"Pedir guincho" abre a primeira pergunta do Pedido', async () => {
    renderEm('/inicio', logado());
    fireEvent.click(await screen.findByRole('button', { name: 'Pedir guincho' }));
    expect(
      await screen.findByRole('heading', { name: 'Oi, Rafael. Qual veículo precisa de reboque?' }),
    ).toBeTruthy();
    // O fluxo do Pedido não mostra a barra de abas.
    expect(screen.queryByRole('navigation', { name: 'Navegação do Cliente' })).toBeNull();
  });

  it('sem nenhuma Corrida, mostra o estado vazio e nenhum cartão', async () => {
    renderEm('/inicio', logado());
    expect(await screen.findByText(/ainda não pediu nenhum guincho/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Seu guincho/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Avalie a corrida/ })).toBeNull();
  });

  it('enquanto carrega as Corridas, avisa e já deixa pedir', async () => {
    const api = logado();
    api.listarMinhasCorridas.mockReturnValue(new Promise(() => {}));
    renderEm('/inicio', api);
    expect(await screen.findByText('Carregando suas Corridas…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pedir guincho' })).toBeTruthy();
  });

  it('se as Corridas não carregam, avisa e deixa tentar de novo', async () => {
    const api = logado();
    api.listarMinhasCorridas.mockRejectedValueOnce(new Error('rede'));
    renderEm('/inicio', api);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível carregar/);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText(/ainda não pediu nenhum guincho/)).toBeTruthy();
    expect(api.listarMinhasCorridas).toHaveBeenCalledTimes(2);
  });

  describe('com Pedido ativo', () => {
    it.each([
      ['em_match', 'Procurando guincho'],
      ['aguardando_aprovacao_preco', 'Aguardando sua resposta'],
      ['aceita', 'Guincheiro aceitou'],
      ['a_caminho', 'Guincho a caminho'],
      ['carregado', 'Veículo carregado'],
    ] as const)('em %s mostra o cartão "Seu guincho" com "%s"', async (etapa, estado) => {
      renderEm(
        '/inicio',
        logado([resumoDoPedido({ etapa, pedidoId: 'pedido-ativo', corridaId: null })]),
      );
      const cartao = await screen.findByRole('button', { name: /Seu guincho/ });
      expect(within(cartao).getByText(estado)).toBeTruthy();
    });

    it('tocar no cartão abre o acompanhamento daquele Pedido', async () => {
      const api = logado([
        resumoDoPedido({ etapa: 'a_caminho', pedidoId: 'pedido-ativo', corridaId: 'c-1' }),
      ]);
      api.buscarAcompanhamento.mockResolvedValue({
        pedidoId: 'pedido-ativo',
        etapa: 'a_caminho',
        precoTotal: 23500,
        origemEndereco: 'Eixo Monumental, Brasília',
        destinoEndereco: 'QNA 12, Taguatinga Norte',
        recotacao: null,
        corrida: {
          id: 'c-1',
          estado: 'a_caminho',
          guincheiro: { nome: 'Wagner Lopes', frota: 'Reboque Planalto' },
        },
      });
      renderEm('/inicio', api);
      fireEvent.click(await screen.findByRole('button', { name: /Seu guincho/ }));
      expect(await screen.findByRole('heading', { name: 'Guincho a caminho' })).toBeTruthy();
      expect(api.buscarAcompanhamento).toHaveBeenCalledWith('pedido-ativo');
    });

    it('Pedido entregue ou estornado não vira "Seu guincho"', async () => {
      renderEm(
        '/inicio',
        logado([
          resumoDoPedido({ pedidoId: 'p-2', etapa: 'estornado', corridaId: null }),
          resumoDoPedido({ pedidoId: 'p-1', etapa: 'entregue', nota: 5 }),
        ]),
      );
      await screen.findByRole('heading', { name: 'Olá, Rafael' });
      await screen.findByRole('region', { name: 'Como funciona' });
      expect(screen.queryByRole('button', { name: /Seu guincho/ })).toBeNull();
    });
  });

  describe('com avaliação pendente', () => {
    it('a última Corrida entregue sem nota mostra "Avalie a corrida"', async () => {
      renderEm('/inicio', logado([resumoDoPedido({ pedidoId: 'pedido-9' })]));
      const cartao = await screen.findByRole('button', { name: /Avalie a corrida/ });
      expect(within(cartao).getByText('Como foi o atendimento?')).toBeTruthy();
    });

    it('tocar no cartão abre a avaliação daquela Corrida', async () => {
      const api = logado([resumoDoPedido({ pedidoId: 'pedido-9' })]);
      api.buscarDetalheDoPedido.mockResolvedValue(detalheDoPedido({ pedidoId: 'pedido-9' }));
      renderEm('/inicio', api);
      fireEvent.click(await screen.findByRole('button', { name: /Avalie a corrida/ }));
      expect(await screen.findByRole('heading', { name: 'Como foi o atendimento?' })).toBeTruthy();
    });

    it('se a última entregue já foi avaliada, não pede de novo', async () => {
      renderEm('/inicio', logado([resumoDoPedido({ nota: 4 })]));
      await screen.findByRole('region', { name: 'Como funciona' });
      expect(screen.queryByRole('button', { name: /Avalie a corrida/ })).toBeNull();
    });

    it('mostra os dois cartões juntos: o ativo primeiro, depois a avaliação', async () => {
      renderEm(
        '/inicio',
        logado([
          resumoDoPedido({ pedidoId: 'novo', etapa: 'em_match', corridaId: null }),
          resumoDoPedido({ pedidoId: 'velho' }),
        ]),
      );
      const cartoes = await screen.findAllByRole('button', {
        name: /Seu guincho|Avalie a corrida/,
      });
      expect(cartoes.map((c) => c.textContent)).toEqual([
        expect.stringContaining('Seu guincho'),
        expect.stringContaining('Avalie a corrida'),
      ]);
    });
  });

  describe('navegação', () => {
    it('mostra a barra com Início, Corridas e Perfil e marca a aba atual', async () => {
      renderEm('/inicio', logado());
      const barra = await screen.findByRole('navigation', { name: 'Navegação do Cliente' });
      const abas = within(barra).getAllByRole('button');
      expect(abas.map((a) => a.textContent)).toEqual(['Início', 'Corridas', 'Perfil']);
      expect(
        within(barra).getByRole('button', { name: 'Início' }).getAttribute('aria-current'),
      ).toBe('page');
    });

    it('as abas levam a Corridas e a Perfil, e de volta ao Início', async () => {
      renderEm('/inicio', logado());
      const barra = await screen.findByRole('navigation', { name: 'Navegação do Cliente' });
      fireEvent.click(within(barra).getByRole('button', { name: 'Corridas' }));
      expect(await screen.findByRole('heading', { name: 'Suas Corridas' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
      expect(await screen.findByRole('main', { name: 'Perfil' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Início' }));
      expect(await screen.findByRole('heading', { name: 'Olá, Rafael' })).toBeTruthy();
    });

    it('sem sessão, o Início manda entrar', async () => {
      renderEm('/inicio', apiFalsa());
      expect(await screen.findByRole('main', { name: 'Celular' })).toBeTruthy();
    });
  });
});
