// Adaptador Mapbox do ServicoMapas (ADR-0008). Chama as APIs REST com `fetch`:
//
// - Geocoding v6, forward: GET https://api.mapbox.com/search/geocode/v6/forward?q=…
//   (country, bbox, language, proximity, types, limit) — busca de endereço.
// - Geocoding v6, reverse: GET https://api.mapbox.com/search/geocode/v6/reverse?longitude=…&latitude=…
//   — endereço do ponto marcado no mapa.
// - Directions v5: GET https://api.mapbox.com/directions/v5/mapbox/driving/{lng,lat;lng,lat}
//   (geometries=geojson, overview=full) — distância (m) e duração (s) da rota de carro.
//
// Documentação: https://docs.mapbox.com/api/search/geocoding/ e
// https://docs.mapbox.com/api/navigation/directions/. O token é o público do app
// (VITE_MAPBOX_TOKEN, restrito por domínio em produção); nada aqui é segredo.
//
// O Geocoding v6 não traz POIs (oficinas pelo nome); para isso seria a Search Box API.
import {
  BBOX_DF,
  CENTRO_DF,
  dentroDoDF,
  ErroMapas,
  type Endereco,
  type Ponto,
  type ServicoMapas,
} from './index';

const BASE = 'https://api.mapbox.com';
/** Do mais preciso ao mais vago; bairro e cidade-satélite servem de ponto de partida. */
const TIPOS_BUSCA = 'address,street,neighborhood,locality';
const MINIMO_BUSCA = 3;

export interface ConfigMapbox {
  token: string;
  /** Para testes; o padrão é o `fetch` do navegador. */
  fetch?: (url: string) => Promise<Response>;
}

interface FeatureGeocoding {
  geometry: { coordinates: [number, number] };
  properties: { name: string; full_address?: string; place_formatted?: string };
}

interface RespostaGeocoding {
  features: FeatureGeocoding[];
}

interface RespostaDirections {
  code: string;
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
}

const coordenadas = ({ lat, lng }: Ponto) => `${lng},${lat}`;

function rotuloDe({ properties: p }: FeatureGeocoding): string {
  return p.full_address ?? [p.name, p.place_formatted].filter(Boolean).join(', ');
}

export function criarServicoMapbox({
  token,
  fetch = (url) => globalThis.fetch(url),
}: ConfigMapbox): ServicoMapas {
  async function pedir<T>(caminho: string, params: Record<string, string>): Promise<T> {
    const url = new URL(caminho, BASE);
    for (const [chave, valor] of Object.entries(params)) url.searchParams.set(chave, valor);
    url.searchParams.set('access_token', token);

    let res: Response;
    try {
      res = await fetch(url.toString());
    } catch (causa) {
      throw new ErroMapas('rede', 'Sem conexão com o serviço de mapas', { cause: causa });
    }
    const corpo = (await res.json().catch(() => null)) as (T & { code?: string }) | null;
    // O Directions responde 200 com code "NoRoute", ou 422 com "NoSegment".
    if (corpo?.code === 'NoRoute' || corpo?.code === 'NoSegment') {
      throw new ErroMapas('sem_rota', 'Não há rota de carro entre os pontos');
    }
    if (!res.ok || !corpo) {
      throw new ErroMapas('falha', `Serviço de mapas respondeu ${res.status}`, { cause: corpo });
    }
    return corpo;
  }

  return {
    async buscarEnderecos(texto, perto = CENTRO_DF) {
      const q = texto.trim();
      if (q.length < MINIMO_BUSCA) return [];
      const { features } = await pedir<RespostaGeocoding>('/search/geocode/v6/forward', {
        q,
        country: 'BR',
        bbox: BBOX_DF.join(','),
        language: 'pt',
        proximity: coordenadas(perto),
        types: TIPOS_BUSCA,
        limit: '8',
      });
      // O bbox do DF inclui pedaços de Goiás (Águas Lindas, Valparaíso): filtra pelo polígono.
      return features
        .map((f): Endereco => {
          const [lng, lat] = f.geometry.coordinates;
          return { ponto: { lat, lng }, rotulo: rotuloDe(f) };
        })
        .filter((e) => dentroDoDF(e.ponto));
    },

    async enderecoDoPonto(ponto) {
      const { features } = await pedir<RespostaGeocoding>('/search/geocode/v6/reverse', {
        longitude: String(ponto.lng),
        latitude: String(ponto.lat),
        language: 'pt',
      });
      // A primeira feature é a mais detalhada (endereço, depois rua, bairro…).
      const [maisDetalhada] = features;
      return maisDetalhada ? { ponto, rotulo: rotuloDe(maisDetalhada) } : null;
    },

    async rota(origem, destino) {
      const { routes } = await pedir<RespostaDirections>(
        `/directions/v5/mapbox/driving/${coordenadas(origem)};${coordenadas(destino)}`,
        { geometries: 'geojson', overview: 'full', alternatives: 'false' },
      );
      const [rota] = routes ?? [];
      if (!rota) throw new ErroMapas('sem_rota', 'Não há rota de carro entre os pontos');
      return {
        km: rota.distance / 1000,
        minutos: Math.round(rota.duration / 60),
        linha: rota.geometry.coordinates,
      };
    },
  };
}
