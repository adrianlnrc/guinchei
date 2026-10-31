import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TAMANHO_MAXIMO_DOCUMENTO_BYTES, type MinhaFrota } from '@guinchei/api';
import {
  ITEM_ALVARA,
  ITEM_APOLICE,
  PERFIL_AURORA,
  PERFIL_MARCOS,
  PERFIL_RAFAEL,
  VEICULO_APROVADO,
  VEICULO_RECUSADO,
  apiFalsa,
} from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const FROTA: MinhaFrota = {
  id: 'f1',
  tipo: 'autonomo',
  documento: '52998224725',
  nome: 'Aurora Guinchos',
  ativa: false,
  pendenciasDeAtivacao: [],
  baseCep: '70000000',
  baseEndereco: 'SQN 308',
  baseBairro: 'Asa Norte',
  chavePix: 'x',
  apoliceValidade: '2026-11-17',
  termosPrestadorVersao: 'v',
  itens: [ITEM_ALVARA, ITEM_APOLICE],
};

const representante = (extra: Parameters<typeof apiFalsa>[0] = {}) =>
  apiFalsa({ sessao: true, perfil: PERFIL_AURORA, frota: FROTA, ...extra });

const tocar = (nome: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nome }));
const preencher = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const arquivo = (tipo = 'application/pdf', tamanho?: number) => {
  const f = new File(['x'], 'arquivo', { type: tipo });
  if (tamanho !== undefined) Object.defineProperty(f, 'size', { value: tamanho });
  return f;
};
const enviar = (rotulo: string, f: File) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { files: [f] } });

// Placa Mercosul e RENAVAM com dígito verificador certo.
const PLACA = 'DEF1G23';
const RENAVAM = '09876543216';

async function etapaDosDados(api: ReturnType<typeof apiFalsa>) {
  renderEm('/veiculos/novo', api);
  await screen.findByRole('main', { name: 'Veículo: dados' });
}

function preencherOsDados(dados: { placa?: string; renavam?: string; pbt?: string } = {}) {
  preencher('Placa', dados.placa ?? PLACA);
  preencher('RENAVAM', dados.renavam ?? RENAVAM);
  preencher('PBT em kg', dados.pbt ?? '4500');
}

async function irParaOsArquivos(api: ReturnType<typeof apiFalsa>) {
  await etapaDosDados(api);
  preencherOsDados();
  tocar('Continuar');
  await screen.findByRole('main', { name: 'Veículo: documentos' });
}

describe('Lista dos veículos da Frota', () => {
  it('diferencia o veículo aprovado do pendente e do recusado, com o motivo', async () => {
    const pendente = {
      ...VEICULO_APROVADO,
      id: 'veiculo-3',
      placa: 'GHI4567',
      estado: 'pendente' as const,
      itens: VEICULO_APROVADO.itens.map((i) => ({
        ...i,
        id: `${i.id}-3`,
        estado: 'pendente' as const,
      })),
    };
    renderEm(
      '/veiculos',
      representante({ veiculos: [VEICULO_APROVADO, pendente, VEICULO_RECUSADO] }),
    );

    const aprovado = await screen.findByRole('listitem', { name: 'Veículo ABC-1D23' });
    expect(aprovado.getAttribute('data-estado')).toBe('aprovado');
    expect(within(aprovado).getAllByText('Aprovado').length).toBeGreaterThan(0);
    expect(aprovado.textContent).toContain('Plataforma · 4.500 kg');

    const emAnalise = screen.getByRole('listitem', { name: 'Veículo GHI-4567' });
    expect(emAnalise.getAttribute('data-estado')).toBe('pendente');
    expect(within(emAnalise).queryByText('Aprovado')).toBeNull();
    expect(emAnalise.textContent).toContain('Em análise');

    const recusado = screen.getByRole('listitem', { name: 'Veículo XYZ-9876' });
    expect(recusado.getAttribute('data-estado')).toBe('recusado');
    expect(recusado.textContent).toContain('Lança · 3.200 kg');
    expect(recusado.textContent).toContain('Motivo: Foto escura: refaça de dia');
  });

  it('sem veículos, convida a cadastrar o primeiro', async () => {
    renderEm('/veiculos', representante());
    expect(await screen.findByText('Nenhum veículo cadastrado ainda.')).toBeTruthy();
    tocar('Cadastrar veículo');
    expect(await screen.findByRole('main', { name: 'Veículo: dados' })).toBeTruthy();
  });

  it('reenvia o item recusado: ele volta a Em análise e o motivo some', async () => {
    const api = representante({ veiculos: [VEICULO_RECUSADO] });
    renderEm('/veiculos', api);
    await screen.findByRole('listitem', { name: 'Veículo XYZ-9876' });
    // Só o item recusado oferece reenvio.
    expect(screen.queryByLabelText(/Reenviar CRLV/)).toBeNull();

    enviar('Reenviar Foto 1 do veículo do veículo XYZ-9876', arquivo('image/jpeg'));
    await waitFor(() =>
      expect(
        screen.getByRole('listitem', { name: 'Veículo XYZ-9876' }).getAttribute('data-estado'),
      ).toBe('pendente'),
    );
    expect(api.enviarArquivoDoVeiculo).toHaveBeenCalledWith(expect.anything(), 'foto');
    expect(api.reenviarItemDeVeiculo).toHaveBeenCalledWith('v2-foto-1', expect.any(String));
    expect(screen.queryByText(/Foto escura/)).toBeNull();
    expect(screen.queryByLabelText(/Reenviar/)).toBeNull();
  });

  it('o link Meus veículos fica na Minha Frota', async () => {
    renderEm('/frota', representante());
    await screen.findByRole('main', { name: 'Minha Frota' });
    tocar('Meus veículos');
    expect(await screen.findByRole('main', { name: 'Meus veículos' })).toBeTruthy();
  });
});

describe('Quem pode abrir os veículos', () => {
  it('sem sessão, vai à entrada', async () => {
    renderEm('/veiculos', apiFalsa({ sessao: false }));
    expect(await screen.findByLabelText('Celular com DDD')).toBeTruthy();
  });

  it('o Guincheiro vai ao plantão e o Cliente é recusado', async () => {
    renderEm('/veiculos/novo', apiFalsa({ sessao: true, perfil: PERFIL_MARCOS }));
    expect(await screen.findByRole('main', { name: /plantão/i })).toBeTruthy();
    cleanup();

    const cliente = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    renderEm('/veiculos', cliente);
    expect(await screen.findByText(/não está cadastrado como Guincheiro/)).toBeTruthy();
    expect(cliente.sair).toHaveBeenCalled();
  });

  it('quem ainda não tem perfil vai ao cadastro da Frota', async () => {
    renderEm('/veiculos', apiFalsa({ sessao: true, perfil: null }));
    expect(await screen.findByRole('button', { name: 'Cadastrar minha Frota' })).toBeTruthy();
  });
});

describe('Cadastro de veículo: etapa dos dados', () => {
  it('mascara a placa e segue com dados válidos', async () => {
    await etapaDosDados(representante());
    preencherOsDados({ placa: 'def1g23' });
    expect((screen.getByLabelText('Placa') as HTMLInputElement).value).toBe('DEF-1G23');
    tocar('Continuar');
    expect(await screen.findByRole('main', { name: 'Veículo: documentos' })).toBeTruthy();
  });

  it('aceita a placa no padrão antigo e o RENAVAM de 10 dígitos', async () => {
    await etapaDosDados(representante());
    preencherOsDados({ placa: 'abc-1234', renavam: '9876543216' });
    tocar('Continuar');
    expect(await screen.findByRole('main', { name: 'Veículo: documentos' })).toBeTruthy();
  });

  it.each([
    ['placa inválida', { placa: 'AB12345' }, /Placa inválida/],
    ['RENAVAM com dígito errado', { renavam: '12345678901' }, /RENAVAM inválido/],
    ['RENAVAM curto', { renavam: '1234' }, /RENAVAM inválido/],
    ['PBT abaixo do aceito', { pbt: '100' }, /PBT em kg, de 500 a 60000/],
    ['PBT acima do aceito', { pbt: '65000' }, /PBT em kg, de 500 a 60000/],
  ])('recusa %s antes de enviar', async (_nome, dados, mensagem) => {
    await etapaDosDados(representante());
    preencherOsDados(dados);
    tocar('Continuar');
    expect((await screen.findByRole('alert')).textContent).toMatch(mensagem);
    expect(screen.getByRole('main', { name: 'Veículo: dados' })).toBeTruthy();
  });

  it('o tipo do guincho tem plataforma, asa-delta e lança', async () => {
    await etapaDosDados(representante());
    const opcoes = within(screen.getByLabelText('Tipo do guincho'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(opcoes).toEqual(['Plataforma', 'Asa-delta', 'Lança']);
  });

  it('Continuar só vale com os campos preenchidos', async () => {
    await etapaDosDados(representante());
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('Cadastro de veículo: CRLV e fotos', () => {
  it('só libera o cadastro com o CRLV e uma foto, e leva à lista com o veículo em análise', async () => {
    const api = representante();
    await irParaOsArquivos(api);
    const cadastrar = () =>
      screen.getByRole('button', { name: 'Cadastrar veículo' }) as HTMLButtonElement;
    expect(cadastrar().disabled).toBe(true);

    enviar('CRLV (PDF ou foto)', arquivo('application/pdf'));
    expect(await screen.findByText('CRLV enviado')).toBeTruthy();
    expect(cadastrar().disabled).toBe(true);

    enviar('Adicionar foto do veículo', arquivo('image/jpeg'));
    expect(await screen.findByText('1 de 6 foto enviada')).toBeTruthy();
    enviar('Adicionar foto do veículo', arquivo('image/png'));
    expect(await screen.findByText('2 de 6 fotos enviadas')).toBeTruthy();
    expect(cadastrar().disabled).toBe(false);

    tocar('Cadastrar veículo');
    const lista = await screen.findByRole('main', { name: 'Meus veículos' });
    const veiculo = await within(lista).findByRole('listitem', { name: 'Veículo DEF-1G23' });
    expect(veiculo.getAttribute('data-estado')).toBe('pendente');
    expect(veiculo.textContent).toContain('Plataforma · 4.500 kg');
    expect(api.cadastrarVeiculo).toHaveBeenCalledWith({
      placa: 'DEF1G23',
      renavam: RENAVAM,
      tipo: 'plataforma',
      pbtKg: 4500,
      crlvArquivo: expect.stringContaining(PERFIL_AURORA.id),
      fotosArquivos: [expect.any(String), expect.any(String)],
    });
  });

  it('envia o tipo e o PBT escolhidos', async () => {
    const api = representante();
    await etapaDosDados(api);
    preencherOsDados({ pbt: '8000' });
    fireEvent.change(screen.getByLabelText('Tipo do guincho'), { target: { value: 'asa_delta' } });
    tocar('Continuar');
    await screen.findByRole('main', { name: 'Veículo: documentos' });
    enviar('CRLV (PDF ou foto)', arquivo('image/jpeg'));
    await screen.findByText('CRLV enviado');
    enviar('Adicionar foto do veículo', arquivo('image/jpeg'));
    await screen.findByText('1 de 6 foto enviada');
    tocar('Cadastrar veículo');
    await screen.findByRole('main', { name: 'Meus veículos' });
    expect(api.cadastrarVeiculo).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'asa_delta', pbtKg: 8000 }),
    );
  });

  it('recusa formato e tamanho de arquivo fora do limite, com a mensagem do servidor', async () => {
    await irParaOsArquivos(representante());
    enviar('CRLV (PDF ou foto)', arquivo('text/plain'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Formato não aceito/);

    enviar('Adicionar foto do veículo', arquivo('application/pdf'));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/Formato não aceito/),
    );

    enviar('Adicionar foto do veículo', arquivo('image/jpeg', TAMANHO_MAXIMO_DOCUMENTO_BYTES + 1));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/passa de 10 MB/));
    expect(screen.queryByText('CRLV enviado')).toBeNull();
    expect(screen.getByText('Nenhuma foto enviada')).toBeTruthy();
  });

  it('para de aceitar fotos no limite de 6', async () => {
    await irParaOsArquivos(representante());
    for (let n = 1; n <= 6; n++) {
      enviar('Adicionar foto do veículo', arquivo('image/jpeg'));
      await screen.findByText(new RegExp(`^${n} de 6 fotos? enviadas?$`));
    }
    expect((screen.getByLabelText('Adicionar foto do veículo') as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it('placa duplicada: mostra o erro claro na etapa dos dados e mantém o que foi digitado', async () => {
    const api = representante({ veiculos: [{ ...VEICULO_APROVADO, placa: PLACA }] });
    await irParaOsArquivos(api);
    enviar('CRLV (PDF ou foto)', arquivo('application/pdf'));
    await screen.findByText('CRLV enviado');
    enviar('Adicionar foto do veículo', arquivo('image/jpeg'));
    await screen.findByText('1 de 6 foto enviada');
    tocar('Cadastrar veículo');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Já existe um veículo cadastrado com esta placa ou este RENAVAM.',
    );
    expect(screen.getByRole('main', { name: 'Veículo: dados' })).toBeTruthy();
    expect((screen.getByLabelText('Placa') as HTMLInputElement).value).toBe('DEF-1G23');
  });

  it('Voltar leva de novo aos dados sem perder o que foi digitado', async () => {
    await irParaOsArquivos(representante());
    tocar('Voltar');
    expect(await screen.findByRole('main', { name: 'Veículo: dados' })).toBeTruthy();
    expect((screen.getByLabelText('RENAVAM') as HTMLInputElement).value).toBe(RENAVAM);
  });

  it('falha de rede no cadastro dá mensagem genérica e deixa tentar de novo', async () => {
    const api = representante();
    await irParaOsArquivos(api);
    enviar('CRLV (PDF ou foto)', arquivo('application/pdf'));
    await screen.findByText('CRLV enviado');
    enviar('Adicionar foto do veículo', arquivo('image/jpeg'));
    await screen.findByText('1 de 6 foto enviada');
    api.cadastrarVeiculo.mockRejectedValueOnce(new Error('rede'));
    tocar('Cadastrar veículo');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível cadastrar/);
    expect(
      (screen.getByRole('button', { name: 'Cadastrar veículo' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
