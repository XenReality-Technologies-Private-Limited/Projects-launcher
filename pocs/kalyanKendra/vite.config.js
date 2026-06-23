import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/kalyanKendra/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5174,
  },
});
