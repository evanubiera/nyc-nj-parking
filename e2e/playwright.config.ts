// S1-10: the smoke test, on an emulated phone, against the stack in stack.ts and the Vite dev server.
// Its own ports, so it can run next to `pnpm dev` (8180/5180) and the gear-rental project.
import { defineConfig, devices } from '@playwright/test';

const API_PORT = 8181;
const STYLE_PORT = 8182;
const WEB_PORT = 5181;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      command: 'node stack.ts',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: { E2E_API_PORT: String(API_PORT), E2E_STYLE_PORT: String(STYLE_PORT) },
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `pnpm --filter @parking/web exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_ORIGIN: `http://127.0.0.1:${API_PORT}`, VITE_MAP_STYLE_URL: `http://127.0.0.1:${STYLE_PORT}/style.json` },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
