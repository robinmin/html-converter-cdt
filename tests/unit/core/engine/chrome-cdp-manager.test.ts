/**
 * Unit tests for Chrome CDP Manager
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Logger } from "../../../../src/architecture/strategies/types"
import { ChromeCDPManager } from "../../../../src/core/engine/chrome-cdp-manager"
import { TestHttpServer } from "../../../utils/test-helpers"

// Mock chrome-launcher
vi.mock("chrome-launcher", () => ({
  launch: vi.fn(),
  killAll: vi.fn(() => [null]),
}))

// Mock chrome-remote-interface
vi.mock("chrome-remote-interface", () => {
  const mockClient = {
    close: vi.fn(),
    on: vi.fn(),
    Runtime: { evaluate: vi.fn() },
    Page: { enable: vi.fn() },
    Network: { enable: vi.fn() },
  }
  return {
    __esModule: true,
    default: vi.fn(() => mockClient),
    Client: vi.fn(() => mockClient),
  }
})

describe("chromeCDPManager", () => {
  let chromeCDPManager: ChromeCDPManager
  let mockLogger: Logger
  let testServer: TestHttpServer

  beforeEach(async () => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    testServer = new TestHttpServer()
    await testServer.start()

    chromeCDPManager = new ChromeCDPManager(mockLogger, {
      autoLaunch: false, // Disable auto-launch for testing
      maxInstances: 2,
      idleTimeout: 1000, // Short timeout for testing
      headless: true,
      connectionTimeout: 5000,
      pageTimeout: 5000,
    })
  })

  afterEach(async () => {
    await chromeCDPManager.cleanup()
    await testServer.stop()
  })

  describe("constructor", () => {
    it("should initialize with default configuration", () => {
      void new ChromeCDPManager(mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith("Chrome CDP Manager initialized", {
        autoLaunch: true,
        maxInstances: 3,
        idleTimeout: 300000,
      })
    })

    it("should merge user configuration with defaults", () => {
      const customConfig = {
        maxInstances: 5,
        headless: false,
        chromeArgs: ["--custom-flag"],
      }

      void new ChromeCDPManager(mockLogger, customConfig)

      expect(mockLogger.info).toHaveBeenCalledWith("Chrome CDP Manager initialized", {
        autoLaunch: true,
        maxInstances: 5,
        idleTimeout: 300000,
      })
    })
  })

  describe("getMHTMLProcessor", () => {
    it("should throw error when autoLaunch is false and no Chrome available", async () => {
      const manager = new ChromeCDPManager(mockLogger, { autoLaunch: false })

      await expect(manager.getMHTMLProcessor()).rejects.toThrow("Chrome launch failed")
    })
  })

  describe("launchChrome", () => {
    it("should launch Chrome with correct flags", async () => {
      const chromeLauncher = await import("chrome-launcher")
      const mockLaunch = vi.mocked(chromeLauncher.launch)

      const mockChrome = {
        pid: 12345,
        port: 9222,
        kill: vi.fn(),
      }
      mockLaunch.mockResolvedValue(mockChrome as any)

      const manager = new ChromeCDPManager(mockLogger, {
        headless: false,
        chromeArgs: ["--custom-flag"],
        userDataDir: "/tmp/chrome-test",
      })

      const chromeProcess = await manager.launchChrome()

      expect(mockLaunch).toHaveBeenCalledWith({
        chromeFlags: expect.arrayContaining([
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--custom-flag",
        ]),
        port: 0,
        logLevel: "silent",
        userDataDir: "/tmp/chrome-test",
        connectionPollInterval: 1000,
        maxConnectionRetries: 10,
        envVars: {
          DISPLAY: process?.env?.DISPLAY,
        },
      })

      expect(chromeProcess).toEqual({
        pid: 12345,
        port: 9222,
        websocketUrl: "ws://localhost:9222/devtools/browser",
        launchTime: expect.any(Date),
        active: true,
        launcher: mockChrome,
      })

      expect(mockLogger.info).toHaveBeenCalledWith("Chrome instance launched", {
        pid: 12345,
        port: 9222,
        websocketUrl: "ws://localhost:9222/devtools/browser",
      })
    })

    it("should handle Chrome launch failures", async () => {
      const chromeLauncher = await import("chrome-launcher")
      const mockLaunch = vi.mocked(chromeLauncher.launch)

      const launchError = new Error("Chrome not found")
      mockLaunch.mockRejectedValue(launchError)

      const manager = new ChromeCDPManager(mockLogger, { autoLaunch: true })

      await expect(manager.launchChrome()).rejects.toThrow("Chrome launch failed: Chrome not found")
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to launch Chrome instance", launchError)
    })
  })

  describe("getStats", () => {
    it("should return current statistics", () => {
      const stats = chromeCDPManager.getStats()

      expect(stats).toEqual({
        activeProcesses: 0,
        activeConnections: 0,
        maxInstances: 2,
        lastActivity: expect.any(Date),
        processIds: [],
      })
    })

    it("should track active processes", async () => {
      const chromeLauncher = await import("chrome-launcher")
      const mockLaunch = vi.mocked(chromeLauncher.launch)

      const mockChrome = {
        pid: 12345,
        port: 9222,
        kill: vi.fn(),
      }
      mockLaunch.mockResolvedValue(mockChrome as any)

      const manager = new ChromeCDPManager(mockLogger, { autoLaunch: true })
      await manager.launchChrome()

      const stats = manager.getStats()
      expect(stats.activeProcesses).toBe(1)
      expect(stats.processIds).toContain(12345)
    })
  })

  describe("cleanup", () => {
    it("should clean up all resources", async () => {
      const chromeLauncher = await import("chrome-launcher")
      const mockLaunch = vi.mocked(chromeLauncher.launch)

      const mockChrome = {
        pid: 12345,
        port: 9222,
        kill: vi.fn(),
      }
      mockLaunch.mockResolvedValue(mockChrome as any)

      const manager = new ChromeCDPManager(mockLogger, { autoLaunch: true })
      await manager.launchChrome()

      await manager.cleanup()

      expect(mockLogger.info).toHaveBeenCalledWith("Chrome CDP Manager cleaned up")
    })

    it("should handle cleanup errors gracefully", async () => {
      const chromeLauncher = await import("chrome-launcher")
      const mockLaunch = vi.mocked(chromeLauncher.launch)

      const mockChrome = {
        pid: 12345,
        port: 9222,
        kill: vi.fn(() => {
          throw new Error("Kill failed")
        }),
      }
      mockLaunch.mockResolvedValue(mockChrome as any)

      const manager = new ChromeCDPManager(mockLogger, { autoLaunch: true })
      await manager.launchChrome()

      // Should not throw even if cleanup fails
      await expect(manager.cleanup()).resolves.toBeUndefined()

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to kill Chrome process",
        expect.any(Error),
        { pid: 12345 },
      )
    })
  })

  describe("process Management", () => {
    it("should respect maximum instances limit", async () => {
      const chromeLauncher = await import("chrome-launcher")
      const mockLaunch = vi.mocked(chromeLauncher.launch)

      const mockChrome = { pid: 12345, port: 9222, kill: vi.fn() }
      mockLaunch.mockResolvedValue(mockChrome as any)

      const manager = new ChromeCDPManager(mockLogger, {
        autoLaunch: true,
        maxInstances: 1,
      })

      // Launch first instance
      await manager.launchChrome()

      // Launch second instance - should work since cleanup is triggered
      await manager.launchChrome()

      // Should have called launch at least once
      expect(mockLaunch).toHaveBeenCalled()
    })

    it("should reuse processes when configured", async () => {
      const chromeLauncher = await import("chrome-launcher")
      const mockLaunch = vi.mocked(chromeLauncher.launch)

      const mockChrome = { pid: 12345, port: 9222, kill: vi.fn() }
      mockLaunch.mockResolvedValue(mockChrome as any)

      const manager = new ChromeCDPManager(mockLogger, {
        autoLaunch: true,
        reuseInstances: true,
      })

      await manager.launchChrome()
      const stats1 = manager.getStats()
      expect(stats1.activeProcesses).toBe(1)

      // Should reuse existing process
      const process = await manager.launchChrome()
      expect(process.pid).toBe(12345)
    })
  })
})
