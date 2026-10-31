// Passos de tela que mais de um cenário repete. Tudo pela interface, como o usuário faria.
import type { Page } from '@playwright/test';
import { DESTINO, ORIGEM } from './mapbox';
import { expect, URL_CLIENTE, URL_GUINCHEIRO, URL_PAINEL } from './navegadores';
import { pedidoAtual } from './banco';

export const CODIGO_DE_TESTE = '123456';
export const CELULAR_CLIENTE = '(61) 90000-0001';
export const CELULAR_MARCOS = '(61) 90000-0002';
export const CELULAR_OPERACAO = '(61) 90000-0005';

export async function digitarCodigo(page: Page, celular: string): Promise<void> {
  await page.getByLabel('Celular com DDD').fill(celular);
  // O Auth aceita um envio por número a cada 5 s: um cenário logo após o outro, com o mesmo
  // número, pode ser recusado. Tenta de novo até o código ser pedido.
  const campoDoCodigo = page.getByLabel('Código de 6 dígitos');
  await expect(async () => {
    await page.getByRole('button', { name: 'Receber código' }).click();
    await expect(campoDoCodigo).toBeVisible({ timeout: 3_000 });
  }).toPass({ intervals: [1_000], timeout: 30_000 });
  await campoDoCodigo.fill(CODIGO_DE_TESTE);
  await page.getByRole('button', { name: 'Confirmar' }).click();
}

/** Login do Cliente com o número de teste (ADR-0010); termina na primeira pergunta do Pedido. */
export async function entrarComoCliente(page: Page): Promise<void> {
  await page.goto(URL_CLIENTE);
  await page.getByRole('button', { name: 'Pedir guincho agora' }).click();
  await digitarCodigo(page, CELULAR_CLIENTE);
  await expect(page.getByRole('heading', { name: /Oi, Rafael/ })).toBeVisible();
}

/** Login do Guincheiro (Marcos) com o número de teste; termina no plantão ligado. */
export async function entrarComoGuincheiro(page: Page): Promise<void> {
  await page.goto(URL_GUINCHEIRO);
  await digitarCodigo(page, CELULAR_MARCOS);
  await expect(page.getByText('Disponível', { exact: true })).toBeVisible();
}

/** Login da operação (número de teste do seed) no Painel; termina com a lateral na tela. */
export async function entrarNoPainel(page: Page): Promise<void> {
  await page.goto(URL_PAINEL);
  await digitarCodigo(page, CELULAR_OPERACAO);
  await expect(page.getByRole('navigation', { name: 'Painel de operação' })).toBeVisible();
}

/** "R$ 258,80", como o app escreve (o número-herói parte o valor em dois elementos). */
export function reais(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(centavos / 100)
    .replace(/\s/g, ' ');
}

/**
 * Do primeiro toque ao Preço fechado: veículo, situação e rodas (três toques), origem pela
 * localização do aparelho e destino pela busca, com o mapa de verdade na tela. Para na tela de
 * preço, antes de pagar, e devolve o Preço fechado em centavos.
 */
export async function abrirPedidoAtePreco(page: Page): Promise<number> {
  await page.getByRole('button', { name: 'Carro de passeio' }).click();
  await page.getByRole('button', { name: 'Parou e não liga' }).click();
  await page.getByRole('button', { name: 'Sim', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar local no mapa' }).click();

  // O mapa do mapbox-gl subiu (canvas WebGL) e a origem veio da localização do aparelho.
  await expect(page.getByRole('region', { name: 'Mapa' }).locator('canvas')).toBeVisible();
  await expect(page.getByLabel('Onde o carro está')).toHaveValue(ORIGEM.rotulo);

  await page.getByLabel('Para onde levamos o carro').fill(DESTINO.consulta);
  await page.getByRole('list', { name: /Sugestões: Para onde levamos o carro/ }).waitFor();
  await page.getByRole('button', { name: DESTINO.rotulo }).click();
  await expect(page.getByText(/21,3 km de reboque · ~28 min/)).toBeVisible();
  await page.getByRole('button', { name: 'Ver preço fechado' }).click();

  // O Preço fechado aparece antes de qualquer pagamento. A fonte da verdade é o Pedido gravado
  // pelo servidor (cotar-pedido); a tela tem de mostrar exatamente esse valor.
  await expect(page.getByText('Calculando o preço fechado…')).toBeHidden();
  await expect(page.getByText(/Guincho mais próximo a/)).toBeVisible();
  const pedido = await pedidoAtual();
  expect(pedido?.estado).toBe('cotado');
  const total = pedido?.preco_total as number;
  expect(total).toBeGreaterThan(0);
  const [inteiro, decimal] = reais(total).split(',');
  await expect(page.locator('.heroi')).toHaveText(`${inteiro},${decimal}`);
  return total;
}

/** Na tela de pagamento, paga com Pix (o PSP é o mock) e entra no acompanhamento. */
export async function pagarComPix(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Confirmar e pagar' }).click();
  await expect(page.getByText('Pague com Pix')).toBeVisible();
  await page.getByRole('button', { name: 'Copiar código Pix' }).click();
  await expect(page).toHaveURL(/\/acompanhamento$/);
}
