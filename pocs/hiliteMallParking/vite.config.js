import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/hiliteMallParking/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5181,
  },
});
