import { exec } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { promisify } from "node:util"

import type { FullConfig } from "@playwright/test"
import { chromium } from "@playwright/test"

const execAsync = promisify(exec)

async function globalSetup(_config: FullConfig) {
  console.log("🚀 Setting up E2E test environment...")

  // Build the project if not already built
  try {
    await execAsync("pnpm build", { cwd: process.cwd() })
    console.log("✅ Project built successfully")
  } catch (error) {
    console.error("❌ Failed to build project:", error)
    throw error
  }

  // Start Chrome instances for CDP testing
  const browsers = []

  try {
    // Start Chrome instance for integration tests
    const chrome1 = await chromium.launch({
      args: [
        "--remote-debugging-port=9222",
        "--headless",
        "--disable-web-security",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    })
    browsers.push(chrome1)
    console.log("✅ Chrome instance 1 started on port 9222")

    // Start second Chrome instance for multi-instance testing
    const chrome2 = await chromium.launch({
      args: [
        "--remote-debugging-port=9226",
        "--headless",
        "--disable-web-security",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    })
    browsers.push(chrome2)
    console.log("✅ Chrome instance 2 started on port 9226")

    // Store browser references in global scope for cleanup
    ;(globalThis as any).__E2E_BROWSERS__ = browsers

    // Wait for Chrome to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log("🎯 E2E test environment ready")
  } catch (error) {
    console.error("❌ Failed to start Chrome instances:", error)
    throw error
  }

  // Create test fixtures and temporary directories
  const testTempDir = join(tmpdir(), "html-converter-e2e-tests")
  if (!existsSync(testTempDir)) {
    mkdirSync(testTempDir, { recursive: true })
  }

  // Store temp directory path for tests
  ;(globalThis as any).__E2E_TEMP_DIR__ = testTempDir
  console.log(`📁 Test temp directory: ${testTempDir}`)

  return async () => {
    // Global cleanup function
    console.log("🧹 Cleaning up E2E test environment...")

    const browsers = (globalThis as any).__E2E_BROWSERS__ || []
    for (const browser of browsers) {
      try {
        await browser.close()
        console.log("✅ Browser instance closed")
      } catch (error) {
        console.error("❌ Error closing browser:", error)
      }
    }

    // Clean up temp directory
    try {
      fs.rmSync(testTempDir, { recursive: true, force: true })
      console.log("✅ Temp directory cleaned up")
    } catch (error) {
      console.error("❌ Error cleaning temp directory:", error)
    }

    console.log("✅ E2E cleanup completed")
  }
}

export default globalSetup
