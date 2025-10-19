import process from "node:process"

import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright configuration for HTML Converter CDT E2E testing
 *
 * This configuration supports:
 * - Chrome-based testing with real Chrome instances
 * - Integration testing with HTTP servers
 * - CLI testing scenarios
 * - Cross-format conversion validation
 * - Error recovery and timeout testing
 */
export default defineConfig({
  testDir: "./tests",

  // Global test timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Run tests in parallel for efficiency
  fullyParallel: true,

  // Fail fast on first failure for CI
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit workers for CI to avoid resource contention
  workers: process.env.CI ? 1 : undefined,

  // Global setup and teardown
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",

  // Test environment setup
  use: {
    // Base URL for tests
    baseURL: "http://localhost:3001",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Record video on failure
    video: "retain-on-failure",

    // Take screenshot on failure
    screenshot: "only-on-failure",

    // Global test timeout for operations
    actionTimeout: 30000,
  },

  // Configure projects for different browsers and scenarios
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        // Use Chrome with specific flags for CDP compatibility
        launchOptions: {
          args: [
            "--remote-debugging-port=9222",
            "--disable-web-security",
            "--disable-features=TranslateUI",
            "--no-sandbox",
            "--disable-dev-shm-usage",
          ],
        },
      },
    },

    {
      name: "chrome-headed",
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        launchOptions: {
          args: [
            "--remote-debugging-port=9223",
            "--disable-web-security",
            "--start-maximized",
          ],
        },
      },
    },

    {
      name: "integration-tests",
      testMatch: "**/integration/**/*.test.ts",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--remote-debugging-port=9224",
            "--disable-web-security",
            "--no-sandbox",
          ],
        },
      },
    },

    {
      name: "cli-tests",
      testMatch: "**/cli/**/*.test.ts",
      use: {
        ...devices["Desktop Chrome"],
        // CLI tests don't need browser context but we keep it for consistency
        launchOptions: {
          args: [
            "--remote-debugging-port=9225",
            "--no-sandbox",
            "--disable-dev-shm-usage",
          ],
        },
      },
    },

    {
      name: "visual-tests",
      testMatch: "**/visual/**/*.test.ts",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--remote-debugging-port=9226",
            "--disable-web-security",
            "--no-sandbox",
            "--disable-dev-shm-usage",
          ],
        },
      },
      timeout: 120000, // Longer timeout for visual tests
    },

    {
      name: "performance-tests",
      testMatch: "**/performance/**/*.test.ts",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--remote-debugging-port=9227",
            "--disable-web-security",
            "--no-sandbox",
            "--disable-dev-shm-usage",
          ],
        },
      },
      timeout: 300000, // Much longer timeout for performance tests
      fullyParallel: false, // Performance tests should run sequentially
      workers: 1, // Single worker to avoid interference
    },
  ],

  // Development server configuration
  webServer: {
    command: "node tests/e2e/test-server.js",
    port: 3001,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Output directory for test artifacts
  outputDir: "./tests/e2e/test-results",

  // Reporter configuration
  reporter: [
    ["html", { outputFolder: "./tests/e2e/playwright-report" }],
    ["json", { outputFile: "./tests/e2e/test-results.json" }],
    ["junit", { outputFile: "./tests/e2e/test-results.xml" }],
    ["list"],
  ],

  // Global test configuration
  grep: process.env.GREP ? new RegExp(process.env.GREP) : undefined,
  grepInvert: process.env.GREP_INVERT ? new RegExp(process.env.GREP_INVERT) : undefined,
})
