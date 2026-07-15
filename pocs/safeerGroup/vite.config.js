import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/safeerGroup/',
  build: { outDir: 'dist', rollupOptions: { input: 'index.html' } },
  server: { port: 5179 },
});
