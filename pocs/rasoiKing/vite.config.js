import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/rasoiKing/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5180,
  },
});
