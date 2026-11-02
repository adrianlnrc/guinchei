import { BBOX_DF, type Ponto } from '@guinchei/geo';

/** Área do mapa esquemático do Monitor onde cabe um marcador (canto superior esquerdo). */
export interface AreaDoMapa {
  left: number;
  top: number;
  largura: number;
  altura: number;
}

/**
 * Projeta uma coordenada do DF no mapa esquemático do Monitor, que não tem escala de rua:
 * o retângulo envolvente do DF (`BBOX_DF`) é esticado linearmente sobre a área dada, com o
 * norte em cima. Serve para ver onde os Pedidos se concentram, não para medir distância.
 * Fora do DF, o ponto é preso à borda da área.
 */
export function projetarNoMapa({ lat, lng }: Ponto, area: AreaDoMapa) {
  const [oeste, sul, leste, norte] = BBOX_DF;
  const x = Math.min(1, Math.max(0, (lng - oeste) / (leste - oeste)));
  const y = Math.min(1, Math.max(0, (norte - lat) / (norte - sul)));
  return {
    left: Math.round(area.left + x * area.largura),
    top: Math.round(area.top + y * area.altura),
  };
}
