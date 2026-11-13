import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 120000, // la primera vez mongodb-memory-server descarga el binario de MongoDB
    env: { NODE_ENV: 'test', UPLOADS_DIR: 'tmp-uploads' },
  },
});
