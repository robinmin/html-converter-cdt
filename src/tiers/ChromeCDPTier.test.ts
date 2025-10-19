import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Logger } from "../architecture/strategies/types"

import { ChromeCDPTier } from "./ChromeCDPTier"
import type { ChromeCDPTierConfig } from "./ChromeCDPTier"

// Mock ChromeCDPManager
const mockChromeManager = {
  getMHTMLProcessor: vi.fn(),
  cleanup: vi.fn(),
  getStats: vi.fn().mockReturnValue({
    activeProcesses: 1,
    activeConnections: 1,
    maxInstances: 3,
  }),
}

// Mock MHTMLProcessor
const mockMHTMLProcessor = {
  navigate: vi.fn(),
  setContent: vi.fn(),
  waitForLoad: vi.fn(),
  printToPDF: vi.fn(),
  screenshot: vi.fn(),
  captureSnapshot: vi.fn(),
}

describe("chromeCDPTier", () => {
  let tier: ChromeCDPTier
  let mockLogger: Logger
  let mockHTMLDocument: HTMLDocument

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    mockHTMLDocument = {
      documentElement: {
        outerHTML: "<html><head><title>Test</title></head><body><p>Test content</p></body></html>",
      },
      body: {
        innerHTML: "<p>Test content</p>",
      },
    } as HTMLDocument

    tier = new ChromeCDPTier(mockLogger, mockChromeManager as any)

    // Reset all mocks
    vi.clearAllMocks()
    mockChromeManager.getMHTMLProcessor.mockResolvedValue(mockMHTMLProcessor)
    mockMHTMLProcessor.navigate.mockResolvedValue({ targetId: "test-target-id" })
    mockMHTMLProcessor.setContent.mockResolvedValue(undefined)
    mockMHTMLProcessor.waitForLoad.mockResolvedValue(undefined)
    mockMHTMLProcessor.printToPDF.mockResolvedValue(new Uint8Array([112, 100, 102, 45, 99, 111, 110, 116, 101, 110, 116]))
    mockMHTMLProcessor.screenshot.mockResolvedValue(new Uint8Array([105, 109, 97, 103, 101, 45, 99, 111, 110, 116, 101, 110, 116]))
    mockMHTMLProcessor.captureSnapshot.mockResolvedValue(new Uint8Array([109, 104, 116, 109, 108, 45, 99, 111, 110, 116, 101, 110, 116]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("constructor", () => {
    it("should initialize with default configuration", () => {
      expect(tier.getName()).toBe("Chrome CDP Tier")
      expect(tier.canHandle("text/html")).toBe(true)
      expect(tier.canHandle("application/xhtml+xml")).toBe(true)
      expect(tier.canHandle("text/plain")).toBe(false)
    })

    it("should merge provided configuration with defaults", () => {
      const customConfig: ChromeCDPTierConfig = {
        timeout: 120000,
        pdfOptions: {
          format: "A3",
          landscape: true,
        },
      }

      const customTier = new ChromeCDPTier(mockLogger, mockChromeManager as any, customConfig)
      expect(customTier.getName()).toBe("Chrome CDP Tier")
    })
  })

  describe("validate", () => {
    it("should validate a valid HTML document", () => {
      const result = tier.validate(mockHTMLDocument)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.context?.contentType).toBe("text/html")
      expect(result.context?.size).toBeGreaterThan(0)
    })

    it("should detect empty document", () => {
      const emptyDoc = {
        documentElement: { outerHTML: "" },
        body: { innerHTML: "" },
      } as HTMLDocument

      const result = tier.validate(emptyDoc)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("HTML document is empty")
    })

    it("should warn about missing HTML structure", () => {
      const invalidDoc = {
        documentElement: { outerHTML: "<p>Just a paragraph</p>" },
        body: { innerHTML: "<p>Just a paragraph</p>" },
      } as HTMLDocument

      const result = tier.validate(invalidDoc)

      expect(result.warnings).toContain("HTML document may be missing proper HTML structure")
    })

    it("should warn about JavaScript content in non-headless mode", () => {
      const scriptDoc = {
        documentElement: {
          outerHTML: "<html><head></head><body><script>alert('test');</script></body></html>",
        },
        body: { innerHTML: "<script>alert('test');</script>" },
      } as HTMLDocument

      const config: ChromeCDPTierConfig = {
        chromeOptions: { headless: false },
      }
      const scriptTier = new ChromeCDPTier(mockLogger, mockChromeManager as any, config)

      const result = scriptTier.validate(scriptDoc)

      expect(result.warnings).toContain("JavaScript detected - ensure Chrome runs in headless mode for security")
    })

    it.skip("should warn about high external resource count", () => {
      const resourceHeavyDoc = {
        documentElement: {
          outerHTML: "<html><head>" + Array.from({ length: 60 }).fill("<link rel=\"stylesheet\" href=\"http://example.com/style.css\">").join("") + "</head><body></body></html>",
        },
        body: { innerHTML: "" },
      } as HTMLDocument

      const result = tier.validate(resourceHeavyDoc)

      expect(result.warnings).toContain(expect.stringContaining("High number of external resources"))
    })
  })

  describe("convert", () => {
    beforeEach(() => {
      mockMHTMLProcessor.navigate.mockResolvedValue({ targetId: "test-target-id" })
      mockMHTMLProcessor.waitForLoad.mockResolvedValue(undefined)
      mockMHTMLProcessor.printToPDF.mockResolvedValue(new Uint8Array([112, 100, 102, 45, 99, 111, 110, 116, 101, 110, 116]))
      mockMHTMLProcessor.screenshot.mockResolvedValue(new Uint8Array([105, 109, 97, 103, 101, 45, 99, 111, 110, 116, 101, 110, 116]))
      mockMHTMLProcessor.captureSnapshot.mockResolvedValue(new Uint8Array([109, 104, 116, 109, 108, 45, 99, 111, 110, 116, 101, 110, 116]))
    })

    it("should convert HTML to PDF successfully", async () => {
      const result = await tier.convert(mockHTMLDocument)

      expect(mockChromeManager.getMHTMLProcessor).toHaveBeenCalled()
      expect(mockMHTMLProcessor.navigate).toHaveBeenCalledWith("about:blank")
      expect(mockMHTMLProcessor.setContent).toHaveBeenCalled()
      expect(mockMHTMLProcessor.waitForLoad).toHaveBeenCalled()
      expect(mockMHTMLProcessor.printToPDF).toHaveBeenCalled()

      expect(result.content).toBe("cGRmLWNvbnRlbnQ=") // base64 of "pdf-content"
      expect(result.mimeType).toBe("application/pdf")
      expect(result.metadata.targetFormat).toBe("pdf")
      expect(result.metadata.tier).toBe(1)
      expect(result.metadata.conversionMethod).toBe("chrome-cdp")
      expect(result.metadata.targetId).toBe("test-target-id")
    })

    it("should convert HTML to PNG successfully", async () => {
      // Disable pre-conversion screenshot and dimensions for this test
      const customTier = new ChromeCDPTier(mockLogger, mockChromeManager as any, {
        captureScreenshot: false,
        imageOptions: {
          format: "png",
          quality: 0.9,
          fullPage: true,
          // No dimensions to avoid clip
        },
      })
      customTier.convert = customTier.convert.bind(customTier)
      mockChromeManager.getMHTMLProcessor.mockResolvedValue(mockMHTMLProcessor)

      const pngDoc = {
        documentElement: {
          outerHTML: "<html><head><title>Test</title></head><body data-export=\"image\"><p>Test content</p></body></html>",
        },
        body: { innerHTML: "<p data-export=\"image\">Test content</p>" },
      } as HTMLDocument

      const result = await customTier.convert(pngDoc)

      expect(mockMHTMLProcessor.screenshot).toHaveBeenCalledWith({
        format: "png",
        fullPage: true,
        quality: undefined,
      })

      expect(result.content).toBe("aW1hZ2UtY29udGVudA==") // base64 of "image-content"
      expect(result.mimeType).toBe("image/png")
      expect(result.metadata.targetFormat).toBe("png")
    })

    it("should convert HTML to MHTML successfully", async () => {
      const mhtmlDoc = {
        documentElement: {
          outerHTML: "<html><head><title>Test</title></head><body data-export=\"mhtml\"><p>Test content</p></body></html>",
        },
        body: { innerHTML: "<p data-export=\"mhtml\">Test content</p>" },
      } as HTMLDocument

      const result = await tier.convert(mhtmlDoc)

      expect(mockMHTMLProcessor.captureSnapshot).toHaveBeenCalledWith({
        format: "mhtml",
      })

      expect(result.content).toBe("bWh0bWwtY29udGVudA==") // base64 of "mhtml-content"
      expect(result.mimeType).toBe("multipart/related")
      expect(result.metadata.targetFormat).toBe("mhtml")
    })

    it("should capture pre-conversion screenshot when enabled", async () => {
      const config: ChromeCDPTierConfig = { captureScreenshot: true }
      const screenshotTier = new ChromeCDPTier(mockLogger, mockChromeManager as any, config)

      const result = await screenshotTier.convert(mockHTMLDocument)

      expect(mockMHTMLProcessor.screenshot).toHaveBeenCalledWith({
        format: "png",
        fullPage: false,
        quality: 80,
      })

      expect(result.metadata.preConversionScreenshot).toBe("aW1hZ2UtY29udGVudA==")
    })

    it("should handle file size limits", async () => {
      const largeDoc = {
        documentElement: {
          outerHTML: "<html>" + "x".repeat(51 * 1024 * 1024) + "</html>", // 51MB
        },
        body: { innerHTML: "x".repeat(51 * 1024 * 1024) },
      } as HTMLDocument

      await expect(tier.convert(largeDoc)).rejects.toThrow("exceeds maximum file size")
    })

    it("should handle Chrome CDP errors gracefully", async () => {
      mockMHTMLProcessor.printToPDF.mockRejectedValue(new Error("CDP error"))

      await expect(tier.convert(mockHTMLDocument)).rejects.toThrow("Chrome CDP conversion failed: PDF conversion failed: CDP error")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Chrome CDP conversion failed",
        expect.any(Error),
        expect.any(Object),
      )
    })

    it("should respect custom configuration options", async () => {
      const config: ChromeCDPTierConfig = {
        pdfOptions: {
          format: "A3",
          landscape: true,
          margin: { top: 1, right: 1, bottom: 1, left: 1 },
        },
      }
      const customTier = new ChromeCDPTier(mockLogger, mockChromeManager as any, config)

      await customTier.convert(mockHTMLDocument)

      expect(mockMHTMLProcessor.printToPDF).toHaveBeenCalledWith({
        format: "A3",
        printBackground: undefined,
        margin: {
          top: 1,
          right: 1,
          bottom: 1,
          left: 1,
        },
        landscape: true,
        pageRanges: undefined,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
      })
    })
  })

  describe("strategy interface", () => {
    it("should return correct strategy name", () => {
      expect(tier.getName()).toBe("Chrome CDP Tier")
    })

    it("should return supported content types", () => {
      const types = tier.getSupportedContentTypes()
      expect(types).toContain("text/html")
      expect(types).toContain("application/xhtml+xml")
      expect(types).toHaveLength(2)
    })

    it("should return default output format", () => {
      expect(tier.getOutputFormat()).toBe("application/pdf")
    })

    it("should handle supported content types", () => {
      expect(tier.canHandle("text/html")).toBe(true)
      expect(tier.canHandle("application/xhtml+xml")).toBe(true)
      expect(tier.canHandle("text/plain")).toBe(false)
      expect(tier.canHandle("application/json")).toBe(false)
    })
  })

  describe("error handling", () => {
    it("should handle serialization errors", async () => {
      const invalidDoc = {
        documentElement: null,
        body: null,
      } as HTMLDocument

      await expect(tier.convert(invalidDoc)).rejects.toThrow("Cannot serialize HTML document: documentElement is null")
    })

    it("should handle setup failures", async () => {
      mockMHTMLProcessor.navigate.mockRejectedValue(new Error("Navigation failed"))

      await expect(tier.convert(mockHTMLDocument)).rejects.toThrow("Chrome CDP conversion failed")
    })

    it("should handle content setting failures", async () => {
      mockMHTMLProcessor.setContent.mockRejectedValue(new Error("Content setting failed"))

      await expect(tier.convert(mockHTMLDocument)).rejects.toThrow("Chrome CDP conversion failed")
    })
  })

  describe("performance optimization", () => {
    it("should estimate conversion time reasonably", () => {
      const result = tier.validate(mockHTMLDocument)
      expect(result.context?.estimatedConversionTime).toBeGreaterThan(1000)
      expect(result.context?.estimatedConversionTime).toBeLessThan(10000)
    })

    it("should include execution time in metadata", async () => {
      const result = await tier.convert(mockHTMLDocument)
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0)
      expect(typeof result.metadata.executionTime).toBe("number")
    })
  })
})
