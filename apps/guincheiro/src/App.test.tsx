import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi, type FotoEstado } from '@guinchei/api';
import {
  CODIGO_CERTO,
  PERFIL_RAFAEL,
  apiFalsa,
  corridaDaOferta,
  ofertaDeTeste,
} from './teste/apiFalsa';
import { renderEm } from './teste/renderizar';

afterEach(cleanup);

const tocar = (nome: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name: nome }));

async function entrar(celular: string, codigo = CODIGO_CERTO) {
  fireEvent.change(await screen.findByLabelText('Celular com DDD'), {
    target: { value: celular },
  });
  tocar('Receber código');
  fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), {
    target: { value: codigo },
  });
  tocar('Confirmar');
}

const plantao = () => screen.findByRole('main', { name: 'Em plantão' });
const ACOES = ['Saí para o local', 'Cheguei', 'Carreguei', 'Entreguei'];

/** Botões de etapa da Corrida que estão na tela. */
function acoesNaTela() {
  return ACOES.filter((nome) => screen.queryByRole('button', { name: nome }));
}

describe('Entrada do Guincheiro por telefone e código', () => {
  it('o Guincheiro do seed entra com o código e cai no plantão', async () => {
    const api = apiFalsa();
    renderEm('/', api);
    await entrar('(61) 90000-0002');
    expect(await plantao()).toBeTruthy();
    expect(api.enviarCodigo).toHaveBeenCalledWith('+5561900000002');
    expect(api.confirmarCodigo).toHaveBeenCalledWith('+5561900000002', CODIGO_CERTO);
  });

  it('número com perfil de Cliente: avisa que não é Guincheiro, sai e não oferece cadastro', async () => {
    const api = apiFalsa({ perfil: PERFIL_RAFAEL });
    renderEm('/', api);
    await entrar('61900000001');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Este número não está cadastrado como Guincheiro.',
    );
    expect(api.sair).toHaveBeenCalled();
    expect(screen.queryByText(/cadastr(e|ar)-se|criar conta|cadastro/i)).toBeNull();
    expect(screen.queryByRole('main', { name: 'Em plantão' })).toBeNull();
  });

  it('número sem perfil nenhum: o mesmo aviso, sem cadastro', async () => {
    const api = apiFalsa({ perfil: null });
    renderEm('/', api);
    await entrar('61900000006');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Este número não está cadastrado como Guincheiro.',
    );
    expect(api.sair).toHaveBeenCalled();
  });

  it('código errado avisa e fica na tela do código', async () => {
    renderEm('/', apiFalsa());
    await entrar('61900000002', '000000');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Código incorreto/);
    expect(screen.getByRole('heading', { name: 'Digite o código' })).toBeTruthy();
  });

  it('com sessão de Guincheiro guardada, abre direto no plantão', async () => {
    renderEm('/', apiFalsa({ sessao: true }));
    expect(await plantao()).toBeTruthy();
  });

  it('com sessão guardada de quem não é Guincheiro, sai e pede o celular', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    renderEm('/', api);
    expect(await screen.findByLabelText('Celular com DDD')).toBeTruthy();
    expect(api.sair).toHaveBeenCalled();
  });
});

describe('Plantão', () => {
  it('o interruptor grava a disponibilidade', async () => {
    const api = apiFalsa({ sessao: true });
    renderEm('/', api);
    const interruptor = await screen.findByRole('switch', { name: 'Disponível para chamados' });
    await waitFor(() => expect(interruptor.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(interruptor);
    expect(await screen.findByText('Fora do plantão')).toBeTruthy();
    expect(api.definirDisponibilidade).toHaveBeenCalledWith(false);
  });

  it('abre com a disponibilidade gravada no servidor', async () => {
    renderEm('/', apiFalsa({ sessao: true, disponivel: false }));
    expect(await screen.findByText('Fora do plantão')).toBeTruthy();
  });

  it('não promete o chamado com a tela bloqueada (push espera o spike #3)', async () => {
    renderEm('/', apiFalsa({ sessao: true }));
    const tela = await plantao();
    await screen.findByText('Disponível');
    expect(tela.textContent).not.toMatch(/toca mesmo com a tela bloqueada/);
    expect(tela.textContent).toMatch(/Mantenha o app aberto/);
  });

  it('a oferta que chega pelo Realtime abre o chamado sozinha', async () => {
    const api = apiFalsa({ sessao: true });
    renderEm('/', api);
    await plantao();
    act(() => api.ofertar(ofertaDeTeste()));
    expect(await screen.findByRole('main', { name: 'Novo chamado' })).toBeTruthy();
  });
});

describe('Chamado', () => {
  it('mostra o repasse pela distância do próprio Guincheiro e o trajeto do Pedido', async () => {
    renderEm('/', apiFalsa({ sessao: true, ofertas: [ofertaDeTeste()] }));
    const chamado = await screen.findByRole('main', { name: 'Novo chamado' });
    expect(chamado.textContent).toContain('R$ 213,44');
    expect(chamado.textContent).toContain('R$ 266,80');
    expect(chamado.textContent).toContain('SQS 308, Asa Sul');
    expect(chamado.textContent).toContain('5,1 km de você');
    expect(chamado.textContent).toContain('Oficina do Zé, QNM 40, Ceilândia');
    expect(chamado.textContent).toContain('24,6 km de reboque');
    expect(chamado.textContent).toContain('SUV ou picape');
    expect(chamado.textContent).toContain('Batida');
    expect(chamado.textContent).toContain('Rodas travadas');
  });

  it('conta o prazo pelo expira_em e pela hora do servidor, não pelo relógio do aparelho', async () => {
    // O aparelho está 1 h atrasado: pelo relógio dele, faltaria 1 h e 12 s.
    renderEm('/', apiFalsa({ sessao: true, ofertas: [ofertaDeTeste(12)] }));
    await screen.findByRole('main', { name: 'Novo chamado' });
    expect(await screen.findByText(/^0:1[12]$/)).toBeTruthy();
  });

  it('aceitar cria a Corrida e abre a tela dela', async () => {
    const api = apiFalsa({ sessao: true, ofertas: [ofertaDeTeste()] });
    renderEm('/', api);
    await screen.findByRole('main', { name: 'Novo chamado' });
    tocar('Aceitar Corrida');
    expect(await screen.findByRole('button', { name: 'Saí para o local' })).toBeTruthy();
    expect(api.aceitarOferta).toHaveBeenCalledWith(41);
  });

  it('recusar avisa e volta ao plantão', async () => {
    const api = apiFalsa({ sessao: true, ofertas: [ofertaDeTeste()] });
    renderEm('/', api);
    await screen.findByRole('main', { name: 'Novo chamado' });
    tocar('Recusar');
    expect(await plantao()).toBeTruthy();
    expect(api.recusarOferta).toHaveBeenCalledWith(41);
    expect(screen.getByRole('status').textContent).toBe(
      'Chamado recusado. Ele passa ao próximo Guincheiro.',
    );
  });

  it('vencido o prazo, avisa que expirou e volta ao plantão', async () => {
    renderEm('/', apiFalsa({ sessao: true, ofertas: [ofertaDeTeste(1)] }));
    await screen.findByRole('main', { name: 'Novo chamado' });
    expect(await plantao()).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      'O chamado expirou e passou ao próximo Guincheiro.',
    );
  });

  it('aceitar uma oferta que não está mais disponível avisa e volta ao plantão', async () => {
    const api = apiFalsa({ sessao: true, ofertas: [ofertaDeTeste()] });
    api.aceitarOferta.mockRejectedValueOnce(new ErroApi('oferta_indisponivel', 'x'));
    renderEm('/', api);
    await screen.findByRole('main', { name: 'Novo chamado' });
    tocar('Aceitar Corrida');
    expect(await plantao()).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Esta oferta não está mais disponível.');
  });
});

describe('Corrida', () => {
  function comCorrida() {
    return apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), 'aceita') });
  }

  it('com Corrida em andamento, o plantão abre a Corrida', async () => {
    renderEm('/', comCorrida());
    expect(await screen.findByRole('button', { name: 'Saí para o local' })).toBeTruthy();
  });

  it('os botões aparecem um de cada vez, na ordem, até a entrega, sem exigir fotos', async () => {
    const api = comCorrida();
    renderEm('/corrida', api);
    for (const acao of ACOES) {
      await screen.findByRole('button', { name: acao });
      // Só a próxima etapa válida aparece; as outras não.
      expect(acoesNaTela()).toEqual([acao]);
      tocar(acao);
      // Sem fotos, "Carreguei" e "Entreguei" pedem a confirmação do aviso; as fotos são opcionais.
      if (acao === 'Carreguei' || acao === 'Entreguei') {
        fireEvent.click(await screen.findByRole('button', { name: 'Seguir sem fotos' }));
      }
    }
    expect(await screen.findByText('Seu repasse')).toBeTruthy();
    expect(api.avancarCorrida.mock.calls.map(([, para]) => para)).toEqual([
      'a_caminho',
      'no_local',
      'carregado',
      'entregue',
    ]);
  });

  it('depois de entregue, o repasse mostrado é o gravado na Corrida', async () => {
    const api = apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), 'carregado') });
    renderEm('/corrida', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Entreguei' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir sem fotos' }));
    const repasse = await screen.findByRole('main', { name: 'Repasse e avaliação do Cliente' });
    expect(repasse.textContent).toContain('R$ 213,44');
    expect(repasse.textContent).toContain('R$ 266,80');
    expect(repasse.textContent).toContain('− R$ 53,36');
    tocar('5');
    tocar('Voltar ao plantão');
    expect(await plantao()).toBeTruthy();
  });

  it('se a Corrida mudou fora do app, o avanço inválido avisa e a tela mostra a etapa certa', async () => {
    const api = comCorrida();
    renderEm('/corrida', api);
    await screen.findByRole('button', { name: 'Saí para o local' });
    act(() => api.mudarCorrida('no_local'));
    tocar('Saí para o local');
    expect(await screen.findByRole('button', { name: 'Carreguei' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      'A Corrida está em outra etapa. Atualizamos a tela.',
    );
  });

  it('as Fotos de estado são opcionais: a tela abre e volta para a Corrida', async () => {
    const api = apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), 'no_local') });
    renderEm('/corrida', api);
    fireEvent.click(await screen.findByRole('button', { name: /Fotos de estado/ }));
    expect(await screen.findByText(/São opcionais/)).toBeTruthy();
    tocar('Voltar à Corrida');
    expect(await screen.findByRole('button', { name: 'Carreguei' })).toBeTruthy();
  });

  it('sem Corrida em andamento, a tela da Corrida volta ao plantão', async () => {
    renderEm('/corrida', apiFalsa({ sessao: true }));
    expect(await plantao()).toBeTruthy();
  });
});

const PNG = () => new File([new Uint8Array([137, 80, 78, 71])], 'carro.png', { type: 'image/png' });

/** Escolhe um arquivo no campo da câmera, como o celular faria. */
function escolher(arquivo: File) {
  fireEvent.change(screen.getByLabelText('Escolher foto ou vídeo'), {
    target: { files: [arquivo] },
  });
}

/** Faz o navegador "ler" a duração de qualquer vídeo como `segundos` (o jsdom não decodifica). */
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

function fotoDoGuincheiro(etapa: FotoEstado['etapa'], n = 1): FotoEstado {
  return {
    id: `f-${etapa}-${n}`,
    corridaId: 'corrida-1',
    papelAutor: 'guincheiro',
    tipo: 'foto',
    etapa,
    criadoEm: '2026-10-18T17:32:00Z',
    latitude: null,
    longitude: null,
    url: `https://armazenamento.teste/${etapa}-${n}`,
  };
}

describe('Fotos de estado do Guincheiro', () => {
  it('registra uma foto na etapa "antes" com a câmera, grava de verdade e mostra na galeria', async () => {
    const api = apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), 'no_local') });
    renderEm('/fotos', api);
    const campo = await screen.findByLabelText('Escolher foto ou vídeo');
    expect(campo.getAttribute('accept')).toBe('image/*,video/*');
    expect(campo.getAttribute('capture')).toBe('environment');

    escolher(PNG());
    expect(await screen.findByAltText(/Foto: Guincheiro às/)).toBeTruthy();
    expect(api.registrarFotoEstado).toHaveBeenCalledWith('corrida-1', expect.any(File), {
      etapa: 'antes',
    });
    expect(screen.getByText('Seus itens nesta etapa: 1 de 6')).toBeTruthy();
  });

  it('em carregado a etapa é "depois"', async () => {
    const api = apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), 'carregado') });
    renderEm('/fotos', api);
    await screen.findByLabelText('Escolher foto ou vídeo');
    escolher(PNG());
    await screen.findByAltText(/Foto: Guincheiro às/);
    expect(api.registrarFotoEstado.mock.calls[0]?.[2]).toMatchObject({ etapa: 'depois' });
  });

  it('recusa vídeo com mais de 30 s sem enviar; aceita um de 30 s', async () => {
    const api = apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), 'no_local') });
    renderEm('/fotos', api);
    await screen.findByLabelText('Escolher foto ou vídeo');
    const video = () => new File([new Uint8Array([0])], 'v.mp4', { type: 'video/mp4' });

    videosComDuracao(31);
    escolher(video());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Vídeo com mais de 30 s. Grave um mais curto.',
    );
    expect(api.registrarFotoEstado).not.toHaveBeenCalled();

    videosComDuracao(30);
    escolher(video());
    expect(await screen.findByLabelText(/Vídeo: Guincheiro às/)).toBeTruthy();
    expect(api.registrarFotoEstado).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('trava em 6 itens por etapa na tela', async () => {
    const seis = [1, 2, 3, 4, 5, 6].map((n) => fotoDoGuincheiro('antes', n));
    const api = apiFalsa({
      sessao: true,
      corrida: corridaDaOferta(ofertaDeTeste(), 'no_local'),
      fotos: seis,
    });
    renderEm('/fotos', api);
    expect(await screen.findByText('Seus itens nesta etapa: 6 de 6')).toBeTruthy();
    const botao = screen.getByRole('button', { name: 'Tirar foto ou vídeo' }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    escolher(PNG());
    expect((await screen.findByRole('alert')).textContent).toContain('Limite de 6 itens');
    expect(api.registrarFotoEstado).not.toHaveBeenCalled();
  });

  it('mostra o erro quando o envio falha', async () => {
    const api = apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), 'no_local') });
    api.registrarFotoEstado.mockRejectedValueOnce(new Error('rede'));
    renderEm('/fotos', api);
    await screen.findByLabelText('Escolher foto ou vídeo');
    escolher(PNG());
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível enviar');
  });
});

describe('Aviso antes de "Carreguei" e "Entreguei"', () => {
  const AVISO = 'Registrar fotos protege você se houver reclamação de avaria.';

  it.each([
    ['no_local', 'Carreguei', 'carregado'],
    ['carregado', 'Entreguei', 'entregue'],
  ] as const)(
    'em %s, sem fotos da etapa, "%s" mostra o aviso e só avança com a confirmação',
    async (estado, botao, proximo) => {
      const api = apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), estado) });
      renderEm('/corrida', api);
      fireEvent.click(await screen.findByRole('button', { name: botao }));

      const aviso = await screen.findByRole('alertdialog');
      expect(aviso.textContent).toContain(AVISO);
      expect(api.avancarCorrida).not.toHaveBeenCalled();

      tocar('Seguir sem fotos');
      await waitFor(() => expect(api.avancarCorrida).toHaveBeenCalledWith('corrida-1', proximo));
    },
  );

  it('"Registrar fotos" no aviso leva à tela de fotos sem avançar a Corrida', async () => {
    const api = apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), 'no_local') });
    renderEm('/corrida', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Carreguei' }));
    await screen.findByRole('alertdialog');
    tocar('Registrar fotos');
    expect(await screen.findByLabelText('Escolher foto ou vídeo')).toBeTruthy();
    expect(api.avancarCorrida).not.toHaveBeenCalled();
  });

  it('com foto do próprio Guincheiro na etapa, avança direto, sem perguntar', async () => {
    const api = apiFalsa({
      sessao: true,
      corrida: corridaDaOferta(ofertaDeTeste(), 'no_local'),
      fotos: [fotoDoGuincheiro('antes')],
    });
    renderEm('/corrida', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Carreguei' }));
    await waitFor(() => expect(api.avancarCorrida).toHaveBeenCalledWith('corrida-1', 'carregado'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('foto de outra etapa não conta: em carregado com foto só de "antes", pergunta', async () => {
    const api = apiFalsa({
      sessao: true,
      corrida: corridaDaOferta(ofertaDeTeste(), 'carregado'),
      fotos: [fotoDoGuincheiro('antes')],
    });
    renderEm('/corrida', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Entreguei' }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
  });

  it('"Saí para o local" e "Cheguei" não pedem confirmação', async () => {
    const api = apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), 'aceita') });
    renderEm('/corrida', api);
    fireEvent.click(await screen.findByRole('button', { name: 'Saí para o local' }));
    await screen.findByRole('button', { name: 'Cheguei' });
    tocar('Cheguei');
    expect(await screen.findByRole('button', { name: 'Carreguei' })).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
