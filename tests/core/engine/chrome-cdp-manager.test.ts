/**
 * Tests for Chrome CDP Manager
 */

import * as chromeLauncher from "chrome-launcher"
import * as CRI from "chrome-remote-interface"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Logger } from "../../../src/architecture/strategies/types.js"
import { ChromeCDPManager } from "../../../src/core/engine/chrome-cdp-manager.js"

// Mock chrome-launcher
vi.mock("chrome-launcher", () => ({
  launch: vi.fn(),
  kill: vi.fn(),
}))

// Mock chrome-remote-interface
vi.mock("chrome-remote-interface", () => ({
  default: vi.fn(),
}))

// Mock logger
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Mock CRI client
const mockCRIClient = {
  close: vi.fn(),
  on: vi.fn(),
  Page: { enable: vi.fn() },
  Runtime: { enable: vi.fn() },
  Network: { enable: vi.fn() },
}

describe("chromeCDPManager", () => {
  let manager: ChromeCDPManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new ChromeCDPManager(mockLogger, {
      autoLaunch: false, // Disable auto-launch for tests
      maxInstances: 2,
      idleTimeout: 1000, // Short timeout for tests
    })
  })

  afterEach(async () => {
    await manager.cleanup()
    vi.restoreAllMocks()
  })

  describe("initialization", () => {
    it("should initialize with default configuration", () => {
      const defaultManager = new ChromeCDPManager(mockLogger)
      expect(defaultManager).toBeDefined()
    })

    it("should initialize with custom configuration", () => {
      const customManager = new ChromeCDPManager(mockLogger, {
        maxInstances: 5,
        headless: false,
        connectionTimeout: 60000,
      })
      expect(customManager).toBeDefined()
    })
  })

  describe("chrome process management", () => {
    it("should launch Chrome instance successfully", async () => {
      const mockChrome = {
        pid: 12345,
        port: 9222,
      }

      ;(chromeLauncher.launch as any).mockResolvedValue(mockChrome)

      const process = await manager.launchChrome()

      expect(process).toEqual({
        pid: 12345,
        port: 9222,
        websocketUrl: "ws://localhost:9222/devtools/browser",
        launchTime: expect.any(Date),
        active: true,
      })

      expect(chromeLauncher.launch).toHaveBeenCalledWith({
        chromeFlags: expect.arrayContaining([
          "--headless",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-plugins",
        ]),
        port: 0,
        logLevel: "silent",
        enableLogging: false,
        userDataDir: undefined,
        connectionPollInterval: 1000,
        maxConnectionRetries: 10,
        envVars: {
          DISPLAY: process.env.DISPLAY,
        },
      })
    })

    it("should handle Chrome launch failures", async () => {
      ;(chromeLauncher.launch as any).mockRejectedValue(new Error("Chrome not found"))

      await expect(manager.launchChrome()).rejects.toThrow("Chrome launch failed: Chrome not found")
    })

    it("should kill Chrome process successfully", async () => {
      const mockChrome = {
        pid: 12345,
        port: 9222,
      }

      ;(chromeLauncher.launch as any).mockResolvedValue(mockChrome)
      ;(CRI.default as any).mockResolvedValue(mockCRIClient)

      const process = await manager.launchChrome()
      await manager.getOrCreateChromeProcess()

      await manager.killChromeProcess(process.pid)

      expect(chromeLauncher.kill).toHaveBeenCalledWith(12345)
    })
  })

  describe("mHTML processor management", () => {
    it("should get MHTML processor with CDP connection", async () => {
      const mockChrome = {
        pid: 12345,
        port: 9222,
      }

      ;(chromeLauncher.launch as any).mockResolvedValue(mockChrome)
      ;(CRI.default as any).mockResolvedValue(mockCRIClient)

      const processor = await manager.getMHTMLProcessor()

      expect(processor).toBeDefined()
      expect(CRI.default).toHaveBeenCalledWith({
        port: 9222,
        host: "localhost",
      })
    })

    it("should reuse existing Chrome processes", async () => {
      const mockChrome = {
        pid: 12345,
        port: 9222,
      }

      ;(chromeLauncher.launch as any).mockResolvedValue(mockChrome)
      ;(CRI.default as any).mockResolvedValue(mockCRIClient)

      const processor1 = await manager.getMHTMLProcessor()
      const processor2 = await manager.getMHTMLProcessor()

      expect(processor1).toBeDefined()
      expect(processor2).toBeDefined()
      expect(chromeLauncher.launch).toHaveBeenCalledTimes(1) // Should reuse
    })

    it("should respect maximum instance limit", async () => {
      const managerWithLimit = new ChromeCDPManager(mockLogger, {
        autoLaunch: false,
        maxInstances: 1,
        idleTimeout: 1000,
      })

      const mockChrome1 = { pid: 12345, port: 9222 }
      const mockChrome2 = { pid: 12346, port: 9223 }

      ;(chromeLauncher.launch as any)
        .mockResolvedValueOnce(mockChrome1)
        .mockResolvedValueOnce(mockChrome2)
      ;(CRI.default as any).mockResolvedValue(mockCRIClient)

      // First processor should work
      const processor1 = await managerWithLimit.getMHTMLProcessor()
      expect(processor1).toBeDefined()

      // Mock process cleanup to allow second instance
      vi.spyOn(managerWithLimit as any, "cleanupIdleProcesses").mockResolvedValueOnce(undefined)

      const processor2 = await managerWithLimit.getMHTMLProcessor()
      expect(processor2).toBeDefined()

      await managerWithLimit.cleanup()
    })
  })

  describe("cleanup operations", () => {
    it("should cleanup all resources", async () => {
      const mockChrome = {
        pid: 12345,
        port: 9222,
      }

      ;(chromeLauncher.launch as any).mockResolvedValue(mockChrome)
      ;(CRI.default as any).mockResolvedValue(mockCRIClient)

      await manager.getMHTMLProcessor()
      await manager.cleanup()

      expect(mockCRIClient.close).toHaveBeenCalled()
      expect(chromeLauncher.kill).toHaveBeenCalledWith(12345)
    })

    it("should handle cleanup errors gracefully", async () => {
      const mockChrome = {
        pid: 12345,
        port: 9222,
      }

      ;(chromeLauncher.launch as any).mockResolvedValue(mockChrome)
      ;(CRI.default as any).mockResolvedValue(mockCRIClient)

      // Mock cleanup errors
      mockCRIClient.close.mockRejectedValue(new Error("Connection error"))
      ;(chromeLauncher.kill as any).mockRejectedValue(new Error("Process error"))

      await manager.getMHTMLProcessor()

      // Should not throw
      await expect(manager.cleanup()).resolves.not.toThrow()

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to close CDP connection",
        expect.any(Error),
        { pid: 12345 },
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to kill Chrome process",
        expect.any(Error),
        { pid: 12345 },
      )
    })
  })

  describe("statistics", () => {
    it("should provide manager statistics", () => {
      const stats = manager.getStats()

      expect(stats).toEqual({
        activeProcesses: 0,
        activeConnections: 0,
        maxInstances: 2,
        lastActivity: expect.any(Date),
        processIds: [],
      })
    })

    it("should update statistics after creating processor", async () => {
      const mockChrome = {
        pid: 12345,
        port: 9222,
      }

      ;(chromeLauncher.launch as any).mockResolvedValue(mockChrome)
      ;(CRI.default as any).mockResolvedValue(mockCRIClient)

      await manager.getMHTMLProcessor()
      const stats = manager.getStats()

      expect(stats.activeProcesses).toBe(1)
      expect(stats.activeConnections).toBe(1)
      expect(stats.processIds).toContain(12345)
    })
  })

  describe("process lifecycle management", () => {
    it("should detect dead processes", () => {
      // Mock process.kill to throw for non-existent process
      const originalKill = process.kill
      process.kill = vi.fn((pid: number, signal: string) => {
        if (pid === 99999) {
          throw new Error("Process not found")
        }
        return originalKill.call(process, pid, signal)
      })

      const isAlive = (manager as any).isProcessAlive(99999)
      expect(isAlive).toBe(false)

      // Restore original process.kill
      process.kill = originalKill
    })

    it("should detect live processes", () => {
      const isAlive = (manager as any).isProcessAlive(process.pid)
      expect(isAlive).toBe(true)
    })
  })
})
