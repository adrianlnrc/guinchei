import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, type MinhaFrota, type RascunhoFrota } from '@guinchei/api';
import { ITEM_ALVARA, ITEM_APOLICE, PERFIL_AURORA, apiFalsa } from '../teste/apiFalsa';
import { renderEm } from '../teste/renderizar';

// Hoje é 18/10/2026 no aparelho: a apólice precisa valer a partir de 17/11/2026 (30 dias).
const HOJE = new Date('2026-10-18T15:00:00');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: HOJE });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const PESSOA_FISICA = 'Pessoa física (tenho um guincho)';
const EMPRESA = 'Empresa (CNPJ)';

const tocar = (nome: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nome }));
const preencher = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const etapa = (nome: string) => screen.findByRole('main', { name: nome });

const CNPJ = '11222333000181';
// CNPJ alfanumérico (IN RFB 2.229/2024), com os dígitos verificadores certos.
const CNPJ_ALFANUMERICO = '12ABC34501DE35';
const CPF_REPRESENTANTE = '52998224725';

const DADOS_DA_ETAPA_1 = {
  documento: CNPJ,
  nome: 'Reboque Aurora Ltda',
  representanteNome: 'Aurora Lima',
  representanteCpf: CPF_REPRESENTANTE,
};
const DADOS_DA_ETAPA_4 = {
  ...DADOS_DA_ETAPA_1,
  baseCep: '70000000',
  baseEndereco: 'SQN 308 Bloco A, loja 2',
  baseBairro: 'Asa Norte',
  alvaraArquivo: `${PERFIL_AURORA.id}/alvara.pdf`,
  apoliceArquivo: `${PERFIL_AURORA.id}/apolice.pdf`,
  apoliceValidade: '2026-11-17',
  chavePix: '11222333000181',
};

const semPerfil = (extra: Parameters<typeof apiFalsa>[0] = {}) =>
  apiFalsa({ sessao: true, perfil: null, ...extra });

const rascunhoSalvo = (api: ReturnType<typeof apiFalsa>): RascunhoFrota =>
  api.salvarRascunhoFrota.mock.lastCall![0];

describe('A primeira pergunta do cadastro', () => {
  it('oferece pessoa física e empresa; "Empresa" abre o formulário da empresa', async () => {
    renderEm('/cadastro', semPerfil());
    expect(await screen.findByRole('heading', { name: 'Como você atende?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: PESSOA_FISICA })).toBeTruthy();
    tocar(EMPRESA);

    const tela = await etapa('Cadastro: dados');
    expect(tela.textContent).toContain('Dados da empresa');
    expect(tela.textContent).toContain('Etapa 1 de 5');
    expect(screen.getByLabelText('CNPJ')).toBeTruthy();
    expect(screen.getByLabelText('Razão social')).toBeTruthy();
    expect(screen.getByLabelText('Nome do representante')).toBeTruthy();
    expect(screen.getByLabelText('CPF do representante')).toBeTruthy();
    expect(tela.textContent).toContain('(61) 90000-0008');
  });

  it('"Pessoa física" abre o formulário do autônomo', async () => {
    renderEm('/cadastro', semPerfil());
    fireEvent.click(await screen.findByRole('button', { name: PESSOA_FISICA }));
    const tela = await etapa('Cadastro: dados');
    expect(tela.textContent).toContain('Dados da sua Frota');
    expect(screen.getByLabelText('Nome completo')).toBeTruthy();
    expect(screen.queryByLabelText('Razão social')).toBeNull();
  });

  it('Voltar da primeira etapa devolve à pergunta', async () => {
    renderEm('/cadastro', semPerfil());
    fireEvent.click(await screen.findByRole('button', { name: EMPRESA }));
    await etapa('Cadastro: dados');
    tocar('Voltar');
    expect(await screen.findByRole('heading', { name: 'Como você atende?' })).toBeTruthy();
  });

  it('com rascunho de empresa, "Continuar meu cadastro" retoma o formulário da empresa', async () => {
    const api = semPerfil({ rascunho: { tipo: 'empresa', etapa: 1, dados: DADOS_DA_ETAPA_1 } });
    renderEm('/cadastro', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar meu cadastro' }));
    await etapa('Cadastro: dados');
    expect((screen.getByLabelText('CNPJ') as HTMLInputElement).value).toBe('11.222.333/0001-81');
    expect((screen.getByLabelText('Razão social') as HTMLInputElement).value).toBe(
      'Reboque Aurora Ltda',
    );
  });

  it('trocar de formulário recomeça documento e representante, mas guarda o resto', async () => {
    const api = semPerfil({
      rascunho: { tipo: 'empresa', etapa: 4, dados: { ...DADOS_DA_ETAPA_4 } },
    });
    renderEm('/cadastro', api);
    fireEvent.click(await screen.findByRole('button', { name: PESSOA_FISICA }));
    await etapa('Cadastro: dados');
    expect((screen.getByLabelText('Nome completo') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('CPF') as HTMLInputElement).value).toBe('');

    preencher('Nome completo', 'Aurora Lima');
    preencher('CPF', CPF_REPRESENTANTE);
    tocar('Continuar');
    await etapa('Cadastro: endereço');
    expect(rascunhoSalvo(api)).toMatchObject({
      tipo: 'autonomo',
      etapa: 2,
      dados: { documento: CPF_REPRESENTANTE, baseCep: '70000000', chavePix: CNPJ },
    });
  });
});

describe('Etapa 1 da empresa: CNPJ e representante', () => {
  const abrir = async (api = semPerfil()) => {
    renderEm('/cadastro', api);
    fireEvent.click(await screen.findByRole('button', { name: EMPRESA }));
    await etapa('Cadastro: dados');
    return api;
  };

  it('só segue com tudo preenchido', async () => {
    await abrir();
    const continuar = screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement;
    expect(continuar.disabled).toBe(true);
    preencher('CNPJ', CNPJ);
    preencher('Razão social', 'Reboque Aurora Ltda');
    preencher('Nome do representante', 'Aurora Lima');
    expect(continuar.disabled).toBe(true);
    preencher('CPF do representante', CPF_REPRESENTANTE);
    expect(continuar.disabled).toBe(false);
  });

  it('recusa CNPJ inválido e CPF do representante inválido', async () => {
    const api = await abrir();
    preencher('CNPJ', '11.222.333/0001-82');
    preencher('Razão social', 'Reboque Aurora Ltda');
    preencher('Nome do representante', 'Aurora Lima');
    preencher('CPF do representante', '529.982.247-24');
    tocar('Continuar');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'CNPJ inválido. Confira os números.',
    );

    preencher('CNPJ', CNPJ);
    tocar('Continuar');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'CPF do representante inválido. Confira os números.',
    );
    expect(api.salvarRascunhoFrota).not.toHaveBeenCalled();
  });

  it('aceita o CNPJ alfanumérico, em maiúsculas e com máscara', async () => {
    const api = await abrir();
    preencher('CNPJ', '12.abc.345/01de-35');
    expect((screen.getByLabelText('CNPJ') as HTMLInputElement).value).toBe('12.ABC.345/01DE-35');
    preencher('Razão social', ' Reboque Aurora Ltda ');
    preencher('Nome do representante', 'Aurora Lima');
    preencher('CPF do representante', '529.982.247-25');
    tocar('Continuar');

    await etapa('Cadastro: endereço');
    expect(rascunhoSalvo(api)).toEqual({
      tipo: 'empresa',
      etapa: 2,
      dados: {
        documento: CNPJ_ALFANUMERICO,
        nome: 'Reboque Aurora Ltda',
        representanteNome: 'Aurora Lima',
        representanteCpf: CPF_REPRESENTANTE,
      },
    });
  });

  it('o representante é uma pessoa à parte: o CPF dele não precisa ser o do documento', async () => {
    const api = await abrir();
    preencher('CNPJ', CNPJ);
    preencher('Razão social', 'Reboque Aurora Ltda');
    preencher('Nome do representante', 'Aurora Lima');
    preencher('CPF do representante', CPF_REPRESENTANTE);
    tocar('Continuar');
    await etapa('Cadastro: endereço');
    expect(rascunhoSalvo(api).dados.representanteCpf).toBe(CPF_REPRESENTANTE);
    expect(rascunhoSalvo(api).dados.documento).toBe(CNPJ);
  });
});

describe('Envio do cadastro da empresa', () => {
  const abrir = async (api = semPerfil()) => {
    renderEm('/cadastro', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar meu cadastro' }));
    await etapa('Cadastro: termos');
    return api;
  };
  const rascunhoDeEmpresa = () =>
    semPerfil({ rascunho: { tipo: 'empresa', etapa: 5, dados: DADOS_DA_ETAPA_4 } });
  const aceitarEEnviar = () => {
    fireEvent.click(screen.getByLabelText('Li e aceito os termos para prestadores.'));
    tocar('Enviar cadastro');
  };

  it('grava a Frota empresa e o representante vai para a própria Frota, sem plantão', async () => {
    const api = await abrir(rascunhoDeEmpresa());
    aceitarEEnviar();

    const tela = await etapa('Minha Frota');
    expect(api.enviarCadastroFrota).toHaveBeenCalledTimes(1);
    expect(rascunhoSalvo(api).tipo).toBe('empresa');
    expect(tela.textContent).toContain('Reboque Aurora Ltda');
    expect(tela.textContent).toContain('Frota empresa');
    // O representante não vira Guincheiro: não há plantão.
    expect(screen.queryByRole('main', { name: 'Em plantão' })).toBeNull();
    expect(await api.buscarMeuGuincheiro()).toBeNull();
  });

  it('CNPJ já cadastrado é recusado com mensagem clara e dá para tentar de novo', async () => {
    const api = await abrir(rascunhoDeEmpresa());
    api.enviarCadastroFrota.mockRejectedValueOnce(
      new ErroApi('documento_ja_cadastrado', 'Este documento já tem uma Frota'),
    );
    aceitarEEnviar();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Este CNPJ já tem uma Frota cadastrada. Volte à primeira etapa e confira o número.',
    );
    expect(screen.getByRole('main', { name: 'Cadastro: termos' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Enviar cadastro' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('CNPJ inválido no servidor volta com a mensagem do servidor', async () => {
    const api = await abrir(rascunhoDeEmpresa());
    api.enviarCadastroFrota.mockRejectedValueOnce(
      new ErroApi('documento_invalido', 'CPF ou CNPJ inválido. Confira os números.'),
    );
    aceitarEEnviar();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'CPF ou CNPJ inválido. Confira os números.',
    );
  });
});

describe('Minha Frota: o representante acompanha e reenvia', () => {
  const frotaDeEmpresa = (itens: MinhaFrota['itens']): MinhaFrota => ({
    id: 'f1',
    tipo: 'empresa',
    documento: CNPJ,
    nome: 'Reboque Aurora Ltda',
    ativa: false,
    baseCep: '70000000',
    baseEndereco: 'SQN 308',
    baseBairro: 'Asa Norte',
    chavePix: 'x',
    apoliceValidade: '2026-11-17',
    termosPrestadorVersao: 'v',
    itens,
  });
  const pdf = () => new File(['%PDF-'], 'novo.pdf', { type: 'application/pdf' });
  const escolher = (rotulo: string, arquivo: File) =>
    fireEvent.change(screen.getByLabelText(rotulo), { target: { files: [arquivo] } });
  const itemDe = (tela: HTMLElement, nome: string) =>
    within(tela).getByText(nome).closest('li') as HTMLElement;

  it('mostra pendente, aprovado, recusado com o motivo e vencido, sem exigir perfil de Guincheiro', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_AURORA,
      frota: frotaDeEmpresa([
        { ...ITEM_ALVARA, estado: 'aprovado' },
        {
          ...ITEM_APOLICE,
          estado: 'recusado',
          motivo: 'Apólice sem cobertura de avaria',
        },
        {
          ...ITEM_ALVARA,
          id: 'item-crlv',
          tipo: 'crlv',
          alvo: 'veiculo',
          estado: 'vencido',
        },
        { ...ITEM_ALVARA, id: 'item-cnh', tipo: 'cnh', alvo: 'guincheiro', estado: 'pendente' },
      ]),
    });
    renderEm('/frota', api);
    const tela = await etapa('Minha Frota');
    expect(itemDe(tela, 'Alvará de funcionamento').textContent).toContain('Aprovado');
    const apolice = itemDe(tela, 'Apólice de responsabilidade civil');
    expect(apolice.textContent).toContain('Recusado');
    expect(apolice.textContent).toContain('Apólice sem cobertura de avaria');
    expect(itemDe(tela, 'CRLV do veículo').textContent).toContain('Vencido');
    expect(itemDe(tela, 'CNH').textContent).toContain('Em análise');

    // Só o item recusado ou vencido da própria Frota tem reenvio.
    expect(within(tela).getAllByRole('button', { name: /^Reenviar / })).toHaveLength(1);
    expect(within(apolice).getByRole('button', { name: /^Reenviar / })).toBeTruthy();
  });

  it('reenviar o alvará recusado volta o item a pendente', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_AURORA,
      frota: frotaDeEmpresa([
        { ...ITEM_ALVARA, estado: 'recusado', motivo: 'Foto ilegível' },
        ITEM_APOLICE,
      ]),
    });
    renderEm('/frota', api);
    const tela = await etapa('Minha Frota');
    const reenviar = within(tela).getByRole('button', {
      name: 'Reenviar Alvará de funcionamento',
    }) as HTMLButtonElement;
    expect(reenviar.disabled).toBe(true);

    const arquivo = pdf();
    escolher('Novo arquivo: Alvará de funcionamento', arquivo);
    expect(reenviar.disabled).toBe(false);
    fireEvent.click(reenviar);

    await waitFor(() =>
      expect(itemDe(tela, 'Alvará de funcionamento').textContent).toContain('Em análise'),
    );
    expect(api.reenviarItemDaFrota).toHaveBeenCalledWith('item-alvara', arquivo, undefined);
    expect(itemDe(tela, 'Alvará de funcionamento').textContent).not.toContain('Foto ilegível');
    expect(within(tela).queryByRole('button', { name: /^Reenviar / })).toBeNull();
  });

  it('a apólice pede a nova validade e recusa a que vence em menos de 30 dias', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_AURORA,
      frota: frotaDeEmpresa([
        ITEM_ALVARA,
        { ...ITEM_APOLICE, estado: 'vencido', validade: '2026-10-01' },
      ]),
    });
    renderEm('/frota', api);
    const tela = await etapa('Minha Frota');
    const reenviar = within(tela).getByRole('button', {
      name: 'Reenviar Apólice de responsabilidade civil',
    }) as HTMLButtonElement;
    escolher('Novo arquivo: Apólice de responsabilidade civil', pdf());
    // Sem a validade, não envia.
    expect(reenviar.disabled).toBe(true);

    preencher('Nova validade da apólice', '2026-11-10');
    fireEvent.click(reenviar);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'vence em menos de 30 dias. Envie uma apólice com validade a partir de 17/11/2026.',
    );
    expect(api.reenviarItemDaFrota).not.toHaveBeenCalled();

    preencher('Nova validade da apólice', '2027-10-18');
    fireEvent.click(reenviar);
    await waitFor(() =>
      expect(api.reenviarItemDaFrota).toHaveBeenCalledWith(
        'item-apolice',
        expect.any(File),
        '2027-10-18',
      ),
    );
    await waitFor(() =>
      expect(itemDe(tela, 'Apólice de responsabilidade civil').textContent).toContain('Em análise'),
    );
    expect(itemDe(tela, 'Apólice de responsabilidade civil').textContent).toContain('18/10/2027');
  });

  it('arquivo recusado pelo servidor mostra o motivo e o item continua recusado', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_AURORA,
      frota: frotaDeEmpresa([{ ...ITEM_ALVARA, estado: 'recusado', motivo: 'Foto ilegível' }]),
    });
    renderEm('/frota', api);
    const tela = await etapa('Minha Frota');
    escolher(
      'Novo arquivo: Alvará de funcionamento',
      new File(['x'], 'video.mp4', { type: 'video/mp4' }),
    );
    fireEvent.click(within(tela).getByRole('button', { name: /^Reenviar / }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Formato não aceito. Envie um PDF ou uma foto.',
    );
    expect(itemDe(tela, 'Alvará de funcionamento').textContent).toContain('Recusado');
  });
});

describe('A tela de entrada', () => {
  it('diz a quem ainda não é prestador que dá para se cadastrar como pessoa física ou empresa', async () => {
    renderEm('/entrar', apiFalsa());
    const tela = await etapa('Celular');
    expect(tela.textContent).toContain('pessoa física');
    expect(tela.textContent).toContain('empresa (CNPJ)');
  });
});
