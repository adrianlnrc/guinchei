// Mapbox de mentira para o e2e. O build do Cliente usa o token falso `pk.e2e`; toda chamada a
// api.mapbox.com é respondida aqui, com fixtures no formato do Geocoding v6 e do Directions v5
// (o mesmo que o adaptador de `packages/geo/src/mapbox.test.ts` espera). O app grava o trajeto
// pela tela de verdade, mas nenhum endereço ou rota vem do Mapbox real: quanto o Mapbox real
// responde para o DF continua pendente (docs/desenvolvimento.md, "Mapbox").
import type { BrowserContext, Route } from '@playwright/test';

export const ORIGEM = {
  lng: -47.8921,
  lat: -15.7903,
  rotulo: 'Eixo Monumental, Brasília - Distrito Federal, 70070-000, Brasil',
};
export const DESTINO = {
  consulta: 'QNA 12',
  lng: -48.056,
  lat: -15.81,
  rotulo: 'QNA 12, Taguatinga Norte, Brasília - Distrito Federal, 72110-120, Brasil',
};
/** Rota Eixo Monumental → QNA 12: o `km_rebocado` do Pedido sai daqui. */
const ROTA = { metros: 21_347, segundos: 1_680 };

const CORS = { 'access-control-allow-origin': '*' };

function feature({ lng, lat, rotulo }: { lng: number; lat: number; rotulo: string }) {
  const [nome] = rotulo.split(', ');
  return {
    type: 'Feature',
    id: 'e2e',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      mapbox_id: 'e2e',
      feature_type: 'address',
      name: nome,
      place_formatted: rotulo.slice(nome!.length + 2),
      full_address: rotulo,
      coordinates: { longitude: lng, latitude: lat, accuracy: 'rooftop' },
    },
  };
}

const colecao = (features: unknown[]) => ({ type: 'FeatureCollection', features });

function json(route: Route, corpo: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: CORS,
    contentType: 'application/json',
    body: JSON.stringify(corpo),
  });
}

/** Estilo vazio: o mapa carrega e dispara `load`, sem tiles, fontes nem sprites. */
const ESTILO_VAZIO = { version: 8, name: 'e2e', sources: {}, layers: [] };

/**
 * Registra as respostas do Mapbox no contexto (vale também para os workers do mapbox-gl).
 * Devolve a lista do que o app pediu e não tinha fixture, para o teste conferir.
 */
export async function simularMapbox(context: BrowserContext): Promise<string[]>  {
  const semFixture: string[] = [];

  await context.route('https://events.mapbox.com/**', (route) =>
    route.fulfill({ status: 204, headers: CORS }),
  );
  await context.route('https://api.mapbox.com/**', (route) => {
    const url = new URL(route.request().url());
    const { pathname, searchParams } = url;

    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: { ...CORS, 'access-control-allow-headers': '*' },
      });
    }
    // O mapbox-gl abre uma sessão de faturamento ao carregar o estilo.
    if (pathname.startsWith('/map-sessions/')) return route.fulfill({ status: 204, headers: CORS });
    if (pathname.startsWith('/styles/v1/')) return json(route, ESTILO_VAZIO);
    if (pathname === '/search/geocode/v6/forward') {
      const achou = searchParams.get('q')?.toLowerCase().includes(DESTINO.consulta.toLowerCase());
      return json(route, colecao(achou ? [feature(DESTINO)] : []));
    }
    if (pathname === '/search/geocode/v6/reverse') {
      return json(route, colecao([feature({ ...ORIGEM })]));
    }
    if (pathname.startsWith('/directions/v5/mapbox/driving/')) {
      return json(route, {
        code: 'Ok',
        routes: [
          {
            distance: ROTA.metros,
            duration: ROTA.segundos,
            geometry: {
              type: 'LineString',
              coordinates: [
                [ORIGEM.lng, ORIGEM.lat],
                [-47.97, -15.8],
                [DESTINO.lng, DESTINO.lat],
              ],
            },
          },
        ],
        waypoints: [],
      });
    }
    semFixture.push(`${route.request().method()} ${pathname}`);
    return json(route, { message: 'sem fixture no e2e' }, 404);
  });

  return semFixture;
}
