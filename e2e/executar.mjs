// `pnpm e2e`: monta o ambiente do e2e e roda o Playwright.
//
//   1. lê as chaves do Supabase local (`supabase status`, que precisa estar de pé);
//   2. builda o Cliente, o Guincheiro e o Painel com elas e com um token de Mapbox falso: o e2e responde
//      o Mapbox com fixtures (veja suporte/mapbox.ts), então nenhum token real é usado;
//   3. roda `playwright test`; argumentos extras (`pnpm e2e --grep Estorno`) vão junto.
//
// `E2E_SEM_BUILD=1` pula o build, para repetir um cenário sem rebuildar os apps.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function rodar(comando, args, env) {
  const { status, error } = spawnSync(comando, args, { cwd: raiz, env, stdio: 'inherit' });
  if (error) throw error;
  if (status !== 0) process.exit(status ?? 1);
}

const status = spawnSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
  cwd: raiz,
  encoding: 'utf8',
});
if (status.status !== 0) {
  console.error(
    'O Supabase local não está de pé. Rode `pnpm supabase start` e `pnpm supabase db reset`.',
  );
  console.error(status.stderr);
  process.exit(1);
}
const chaves = Object.fromEntries(
  [...status.stdout.matchAll(/^([A-Z0-9_]+)="(.*)"$/gm)].map(([, nome, valor]) => [nome, valor]),
);
for (const nome of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  if (!chaves[nome]) {
    console.error(`\`supabase status\` não devolveu ${nome}.`);
    process.exit(1);
  }
}

const env = {
  ...process.env,
  SUPABASE_URL: chaves.API_URL,
  SUPABASE_ANON_KEY: chaves.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: chaves.SERVICE_ROLE_KEY,
  VITE_SUPABASE_URL: chaves.API_URL,
  VITE_SUPABASE_ANON_KEY: chaves.ANON_KEY,
  VITE_MAPBOX_TOKEN: 'pk.e2e',
};

if (process.env.E2E_SEM_BUILD !== '1') {
  rodar(
    'pnpm',
    [
      '--filter',
      '@guinchei/cliente',
      '--filter',
      '@guinchei/guincheiro',
      '--filter',
      '@guinchei/painel',
      'build',
    ],
    env,
  );
}
rodar(
  'pnpm',
  ['--filter', '@guinchei/e2e', 'exec', 'playwright', 'test', ...process.argv.slice(2)],
  env,
);
