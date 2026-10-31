import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi, type PedidoAguardandoAprovacao } from '@guinchei/api';
import { formatarReais } from '@guinchei/ui';
import { apiFalsa } from './teste/apiFalsa';
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
