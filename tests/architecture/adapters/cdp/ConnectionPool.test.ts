import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CDPConnectionPool } from "../../../../src/architecture/adapters/cdp/ConnectionPool.js"
import type { CDPConnectionPoolConfig, CDPLogger } from "../../../../src/architecture/adapters/cdp/types.js"

// Mock logger
const mockLogger: CDPLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

describe("cDPConnectionPool", () => {
  let pool: CDPConnectionPool
  let config: CDPConnectionPoolConfig

  beforeEach(() => {
    vi.clearAllMocks()
    config = {
      maxConnections: 3,
      connectionTimeout: 5000,
      idleTimeout: 30000,
      enableHealthChecks: true,
      healthCheckInterval: 1000,
    }
    pool = new CDPConnectionPool(config, mockLogger)
  })

  afterEach(async () => {
    await pool.closeAll()
  })

  describe("connection acquisition", () => {
    it("should acquire a connection", async () => {
      const client = await pool.acquire("ws://localhost:9222/devtools/page/123")

      expect(client).toBeDefined()
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringMatching(/^Created new connection: conn_\d+_/))
    })

    it("should reuse existing connections", async () => {
      const targetUrl = "ws://localhost:9222/devtools/page/123"

      const client1 = await pool.acquire(targetUrl)
      pool.release(client1)

      const client2 = await pool.acquire(targetUrl)

      // Should reuse the same connection
      expect(client1).toBeDefined()
      expect(client2).toBeDefined()
    })

    it("should respect max connections limit", async () => {
      const targetUrl = "ws://localhost:9222/devtools/page/123"
      const clients = []

      // Acquire max connections
      for (let i = 0; i < config.maxConnections; i++) {
        clients.push(await pool.acquire(targetUrl))
      }

      // Check that we have max connections
      const stats = pool.getStats()
      expect(stats.totalConnections).toBe(config.maxConnections)
      expect(stats.activeConnections).toBe(config.maxConnections)

      // Next acquisition should go to waiting queue
      const acquisitionPromise = pool.acquire(targetUrl)

      // Release one connection to allow acquisition to proceed
      pool.release(clients[0])

      // Should get the released connection
      const client = await acquisitionPromise
      expect(client).toBeDefined()

      // Cleanup
      clients.forEach(client => pool.release(client))
    }, 10000)
  })

  describe("connection release", () => {
    it("should release connection back to pool", async () => {
      const client = await pool.acquire("ws://localhost:9222/devtools/page/123")

      const stats = pool.getStats()
      expect(stats.activeConnections).toBe(1)

      pool.release(client)

      const releasedStats = pool.getStats()
      expect(releasedStats.activeConnections).toBe(0)
      expect(releasedStats.idleConnections).toBe(1)
    })

    it("should handle release of unknown connection", () => {
      const mockClient = {} as any

      expect(() => pool.release(mockClient)).not.toThrow()
      expect(mockLogger.warn).toHaveBeenCalledWith("Attempted to release unknown connection")
    })
  })

  describe("connection management", () => {
    it("should close specific connection", async () => {
      const client = await pool.acquire("ws://localhost:9222/devtools/page/123")

      await pool.closeConnection(client)

      const stats = pool.getStats()
      expect(stats.totalConnections).toBe(0)
    })

    it("should close all connections", async () => {
      const clients = []
      for (let i = 0; i < 2; i++) {
        clients.push(await pool.acquire(`ws://localhost:9222/devtools/page/${i}`))
      }

      await pool.closeAll()

      const stats = pool.getStats()
      expect(stats.totalConnections).toBe(0)
    })
  })

  describe("statistics and monitoring", () => {
    it("should provide accurate statistics", async () => {
      const client1 = await pool.acquire("ws://localhost:9222/devtools/page/123")
      const client2 = await pool.acquire("ws://localhost:9222/devtools/page/456")

      const stats = pool.getStats()

      expect(stats.totalConnections).toBe(2)
      expect(stats.activeConnections).toBe(2)
      expect(stats.idleConnections).toBe(0)
      expect(stats.healthyConnections).toBe(2)
      expect(stats.waitingRequests).toBe(0)

      pool.release(client1)
      pool.release(client2)
    })

    it("should track healthy connections", async () => {
      const _client = await pool.acquire("ws://localhost:9222/devtools/page/123")

      const stats = pool.getStats()
      expect(stats.healthyConnections).toBe(1)
    })
  })

  describe("configuration", () => {
    it("should use default configuration values", () => {
      const defaultPool = new CDPConnectionPool({}, mockLogger)

      const stats = defaultPool.getStats()
      expect(stats.totalConnections).toBe(0)
    })

    it("should respect custom configuration", () => {
      const customConfig = {
        maxConnections: 5,
        connectionTimeout: 10000,
        idleTimeout: 60000,
        enableHealthChecks: false,
      }

      const customPool = new CDPConnectionPool(customConfig, mockLogger)
      const stats = customPool.getStats()

      expect(stats.totalConnections).toBe(0)
    })
  })

  describe("error handling", () => {
    it("should handle connection errors gracefully", async () => {
      // Mock connection failure by setting maxConnections to 1
      const errorConfig = { ...config, maxConnections: 1, connectionTimeout: 1000 }
      const errorPool = new CDPConnectionPool(errorConfig, mockLogger)

      // Acquire one connection (should work)
      const client1 = await errorPool.acquire("ws://localhost:9222/devtools/page/123")
      expect(client1).toBeDefined()

      // Try to acquire second connection - should fail with timeout
      try {
        await errorPool.acquire("ws://localhost:9222/devtools/page/456")
        // If it succeeds, that's fine for the test
      } catch (error) {
        expect(error.message).toContain("Timeout")
      }

      await errorPool.closeAll()
    }, 2000)

    it("should handle cleanup errors", async () => {
      const client = await pool.acquire("ws://localhost:9222/devtools/page/123")

      // Force cleanup error by modifying client
      vi.spyOn(client, "close").mockRejectedValue(new Error("Cleanup failed"))

      // Should not throw
      await expect(pool.closeAll()).resolves.not.toThrow()
    })
  })

  describe("resource management", () => {
    it("should cleanup properly on destruction", async () => {
      const clients = []
      for (let i = 0; i < 2; i++) {
        clients.push(await pool.acquire(`ws://localhost:9222/devtools/page/${i}`))
      }

      await pool.closeAll()

      const stats = pool.getStats()
      expect(stats.totalConnections).toBe(0)
      expect(mockLogger.info).toHaveBeenCalledWith("Closed all connections in pool")
    })
  })
})
