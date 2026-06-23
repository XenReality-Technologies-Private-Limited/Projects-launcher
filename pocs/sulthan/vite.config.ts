import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/sulthan/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // sql.js is loaded via importScripts in the worker (not ESM), so worker format must be iife.
    worker: {
      format: 'iife',
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      // No /api proxy — all KPI queries run client-side via sql.js WASM worker.
      // .db files are served by Nginx (production) or Vite's static server (dev, see publicDir).
    },
  };
});
