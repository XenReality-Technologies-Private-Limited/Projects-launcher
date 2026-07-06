import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/yamaha/',
  build: { outDir: 'dist' },
  server: { port: 5177 },
});
