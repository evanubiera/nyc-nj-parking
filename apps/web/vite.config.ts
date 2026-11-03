import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    // The API is same-origin in deployment; locally Vite forwards /api to it.
    proxy: { '/api': 'http://127.0.0.1:8180' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'lint/**/*.test.ts'],
  },
});
