// DEVIATION: the client calls relative /api (proxied here in dev, same-origin in production) instead of
// VITE_API_BASE=http://localhost:3001, because "localhost" points at the phone when judges open it on a device.
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// VITE_BASE=/TransitMateProject/ for the GitHub Pages build (served from a sub-path).
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    // Offline app shell for the no-signal-underground case (PS2 §2.6). No push notifications.
    // The last journey and alerts are persisted in localStorage by the store, so they render offline too.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,webmanifest}'],
        globIgnores: ['**/mrt-stations.geojson'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          { urlPattern: /\/api\/(train\/alerts|plan|bus\/arrivals)/, handler: 'NetworkFirst', options: { cacheName: 'api', networkTimeoutSeconds: 6, expiration: { maxEntries: 40, maxAgeSeconds: 86400 } } },
          { urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.fr\//, handler: 'CacheFirst', options: { cacheName: 'tiles', expiration: { maxEntries: 400, maxAgeSeconds: 7 * 86400 } } },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_API_BASE || 'http://localhost:3001', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 900 },
});
