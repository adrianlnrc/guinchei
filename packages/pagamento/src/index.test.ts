import { describe, expect, it } from 'vitest';
import { criarGatewayMock } from './index';

const PEDIDO = '0b6f5c1e-2a4d-4c55-9f3e-7d1a2b3c4d5e';

describe('GatewayPagamento mock', () => {
  it('autoriza o valor pedido e devolve uma referência do provedor mock', async () => {
    const gateway = criarGatewayMock();
    const autorizacao = await gateway.autorizar({ pedidoId: PEDIDO, valor: 25880, metodo: 'pix' });
    expect(gateway.provedor).toBe('mock');
    expect(autorizacao).toMatchObject({ estado: 'autorizado', valor: 25880 });
    expect(autorizacao.referenciaExterna).toMatch(/^mock_/);
  });

  it('cada autorização tem uma referência própria', async () => {
    const gateway = criarGatewayMock();
    const a = await gateway.autorizar({ pedidoId: PEDIDO, valor: 18000, metodo: 'cartao' });
    const b = await gateway.autorizar({ pedidoId: PEDIDO, valor: 18000, metodo: 'cartao' });
    expect(a.referenciaExterna).not.toBe(b.referenciaExterna);
  });

  it('recusa valores terminados em 99 centavos (cenário de teste da recusa)', async () => {
    const gateway = criarGatewayMock();
    const recusa = await gateway.autorizar({ pedidoId: PEDIDO, valor: 25899, metodo: 'pix' });
    expect(recusa).toMatchObject({ estado: 'recusado', valor: 25899 });
    expect(recusa.referenciaExterna).toMatch(/^mock_/);
  });

  it.each([0, -100, 12.5, Number.NaN])('não autoriza valor inválido (%s)', async (valor) => {
    const gateway = criarGatewayMock();
    await expect(gateway.autorizar({ pedidoId: PEDIDO, valor, metodo: 'pix' })).rejects.toThrow(
      RangeError,
    );
  });

  it('captura uma autorização do mock', async () => {
    const gateway = criarGatewayMock();
    const { referenciaExterna } = await gateway.autorizar({
      pedidoId: PEDIDO,
      valor: 25880,
      metodo: 'pix',
    });
    await expect(gateway.capturar({ referenciaExterna, valor: 25880 })).resolves.toEqual({
      estado: 'capturado',
      referenciaExterna,
      valor: 25880,
    });
  });

  it('estorna uma autorização do mock', async () => {
    const gateway = criarGatewayMock();
    const { referenciaExterna } = await gateway.autorizar({
      pedidoId: PEDIDO,
      valor: 25880,
      metodo: 'pix',
    });
    await expect(gateway.estornar({ referenciaExterna, valor: 25880 })).resolves.toEqual({
      estado: 'estornado',
      referenciaExterna,
      valor: 25880,
    });
  });

  it('não captura nem estorna referência que não é do mock', async () => {
    const gateway = criarGatewayMock();
    await expect(gateway.capturar({ referenciaExterna: 'pagarme_123', valor: 100 })).rejects.toThrow(
      /referência/,
    );
    await expect(gateway.estornar({ referenciaExterna: 'pagarme_123', valor: 100 })).rejects.toThrow(
      /referência/,
    );
  });
});
