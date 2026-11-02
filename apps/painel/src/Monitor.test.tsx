import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, type PedidoAguardandoAprovacao } from '@guinchei/api';
import { formatarReais } from '@guinchei/ui';
import { apiFalsa, corridaDoMonitor } from './teste/apiFalsa';
import { renderEm } from './teste/renderizar';

afterEach(cleanup);

const AGUARDANDO: PedidoAguardandoAprovacao = {
  pedidoId: 'abcdef12-0000-4000-8000-000000000001',
  precoAnterior: 25915,
  precoNovo: 28610,
  expiraEm: '2026-10-22T18:02:00Z',
  origemEndereco: 'Eixo Monumental, Brasília',
  destinoEndereco: 'QNA 12, Taguatinga Norte',
};

describe('Monitor de Corridas: Pedido aguardando aprovação do novo preço (ADR-0013)', () => {
  it('mostra o Pedido com o preço anterior e o novo, o trecho e o prazo', async () => {
    const api = apiFalsa({ sessao: true, aguardandoAprovacao: [AGUARDANDO] });
    renderEm('/monitor', api);

    const linha = await screen.findByRole('row', {
      name: 'Pedido abcdef12 aguardando aprovação do novo preço',
    });
    const texto = linha.textContent ?? '';
    expect(texto).toContain('Aguardando aprovação do Cliente');
    expect(texto).toContain(`Preço anterior ${formatarReais(25915)}`);
    expect(texto).toContain(`novo preço ${formatarReais(28610)}`);
    expect(texto).toContain('Eixo Monumental, Brasília → QNA 12, Taguatinga Norte');
    // Brasília é UTC-3.
    expect(texto).toContain('até 15:02');
    expect(
      within(screen.getByRole('main')).getByText(/1 aguardando aprovação de novo preço/),
    ).toBeTruthy();
  });

  it('sem Pedido pausado, não há linha de aprovação e o resumo conta zero', async () => {
    const api = apiFalsa({ sessao: true });
    renderEm('/monitor', api);

    await waitFor(() => expect(api.listarPedidosAguardandoAprovacao).toHaveBeenCalled());
    expect(screen.queryByRole('row', { name: /aguardando aprovação do novo preço/ })).toBeNull();
    expect(await screen.findByText(/0 aguardando aprovação de novo preço/)).toBeTruthy();
  });

  it('se a leitura falha, o Monitor continua de pé sem a linha', async () => {
    const api = apiFalsa({ sessao: true });
    api.listarPedidosAguardandoAprovacao.mockRejectedValue(
      new ErroApi('falha', 'Não foi possível ler os Pedidos aguardando aprovação'),
    );
    renderEm('/monitor', api);

    expect(
      await screen.findByText('Monitor de Corridas', { selector: '.topo__titulo' }),
    ).toBeTruthy();
    expect(screen.queryByRole('row', { name: /aguardando aprovação do novo preço/ })).toBeNull();
  });
});

describe('Monitor de Corridas: dados reais', () => {
  it('lista os Pedidos com trecho, estado, Guincheiro, Frota e minutos', async () => {
    const api = apiFalsa({
      sessao: true,
      corridasDoMonitor: [
        corridaDoMonitor('aaaa1111', { estado: 'em_match', minutos: 2 }),
        corridaDoMonitor('bbbb2222', {
          estado: 'a_caminho',
          guincheiro: 'Marcos Alves',
          frota: 'Reboque Planalto',
          minutos: 6,
          origemEndereco: 'Asa Norte',
          destinoEndereco: 'SIA',
        }),
        corridaDoMonitor('cccc3333', { estado: 'carregado', guincheiro: 'Ana', frota: null }),
        corridaDoMonitor('dddd4444', { estado: 'sem_guincheiro', minutos: 9 }),
      ],
    });
    renderEm('/monitor', api);

    const linha = await screen.findByRole('row', { name: 'Pedido bbbb2222' });
    const texto = linha.textContent ?? '';
    expect(texto).toContain('Asa Norte → SIA');
    expect(texto).toContain('Marcos Alves · Reboque Planalto');
    expect(texto).toContain('A caminho');
    expect(texto).toContain('6 min');
    expect(
      within(screen.getByRole('row', { name: 'Pedido aaaa1111' })).getByText(
        'Procurando Guincheiro',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('row', { name: 'Pedido cccc3333' }).textContent).toContain('Carregado');
    expect(screen.getByRole('row', { name: 'Pedido dddd4444' }).textContent).toContain(
      'Sem Guincheiro',
    );
    // O Pedido sem Guincheiro mais antigo ganha o destaque no mapa.
    expect(screen.getByText('#dddd4444 · sem Guincheiro 9 min')).toBeTruthy();
    // Sem rótulo de exemplo: tudo isso vem do banco.
    expect(screen.queryByText(/de exemplo/)).toBeNull();
  });

  it('mostra os indicadores reais, com a nota média das avaliações dos Clientes', async () => {
    const api = apiFalsa({
      sessao: true,
      indicadores: {
        corridasEmCurso: 3,
        guincheirosDisponiveis: 7,
        atendidosRapido: { atendidos: 5, total: 8 },
        notaMedia: { media: 4.63, total: 12 },
      },
    });
    renderEm('/monitor', api);

    expect(await screen.findByText('63%')).toBeTruthy();
    expect(screen.getByText('5 de 8 Corridas aceitas hoje')).toBeTruthy();
    const cartao = (rotulo: string) => screen.getByText(rotulo).closest('div') as HTMLElement;
    expect(within(cartao('Corridas em curso')).getByText('3')).toBeTruthy();
    expect(within(cartao('Guincheiros disponíveis')).getByText('7')).toBeTruthy();
    const nota = cartao('Nota média · 7 dias');
    expect(within(nota).getByText('4,6')).toBeTruthy();
    expect(within(nota).getByText('12 avaliações de Clientes em 7 dias')).toBeTruthy();
  });

  it('sem nenhuma avaliação nos últimos 7 dias, a nota média mostra "—"', async () => {
    renderEm('/monitor', apiFalsa({ sessao: true }));

    await screen.findByText('Nenhuma Corrida aceita hoje');
    const nota = screen.getByText('Nota média · 7 dias').closest('div') as HTMLElement;
    expect(within(nota).getByText('—')).toBeTruthy();
    expect(within(nota).getByText('Nenhuma avaliação nos últimos 7 dias')).toBeTruthy();
  });

  it('sem Corrida aceita hoje, o indicador de 30 min mostra "—"', async () => {
    renderEm('/monitor', apiFalsa({ sessao: true }));

    expect(await screen.findByText('Nenhuma Corrida aceita hoje')).toBeTruthy();
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it('lista vazia: avisa que não há Pedido em andamento e zera o resumo', async () => {
    renderEm('/monitor', apiFalsa({ sessao: true }));

    expect(await screen.findByText('Nenhum Pedido em andamento nas últimas 24 h.')).toBeTruthy();
    expect(
      screen.getByText('0 Pedidos procurando Guincheiro · 0 sem Guincheiro, aguardando o Cliente'),
    ).toBeTruthy();
  });

  it('relê a cada 5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const api = apiFalsa({ sessao: true });
      renderEm('/monitor', api);
      await waitFor(() => expect(api.listarCorridasDoMonitor).toHaveBeenCalledTimes(1));

      api.listarCorridasDoMonitor.mockResolvedValue([corridaDoMonitor('eeee5555')]);
      await vi.advanceTimersByTimeAsync(5_000);

      expect(await screen.findByRole('row', { name: 'Pedido eeee5555' })).toBeTruthy();
      expect(api.listarCorridasDoMonitor.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('se a leitura falha, avisa e o Monitor continua de pé', async () => {
    const api = apiFalsa({ sessao: true });
    api.listarCorridasDoMonitor.mockRejectedValue(
      new ErroApi('falha', 'Não foi possível ler as Corridas do Monitor'),
    );
    renderEm('/monitor', api);

    expect(await screen.findByText(/Não foi possível atualizar/)).toBeTruthy();
    expect(screen.queryByText('Nenhum Pedido em andamento nas últimas 24 h.')).toBeNull();
  });
});
