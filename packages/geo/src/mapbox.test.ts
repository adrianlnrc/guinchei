// Adaptador Mapbox com `fetch` dublado. As respostas imitam o formato documentado do
// Geocoding v6 e do Directions v5; NÃO foram capturadas do Mapbox real (não havia token
// nesta fatia). Quando houver, vale conferir uma resposta real contra estas fixtures.
import { describe, expect, it, vi } from 'vitest';
import { ErroMapas } from './index';
import { criarServicoMapbox } from './mapbox';

const TOKEN = 'pk.teste';

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function servico(fetch: (url: string) => Promise<Response>) {
  const fetchFalso = vi.fn(fetch);
  return { mapas: criarServicoMapbox({ token: TOKEN, fetch: fetchFalso }), fetch: fetchFalso };
}

function urlChamada(fetch: ReturnType<typeof vi.fn>): URL {
  return new URL(String(fetch.mock.calls[0]?.[0]));
}

/** Feature do Geocoding v6 (forward e reverse têm o mesmo formato). */
function feature(
  lng: number,
  lat: number,
  props: { name: string; full_address?: string; place_formatted?: string; regiao?: string },
) {
  return {
    type: 'Feature',
    id: `dXJuOm1ieGFkcjo${props.name.length}`,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      mapbox_id: `dXJuOm1ieGFkcjo${props.name.length}`,
      feature_type: 'address',
      name: props.name,
      name_preferred: props.name,
      place_formatted: props.place_formatted ?? 'Brasília - Distrito Federal, 70000-000, Brasil',
      full_address: props.full_address,
      coordinates: { longitude: lng, latitude: lat, accuracy: 'rooftop' },
      context: {
        region: {
          mapbox_id: 'dXJuOm1ieHBsYzpBVTBv',
          name: props.regiao ?? 'Distrito Federal',
          region_code: props.regiao === 'Goiás' ? 'GO' : 'DF',
          region_code_full: props.regiao === 'Goiás' ? 'BR-GO' : 'BR-DF',
        },
        country: {
          mapbox_id: 'dXJuOm1ieHBsYzpJbVE',
          name: 'Brasil',
          country_code: 'BR',
          country_code_alpha_3: 'BRA',
        },
      },
    },
  };
}

const COLECAO = (features: unknown[]) => ({
  type: 'FeatureCollection',
  features,
  attribution: 'NOTICE: © 2026 Mapbox and its suppliers. All rights reserved.',
});

describe('buscarEnderecos (Geocoding v6 forward)', () => {
  it('pede ao Mapbox endereços no Brasil, no retângulo do DF, em português, perto do ponto', async () => {
    const { mapas, fetch } = servico(async () => resposta(COLECAO([])));
    await mapas.buscarEnderecos('qna 12', { lat: -15.8336, lng: -48.0566 });

    const url = urlChamada(fetch);
    expect(`${url.origin}${url.pathname}`).toBe('https://api.mapbox.com/search/geocode/v6/forward');
    expect(url.searchParams.get('q')).toBe('qna 12');
    expect(url.searchParams.get('country')).toBe('BR');
    expect(url.searchParams.get('language')).toBe('pt');
    expect(url.searchParams.get('proximity')).toBe('-48.0566,-15.8336');
    expect(url.searchParams.get('access_token')).toBe(TOKEN);
    const [oeste, sul, leste, norte] = url.searchParams.get('bbox')!.split(',').map(Number);
    expect(oeste).toBeCloseTo(-48.287, 2);
    expect(sul).toBeCloseTo(-16.051, 2);
    expect(leste).toBeCloseTo(-47.308, 2);
    expect(norte).toBeCloseTo(-15.5, 2);
  });

  it('devolve só os endereços dentro do DF, com o endereço completo', async () => {
    const { mapas } = servico(async () =>
      resposta(
        COLECAO([
          feature(-48.0566, -15.8336, {
            name: 'QNA 12',
            full_address:
              'QNA 12, Taguatinga Norte, Brasília - Distrito Federal, 72110-120, Brasil',
          }),
          // Dentro do retângulo do DF, mas em Goiás: o bbox sozinho não basta.
          feature(-48.2817, -15.7617, {
            name: 'Quadra 12',
            full_address: 'Quadra 12, Águas Lindas de Goiás - Goiás, 72910-000, Brasil',
            regiao: 'Goiás',
          }),
          feature(-48.0614, -16.0153, { name: 'Setor Central', place_formatted: 'Gama, Brasília' }),
        ]),
      ),
    );

    expect(await mapas.buscarEnderecos('quadra 12')).toEqual([
      {
        ponto: { lat: -15.8336, lng: -48.0566 },
        rotulo: 'QNA 12, Taguatinga Norte, Brasília - Distrito Federal, 72110-120, Brasil',
      },
      // Sem full_address (bairro, localidade): nome e lugar.
      { ponto: { lat: -16.0153, lng: -48.0614 }, rotulo: 'Setor Central, Gama, Brasília' },
    ]);
  });

  it('resposta vazia vira lista vazia', async () => {
    const { mapas } = servico(async () => resposta(COLECAO([])));
    expect(await mapas.buscarEnderecos('rua que não existe')).toEqual([]);
  });

  it('texto curto demais nem chega ao Mapbox', async () => {
    const { mapas, fetch } = servico(async () => resposta(COLECAO([])));
    expect(await mapas.buscarEnderecos(' q ')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('erro de rede vira ErroMapas("rede")', async () => {
    const { mapas } = servico(async () => {
      throw new TypeError('Failed to fetch');
    });
    const erro = await mapas.buscarEnderecos('qna 12').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroMapas);
    expect((erro as ErroMapas).motivo).toBe('rede');
  });

  it('token recusado vira ErroMapas("falha")', async () => {
    const { mapas } = servico(async () =>
      resposta({ message: 'Not Authorized - Invalid Token' }, 401),
    );
    const erro = await mapas.buscarEnderecos('qna 12').catch((e: unknown) => e);
    expect((erro as ErroMapas).motivo).toBe('falha');
  });
});

describe('enderecoDoPonto (Geocoding v6 reverse)', () => {
  it('pede o endereço do ponto e devolve o mais detalhado', async () => {
    const { mapas, fetch } = servico(async () =>
      resposta(
        COLECAO([
          feature(-47.89215, -15.79031, {
            name: 'Eixo Monumental',
            full_address: 'Eixo Monumental, Brasília - Distrito Federal, 70070-350, Brasil',
          }),
          feature(-47.88, -15.79, {
            name: 'Brasília',
            place_formatted: 'Distrito Federal, Brasil',
          }),
        ]),
      ),
    );

    expect(await mapas.enderecoDoPonto({ lat: -15.7903, lng: -47.8921 })).toEqual({
      // O ponto é o que o Cliente marcou, não o do endereço encontrado.
      ponto: { lat: -15.7903, lng: -47.8921 },
      rotulo: 'Eixo Monumental, Brasília - Distrito Federal, 70070-350, Brasil',
    });
    const url = urlChamada(fetch);
    expect(`${url.origin}${url.pathname}`).toBe('https://api.mapbox.com/search/geocode/v6/reverse');
    expect(url.searchParams.get('longitude')).toBe('-47.8921');
    expect(url.searchParams.get('latitude')).toBe('-15.7903');
    expect(url.searchParams.get('language')).toBe('pt');
  });

  it('sem endereço no ponto devolve null', async () => {
    const { mapas } = servico(async () => resposta(COLECAO([])));
    expect(await mapas.enderecoDoPonto({ lat: -15.7, lng: -47.9 })).toBeNull();
  });

  it('erro de rede vira ErroMapas("rede")', async () => {
    const { mapas } = servico(async () => {
      throw new TypeError('Failed to fetch');
    });
    const erro = await mapas.enderecoDoPonto({ lat: -15.7, lng: -47.9 }).catch((e: unknown) => e);
    expect((erro as ErroMapas).motivo).toBe('rede');
  });
});

describe('rota (Directions v5, perfil driving)', () => {
  const ORIGEM = { lat: -15.7903, lng: -47.8921 };
  const DESTINO = { lat: -15.8336, lng: -48.0566 };

  it('devolve km, minutos e o traçado da primeira rota', async () => {
    const { mapas, fetch } = servico(async () =>
      resposta({
        code: 'Ok',
        uuid: 'rota-de-teste',
        routes: [
          {
            distance: 21347.6,
            duration: 1562.4,
            weight: 1700.1,
            weight_name: 'auto',
            geometry: {
              type: 'LineString',
              coordinates: [
                [-47.8921, -15.7903],
                [-47.97, -15.81],
                [-48.0566, -15.8336],
              ],
            },
            legs: [],
          },
        ],
        waypoints: [
          { name: 'Eixo Monumental', location: [-47.8921, -15.7903], distance: 2.1 },
          { name: 'QNA 12', location: [-48.0566, -15.8336], distance: 4.3 },
        ],
      }),
    );

    expect(await mapas.rota(ORIGEM, DESTINO)).toEqual({
      km: 21.3476,
      minutos: 26,
      linha: [
        [-47.8921, -15.7903],
        [-47.97, -15.81],
        [-48.0566, -15.8336],
      ],
    });
    const url = urlChamada(fetch);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://api.mapbox.com/directions/v5/mapbox/driving/-47.8921,-15.7903;-48.0566,-15.8336',
    );
    expect(url.searchParams.get('geometries')).toBe('geojson');
    expect(url.searchParams.get('overview')).toBe('full');
    expect(url.searchParams.get('access_token')).toBe(TOKEN);
  });

  it('sem rota vira ErroMapas("sem_rota")', async () => {
    const { mapas } = servico(async () =>
      resposta({ code: 'NoRoute', message: 'No route found', routes: [] }),
    );
    const erro = await mapas.rota(ORIGEM, DESTINO).catch((e: unknown) => e);
    expect((erro as ErroMapas).motivo).toBe('sem_rota');
  });

  it('ponto longe de qualquer rua vira ErroMapas("sem_rota")', async () => {
    const { mapas } = servico(async () =>
      resposta({ code: 'NoSegment', message: 'Could not find a matching segment' }, 422),
    );
    const erro = await mapas.rota(ORIGEM, DESTINO).catch((e: unknown) => e);
    expect((erro as ErroMapas).motivo).toBe('sem_rota');
  });

  it('erro de rede vira ErroMapas("rede")', async () => {
    const { mapas } = servico(async () => {
      throw new TypeError('Failed to fetch');
    });
    const erro = await mapas.rota(ORIGEM, DESTINO).catch((e: unknown) => e);
    expect((erro as ErroMapas).motivo).toBe('rede');
  });
});
