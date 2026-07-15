import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: '.',
  plugins: [react()],
  base: '/safeerGroup/',
  build: { outDir: 'dist', rollupOptions: { input: 'index.html' } },
  server: { port: 5179 },
});
