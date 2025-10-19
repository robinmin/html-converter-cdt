/**
 * MHTML Converter Unit Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MHTMLConverter } from "./mhtml-converter.js"
import type { ExternalResource } from "./types.js"

// Polyfill XMLSerializer for test environment
if (typeof globalThis.XMLSerializer === "undefined") {
  globalThis.XMLSerializer = class {
    serializeToString(node: any): string {
      if (node && typeof node === "object") {
        return node.outerHTML || node.textContent || ""
      }
      return String(node || "")
    }
  } as any
}

// Mock implementations
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as any

const mockResourceFetcher = {
  fetchResource: vi.fn(),
  fetchResources: vi.fn(),
} as any

const mockMHTMLBuilder = {
  build: vi.fn((htmlContent: string, externalResources: any[], boundary: string) => {
    return `MHTML content with boundary: ${boundary}`
  }),
  generateBoundary: vi.fn(() => "----=_Boundary_123456"),
  encodeContent: vi.fn(),
} as any

const mockCDPCapture = {
  capturePageAsMHTML: vi.fn(),
  getPageInfo: vi.fn(),
} as any

const mockCDPManager = {
  getMHTMLProcessor: vi.fn(),
  cleanup: vi.fn(),
} as any

// Helper function to create a mock HTML document
const createMockHTMLDocument = (overrides: Partial<any> = {}): any => ({
  title: "Test Document",
  URL: "https://example.com",
  documentElement: {
    outerHTML: "<html><head><title>Test Document</title></head><body>Test content</body></html>",
    children: [
      {
        tagName: "HEAD",
        outerHTML: "<head><title>Test Document</title></head>",
        children: [
          {
            tagName: "TITLE",
            textContent: "Test Document",
            outerHTML: "<title>Test Document</title>",
          },
        ],
      },
      {
        tagName: "BODY",
        outerHTML: "<body>Test content</body>",
        children: [],
      },
    ],
  },
  location: {
    href: "https://example.com",
  },
  ...overrides,
})

describe("mHTMLConverter", () => {
  let converter: MHTMLConverter

  beforeEach(() => {
    vi.clearAllMocks()
    converter = new MHTMLConverter(
      mockLogger,
      mockResourceFetcher,
      mockMHTMLBuilder,
      mockCDPCapture,
      mockCDPManager,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("constructor", () => {
    it("should initialize with all dependencies", () => {
      expect(mockLogger.info).toHaveBeenCalledWith("MHTML Converter initialized", {
        hasCDPSupport: true,
        hasResourceFetcher: true,
        hasMHTMLBuilder: true,
        hasCDPManager: true,
      })
    })

    it("should work without optional dependencies", () => {
      const minimalConverter = new MHTMLConverter(mockLogger, mockResourceFetcher, mockMHTMLBuilder)
      expect(minimalConverter).toBeDefined()
    })
  })

  describe("canHandle", () => {
    it("should handle HTML content types", () => {
      expect(converter.canHandle("text/html")).toBe(true)
      expect(converter.canHandle("TEXT/HTML")).toBe(true) // case insensitive
      expect(converter.canHandle("application/xhtml+xml")).toBe(true)
      expect(converter.canHandle("APPLICATION/XHTML+XML")).toBe(true)
    })

    it("should not handle other content types", () => {
      expect(converter.canHandle("text/plain")).toBe(false)
      expect(converter.canHandle("application/json")).toBe(false)
      expect(converter.canHandle("image/jpeg")).toBe(false)
    })
  })

  describe("getName", () => {
    it("should return the correct converter name", () => {
      expect(converter.getName()).toBe("mhtml")
    })
  })

  describe("getSupportedContentTypes", () => {
    it("should return supported content types", () => {
      const types = converter.getSupportedContentTypes()
      expect(types).toContain("text/html")
      expect(types).toContain("application/xhtml+xml")
      expect(types).toHaveLength(2)
    })
  })

  describe("getOutputFormat", () => {
    it("should return MHTML MIME type", () => {
      expect(converter.getOutputFormat()).toBe("multipart/related")
    })
  })

  describe("convert", () => {
    const mockDocument = createMockHTMLDocument()
    const mockExternalResources: ExternalResource[] = [
      {
        originalUrl: "https://example.com/image.jpg",
        resolvedUrl: "https://example.com/image.jpg",
        type: "image",
        contentType: "image/jpeg",
        fetched: true,
        content: "base64encodedimage",
        encoding: "base64",
        size: 1024,
      },
    ]

    beforeEach(() => {
      // Setup default mocks
      mockResourceFetcher.fetchResources.mockResolvedValue(mockExternalResources)
    })

    it("should successfully convert HTML document to MHTML", async () => {
      const result = await converter.convert(mockDocument)

      expect(result).toBeDefined()
      expect(result.content).toBe("MHTML content with boundary: ----=_Boundary_123456")
      expect(result.mimeType).toBe("multipart/related")
      expect(result.format).toBe("mhtml")
      expect(result.externalResources).toEqual([]) // No external resources in mock document
      expect(result.boundary).toBe("----=_Boundary_123456")
      expect(mockLogger.info).toHaveBeenCalledWith("MHTML conversion completed", expect.any(Object))
    })

    it("should validate input and throw error for invalid document", async () => {
      const invalidDocument = {} as HTMLDocument

      // Mock the validate method to return validation error
      const validateSpy = vi.spyOn(converter as any, "validate").mockReturnValue({
        isValid: false,
        errors: ["Document is missing required properties"],
        warnings: [],
      })

      await expect(converter.convert(invalidDocument)).rejects.toThrow(
        "Input validation failed: Document is missing required properties",
      )

      validateSpy.mockRestore()
    })

    it("should log validation warnings when present", async () => {
      const validateSpy = vi.spyOn(converter as any, "validate").mockReturnValue({
        isValid: true,
        errors: [],
        warnings: ["Document has no title", "External resources found"],
      })

      await converter.convert(mockDocument)

      expect(mockLogger.warn).toHaveBeenCalledWith("Input validation warnings", [
        "Document has no title",
        "External resources found",
      ])

      validateSpy.mockRestore()
    })

    it("should handle conversion with CDP when URL is provided", async () => {
      const mockMHTMLProcessor = {
        capturePageAsMHTML: vi.fn().mockResolvedValue("CDP MHTML content"),
        getPageInfo: vi.fn().mockResolvedValue({
          title: "CDP Test Document",
          url: "https://example.com",
          resources: ["https://example.com/image.jpg"],
        }),
      }

      mockCDPManager.getMHTMLProcessor.mockResolvedValue(mockMHTMLProcessor)

      const _result = await converter.convert(mockDocument)

      expect(mockCDPManager.getMHTMLProcessor).toHaveBeenCalled()
      expect(mockMHTMLProcessor.capturePageAsMHTML).toHaveBeenCalledWith("https://example.com", expect.any(Object))
      expect(mockMHTMLProcessor.getPageInfo).toHaveBeenCalledWith("https://example.com")
    })

    it("should fallback to manual conversion when CDP fails", async () => {
      const mockMHTMLProcessor = {
        capturePageAsMHTML: vi.fn().mockRejectedValue(new Error("CDP failed")),
        getPageInfo: vi.fn(),
      }

      mockCDPManager.getMHTMLProcessor.mockResolvedValue(mockMHTMLProcessor)

      const _result = await converter.convert(mockDocument)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "CDP conversion failed, falling back to manual conversion",
        expect.any(Error),
      )
      // No external resources in mock document, so fetchResources should not be called
      expect(mockResourceFetcher.fetchResources).not.toHaveBeenCalled()
      expect(mockMHTMLBuilder.build).toHaveBeenCalled()
    })

    it("should handle conversion without CDP manager", async () => {
      const converterWithoutCDP = new MHTMLConverter(mockLogger, mockResourceFetcher, mockMHTMLBuilder)
      const _result = await converterWithoutCDP.convert(mockDocument)

      expect(_result).toBeDefined()
      // No external resources in mock document, so fetchResources should not be called
      expect(mockResourceFetcher.fetchResources).not.toHaveBeenCalled()
      expect(mockMHTMLBuilder.build).toHaveBeenCalled()
    })

    it("should detect external resources in HTML content", async () => {
      const converterWithoutCDP = new MHTMLConverter(mockLogger, mockResourceFetcher, mockMHTMLBuilder)
      const documentWithResources = createMockHTMLDocument({
        URL: undefined, // Force manual conversion by removing URL
        location: { href: undefined },
        documentElement: {
          outerHTML: `<html><head><link rel="stylesheet" href="https://example.com/style.css"><script src="https://example.com/script.js"></script></head><body><img src="https://example.com/image.jpg"><iframe src="https://example.com/frame.html"></iframe></body></html>`,
          children: [
            {
              tagName: "HEAD",
              outerHTML: `<head><link rel="stylesheet" href="https://example.com/style.css"><script src="https://example.com/script.js"></script></head>`,
              children: [],
            },
            {
              tagName: "BODY",
              outerHTML: `<body><img src="https://example.com/image.jpg"><iframe src="https://example.com/frame.html"></iframe></body>`,
              children: [],
            },
          ],
        },
      })

      const _result = await converterWithoutCDP.convert(documentWithResources)

      expect(mockResourceFetcher.fetchResources).toHaveBeenCalledWith(
        expect.arrayContaining([
          "https://example.com/style.css",
          "https://example.com/script.js",
          "https://example.com/image.jpg",
          "https://example.com/frame.html",
        ]),
      )
    })

    it("should handle failed resource fetching gracefully", async () => {
      const documentWithResource = createMockHTMLDocument({
        documentElement: {
          outerHTML: "<html><head></head><body><img src=\"https://example.com/not-found.jpg\"></body></html>",
          children: [
            {
              tagName: "HEAD",
              outerHTML: "<head></head>",
              children: [],
            },
            {
              tagName: "BODY",
              outerHTML: "<body><img src=\"https://example.com/not-found.jpg\"></body>",
              children: [],
            },
          ],
        },
      })

      const failedResources: ExternalResource[] = [
        {
          originalUrl: "https://example.com/not-found.jpg",
          resolvedUrl: "https://example.com/not-found.jpg",
          type: "image",
          contentType: "image/jpeg",
          fetched: false,
          error: "404 Not Found",
        },
      ]

      mockResourceFetcher.fetchResources.mockResolvedValue(failedResources)

      const result = await converter.convert(documentWithResource)

      expect(result.externalResources).toEqual(failedResources)
      expect(mockLogger.warn).toHaveBeenCalledWith("Some resources failed to fetch", [
        "https://example.com/not-found.jpg: 404 Not Found",
      ])
    })

    it("should handle resource fetching errors", async () => {
      const documentWithResource = createMockHTMLDocument({
        documentElement: {
          outerHTML: "<html><head></head><body><img src=\"https://example.com/image.jpg\"></body></html>",
          children: [
            {
              tagName: "HEAD",
              outerHTML: "<head></head>",
              children: [],
            },
            {
              tagName: "BODY",
              outerHTML: "<body><img src=\"https://example.com/image.jpg\"></body>",
              children: [],
            },
          ],
        },
      })

      mockResourceFetcher.fetchResources.mockRejectedValue(new Error("Network error"))

      const result = await converter.convert(documentWithResource)

      expect(result.externalResources).toEqual([])
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to fetch external resources",
        expect.any(Error),
      )
    })

    it("should create correct metadata", async () => {
      const result = await converter.convert(mockDocument)

      expect(result.metadata.title).toBe("Test Document")
      expect(result.metadata.url).toBe("https://example.com")
      expect(result.metadata.resourceCount).toBe(0) // No external resources
      expect(result.metadata.fetchedCount).toBe(0)
      expect(result.metadata.totalSize).toBe(0)
      expect(result.metadata.captureDate).toBeInstanceOf(Date)
    })
  })

  describe("dependency injection methods", () => {
    it("should set CDP capture instance", () => {
      converter.setCDPCapture(mockCDPCapture)
      expect(mockLogger.info).toHaveBeenCalledWith("CDP capture instance set")
    })

    it("should set resource fetcher instance", () => {
      converter.setResourceFetcher(mockResourceFetcher)
      expect(mockLogger.info).toHaveBeenCalledWith("Resource fetcher instance set")
    })

    it("should set MHTML builder instance", () => {
      converter.setMHTMLBuilder(mockMHTMLBuilder)
      expect(mockLogger.info).toHaveBeenCalledWith("MHTML builder instance set")
    })

    it("should set CDP manager instance", () => {
      converter.setCDPManager(mockCDPManager)
      expect(mockLogger.info).toHaveBeenCalledWith("Chrome CDP manager instance set")
    })
  })

  describe("cleanup", () => {
    it("should cleanup resources", async () => {
      await converter.cleanup()
      expect(mockCDPManager.cleanup).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith("MHTML converter cleanup completed")
    })

    it("should handle cleanup without CDP manager", async () => {
      const converterWithoutCDP = new MHTMLConverter(mockLogger, mockResourceFetcher, mockMHTMLBuilder)
      await expect(converterWithoutCDP.cleanup()).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith("MHTML converter cleanup completed")
    })
  })

  describe("private methods", () => {
    it("should serialize HTML document correctly", async () => {
      const converterWithoutCDP = new MHTMLConverter(mockLogger, mockResourceFetcher, mockMHTMLBuilder)
      const document = createMockHTMLDocument()
      const _result = await converterWithoutCDP.convert(document)

      expect(mockMHTMLBuilder.build).toHaveBeenCalledWith(
        expect.stringContaining("<html>"),
        expect.any(Array),
        expect.any(String),
      )
    })

    it("should handle XMLSerializer fallback", async () => {
      const converterWithoutCDP = new MHTMLConverter(mockLogger, mockResourceFetcher, mockMHTMLBuilder)
      // Mock XMLSerializer as undefined to test fallback
      const originalXMLSerializer = globalThis.XMLSerializer
      globalThis.XMLSerializer = undefined as any

      const document = createMockHTMLDocument({
        documentElement: {
          outerHTML: "<html><head></head><body>Test</body></html>",
          children: [
            {
              tagName: "HEAD",
              outerHTML: "<head></head>",
              children: [],
            },
            {
              tagName: "BODY",
              outerHTML: "<body>Test</body>",
              children: [],
            },
          ],
        },
      })

      const result = await converterWithoutCDP.convert(document)

      // Restore XMLSerializer
      globalThis.XMLSerializer = originalXMLSerializer

      expect(result).toBeDefined()
      expect(mockMHTMLBuilder.build).toHaveBeenCalled()
    })

    it("should filter out non-HTTP URLs from external resources", async () => {
      const converterWithoutCDP = new MHTMLConverter(mockLogger, mockResourceFetcher, mockMHTMLBuilder)
      const documentWithMixedURLs = createMockHTMLDocument({
        documentElement: {
          outerHTML: `
            <html>
              <body>
                <img src="https://example.com/valid.jpg">
                <img src="http://example.org/valid.jpg">
                <img src="data:image/png;base64,abc123">
                <img src="javascript:void(0)">
                <img src="ftp://example.com/file.jpg">
              </body>
            </html>
          `,
          children: [
            {
              tagName: "HEAD",
              outerHTML: "<head></head>",
              children: [],
            },
            {
              tagName: "BODY",
              outerHTML: `<body>
                <img src="https://example.com/valid.jpg">
                <img src="http://example.org/valid.jpg">
                <img src="data:image/png;base64,abc123">
                <img src="javascript:void(0)">
                <img src="ftp://example.com/file.jpg">
              </body>`,
              children: [],
            },
          ],
        },
      })

      await converterWithoutCDP.convert(documentWithMixedURLs)

      expect(mockResourceFetcher.fetchResources).toHaveBeenCalledWith(
        expect.arrayContaining([
          "https://example.com/valid.jpg",
          "http://example.org/valid.jpg",
        ]),
      )

      // Should not include data:, javascript:, or ftp URLs
      const fetchCall = mockResourceFetcher.fetchResources.mock.calls[0][0] as string[]
      expect(fetchCall).not.toContainEqual(expect.stringContaining("data:"))
      expect(fetchCall).not.toContainEqual(expect.stringContaining("javascript:"))
      expect(fetchCall).not.toContainEqual(expect.stringContaining("ftp:"))
    })
  })

  describe("performance measurements", () => {
    it("should measure conversion time", async () => {
      const converterWithoutCDP = new MHTMLConverter(mockLogger, mockResourceFetcher, mockMHTMLBuilder)
      const document = createMockHTMLDocument()

      await converterWithoutCDP.convert(document)

      expect(mockLogger.info).toHaveBeenCalledWith("MHTML conversion completed", expect.objectContaining({
        duration: expect.any(Number),
      }))
    })

    it("should include performance metrics in result", async () => {
      const converterWithoutCDP = new MHTMLConverter(mockLogger, mockResourceFetcher, mockMHTMLBuilder)
      const document = createMockHTMLDocument()
      const result = await converterWithoutCDP.convert(document)

      expect(result.performance).toBeDefined()
      expect(result.performance.conversionTime).toBeGreaterThan(0)
    })
  })

  describe("error handling", () => {
    it("should handle CDP conversion errors properly", async () => {
      const mockMHTMLProcessor = {
        capturePageAsMHTML: vi.fn().mockRejectedValue(new Error("Chrome crashed")),
        getPageInfo: vi.fn(),
      }

      mockCDPManager.getMHTMLProcessor.mockResolvedValue(mockMHTMLProcessor)

      const document = createMockHTMLDocument()
      const result = await converter.convert(document)

      expect(result).toBeDefined()
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it("should handle MHTML builder errors", async () => {
      // Create a new mock builder that always throws for this test
      const rejectingMockBuilder = {
        build: vi.fn().mockImplementation(() => {
          throw new Error("Failed to build MHTML")
        }),
        generateBoundary: vi.fn(() => "----=_Boundary_123456"),
        encodeContent: vi.fn(),
      } as any

      const converterWithoutCDP = new MHTMLConverter(mockLogger, mockResourceFetcher, rejectingMockBuilder)
      // Create a document without URL to ensure manual conversion path
      const document = createMockHTMLDocument({
        URL: undefined,
        location: { href: undefined },
      })

      await expect(converterWithoutCDP.convert(document)).rejects.toThrow("Failed to build MHTML")
    })
  })
})
