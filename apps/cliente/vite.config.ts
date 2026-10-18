import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      // O mapbox-gl (~1,8 MB) só serve com rede e com token: fica fora do precache, para a
      // instalação do PWA não baixar o mapa de quem nem chegou à tela de local.
      workbox: { globIgnores: ['**/node_modules/**/*', '**/MapaMapbox-*'] },
      manifest: {
        id: '/cliente',
        name: 'Guinchei',
        short_name: 'Guinchei',
        description: 'Peça um guincho com preço fechado antes de confirmar.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#14161B',
        background_color: '#14161B',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  preview: { port: 5173 },
  test: { environment: 'jsdom' },
});
