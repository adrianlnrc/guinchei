// Navegadores ao mesmo tempo, um por superfície: o Cliente (com o Mapbox simulado e a
// geolocalização no Eixo Monumental), o Guincheiro e, nos cenários de cadastro, o Painel da
// operação. Cada um é um contexto à parte, com armazenamento e sessão próprios, como dois
// celulares e um computador. Cada cenário só abre os que pede.
import { test as base, expect, type Page } from '@playwright/test';
import { ORIGEM, simularMapbox } from './mapbox';

export const URL_CLIENTE = 'http://localhost:5173';
export const URL_GUINCHEIRO = 'http://localhost:5174';
export const URL_PAINEL = 'http://localhost:5175';

const CELULAR = { width: 390, height: 844 };
const COMPUTADOR = { width: 1280, height: 800 };

interface Navegadores {
  cliente: Page;
  guincheiro: Page;
  painel: Page;
}

/** Erros de execução de uma página; nenhum cenário pode terminar com algum. */
function vigiar(page: Page): string[] {
  const erros: string[] = [];
  page.on('pageerror', (erro) => erros.push(String(erro)));
  return erros;
}

export const test = base.extend<Navegadores>({
  cliente: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: CELULAR,
      geolocation: { latitude: ORIGEM.lat, longitude: ORIGEM.lng },
      permissions: ['geolocation'],
      serviceWorkers: 'block',
    });
    const semFixture = await simularMapbox(context);
    const page = await context.newPage();
    const erros = vigiar(page);
    await use(page);
    expect(erros, 'erros de execução no app do Cliente').toEqual([]);
    expect(semFixture, 'chamadas ao Mapbox sem fixture').toEqual([]);
    await context.close();
  },
  guincheiro: async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: CELULAR, serviceWorkers: 'block' });
    const page = await context.newPage();
    const erros = vigiar(page);
    await use(page);
    expect(erros, 'erros de execução no app do Guincheiro').toEqual([]);
    await context.close();
  },
  painel: async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: COMPUTADOR, serviceWorkers: 'block' });
    const page = await context.newPage();
    const erros = vigiar(page);
    await use(page);
    expect(erros, 'erros de execução no Painel').toEqual([]);
    await context.close();
  },
});

export { expect };
