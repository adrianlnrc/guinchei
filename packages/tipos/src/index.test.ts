import { describe, expect, it } from 'vitest';
import { PAPEIS } from './index';

describe('@guinchei/tipos', () => {
  it('lista os três papéis', () => {
    expect(PAPEIS).toEqual(['cliente', 'guincheiro', 'operacao']);
  });
});
