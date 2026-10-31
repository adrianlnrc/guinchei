import { describe, expect, it } from 'vitest';
import {
  ESTADOS_CORRIDA,
  ESTADOS_PEDIDO,
  TransicaoInvalida,
  etapaDaFoto,
  podeTransitar,
  transitar,
} from './index';

describe('@guinchei/estados', () => {
  it('Pedido começa cotado', () => {
    expect(ESTADOS_PEDIDO[0]).toBe('cotado');
  });

  it('Corrida termina entregue', () => {
    expect(ESTADOS_CORRIDA.at(-1)).toBe('entregue');
  });
});

describe('podeTransitar: Pedido', () => {
  it('cotado pode ser confirmado', () => {
    expect(podeTransitar('pedido', 'cotado', 'confirmado')).toBe(true);
  });

  it('cotado não pula direto para atribuido', () => {
    expect(podeTransitar('pedido', 'cotado', 'atribuido')).toBe(false);
  });
});

describe('podeTransitar: aprovação do novo preço (ADR-0013)', () => {
  it('o Match pausa em em_match quando a outra Frota cobra mais', () => {
    expect(podeTransitar('pedido', 'em_match', 'aguardando_aprovacao_preco')).toBe(true);
  });

  it('o Cliente aprova e o Match continua', () => {
    expect(podeTransitar('pedido', 'aguardando_aprovacao_preco', 'em_match')).toBe(true);
  });

  it('o Cliente desiste (ou o prazo vence) e o pagamento é estornado', () => {
    expect(podeTransitar('pedido', 'aguardando_aprovacao_preco', 'estornado')).toBe(true);
  });

  it('não vai direto à Corrida nem a sem_guincheiro', () => {
    expect(podeTransitar('pedido', 'aguardando_aprovacao_preco', 'atribuido')).toBe(false);
    expect(podeTransitar('pedido', 'aguardando_aprovacao_preco', 'sem_guincheiro')).toBe(false);
    expect(podeTransitar('pedido', 'sem_guincheiro', 'aguardando_aprovacao_preco')).toBe(false);
  });
});

describe('podeTransitar: sem Guincheiro', () => {
  it('o Cliente pode tentar de novo', () => {
    expect(podeTransitar('pedido', 'sem_guincheiro', 'em_match')).toBe(true);
  });

  it('o Cliente pode estornar', () => {
    expect(podeTransitar('pedido', 'sem_guincheiro', 'estornado')).toBe(true);
  });

  it('estornado é terminal', () => {
    for (const para of ESTADOS_PEDIDO) {
      expect(podeTransitar('pedido', 'estornado', para)).toBe(false);
    }
  });

  it('atribuido é terminal para o Pedido', () => {
    for (const para of ESTADOS_PEDIDO) {
      expect(podeTransitar('pedido', 'atribuido', para)).toBe(false);
    }
  });
});

describe('podeTransitar: Corrida', () => {
  it('"Saí para o local" leva de aceita a a_caminho', () => {
    expect(podeTransitar('corrida', 'aceita', 'a_caminho')).toBe(true);
  });

  it('carregado pode ser entregue sem guarda de Fotos de estado', () => {
    expect(podeTransitar('corrida', 'carregado', 'entregue')).toBe(true);
  });

  it('não pula etapas nem volta', () => {
    expect(podeTransitar('corrida', 'aceita', 'no_local')).toBe(false);
    expect(podeTransitar('corrida', 'no_local', 'a_caminho')).toBe(false);
  });

  it('não fica no mesmo estado', () => {
    expect(podeTransitar('corrida', 'a_caminho', 'a_caminho')).toBe(false);
  });
});

describe('transitar', () => {
  it('devolve o novo estado quando a transição é permitida', () => {
    expect(transitar('corrida', 'no_local', 'carregado')).toBe('carregado');
  });

  it('lança TransicaoInvalida quando não é', () => {
    expect(() => transitar('pedido', 'confirmado', 'atribuido')).toThrow(TransicaoInvalida);
    expect(() => transitar('pedido', 'confirmado', 'atribuido')).toThrow(
      'Pedido não pode ir de confirmado para atribuido',
    );
  });
});

describe('etapaDaFoto', () => {
  it('é "antes" até o Guincheiro tocar em "Carreguei" e "depois" de carregado em diante', () => {
    expect(ESTADOS_CORRIDA.map((estado) => [estado, etapaDaFoto(estado)])).toEqual([
      ['aceita', 'antes'],
      ['a_caminho', 'antes'],
      ['no_local', 'antes'],
      ['carregado', 'depois'],
      ['entregue', 'depois'],
    ]);
  });
});
