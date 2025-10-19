/**
 * File Comparison Utilities for Testing
 *
 * Provides utilities for comparing files, validating conversion outputs,
 * and generating golden reference files.
 */

import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/**
 * File comparison result
 */
export interface FileComparisonResult {
  /** Whether the files are identical */
  identical: boolean
  /** Whether the files are functionally equivalent */
  equivalent: boolean
  /** Differences found between files */
  differences: string[]
  /** Similarity percentage (0-100) */
  similarity: number
  /** Size of file A in bytes */
  sizeA: number
  /** Size of file B in bytes */
  sizeB: number
  /** File A checksum */
  checksumA: string
  /** File B checksum */
  checksumB: string
}

/**
 * Binary file comparison options
 */
export interface BinaryComparisonOptions {
  /** Maximum allowed size difference percentage */
  maxSizeDifference?: number
  /** Whether to calculate checksums */
  calculateChecksums?: boolean
  /** Whether to perform byte-by-byte comparison */
  byteByByte?: boolean
}

/**
 * Text file comparison options
 */
export interface TextComparisonOptions {
  /** Whether to ignore whitespace differences */
  ignoreWhitespace?: boolean
  /** Whether to ignore case differences */
  ignoreCase?: boolean
  /** Whether to ignore line ending differences */
  ignoreLineEndings?: boolean
  /** Whether to ignore HTML attribute order */
  ignoreHTMLAttributeOrder?: boolean
  /** Custom normalization function */
  normalize?: (content: string) => string
}

/**
 * MHTML-specific comparison options
 */
export interface MHTMLComparisonOptions extends TextComparisonOptions {
  /** Whether to ignore boundary differences */
  ignoreBoundaries?: boolean
  /** Whether to ignore timestamp differences */
  ignoreTimestamps?: boolean
  /** Whether to ignore Content-ID differences */
  ignoreContentIDs?: boolean
}

/**
 * Golden reference manager
 */
export class GoldenReferenceManager {
  constructor(private readonly goldenDir: string) {}

  /**
   * Get the path to a golden reference file
   */
  getGoldenPath(fixtureName: string, format: string): string {
    return join(this.goldenDir, `${fixtureName}.${format}.golden`)
  }

  /**
   * Check if a golden reference exists
   */
  hasGolden(fixtureName: string, format: string): boolean {
    return existsSync(this.getGoldenPath(fixtureName, format))
  }

  /**
   * Load a golden reference file
   */
  loadGolden(fixtureName: string, format: string): Buffer | null {
    const path = this.getGoldenPath(fixtureName, format)
    if (!existsSync(path)) {
      return null
    }
    return readFileSync(path)
  }

  /**
   * Save a golden reference file
   */
  saveGolden(fixtureName: string, format: string, content: Buffer | string): void {
    const path = this.getGoldenPath(fixtureName, format)
    const buffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content
    writeFileSync(path, buffer)
  }

  /**
   * Compare content against golden reference
   */
  compareAgainstGolden(
    fixtureName: string,
    format: string,
    content: Buffer | string,
    options?: any,
  ): FileComparisonResult {
    const golden = this.loadGolden(fixtureName, format)
    if (!golden) {
      throw new Error(`No golden reference found for ${fixtureName}.${format}`)
    }

    const contentBuffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content

    if (format === "mhtml") {
      return compareMHTMLFiles(golden, contentBuffer, options)
    } else if (isBinaryContent(contentBuffer)) {
      return compareBinaryFiles(golden, contentBuffer, options)
    } else {
      return compareTextFiles(golden.toString("utf-8"), contentBuffer.toString("utf-8"), options)
    }
  }
}

/**
 * Compare two binary files
 */
export function compareBinaryFiles(
  fileA: Buffer,
  fileB: Buffer,
  options: BinaryComparisonOptions = {},
): FileComparisonResult {
  const {
    maxSieDifference = 0,
    calculateChecksums = true,
    byteByByte = true,
  } = options

  const sizeA = fileA.length
  const sizeB = fileB.length
  const sizeDiff = Math.abs(sizeA - sizeB)
  const maxAllowedDiff = Math.max(sizeA, sizeB) * (maxSieDifference / 100)

  const differences: string[] = []

  // Check size difference
  if (sizeDiff > maxAllowedDiff) {
    differences.push(`Size difference: ${sizeDiff} bytes (${((sizeDiff / Math.max(sizeA, sizeB)) * 100).toFixed(2)}%)`)
  }

  // Calculate checksums
  const checksumA = calculateChecksums ? createHash("md5").update(fileA).digest("hex") : ""
  const checksumB = calculateChecksums ? createHash("md5").update(fileB).digest("hex") : ""

  if (calculateChecksums && checksumA !== checksumB) {
    differences.push("Checksum mismatch")
  }

  // Byte-by-byte comparison
  let byteDifferences = 0
  if (byteByByte && sizeA === sizeB) {
    for (let i = 0; i < sizeA; i++) {
      if (fileA[i] !== fileB[i]) {
        byteDifferences++
        if (byteDifferences <= 10) { // Limit number of reported differences
          differences.push(`Byte ${i}: 0x${fileA[i].toString(16).padStart(2, "0")} != 0x${fileB[i].toString(16).padStart(2, "0")}`)
        }
      }
    }
  }

  const identical = sizeA === sizeB && byteDifferences === 0
  const equivalent = byteDifferences === 0 && sizeDiff <= maxAllowedDiff
  const similarity = sizeA === sizeB ? ((sizeA - byteDifferences) / sizeA) * 100 : 0

  return {
    identical,
    equivalent,
    differences,
    similarity,
    sizeA,
    sizeB,
    checksumA,
    checksumB,
  }
}

/**
 * Compare two text files
 */
export function compareTextFiles(
  contentA: string,
  contentB: string,
  options: TextComparisonOptions = {},
): FileComparisonResult {
  const {
    ignoreWhitespace = false,
    ignoreCase = false,
    ignoreLineEndings = true,
    normalize,
  } = options

  let normalizedA = contentA
  let normalizedB = contentB

  // Apply normalization
  if (normalize) {
    normalizedA = normalize(normalizedA)
    normalizedB = normalize(normalizedB)
  } else {
    // Default normalizations
    if (ignoreWhitespace) {
      normalizedA = normalizedA.replace(/\s+/g, " ").trim()
      normalizedB = normalizedB.replace(/\s+/g, " ").trim()
    }

    if (ignoreCase) {
      normalizedA = normalizedA.toLowerCase()
      normalizedB = normalizedB.toLowerCase()
    }

    if (ignoreLineEndings) {
      normalizedA = normalizedA.replace(/\r\n/g, "\n")
      normalizedB = normalizedB.replace(/\r\n/g, "\n")
    }
  }

  const bufferA = Buffer.from(normalizedA, "utf-8")
  const bufferB = Buffer.from(normalizedB, "utf-8")

  const sizeA = bufferA.length
  const sizeB = bufferB.length

  const differences: string[] = []
  const checksumA = createHash("md5").update(bufferA).digest("hex")
  const checksumB = createHash("md5").update(bufferB).digest("hex")

  if (checksumA !== checksumB) {
    differences.push("Content mismatch after normalization")

    // Find line differences
    const linesA = normalizedA.split("\n")
    const linesB = normalizedB.split("\n")
    const maxLines = Math.max(linesA.length, linesB.length)

    for (let i = 0; i < maxLines; i++) {
      const lineA = linesA[i] || ""
      const lineB = linesB[i] || ""
      if (lineA !== lineB) {
        differences.push(`Line ${i + 1} differs: "${lineA}" != "${lineB}"`)
        if (differences.length >= 10) {
          break
        } // Limit number of differences
      }
    }
  }

  const identical = contentA === contentB
  const equivalent = normalizedA === normalizedB
  const similarity = sizeA === sizeB ? 100 : (Math.max(sizeA, sizeB) - Math.abs(sizeA - sizeB)) / Math.max(sizeA, sizeB) * 100

  return {
    identical,
    equivalent,
    differences,
    similarity,
    sizeA,
    sizeB,
    checksumA,
    checksumB,
  }
}

/**
 * Compare two MHTML files with MHTML-specific logic
 */
export function compareMHTMLFiles(
  fileA: Buffer,
  fileB: Buffer,
  options: MHTMLComparisonOptions = {},
): FileComparisonResult {
  const {
    ignoreBoundaries = true,
    ignoreTimestamps = true,
    ignoreContentIDs = true,
    ignoreWhitespace = false,
    ignoreLineEndings = true,
  } = options

  const contentA = fileA.toString("utf-8")
  const contentB = fileB.toString("utf-8")

  let normalizedA = contentA
  let normalizedB = contentB

  // MHTML-specific normalizations
  if (ignoreBoundaries) {
    // Replace all boundary strings with a placeholder
    normalizedA = normalizedA.replace(/----=_NextPart_[a-f0-9_]+/g, "----=_BOUNDARY_")
    normalizedB = normalizedB.replace(/----=_NextPart_[a-f0-9_]+/g, "----=_BOUNDARY_")
  }

  if (ignoreTimestamps) {
    // Remove date headers
    normalizedA = normalizedA.replace(/Date: .+\r\n/g, "")
    normalizedB = normalizedB.replace(/Date: .+\r\n/g, "")
  }

  if (ignoreContentIDs) {
    // Remove Content-ID headers
    normalizedA = normalizedA.replace(/Content-ID: .+\r\n/g, "")
    normalizedB = normalizedB.replace(/Content-ID: .+\r\n/g, "")
  }

  // Apply text comparison options
  if (ignoreWhitespace) {
    normalizedA = normalizedA.replace(/\s+/g, " ").trim()
    normalizedB = normalizedB.replace(/\s+/g, " ").trim()
  }

  if (ignoreLineEndings) {
    normalizedA = normalizedA.replace(/\r\n/g, "\n")
    normalizedB = normalizedB.replace(/\r\n/g, "\n")
  }

  const bufferA = Buffer.from(normalizedA, "utf-8")
  const bufferB = Buffer.from(normalizedB, "utf-8")

  const sizeA = fileA.length
  const sizeB = fileB.length
  const normalizedSizeA = bufferA.length
  const normalizedSizeB = bufferB.length

  const differences: string[] = []
  const checksumA = createHash("md5").update(bufferA).digest("hex")
  const checksumB = createHash("md5").update(bufferB).digest("hex")

  if (checksumA !== checksumB) {
    differences.push("MHTML content differs after normalization")

    // Check for specific MHTML structure differences
    const sectionsA = normalizedA.split(/----=_BOUNDARY_/g)
    const sectionsB = normalizedB.split(/----=_BOUNDARY_/g)

    if (sectionsA.length !== sectionsB.length) {
      differences.push(`Different number of sections: ${sectionsA.length} vs ${sectionsB.length}`)
    }

    // Compare section by section
    for (let i = 0; i < Math.min(sectionsA.length, sectionsB.length); i++) {
      if (sectionsA[i] !== sectionsB[i]) {
        differences.push(`Section ${i} differs`)
        if (differences.length >= 10) {
          break
        }
      }
    }
  }

  const identical = contentA === contentB
  const equivalent = normalizedA === normalizedB
  const similarity = normalizedSizeA === normalizedSizeB
    ? 100
    : (Math.max(normalizedSizeA, normalizedSizeB) - Math.abs(normalizedSizeA - normalizedSizeB))
      / Math.max(normalizedSizeA, normalizedSizeB) * 100

  return {
    identical,
    equivalent,
    differences,
    similarity,
    sizeA,
    sizeB,
    checksumA,
    checksumB,
  }
}

/**
 * Check if content is likely binary
 */
export function isBinaryContent(content: Buffer): boolean {
  // Check for null bytes
  if (content.includes(0)) {
    return true
  }

  // Check for high ratio of non-printable characters
  const sampleSize = Math.min(1024, content.length)
  let nonPrintableCount = 0

  for (let i = 0; i < sampleSize; i++) {
    const byte = content[i]
    if (byte < 32 || byte > 126) {
      if (byte !== 9 && byte !== 10 && byte !== 13) { // Not tab, LF, or CR
        nonPrintableCount++
      }
    }
  }

  const nonPrintableRatio = nonPrintableCount / sampleSize
  return nonPrintableRatio > 0.1 // More than 10% non-printable
}

/**
 * HTML normalization function for comparison
 */
export function normalizeHTML(html: string): string {
  return html
    // Normalize attribute order
    .replace(/<([^>]+)>/g, (match, tag) => {
      const attrs = tag
        .split(/\s+/)
        .filter(attr => attr.length > 0)
        .sort()
        .join(" ")
      return `<${attrs}>`
    })
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Create a golden reference manager for the test directory
 */
export function createGoldenManager(): GoldenReferenceManager {
  return new GoldenReferenceManager(join(__dirname, "..", "golden"))
}
