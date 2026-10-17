import { describe, expect, expectTypeOf, it } from 'vitest';
import { Constants, PAPEIS, type Enums, type Papel, type Tables } from './index';

describe('@guinchei/tipos', () => {
  it('lista os três papéis', () => {
    expect(PAPEIS).toEqual(['cliente', 'guincheiro', 'operacao']);
  });

  it('PAPEIS é igual ao enum papel do banco', () => {
    expect(PAPEIS).toEqual(Constants.public.Enums.papel);
    expectTypeOf<Papel>().toEqualTypeOf<Enums<'papel'>>();
  });

  it('expõe as linhas das tabelas do schema', () => {
    expectTypeOf<Tables<'pedidos'>['preco_total']>().toEqualTypeOf<number>();
    expectTypeOf<Tables<'corridas'>['estado']>().toEqualTypeOf<Enums<'estado_corrida'>>();
  });
});
