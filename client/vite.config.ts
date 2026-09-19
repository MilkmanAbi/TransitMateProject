// DEVIATION: the client calls relative /api (proxied here in dev, same-origin in production) instead of
// VITE_API_BASE=http://localhost:3001, because "localhost" points at the phone when judges open it on a device.
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_API_BASE || 'http://localhost:3001', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 900 },
});
