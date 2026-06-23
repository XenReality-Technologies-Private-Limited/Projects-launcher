import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/kushals/',
  build: { outDir: 'dist' },
  server: { port: 5173 },
});
