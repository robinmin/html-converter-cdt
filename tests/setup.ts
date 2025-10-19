/**
 * Global test setup for HTML converter testing
 */

import { existsSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

import { v4 as uuidv4 } from "uuid"
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest"

import { TestHttpServer } from "./utils/test-helpers"

// Polyfill process for test worker environment
// Assign the imported process to globalThis to ensure it's available in test workers
// Always assign to ensure consistency across workers
Object.defineProperty(globalThis, "process", {
  value: process,
  writable: true,
  configurable: true,
})

// Suppress unhandled process errors in Vitest workers (known issue)
const originalHandler = process.listeners("unhandledRejection")
process.removeAllListeners("unhandledRejection")
process.on("unhandledRejection", (reason, promise) => {
  // Only suppress process-related errors in worker environment
  if (reason instanceof Error && reason.message === "process is not defined") {
    return // Ignore this specific error
  }
  // Call original handlers for other errors
  originalHandler.forEach(handler => handler(reason, promise))
})

// Global test server instance
let testServer: TestHttpServer | null = null

// Global timeout for async operations
globalThis.TEST_TIMEOUT = 30000

// Polyfill DOMParser for Node.js environment
if (typeof globalThis.DOMParser === "undefined") {
  // Use dynamic import within a function to avoid top-level await
  import("jsdom").then(({ JSDOM }) => {
    globalThis.DOMParser = JSDOM.window.DOMParser as any
  }).catch(() => {
    // Fallback if jsdom is not available
    globalThis.DOMParser = class {
      parseFromString(html: string, _mimeType: string) {
        return {
          title: html.match(/<title>(.*?)<\/title>/i)?.[1] || "",
          querySelector: () => null,
          querySelectorAll: () => [],
        }
      }
    } as any
  })
}

// Polyfill XMLSerializer for Node.js environment
if (typeof globalThis.XMLSerializer === "undefined") {
  globalThis.XMLSerializer = class {
    serializeToString(node: any): string {
      if (node && typeof node === "object") {
        // Handle HTMLDocument fixture structure
        if (node.documentElement && node.documentElement.outerHTML) {
          return node.documentElement.outerHTML
        }
        return node.outerHTML || node.textContent || ""
      }
      return String(node || "")
    }
  } as any
}

// Mock console methods to reduce noise in tests
const originalConsole = globalThis.console

beforeAll(async () => {
  // Start test server for all tests with a random port
  testServer = new TestHttpServer(0) // 0 means system will assign a random available port
  await testServer.start()

  // Set up global test environment
  globalThis.testServer = testServer

  // Mock console.error to avoid noise in test output unless debugging
  if (!process.env.DEBUG_TESTS) {
    globalThis.console = {
      ...originalConsole,
      error: () => {},
      warn: () => {},
      log: process.env.VERBOSE_TESTS ? originalConsole.log : () => {},
      info: () => {},
      debug: () => {},
    }
  }
})

afterAll(async () => {
  // Cleanup test server
  if (testServer) {
    await testServer.stop()
    testServer = null
  }

  // Restore original console
  globalThis.console = originalConsole
})

beforeEach(() => {
  // Reset any global state before each test
})

afterEach(() => {
  // Cleanup after each test
})

// Global utilities for tests
globalThis.testUtils = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  createTempDir: () => {
    const tempDir = join(tmpdir(), `test-${uuidv4()}`)
    mkdirSync(tempDir, { recursive: true })
    return tempDir
  },
  cleanupTempDir: (dir: string) => {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true })
    }
  },
}

// Type declarations for global test utilities
declare global {
  const TEST_TIMEOUT: number
  let testServer: TestHttpServer | null
  const testUtils: {
    delay: (ms: number) => Promise<void>
    createTempDir: () => string
    cleanupTempDir: (dir: string) => void
  }
}
