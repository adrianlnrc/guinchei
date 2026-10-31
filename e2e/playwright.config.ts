import { defineConfig } from '@playwright/test';

const noCI = Boolean(process.env.CI);

// Os três apps rodam em `vite preview` (build de produção), nas portas de sempre. Quem monta o
// build e as variáveis é `executar.mjs` (`pnpm e2e`); aqui só se serve o que já está em dist/.
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  // Os cenários compartilham o mesmo banco: um de cada vez, sempre na mesma ordem de preparo.
  workers: 1,
  fullyParallel: false,
  retries: noCI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  forbidOnly: noCI,
  reporter: noCI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  outputDir: 'resultados',
  use: {
    // Trace com o passo a passo dos dois navegadores; abre com `pnpm exec playwright show-trace`.
    trace: noCI ? 'retain-on-failure' : 'off',
    // O service worker do PWA ficaria entre a página e o `page.route` do Mapbox.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        launchOptions: {
          // No sandbox de desenvolvimento o Chromium vem de fora; no CI, de `playwright install`.
          executablePath: process.env.CHROMIUM_PATH || undefined,
          // O mapbox-gl precisa de WebGL, que o Chromium sem GPU só dá pelo SwiftShader.
          args: [
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @guinchei/cliente preview --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !noCI,
      cwd: '..',
    },
    {
      command: 'pnpm --filter @guinchei/guincheiro preview --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: !noCI,
      cwd: '..',
    },
    {
      command: 'pnpm --filter @guinchei/painel preview --strictPort',
      url: 'http://localhost:5175',
      reuseExistingServer: !noCI,
      cwd: '..',
    },
  ],
});
