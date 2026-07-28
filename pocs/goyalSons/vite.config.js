import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/goyalSons/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5176,
  },
});
