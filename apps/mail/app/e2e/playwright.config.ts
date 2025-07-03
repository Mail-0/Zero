import { defineConfig } from '@playwright/test';

module.exports = defineConfig({
  retries: 1,
  timeout: 30000,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    baseURL: 'https://localhost:3000',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'E2E',
      testDir: './e2e',
      testMatch: '**/*.spec.ts',
    },
  ],
  outputDir: 'playwright/test-results/artifacts',
  preserveOutput: 'failures-only',
});
