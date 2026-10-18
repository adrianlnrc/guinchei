import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi } from '@guinchei/api';
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

  it('as Fotos de estado são opcionais: a prévia abre e volta para a Corrida', async () => {
    const api = apiFalsa({ sessao: true, corrida: corridaDaOferta(ofertaDeTeste(), 'no_local') });
    renderEm('/corrida', api);
    fireEvent.click(await screen.findByRole('button', { name: /Fotos de estado/ }));
    expect(await screen.findByText(/as fotos ainda não são gravadas/)).toBeTruthy();
    tocar('Voltar à Corrida');
    expect(await screen.findByRole('button', { name: 'Carreguei' })).toBeTruthy();
  });

  it('sem Corrida em andamento, a tela da Corrida volta ao plantão', async () => {
    renderEm('/corrida', apiFalsa({ sessao: true }));
    expect(await plantao()).toBeTruthy();
  });
});
