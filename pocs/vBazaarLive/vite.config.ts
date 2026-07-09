import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: path.resolve(__dirname, '../vBazaar'),
  base: '/vBazaarLive/',
  plugins: [react(), tailwindcss()],
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
