import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: '../reports/html-report', open: 'never' }],
    ['json', { outputFile: '../reports/playwright-results.json' }],
    ['list']
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    headless: process.env.HEADLESS !== 'false',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
    geolocation: { latitude: 22.5360, longitude: 72.8950 },
    permissions: ['geolocation'],
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
