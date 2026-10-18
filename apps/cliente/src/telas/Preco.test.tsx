import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi, type CotacaoPedido } from '@guinchei/api';
import { formatarReais, partesReais } from '@guinchei/ui';
import { COTACAO_DO_SERVIDOR, PERFIL_RAFAEL, apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

/**
 * Abre o Pedido pelas três perguntas e passa pela tela de local (sem VITE_MAPBOX_TOKEN, o
 * mapa do protótipo) até o Preço fechado. A API dublada faz o papel do servidor.
 */
async function abrirPreco(api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL })) {
  renderEm('/pedido/1', api);
  fireEvent.click(await screen.findByRole('button', { name: 'Carro de passeio' }));
  fireEvent.click(screen.getByRole('button', { name: 'Parou e não liga' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sim' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar local no mapa' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ver preço fechado' }));
  await screen.findByRole('main', { name: 'Preço fechado' });
  return api;
}

const confirmar = () => screen.getByRole('button', { name: 'Confirmar e pagar' });

describe('Preço fechado', () => {
  it('mostra o Preço fechado e a decomposição que o servidor calculou para o Pedido', async () => {
    const api = await abrirPreco();

    const { preco } = COTACAO_DO_SERVIDOR;
    expect(await screen.findByText(partesReais(preco.total).inteiro)).toBeTruthy();
    expect(api.cotarPedido).toHaveBeenCalledWith('pedido-novo');
    expect(screen.getByText(partesReais(preco.total).centavos)).toBeTruthy();
    expect(screen.getByText('Deslocamento até você · 3,9 km')).toBeTruthy();
    expect(screen.getByText('Reboque · 12,5 km')).toBeTruthy();
    expect(screen.getByText('Adicional noturno · 15%')).toBeTruthy();
    for (const parcela of [preco.taxaBase, preco.deslocamento, preco.reboque]) {
      expect(screen.getByText(formatarReais(parcela))).toBeTruthy();
    }
    expect(screen.getByText(formatarReais(preco.adicionalNoturno))).toBeTruthy();
    expect(screen.queryByText(/Adicional feriado/)).toBeNull();
    expect(screen.queryByText(/Preço fechado mínimo/)).toBeNull();
    expect(screen.getByText(/Guincho mais próximo a 3,9 km/)).toBeTruthy();
    expect((confirmar() as HTMLButtonElement).disabled).toBe(false);
  });

  it('abaixo do piso, mostra a linha de ajuste para o Preço fechado mínimo', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    const curta: CotacaoPedido = {
      ...COTACAO_DO_SERVIDOR,
      kmAteVeiculo: 1,
      kmRebocado: 2,
      preco: {
        taxaBase: 11000,
        deslocamento: 500,
        reboque: 1200,
        adicionalNoturno: 0,
        adicionalFeriado: 0,
        ajustePiso: 5300,
        total: 18000,
      },
    };
    api.cotarPedido.mockResolvedValueOnce(curta);
    await abrirPreco(api);

    expect(await screen.findByText('Ajuste para o Preço fechado mínimo')).toBeTruthy();
    expect(screen.getByText(formatarReais(5300))).toBeTruthy();
    expect(screen.getByText(partesReais(18000).inteiro)).toBeTruthy();
  });

  it('enquanto o servidor calcula, não deixa confirmar', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    api.cotarPedido.mockReturnValueOnce(new Promise(() => {}));
    await abrirPreco(api);

    expect(screen.getByText('Calculando o preço fechado…')).toBeTruthy();
    expect((confirmar() as HTMLButtonElement).disabled).toBe(true);
  });

  it('sem Guincheiro disponível, diz isso e deixa tentar de novo', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    api.cotarPedido.mockRejectedValueOnce(
      new ErroApi('sem_guincheiro', 'Nenhum guincho disponível agora'),
    );
    await abrirPreco(api);

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Nenhum guincho disponível agora',
    );
    expect((confirmar() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(
      await screen.findByText(partesReais(COTACAO_DO_SERVIDOR.preco.total).inteiro),
    ).toBeTruthy();
    expect(api.cotarPedido).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('falha de rede: avisa e deixa tentar de novo', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    api.cotarPedido.mockRejectedValueOnce(new ErroApi('falha', 'Failed to fetch'));
    await abrirPreco(api);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não foi possível calcular o preço. Verifique a conexão e tente de novo.',
    );
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  });

  it('sem trajeto gravado (mapa indisponível), pede para marcar origem e destino', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    api.cotarPedido.mockRejectedValueOnce(
      new ErroApi('sem_trajeto', 'Marque origem e destino antes de ver o preço'),
    );
    await abrirPreco(api);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Marque origem e destino antes de ver o preço',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao mapa' }));
    expect(await screen.findByRole('main', { name: 'Origem e destino' })).toBeTruthy();
  });

  it('sem Pedido aberto, volta às perguntas', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    renderEm('/preco', api);
    expect(await screen.findByRole('button', { name: 'Carro de passeio' })).toBeTruthy();
    expect(api.cotarPedido).not.toHaveBeenCalled();
  });
});

describe('Pagamento', () => {
  async function abrirPagamento(api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL })) {
    await abrirPreco(api);
    await screen.findByText(partesReais(COTACAO_DO_SERVIDOR.preco.total).inteiro);
    fireEvent.click(confirmar());
    await screen.findByRole('main', { name: 'Pagamento' });
    return api;
  }

  it('mostra o Preço fechado cotado e confirma com Pix; segue para a Corrida', async () => {
    const api = await abrirPagamento();
    expect(screen.getByText(formatarReais(COTACAO_DO_SERVIDOR.preco.total))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código Pix' }));

    await waitFor(() => expect(api.confirmarPedido).toHaveBeenCalledWith('pedido-novo', 'pix'));
    expect(await screen.findByRole('main', { name: 'Procurando guincho' })).toBeTruthy();
  });

  it('confirma com cartão', async () => {
    const api = await abrirPagamento();
    fireEvent.click(screen.getByRole('button', { name: 'Cartão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pagar com cartão' }));

    await waitFor(() => expect(api.confirmarPedido).toHaveBeenCalledWith('pedido-novo', 'cartao'));
    expect(await screen.findByRole('main', { name: 'Procurando guincho' })).toBeTruthy();
  });

  it('pagamento recusado: avisa, fica no pagamento e deixa tentar de novo', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    api.confirmarPedido.mockRejectedValueOnce(
      new ErroApi('pagamento_recusado', 'Pagamento recusado. Tente de novo ou use outro meio.'),
    );
    await abrirPagamento(api);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código Pix' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Pagamento recusado. Tente de novo ou use outro meio.',
    );
    expect(screen.getByRole('main', { name: 'Pagamento' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Copiar código Pix' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('falha de rede: avisa e fica no pagamento', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    api.confirmarPedido.mockRejectedValueOnce(new ErroApi('falha', 'Failed to fetch'));
    await abrirPagamento(api);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código Pix' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não foi possível confirmar o pagamento. Verifique a conexão e tente de novo.',
    );
    expect(screen.getByRole('main', { name: 'Pagamento' })).toBeTruthy();
  });

  it('sem cotação, volta ao Preço fechado', async () => {
    renderEm('/pagamento', apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL }));
    expect(await screen.findByRole('button', { name: 'Carro de passeio' })).toBeTruthy();
  });
});
