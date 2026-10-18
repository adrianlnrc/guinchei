import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, TAMANHO_MAXIMO_DOCUMENTO_BYTES, type RascunhoFrota } from '@guinchei/api';
import {
  CODIGO_CERTO,
  ITEM_ALVARA,
  ITEM_APOLICE,
  PERFIL_AURORA,
  PERFIL_RAFAEL,
  apiFalsa,
} from '../teste/apiFalsa';
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

const tocar = (nome: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nome }));
const preencher = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const etapa = (nome: string) => screen.findByRole('main', { name: nome });
const arquivo = (nome = 'documento.pdf', tipo = 'application/pdf', tamanho?: number) => {
  const f = new File(['%PDF-'], nome, { type: tipo });
  if (tamanho !== undefined) Object.defineProperty(f, 'size', { value: tamanho });
  return f;
};
const enviarArquivo = (rotulo: string, f: File) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { files: [f] } });

const CPF = '52998224725';
const DADOS_DA_ETAPA_1 = {
  documento: CPF,
  nome: 'Aurora Lima',
  representanteNome: 'Aurora Lima',
  representanteCpf: CPF,
};
const DADOS_DA_ETAPA_2 = {
  ...DADOS_DA_ETAPA_1,
  baseCep: '70000000',
  baseEndereco: 'SQN 308 Bloco A, loja 2',
  baseBairro: 'Asa Norte',
};
const DADOS_DA_ETAPA_3 = {
  ...DADOS_DA_ETAPA_2,
  alvaraArquivo: `${PERFIL_AURORA.id}/alvara.pdf`,
  apoliceArquivo: `${PERFIL_AURORA.id}/apolice.pdf`,
  apoliceValidade: '2026-11-17',
};
const DADOS_DA_ETAPA_4 = { ...DADOS_DA_ETAPA_3, chavePix: 'aurora@exemplo.com' };

/** Quem entrou por telefone e ainda não tem perfil nem Frota. */
const semPerfil = (extra: Parameters<typeof apiFalsa>[0] = {}) =>
  apiFalsa({ sessao: true, perfil: null, ...extra });

async function comecar(api: ReturnType<typeof apiFalsa>) {
  renderEm('/cadastro', api);
  fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar minha Frota' }));
}

const retomar = async () =>
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar meu cadastro' }));

const rascunhoSalvo = (api: ReturnType<typeof apiFalsa>): RascunhoFrota =>
  api.salvarRascunhoFrota.mock.lastCall![0];

describe('Quem ainda não tem perfil de prestador', () => {
  it('entra por telefone e código e recebe a oferta de cadastrar a Frota', async () => {
    const api = apiFalsa({ perfil: null });
    renderEm('/', api);
    fireEvent.change(await screen.findByLabelText('Celular com DDD'), {
      target: { value: '(61) 90000-0008' },
    });
    tocar('Receber código');
    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), {
      target: { value: CODIGO_CERTO },
    });
    tocar('Confirmar');
    expect(await screen.findByRole('button', { name: 'Cadastrar minha Frota' })).toBeTruthy();
    expect(api.sair).not.toHaveBeenCalled();
    expect(screen.queryByRole('main', { name: 'Em plantão' })).toBeNull();
  });

  it('com a sessão guardada, qualquer rota de Guincheiro leva ao cadastro', async () => {
    renderEm('/corrida', semPerfil());
    expect(await screen.findByRole('button', { name: 'Cadastrar minha Frota' })).toBeTruthy();
  });

  it('Cliente continua sem cadastro: o aviso é o de sempre e a sessão sai', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    renderEm('/cadastro', api);
    expect(await screen.findByLabelText('Celular com DDD')).toBeTruthy();
    expect(api.sair).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cadastrar minha Frota' })).toBeNull();
  });

  it('quem já enviou o cadastro cai direto na própria Frota, sem plantão', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_AURORA,
      frota: {
        id: 'f1',
        tipo: 'autonomo',
        documento: CPF,
        nome: 'Aurora Lima',
        ativa: false,
        baseCep: '70000000',
        baseEndereco: 'SQN 308',
        baseBairro: 'Asa Norte',
        chavePix: 'x',
        apoliceValidade: '2026-11-17',
        termosPrestadorVersao: 'v',
        itens: [ITEM_ALVARA, ITEM_APOLICE],
      },
    });
    renderEm('/', api);
    expect(await etapa('Minha Frota')).toBeTruthy();
  });
});

describe('Etapa 1: dados', () => {
  it('traz o celular do login e valida o CPF antes de seguir', async () => {
    const api = semPerfil();
    await comecar(api);
    const tela = await etapa('Cadastro: dados');
    expect(tela.textContent).toContain('(61) 90000-0008');
    expect(tela.textContent).toContain('Etapa 1 de 5');

    preencher('Nome completo', 'Aurora Lima');
    preencher('CPF', '529.982.247-24');
    tocar('Continuar');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'CPF inválido. Confira os números.',
    );
    expect(api.salvarRascunhoFrota).not.toHaveBeenCalled();

    preencher('CPF', '529.982.247-25');
    tocar('Continuar');
    await etapa('Cadastro: endereço');
    expect(rascunhoSalvo(api)).toEqual({ etapa: 2, dados: DADOS_DA_ETAPA_1 });
  });

  it('no MEI, valida o CNPJ e pede o representante (nome e CPF)', async () => {
    const api = semPerfil();
    await comecar(api);
    await etapa('Cadastro: dados');
    tocar('CNPJ do MEI');
    preencher('CNPJ do MEI', '11.222.333/0001-82');
    preencher('Razão social ou nome fantasia', 'Aurora Reboques MEI');
    preencher('Nome do representante', 'Aurora Lima');
    preencher('CPF do representante', '529.982.247-25');
    tocar('Continuar');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'CNPJ inválido. Confira os números.',
    );

    preencher('CNPJ do MEI', '11.222.333/0001-81');
    preencher('CPF do representante', '529.982.247-24');
    tocar('Continuar');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'CPF do representante inválido. Confira os números.',
    );

    preencher('CPF do representante', '529.982.247-25');
    tocar('Continuar');
    await etapa('Cadastro: endereço');
    expect(rascunhoSalvo(api).dados).toEqual({
      documento: '11222333000181',
      nome: 'Aurora Reboques MEI',
      representanteNome: 'Aurora Lima',
      representanteCpf: CPF,
    });
  });

  it('falta de nome não deixa seguir', async () => {
    await comecar(semPerfil());
    await etapa('Cadastro: dados');
    preencher('CPF', CPF);
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('Etapa 2: endereço da base', () => {
  const abrir = async () => {
    const api = semPerfil({ rascunho: { etapa: 2, dados: DADOS_DA_ETAPA_1 } });
    renderEm('/cadastro', api);
    await retomar();
    await etapa('Cadastro: endereço');
    return api;
  };

  it('exige CEP de 8 dígitos, endereço e bairro; grava e segue', async () => {
    const api = await abrir();
    preencher('CEP', '7000');
    preencher('Endereço da base (rua e número)', 'SQN 308 Bloco A, loja 2');
    preencher('Bairro', 'Asa Norte');
    tocar('Continuar');
    expect((await screen.findByRole('alert')).textContent).toBe('O CEP tem 8 números.');

    preencher('CEP', '70000-000');
    tocar('Continuar');
    await etapa('Cadastro: documentos');
    expect(rascunhoSalvo(api)).toEqual({ etapa: 3, dados: DADOS_DA_ETAPA_2 });
  });

  it('Voltar mantém o que já foi preenchido', async () => {
    await abrir();
    preencher('CEP', '70000000');
    tocar('Voltar');
    await etapa('Cadastro: dados');
    expect((screen.getByLabelText('CPF') as HTMLInputElement).value).toBe('529.982.247-25');
  });
});

describe('Etapa 3: documentos', () => {
  const abrir = async (extra: Parameters<typeof apiFalsa>[0] = {}) => {
    const api = semPerfil({ rascunho: { etapa: 3, dados: DADOS_DA_ETAPA_2 }, ...extra });
    renderEm('/cadastro', api);
    await retomar();
    await etapa('Cadastro: documentos');
    return api;
  };

  it('envia o alvará e a apólice (tipo e tamanho limitados) e guarda os caminhos no rascunho', async () => {
    const api = await abrir();
    enviarArquivo('Alvará (PDF ou foto)', arquivo('alvara.pdf'));
    await waitFor(() => expect(api.enviarDocumentoDaFrota).toHaveBeenCalledTimes(1));
    enviarArquivo('Apólice de responsabilidade civil (PDF ou foto)', arquivo('apolice.pdf'));
    await waitFor(() => expect(api.enviarDocumentoDaFrota).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('Documento enviado')).toHaveLength(2);

    preencher('Validade da apólice', '2026-11-17');
    tocar('Continuar');
    await etapa('Cadastro: Pix');
    const { etapa: proxima, dados } = rascunhoSalvo(api);
    expect(proxima).toBe(4);
    expect(dados).toMatchObject({ apoliceValidade: '2026-11-17' });
    expect(dados.alvaraArquivo).toMatch(/^5555.*\.pdf$/);
    expect(dados.apoliceArquivo).toMatch(/^5555.*\.pdf$/);
    expect(dados.alvaraArquivo).not.toBe(dados.apoliceArquivo);
  });

  it('recusa formato e tamanho fora do limite com mensagem clara', async () => {
    const api = await abrir();
    enviarArquivo('Alvará (PDF ou foto)', arquivo('video.mp4', 'video/mp4'));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Formato não aceito. Envie um PDF ou uma foto.',
    );
    enviarArquivo(
      'Alvará (PDF ou foto)',
      arquivo('grande.pdf', 'application/pdf', TAMANHO_MAXIMO_DOCUMENTO_BYTES + 1),
    );
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('O arquivo passa de 10 MB.'),
    );
    // Nada foi gravado no rascunho: o arquivo recusado não vira documento.
    expect(api.salvarRascunhoFrota).not.toHaveBeenCalled();
  });

  it.each([
    [
      '2026-10-17',
      'A apólice está vencida. Envie uma apólice com validade a partir de 17/11/2026.',
    ],
    [
      '2026-11-16',
      'A apólice vence em menos de 30 dias. Envie uma apólice com validade a partir de 17/11/2026.',
    ],
  ])('apólice com validade %s é recusada pelo formulário: "%s"', async (validade, mensagem) => {
    const api = await abrir({
      rascunho: {
        etapa: 3,
        dados: { ...DADOS_DA_ETAPA_2, alvaraArquivo: 'a/x.pdf', apoliceArquivo: 'a/y.pdf' },
      },
    });
    preencher('Validade da apólice', validade);
    tocar('Continuar');
    expect((await screen.findByRole('alert')).textContent).toBe(mensagem);
    expect(screen.getByRole('main', { name: 'Cadastro: documentos' })).toBeTruthy();
    expect(api.salvarRascunhoFrota).not.toHaveBeenCalled();
  });

  it('a apólice que vale exatamente 30 dias passa', async () => {
    const api = await abrir({
      rascunho: {
        etapa: 3,
        dados: { ...DADOS_DA_ETAPA_2, alvaraArquivo: 'a/x.pdf', apoliceArquivo: 'a/y.pdf' },
      },
    });
    preencher('Validade da apólice', '2026-11-17');
    tocar('Continuar');
    await etapa('Cadastro: Pix');
    expect(api.salvarRascunhoFrota).toHaveBeenCalled();
  });

  it('sem os dois documentos e a validade, não segue', async () => {
    await abrir();
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('o documento enviado fica no rascunho mesmo se a pessoa sair antes de continuar', async () => {
    const api = await abrir();
    enviarArquivo('Alvará (PDF ou foto)', arquivo('alvara.pdf'));
    await waitFor(() => expect(api.salvarRascunhoFrota).toHaveBeenCalled());
    expect(rascunhoSalvo(api)).toMatchObject({ etapa: 3 });
    expect(rascunhoSalvo(api).dados.alvaraArquivo).toMatch(/\.pdf$/);
  });
});

describe('Etapa 4: Pix', () => {
  it('exige a chave e segue para os termos', async () => {
    const api = semPerfil({ rascunho: { etapa: 4, dados: DADOS_DA_ETAPA_3 } });
    renderEm('/cadastro', api);
    await retomar();
    await etapa('Cadastro: Pix');
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    preencher('Chave Pix', ' aurora@exemplo.com ');
    tocar('Continuar');
    await etapa('Cadastro: termos');
    expect(rascunhoSalvo(api)).toEqual({ etapa: 5, dados: DADOS_DA_ETAPA_4 });
  });
});

describe('Etapa 5: termos e envio', () => {
  const abrir = async (api = semPerfil({ rascunho: { etapa: 5, dados: DADOS_DA_ETAPA_4 } })) => {
    renderEm('/cadastro', api);
    await retomar();
    await etapa('Cadastro: termos');
    return api;
  };

  it('só envia com o aceite; manda a versão dos termos (a hora é do servidor)', async () => {
    const api = await abrir();
    const enviar = screen.getByRole('button', { name: 'Enviar cadastro' }) as HTMLButtonElement;
    expect(enviar.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Ler os termos para prestadores' }));
    expect(screen.getByLabelText('Termos para prestadores')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Li e aceito os termos para prestadores.'));
    expect(enviar.disabled).toBe(false);
    fireEvent.click(enviar);

    expect(await etapa('Minha Frota')).toBeTruthy();
    expect(api.enviarCadastroFrota).toHaveBeenCalledTimes(1);
    const { dados } = rascunhoSalvo(api);
    expect(dados.termosVersao).toMatch(/^prestadores-/);
    // O app não manda hora de aceite nenhuma.
    expect(JSON.stringify(rascunhoSalvo(api))).not.toMatch(/aceite_|termos_em|termosEm/);
  });

  it('mostra o motivo quando o servidor recusa o envio e deixa tentar de novo', async () => {
    const api = await abrir();
    api.enviarCadastroFrota.mockRejectedValueOnce(
      new ErroApi('cpf_ja_cadastrado', 'CPF já cadastrado em outra conta'),
    );
    fireEvent.click(screen.getByLabelText('Li e aceito os termos para prestadores.'));
    tocar('Enviar cadastro');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Este CPF já está cadastrado em outra conta.',
    );
    expect(screen.getByRole('main', { name: 'Cadastro: termos' })).toBeTruthy();

    tocar('Enviar cadastro');
    expect(await etapa('Minha Frota')).toBeTruthy();
  });

  it('apólice recusada pelo servidor (relógio do aparelho adiantado) volta com a mensagem', async () => {
    const api = await abrir();
    api.enviarCadastroFrota.mockRejectedValueOnce(
      new ErroApi('apolice_curta', 'A apólice precisa valer por pelo menos 30 dias.'),
    );
    fireEvent.click(screen.getByLabelText('Li e aceito os termos para prestadores.'));
    tocar('Enviar cadastro');
    expect((await screen.findByRole('alert')).textContent).toMatch(/apólice.*30 dias/);
  });
});

describe('Retomada do cadastro', () => {
  it('oferece continuar e abre na etapa em que a pessoa parou, com os dados do banco', async () => {
    const api = semPerfil({ rascunho: { etapa: 3, dados: DADOS_DA_ETAPA_3 } });
    renderEm('/cadastro', api);
    const continuar = await screen.findByRole('button', { name: 'Continuar meu cadastro' });
    expect(screen.queryByRole('button', { name: 'Cadastrar minha Frota' })).toBeNull();
    fireEvent.click(continuar);
    const tela = await etapa('Cadastro: documentos');
    expect(tela.textContent).toContain('Etapa 3 de 5');
    expect(within(tela).getAllByText('Documento enviado')).toHaveLength(2);
    expect((screen.getByLabelText('Validade da apólice') as HTMLInputElement).value).toBe(
      '2026-11-17',
    );

    tocar('Voltar');
    await etapa('Cadastro: endereço');
    expect((screen.getByLabelText('CEP') as HTMLInputElement).value).toBe('70000-000');
  });

  it('o que foi salvo numa tela reaparece ao abrir o app de novo (rascunho no banco)', async () => {
    const api = semPerfil();
    await comecar(api);
    await etapa('Cadastro: dados');
    preencher('Nome completo', 'Aurora Lima');
    preencher('CPF', CPF);
    tocar('Continuar');
    await etapa('Cadastro: endereço');
    cleanup();

    // Outro aparelho, mesma conta: o dublê guarda o rascunho como o banco.
    renderEm('/cadastro', api);
    await retomar();
    await etapa('Cadastro: endereço');
    tocar('Voltar');
    await etapa('Cadastro: dados');
    expect((screen.getByLabelText('Nome completo') as HTMLInputElement).value).toBe('Aurora Lima');
  });

  it('se não conseguir gravar o rascunho, avisa e não anda', async () => {
    const api = semPerfil();
    api.salvarRascunhoFrota.mockRejectedValueOnce(new ErroApi('falha', 'x'));
    await comecar(api);
    await etapa('Cadastro: dados');
    preencher('Nome completo', 'Aurora Lima');
    preencher('CPF', CPF);
    tocar('Continuar');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não foi possível salvar o cadastro. Tente de novo.',
    );
    expect(screen.getByRole('main', { name: 'Cadastro: dados' })).toBeTruthy();
  });
});

describe('Minha Frota (depois do envio)', () => {
  it('mostra cada documento com o estado e o motivo da recusa; Sair encerra a sessão', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_AURORA,
      frota: {
        id: 'f1',
        tipo: 'autonomo',
        documento: CPF,
        nome: 'Aurora Guinchos',
        ativa: false,
        baseCep: '70000000',
        baseEndereco: 'SQN 308',
        baseBairro: 'Asa Norte',
        chavePix: 'x',
        apoliceValidade: '2026-11-17',
        termosPrestadorVersao: 'v',
        itens: [
          { ...ITEM_ALVARA, estado: 'aprovado' },
          { ...ITEM_APOLICE, estado: 'recusado', motivo: 'Sem a plataforma como cossegurada' },
        ],
      },
    });
    renderEm('/frota', api);
    const tela = await etapa('Minha Frota');
    expect(tela.textContent).toContain('Aurora Guinchos');
    expect(tela.textContent).toContain('Em análise pela operação');
    expect(tela.textContent).toContain('Alvará');
    expect(tela.textContent).toContain('Aprovado');
    expect(tela.textContent).toContain('Apólice de responsabilidade civil');
    expect(tela.textContent).toContain('Recusado');
    expect(tela.textContent).toContain('Sem a plataforma como cossegurada');

    tocar('Sair');
    expect(await screen.findByLabelText('Celular com DDD')).toBeTruthy();
    expect(api.sair).toHaveBeenCalled();
  });

  it('quem não tem Frota enviada é levado ao cadastro', async () => {
    renderEm('/frota', semPerfil());
    expect(await screen.findByRole('button', { name: 'Cadastrar minha Frota' })).toBeTruthy();
  });
});
