import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo, /api y /uploads se redirigen a la API (evita problemas de CORS)
    proxy: { '/api': 'http://localhost:4000', '/uploads': 'http://localhost:4000' },
  },
});
