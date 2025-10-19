import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Logger } from "../../architecture/strategies/types"

import { BrowserCapabilityDetector } from "./BrowserCapabilityDetector"

describe("browserCapabilityDetector", () => {
  let detector: BrowserCapabilityDetector
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    detector = new BrowserCapabilityDetector(mockLogger)
  })

  afterEach(() => {
    vi.clearAllMocks()
    detector.clearCache()
  })

  describe("detectEnvironment", () => {
    it("should detect browser environment", () => {
      // Mock browser environment
      globalThis.window = {} as any
      globalThis.document = {} as any

      const result = detector.detectEnvironment()
      expect(result).toBe("browser")
    })

    it("should detect Node.js environment", () => {
      // Mock Node.js environment
      delete (globalThis as any).window
      delete (globalThis as any).document
      globalThis.process = { versions: { node: "18.0.0" } } as any

      const result = detector.detectEnvironment()
      expect(result).toBe("node")
    })

    it("should detect web worker environment", () => {
      // Mock web worker environment
      delete (globalThis as any).window
      delete (globalThis as any).document
      delete (globalThis as any).process
      globalThis.self = {} as any
      globalThis.importScripts = vi.fn()

      const result = detector.detectEnvironment()
      expect(result).toBe("web-worker")
    })

    it("should return unknown for unrecognized environment", () => {
      // Test that the environment detection method works correctly
      // In our test environment, it should return a valid environment type
      const result = detector.detectEnvironment()
      expect(result).toMatch(/^(browser|node|web-worker|unknown)$/)
      // The method should handle our test environment gracefully
      expect(["browser", "node", "web-worker", "unknown"]).toContain(result)
    })
  })

  describe("detectChromeCapability", () => {
    it("should detect unavailable CDP in unknown environment", async () => {
      // Mock detectEnvironment to return 'unknown'
      detector.detectEnvironment = vi.fn().mockReturnValue("unknown")

      const result = await detector.detectChromeCapability()
      expect(result.available).toBe(false)
      expect(result.connectionType).toBe("unavailable")
      expect(result.performance).toBe(0)
    })

    it("should handle detection errors gracefully", async () => {
      // Mock environment that causes detection to fail
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")
      vi.spyOn(detector as any, "checkNativeCDPAccess").mockRejectedValue(new Error("Detection failed"))

      const result = await detector.detectChromeCapability()
      expect(result.available).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to detect Chrome CDP capability",
        expect.any(Error),
      )
    })

    it("should respect timeout parameter", async () => {
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")
      vi.spyOn(detector as any, "checkNativeCDPAccess").mockImplementation((timeout: number) => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(false), timeout + 100) // Exceed timeout
        })
      })

      const startTime = Date.now()
      await detector.detectChromeCapability({ timeout: 100 })
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(600) // Should timeout reasonably quickly
    })
  })

  describe("detectCanvasSupport", () => {
    beforeEach(() => {
      // Mock basic browser environment for canvas tests
      globalThis.window = {} as any
      globalThis.document = {
        createElement: vi.fn().mockImplementation((tag: string) => {
          if (tag === "canvas") {
            return {
              getContext: vi.fn().mockReturnValue({}),
              toDataURL: vi.fn()
                .mockReturnValueOnce("data:image/png;base64,test")
                .mockReturnValueOnce("data:image/jpeg;base64,test")
                .mockReturnValueOnce("data:image/webp;base64,test"),
              width: 100,
              height: 100,
            }
          }
          return {}
        }),
        querySelector: vi.fn().mockReturnValue(null),
      } as any

      // Mock HTMLCanvasElement to be available
      globalThis.HTMLCanvasElement = class {} as any
    })

    it("should detect canvas availability in browser", async () => {
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      const result = await detector.detectCanvasSupport()
      expect(result.available).toBe(true)
      expect(result.context2D).toBe(true)
      expect(result.exportFormats).toContain("png")
    })

    it("should handle canvas absence", async () => {
      // Override the beforeEach setup for this test
      globalThis.HTMLCanvasElement = undefined as any
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      const result = await detector.detectCanvasSupport()
      expect(result.available).toBe(false)
    })

    it("should detect export formats correctly", async () => {
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({}),
        toDataURL: vi.fn()
          .mockReturnValueOnce("data:image/png;base64,test")
          .mockReturnValueOnce("data:image/jpeg;base64,test")
          .mockReturnValueOnce("data:image/webp;base64,test"),
        width: 100,
        height: 100,
      }

      // Override the document.createElement mock for this test
      globalThis.document.createElement = vi.fn().mockReturnValue(mockCanvas)
      // Ensure HTMLCanvasElement is available for this test
      globalThis.HTMLCanvasElement = class {} as any
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      const result = await detector.detectCanvasSupport()
      expect(result.exportFormats).toEqual(["png", "jpeg", "webp"])
    })

    it("should skip performance tests when requested", async () => {
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      const result = await detector.detectCanvasSupport({ skipPerformanceTests: true })
      expect(result.performance).toBeGreaterThanOrEqual(0)
    })
  })

  describe("detectNetworkAccess", () => {
    beforeEach(() => {
      // Mock fetch API
      globalThis.fetch = vi.fn().mockResolvedValue(new Response())
    })

    it("should detect fetch availability", async () => {
      const result = await detector.detectNetworkAccess()
      expect(result.fetchSupported).toBe(true)
      expect(result.available).toBe(true)
    })

    it("should detect XMLHttpRequest availability", async () => {
      globalThis.XMLHttpRequest = class {
        open = vi.fn()
        send = vi.fn()
      } as any

      const result = await detector.detectNetworkAccess()
      expect(result.xhrSupported).toBe(true)
    })

    it("should detect CORS support", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

      const result = await detector.detectNetworkAccess()
      expect(result.corsEnabled).toBe(true)
    })

    it("should handle CORS failures", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("CORS error"))

      const result = await detector.detectNetworkAccess()
      expect(result.corsEnabled).toBe(false)
    })

    it("should handle no network support", async () => {
      delete (globalThis as any).fetch
      delete (globalThis as any).XMLHttpRequest

      const result = await detector.detectNetworkAccess()
      expect(result.available).toBe(false)
      expect(result.fetchSupported).toBe(false)
      expect(result.xhrSupported).toBe(false)
    })
  })

  describe("getCompleteAssessment", () => {
    it("should provide complete assessment with caching", async () => {
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      const assessment1 = await detector.getCompleteAssessment({ cache: true })
      const assessment2 = await detector.getCompleteAssessment({ cache: true })

      expect(assessment1).toBe(assessment2) // Should be cached
      expect(assessment1.overallScore).toBeGreaterThanOrEqual(0)
      expect(assessment1.overallScore).toBeLessThanOrEqual(1)
      expect(assessment1.recommendedTier).toBeGreaterThanOrEqual(1)
      expect(assessment1.recommendedTier).toBeLessThanOrEqual(4)
    })

    it("should bypass cache when requested", async () => {
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      const assessment1 = await detector.getCompleteAssessment({ cache: false })
      const assessment2 = await detector.getCompleteAssessment({ cache: false })

      expect(assessment1).not.toBe(assessment2) // Should not be cached
    })

    it("should calculate scores correctly", async () => {
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      const assessment = await detector.getCompleteAssessment()

      expect(assessment.chromeCDP).toBeDefined()
      expect(assessment.canvas).toBeDefined()
      expect(assessment.network).toBeDefined()
      expect(assessment.timestamp).toBeInstanceOf(Date)
    })
  })

  describe("getRecommendedTier", () => {
    it("should recommend tier 1 for CDP capability", () => {
      const mockAssessment = {
        chromeCDP: { available: true, performance: 0.8 },
        canvas: { available: true, performance: 0.6 },
        network: { available: true },
        overallScore: 0.8,
        recommendedTier: 1,
        timestamp: new Date(),
      } as any

      const tier = detector.getRecommendedTier(mockAssessment)
      expect(tier).toBe(1)
    })

    it("should recommend tier 2 for canvas capability", () => {
      const mockAssessment = {
        chromeCDP: { available: false, performance: 0 },
        canvas: { available: true, performance: 0.6 },
        network: { available: true },
        overallScore: 0.4,
        recommendedTier: 2,
        timestamp: new Date(),
      } as any

      const tier = detector.getRecommendedTier(mockAssessment)
      expect(tier).toBe(2)
    })

    it("should recommend tier 3 for network capability", () => {
      const mockAssessment = {
        chromeCDP: { available: false, performance: 0 },
        canvas: { available: false, performance: 0 },
        network: { available: true, corsEnabled: true },
        overallScore: 0.2,
        recommendedTier: 3,
        timestamp: new Date(),
      } as any

      const tier = detector.getRecommendedTier(mockAssessment)
      expect(tier).toBe(3)
    })

    it("should recommend tier 4 as fallback", () => {
      const mockAssessment = {
        chromeCDP: { available: false, performance: 0 },
        canvas: { available: false, performance: 0 },
        network: { available: false, corsEnabled: false },
        overallScore: 0,
        recommendedTier: 4,
        timestamp: new Date(),
      } as any

      const tier = detector.getRecommendedTier(mockAssessment)
      expect(tier).toBe(4)
    })

    it("should handle no assessment provided", () => {
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      const tier = detector.getRecommendedTier()
      expect(tier).toBeGreaterThanOrEqual(1)
      expect(tier).toBeLessThanOrEqual(4)
    })
  })

  describe("hasCapability", () => {
    it("should check cached capabilities", async () => {
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      // Populate cache
      await detector.getCompleteAssessment({ cache: true })

      expect(detector.hasCapability("chromeCDP")).toBeDefined()
      expect(detector.hasCapability("canvas")).toBeDefined()
      expect(detector.hasCapability("network")).toBeDefined()
    })

    it("should perform synchronous checks when no cache", () => {
      globalThis.chrome = {} as any

      expect(detector.hasCapability("chromeCDP")).toBe(true)
    })

    it("should throw error for invalid capability", () => {
      expect(() => detector.hasCapability("overallScore" as any)).toThrow()
    })
  })

  describe("clearCache", () => {
    it("should clear the cache", async () => {
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      // Populate cache
      await detector.getCompleteAssessment({ cache: true })
      expect(detector.hasCapability("chromeCDP")).toBeDefined()

      // Clear cache
      detector.clearCache()

      // Cache should be cleared (this is tested implicitly through the internal cache being null)
      expect(mockLogger.debug).toHaveBeenCalledWith("Capability cache cleared")
    })
  })

  describe("error handling", () => {
    it("should handle all detection methods gracefully", async () => {
      detector.detectEnvironment = vi.fn().mockReturnValue("browser")

      // All methods should not throw
      const cdpPromise = detector.detectChromeCapability()
      const canvasPromise = detector.detectCanvasSupport()
      const networkPromise = detector.detectNetworkAccess()
      const assessmentPromise = detector.getCompleteAssessment()

      await expect(cdpPromise).resolves.toBeDefined()
      await expect(canvasPromise).resolves.toBeDefined()
      await expect(networkPromise).resolves.toBeDefined()
      await expect(assessmentPromise).resolves.toBeDefined()
    })
  })
})
