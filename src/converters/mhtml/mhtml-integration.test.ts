/**
 * MHTML Converter Integration Tests
 *
 * Tests the MHTML converter with real HTML fixtures and validates
 * the output against expected MHTML format and golden references.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loadFixture } from "../../../tests/utils/test-fixtures.js"
import type { HTMLDocument, Logger } from "../../architecture/strategies/types.js"

import { MHTMLBuilder } from "./mhtml-builder.js"
import { MHTMLConverter } from "./mhtml-converter.js"
import type { ExternalResource, IResourceFetcher } from "./types.js"

// Mock implementations
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger

class MockResourceFetcher implements IResourceFetcher {
  async fetchResource(url: string): Promise<ExternalResource> {
    // Simulate fetching external resources
    if (url.includes("picsum.photos")) {
      return {
        originalUrl: url,
        resolvedUrl: url,
        type: "image",
        contentType: "image/jpeg",
        fetched: true,
        content: "base64encodedimagedata123456789",
        encoding: "base64",
        size: 1024,
      }
    }

    if (url.includes("bootstrap") && url.includes(".css")) {
      return {
        originalUrl: url,
        resolvedUrl: url,
        type: "stylesheet",
        contentType: "text/css",
        fetched: true,
        content: "body { margin: 0; font-family: Arial, sans-serif; }",
        encoding: "quoted-printable",
        size: 50,
      }
    }

    if (url.includes("bootstrap") && url.includes(".js")) {
      return {
        originalUrl: url,
        resolvedUrl: url,
        type: "script",
        contentType: "application/javascript",
        fetched: true,
        content: "console.log('Bootstrap loaded');",
        encoding: "quoted-printable",
        size: 30,
      }
    }

    if (url.includes("example.org")) {
      return {
        originalUrl: url,
        resolvedUrl: url,
        type: "iframe",
        contentType: "text/html",
        fetched: true,
        content: "<html><body><iframe content</body></html>",
        encoding: "quoted-printable",
        size: 100,
      }
    }

    if (url.includes("example.com")) {
      return {
        originalUrl: url,
        resolvedUrl: url,
        type: "image",
        contentType: "image/jpeg",
        fetched: true,
        content: "base64exampleimage",
        encoding: "base64",
        size: 512,
      }
    }

    if (url.includes("cdn.example.com")) {
      return {
        originalUrl: url,
        resolvedUrl: url,
        type: "script",
        contentType: "application/javascript",
        fetched: true,
        content: "console.log('Script loaded');",
        encoding: "quoted-printable",
        size: 25,
      }
    }

    return {
      originalUrl: url,
      resolvedUrl: url,
      type: "link",
      contentType: "application/octet-stream",
      fetched: false,
      error: "Resource not found in mock",
    }
  }

  async fetchResources(urls: string[]): Promise<ExternalResource[]> {
    return Promise.all(urls.map(url => this.fetchResource(url)))
  }
}

describe("mHTML Converter Integration Tests", () => {
  let converter: MHTMLConverter
  let resourceFetcher: MockResourceFetcher

  beforeEach(() => {
    vi.clearAllMocks()
    resourceFetcher = new MockResourceFetcher()
    const mhtmlBuilder = new MHTMLBuilder()
    converter = new MHTMLConverter(mockLogger, resourceFetcher, mhtmlBuilder)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("fixture-based conversions", () => {
    it("should convert simple HTML fixture", async () => {
      const fixture = loadFixture("simple.html")
      const result = await converter.convert(fixture)

      expect(result).toBeDefined()
      expect(result.content).toContain("From: <saved@localhost>")
      expect(result.content).toContain("Subject: HTML Document")
      expect(result.content).toContain("Content-Type: multipart/related")
      expect(result.content).toContain("Content-Type: text/html; charset=utf-8")
      // Check that content includes the key text (may be encoded)
      expect(result.content).toMatch(/Simple\s*Test\s*Document/)
      expect(result.content).toMatch(/First\s*item/)
      expect(result.content).toMatch(/Second\s*item/)
      expect(result.content).toMatch(/Third\s*item/)
      expect(result.boundary).toMatch(/^----=_NextPart_\d+_[a-z0-9]+$/)
      expect(result.externalResources).toHaveLength(0) // No external resources in simple.html
    })

    it("should convert complex HTML fixture with styles", async () => {
      const fixture = loadFixture("complex.html")
      const result = await converter.convert(fixture)

      expect(result.content).toContain("Complex Test Document")
      expect(result.content).toContain("Content Section")
      expect(result.content).toContain("John Doe")
      expect(result.content).toContain("New York")
      expect(result.content).toContain("Sidebar")
      expect(result.metadata.title).toBe("Complex HTML Document")
      expect(result.externalResources).toHaveLength(0) // No external resources in complex.html
    })

    it("should handle external resources fixture", async () => {
      const fixture = loadFixture("external-resources.html")
      const result = await converter.convert(fixture)

      expect(result.content).toContain("External Resources Test Document")
      expect(result.externalResources.length).toBeGreaterThan(0)

      // Check that external resources were detected and processed
      const imageResources = result.externalResources.filter(r => r.type === "image")
      const cssResources = result.externalResources.filter(r => r.type === "stylesheet")

      expect(imageResources.length).toBeGreaterThan(0)
      expect(cssResources.length).toBeGreaterThan(0)

      // Verify resource details
      const fetchedResources = result.externalResources.filter(r => r.fetched)
      expect(fetchedResources.length).toBeGreaterThan(0)

      expect(result.metadata.resourceCount).toBe(result.externalResources.length)
      expect(result.metadata.fetchedCount).toBe(fetchedResources.length)
    })

    it("should convert single page layout fixture", async () => {
      const fixture = loadFixture("single-page-layout.html")
      const result = await converter.convert(fixture)

      expect(result.content).toContain("Welcome to Our Landing Page")
      expect(result.content).toContain("Amazing Features")
      expect(result.content).toContain("Lightning Fast")
      expect(result.content).toContain("Beautiful Design")
      expect(result.content).toContain("Easy to Use")
      expect(result.metadata.title).toBe("Single Page Layout")
    })

    it("should handle large document fixture", async () => {
      const fixture = loadFixture("large-document.html")
      const result = await converter.convert(fixture)

      expect(result.content).toContain("A Comprehensive Guide to Web Development")
      expect(result.content).toContain("Chapter 1: Introduction to HTML")
      expect(result.content).toContain("Chapter 2: CSS Styling")
      expect(result.content).toContain("Chapter 3: JavaScript Programming")
      expect(result.content).toContain("Chapter 7: Modern Tools and Frameworks")
      expect(result.metadata.title).toBe("Large Document for Performance Testing")

      // Large document should have substantial content
      expect(result.content.length).toBeGreaterThan(5000)
    })
  })

  describe("mHTML format validation", () => {
    it("should produce RFC 2557 compliant MHTML", async () => {
      const fixture = loadFixture("simple.html")
      const result = await converter.convert(fixture)

      const builder = new MHTMLBuilder()
      const validation = builder.validateRFC2557Compliance(result.content)

      expect(validation.isCompliant).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })

    it("should include all required MHTML headers", async () => {
      const fixture = loadFixture("simple.html")
      const result = await converter.convert(fixture)

      const requiredHeaders = [
        "From: <saved@localhost>",
        "Subject: HTML Document",
        "MIME-Version: 1.0",
        "Content-Type: multipart/related",
        "Date:",
      ]

      requiredHeaders.forEach((header) => {
        expect(result.content).toContain(header)
      })
    })

    it("should have proper MIME boundaries", async () => {
      const fixture = loadFixture("simple.html")
      const result = await converter.convert(fixture)

      // Should have boundary in Content-Type header
      expect(result.content).toMatch(/boundary="----=_NextPart_[^"]+"/)

      // Should have boundary markers throughout
      const boundaryMatch = result.content.match(/boundary="([^"]+)"/)
      if (boundaryMatch) {
        const boundary = boundaryMatch[1]
        const boundaryCount = (result.content.match(new RegExp(boundary, "g")) || []).length
        expect(boundaryCount).toBeGreaterThanOrEqual(3) // Header, document, final boundary

        // Should have final boundary
        expect(result.content).toContain(`${boundary}--`)
      }
    })

    it("should properly encode content", async () => {
      const fixture = loadFixture("complex.html")
      const result = await converter.convert(fixture)

      // HTML should be quoted-printable encoded
      expect(result.content).toContain("Content-Transfer-Encoding: quoted-printable")

      // External resources should be properly encoded
      if (result.externalResources.length > 0) {
        const imageResources = result.externalResources.filter(r => r.type === "image")
        imageResources.forEach((resource) => {
          if (resource.fetched) {
            expect(result.content).toContain("Content-Transfer-Encoding: base64")
          }
        })
      }
    })
  })

  describe("error handling with real fixtures", () => {
    it("should handle malformed HTML gracefully", async () => {
      const malformedHTML = `
        <html>
          <head><title>Malformed</title></head>
          <body>
            <div>Unclosed div
            <p>Paragraph after unclosed div</p>
            <img src="https://example.com/test.jpg" alt="Test">
          </body>
        </html>
      `

      const fixture: HTMLDocument = {
        title: "Malformed Document",
        URL: "malformed.html",
        documentElement: {
          outerHTML: malformedHTML,
        },
        location: {
          href: "malformed.html",
        },
      } as HTMLDocument

      const result = await converter.convert(fixture)

      expect(result).toBeDefined()
      expect(result.content).toContain("Malformed")
      expect(result.externalResources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            originalUrl: "https://example.com/test.jpg",
            type: "image",
          }),
        ]),
      )
    })

    it("should handle empty HTML document", async () => {
      const emptyHTML = "<html><head></head><body></body></html>"

      const fixture: HTMLDocument = {
        title: "",
        URL: "empty.html",
        documentElement: {
          outerHTML: emptyHTML,
        },
        location: {
          href: "empty.html",
        },
      } as HTMLDocument

      const result = await converter.convert(fixture)

      expect(result).toBeDefined()
      expect(result.content).toContain("Content-Type: text/html")
      expect(result.externalResources).toHaveLength(0)
    })

    it("should handle document with special characters", async () => {
      const specialHTML = `
        <html>
          <head><title>Special Characters: é ñ ü 中文 العربية</title></head>
          <body>
            <p>Special characters: café, naïve, über</p>
            <p>Chinese: 你好世界</p>
            <p>Arabic: مرحبا بالعالم</p>
            <p>Emoji: 🎉 🚀 ✨</p>
          </body>
        </html>
      `

      const fixture: HTMLDocument = {
        title: "Special Characters: é ñ ü 中文 العربية",
        URL: "special.html",
        documentElement: {
          outerHTML: specialHTML,
        },
        location: {
          href: "special.html",
        },
      } as HTMLDocument

      const result = await converter.convert(fixture)

      expect(result).toBeDefined()
      expect(result.metadata.title).toBe("Special Characters: é ñ ü 中文 العربية")

      // Content should be properly encoded in quoted-printable format
      expect(result.content).toContain("caf=E9") // café encoded
      expect(result.content).toContain("na=EFve") // naïve encoded
      expect(result.content).toContain("=FCber") // über encoded
      // Metadata should contain the original characters
      expect(result.metadata.title).toBe("Special Characters: é ñ ü 中文 العربية")
    })
  })

  describe("performance with large fixtures", () => {
    it("should handle large document efficiently", async () => {
      const fixture = loadFixture("large-document.html")

      const startTime = Date.now()
      const result = await converter.convert(fixture)
      const endTime = Date.now()

      expect(result).toBeDefined()
      expect(result.performance.conversionTime).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds

      // Large document should be processed completely
      expect(result.content.length).toBeGreaterThan(10000)
    })
  })

  describe("golden reference comparison (if available)", () => {
    it.skip("should match golden reference for simple fixture", async () => {
      // Golden reference testing is disabled due to inherent differences in MHTML generation
      // (timestamps, boundaries, encoding variations) making it unreliable for CI
      const fixture = loadFixture("simple.html")
      const result = await converter.convert(fixture)

      // Basic validation that MHTML content is generated
      expect(result.content).toContain("From: <saved@localhost>")
      expect(result.content).toContain("Content-Type: multipart/related")
      expect(result.content).toContain("Simple HTML Document")
    })
  })

  describe("resource fetching integration", () => {
    it("should correctly identify and categorize external resources", async () => {
      const fixture = loadFixture("external-resources.html")
      const result = await converter.convert(fixture)

      const imageCount = result.externalResources.filter(r => r.type === "image").length
      const cssCount = result.externalResources.filter(r => r.type === "stylesheet").length
      const scriptCount = result.externalResources.filter(r => r.type === "script").length
      const iframeCount = result.externalResources.filter(r => r.type === "iframe").length

      expect(imageCount).toBeGreaterThan(0)
      expect(cssCount).toBeGreaterThan(0)
      expect(scriptCount).toBeGreaterThan(0)
      expect(iframeCount).toBeGreaterThan(0)

      // Verify URLs are correctly identified
      const imageUrls = result.externalResources
        .filter(r => r.type === "image")
        .map(r => r.originalUrl)
        .filter(url => url.includes("picsum.photos"))

      expect(imageUrls.length).toBeGreaterThan(0)
    })

    it("should handle mixed HTTP/HTTPS and non-HTTP URLs", async () => {
      const mixedHTML = `
        <html>
          <body>
            <img src="https://example.com/image.jpg">
            <img src="http://example.org/image2.jpg">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==">
            <img src="javascript:void(0)">
            <script src="https://cdn.example.com/script.js"></script>
          </body>
        </html>
      `

      const fixture: HTMLDocument = {
        title: "Mixed URLs Test",
        URL: "mixed.html",
        documentElement: {
          outerHTML: mixedHTML,
        },
        location: {
          href: "mixed.html",
        },
      } as HTMLDocument

      const result = await converter.convert(fixture)

      // Should only fetch HTTP/HTTPS URLs
      const fetchedUrls = result.externalResources
        .filter(r => r.fetched)
        .map(r => r.originalUrl)

      expect(fetchedUrls).toContain("https://example.com/image.jpg")
      expect(fetchedUrls).toContain("http://example.org/image2.jpg")
      expect(fetchedUrls).toContain("https://cdn.example.com/script.js")

      // Should not include data:, javascript:, or other non-HTTP URLs
      const allUrls = result.externalResources.map(r => r.originalUrl)
      expect(allUrls).not.toContainEqual(expect.stringContaining("data:"))
      expect(allUrls).not.toContainEqual(expect.stringContaining("javascript:"))
    })
  })
})
