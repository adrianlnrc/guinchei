// Definition of Done do walking skeleton (docs/produto/PRD.md, critérios 1 a 6, com a nota de
// revisão de 2026-10-17). Cliente e Guincheiro em dois navegadores ao mesmo tempo, contra os
// apps em build de produção, o Supabase local (Auth, Realtime, Storage, pg_cron e pg_net) e as
// Edge Functions. Simulados: o Mapbox (fixtures, suporte/mapbox.ts) e o PSP (adaptador mock).
import {
  colocarTodosNoPlantao,
  corridaDoPedido,
  GUINCHEIROS,
  guincheiroDisponivel,
  ofertasDoPedido,
  pagamentosDoPedido,
  pedidoAtual,
  prepararBanco,
  tirarTodosDoPlantao,
} from './suporte/banco';
import {
  abrirPedidoAtePreco,
  entrarComoCliente,
  entrarComoGuincheiro,
  pagarComPix,
  reais,
} from './suporte/fluxo';
import { expect, test } from './suporte/navegadores';

const FOTO = decodeURIComponent(new URL('suporte/carro.png', import.meta.url).pathname);

test.beforeEach(prepararBanco);
// Quem vem depois encontra o banco limpo e o plantão ligado, qualquer que tenha sido o resultado.
test.afterEach(prepararBanco);

test('Cliente pede, paga, o Guincheiro mais próximo atende e o Cliente acompanha até a entrega', async ({
  cliente,
  guincheiro,
}) => {
  await test.step('Guincheiro entra e fica em plantão', () => entrarComoGuincheiro(guincheiro));
  await test.step('Cliente entra com o número de teste', () => entrarComoCliente(cliente));

  // Nenhuma das duas páginas é recarregada daqui até o fim: o que mudar chega pelo Realtime.
  await cliente.evaluate(() => Object.assign(window, { semRecarregar: true }));
  await guincheiro.evaluate(() => Object.assign(window, { semRecarregar: true }));

  let total = 0;
  await test.step('Cliente abre o Pedido e vê o Preço fechado antes de pagar', async () => {
    total = await abrirPedidoAtePreco(cliente);
    expect(await pagamentosDoPedido((await pedidoAtual())!.id)).toEqual([]);
  });

  await test.step('Cliente paga (PSP mock) e o Pedido entra no Match', async () => {
    await pagarComPix(cliente);
    await expect(
      cliente.getByRole('heading', { name: /Chamando o guincho mais próximo/ }),
    ).toBeVisible();
    const pedido = (await pedidoAtual())!;
    expect(await pagamentosDoPedido(pedido.id)).toEqual([
      { estado: 'autorizado', valor: total, metodo: 'pix' },
    ]);
  });

  await test.step('O chamado chega sozinho ao Guincheiro mais próximo e ele aceita', async () => {
    await expect(guincheiro.getByText('Novo chamado')).toBeVisible();
    // Marcos (Cruzeiro, ~4,2 km) é o mais próximo dos três do seed; só ele recebeu oferta.
    const ofertas = await ofertasDoPedido((await pedidoAtual())!.id);
    expect(ofertas.map((o) => o.guincheiro_id)).toEqual([GUINCHEIROS.marcos]);
    await guincheiro.getByRole('button', { name: 'Aceitar Corrida' }).click();
    await expect(
      cliente.getByRole('heading', { name: /Guincheiro aceitou, saindo em instantes/ }),
    ).toBeVisible();
    await expect(cliente.getByText('Marcos Alves', { exact: true })).toBeVisible();
  });

  await test.step('"Saí para o local": o Cliente vê o guincho a caminho', async () => {
    await guincheiro.getByRole('button', { name: 'Saí para o local' }).click();
    await expect(cliente.getByRole('heading', { name: 'Guincho a caminho' })).toBeVisible();
  });

  await test.step('"Cheguei": o Cliente registra uma foto do veículo', async () => {
    await guincheiro.getByRole('button', { name: 'Cheguei' }).click();
    await expect(
      cliente.getByRole('heading', { name: /O guincho chegou ao seu veículo/ }),
    ).toBeVisible();
    await expect(cliente.getByRole('note')).toContainText('Registre fotos do seu veículo');

    await cliente.getByRole('button', { name: 'Registrar fotos' }).click();
    await cliente.getByLabel('Escolher foto ou vídeo').setInputFiles(FOTO);
    const antes = cliente.getByRole('region', { name: 'Antes do carregamento' });
    await expect(antes.getByAltText(/Foto: Cliente às/)).toBeVisible();
  });

  await test.step('O Guincheiro registra uma foto antes de carregar', async () => {
    await guincheiro.getByRole('button', { name: /Fotos de estado/ }).click();
    const campo = guincheiro.getByLabel('Escolher foto ou vídeo');
    await expect(campo).toHaveAttribute('capture', 'environment');
    await campo.setInputFiles(FOTO);
    await expect(guincheiro.getByText('Seus itens nesta etapa: 1 de 6')).toBeVisible();
    await guincheiro.getByRole('button', { name: 'Voltar à Corrida' }).click();
  });

  await test.step('"Carreguei": com foto da etapa não há aviso, e o Cliente vê a foto do Guincheiro', async () => {
    await guincheiro.getByRole('button', { name: 'Carreguei' }).click();
    await expect(guincheiro.getByRole('button', { name: 'Entreguei' })).toBeVisible();
    await expect(guincheiro.getByRole('alertdialog')).toHaveCount(0);

    await expect(cliente.getByRole('heading', { name: /Veículo carregado/ })).toBeVisible();
    const antes = cliente.getByRole('region', { name: 'Antes do carregamento' });
    const fotoDoGuincheiro = antes.getByAltText(/Foto: Guincheiro às/);
    await expect(fotoDoGuincheiro).toBeVisible();
    // A imagem veio da URL assinada do Storage e carregou de verdade.
    await expect
      .poll(() => fotoDoGuincheiro.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(antes.getByAltText(/Foto: Cliente às/)).toBeVisible();
  });

  await test.step('"Entreguei" sem foto de depois pede para confirmar o aviso', async () => {
    await guincheiro.getByRole('button', { name: 'Entreguei' }).click();
    const aviso = guincheiro.getByRole('alertdialog');
    await expect(aviso).toContainText(
      'Registrar fotos protege você se houver reclamação de avaria.',
    );
    await expect(guincheiro.getByText('Seu repasse')).toHaveCount(0);
    expect((await corridaDoPedido((await pedidoAtual())!.id))?.estado).toBe('carregado');

    await guincheiro.getByRole('button', { name: 'Seguir sem fotos' }).click();
    await expect(guincheiro.getByText('Seu repasse')).toBeVisible();
  });

  await test.step('O Cliente vê "entregue" e o Guincheiro volta ao plantão', async () => {
    await expect(
      cliente.getByRole('heading', { name: /Entregue\. Seu veículo chegou ao destino/ }),
    ).toBeVisible();
    await expect(cliente.getByText(`Total do Pedido: ${reais(total)}.`)).toBeVisible();
    expect((await corridaDoPedido((await pedidoAtual())!.id))?.estado).toBe('entregue');
    await expect.poll(() => guincheiroDisponivel(GUINCHEIROS.marcos)).toBe(true);

    // Nenhum dos dois apps foi recarregado ao longo do fluxo.
    expect(await cliente.evaluate(() => 'semRecarregar' in window)).toBe(true);
    expect(await guincheiro.evaluate(() => 'semRecarregar' in window)).toBe(true);
  });
});

/** Cliente com o Preço fechado na tela e, em seguida, todos os Guincheiros fora do plantão. */
async function pagarSemGuincheiroDisponivel(cliente: Parameters<typeof entrarComoCliente>[0]) {
  await entrarComoCliente(cliente);
  // A cotação exige um Guincheiro elegível: o plantão só cai depois do Preço fechado.
  const total = await abrirPedidoAtePreco(cliente);
  await tirarTodosDoPlantao();
  await pagarComPix(cliente);
  await expect(cliente.getByRole('heading', { name: 'Nenhum Guincheiro aceitou' })).toBeVisible();
  await expect(cliente.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await expect(cliente.getByRole('button', { name: 'Estornar o pagamento' })).toBeVisible();
  const pedido = (await pedidoAtual())!;
  expect(pedido.estado).toBe('sem_guincheiro');
  // O pagamento segue autorizado: é ele que as duas opções usam.
  expect(await pagamentosDoPedido(pedido.id)).toEqual([
    { estado: 'autorizado', valor: total, metodo: 'pix' },
  ]);
  return { pedidoId: pedido.id, total };
}

test('sem Guincheiro: o Cliente tenta de novo e o Match recomeça', async ({ cliente }) => {
  const { pedidoId } = await pagarSemGuincheiroDisponivel(cliente);

  // Os Guincheiros voltam ao plantão; "Tentar de novo" abre a rodada 2 com o mesmo pagamento.
  await colocarTodosNoPlantao();
  await cliente.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(
    cliente.getByRole('heading', { name: /Chamando o guincho mais próximo/ }),
  ).toBeVisible();
  await expect
    .poll(async () => (await ofertasDoPedido(pedidoId)).map((o) => [o.rodada, o.guincheiro_id]))
    .toEqual([[2, GUINCHEIROS.marcos]]);
  expect(await pagamentosDoPedido(pedidoId)).toHaveLength(1);
});

test('sem Guincheiro: o Cliente estorna o pagamento', async ({ cliente }) => {
  const { pedidoId, total } = await pagarSemGuincheiroDisponivel(cliente);

  await cliente.getByRole('button', { name: 'Estornar o pagamento' }).click();
  await expect(cliente.getByRole('heading', { name: 'Pagamento estornado' })).toBeVisible();
  await expect(cliente.getByText(`${reais(total)} voltam para você`)).toBeVisible();
  expect(await pagamentosDoPedido(pedidoId)).toEqual([
    { estado: 'estornado', valor: total, metodo: 'pix' },
  ]);
  expect((await pedidoAtual())?.estado).toBe('estornado');
});
