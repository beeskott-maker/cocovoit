/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Chemin du site (« / » sur cocovoiturage.fr, « /cocovoit/ » sur github.io) ; BASE_PATH est fourni par la CI.
const base = process.env.BASE_PATH ?? '/';
const isDev = process.env.VITE_APP_ENV === 'dev';

export default defineConfig({
  base,
  plugins: [
    react(),
    // Appli installable (PWA). Le service worker ne met en cache que les fichiers
    // de l'appli : les données (voyages, places) sont toujours lues en direct.
    // Sa portée est le chemin du build : la prod (/) et la version de test (/dev/)
    // ont chacune le leur, le plus précis l'emportant sur /dev/.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: isDev ? 'Coco·voit (dev)' : 'Coco·voit',
        short_name: isDev ? 'Coco dev' : 'Coco·voit',
        description: 'Organise le covoiturage de ton voyage entre proches.',
        lang: 'fr',
        start_url: `${base}#/voyages`,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#5b3cc4',
        background_color: '#ffeaf3',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Les images des emails ne servent pas à l'appli.
        globIgnores: ['email-*.png', 'dev/**'],
        navigateFallback: 'index.html',
        // La prod ne répond jamais à la place de la version de test.
        navigateFallbackDenylist: [/\/dev\//],
        cleanupOutdatedCaches: true,
        // Nouvelle version active tout de suite (sans attendre que l'appli soit fermée) :
        // la page se recharge alors d'elle-même (src/lib/swUpdate.ts).
        skipWaiting: true,
        clientsClaim: true,
        // Affichage des notifications push et ouverture du voyage au toucher.
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'polices', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
