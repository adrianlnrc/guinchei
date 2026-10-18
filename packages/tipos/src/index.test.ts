import { describe, expect, expectTypeOf, it } from 'vitest';
import { Constants, PAPEIS, type Enums, type Papel, type Tables } from './index';

describe('@guinchei/tipos', () => {
  it('lista os quatro papéis, com o representante da Frota distinto do Guincheiro', () => {
    expect(PAPEIS).toEqual(['cliente', 'guincheiro', 'operacao', 'representante']);
  });

  it('PAPEIS é igual ao enum papel do banco', () => {
    expect(PAPEIS).toEqual(Constants.public.Enums.papel);
    expectTypeOf<Papel>().toEqualTypeOf<Enums<'papel'>>();
  });

  it('expõe as linhas das tabelas do schema', () => {
    // Nulo até a cotação (#10): o Pedido nasce só com as três respostas.
    expectTypeOf<Tables<'pedidos'>['preco_total']>().toEqualTypeOf<number | null>();
    expectTypeOf<Tables<'corridas'>['estado']>().toEqualTypeOf<Enums<'estado_corrida'>>();
  });
});
