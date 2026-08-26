import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/chicking/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5177,
  },
});
