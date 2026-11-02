import { describe, expect, it } from 'vitest';
import { BBOX_DF } from '@guinchei/geo';
import { projetarNoMapa } from './projecao';

const AREA = { left: 60, top: 60, largura: 400, altura: 500 };

describe('projetarNoMapa', () => {
  it('põe o canto noroeste do DF no canto superior esquerdo da área', () => {
    const [oeste, , , norte] = BBOX_DF;
    expect(projetarNoMapa({ lat: norte, lng: oeste }, AREA)).toEqual({ left: 60, top: 60 });
  });

  it('põe o canto sudeste do DF no canto inferior direito da área', () => {
    const [, sul, leste] = BBOX_DF;
    expect(projetarNoMapa({ lat: sul, lng: leste }, AREA)).toEqual({ left: 460, top: 560 });
  });

  it('mais ao norte fica mais acima; mais a leste, mais à direita', () => {
    const plano = projetarNoMapa({ lat: -15.79, lng: -47.89 }, AREA);
    const norte = projetarNoMapa({ lat: -15.6, lng: -47.89 }, AREA);
    const leste = projetarNoMapa({ lat: -15.79, lng: -47.5 }, AREA);
    expect(norte.top).toBeLessThan(plano.top);
    expect(leste.left).toBeGreaterThan(plano.left);
  });

  it('prende ao limite da área o ponto fora do DF', () => {
    expect(projetarNoMapa({ lat: 10, lng: -100 }, AREA)).toEqual({ left: 60, top: 60 });
  });
});
