// Teste de navegador do #13: Guincheiro e Cliente registram Fotos de estado de verdade.
//
// Roteiro manual (não roda no CI): com o Supabase local de pé (`pnpm supabase start`) e os dois
// apps em `pnpm dev:cliente` e `pnpm dev:guincheiro` (com `.env.local`):
//
//   pnpm supabase db reset
//   docker exec -i supabase_db_guinchei psql -U postgres < e2e/fotos-de-estado/cenario.sql
//   PLAYWRIGHT_PATH=<pasta do módulo playwright> node e2e/fotos-de-estado/fotos.cjs
//
// `PLAYWRIGHT_PATH` (padrão `playwright`) e `CHROMIUM_PATH` (padrão: o Chromium do Playwright)
// apontam para a instalação local. O cenário põe a Corrida do Rafael com o Marcos em `no_local`.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

const PNG = path.join(__dirname, 'carro.png');
const SAIDA = process.env.SAIDA_DAS_CAPTURAS || require('node:os').tmpdir();

async function entrar(page, url, celular) {
  await page.goto(url);
  // Cliente: tela de boas-vindas antes do celular.
  const pedir = page.getByRole('button', { name: 'Pedir guincho agora' });
  if (await pedir.count()) await pedir.click();
  await page.getByLabel('Celular com DDD').fill(celular);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await page.getByLabel('Código de 6 dígitos').fill('123456');
  await page.getByRole('button', { name: 'Confirmar' }).click();
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const contexto = () =>
    browser.newContext({
      viewport: { width: 390, height: 844 },
      geolocation: { latitude: -15.7903, longitude: -47.8921 },
      permissions: ['geolocation'],
    });
  const erros = [];

  // 1. Guincheiro (Marcos), Corrida em no_local
  const guincheiro = await (await contexto()).newPage();
  guincheiro.on('pageerror', (e) => erros.push(String(e)));
  await entrar(guincheiro, 'http://localhost:5174/', '(61) 90000-0002');
  await guincheiro.getByRole('button', { name: 'Carreguei' }).waitFor();
  await guincheiro.screenshot({ path: path.join(SAIDA, '1-guincheiro-no-local.png') });

  // Foto antes de carregar, pela câmera (campo de arquivo com capture)
  await guincheiro.getByRole('button', { name: /Fotos de estado/ }).click();
  const campo = guincheiro.getByLabel('Escolher foto ou vídeo');
  assert.equal(await campo.getAttribute('capture'), 'environment');
  assert.equal(await campo.getAttribute('accept'), 'image/*,video/*');
  await campo.setInputFiles(PNG);
  const imagem = guincheiro.getByAltText(/Foto: Guincheiro às/);
  await imagem.waitFor();
  await guincheiro.getByText('Seus itens nesta etapa: 1 de 6').waitFor();
  // A imagem veio da URL assinada do Storage e carregou de verdade.
  await imagem.evaluate((img) => img.decode());
  assert.equal(await imagem.evaluate((img) => img.naturalWidth), 1);
  await guincheiro.screenshot({ path: path.join(SAIDA, '2-guincheiro-foto-antes.png') });

  // Carreguei com foto da etapa: sem aviso
  await guincheiro.getByRole('button', { name: 'Voltar à Corrida' }).click();
  await guincheiro.getByRole('button', { name: 'Carreguei' }).click();
  await guincheiro.getByRole('button', { name: 'Entreguei' }).waitFor();
  assert.equal(await guincheiro.getByRole('alertdialog').count(), 0);

  // 2. Cliente (Rafael) vê a foto do Guincheiro e registra a dele (Corrida em carregado)
  const cliente = await (await contexto()).newPage();
  cliente.on('pageerror', (e) => erros.push(String(e)));
  await entrar(cliente, 'http://localhost:5173/', '(61) 90000-0001');
  await cliente.goto('http://localhost:5173/acompanhamento');
  await cliente.getByRole('heading', { name: /Veículo carregado/ }).waitFor();
  const antes = cliente.getByRole('region', { name: 'Antes do carregamento' });
  await antes.getByAltText(/Foto: Guincheiro às/).waitFor();
  assert.equal(await antes.getByRole('img').count(), 1);
  assert.equal(await cliente.getByRole('note').count(), 0); // carregado: sem sugestão destacada
  await cliente.getByRole('button', { name: 'Registrar fotos' }).click();
  await cliente.getByLabel('Escolher foto ou vídeo').setInputFiles(PNG);
  const depois = cliente.getByRole('region', { name: 'Carregado e entrega' });
  await depois.getByAltText(/Foto: Cliente às/).waitFor();
  await cliente.screenshot({ path: path.join(SAIDA, '3-cliente-galeria.png'), fullPage: true });

  // 3. Guincheiro: Entreguei sem fotos de "depois" pede confirmação
  await guincheiro.getByRole('button', { name: 'Entreguei' }).click();
  const aviso = guincheiro.getByRole('alertdialog');
  await aviso.waitFor();
  assert.match(
    await aviso.innerText(),
    /Registrar fotos protege você se houver reclamação de avaria\./,
  );
  assert.equal(await guincheiro.getByText('Seu repasse').count(), 0); // ainda não entregou
  await guincheiro.screenshot({ path: path.join(SAIDA, '4-guincheiro-aviso.png') });
  await guincheiro.getByRole('button', { name: 'Seguir sem fotos' }).click();
  await guincheiro.getByText('Seu repasse').waitFor();

  // 4. O Cliente recebe a entrega pelo Realtime, com a sugestão de registrar
  await cliente.getByRole('heading', { name: /Entregue/ }).waitFor();
  const sugestao = cliente.getByRole('note');
  await sugestao.waitFor();
  assert.match(await sugestao.innerText(), /Registrar fotos protege você/);
  await cliente.getByRole('region', { name: 'Fotos da Corrida' }).waitFor();
  await cliente.screenshot({ path: path.join(SAIDA, '5-cliente-entregue.png'), fullPage: true });

  assert.deepEqual(erros, []);
  console.log('OK: fluxo do navegador passou');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
