/**
 * Tests for MHTML Builder with RFC 2557 compliance
 */

import { beforeEach, describe, expect, it } from "vitest"

import { MHTMLBuilder } from "../../../src/converters/mhtml/mhtml-builder.js"
import type { ExternalResource } from "../../../src/converters/mhtml/types.js"

describe("mHTMLBuilder", () => {
  let builder: MHTMLBuilder

  beforeEach(() => {
    builder = new MHTMLBuilder()
  })

  describe("generateBoundary", () => {
    it("should generate unique boundaries", () => {
      const boundary1 = builder.generateBoundary()
      const boundary2 = builder.generateBoundary()

      expect(boundary1).not.toBe(boundary2)
      expect(boundary1).toMatch(/^----=_NextPart_\d+_[a-z0-9]+$/)
    })

    it("should generate boundaries with correct format", () => {
      const boundary = builder.generateBoundary()

      expect(boundary.startsWith("----=_NextPart_")).toBe(true)
      expect(boundary.length).toBeGreaterThan(20)
      expect(boundary).toMatch(/^[\w=-]+$/)
    })
  })

  describe("encodeContent", () => {
    it("should encode text content as quoted-printable", () => {
      const content = "<html><body>Hello World!</body></html>"
      const encoded = builder.encodeContent(content, "text/html")

      expect(encoded).toContain("Hello World!")
      expect(encoded).not.toContain("=") // Should not have encoded printable ASCII
    })

    it("should encode binary content as base64", () => {
      const content = "binary content"
      const encoded = builder.encodeContent(content, "image/png")

      expect(encoded).toMatch(/^[A-Z0-9+/=\r\n]+$/i)
      expect(encoded.length).toBeGreaterThan(content.length)
    })

    it("should handle special characters in quoted-printable", () => {
      const content = "Hello\r\n\tWorld! = Test"
      const encoded = builder.encodeContent(content, "text/plain")

      expect(encoded).toContain("Hello") // Should preserve the text
      expect(encoded).toContain("World!")
      expect(encoded).toContain("=3D") // = encoding
    })

    it("should respect line length limits in quoted-printable", () => {
      const longLine = "a".repeat(100)
      const encoded = builder.encodeContent(longLine, "text/plain")

      const lines = encoded.split("\r\n")
      for (const line of lines) {
        // Lines should be at most 76 characters, except for soft line breaks ending with =
        if (!line.endsWith("=")) {
          expect(line.length).toBeLessThanOrEqual(76)
        }
      }
    })
  })

  describe("build", () => {
    it("should build complete MHTML content", () => {
      const document = "<html><body>Hello World!</body></html>"
      const resources: ExternalResource[] = []
      const boundary = "----=_test_boundary_123"

      const mhtml = builder.build(document, resources, boundary)

      expect(mhtml).toContain("From: <saved@localhost>")
      expect(mhtml).toContain("Subject: HTML Document")
      expect(mhtml).toContain("MIME-Version: 1.0")
      expect(mhtml).toContain(`Content-Type: multipart/related; boundary="${boundary}"`)
      expect(mhtml).toContain(`--${boundary}`)
      expect(mhtml).toContain("Content-Type: text/html; charset=utf-8")
      expect(mhtml).toContain("Content-Transfer-Encoding: quoted-printable")
      expect(mhtml).toContain("Content-Location: index.html")
      expect(mhtml).toContain(`--${boundary}--`)
    })

    it("should include external resources", () => {
      const document = "<html><body><img src=\"test.png\"></body></html>"
      const resources: ExternalResource[] = [
        {
          originalUrl: "test.png",
          resolvedUrl: "https://example.com/test.png",
          type: "image",
          contentType: "image/png",
          fetched: true,
          content: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
          encoding: "base64",
          size: 85,
        },
      ]
      const boundary = "----=_test_boundary_123"

      const mhtml = builder.build(document, resources, boundary)

      expect(mhtml).toContain(resources[0].content)
      expect(mhtml).toContain(`Content-Type: ${resources[0].contentType}`)
      expect(mhtml).toContain(`Content-Location: ${resources[0].originalUrl}`)
      expect(mhtml).toContain(`Content-Length: ${resources[0].size}`)
    })

    it("should skip unfetched resources", () => {
      const document = "<html><body><img src=\"missing.png\"></body></html>"
      const resources: ExternalResource[] = [
        {
          originalUrl: "missing.png",
          resolvedUrl: "https://example.com/missing.png",
          type: "image",
          contentType: "image/png",
          fetched: false,
          error: "Network error",
        },
      ]
      const boundary = "----=_test_boundary_123"

      const mhtml = builder.build(document, resources, boundary)

      expect(mhtml).not.toContain("Content-Location: missing.png")
      expect(mhtml).not.toContain("Content-Type: image/png")
    })

    it("should use correct line endings", () => {
      const document = "<html><body>Test</body></html>"
      const resources: ExternalResource[] = []
      const boundary = "----=_test_boundary_123"

      const mhtml = builder.build(document, resources, boundary)

      // Check for CRLF line endings
      expect(mhtml).toContain("\r\n")
      expect(mhtml.split("\r\n").length).toBeGreaterThan(5)
    })
  })

  describe("validateRFC2557Compliance", () => {
    it("should validate compliant MHTML content", () => {
      const document = "<html><body>Test</body></html>"
      const resources: ExternalResource[] = []
      const boundary = "----=_test_boundary_123"

      const mhtml = builder.build(document, resources, boundary)
      const validation = builder.validateRFC2557Compliance(mhtml)

      expect(validation.isCompliant).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })

    it("should detect missing required headers", () => {
      const invalidContent = "Invalid MHTML content"

      const validation = builder.validateRFC2557Compliance(invalidContent)

      expect(validation.isCompliant).toBe(false)
      expect(validation.issues.length).toBeGreaterThan(4) // At least the required headers
      expect(validation.issues).toContain("Missing required header: From:")
      expect(validation.issues).toContain("Missing required header: Subject:")
    })

    it("should detect invalid MIME boundary format", () => {
      const invalidContent = `
From: <saved@localhost>
Subject: Test
Date: ${new Date().toUTCString()}
MIME-Version: 1.0
Content-Type: multipart/related; boundary="invalid_boundary"

--invalid_boundary
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: quoted-printable
Content-Location: index.html

Test content

--invalid_boundary--
      `.trim()

      const validation = builder.validateRFC2557Compliance(invalidContent)

      expect(validation.isCompliant).toBe(false)
      expect(validation.issues).toContain("MIME boundary should start with '----='")
    })

    it("should detect missing final boundary", () => {
      const invalidContent = `
From: <saved@localhost>
Subject: Test
Date: ${new Date().toUTCString()}
MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_test_123"

----=_test_123
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: quoted-printable
Content-Location: index.html

Test content
      `.trim()

      const validation = builder.validateRFC2557Compliance(invalidContent)

      expect(validation.isCompliant).toBe(false)
      expect(validation.issues).toContain("Missing final boundary marker (boundary--)")
    })

    it("should detect valid quoted-printable encoding", () => {
      const validContent = `From: <saved@localhost>
Subject: Test
Date: ${new Date().toUTCString()}
MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_test_123"

----=_test_123
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: quoted-printable
Content-Location: index.html

Valid quoted-printable content

----=_test_123--`

      const validation = builder.validateRFC2557Compliance(validContent)

      expect(validation.isCompliant).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })
  })

  describe("generateContentLocation", () => {
    it("should handle absolute URLs", () => {
      const result = builder.generateContentLocation("https://example.com/image.png")
      expect(result).toBe("https://example.com/image.png")
    })

    it("should resolve relative URLs against base URL", () => {
      const result = builder.generateContentLocation(
        "images/pic.png",
        "https://example.com/page.html",
      )
      expect(result).toBe("https://example.com/images/pic.png")
    })

    it("should handle root-relative URLs", () => {
      const result = builder.generateContentLocation(
        "/images/pic.png",
        "https://example.com/folder/page.html",
      )
      expect(result).toBe("https://example.com/images/pic.png")
    })

    it("should return original URL for invalid base URLs", () => {
      const result = builder.generateContentLocation(
        "image.png",
        "not-a-valid-url",
      )
      expect(result).toBe("image.png")
    })

    it("should handle URL encoding gracefully", () => {
      const result = builder.generateContentLocation(
        "image with spaces.png",
        "https://example.com/page.html",
      )
      expect(result).toContain("image%20with%20spaces.png")
    })
  })

  describe("edge cases", () => {
    it("should handle empty document", () => {
      const document = ""
      const resources: ExternalResource[] = []
      const boundary = "----=_test_boundary_123"

      const mhtml = builder.build(document, resources, boundary)

      expect(mhtml).toContain("Content-Type: text/html; charset=utf-8")
      expect(mhtml).toContain("Content-Transfer-Encoding: quoted-printable")
    })

    it("should handle document with only whitespace", () => {
      const document = "   \n\t   "
      const resources: ExternalResource[] = []
      const boundary = "----=_test_boundary_123"

      const mhtml = builder.build(document, resources, boundary)

      expect(mhtml).toContain("   \n\t   ")
    })

    it("should handle very long resource URLs", () => {
      const longUrl = "https://example.com/" + "a".repeat(1000) + ".png"
      const document = `<img src="${longUrl}">`
      const resources: ExternalResource[] = [
        {
          originalUrl: longUrl,
          resolvedUrl: longUrl,
          type: "image",
          contentType: "image/png",
          fetched: true,
          content: "fake-content",
          encoding: "base64",
          size: 12,
        },
      ]
      const boundary = "----=_test_boundary_123"

      const mhtml = builder.build(document, resources, boundary)

      expect(mhtml).toContain(longUrl)
      expect(mhtml).toContain(`Content-Location: ${longUrl}`)
    })

    it("should handle Unicode characters in content", () => {
      const document = "<html><body>Hello 世界 🌍</body></html>"
      const resources: ExternalResource[] = []
      const boundary = "----=_test_boundary_123"

      const mhtml = builder.build(document, resources, boundary)

      expect(mhtml).toContain("Hello") // Should preserve ASCII part
      // Unicode characters should be encoded
      expect(mhtml).toContain("=4E16=754C") // 世界 encoded
      expect(mhtml).toContain("=D83C=DF0D") // 🌍 encoded
    })
  })
})
