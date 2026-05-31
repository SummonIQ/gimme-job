import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'child_process';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_PLAYWRIGHT_PORT = Number(process.env.PLAYWRIGHT_PORT || '10110');
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  `http://localhost:${DEFAULT_PLAYWRIGHT_PORT}`;
const port = Number(new URL(baseURL).port) || DEFAULT_PLAYWRIGHT_PORT;
const devCommand = `NEXT_DIST_DIR=.next-e2e bun next dev --turbopack --port ${port}`;

let serverAlreadyRunning = false;
try {
  execSync(`lsof -i :${port} -sTCP:LISTEN`, { stdio: 'ignore' });
  serverAlreadyRunning = true;
} catch {
  serverAlreadyRunning = false;
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Viewport size */
    viewport: { width: 1280, height: 720 },

    /* Maximum time each action can take */
    actionTimeout: 15 * 1000,

    /* Navigation timeout */
    navigationTimeout: 30 * 1000,
  },

  /* Maximum time one test can run */
  timeout: 60 * 1000,

  /* Configure setup + Chromium project only */
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /auth\/auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer:
    serverAlreadyRunning || process.env.PLAYWRIGHT_SKIP_WEBSERVER
      ? undefined
      : {
          command: devCommand,
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },
});
