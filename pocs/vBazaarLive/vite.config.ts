import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const vBazaarSrc = path.resolve(__dirname, '../vBazaar/src');

export default defineConfig({
  root: path.resolve(__dirname, '../vBazaar'),
  base: '/vBazaarLive/',
  plugins: [
    react(),
    tailwindcss(),
    // './db' in vBazaar/src would resolve to the vanilla PoC's db.js instead of
    // the React app's db/index.ts — redirect it to the TypeScript module.
    {
      name: 'redirect-poc-db',
      resolveId(id: string, importer?: string) {
        if (id === './db' && importer?.startsWith(vBazaarSrc)) {
          return path.resolve(path.dirname(importer), 'db/index.ts');
        }
      },
    },
  ],
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY ?? ''),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../vBazaar'),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, '../vBazaar/index.live.html'),
    },
  },
  server: {
    port: 5179,
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
