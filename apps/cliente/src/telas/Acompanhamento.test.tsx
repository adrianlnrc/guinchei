import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi, type FotoEstado } from '@guinchei/api';
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

  describe('Pedido redirecionado a outra empresa (ADR-0013)', () => {
    const DECOMPOSICAO = {
      taxaBase: 11000,
      ateVeiculo: 4800,
      rebocado: 12810,
      adicionalNoturno: 0,
      adicionalFeriado: 0,
      ajusteMinimo: 0,
    };
    const PENDENTE = {
      estado: 'pendente' as const,
      precoAnterior: 25915,
      precoNovo: 28610,
      decomposicao: DECOMPOSICAO,
      expiraEm: '2026-10-22T18:02:00Z',
    };

    /** O Rafael reabre o app com o Pedido à espera da aprovação do novo preço. */
    async function abrirAguardando() {
      const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
      const aguardando = acompanhamentoEm('aguardando_aprovacao_preco', {
        precoTotal: 25915,
        recotacao: PENDENTE,
      });
      api.buscarAcompanhamentoEmAndamento.mockResolvedValue(aguardando);
      api.buscarAcompanhamento.mockResolvedValue(aguardando);
      renderEm('/acompanhamento', api);
      await screen.findByRole('heading', { level: 1 });
      return api;
    }

    it('mostra "Outra empresa vai atender" com o preço anterior, o novo e a decomposição', async () => {
      await abrirAguardando();
      expect(titulo()).toBe('Outra empresa vai atender');
      const corpo = document.body.textContent ?? '';
      expect(corpo).toContain(`Preço anterior${formatarReais(25915)}`);
      expect(corpo).toContain(`Novo preço${formatarReais(28610)}`);
      expect(corpo).toContain(`Diferença${formatarReais(2695)}`);
      const decomposicao = screen.getByRole('group', { name: 'Decomposição do novo preço' });
      expect(decomposicao.textContent).toContain(`Taxa base${formatarReais(11000)}`);
      expect(decomposicao.textContent).toContain(`Até o veículo${formatarReais(4800)}`);
      expect(decomposicao.textContent).toContain(`Reboque${formatarReais(12810)}`);
      expect(decomposicao.textContent).not.toContain('Adicional noturno');
    });

    it('diz até que horas o Cliente pode responder, no horário de Brasília', async () => {
      await abrirAguardando();
      expect(document.body.textContent).toContain('Responda até as 15:02');
    });

    it('"Aprovar" autoriza o novo preço e o Match volta a procurar', async () => {
      const api = await abrirAguardando();
      api.buscarAcompanhamento.mockResolvedValue(
        acompanhamentoEm('em_match', {
          precoTotal: 28610,
          recotacao: { ...PENDENTE, estado: 'aprovada', expiraEm: null },
        }),
      );

      fireEvent.click(screen.getByRole('button', { name: `Aprovar ${formatarReais(28610)}` }));

      await waitFor(() => expect(api.aprovarNovoPreco).toHaveBeenCalledWith('pedido-novo'));
      await waitFor(() => expect(titulo()).toBe('Chamando o guincho mais próximo'));
      expect(document.body.textContent).toContain(`travado em ${formatarReais(28610)}`);
    });

    it('"Desistir" estorna por inteiro, sem custo, e leva a um novo Pedido', async () => {
      const api = await abrirAguardando();
      api.buscarAcompanhamento.mockResolvedValue(
        acompanhamentoEm('estornado', { precoTotal: 25915 }),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Desistir e estornar' }));

      await waitFor(() => expect(api.desistirDoNovoPreco).toHaveBeenCalledWith('pedido-novo'));
      await waitFor(() => expect(titulo()).toBe('Pagamento estornado'));
      expect(document.body.textContent).toContain(`${formatarReais(25915)} voltam`);
    });

    it('prazo vencido: mostra o erro e relê o Pedido, já estornado', async () => {
      const api = await abrirAguardando();
      api.aprovarNovoPreco.mockRejectedValueOnce(
        new ErroApi('prazo_vencido', 'O prazo para aprovar o novo preço venceu.'),
      );
      api.buscarAcompanhamento.mockResolvedValue(acompanhamentoEm('estornado'));

      fireEvent.click(screen.getByRole('button', { name: `Aprovar ${formatarReais(28610)}` }));

      await waitFor(() => expect(titulo()).toBe('Pagamento estornado'));
      expect(api.buscarAcompanhamento).toHaveBeenCalledWith('pedido-novo');
    });

    it('erro ao aprovar: mostra a mensagem e deixa tentar outra vez', async () => {
      const api = await abrirAguardando();
      api.aprovarNovoPreco.mockRejectedValueOnce(
        new ErroApi('pedido_indisponivel', 'O Pedido não está aguardando a sua aprovação'),
      );

      fireEvent.click(screen.getByRole('button', { name: `Aprovar ${formatarReais(28610)}` }));

      expect((await screen.findByRole('alert')).textContent).toBe(
        'O Pedido não está aguardando a sua aprovação',
      );
      expect(titulo()).toBe('Outra empresa vai atender');
    });

    it('a tela aparece sozinha quando o Realtime avisa que o Match pausou', async () => {
      const api = await abrirEm('em_match');
      act(() =>
        api.emitir(
          acompanhamentoEm('aguardando_aprovacao_preco', {
            precoTotal: 25915,
            recotacao: PENDENTE,
          }),
        ),
      );
      expect(titulo()).toBe('Outra empresa vai atender');
    });

    describe('preço menor ou igual: segue sem pausa', () => {
      const REDUZIDA = {
        estado: 'aplicada' as const,
        precoAnterior: 25915,
        precoNovo: 24000,
        decomposicao: DECOMPOSICAO,
        expiraEm: null,
      };

      it('avisa que outra empresa vai atender, o novo preço e a diferença estornada', async () => {
        const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
        api.buscarAcompanhamentoEmAndamento.mockResolvedValue(
          acompanhamentoEm('em_match', { precoTotal: 24000, recotacao: REDUZIDA }),
        );
        renderEm('/acompanhamento', api);
        await screen.findByRole('heading', { level: 1 });

        expect(titulo()).toBe('Chamando o guincho mais próximo');
        const aviso = screen.getByRole('status');
        expect(aviso.textContent).toContain('Outra empresa vai atender.');
        expect(aviso.textContent).toContain(
          `baixou de ${formatarReais(25915)} para ${formatarReais(24000)}`,
        );
        expect(aviso.textContent).toContain(`${formatarReais(1915)} será estornada`);
        expect(document.body.textContent).toContain(`travado em ${formatarReais(24000)}`);
        expect(screen.queryByRole('button', { name: /Aprovar/ })).toBeNull();
      });

      it('o aviso continua depois que o Guincheiro aceita', async () => {
        await abrirEm('aceita');
        expect(screen.queryByRole('status')).toBeNull();

        const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
        api.buscarAcompanhamentoEmAndamento.mockResolvedValue(
          acompanhamentoEm('aceita', { precoTotal: 24000, recotacao: REDUZIDA }),
        );
        cleanup();
        renderEm('/acompanhamento', api);
        await screen.findByRole('heading', { level: 1 });
        expect(screen.getByRole('status').textContent).toContain('Outra empresa vai atender.');
      });

      it('preço igual: nada a avisar', async () => {
        const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
        api.buscarAcompanhamentoEmAndamento.mockResolvedValue(
          acompanhamentoEm('em_match', {
            recotacao: { ...REDUZIDA, precoNovo: 25915 },
          }),
        );
        renderEm('/acompanhamento', api);
        await screen.findByRole('heading', { level: 1 });
        expect(screen.queryByRole('status')).toBeNull();
      });
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

// ---------------------------------------------------------------------------
// Fotos de estado (ADR-0011, issue #13)
// ---------------------------------------------------------------------------

const AVISO_DAS_FOTOS = 'Registrar fotos protege você se houver reclamação de avaria.';

const PNG = () => new File([new Uint8Array([137, 80, 78, 71])], 'carro.png', { type: 'image/png' });

function escolher(arquivo: File) {
  fireEvent.change(screen.getByLabelText('Escolher foto ou vídeo'), {
    target: { files: [arquivo] },
  });
}

function videosComDuracao(segundos: number) {
  URL.createObjectURL = () => 'blob:teste';
  URL.revokeObjectURL = () => {};
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get: () => segundos,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    set(this: HTMLMediaElement) {
      queueMicrotask(() => this.onloadedmetadata?.(new Event('loadedmetadata')));
    },
  });
}

function foto(
  papelAutor: FotoEstado['papelAutor'],
  etapa: FotoEstado['etapa'],
  n: number,
  criadoEm = '2026-10-18T17:32:00Z',
): FotoEstado {
  return {
    id: `f-${papelAutor}-${etapa}-${n}`,
    corridaId: 'corrida-1',
    papelAutor,
    tipo: 'foto',
    etapa,
    criadoEm,
    latitude: null,
    longitude: null,
    url: `https://armazenamento.teste/${papelAutor}-${etapa}-${n}`,
  };
}

async function abrirComFotos(
  etapa: Parameters<typeof acompanhamentoEm>[0],
  fotos: FotoEstado[] = [],
) {
  const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL, fotos });
  api.buscarAcompanhamentoEmAndamento.mockResolvedValue(acompanhamentoEm(etapa));
  api.buscarAcompanhamento.mockResolvedValue(acompanhamentoEm(etapa));
  renderEm('/acompanhamento', api);
  await screen.findByRole('heading', { level: 1 });
  return api;
}

describe('Fotos de estado do Cliente', () => {
  it.each(['aceita', 'a_caminho', 'no_local', 'carregado', 'entregue'] as const)(
    'na etapa %s o Cliente pode registrar fotos',
    async (etapa) => {
      await abrirComFotos(etapa);
      expect(screen.getByRole('button', { name: 'Registrar fotos' })).toBeTruthy();
    },
  );

  it('enquanto procura o guincho, não há o que registrar', async () => {
    await abrirComFotos('em_match');
    expect(screen.queryByRole('button', { name: 'Registrar fotos' })).toBeNull();
  });

  it.each([
    ['no_local', /chegou/],
    ['entregue', /entrega/],
  ] as const)('em %s sugere registrar, em destaque, com o aviso', async (etapa, assunto) => {
    await abrirComFotos(etapa);
    const sugestao = screen.getByRole('note');
    expect(sugestao.textContent).toContain(AVISO_DAS_FOTOS);
    expect(sugestao.textContent).toMatch(assunto);
  });

  it.each(['aceita', 'a_caminho', 'carregado'] as const)(
    'em %s não há sugestão destacada',
    async (etapa) => {
      await abrirComFotos(etapa);
      expect(screen.queryByRole('note')).toBeNull();
    },
  );

  it('registra uma foto pela câmera, na etapa certa, e a mostra na galeria com autor e hora', async () => {
    const api = await abrirComFotos('no_local');
    expect(screen.getByText('Nenhuma foto registrada ainda.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar fotos' }));
    const campo = screen.getByLabelText('Escolher foto ou vídeo');
    expect(campo.getAttribute('accept')).toBe('image/*,video/*');
    expect(campo.getAttribute('capture')).toBe('environment');
    escolher(PNG());

    expect(await screen.findByAltText(/Foto: Cliente às/)).toBeTruthy();
    expect(api.registrarFotoEstado).toHaveBeenCalledWith('corrida-1', expect.any(File), {
      etapa: 'antes',
    });
  });

  it('em carregado e em entregue a etapa é "depois"', async () => {
    const api = await abrirComFotos('entregue');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar fotos' }));
    escolher(PNG());
    await screen.findByAltText(/Foto: Cliente às/);
    expect(api.registrarFotoEstado.mock.calls[0]?.[2]).toMatchObject({ etapa: 'depois' });
  });

  it('a galeria mostra as fotos dos dois lados, por etapa, com autor e hora', async () => {
    await abrirComFotos('carregado', [
      foto('guincheiro', 'antes', 1),
      foto('cliente', 'antes', 1, '2026-10-18T17:35:00Z'),
      foto('guincheiro', 'depois', 1, '2026-10-18T18:10:00Z'),
    ]);
    const antes = await screen.findByRole('region', { name: 'Antes do carregamento' });
    expect(antes.querySelectorAll('img')).toHaveLength(2);
    expect(antes.textContent).toContain('Guincheiro às');
    expect(antes.textContent).toContain('Cliente às');
    const depois = screen.getByRole('region', { name: 'Carregado e entrega' });
    expect(depois.querySelectorAll('img')).toHaveLength(1);
    expect(depois.textContent).toContain('Guincheiro às');
  });

  it('relê a galeria quando a Corrida muda de etapa, trazendo as fotos do Guincheiro', async () => {
    const api = await abrirComFotos('no_local');
    expect(screen.getByText('Nenhuma foto registrada ainda.')).toBeTruthy();
    api.registrarDoGuincheiro(foto('guincheiro', 'antes', 1));
    act(() => api.emitir(acompanhamentoEm('carregado')));
    expect(await screen.findByAltText(/Foto: Guincheiro às/)).toBeTruthy();
  });

  it('recusa vídeo com mais de 30 s sem enviar', async () => {
    const api = await abrirComFotos('no_local');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar fotos' }));
    videosComDuracao(31);
    escolher(new File([new Uint8Array([0])], 'v.mp4', { type: 'video/mp4' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Vídeo com mais de 30 s. Grave um mais curto.',
    );
    expect(api.registrarFotoEstado).not.toHaveBeenCalled();
  });

  it('trava em 6 itens do Cliente por etapa', async () => {
    const seis = [1, 2, 3, 4, 5, 6].map((n) => foto('cliente', 'antes', n));
    const api = await abrirComFotos('no_local', seis);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar fotos' }));
    expect(screen.getByText('Seus itens nesta etapa: 6 de 6')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Tirar foto ou vídeo' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    escolher(PNG());
    expect((await screen.findByRole('alert')).textContent).toContain('Limite de 6 itens');
    expect(api.registrarFotoEstado).not.toHaveBeenCalled();
  });

  it('a Corrida segue sem fotos: nada exige registrar', async () => {
    await abrirComFotos('entregue');
    expect(screen.getByRole('button', { name: 'Fazer novo Pedido' })).toBeTruthy();
  });
});
