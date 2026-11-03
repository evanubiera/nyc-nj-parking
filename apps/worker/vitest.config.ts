import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['../../packages/db/src/vitest-global-setup.ts'],
    fileParallelism: false,
  },
});
