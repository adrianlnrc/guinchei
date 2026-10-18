import { vi } from 'vitest';
import type { Endereco, Ponto, Rota } from '@guinchei/geo';
import { criarServicoMapasEmMemoria } from '@guinchei/geo/memoria';
import type { Mapas, PropsMapaInterativo } from '../mapas';

export const EIXO: Endereco = {
  ponto: { lat: -15.7903, lng: -47.8921 },
  rotulo: 'Eixo Monumental, Brasília - Distrito Federal, 70070-350',
};
export const QNA_12: Endereco = {
  ponto: { lat: -15.8336, lng: -48.0566 },
  rotulo: 'QNA 12, Taguatinga Norte, Brasília - Distrito Federal, 72110-120',
};
export const SETOR_CENTRAL_GAMA: Endereco = {
  ponto: { lat: -16.0153, lng: -48.0614 },
  rotulo: 'Setor Central, Gama, Brasília - Distrito Federal',
};
export const AGUAS_LINDAS: Ponto = { lat: -15.7617, lng: -48.2817 };

export const ROTA_EIXO_QNA: Rota = {
  km: 21.3476,
  minutos: 26,
  linha: [
    [-47.8921, -15.7903],
    [-48.0566, -15.8336],
  ],
};

/**
 * Mapas de teste: ServicoMapas em memória (com espiões) e um mapa interativo de mentira que
 * guarda as últimas props, para o teste "arrastar" pinos e "tocar" no mapa. O mapbox-gl não
 * roda no jsdom.
 */
export function mapasFalsos({ rota = ROTA_EIXO_QNA }: { rota?: Rota | null } = {}) {
  const servico = criarServicoMapasEmMemoria({
    enderecos: [EIXO, QNA_12, SETOR_CENTRAL_GAMA],
    rota,
  });
  vi.spyOn(servico, 'buscarEnderecos');
  vi.spyOn(servico, 'rota');
  const mapa: { props: PropsMapaInterativo | null } = { props: null };

  function MapaInterativo(props: PropsMapaInterativo) {
    mapa.props = props;
    return <div data-testid="mapa-interativo" />;
  }

  return { mapas: { servico, MapaInterativo } satisfies Mapas, servico, mapa };
}

/** Troca a geolocalização do navegador: devolve o ponto ou recusa a permissão. */
export function simularGeolocalizacao(resultado: Ponto | 'negada') {
  const getCurrentPosition = vi.fn(
    (sucesso: PositionCallback, falha?: PositionErrorCallback | null) => {
      if (resultado === 'negada') {
        falha?.({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError);
      } else {
        sucesso({
          coords: { latitude: resultado.lat, longitude: resultado.lng },
        } as GeolocationPosition);
      }
    },
  );
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
  return getCurrentPosition;
}
