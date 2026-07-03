import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/paragon/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5175,
  },
});
