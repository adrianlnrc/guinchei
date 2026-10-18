import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroApi } from '@guinchei/api';
import { apiFalsa, frotasDeHomologacao } from './teste/apiFalsa';
import { renderEm as renderizar } from './teste/renderizar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Abre a Homologação já com a operação logada, esperando a fila carregar. */
async function abrir(api = apiFalsa({ sessao: true })) {
  renderizar('/homologacao', api);
  await screen.findByRole('navigation', { name: 'Painel de operação' });
  return api;
}

const fila = () => screen.getByRole('complementary', { name: 'Fila de homologação' });
const itemDe = (nome: string) => screen.getByRole('listitem', { name: nome });

describe('Homologação: fila de pendências', () => {
  it('lista só as Frotas com item pendente, a de envio mais antigo primeiro', async () => {
    await abrir();
    const botoes = await within(fila()).findAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Guincho Capital'),
      expect.stringContaining('Rebocadora Sul'),
    ]);
    expect(within(fila()).queryByText(/Reboque Planalto/)).toBeNull();
    expect(botoes[0]!.textContent).toContain('2 itens pendentes');
    expect(botoes[1]!.textContent).toContain('1 item pendente');
  });

  it('mostra a contagem de Frotas na fila ao lado de Homologação, na lateral', async () => {
    await abrir();
    const lateral = screen.getByRole('navigation', { name: 'Painel de operação' });
    await waitFor(() =>
      expect(within(lateral).getByRole('link', { name: /Homologação/ }).textContent).toBe(
        'Homologação2',
      ),
    );
  });

  it('sem Frota pendente, diz que a fila está vazia', async () => {
    await abrir(apiFalsa({ sessao: true, frotas: [frotasDeHomologacao()[2]!] }));
    expect(await screen.findByText('Nenhuma Frota aguardando homologação.')).toBeTruthy();
    const lateral = screen.getByRole('navigation', { name: 'Painel de operação' });
    expect(within(lateral).getByRole('link', { name: /Homologação/ }).textContent).toBe(
      'Homologação',
    );
  });

  it('se a fila não carrega, avisa em vez de mostrar fila vazia', async () => {
    const api = apiFalsa({ sessao: true });
    api.listarFilaHomologacao.mockRejectedValue(
      new ErroApi('falha', 'Não foi possível ler a fila'),
    );
    await abrir(api);
    expect(await screen.findByText('Não foi possível carregar a fila.')).toBeTruthy();
    expect(screen.queryByText('Nenhuma Frota aguardando homologação.')).toBeNull();
  });
});

describe('Homologação: detalhe da Frota', () => {
  it('abre a primeira Frota da fila com os itens, o estado e a validade', async () => {
    await abrir();
    expect(await screen.findByRole('heading', { name: 'Guincho Capital' })).toBeTruthy();
    expect(screen.getByText(/CNPJ 11444777000161/)).toBeTruthy();

    const apolice = itemDe('Apólice de RC por avaria');
    expect(within(apolice).getByText('Pendente')).toBeTruthy();
    expect(within(apolice).getByText(/Validade 15\/10\/2027/)).toBeTruthy();
    expect(within(itemDe('Alvará')).getByText('Aprovado')).toBeTruthy();
    expect(within(itemDe('CRLV do veículo')).getByText(/Veículo/)).toBeTruthy();
  });

  it('destaca o item vencido e não oferece aprovar sem reenvio', async () => {
    await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    const cnh = itemDe('CNH do Guincheiro');
    const estado = within(cnh).getByText('Vencido');
    expect(estado.className).toContain('etiqueta--alerta');
    expect(within(cnh).getByText(/Validade 30\/09\/2026/)).toBeTruthy();
    expect(within(cnh).getByText('Aguardando novo envio do documento.')).toBeTruthy();
    expect(within(cnh).queryByRole('button', { name: /^Aprovar/ })).toBeNull();
    expect(within(cnh).queryByRole('button', { name: /^Recusar/ })).toBeNull();
  });

  it('escolher outra Frota da fila abre o detalhe dela', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(within(fila()).getByRole('button', { name: /Rebocadora Sul/ }));
    expect(await screen.findByRole('heading', { name: 'Rebocadora Sul' })).toBeTruthy();
    expect(screen.getByText(/CPF 45678912364/)).toBeTruthy();
    expect(api.buscarFrotaHomologacao).toHaveBeenCalledWith('f0000000-0000-4000-8000-000000000004');
  });
});

describe('Homologação: decidir item', () => {
  it('aprova o item pendente e ele passa a Aprovado', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar Apólice de RC por avaria' }));

    await waitFor(() =>
      expect(within(itemDe('Apólice de RC por avaria')).getByText('Aprovado')).toBeTruthy(),
    );
    expect(api.aprovarItem).toHaveBeenCalledWith('i-apolice');
    expect(
      within(itemDe('Apólice de RC por avaria')).queryByRole('button', { name: /^Aprovar/ }),
    ).toBeNull();
    // A fila continua com a Frota: ainda falta o CRLV.
    expect(within(fila()).getByRole('button', { name: /Guincho Capital/ }).textContent).toContain(
      '1 item pendente',
    );
  });

  it('recusar pede o motivo e só confirma com ele preenchido', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Recusar CRLV do veículo' }));

    const confirmar = screen.getByRole('button', { name: 'Confirmar recusa' }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    const campo = screen.getByLabelText('Motivo da recusa');
    fireEvent.change(campo, { target: { value: '   ' } });
    expect(confirmar.disabled).toBe(true);
    fireEvent.change(campo, { target: { value: 'Foto cortada, placa ilegível' } });
    expect(confirmar.disabled).toBe(false);
    fireEvent.click(confirmar);

    await waitFor(() =>
      expect(within(itemDe('CRLV do veículo')).getByText('Recusado')).toBeTruthy(),
    );
    expect(api.recusarItem).toHaveBeenCalledWith('i-crlv', 'Foto cortada, placa ilegível');
    expect(
      within(itemDe('CRLV do veículo')).getByText(/Foto cortada, placa ilegível/),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Motivo da recusa')).toBeNull();
  });

  it('cancelar a recusa fecha o motivo sem chamar a API', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Recusar CRLV do veículo' }));
    fireEvent.change(screen.getByLabelText('Motivo da recusa'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Motivo da recusa')).toBeNull();
    expect(api.recusarItem).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Aprovar CRLV do veículo' })).toBeTruthy();
  });

  it('a Frota sai da fila quando o último item pendente é decidido', async () => {
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(within(fila()).getByRole('button', { name: /Rebocadora Sul/ }));
    await screen.findByRole('heading', { name: 'Rebocadora Sul' });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar Alvará' }));

    await waitFor(() => expect(within(fila()).queryByText(/Rebocadora Sul/)).toBeNull());
    expect(api.listarFilaHomologacao.mock.calls.length).toBeGreaterThan(1);
    expect(await screen.findByRole('heading', { name: 'Guincho Capital' })).toBeTruthy();
    const lateral = screen.getByRole('navigation', { name: 'Painel de operação' });
    expect(within(lateral).getByRole('link', { name: /Homologação/ }).textContent).toBe(
      'Homologação1',
    );
  });

  it('mostra o erro da API sem mudar o item', async () => {
    const api = apiFalsa({ sessao: true });
    api.aprovarItem.mockRejectedValue(
      new ErroApi('transicao_invalida', 'Este item já foi decidido ou aguarda reenvio'),
    );
    await abrir(api);
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar Apólice de RC por avaria' }));

    expect((await screen.findByRole('status')).textContent).toContain(
      'Este item já foi decidido ou aguarda reenvio',
    );
    expect(within(itemDe('Apólice de RC por avaria')).getByText('Pendente')).toBeTruthy();
  });
});

describe('Homologação: documento', () => {
  it('abre o documento pela URL assinada numa aba nova', async () => {
    const janela = { location: { href: '' }, close: vi.fn(), opener: {} };
    const abrirJanela = vi.spyOn(window, 'open').mockReturnValue(janela as unknown as Window);
    const api = await abrir();
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver documento: Apólice de RC por avaria' }),
    );

    await waitFor(() =>
      expect(janela.location.href).toBe('https://documentos.exemplo/i-apolice?token=x'),
    );
    expect(api.urlDoDocumento).toHaveBeenCalledWith('i-apolice');
    expect(abrirJanela).toHaveBeenCalledTimes(1);
    expect(janela.opener).toBeNull();
    expect(janela.close).not.toHaveBeenCalled();
  });

  it('se o documento não abre, fecha a aba e avisa', async () => {
    const janela = { location: { href: '' }, close: vi.fn(), opener: {} };
    vi.spyOn(window, 'open').mockReturnValue(janela as unknown as Window);
    const api = apiFalsa({ sessao: true });
    api.urlDoDocumento.mockRejectedValue(new ErroApi('falha', 'Documento indisponível'));
    await abrir(api);
    await screen.findByRole('heading', { name: 'Guincho Capital' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver documento: Alvará' }));

    expect((await screen.findByRole('status')).textContent).toContain('Documento indisponível');
    expect(janela.close).toHaveBeenCalled();
  });
});
