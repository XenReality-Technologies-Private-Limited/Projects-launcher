import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/gravity/',
  build: {
    outDir: 'dist',
    rollupOptions: { input: 'index.html' },
  },
  server: { port: 5176 },
});
