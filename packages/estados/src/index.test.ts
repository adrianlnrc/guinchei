import { describe, expect, it } from 'vitest';
import { ESTADOS_CORRIDA, ESTADOS_PEDIDO } from './index';

describe('@guinchei/estados', () => {
  it('Pedido começa cotado', () => {
    expect(ESTADOS_PEDIDO[0]).toBe('cotado');
  });

  it('Corrida termina entregue', () => {
    expect(ESTADOS_CORRIDA.at(-1)).toBe('entregue');
  });
});
