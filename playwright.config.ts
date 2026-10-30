import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env['CI'];

/**
 * Browser tests of the pages, run against the dev server.
 *
 * The project `mocked` answers every call of the API in the browser (`e2e/support/api-mock.ts`), so
 * it needs no backend: the requests never reach the proxy of the dev server.
 *
 * The project `integration` goes through the proxy to the real backend on `localhost:8080`. It
 * depends on `integration-setup`, which first checks that the backend answers; a `globalSetup` would
 * run for `mocked` as well.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  // One retry on CI records a trace of the failure; locally a failure is reported at once.
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mocked',
      testDir: './e2e/mocked',
      use: { ...devices['Desktop Chrome'] },
    },
    // Before its setup on purpose: the UI mode first ticks only the first project of the list.
    {
      name: 'integration',
      testDir: './e2e/integration',
      dependencies: ['integration-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'integration-setup',
      testDir: './e2e/integration',
      testMatch: /.*\.setup\.ts/,
    },
  ],
  webServer: {
    command: 'npm start -- --port 4200',
    url: 'http://localhost:4200',
    // Locally an already running `npm start` is used as is.
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
