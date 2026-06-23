import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/usPolo/',
  build: { outDir: 'dist' },
  server: { port: 5173 },
});
