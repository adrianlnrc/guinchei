// Mapa interativo com mapbox-gl (ADR-0008). Carregado sob demanda (React.lazy) para não pesar
// as outras telas, e só quando há VITE_MAPBOX_TOKEN. Os testes usam um dublê: o mapbox-gl
// precisa de WebGL e não roda no jsdom.
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapaMapbox.css';
import { useEffect, useRef, useState } from 'react';
import { BBOX_DF, type Ponto } from '@guinchei/geo';
import type { PropsMapaInterativo } from './mapas';

const APOIO = '#2E90FA';
const TINTA = '#0B0C0F';
/** Folga em graus em volta do DF para o Cliente poder arrastar o mapa até a divisa. */
const FOLGA = 0.15;

const lngLat = ({ lat, lng }: Ponto): [number, number] => [lng, lat];

export default function MapaMapbox({
  token,
  centro,
  origem,
  destino,
  linha,
  aoMoverOrigem,
  aoMoverDestino,
  aoTocarMapa,
}: PropsMapaInterativo & { token: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<mapboxgl.Map | null>(null);
  const [carregado, setCarregado] = useState(false);
  // Os callbacks mudam a cada render; os eventos do mapa leem sempre os atuais.
  const callbacks = useRef({ aoMoverOrigem, aoMoverDestino, aoTocarMapa });
  useEffect(() => {
    callbacks.current = { aoMoverOrigem, aoMoverDestino, aoTocarMapa };
  });
  const centroInicial = useRef(centro);

  useEffect(() => {
    const [oeste, sul, leste, norte] = BBOX_DF;
    const m = new mapboxgl.Map({
      container: container.current!,
      accessToken: token,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: lngLat(centroInicial.current),
      zoom: 13,
      language: 'pt',
      // A folha de baixo cobre o rodapé do mapa: logo e atribuição (obrigatórios) vão para cima.
      logoPosition: 'top-left',
      attributionControl: false,
      maxBounds: [
        [oeste - FOLGA, sul - FOLGA],
        [leste + FOLGA, norte + FOLGA],
      ],
    });
    m.on('load', () => {
      m.addSource('rota', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        },
      });
      m.addLayer({
        id: 'rota',
        type: 'line',
        source: 'rota',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': APOIO, 'line-width': 5 },
      });
      setCarregado(true);
    });
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'top-right');
    m.on('click', (e) => callbacks.current.aoTocarMapa({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    setMapa(m);
    return () => {
      m.remove();
      setMapa(null);
      setCarregado(false);
    };
  }, [token]);

  usePino(mapa, origem, TINTA, (p) => callbacks.current.aoMoverOrigem(p));
  usePino(mapa, destino, APOIO, (p) => callbacks.current.aoMoverDestino(p));

  // Centraliza na origem quando ela chega (GPS ou busca) e ainda não há rota.
  useEffect(() => {
    if (mapa && origem && !linha) mapa.easeTo({ center: lngLat(origem) });
  }, [mapa, origem, linha]);

  useEffect(() => {
    if (!mapa || !carregado) return;
    const fonte = mapa.getSource<mapboxgl.GeoJSONSource>('rota');
    fonte?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: linha ?? [] },
    });
    if (linha && linha.length > 1) {
      const limites = new mapboxgl.LngLatBounds(linha[0], linha[0]);
      for (const c of linha) limites.extend(c);
      mapa.fitBounds(limites, { padding: { top: 60, bottom: 360, left: 40, right: 40 } });
    }
  }, [mapa, carregado, linha]);

  // O mapbox-gl.css põe `position: relative` no container; o posicionamento fica no de fora.
  return (
    <div className="mapa" aria-label="Mapa" role="region">
      <div ref={container} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

/** Pino arrastável no ponto dado. No fim do arraste, avisa e volta ao ponto das props. */
function usePino(
  mapa: mapboxgl.Map | null,
  ponto: Ponto | null,
  cor: string,
  aoMover: (p: Ponto) => void,
) {
  const pino = useRef<mapboxgl.Marker | null>(null);
  const atual = useRef(ponto);
  const mover = useRef(aoMover);
  useEffect(() => {
    atual.current = ponto;
    mover.current = aoMover;
  });

  useEffect(() => {
    if (!mapa) return;
    const p = new mapboxgl.Marker({ color: cor, draggable: true });
    p.on('dragend', () => {
      const { lat, lng } = p.getLngLat();
      // Se o app aceitar, o ponto novo chega pelas props; se recusar, o pino volta.
      if (atual.current) p.setLngLat(lngLat(atual.current));
      mover.current({ lat, lng });
    });
    pino.current = p;
    return () => {
      p.remove();
      pino.current = null;
    };
  }, [mapa, cor]);

  useEffect(() => {
    const p = pino.current;
    if (!p || !mapa) return;
    if (ponto) p.setLngLat(lngLat(ponto)).addTo(mapa);
    else p.remove();
  }, [mapa, ponto]);
}
