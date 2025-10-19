/**
 * MHTML Builder - RFC 2557 compliant MHTML format generator
 *
 * Implements MHTML format generation following RFC 2557 specifications:
 * - Proper MIME boundary generation
 * - Content-Type headers with charset and boundary
 * - Content-Location and Content-Transfer-Encoding headers
 * - Base64 encoding for binary content
 * - Quoted-printable encoding for text content
 * - External resource embedding
 */

import type {
  ExternalResource,
  IMHTMLBuilder,
} from "./types.js"

/**
 * MHTML MIME boundary prefix
 */
const BOUNDARY_PREFIX = "----=_NextPart_"

/**
 * Default charset for text content
 */
const DEFAULT_CHARSET = "utf-8"

/**
 * Maximum line length for MIME content (RFC 2045)
 */
const MAX_LINE_LENGTH = 76

/**
 * MHTML Builder implementation
 *
 * Generates RFC 2557 compliant MHTML content from HTML documents
 * and external resources.
 */
export class MHTMLBuilder implements IMHTMLBuilder {
  /**
   * Build MHTML content from document and resources
   *
   * @param document - HTML document content
   * @param resources - External resources to include
   * @param boundary - MIME boundary string
   * @returns Complete MHTML content string
   */
  build(document: string, resources: ExternalResource[], boundary: string): string {
    const lines: string[] = []

    // MHTML header
    lines.push("From: <saved@localhost>")
    lines.push("Subject: HTML Document")
    lines.push(`Date: ${new Date().toUTCString()}`)
    lines.push("MIME-Version: 1.0")
    lines.push(`Content-Type: multipart/related; boundary="${boundary}"`)
    lines.push("") // Empty line after headers

    // Main document part
    lines.push(`--${boundary}`)
    lines.push("Content-Type: text/html; charset=utf-8")
    lines.push("Content-Transfer-Encoding: quoted-printable")
    lines.push("Content-Location: index.html")
    lines.push("")

    // Encode and add the HTML document
    const encodedDocument = this.encodeContent(document, "text/html")
    lines.push(encodedDocument)
    lines.push("")

    // Add external resources
    for (const resource of resources) {
      if (resource.fetched && resource.content) {
        lines.push(`--${boundary}`)
        this.addResourceHeaders(lines, resource)
        lines.push("")
        lines.push(resource.content)
        lines.push("")
      }
    }

    // Final boundary
    lines.push(`--${boundary}--`)

    return lines.join("\r\n")
  }

  /**
   * Generate a unique MIME boundary
   *
   * @returns Unique boundary string
   */
  generateBoundary(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `${BOUNDARY_PREFIX}${timestamp}_${random}`
  }

  /**
   * Encode content for MHTML format
   *
   * @param content - Raw content to encode
   * @param contentType - MIME type of the content
   * @returns Encoded content string
   */
  encodeContent(content: string, contentType: string): string {
    if (this.isBinaryContent(contentType)) {
      return this.base64Encode(content)
    } else {
      return this.quotedPrintableEncode(content)
    }
  }

  /**
   * Add headers for an external resource
   *
   * @param lines - Array to append headers to
   * @param resource - Resource information
   */
  private addResourceHeaders(lines: string[], resource: ExternalResource): void {
    // Content-Type header
    const charset = resource.contentType.startsWith("text/") ? `; charset=${DEFAULT_CHARSET}` : ""
    lines.push(`Content-Type: ${resource.contentType}${charset}`)

    // Content-Transfer-Encoding header
    const encoding = resource.encoding || this.getDefaultEncoding(resource.contentType)
    lines.push(`Content-Transfer-Encoding: ${encoding}`)

    // Content-Location header
    lines.push(`Content-Location: ${resource.originalUrl}`)

    // Content-Length header (optional but helpful)
    if (resource.size !== undefined) {
      lines.push(`Content-Length: ${resource.size}`)
    }
  }

  /**
   * Check if content type requires binary encoding
   *
   * @param contentType - MIME type to check
   * @returns True if content is binary
   */
  private isBinaryContent(contentType: string): boolean {
    const binaryTypes = [
      "image/",
      "video/",
      "audio/",
      "application/",
      "font/",
    ]

    return binaryTypes.some(type => contentType.startsWith(type))
  }

  /**
   * Get default encoding for content type
   *
   * @param contentType - MIME type
   * @returns Default encoding (base64 or quoted-printable)
   */
  private getDefaultEncoding(contentType: string): "base64" | "quoted-printable" {
    return this.isBinaryContent(contentType) ? "base64" : "quoted-printable"
  }

  /**
   * Base64 encode content with proper line wrapping
   *
   * @param content - Content to encode
   * @returns Base64 encoded content with line breaks
   */
  private base64Encode(content: string): string {
    // Convert string to bytes for proper base64 encoding
    const bytes = new TextEncoder().encode(content)

    // Simple base64 implementation (in production, use Buffer or built-in functions)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    let result = ""
    let i = 0

    while (i < bytes.length) {
      const a = bytes[i]!
      const b = bytes[i + 1] || 0
      const c = bytes[i + 2] || 0

      const bitmap = (a << 16) | (b << 8) | c

      result += chars.charAt((bitmap >> 18) & 63)
      result += chars.charAt((bitmap >> 12) & 63)
      result += i + 1 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : "="
      result += i + 2 < bytes.length ? chars.charAt(bitmap & 63) : "="

      i += 3

      // Add line breaks every 76 characters
      if (result.length % 76 === 0 && i < bytes.length) {
        result += "\r\n"
      }
    }

    return result
  }

  /**
   * Quoted-printable encode text content
   *
   * @param content - Text content to encode
   * @returns Quoted-printable encoded content
   */
  private quotedPrintableEncode(content: string): string {
    let result = ""
    let line = ""

    for (let i = 0; i < content.length; i++) {
      const char = content[i]!
      const code = char.charCodeAt(0)

      if (code === 13 && content[i + 1] === 10) {
        // CRLF - line break
        result += line + "\r\n"
        line = ""
        i++ // Skip LF
      } else if (code === 10 || code === 13) {
        // LF or CR alone
        result += line + char
        line = ""
      } else if (
        (code >= 33 && code <= 60) // ! to <
        || (code >= 62 && code <= 126) // > to ~
        || code === 9 // TAB
        || code === 32 // SPACE
      ) {
        // Printable characters
        line += char

        // Check line length
        if (line.length > MAX_LINE_LENGTH - 3) {
          result += line + "=\r\n"
          line = ""
        }
      } else {
        // Non-printable characters - encode as =XX
        const hex = code.toString(16).toUpperCase().padStart(2, "0")
        const encoded = `=${hex}`

        // Check if encoding would exceed line length
        if (line.length + encoded.length > MAX_LINE_LENGTH) {
          result += line + "=\r\n"
          line = encoded
        } else {
          line += encoded
        }
      }
    }

    // Add remaining content
    if (line.length > 0) {
      result += line
    }

    return result
  }

  /**
   * Validate RFC 2557 compliance of generated content
   *
   * @param content - MHTML content to validate
   * @returns Validation result with any issues found
   */
  validateRFC2557Compliance(content: string): {
    isCompliant: boolean
    issues: string[]
  } {
    const issues: string[] = []

    // Check for required headers
    const requiredHeaders = [
      "From:",
      "Subject:",
      "Date:",
      "MIME-Version:",
      "Content-Type: multipart/related",
    ]

    for (const header of requiredHeaders) {
      if (!content.includes(header)) {
        issues.push(`Missing required header: ${header}`)
      }
    }

    // Check MIME boundary format
    const boundaryMatch = content.match(/boundary="([^"]+)"/)
    if (boundaryMatch) {
      const boundary = boundaryMatch[1]
      if (!boundary.startsWith("----=")) {
        issues.push("MIME boundary should start with '----='")
      }
    } else {
      issues.push("Missing MIME boundary in Content-Type header")
    }

    // Check for proper boundary usage
    const boundaryRegex = /boundary="([^"]+)"/
    const match = content.match(boundaryRegex)
    if (match) {
      const boundary = match[1]
      const boundaryCount = (content.match(new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length

      // Should have at least: header, document part, final boundary
      if (boundaryCount < 3) {
        issues.push("Insufficient boundary markers in content")
      }

      // Check for final boundary with --
      if (!content.includes(`${boundary}--`)) {
        issues.push("Missing final boundary marker (boundary--)")
      }
    }

    // Check Content-Transfer-Encoding usage
    if (content.includes("Content-Transfer-Encoding: base64")) {
      // Base64 content should only contain valid base64 characters
      const base64Matches = content.match(/Content-Transfer-Encoding: base64\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$)/g)
      if (base64Matches) {
        for (const match of base64Matches) {
          const base64Content = match.replace(/Content-Transfer-Encoding: base64\r?\n\r?\n/, "")
          const invalidChars = base64Content.replace(/[A-Z0-9+/=\r\n]/gi, "")
          if (invalidChars.length > 0) {
            issues.push("Invalid characters found in base64 encoded content")
          }
        }
      }
    }

    // Check quoted-printable encoding
    if (content.includes("Content-Transfer-Encoding: quoted-printable")) {
      // Handle both \r\n and \n line endings
      const qpMatches = content.match(/Content-Transfer-Encoding: quoted-printable\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$)/g)
      if (qpMatches) {
        for (const match of qpMatches) {
          const qpContent = match.replace(/Content-Transfer-Encoding: quoted-printable\r?\n\r?\n/, "")

          // Check for invalid =XX sequences
          const invalidSequences = qpContent.match(/=[^0-9A-F][^0-9A-F]/gi)
          if (invalidSequences && invalidSequences.length > 0) {
            issues.push("Invalid quoted-printable encoding sequences found")
          }

          // Also check for incomplete =X sequences
          const incompleteSequences = qpContent.match(/=[0-9A-F](?![0-9A-F])/gi)
          if (incompleteSequences && incompleteSequences.length > 0) {
            issues.push("Invalid quoted-printable encoding sequences found")
          }

          // Check line length
          const lines = qpContent.split("\r\n")
          for (const line of lines) {
            if (line.length > MAX_LINE_LENGTH && !line.endsWith("=")) {
              issues.push("Quoted-printable line exceeds maximum length without soft line break")
            }
          }
        }
      }
    }

    return {
      isCompliant: issues.length === 0,
      issues,
    }
  }

  /**
   * Generate content location URL for resources
   *
   * @param originalUrl - Original resource URL
   * @param documentUrl - Base document URL
   * @returns Properly formatted content location
   */
  generateContentLocation(originalUrl: string, documentUrl?: string): string {
    try {
      // If original URL is absolute, use it as-is
      if (originalUrl.startsWith("http://") || originalUrl.startsWith("https://")) {
        return originalUrl
      }

      // For relative URLs, resolve against document URL if provided
      if (documentUrl && (documentUrl.startsWith("http://") || documentUrl.startsWith("https://"))) {
        const baseUrl = new URL(documentUrl)
        return new URL(originalUrl, baseUrl).href
      }

      // Fallback to original URL
      return originalUrl
    } catch {
      // If URL parsing fails, return original
      return originalUrl
    }
  }
}
