import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/halliMane/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5173,
  },
});
