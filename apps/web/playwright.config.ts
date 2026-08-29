/**
 * The e2e run: two built servers, one browser, no fixtures in the production
 * project.
 *
 * `pnpm --filter web e2e` builds before this file is read, so `webServer` can
 * be the plain `start` command. Each server's `DATA_DIR` is removed by its own
 * command rather than by a global setup, which keeps "fresh database" a
 * property of the boot and not of the order the specs happen to run in.
 *
 * `workers: 1` is not caution: decision 8 allows exactly one active game per
 * database, so two specs sharing a server could not run at once even if they
 * wanted to. The two projects use different servers, but a single worker keeps
 * the generation-latency numbers in the report honest as well.
 */

import { defineConfig, devices } from '@playwright/test';
import { AWKWARD, PRODUCTION, baseUrl, type E2eServer } from './e2e/servers';

const webServerFor = (server: E2eServer) => ({
  // `rm -rf` first: a fresh DB is the precondition of both specs.
  command: `rm -rf ${JSON.stringify(server.dataDir)} && node dist/server/index.js`,
  url: `${baseUrl(server)}/api/history`,
  env: { ...server.env, DATA_DIR: server.dataDir, PORT: String(server.port), HOST: '127.0.0.1' },
  reuseExistingServer: false,
  stdout: 'pipe' as const,
  stderr: 'pipe' as const,
  timeout: 60_000,
});

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // `html` in CI is not decoration: run 33258604286 failed and uploaded
  // nothing, because no reporter ever wrote `playwright-report/`, so the trace
  // and the page snapshot died with the runner and the failure had to be
  // diagnosed from server logs. The report carries both.
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list']],
  // Generation for `diabolical` is the long pole; 90 s leaves room for a bad
  // seed run without letting a hang sit there for ten minutes.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'production',
      testMatch: /game\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: baseUrl(PRODUCTION) },
    },
    {
      name: 'awkward',
      testMatch: /awkward\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: baseUrl(AWKWARD) },
    },
  ],
  webServer: [webServerFor(PRODUCTION), webServerFor(AWKWARD)],
});
