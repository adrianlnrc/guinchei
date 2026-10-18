import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi } from '@guinchei/api';
import { formatarReais } from '@guinchei/ui';
import { COTACAO_DO_SERVIDOR, PERFIL_RAFAEL, acompanhamentoEm, apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

/** O Rafael reabre o app com um Pedido em andamento na etapa dada. */
async function abrirEm(etapa: Parameters<typeof acompanhamentoEm>[0]) {
  const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
  api.buscarAcompanhamentoEmAndamento.mockResolvedValue(acompanhamentoEm(etapa));
  api.buscarAcompanhamento.mockResolvedValue(acompanhamentoEm(etapa));
  renderEm('/acompanhamento', api);
  await screen.findByRole('heading', { level: 1 });
  return api;
}

const titulo = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('Acompanhamento do Pedido', () => {
  it.each([
    ['em_match', 'Chamando o guincho mais próximo'],
    ['aceita', 'Guincheiro aceitou, saindo em instantes'],
    ['a_caminho', 'Guincho a caminho'],
    ['no_local', 'O guincho chegou ao seu veículo'],
    ['carregado', 'Veículo carregado, a caminho do destino'],
    ['entregue', 'Entregue. Seu veículo chegou ao destino.'],
  ] as const)('na etapa %s mostra "%s"', async (etapa, esperado) => {
    await abrirEm(etapa);
    expect(titulo()).toBe(esperado);
  });

  it('do aceite em diante mostra só o nome do Guincheiro e a Frota dele', async () => {
    await abrirEm('aceita');
    expect(screen.getByText('Wagner Lopes')).toBeTruthy();
    expect(screen.getByText('Reboque Planalto')).toBeTruthy();
  });

  it('a linha do tempo marca a etapa atual', async () => {
    await abrirEm('no_local');
    const atual = screen.getByRole('listitem', { current: 'step' });
    expect(atual.textContent).toContain('No local');
  });

  it('mostra o Preço fechado travado enquanto procura o guincho', async () => {
    await abrirEm('em_match');
    expect(document.body.textContent).toContain(
      `travado em ${formatarReais(COTACAO_DO_SERVIDOR.preco.total)}`,
    );
  });

  it('muda de etapa sozinha quando o Realtime avisa, sem recarregar', async () => {
    const api = await abrirEm('em_match');
    expect(api.acompanharPedido).toHaveBeenCalledWith('pedido-novo', expect.any(Function));

    act(() => api.emitir(acompanhamentoEm('aceita')));
    expect(titulo()).toBe('Guincheiro aceitou, saindo em instantes');
    act(() => api.emitir(acompanhamentoEm('a_caminho')));
    expect(titulo()).toBe('Guincho a caminho');
    act(() => api.emitir(acompanhamentoEm('no_local')));
    expect(titulo()).toBe('O guincho chegou ao seu veículo');
    act(() => api.emitir(acompanhamentoEm('carregado')));
    expect(titulo()).toBe('Veículo carregado, a caminho do destino');
    act(() => api.emitir(acompanhamentoEm('entregue')));
    expect(titulo()).toBe('Entregue. Seu veículo chegou ao destino.');
    // Depois da leitura inicial, só o Realtime atualiza: nenhuma leitura extra.
    expect(api.buscarAcompanhamentoEmAndamento).toHaveBeenCalledTimes(1);
    expect(api.buscarAcompanhamento).not.toHaveBeenCalled();
  });

  it('cancela a assinatura do Realtime ao sair da tela', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    api.buscarAcompanhamentoEmAndamento.mockResolvedValue(acompanhamentoEm('em_match'));
    const { unmount } = renderEm('/acompanhamento', api);
    await screen.findByRole('heading', { level: 1 });
    expect(api.assinaturasAbertas()).toBe(1);
    unmount();
    expect(api.assinaturasAbertas()).toBe(0);
  });

  it('o cancelamento do Pedido ainda não existe: aparece desabilitado, "em breve"', async () => {
    await abrirEm('a_caminho');
    const cancelar = screen.getByRole('button', { name: /Cancelar Pedido/ }) as HTMLButtonElement;
    expect(cancelar.disabled).toBe(true);
    expect(cancelar.textContent).toContain('em breve');
  });

  describe('sem_guincheiro', () => {
    it('oferece tentar de novo e estornar o pagamento', async () => {
      await abrirEm('sem_guincheiro');
      expect(titulo()).toBe('Nenhum Guincheiro aceitou');
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Estornar o pagamento' })).toBeTruthy();
    });

    it('"Tentar de novo" pede outra rodada e volta a procurar o guincho', async () => {
      const api = await abrirEm('sem_guincheiro');
      api.buscarAcompanhamento.mockResolvedValue(acompanhamentoEm('em_match'));

      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      await waitFor(() => expect(api.tentarDeNovo).toHaveBeenCalledWith('pedido-novo'));
      await waitFor(() => expect(titulo()).toBe('Chamando o guincho mais próximo'));
    });

    it('"Estornar o pagamento" mostra o estorno e leva a um novo Pedido', async () => {
      const api = await abrirEm('sem_guincheiro');
      api.buscarAcompanhamento.mockResolvedValue(acompanhamentoEm('estornado'));

      fireEvent.click(screen.getByRole('button', { name: 'Estornar o pagamento' }));

      await waitFor(() => expect(api.estornarPedido).toHaveBeenCalledWith('pedido-novo'));
      await waitFor(() => expect(titulo()).toBe('Pagamento estornado'));
      expect(document.body.textContent).toContain(
        `${formatarReais(COTACAO_DO_SERVIDOR.preco.total)} voltam`,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Fazer novo Pedido' }));
      expect(await screen.findByRole('button', { name: 'Carro de passeio' })).toBeTruthy();
    });

    it('mostra o erro e deixa tentar outra vez quando a ação falha', async () => {
      const api = await abrirEm('sem_guincheiro');
      api.tentarDeNovo.mockRejectedValueOnce(
        new ErroApi('pedido_indisponivel', 'O Pedido não está aguardando um Guincheiro'),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect((await screen.findByRole('alert')).textContent).toBe(
        'O Pedido não está aguardando um Guincheiro',
      );
      expect(titulo()).toBe('Nenhum Guincheiro aceitou');
    });
  });

  it('um Pedido estornado mostra o desfecho, sem botões do Match', async () => {
    await abrirEm('estornado');
    expect(titulo()).toBe('Pagamento estornado');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Fazer novo Pedido' })).toBeTruthy();
  });

  it('um Pedido entregue deixa fazer outro', async () => {
    await abrirEm('entregue');
    fireEvent.click(screen.getByRole('button', { name: 'Fazer novo Pedido' }));
    expect(await screen.findByRole('button', { name: 'Carro de passeio' })).toBeTruthy();
  });

  describe('ao reabrir o app', () => {
    it('recupera o Pedido mais recente em andamento, na etapa em que ele está', async () => {
      const api = await abrirEm('a_caminho');
      expect(api.buscarAcompanhamentoEmAndamento).toHaveBeenCalledTimes(1);
      expect(titulo()).toBe('Guincho a caminho');
      expect(api.acompanharPedido).toHaveBeenCalledWith('pedido-novo', expect.any(Function));
    });

    it('sem Pedido em andamento, volta ao início do Pedido', async () => {
      const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
      renderEm('/acompanhamento', api);
      expect(await screen.findByRole('button', { name: 'Carro de passeio' })).toBeTruthy();
      expect(api.acompanharPedido).not.toHaveBeenCalled();
    });

    it('sem sessão, manda entrar', async () => {
      renderEm('/acompanhamento', apiFalsa());
      expect(await screen.findByRole('main', { name: 'Celular' })).toBeTruthy();
    });
  });

  it('avisa quando não consegue ler o acompanhamento', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    api.buscarAcompanhamentoEmAndamento.mockRejectedValue(new ErroApi('falha', 'x'));
    renderEm('/acompanhamento', api);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Não foi possível carregar o acompanhamento',
    );
  });
});
