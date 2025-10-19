import { exec } from "node:child_process"
import { promisify } from "node:util"

import type { FullConfig } from "@playwright/test"

const execAsync = promisify(exec)

async function globalTeardown(_config: FullConfig) {
  console.log("🏁 Running global teardown...")

  // The actual cleanup is handled in the globalSetup return function
  // This is mainly for logging and any additional cleanup

  const browsers = (globalThis as any).__E2E_BROWSERS__ || []
  console.log(`📊 Closing ${browsers.length} browser instances...`)

  // Force close any remaining browser processes
  try {
    // Kill any remaining Chrome processes with our debug ports
    const debugPorts = [9222, 9223, 9224, 9225, 9226]
    for (const port of debugPorts) {
      try {
        await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`)
      } catch {
        // Ignore errors - process might not exist
      }
    }

    console.log("✅ All Chrome processes terminated")
  } catch (_error) {
    console.error("❌ Error during final cleanup:", _error)
  }

  console.log("🎉 Global teardown completed")
}

export default globalTeardown
