import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/technoSport/',
  build: { outDir: 'dist' },
  server: { port: 5173 },
});
