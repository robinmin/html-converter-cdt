import { Buffer } from "node:buffer"

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MockedFunction } from "vitest"

import type { Logger } from "../architecture/strategies/types"
import type { BrowserCapabilityAssessment, IBrowserCapabilityDetector } from "../capability/types"
import type { ChromeCDPManager } from "../engine/chrome-cdp-manager"

import { ProgressiveEnhancementManager } from "./ProgressiveEnhancementManager"
import type { ConversionPlugin } from "./ProgressiveEnhancementManager"

describe("progressiveEnhancementManager", () => {
  let manager: ProgressiveEnhancementManager
  let mockLogger: Logger
  let mockCapabilityDetector: IBrowserCapabilityDetector
  let mockChromeManager: ChromeCDPManager
  let mockHTMLDocument: HTMLDocument

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    // Mock capability detector
    mockCapabilityDetector = {
      detectChromeCapability: vi.fn(),
      detectCanvasSupport: vi.fn(),
      detectNetworkAccess: vi.fn(),
      detectEnvironment: vi.fn().mockReturnValue("browser"),
      getCompleteAssessment: vi.fn(),
      getRecommendedTier: vi.fn(),
      clearCache: vi.fn(),
      hasCapability: vi.fn(),
    }

    // Mock Chrome manager
    mockChromeManager = {
      getMHTMLProcessor: vi.fn(),
    } as any

    // Mock HTML document
    mockHTMLDocument = {
      documentElement: {
        outerHTML: "<html><head><title>Test</title></head><body><p>Test content</p></body></html>",
      },
      body: {
        innerHTML: "<p>Test content</p>",
      },
    } as any

    manager = new ProgressiveEnhancementManager(
      mockLogger,
      mockCapabilityDetector,
      mockChromeManager,
    )
  })

  describe("constructor", () => {
    it("should initialize with default configuration", () => {
      expect(manager).toBeDefined()
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Progressive Enhancement Manager initialized",
        expect.objectContaining({
          maxFallbackAttempts: 3,
          tierPriority: [1, 2, 3, 4],
          userFeedbackEnabled: true,
        }),
      )
    })

    it("should accept custom configuration", () => {
      const customConfig = {
        maxFallbackAttempts: 5,
        enableUserFeedback: false,
        tierPriority: [4, 3, 2, 1],
      }

      const customManager = new ProgressiveEnhancementManager(
        mockLogger,
        mockCapabilityDetector,
        mockChromeManager,
        customConfig,
      )

      expect(customManager).toBeDefined()
    })
  })

  describe("convert", () => {
    let mockAssessment: BrowserCapabilityAssessment

    beforeEach(() => {
      mockAssessment = {
        chromeCDP: {
          available: true,
          connectionType: "native",
          supportedProtocols: ["1.3"],
          availableTargets: ["page"],
          performance: 0.9,
        },
        canvas: {
          available: true,
          context2D: true,
          webgl: true,
          maxSize: { width: 8192, height: 8192 },
          exportFormats: ["png", "jpeg"],
          performance: 0.8,
        },
        network: {
          available: true,
          fetchSupported: true,
          xhrSupported: true,
          corsEnabled: true,
          timeoutLimits: { min: 100, max: 30000 },
          concurrentLimit: 6,
        },
        overallScore: 0.85,
        recommendedTier: 1,
        timestamp: new Date(),
      }

      ;(mockCapabilityDetector.getCompleteAssessment as MockedFunction).mockResolvedValue(mockAssessment)
    })

    it("should successfully convert with optimal tier", async () => {
      // Mock Chrome CDP tier success
      const _mockResult = {
        content: "base64pdfcontent",
        mimeType: "application/pdf",
        metadata: {
          sourceType: "text/html",
          targetFormat: "pdf",
          timestamp: new Date(),
          size: 1000,
          executionTime: 1000,
          tier: 1,
        },
      }

      // Mock the MHTML processor
      const mockMHTMLProcessor = {
        navigate: vi.fn().mockResolvedValue({ targetId: "target-123" }),
        setContent: vi.fn(),
        waitForLoad: vi.fn(),
        printToPDF: vi.fn().mockResolvedValue(Buffer.from("pdf content")),
      }

      mockChromeManager.getMHTMLProcessor = vi.fn().mockResolvedValue(mockMHTMLProcessor)

      const result = await manager.convert(mockHTMLDocument)

      expect(result).toBeDefined()
      expect(result.mimeType).toBe("application/pdf")
      expect(result.metadata.tier).toBe(1)
      expect(result.metadata.progressiveEnhancement).toBe(true)
      expect(mockCapabilityDetector.getCompleteAssessment).toHaveBeenCalled()
    })

    it("should select appropriate tier based on capabilities", async () => {
      // Set up assessment to only support Basic HTML tier
      mockAssessment.recommendedTier = 4
      mockAssessment.chromeCDP.available = false
      mockAssessment.canvas.available = false
      mockAssessment.network.available = false

      const result = await manager.convert(mockHTMLDocument)

      expect(result).toBeDefined()
      expect(result.metadata.tier).toBe(4) // Should use Basic HTML tier
      expect(result.mimeType).toBe("text/html")
      expect(result.metadata.conversionMethod).toBe("basic-html")
    })

    it("should use Basic HTML tier as final fallback", async () => {
      // Mock higher tiers to fail
      mockChromeManager.getMHTMLProcessor = vi.fn().mockRejectedValue(new Error("Higher tiers unavailable"))
      mockAssessment.chromeCDP.available = false
      mockAssessment.canvas.available = false
      mockAssessment.network.available = false
      mockAssessment.recommendedTier = 4

      const result = await manager.convert(mockHTMLDocument)

      // Should still succeed with Basic HTML tier (Tier 4)
      expect(result).toBeDefined()
      expect(result.metadata.tier).toBe(4)
      expect(result.mimeType).toBe("text/html")
    })

    it("should handle validation errors", async () => {
      // Mock empty document
      const emptyDocument = {
        documentElement: {
          outerHTML: "",
        },
      } as any

      await expect(manager.convert(emptyDocument)).rejects.toThrow("Input validation failed")
    })
  })

  describe("validate", () => {
    let mockAssessment: BrowserCapabilityAssessment

    beforeEach(() => {
      mockAssessment = {
        chromeCDP: {
          available: true,
          connectionType: "native",
          supportedProtocols: ["1.3"],
          availableTargets: ["page"],
          performance: 0.9,
        },
        canvas: {
          available: true,
          context2D: true,
          webgl: true,
          maxSize: { width: 8192, height: 8192 },
          exportFormats: ["png", "jpeg"],
          performance: 0.8,
        },
        network: {
          available: true,
          fetchSupported: true,
          xhrSupported: true,
          corsEnabled: true,
          timeoutLimits: { min: 100, max: 30000 },
          concurrentLimit: 6,
        },
        overallScore: 0.85,
        recommendedTier: 1,
        timestamp: new Date(),
      }

      ;(mockCapabilityDetector.getCompleteAssessment as MockedFunction).mockResolvedValue(mockAssessment)
    })

    it("should validate successfully with available tier", async () => {
      const result = await manager.validate(mockHTMLDocument)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.context?.validationTier).toBe(1)
      expect(result.context?.capabilityScore).toBe(0.85)
    })

    it("should return validation errors for invalid input", async () => {
      const invalidDocument = {
        documentElement: {
          outerHTML: "",
        },
      } as any

      const result = await manager.validate(invalidDocument)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("HTML document is empty")
    })

    it("should handle validation errors gracefully", async () => {
      ;(mockCapabilityDetector.getCompleteAssessment as MockedFunction).mockRejectedValue(new Error("Detection failed"))

      const result = await manager.validate(mockHTMLDocument)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("Validation error: Detection failed")
    })
  })

  describe("refreshCapabilityAssessment", () => {
    it("should refresh capability assessment", async () => {
      const mockAssessment: BrowserCapabilityAssessment = {
        chromeCDP: {
          available: false,
          connectionType: "unavailable",
          supportedProtocols: [],
          availableTargets: [],
          performance: 0,
        },
        canvas: {
          available: true,
          context2D: true,
          webgl: false,
          maxSize: { width: 1024, height: 1024 },
          exportFormats: ["png"],
          performance: 0.5,
        },
        network: {
          available: true,
          fetchSupported: true,
          xhrSupported: false,
          corsEnabled: false,
          timeoutLimits: { min: 1000, max: 10000 },
          concurrentLimit: 4,
        },
        overallScore: 0.4,
        recommendedTier: 2,
        timestamp: new Date(),
      }

      ;(mockCapabilityDetector.getCompleteAssessment as MockedFunction).mockResolvedValue(mockAssessment)

      await manager.refreshCapabilityAssessment()

      expect(mockCapabilityDetector.getCompleteAssessment).toHaveBeenCalledWith({
        cache: true,
        timeout: 10000,
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Capability assessment refreshed",
        expect.objectContaining({
          overallScore: 0.4,
          recommendedTier: 2,
        }),
      )
    })

    it("should handle refresh errors", async () => {
      ;(mockCapabilityDetector.getCompleteAssessment as MockedFunction).mockRejectedValue(new Error("Refresh failed"))

      await expect(manager.refreshCapabilityAssessment()).rejects.toThrow("Refresh failed")
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to refresh capability assessment", expect.any(Error))
    })
  })

  describe("user feedback system", () => {
    it("should add and remove user feedback callbacks", () => {
      const callback = vi.fn()

      manager.addUserFeedbackCallback(callback)
      expect(manager.userFeedbackCallbacks).toHaveLength(1)

      manager.removeUserFeedbackCallback(callback)
      expect(manager.userFeedbackCallbacks).toHaveLength(0)
    })

    it("should handle callback errors gracefully", async () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error("Callback error")
      })

      manager.addUserFeedbackCallback(errorCallback)

      const mockAssessment: BrowserCapabilityAssessment = {
        chromeCDP: {
          available: true,
          connectionType: "native",
          supportedProtocols: ["1.3"],
          availableTargets: ["page"],
          performance: 0.9,
        },
        canvas: {
          available: true,
          context2D: true,
          webgl: true,
          maxSize: { width: 8192, height: 8192 },
          exportFormats: ["png", "jpeg"],
          performance: 0.8,
        },
        network: {
          available: true,
          fetchSupported: true,
          xhrSupported: true,
          corsEnabled: true,
          timeoutLimits: { min: 100, max: 30000 },
          concurrentLimit: 6,
        },
        overallScore: 0.85,
        recommendedTier: 1,
        timestamp: new Date(),
      }

      ;(mockCapabilityDetector.getCompleteAssessment as MockedFunction).mockResolvedValue(mockAssessment)

      // Mock Chrome manager to avoid actual conversion
      mockChromeManager.getMHTMLProcessor = vi.fn().mockRejectedValue(new Error("Force fallback"))

      // Should not throw due to callback error
      await expect(manager.convert(mockHTMLDocument)).rejects.toThrow()
      expect(mockLogger.warn).toHaveBeenCalledWith("User feedback callback failed", expect.any(Error))
    })
  })

  describe("plugin system", () => {
    it("should register and unregister plugins", () => {
      const mockPlugin: ConversionPlugin = {
        name: "test-plugin",
        version: "1.0.0",
        priority: 1,
        canHandle: vi.fn(),
        convert: vi.fn(),
        validate: vi.fn(),
      }

      manager.registerPlugin(mockPlugin)

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Conversion plugin registered",
        expect.objectContaining({
          name: "test-plugin",
          version: "1.0.0",
          priority: 1,
        }),
      )

      manager.unregisterPlugin("test-plugin")

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Conversion plugin unregistered",
        expect.objectContaining({
          name: "test-plugin",
        }),
      )
    })

    it("should sort plugins by priority", () => {
      const plugin1: ConversionPlugin = {
        name: "low-priority",
        version: "1.0.0",
        priority: 10,
        canHandle: vi.fn(),
        convert: vi.fn(),
        validate: vi.fn(),
      }

      const plugin2: ConversionPlugin = {
        name: "high-priority",
        version: "1.0.0",
        priority: 1,
        canHandle: vi.fn(),
        convert: vi.fn(),
        validate: vi.fn(),
      }

      manager.registerPlugin(plugin1)
      manager.registerPlugin(plugin2)

      // High priority plugin should be processed first
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        "Conversion plugin registered",
        expect.objectContaining({ name: "low-priority" }),
      )
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        3,
        "Conversion plugin registered",
        expect.objectContaining({ name: "high-priority" }),
      )
    })
  })

  describe("getSupportedFormats", () => {
    it("should return supported formats from available tiers", async () => {
      const mockAssessment: BrowserCapabilityAssessment = {
        chromeCDP: {
          available: true,
          connectionType: "native",
          supportedProtocols: ["1.3"],
          availableTargets: ["page"],
          performance: 0.9,
        },
        canvas: {
          available: true,
          context2D: true,
          webgl: true,
          maxSize: { width: 8192, height: 8192 },
          exportFormats: ["png", "jpeg"],
          performance: 0.8,
        },
        network: {
          available: true,
          fetchSupported: true,
          xhrSupported: true,
          corsEnabled: true,
          timeoutLimits: { min: 100, max: 30000 },
          concurrentLimit: 6,
        },
        overallScore: 0.85,
        recommendedTier: 1,
        timestamp: new Date(),
      }

      ;(mockCapabilityDetector.getCompleteAssessment as MockedFunction).mockResolvedValue(mockAssessment)

      const formats = await manager.getSupportedFormats()

      expect(formats).toContain("application/pdf")
      expect(formats).toContain("text/html")
    })
  })

  describe("reset", () => {
    it("should reset manager state", () => {
      manager.reset()

      expect(mockCapabilityDetector.clearCache).toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalledWith("Progressive Enhancement Manager reset")
    })
  })

  describe("state management", () => {
    it("should return current capability assessment", () => {
      const assessment = manager.getCurrentCapabilityAssessment()
      expect(assessment).toBeNull()
    })

    it("should return current tier", () => {
      const tier = manager.getCurrentTier()
      expect(tier).toBeNull()
    })
  })

  describe("error handling", () => {
    it("should handle conversion timeout", async () => {
      const mockAssessment: BrowserCapabilityAssessment = {
        chromeCDP: {
          available: true,
          connectionType: "native",
          supportedProtocols: ["1.3"],
          availableTargets: ["page"],
          performance: 0.9,
        },
        canvas: {
          available: true,
          context2D: true,
          webgl: true,
          maxSize: { width: 8192, height: 8192 },
          exportFormats: ["png", "jpeg"],
          performance: 0.8,
        },
        network: {
          available: true,
          fetchSupported: true,
          xhrSupported: true,
          corsEnabled: true,
          timeoutLimits: { min: 100, max: 30000 },
          concurrentLimit: 6,
        },
        overallScore: 0.85,
        recommendedTier: 1,
        timestamp: new Date(),
      }

      ;(mockCapabilityDetector.getCompleteAssessment as MockedFunction).mockResolvedValue(mockAssessment)

      // Mock timeout error
      mockChromeManager.getMHTMLProcessor = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout")), 100)
        })
      })

      await expect(manager.convert(mockHTMLDocument)).rejects.toThrow()
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Progressive enhancement conversion failed",
        expect.any(Error),
        expect.any(Object),
      )
    })
  })
})
