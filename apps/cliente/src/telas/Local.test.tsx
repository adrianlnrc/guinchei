import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErroApi } from '@guinchei/api';
import { PERFIL_RAFAEL, apiFalsa } from '../teste/apiFalsa';
import {
  AGUAS_LINDAS,
  EIXO,
  QNA_12,
  SETOR_CENTRAL_GAMA,
  mapasFalsos,
  simularGeolocalizacao,
} from '../teste/mapasFalsos';
import { renderEm } from '../teste/renderizar';

afterEach(cleanup);

const SO_NO_DF = 'O Guinchei atende só no Distrito Federal por enquanto.';

/** Abre o Pedido pelas três perguntas e chega à tela de local. */
async function abrirLocal({
  mapas = mapasFalsos(),
}: { mapas?: ReturnType<typeof mapasFalsos> } = {}) {
  const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
  renderEm('/pedido/1', api, undefined, mapas.mapas);
  fireEvent.click(await screen.findByRole('button', { name: 'Carro de passeio' }));
  fireEvent.click(screen.getByRole('button', { name: 'Parou e não liga' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sim' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar local no mapa' }));
  await screen.findByRole('main', { name: 'Origem e destino' });
  return { api, ...mapas };
}

function digitar(campo: string, texto: string) {
  fireEvent.change(screen.getByLabelText(campo), { target: { value: texto } });
}

async function escolherDestino(texto: string, sugestao: string) {
  digitar('Para onde levamos o carro', texto);
  fireEvent.click(await screen.findByRole('button', { name: sugestao }));
}

describe('Origem e destino com o mapa', () => {
  it('a origem vem da localização do aparelho, com o endereço do ponto', async () => {
    simularGeolocalizacao(EIXO.ponto);
    const { mapa } = await abrirLocal();

    await waitFor(() =>
      expect((screen.getByLabelText('Onde o carro está') as HTMLInputElement).value).toBe(
        EIXO.rotulo,
      ),
    );
    expect(mapa.props?.origem).toEqual(EIXO.ponto);
  });

  it('com a localização negada, avisa e deixa buscar a origem', async () => {
    simularGeolocalizacao('negada');
    const { mapa } = await abrirLocal();

    expect(await screen.findByText(/Não conseguimos sua localização/)).toBeTruthy();
    digitar('Onde o carro está', 'eixo mon');
    fireEvent.click(await screen.findByRole('button', { name: EIXO.rotulo }));
    expect(mapa.props?.origem).toEqual(EIXO.ponto);
  });

  it('busca o destino, mostra a distância e o tempo da rota', async () => {
    simularGeolocalizacao(EIXO.ponto);
    const { servico } = await abrirLocal();
    await screen.findByDisplayValue(EIXO.rotulo);

    await escolherDestino('qna 12', QNA_12.rotulo);

    expect(await screen.findByText('21,3 km de reboque · ~26 min')).toBeTruthy();
    expect(servico.rota).toHaveBeenLastCalledWith(EIXO.ponto, QNA_12.ponto);
  });

  it('busca sem endereço no DF diz que só atendemos o DF', async () => {
    simularGeolocalizacao(EIXO.ponto);
    await abrirLocal();
    digitar('Para onde levamos o carro', 'águas lindas');
    expect(
      await screen.findByText(new RegExp(`Nenhum endereço encontrado. ${SO_NO_DF}`)),
    ).toBeTruthy();
  });

  it('origem fora do DF pela localização é recusada', async () => {
    simularGeolocalizacao(AGUAS_LINDAS);
    const { mapa } = await abrirLocal();

    expect(await screen.findByText(new RegExp(SO_NO_DF))).toBeTruthy();
    expect(mapa.props?.origem).toBeNull();
  });

  it('arrastar um pino para fora do DF é recusado e o ponto não muda', async () => {
    simularGeolocalizacao(EIXO.ponto);
    const { mapa } = await abrirLocal();
    await screen.findByDisplayValue(EIXO.rotulo);

    act(() => mapa.props!.aoMoverOrigem(AGUAS_LINDAS));

    expect(await screen.findByText(new RegExp(SO_NO_DF))).toBeTruthy();
    expect(mapa.props?.origem).toEqual(EIXO.ponto);
  });

  it('arrastar o pino de destino ajusta o destino e recalcula a rota', async () => {
    simularGeolocalizacao(EIXO.ponto);
    const { mapa, servico } = await abrirLocal();
    await escolherDestino('qna 12', QNA_12.rotulo);

    act(() => mapa.props!.aoMoverDestino(SETOR_CENTRAL_GAMA.ponto));

    await screen.findByDisplayValue(SETOR_CENTRAL_GAMA.rotulo);
    await waitFor(() =>
      expect(servico.rota).toHaveBeenLastCalledWith(EIXO.ponto, SETOR_CENTRAL_GAMA.ponto),
    );
  });

  it('confirmar grava o trajeto no Pedido e segue para o Preço fechado', async () => {
    simularGeolocalizacao(EIXO.ponto);
    const { api } = await abrirLocal();
    await screen.findByDisplayValue(EIXO.rotulo);
    await escolherDestino('qna 12', QNA_12.rotulo);
    await screen.findByText('21,3 km de reboque · ~26 min');

    fireEvent.click(screen.getByRole('button', { name: 'Ver preço fechado' }));

    expect(await screen.findByRole('main', { name: 'Preço fechado' })).toBeTruthy();
    expect(api.definirTrajeto).toHaveBeenCalledWith('pedido-novo', {
      origem: EIXO,
      destino: QNA_12,
      kmRebocado: 21.3476,
    });
  });

  it('só libera a confirmação com origem, destino e rota', async () => {
    simularGeolocalizacao(EIXO.ponto);
    await abrirLocal({ mapas: mapasFalsos({ rota: null }) });
    await screen.findByDisplayValue(EIXO.rotulo);
    const confirmar = screen.getByRole('button', { name: 'Ver preço fechado' });
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);

    await escolherDestino('qna 12', QNA_12.rotulo);

    expect(await screen.findByText(/Não encontramos uma rota de carro/)).toBeTruthy();
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
  });

  it('se o banco recusa o trajeto fora do DF, avisa e fica no mapa', async () => {
    simularGeolocalizacao(EIXO.ponto);
    const { api } = await abrirLocal();
    api.definirTrajeto.mockRejectedValueOnce(new ErroApi('fora_do_df', 'fora'));
    await screen.findByDisplayValue(EIXO.rotulo);
    await escolherDestino('qna 12', QNA_12.rotulo);
    await screen.findByText('21,3 km de reboque · ~26 min');

    fireEvent.click(screen.getByRole('button', { name: 'Ver preço fechado' }));

    expect(await screen.findByText(new RegExp(SO_NO_DF))).toBeTruthy();
    expect(screen.getByRole('main', { name: 'Origem e destino' })).toBeTruthy();
  });
});

describe('Origem e destino sem VITE_MAPBOX_TOKEN', () => {
  it('mostra o mapa do protótipo, a busca desligada e segue com os dados do protótipo', async () => {
    const api = apiFalsa({ sessao: true, perfil: PERFIL_RAFAEL });
    renderEm('/local', api);

    expect(screen.getByText('Mapa indisponível: configure VITE_MAPBOX_TOKEN')).toBeTruthy();
    expect((screen.getByLabelText('Para onde levamos o carro') as HTMLInputElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver preço fechado' }));

    expect(await screen.findByRole('main', { name: 'Preço fechado' })).toBeTruthy();
    expect(api.definirTrajeto).not.toHaveBeenCalled();
  });
});
