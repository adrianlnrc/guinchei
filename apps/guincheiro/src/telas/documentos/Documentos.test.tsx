import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi, type ItemHomologacao, type MeusDocumentos, type MinhaFrota } from '@guinchei/api';
import { ITEM_ALVARA, ITEM_APOLICE, PERFIL_AURORA, apiFalsa } from '../../teste/apiFalsa';
import { renderEm } from '../../teste/renderizar';

afterEach(cleanup);

/** AAAA-MM-DD de hoje mais `dias`, pelo calendário do aparelho (o mesmo que o formulário usa). */
function emDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}
/** Hoje menos `anos` anos e mais `dias` dias. */
function haAnos(anos: number, dias = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anos);
  d.setDate(d.getDate() + dias);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

const item = (
  tipo: ItemHomologacao['tipo'],
  campos: Partial<ItemHomologacao> = {},
): ItemHomologacao => ({
  id: `item-${tipo}`,
  alvo: 'guincheiro',
  alvoId: PERFIL_AURORA.id,
  tipo,
  estado: 'pendente',
  motivo: null,
  validade: null,
  enviadoEm: '2026-10-23T12:00:00Z',
  ...campos,
});

const cnhPendente: MeusDocumentos['cnh'] = {
  ...item('cnh', { validade: '2030-05-20' }),
  dados: { numero: '04512398765', categoria: 'C', validade: '2030-05-20', ear: true },
};
const antecedentesPendente: MeusDocumentos['antecedentes'] = {
  ...item('antecedentes', { validade: '2027-03-10' }),
  emissao: '2026-03-10',
};

const docs = (parcial: Partial<MeusDocumentos> = {}): MeusDocumentos => ({
  cnh: null,
  antecedentes: null,
  selfie: null,
  ...parcial,
});

const tocar = (nome: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nome }));
const preencher = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const escolher = (rotulo: string, nome = 'documento.jpg', tipo = 'image/jpeg') =>
  fireEvent.change(screen.getByLabelText(rotulo), {
    target: { files: [new File(['x'], nome, { type: tipo })] },
  });
const tela = (nome: string) => screen.findByRole('main', { name: nome });
const cartao = (nome: string) => screen.getByRole('listitem', { name: nome });

const guincheiro = (extra: Parameters<typeof apiFalsa>[0] = {}) =>
  apiFalsa({ sessao: true, disponivel: false, ...extra });

describe('Documentos: resumo das três etapas', () => {
  it('sem nenhum documento, explica o que fazer e oferece enviar cada um', async () => {
    renderEm('/guincheiro/documentos', guincheiro());
    await tela('Documentos');

    expect(screen.getByRole('heading', { name: 'Envie os seus documentos' })).toBeTruthy();
    expect(
      screen.getByText(/Você ainda não enviou nenhum documento. Comece pela CNH/),
    ).toBeTruthy();
    for (const nome of ['CNH', 'Certidão de antecedentes', 'Selfie']) {
      expect(within(cartao(nome)).getByText('Não enviado')).toBeTruthy();
      expect(within(cartao(nome)).getByRole('button', { name: `Enviar ${nome}` })).toBeTruthy();
    }
  });

  it('mostra o estado de cada documento: dados, validade, motivo da recusa e reenvio', async () => {
    renderEm(
      '/guincheiro/documentos',
      guincheiro({
        documentos: docs({
          cnh: cnhPendente,
          antecedentes: {
            ...antecedentesPendente!,
            estado: 'recusado',
            motivo: 'Certidão da PF ilegível',
          },
          selfie: item('selfie', { estado: 'aprovado' }),
        }),
      }),
    );
    await tela('Documentos');

    expect(screen.getByRole('heading', { name: 'Há documento para reenviar' })).toBeTruthy();
    const cnh = cartao('CNH');
    expect(within(cnh).getByText('Em análise')).toBeTruthy();
    expect(within(cnh).getByText('Categoria C · validade 20/05/2030')).toBeTruthy();
    expect(within(cnh).queryByRole('button')).toBeNull();

    const antecedentes = cartao('Certidão de antecedentes');
    expect(within(antecedentes).getByText('Recusado')).toBeTruthy();
    expect(within(antecedentes).getByText(/Certidão da PF ilegível/)).toBeTruthy();
    expect(
      within(antecedentes).getByText('Emitida em 10/03/2026 · vale 12 meses, até 10/03/2027'),
    ).toBeTruthy();
    expect(
      within(antecedentes).getByRole('button', { name: 'Reenviar Certidão de antecedentes' }),
    ).toBeTruthy();

    expect(within(cartao('Selfie')).getByText('Aprovado')).toBeTruthy();
    expect(within(cartao('Selfie')).queryByRole('button')).toBeNull();
  });

  it('item vencido pede um documento novo', async () => {
    renderEm(
      '/guincheiro/documentos',
      guincheiro({ documentos: docs({ cnh: { ...cnhPendente!, estado: 'vencido' } }) }),
    );
    await tela('Documentos');
    expect(within(cartao('CNH')).getByText('Vencido')).toBeTruthy();
    expect(
      within(cartao('CNH')).getByText('A validade passou. Envie um documento novo.'),
    ).toBeTruthy();
    expect(within(cartao('CNH')).getByRole('button', { name: 'Reenviar CNH' })).toBeTruthy();
  });

  it('com os três em análise, diz "aguardando homologação"', async () => {
    renderEm(
      '/guincheiro/documentos',
      guincheiro({
        documentos: docs({
          cnh: cnhPendente,
          antecedentes: antecedentesPendente,
          selfie: item('selfie'),
        }),
      }),
    );
    await tela('Documentos');
    expect(screen.getByRole('heading', { name: 'Aguardando homologação' })).toBeTruthy();
    expect(screen.getByText(/Você ainda não recebe chamados/)).toBeTruthy();
  });

  it('com os três aprovados, avisa que a Frota também precisa estar ativa', async () => {
    renderEm(
      '/guincheiro/documentos',
      guincheiro({
        documentos: docs({
          cnh: { ...cnhPendente!, estado: 'aprovado' },
          antecedentes: { ...antecedentesPendente!, estado: 'aprovado' },
          selfie: item('selfie', { estado: 'aprovado' }),
        }),
      }),
    );
    await tela('Documentos');
    expect(screen.getByRole('heading', { name: 'Documentos aprovados' })).toBeTruthy();
  });

  it('se a leitura falha, avisa em vez de mostrar tudo como "não enviado"', async () => {
    const api = guincheiro();
    api.buscarMeusDocumentos.mockRejectedValue(new ErroApi('falha', 'x'));
    renderEm('/guincheiro/documentos', api);
    await tela('Documentos');
    expect(screen.getByRole('alert').textContent).toBe('Confira a conexão e tente de novo.');
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('sem sessão vai à entrada; o convidado, aos dados pessoais', async () => {
    renderEm('/guincheiro/documentos', apiFalsa({ sessao: false }));
    expect(await screen.findByLabelText('Celular com DDD')).toBeTruthy();
    cleanup();

    renderEm(
      '/guincheiro/documentos',
      apiFalsa({ sessao: true, perfil: null, convite: { frotaNome: 'Reboque Planalto' } }),
    );
    expect(await tela('Dados pessoais')).toBeTruthy();
  });

  it('o plantão leva aos documentos pelo aviso de homologação', async () => {
    renderEm('/', guincheiro());
    const aviso = await screen.findByRole('region', { name: 'Homologação' });
    expect(within(aviso).getByText('Envie os seus documentos')).toBeTruthy();
    fireEvent.click(within(aviso).getByRole('button', { name: 'Enviar documentos' }));
    expect(await tela('Documentos')).toBeTruthy();
  });

  it('o aviso do plantão some com tudo aprovado, e não aparece em quem já está disponível', async () => {
    const aprovados = docs({
      cnh: { ...cnhPendente!, estado: 'aprovado' },
      antecedentes: { ...antecedentesPendente!, estado: 'aprovado' },
      selfie: item('selfie', { estado: 'aprovado' }),
    });
    const api = guincheiro({ documentos: aprovados });
    renderEm('/', api);
    await tela('Em plantão');
    await waitFor(() => expect(api.buscarMeusDocumentos).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Homologação' })).toBeNull();
    cleanup();

    renderEm('/', apiFalsa({ sessao: true, disponivel: true }));
    await tela('Em plantão');
    expect(screen.queryByRole('region', { name: 'Homologação' })).toBeNull();
  });
});

describe('Etapa da CNH', () => {
  async function abrir(extra: Parameters<typeof apiFalsa>[0] = {}) {
    const api = guincheiro(extra);
    renderEm('/guincheiro/documentos/cnh', api);
    await tela('CNH');
    await screen.findByLabelText('Número da CNH');
    return api;
  }

  const preencherTudo = (validade = emDias(400)) => {
    preencher('Número da CNH', '04512398765');
    preencher('Categoria', 'C');
    preencher('Validade da CNH', validade);
    fireEvent.click(screen.getByLabelText(/A minha CNH tem a observação EAR/));
    escolher('Foto da CNH', 'cnh.jpg');
  };

  it('mostra a etapa e só oferece categorias que conduzem guincho', async () => {
    await abrir();
    expect(screen.getByText('Etapa 2 de 4')).toBeTruthy();
    const opcoes = within(screen.getByLabelText('Categoria'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(opcoes).toEqual(['Escolha a categoria', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']);
  });

  it('o número aceita só dígitos, no máximo 11', async () => {
    await abrir();
    preencher('Número da CNH', '0451.239-8765 99');
    expect((screen.getByLabelText('Número da CNH') as HTMLInputElement).value).toBe('04512398765');
  });

  it.each([
    ['número curto', () => preencher('Número da CNH', '123'), /11 dígitos/],
    ['categoria vazia', () => preencher('Categoria', ''), /Escolha a categoria/],
    ['validade em branco', () => preencher('Validade da CNH', ''), /Informe a validade/],
    ['CNH vencida', () => preencher('Validade da CNH', emDias(-1)), /A CNH venceu em .* Renove/],
    [
      'sem EAR',
      () => fireEvent.click(screen.getByLabelText(/A minha CNH tem a observação EAR/)),
      /observação EAR/,
    ],
  ])('recusa na tela, sem chamar o servidor: %s', async (_nome, estragar, mensagem) => {
    const api = await abrir();
    preencherTudo();
    estragar();
    tocar('Enviar CNH');
    expect((await screen.findByRole('alert')).textContent).toMatch(mensagem);
    expect(api.enviarArquivoDoGuincheiro).not.toHaveBeenCalled();
    expect(api.enviarCnh).not.toHaveBeenCalled();
  });

  it('exige a foto da CNH', async () => {
    const api = await abrir();
    preencher('Número da CNH', '04512398765');
    preencher('Categoria', 'B');
    preencher('Validade da CNH', emDias(400));
    fireEvent.click(screen.getByLabelText(/A minha CNH tem a observação EAR/));
    tocar('Enviar CNH');
    expect((await screen.findByRole('alert')).textContent).toBe('Anexe a foto da CNH.');
    expect(api.enviarCnh).not.toHaveBeenCalled();
  });

  it('envia a foto e os dados, e volta ao resumo com a CNH em análise', async () => {
    const api = await abrir();
    const validade = emDias(400);
    preencherTudo(validade);
    expect(screen.getByText('Arquivo escolhido: cnh.jpg')).toBeTruthy();
    tocar('Enviar CNH');

    expect(await tela('Documentos')).toBeTruthy();
    expect(api.enviarCnh).toHaveBeenCalledWith({
      numero: '04512398765',
      categoria: 'C',
      validade,
      ear: true,
      arquivo: expect.stringMatching(/documento-1\.jpg$/),
    });
    expect(screen.getByText('CNH enviada. A operação vai conferir.')).toBeTruthy();
    await waitFor(() => expect(within(cartao('CNH')).getByText('Em análise')).toBeTruthy());
    expect(within(cartao('CNH')).getByText(/^Categoria C · validade /)).toBeTruthy();
  });

  it('erro do servidor tem mensagem clara e a nova tentativa não reenvia a foto', async () => {
    const api = await abrir();
    preencherTudo();
    api.enviarCnh.mockRejectedValueOnce(
      new ErroApi('cnh_ja_cadastrada', 'Esta CNH já está cadastrada em outra conta'),
    );
    tocar('Enviar CNH');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Esta CNH já está cadastrada em outra conta',
    );

    preencher('Número da CNH', '98765432100');
    tocar('Enviar CNH');
    expect(await tela('Documentos')).toBeTruthy();
    expect(api.enviarArquivoDoGuincheiro).toHaveBeenCalledTimes(1);
    expect(api.enviarCnh).toHaveBeenCalledTimes(2);
  });

  it('foto que não é imagem nem PDF é recusada com mensagem clara', async () => {
    await abrir();
    preencherTudo();
    escolher('Foto da CNH', 'cnh.exe', 'application/octet-stream');
    tocar('Enviar CNH');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Formato não aceito. Envie um PDF ou uma foto.',
    );
  });

  it('CNH recusada: mostra o motivo, vem com os dados anteriores e reenvia', async () => {
    const api = await abrir({
      documentos: docs({
        cnh: { ...cnhPendente!, estado: 'recusado', motivo: 'Foto cortada, não dá para ler' },
      }),
    });
    expect(screen.getByText('A operação recusou este documento')).toBeTruthy();
    expect(screen.getByText('Foto cortada, não dá para ler')).toBeTruthy();
    expect((screen.getByLabelText('Número da CNH') as HTMLInputElement).value).toBe('04512398765');
    expect((screen.getByLabelText('Categoria') as HTMLSelectElement).value).toBe('C');

    preencher('Validade da CNH', emDias(500));
    fireEvent.click(screen.getByLabelText(/A minha CNH tem a observação EAR/));
    escolher('Foto da CNH', 'cnh-nova.jpg');
    tocar('Enviar CNH');
    expect(await tela('Documentos')).toBeTruthy();
    expect(api.enviarCnh).toHaveBeenCalled();
    await waitFor(() => expect(within(cartao('CNH')).getByText('Em análise')).toBeTruthy());
  });

  it.each([
    ['pendente', 'a operação está conferindo'],
    ['aprovado', 'aprovado pela operação'],
  ] as const)('CNH %s não abre formulário', async (estado, texto) => {
    renderEm(
      '/guincheiro/documentos/cnh',
      guincheiro({ documentos: docs({ cnh: { ...cnhPendente!, estado } }) }),
    );
    expect((await screen.findByRole('status')).textContent).toContain(texto);
    expect(screen.queryByLabelText('Número da CNH')).toBeNull();
  });

  it('Voltar leva ao resumo', async () => {
    await abrir();
    tocar('Voltar aos documentos');
    expect(await tela('Documentos')).toBeTruthy();
  });
});

describe('Etapa dos antecedentes', () => {
  async function abrir(extra: Parameters<typeof apiFalsa>[0] = {}) {
    const api = guincheiro(extra);
    renderEm('/guincheiro/documentos/antecedentes', api);
    await tela('Antecedentes');
    await screen.findByLabelText('Data de emissão da certidão');
    return api;
  }

  it('explica a validade de 12 meses e mostra até quando a certidão vale', async () => {
    await abrir();
    expect(screen.getByText('Etapa 3 de 4')).toBeTruthy();
    expect(screen.getByText(/Ela vale 12 meses a partir da emissão/)).toBeTruthy();

    preencher('Data de emissão da certidão', haAnos(0, -30));
    expect(screen.getByRole('status').textContent).toMatch(
      /^Vale 12 meses: até \d{2}\/\d{2}\/\d{4}\.$/,
    );
  });

  it('emissão com mais de 12 meses é recusada pelo formulário, sem chamar o servidor', async () => {
    const api = await abrir();
    preencher('Data de emissão da certidão', haAnos(1, -1));
    escolher('Arquivo da certidão', 'certidao.pdf', 'application/pdf');
    tocar('Enviar certidão');
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /há mais de 12 meses, e não vale mais/,
    );
    expect(screen.queryByText(/Vale 12 meses: até/)).toBeNull();
    expect(api.enviarAntecedentes).not.toHaveBeenCalled();
  });

  it('emissão exatamente há 12 meses ainda vale (o último dia é hoje)', async () => {
    const api = await abrir();
    preencher('Data de emissão da certidão', haAnos(1));
    escolher('Arquivo da certidão', 'certidao.pdf', 'application/pdf');
    tocar('Enviar certidão');
    expect(await tela('Documentos')).toBeTruthy();
    expect(api.enviarAntecedentes).toHaveBeenCalled();
  });

  it('emissão no futuro, em branco e sem arquivo são recusadas', async () => {
    const api = await abrir();
    preencher('Data de emissão da certidão', emDias(2));
    tocar('Enviar certidão');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'A data de emissão não pode ser no futuro.',
    );

    preencher('Data de emissão da certidão', '');
    tocar('Enviar certidão');
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Informe a data de emissão da certidão.'),
    );

    preencher('Data de emissão da certidão', haAnos(0, -10));
    tocar('Enviar certidão');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Anexe a certidão.'));
    expect(api.enviarAntecedentes).not.toHaveBeenCalled();
  });

  it('envia a emissão e o arquivo, e o resumo mostra os 12 meses de validade', async () => {
    const api = await abrir();
    const emissao = haAnos(0, -20);
    preencher('Data de emissão da certidão', emissao);
    escolher('Arquivo da certidão', 'certidao.pdf', 'application/pdf');
    tocar('Enviar certidão');

    expect(await tela('Documentos')).toBeTruthy();
    expect(api.enviarAntecedentes).toHaveBeenCalledWith({
      emissao,
      arquivo: expect.stringMatching(/documento-1\.jpg$/),
    });
    expect(screen.getByText('Certidão enviada. A operação vai conferir.')).toBeTruthy();
    await waitFor(() =>
      expect(
        within(cartao('Certidão de antecedentes')).getByText(/vale 12 meses, até/),
      ).toBeTruthy(),
    );
  });

  it('certidão vencida volta a pedir envio, com aviso', async () => {
    await abrir({
      documentos: docs({ antecedentes: { ...antecedentesPendente!, estado: 'vencido' } }),
    });
    expect(
      screen.getByText('A certidão anterior venceu. Emita uma nova e envie abaixo.'),
    ).toBeTruthy();
  });
});

describe('Etapa da selfie', () => {
  async function abrir(extra: Parameters<typeof apiFalsa>[0] = {}) {
    const api = guincheiro(extra);
    renderEm('/guincheiro/documentos/selfie', api);
    await tela('Selfie');
    await screen.findByLabelText('Foto da selfie');
    return api;
  }

  it('abre a câmera frontal do aparelho e só aceita imagem', async () => {
    await abrir();
    expect(screen.getByText('Etapa 4 de 4')).toBeTruthy();
    const campo = screen.getByLabelText('Foto da selfie');
    expect(campo.getAttribute('capture')).toBe('user');
    expect(campo.getAttribute('accept')).toBe('image/*');
  });

  it('sem foto, pede para tirar a selfie', async () => {
    const api = await abrir();
    tocar('Enviar selfie');
    expect((await screen.findByRole('alert')).textContent).toBe('Tire a selfie antes de enviar.');
    expect(api.enviarSelfie).not.toHaveBeenCalled();
  });

  it('envia a selfie tirada e o resumo mostra em análise', async () => {
    const api = await abrir();
    escolher('Foto da selfie', 'selfie.jpg');
    expect(screen.getByText('Arquivo escolhido: selfie.jpg')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar selfie' })).toBeTruthy();
    tocar('Enviar selfie');

    expect(await tela('Documentos')).toBeTruthy();
    expect(api.enviarSelfie).toHaveBeenCalledWith(expect.stringMatching(/documento-1\.jpg$/));
    expect(screen.getByText('Selfie enviada. A operação vai conferir.')).toBeTruthy();
    await waitFor(() => expect(within(cartao('Selfie')).getByText('Em análise')).toBeTruthy());
  });

  it('selfie recusada mostra o motivo e deixa tirar outra', async () => {
    const api = await abrir({
      documentos: docs({ selfie: item('selfie', { estado: 'recusado', motivo: 'Rosto de boné' }) }),
    });
    expect(screen.getByText('Rosto de boné')).toBeTruthy();
    escolher('Foto da selfie', 'outra.jpg');
    tocar('Enviar selfie');
    expect(await tela('Documentos')).toBeTruthy();
    expect(api.enviarSelfie).toHaveBeenCalled();
  });
});

describe('Autônomo: a própria linha de Guincheiro', () => {
  const frotaAutonoma = (tipo: MinhaFrota['tipo'] = 'autonomo'): MinhaFrota => ({
    id: 'frota-aurora',
    tipo,
    documento: '52998224725',
    nome: 'Aurora Guinchos',
    ativa: false,
    baseCep: '70000000',
    baseEndereco: 'SQN 308',
    baseBairro: 'Asa Norte',
    chavePix: 'a@exemplo.com',
    apoliceValidade: '2027-10-18',
    termosPrestadorVersao: 'v',
    itens: [ITEM_ALVARA, ITEM_APOLICE],
  });

  it('ao começar a etapa, cria a linha de Guincheiro e abre os documentos', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_AURORA, frota: frotaAutonoma() });
    renderEm('/guincheiro/documentos', api);
    expect(await tela('Documentos')).toBeTruthy();
    expect(api.criarMeuGuincheiro).toHaveBeenCalledTimes(1);
    expect(await api.buscarMeuGuincheiro()).toEqual({
      nome: 'Aurora Lima',
      frota: 'Aurora Guinchos',
      disponivel: false,
    });
    expect(screen.getByRole('button', { name: 'Ver a minha Frota' })).toBeTruthy();
  });

  it('a Frota autônoma mostra o caminho para os documentos de Guincheiro', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_AURORA, frota: frotaAutonoma() });
    renderEm('/frota', api);
    await tela('Minha Frota');
    fireEvent.click(await screen.findByRole('button', { name: 'Meus documentos de Guincheiro' }));
    expect(await tela('Documentos')).toBeTruthy();
    expect(api.criarMeuGuincheiro).toHaveBeenCalled();
  });

  it('depois de virar Guincheiro, o autônomo ainda vê a própria Frota', async () => {
    const api = apiFalsa({
      sessao: true,
      perfil: PERFIL_AURORA,
      frota: frotaAutonoma(),
      guincheiroDaPropriaFrota: true,
      disponivel: false,
    });
    renderEm('/frota', api);
    expect(await screen.findByRole('heading', { name: 'Aurora Guinchos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voltar ao plantão' })).toBeTruthy();
  });

  it('o representante de empresa não vira Guincheiro: volta à Frota, onde convida', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_AURORA, frota: frotaAutonoma('empresa') });
    renderEm('/guincheiro/documentos', api);
    await tela('Minha Frota');
    expect(api.criarMeuGuincheiro).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Meus documentos de Guincheiro' })).toBeNull();
  });

  it('sem Frota cadastrada, vai ao cadastro', async () => {
    renderEm(
      '/guincheiro/documentos',
      apiFalsa({ sessao: true, perfil: PERFIL_AURORA, frota: null }),
    );
    expect(await screen.findByRole('button', { name: 'Cadastrar minha Frota' })).toBeTruthy();
  });

  it('se o servidor falha ao criar a linha, avisa e deixa tentar de novo', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_AURORA, frota: frotaAutonoma() });
    api.criarMeuGuincheiro.mockRejectedValueOnce(new ErroApi('falha', 'x'));
    renderEm('/guincheiro/documentos', api);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Tente de novo/);
    tocar('Tentar de novo');
    expect(await tela('Documentos')).toBeTruthy();
    expect(api.criarMeuGuincheiro).toHaveBeenCalledTimes(2);
  });
});
