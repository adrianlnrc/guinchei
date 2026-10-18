import { createContext, useContext, type ComponentType } from 'react';
import type { Ponto, ServicoMapas } from '@guinchei/geo';

/** O mapa interativo, sem saber do provedor; o real é o MapaMapbox (carregado sob demanda). */
export interface PropsMapaInterativo {
  centro: Ponto;
  origem: Ponto | null;
  destino: Ponto | null;
  /** Traçado da rota como [longitude, latitude]. */
  linha: [number, number][] | null;
  /** Fim do arraste de um pino. Se o app recusar o ponto, o pino volta para o lugar. */
  aoMoverOrigem: (p: Ponto) => void;
  aoMoverDestino: (p: Ponto) => void;
  aoTocarMapa: (p: Ponto) => void;
}

export interface Mapas {
  servico: ServicoMapas;
  MapaInterativo: ComponentType<PropsMapaInterativo>;
}

/** `null` quando o app não tem VITE_MAPBOX_TOKEN: a tela de local usa o mapa do protótipo. */
export const MapasContexto = createContext<Mapas | null>(null);

export function useMapas(): Mapas | null {
  return useContext(MapasContexto);
}

/** Posição do aparelho pela geolocalização do navegador (pede permissão na primeira vez). */
export function localizarAparelho(): Promise<Ponto> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Navegador sem geolocalização'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}
