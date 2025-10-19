/**
 * Tests for MHTML Converter base structure
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

import { MHTMLConverter } from "../../../src/converters/mhtml/mhtml-converter.js"
import type {
  ExternalResource,
  IMHTMLBuilder,
  IResourceFetcher,
  Logger,
} from "../../../src/converters/mhtml/types.js"

// Mock implementations
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const mockResourceFetcher: IResourceFetcher = {
  fetchResource: vi.fn(),
  fetchResources: vi.fn(),
}

const mockMHTMLBuilder: IMHTMLBuilder = {
  build: vi.fn(),
  generateBoundary: vi.fn(),
  encodeContent: vi.fn(),
}

describe("mHTMLConverter", () => {
  let converter: MHTMLConverter

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock XMLSerializer for Node.js environment
    globalThis.XMLSerializer = class XMLSerializer {
      serializeToString(_node: Node): string {
        return "<html><head></head><body>mock content</body></html>"
      }
    } as any

    converter = new MHTMLConverter(
      mockLogger,
      mockResourceFetcher,
      mockMHTMLBuilder,
    )
  })

  describe("constructor", () => {
    it("should initialize with required dependencies", () => {
      expect(converter).toBeInstanceOf(MHTMLConverter)
      expect(mockLogger.info).toHaveBeenCalledWith("MHTML Converter initialized", {
        hasCDPSupport: false,
        hasResourceFetcher: true,
        hasMHTMLBuilder: true,
      })
    })

    it("should initialize with CDP capture support", () => {
      const mockCDPCapture = { capturePageAsMHTML: vi.fn(), getPageInfo: vi.fn() }
      void new MHTMLConverter(
        mockLogger,
        mockResourceFetcher,
        mockMHTMLBuilder,
        mockCDPCapture,
      )

      expect(mockLogger.info).toHaveBeenCalledWith("MHTML Converter initialized", {
        hasCDPSupport: true,
        hasResourceFetcher: true,
        hasMHTMLBuilder: true,
      })
    })
  })

  describe("strategy interface", () => {
    it("should return correct converter name", () => {
      expect(converter.getName()).toBe("mhtml")
    })

    it("should return supported content types", () => {
      const supportedTypes = converter.getSupportedContentTypes()
      expect(supportedTypes).toContain("text/html")
      expect(supportedTypes).toContain("application/xhtml+xml")
    })

    it("should return correct output format", () => {
      expect(converter.getOutputFormat()).toBe("multipart/related")
    })

    it("should correctly handle supported content types", () => {
      expect(converter.canHandle("text/html")).toBe(true)
      expect(converter.canHandle("TEXT/HTML")).toBe(true) // case insensitive
      expect(converter.canHandle("application/xhtml+xml")).toBe(true)
      expect(converter.canHandle("text/plain")).toBe(false)
      expect(converter.canHandle("application/json")).toBe(false)
    })
  })

  describe("validation", () => {
    it("should validate HTML document input", () => {
      const mockDocument = {
        documentElement: { children: [] },
        title: "Test Document",
      } as unknown as HTMLDocument

      const result = converter.validate(mockDocument)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should reject invalid input", () => {
      const result = converter.validate(null as any)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("Input HTMLDocument is null or undefined")
    })

    it("should warn about empty documents", () => {
      const mockDocument = {
        documentElement: { children: [] },
      } as unknown as HTMLDocument

      const result = converter.validate(mockDocument)
      expect(result.warnings).toContain("HTML document appears to be empty")
    })
  })

  describe("dependency setters", () => {
    it("should allow setting CDP capture instance", () => {
      const mockCDPCapture = { capturePageAsMHTML: vi.fn(), getPageInfo: vi.fn() }
      converter.setCDPCapture(mockCDPCapture)
      expect(mockLogger.info).toHaveBeenCalledWith("CDP capture instance set")
    })

    it("should allow setting resource fetcher instance", () => {
      const newMockResourceFetcher: IResourceFetcher = {
        fetchResource: vi.fn(),
        fetchResources: vi.fn(),
      }
      converter.setResourceFetcher(newMockResourceFetcher)
      expect(mockLogger.info).toHaveBeenCalledWith("Resource fetcher instance set")
    })

    it("should allow setting MHTML builder instance", () => {
      const newMockMHTMLBuilder: IMHTMLBuilder = {
        build: vi.fn(),
        generateBoundary: vi.fn(),
        encodeContent: vi.fn(),
      }
      converter.setMHTMLBuilder(newMockMHTMLBuilder)
      expect(mockLogger.info).toHaveBeenCalledWith("MHTML builder instance set")
    })
  })

  describe("external resource detection", () => {
    it("should detect various types of external resources", async () => {
      const htmlContent = `
        <html>
          <head>
            <link rel="stylesheet" href="https://example.com/style.css">
            <script src="https://example.com/script.js"></script>
          </head>
          <body>
            <img src="https://example.com/image.jpg" alt="test">
            <iframe src="https://example.com/frame.html"></iframe>
          </body>
        </html>
      `

      // Mock the serialize method to return our test content
      vi.spyOn(converter as any, "serializeHTMLDocument").mockReturnValue(htmlContent)

      // Mock resource fetching to return empty results for this test
      mockResourceFetcher.fetchResources.mockResolvedValue([])
      mockMHTMLBuilder.generateBoundary.mockReturnValue("test-boundary")
      mockMHTMLBuilder.build.mockReturnValue("test-mhtml-content")

      const mockDocument = {
        documentElement: { children: [] },
        title: "Test Document",
      } as unknown as HTMLDocument

      await converter.convert(mockDocument)

      // Verify that external resource URLs were detected
      expect(mockResourceFetcher.fetchResources).toHaveBeenCalled()
      const fetchedUrls = mockResourceFetcher.fetchResources.mock.calls[0][0]
      expect(fetchedUrls).toContain("https://example.com/style.css")
      expect(fetchedUrls).toContain("https://example.com/script.js")
      expect(fetchedUrls).toContain("https://example.com/image.jpg")
      expect(fetchedUrls).toContain("https://example.com/frame.html")
    })

    it("should skip non-HTTP URLs", async () => {
      const htmlContent = `
        <html>
          <body>
            <img src="data:image/png;base64,test" alt="data url">
            <img src="javascript:void(0)" alt="js url">
            <img src="https://example.com/valid.jpg" alt="valid url">
          </body>
        </html>
      `

      vi.spyOn(converter as any, "serializeHTMLDocument").mockReturnValue(htmlContent)
      mockResourceFetcher.fetchResources.mockResolvedValue([])
      mockMHTMLBuilder.generateBoundary.mockReturnValue("test-boundary")
      mockMHTMLBuilder.build.mockReturnValue("test-mhtml-content")

      const mockDocument = {
        documentElement: { children: [] },
        title: "Test Document",
      } as unknown as HTMLDocument

      await converter.convert(mockDocument)

      const fetchedUrls = mockResourceFetcher.fetchResources.mock.calls[0][0]
      expect(fetchedUrls).toHaveLength(1)
      expect(fetchedUrls[0]).toBe("https://example.com/valid.jpg")
    })
  })

  describe("conversion workflow", () => {
    it("should perform complete conversion with mocked dependencies", async () => {
      const mockDocument = {
        documentElement: { children: [] },
        title: "Test Document",
        URL: "https://example.com/test",
      } as unknown as HTMLDocument

      const mockResources: ExternalResource[] = [
        {
          originalUrl: "https://example.com/style.css",
          resolvedUrl: "https://example.com/style.css",
          type: "stylesheet",
          contentType: "text/css",
          fetched: true,
          content: "body { color: red; }",
          encoding: "quoted-printable",
          size: 20,
        },
      ]

      // Setup mocks
      mockResourceFetcher.fetchResources.mockResolvedValue(mockResources)
      mockMHTMLBuilder.generateBoundary.mockReturnValue("test-boundary-123")
      mockMHTMLBuilder.build.mockReturnValue("mock-mhtml-content")

      const result = await converter.convert(mockDocument)

      // Verify the conversion result
      expect(result.content).toBe("mock-mhtml-content")
      expect(result.mimeType).toBe("multipart/related")
      expect(result.metadata.sourceType).toBe("text/html")
      expect(result.metadata.targetFormat).toBe("mhtml")
      expect((result as any).externalResources).toEqual(mockResources)
      expect((result as any).boundary).toBe("test-boundary-123")

      // Verify method calls
      expect(mockResourceFetcher.fetchResources).toHaveBeenCalled()
      expect(mockMHTMLBuilder.generateBoundary).toHaveBeenCalled()
      expect(mockMHTMLBuilder.build).toHaveBeenCalled()
    })

    it("should handle conversion errors gracefully", async () => {
      // Mock validation failure
      const invalidDocument = null as any
      await expect(converter.convert(invalidDocument)).rejects.toThrow(
        "Input validation failed: Input HTMLDocument is null or undefined",
      )
    })

    it("should log conversion metrics", async () => {
      const mockDocument = {
        documentElement: { children: [] },
        title: "Test Document",
      } as unknown as HTMLDocument

      mockResourceFetcher.fetchResources.mockResolvedValue([])
      mockMHTMLBuilder.generateBoundary.mockReturnValue("test-boundary")
      mockMHTMLBuilder.build.mockReturnValue("test-mhtml-content")

      await converter.convert(mockDocument)

      // Verify that completion metrics were logged
      expect(mockLogger.info).toHaveBeenCalledWith("MHTML conversion completed", expect.objectContaining({
        duration: expect.any(Number),
        outputSize: expect.any(Number),
        resourceCount: expect.any(Number),
        fetchedCount: expect.any(Number),
      }))
    })
  })

  describe("error handling", () => {
    it("should handle resource fetching errors", async () => {
      const mockDocument = {
        documentElement: { children: [] },
        title: "Test Document",
      } as unknown as HTMLDocument

      // Mock resource fetcher to throw error
      mockResourceFetcher.fetchResources.mockRejectedValue(
        new Error("Network error"),
      )
      mockMHTMLBuilder.generateBoundary.mockReturnValue("test-boundary")
      mockMHTMLBuilder.build.mockReturnValue("test-mhtml-content")

      const result = await converter.convert(mockDocument)

      // Should log error but still complete conversion
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to fetch external resources",
        expect.any(Error),
      )
      expect(result.content).toBe("test-mhtml-content")
    })

    it("should warn about validation warnings", async () => {
      const mockDocument = {
        documentElement: { children: [] }, // Empty document
        title: "Test Document",
      } as unknown as HTMLDocument

      mockResourceFetcher.fetchResources.mockResolvedValue([])
      mockMHTMLBuilder.generateBoundary.mockReturnValue("test-boundary")
      mockMHTMLBuilder.build.mockReturnValue("test-mhtml-content")

      await converter.convert(mockDocument)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Input validation warnings",
        expect.arrayContaining(["HTML document appears to be empty"]),
      )
    })
  })
})
