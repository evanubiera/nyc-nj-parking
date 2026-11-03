import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./src/vitest-global-setup.ts'],
    // One database for the whole run, and PGlite has a single backend, so test files run one at a time.
    fileParallelism: false,
  },
});
