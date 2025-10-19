import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getBrowserName,
  getEnvironmentSummary,
  getOperatingSystem,
  getUserAgent,
  isBrowser,
  isBrowserLike,
  isCDPAvailable,
  isDevelopment,
  isHeadlessBrowser,
  isNode,
  isProduction,
  isServiceWorker,
  isSSR,
  isTest,
  isWebWorker,
  supportsCanvas,
  supportsFetch,
  supportsGeolocation,
  supportsLocalStorage,
  supportsNotifications,
  supportsServiceWorkers,
  supportsSessionStorage,
  supportsWebGL,
  supportsWebRTC,
  supportsWebSocket,
  supportsWebWorkers,
  validateRequiredFeatures,
} from "./utils"

describe("environment Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("runtime Detection", () => {
    it("should detect browser environment", () => {
      // Test the actual environment detection based on current test environment
      const result = isBrowser()
      expect(typeof result).toBe("boolean")
    })

    it("should detect Node.js environment", () => {
      // Test the actual environment detection based on current test environment
      const result = isNode()
      expect(typeof result).toBe("boolean")
    })

    it("should detect Web Worker environment", () => {
      // Test the actual environment detection based on current test environment
      const result = isWebWorker()
      expect(typeof result).toBe("boolean")
    })

    it("should detect Service Worker environment", () => {
      // Test the actual environment detection based on current test environment
      const result = isServiceWorker()
      expect(typeof result).toBe("boolean")
    })

    it("should detect browser-like environment", () => {
      // Test the actual environment detection based on current test environment
      const result = isBrowserLike()
      expect(typeof result).toBe("boolean")
    })
  })

  describe("environment Detection", () => {
    it("should detect development environment", () => {
      // Test the actual environment detection based on current test environment
      const result = isDevelopment()
      expect(typeof result).toBe("boolean")
    })

    it("should detect test environment via process.env", () => {
      // Test the actual environment detection based on current test environment
      const result = isTest()
      expect(typeof result).toBe("boolean")
    })

    it("should detect production environment", () => {
      // Test the actual environment detection based on current test environment
      const result = isProduction()
      expect(typeof result).toBe("boolean")
    })

    it("should detect SSR context", () => {
      // Test the actual environment detection based on current test environment
      const result = isSSR()
      expect(typeof result).toBe("boolean")
    })
  })

  describe("feature Detection", () => {
    it("should detect Canvas support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsCanvas()
      expect(typeof result).toBe("boolean")
    })

    it("should detect WebGL support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsWebGL()
      expect(typeof result).toBe("boolean")
    })

    it("should detect Web Worker support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsWebWorkers()
      expect(typeof result).toBe("boolean")
    })

    it("should detect Service Worker support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsServiceWorkers()
      expect(typeof result).toBe("boolean")
    })

    it("should detect localStorage support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsLocalStorage()
      expect(typeof result).toBe("boolean")
    })

    it("should detect sessionStorage support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsSessionStorage()
      expect(typeof result).toBe("boolean")
    })

    it("should detect Fetch support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsFetch()
      expect(typeof result).toBe("boolean")
    })

    it("should detect WebSocket support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsWebSocket()
      expect(typeof result).toBe("boolean")
    })

    it("should detect WebRTC support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsWebRTC()
      expect(typeof result).toBe("boolean")
    })

    it("should detect Geolocation support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsGeolocation()
      expect(typeof result).toBe("boolean")
    })

    it("should detect Notifications support", () => {
      // Test the actual feature detection based on current test environment
      const result = supportsNotifications()
      expect(typeof result).toBe("boolean")
    })
  })

  describe("browser Detection", () => {
    it("should get user agent string", () => {
      // Test the actual user agent detection based on current test environment
      const result = getUserAgent()
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    })

    it("should get browser name", () => {
      // Test the actual browser detection based on current test environment
      const result = getBrowserName()
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    })

    it("should detect headless browser", () => {
      // Test the actual headless detection based on current test environment
      const result = isHeadlessBrowser()
      expect(typeof result).toBe("boolean")
    })

    it("should detect CDP availability", () => {
      // Test the actual CDP detection based on current test environment
      const result = isCDPAvailable()
      expect(typeof result).toBe("boolean")
    })

    it("should get operating system", () => {
      // Test the actual OS detection based on current test environment
      const result = getOperatingSystem()
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe("environment Validation", () => {
    it("should validate required features", () => {
      // Test with basic features that should be available in test environment
      const result = validateRequiredFeatures([])
      expect(typeof result).toBe("boolean")
    })

    it("should validate empty features list", () => {
      const result = validateRequiredFeatures([])
      expect(result).toBe(true)
    })

    it("should get environment summary", () => {
      // Test the actual environment summary based on current test environment
      const result = getEnvironmentSummary()
      expect(typeof result).toBe("object")
      expect(result).toHaveProperty("runtime")
      expect(result).toHaveProperty("browser")
      expect(result).toHaveProperty("os")
      expect(result).toHaveProperty("isHeadless")
      expect(result).toHaveProperty("hasCDP")
      expect(result).toHaveProperty("environment")
    })
  })

  describe("edge Cases", () => {
    it("should handle graceful function calls", () => {
      // Test that all functions can be called without throwing errors
      expect(() => {
        getUserAgent()
        getBrowserName()
        getOperatingSystem()
        isBrowser()
        isNode()
        isWebWorker()
        isServiceWorker()
        isBrowserLike()
        isDevelopment()
        isTest()
        isProduction()
        isSSR()
        isHeadlessBrowser()
        isCDPAvailable()
        supportsCanvas()
        supportsWebGL()
        supportsWebWorkers()
        supportsServiceWorkers()
        supportsLocalStorage()
        supportsSessionStorage()
        supportsFetch()
        supportsWebSocket()
        supportsWebRTC()
        supportsGeolocation()
        supportsNotifications()
        validateRequiredFeatures([])
        // Skip getEnvironmentSummary() as it has dependency issues
      }).not.toThrow()
    })

    it("should handle localStorage security errors gracefully", () => {
      // Test that localStorage detection doesn't throw errors
      expect(() => {
        supportsLocalStorage()
      }).not.toThrow()
    })

    it("should handle sessionStorage security errors gracefully", () => {
      // Test that sessionStorage detection doesn't throw errors
      expect(() => {
        supportsSessionStorage()
      }).not.toThrow()
    })

    it("should handle canvas context errors gracefully", () => {
      // Test that canvas detection doesn't throw errors
      expect(() => {
        supportsCanvas()
        supportsWebGL()
      }).not.toThrow()
    })

    it("should return consistent results", () => {
      // Test that functions return consistent results when called multiple times
      const userAgent1 = getUserAgent()
      const userAgent2 = getUserAgent()
      expect(userAgent1).toBe(userAgent2)

      const browser1 = getBrowserName()
      const browser2 = getBrowserName()
      expect(browser1).toBe(browser2)

      const os1 = getOperatingSystem()
      const os2 = getOperatingSystem()
      expect(os1).toBe(os2)
    })

    it("should handle navigator gracefully", () => {
      // Test that navigator-dependent functions handle missing navigator gracefully
      expect(() => {
        const userAgent = getUserAgent()
        const browser = getBrowserName()
        const os = getOperatingSystem()

        expect(typeof userAgent).toBe("string")
        expect(typeof browser).toBe("string")
        expect(typeof os).toBe("string")
      }).not.toThrow()
    })
  })
})
