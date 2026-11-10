import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api-mineru': {
        target: 'https://mineru.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-mineru/, ''),
      },
      '/api-paddle': {
        target: 'https://paddleocr.aistudio-app.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-paddle/, ''),
      },
      '/api-tokenplan': {
        target: 'https://api.lkeap.cloud.tencent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-tokenplan/, ''),
      },
      '/api-chgis': {
        target: 'https://maps.cga.harvard.edu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-chgis/, ''),
      },
    },
  },
});
