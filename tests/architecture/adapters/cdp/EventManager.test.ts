import { beforeEach, describe, expect, it, vi } from "vitest"

import { CDPEventManager } from "../../../../src/architecture/adapters/cdp/EventManager.js"
import type { CDPLogger } from "../../../../src/architecture/adapters/cdp/types.js"

// Mock logger
const mockLogger: CDPLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

describe("cDPEventManager", () => {
  let eventManager: CDPEventManager

  beforeEach(() => {
    vi.clearAllMocks()
    eventManager = new CDPEventManager(mockLogger, 100)
  })

  describe("event listener management", () => {
    it("should add event listeners", () => {
      const handler = vi.fn()
      const listenerId = eventManager.on("Page.loadEventFired", handler)

      expect(typeof listenerId).toBe("string")
      expect(mockLogger.debug).toHaveBeenCalledWith("Added listener for Page.loadEventFired with ID: " + listenerId)
    })

    it("should remove event listeners", () => {
      const handler = vi.fn()
      const listenerId = eventManager.on("Page.loadEventFired", handler)

      const removed = eventManager.off(listenerId)
      expect(removed).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith("Removed listener " + listenerId + " from Page.loadEventFired")
    })

    it("should handle removal of non-existent listener", () => {
      const removed = eventManager.off("non-existent-id")
      expect(removed).toBe(false)
    })

    it("should remove all listeners for an event", () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventManager.on("Page.loadEventFired", handler1)
      eventManager.on("Page.loadEventFired", handler2)

      eventManager.removeAllListeners("Page.loadEventFired")

      expect(mockLogger.debug).toHaveBeenCalledWith("Removed 2 listeners from Page.loadEventFired")
    })

    it("should remove all listeners from all events", () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventManager.on("Page.loadEventFired", handler1)
      eventManager.on("Network.requestWillBeSent", handler2)

      eventManager.removeAllListeners()

      expect(mockLogger.debug).toHaveBeenCalledWith("Removed 2 listeners from all events")
    })
  })

  describe("event emission", () => {
    it("should emit events to listeners", async () => {
      const handler = vi.fn()

      eventManager.on("Page.loadEventFired", handler)
      await eventManager.emit("Page.loadEventFired", { timestamp: 12345 })

      expect(handler).toHaveBeenCalledWith({ timestamp: 12345 })
    })

    it("should emit to multiple listeners", async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventManager.on("Page.loadEventFired", handler1)
      eventManager.on("Page.loadEventFired", handler2)

      await eventManager.emit("Page.loadEventFired", { timestamp: 12345 })

      expect(handler1).toHaveBeenCalledWith({ timestamp: 12345 })
      expect(handler2).toHaveBeenCalledWith({ timestamp: 12345 })
    })

    it("should handle one-time listeners", async () => {
      const handler = vi.fn()

      eventManager.once("Page.loadEventFired", handler)

      await eventManager.emit("Page.loadEventFired", { timestamp: 12345 })
      await eventManager.emit("Page.loadEventFired", { timestamp: 67890 })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ timestamp: 12345 })
    })

    it("should handle listener errors gracefully", async () => {
      const errorHandler = vi.fn(() => {
        throw new Error("Listener error")
      })

      eventManager.on("Page.loadEventFired", errorHandler)

      // Should not throw
      await expect(eventManager.emit("Page.loadEventFired", {})).resolves.not.toThrow()
      expect(mockLogger.error).toHaveBeenCalledWith("Error in event listener for Page.loadEventFired", expect.any(Error))
    })
  })

  describe("filtered and transformed listeners", () => {
    it("should support filtered listeners", async () => {
      const handler = vi.fn()
      const filter = (params: any) => params.timestamp > 1000

      eventManager.onFiltered("Page.loadEventFired", filter, handler)

      await eventManager.emit("Page.loadEventFired", { timestamp: 500 })
      await eventManager.emit("Page.loadEventFired", { timestamp: 1500 })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ timestamp: 1500 })
    })

    it("should support transformed listeners", async () => {
      const handler = vi.fn()
      const transformer = (params: any) => ({ ...params, processed: true })

      eventManager.onTransformed("Page.loadEventFired", transformer, handler)

      await eventManager.emit("Page.loadEventFired", { timestamp: 12345 })

      expect(handler).toHaveBeenCalledWith({ timestamp: 12345, processed: true })
    })
  })

  describe("event waiting", () => {
    it("should wait for specific events", async () => {
      const eventPromise = eventManager.waitForEvent("Page.loadEventFired")

      setTimeout(() => {
        eventManager.emit("Page.loadEventFired", { timestamp: 12345 })
      }, 10)

      const result = await eventPromise
      expect(result).toEqual({ timestamp: 12345 })
    })

    it("should timeout when waiting for events", async () => {
      const eventPromise = eventManager.waitForEvent("Page.loadEventFired", 50)

      await expect(eventPromise).rejects.toThrow("Timeout waiting for event: Page.loadEventFired")
    })

    it("should support filtered waiting", async () => {
      const eventPromise = eventManager.waitForEvent("Page.loadEventFired", 100, params => params.timestamp > 1000)

      await eventManager.emit("Page.loadEventFired", { timestamp: 500 }) // Should be filtered out
      await eventManager.emit("Page.loadEventFired", { timestamp: 1500 }) // Should pass filter

      const result = await eventPromise
      expect(result).toEqual({ timestamp: 1500 })
    })
  })

  describe("multiple events waiting", () => {
    it("should wait for multiple events", async () => {
      const eventPromise = eventManager.waitForEvents(["Page.loadEventFired", "Network.requestWillBeSent"])

      setTimeout(() => {
        eventManager.emit("Page.loadEventFired", { timestamp: 12345 })
      }, 10)

      setTimeout(() => {
        eventManager.emit("Network.requestWillBeSent", { requestId: "123" })
      }, 20)

      const result = await eventPromise
      expect(result).toEqual({
        "Page.loadEventFired": { timestamp: 12345 },
        "Network.requestWillBeSent": { requestId: "123" },
      })
    })
  })

  describe("event history", () => {
    it("should maintain event history", async () => {
      await eventManager.emit("Page.loadEventFired", { timestamp: 12345 })
      await eventManager.emit("Network.requestWillBeSent", { requestId: "123" })

      const history = eventManager.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0].event).toBe("Page.loadEventFired")
      expect(history[1].event).toBe("Network.requestWillBeSent")
    })

    it("should filter event history by event type", async () => {
      await eventManager.emit("Page.loadEventFired", { timestamp: 12345 })
      await eventManager.emit("Network.requestWillBeSent", { requestId: "123" })
      await eventManager.emit("Page.loadEventFired", { timestamp: 67890 })

      const pageHistory = eventManager.getHistory("Page.loadEventFired")
      expect(pageHistory).toHaveLength(2)
      expect(pageHistory.every(item => item.event === "Page.loadEventFired")).toBe(true)
    })

    it("should limit event history size", async () => {
      const smallEventManager = new CDPEventManager(mockLogger, 2)

      await smallEventManager.emit("Event1", {})
      await smallEventManager.emit("Event2", {})
      await smallEventManager.emit("Event3", {})

      const history = smallEventManager.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0].event).toBe("Event2")
      expect(history[1].event).toBe("Event3")
    })

    it("should clear event history", async () => {
      await eventManager.emit("Page.loadEventFired", { timestamp: 12345 })

      eventManager.clearHistory()

      const history = eventManager.getHistory()
      expect(history).toHaveLength(0)
    })
  })

  describe("statistics", () => {
    it("should provide listener count", () => {
      eventManager.on("Page.loadEventFired", vi.fn())
      eventManager.on("Network.requestWillBeSent", vi.fn())
      eventManager.on("Page.loadEventFired", vi.fn())

      expect(eventManager.getListenerCount()).toBe(3)
      expect(eventManager.getListenerCount("Page.loadEventFired")).toBe(2)
      expect(eventManager.getListenerCount("Network.requestWillBeSent")).toBe(1)
    })

    it("should provide event statistics", async () => {
      await eventManager.emit("Page.loadEventFired", { timestamp: 12345 })
      await eventManager.emit("Page.loadEventFired", { timestamp: 67890 })
      await eventManager.emit("Network.requestWillBeSent", { requestId: "123" })

      const stats = eventManager.getStats()
      expect(stats.totalEvents).toBe(3)
      expect(stats.eventCounts["Page.loadEventFired"]).toBe(2)
      expect(stats.eventCounts["Network.requestWillBeSent"]).toBe(1)
    })
  })

  describe("middleware", () => {
    it("should support middleware", async () => {
      const middleware = vi.fn((event, params, next) => {
        params.middlewareProcessed = true
        next()
      })

      const handler = vi.fn()

      eventManager.use(["Page.loadEventFired"], middleware)
      eventManager.on("Page.loadEventFired", handler)

      await eventManager.emit("Page.loadEventFired", { timestamp: 12345 })

      expect(middleware).toHaveBeenCalledWith("Page.loadEventFired", { timestamp: 12345, middlewareProcessed: true }, expect.any(Function))
      expect(handler).toHaveBeenCalledWith({ timestamp: 12345, middlewareProcessed: true })
    })

    it("should support global middleware", async () => {
      const middleware = vi.fn((event, params, next) => {
        next()
      })

      eventManager.use("*", middleware)

      await eventManager.emit("Page.loadEventFired", {})
      await eventManager.emit("Network.requestWillBeSent", {})

      expect(middleware).toHaveBeenCalledTimes(2)
    })
  })

  describe("priority handling", () => {
    it("should respect listener priority", async () => {
      const callOrder: number[] = []

      eventManager.on("Page.loadEventFired", () => callOrder.push(1), { priority: 1 })
      eventManager.on("Page.loadEventFired", () => callOrder.push(3), { priority: 3 })
      eventManager.on("Page.loadEventFired", () => callOrder.push(2), { priority: 2 })

      await eventManager.emit("Page.loadEventFired", {})

      expect(callOrder).toEqual([3, 2, 1])
    })
  })
})
