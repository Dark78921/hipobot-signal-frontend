import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3401,
    proxy: {
      '/health': {
        target: 'http://127.0.0.1:3400',
        changeOrigin: true,
      },
      '/signals': {
        target: 'http://127.0.0.1:3400',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:3400',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
