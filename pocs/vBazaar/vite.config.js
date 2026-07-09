import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/vBazaar/',
  build: { outDir: 'dist' },
  server: { port: 5178 },
});
