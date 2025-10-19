/**
 * Visual regression testing utilities for HTML converter outputs
 */

import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import process from "node:process"

export interface VisualComparisonOptions {
  /** Tolerance for pixel differences (0-1) */
  pixelTolerance?: number
  /** Maximum allowed different pixels */
  maxDiffPixels?: number
  /** Whether to update baseline instead of comparing */
  updateBaseline?: boolean
  /** Whether to generate diff images */
  generateDiff?: boolean
}

export interface VisualComparisonResult {
  /** Whether the images match within tolerance */
  passed: boolean
  /** Number of different pixels */
  diffPixels: number
  /** Total pixels compared */
  totalPixels: number
  /** Percentage of different pixels */
  diffPercentage: number
  /** Path to generated diff image (if any) */
  diffImagePath?: string
  /** Baseline image path */
  baselinePath: string
  /** Current image path */
  currentPath: string
}

/**
 * Visual regression testing utility class
 */
export class VisualRegressionUtils {
  private static readonly DEFAULT_OPTIONS: Required<VisualComparisonOptions> = {
    pixelTolerance: 0.01,
    maxDiffPixels: 1000,
    updateBaseline: false,
    generateDiff: true,
  }

  /**
   * Compare two image buffers for visual differences
   */
  static async compareImageBuffers(
    baselineBuffer: Buffer,
    currentBuffer: Buffer,
    options: VisualComparisonOptions = {},
  ): Promise<VisualComparisonResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }

    // Simple comparison using buffers for now
    // In a real implementation, you'd use pixel-by-pixel comparison
    const areIdentical = Buffer.compare(baselineBuffer, currentBuffer) === 0

    if (areIdentical) {
      return {
        passed: true,
        diffPixels: 0,
        totalPixels: baselineBuffer.length,
        diffPercentage: 0,
        baselinePath: "",
        currentPath: "",
      }
    }

    // For now, calculate a simple difference metric
    // In production, you'd use proper image comparison libraries
    const diffPixels = Math.abs(baselineBuffer.length - currentBuffer.length)
    const totalPixels = Math.max(baselineBuffer.length, currentBuffer.length)
    const diffPercentage = (diffPixels / totalPixels) * 100

    return {
      passed: diffPercentage <= opts.pixelTolerance * 100 && diffPixels <= opts.maxDiffPixels,
      diffPixels,
      totalPixels,
      diffPercentage,
      baselinePath: "",
      currentPath: "",
    }
  }

  /**
   * Compare PDF outputs for visual regression
   */
  static async comparePDFs(
    baselinePath: string,
    currentPath: string,
    _options: VisualComparisonOptions = {},
  ): Promise<VisualComparisonResult> {
    const baselineBuffer = readFileSync(baselinePath)
    const currentBuffer = readFileSync(currentPath)

    // For PDFs, we can do more sophisticated comparison
    // Extract text content and compare structure
    const baselineText = await this.extractPDFText(baselineBuffer)
    const currentText = await this.extractPDFText(currentBuffer)

    const textMatch = baselineText === currentText
    const visualMatch = Buffer.compare(baselineBuffer, currentBuffer) === 0

    return {
      passed: textMatch && visualMatch,
      diffPixels: textMatch ? 0 : 1,
      totalPixels: 1,
      diffPercentage: textMatch ? 0 : 100,
      baselinePath,
      currentPath,
    }
  }

  /**
   * Compare image outputs for visual regression
   */
  static async compareImageFiles(
    baselinePath: string,
    currentPath: string,
    options: VisualComparisonOptions = {},
  ): Promise<VisualComparisonResult> {
    const baselineBuffer = readFileSync(baselinePath)
    const currentBuffer = readFileSync(currentPath)

    return this.compareImageBuffers(baselineBuffer, currentBuffer, options)
  }

  /**
   * Generate a baseline image from buffer
   */
  static generateBaseline(
    buffer: Buffer,
    baselinePath: string,
    metadata: Record<string, any> = {},
  ): void {
    this.ensureDir(baselinePath)
    writeFileSync(baselinePath, buffer)

    // Store metadata alongside the baseline
    const metadataPath = baselinePath.replace(/\.[^.]+$/, ".meta.json")
    writeFileSync(metadataPath, JSON.stringify({
      created: new Date().toISOString(),
      size: buffer.length,
      hash: createHash("sha256").update(buffer).digest("hex"),
      ...metadata,
    }, null, 2))
  }

  /**
   * Update an existing baseline
   */
  static updateBaseline(
    buffer: Buffer,
    baselinePath: string,
    metadata: Record<string, any> = {},
  ): void {
    // Create backup of old baseline
    if (existsSync(baselinePath)) {
      const backupPath = baselinePath.replace(/\.[^.]+$/, `.backup.${Date.now()}$1`)
      writeFileSync(backupPath, readFileSync(baselinePath))
    }

    this.generateBaseline(buffer, baselinePath, metadata)
  }

  /**
   * Get baseline path for a test case
   */
  static getBaselinePath(
    testName: string,
    format: string,
    variant: string = "default",
  ): string {
    return join(
      process.cwd(),
      "tests",
      "visual",
      "baselines",
      testName,
      variant,
      `output.${format}`,
    )
  }

  /**
   * Ensure directory exists for file path
   */
  private static ensureDir(filePath: string): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  /**
   * Extract text content from PDF buffer
   * This is a simplified implementation - in production you'd use pdf-parse or similar
   */
  private static async extractPDFText(pdfBuffer: Buffer): Promise<string> {
    // Simple text extraction from PDF
    // In production, use a proper PDF parsing library
    const content = pdfBuffer.toString("utf-8", 0, Math.min(1000, pdfBuffer.length))

    // Extract text-like patterns from PDF
    const textMatches = content.match(/[a-z0-9\s.,!?()-]+/gi) || []
    return textMatches.join(" ").trim()
  }

  /**
   * Generate a visual diff image
   * This is a placeholder - in production you'd use image processing libraries
   */
  private static generateDiffImage(
    baselineBuffer: Buffer,
    currentBuffer: Buffer,
    diffPath: string,
  ): void {
    // Simple diff generation - in production use proper image diff libraries
    this.ensureDir(diffPath)

    // For now, just copy the current image as the "diff"
    writeFileSync(diffPath, currentBuffer)
  }

  /**
   * Load baseline metadata
   */
  static loadBaselineMetadata(baselinePath: string): Record<string, any> | null {
    const metadataPath = baselinePath.replace(/\.[^.]+$/, ".meta.json")

    if (!existsSync(metadataPath)) {
      return null
    }

    try {
      const content = readFileSync(metadataPath, "utf-8")
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Validate that a baseline exists and is readable
   */
  static validateBaseline(baselinePath: string): boolean {
    return existsSync(baselinePath)
      && existsSync(baselinePath.replace(/\.[^.]+$/, ".meta.json"))
  }

  /**
   * Get all available baseline variants for a test
   */
  static getBaselineVariants(testName: string, format: string): string[] {
    const basePath = join(
      process.cwd(),
      "tests",
      "visual",
      "baselines",
      testName,
    )

    if (!existsSync(basePath)) {
      return []
    }

    // This would scan for variants - simplified implementation
    try {
      const variants = readdirSync(basePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

      return variants.filter(variant =>
        existsSync(join(basePath, variant, `output.${format}`)),
      )
    } catch {
      return []
    }
  }
}

/**
 * Custom assertion helpers for visual regression testing
 */
export class VisualAssertions {
  /**
   * Assert that two images match within tolerance
   */
  static async assertImagesMatch(
    baselinePath: string,
    currentBuffer: Buffer,
    options?: VisualComparisonOptions,
  ): Promise<void> {
    const currentPath = this.createTempFile(currentBuffer, "current")

    try {
      const result = await VisualRegressionUtils.compareImageFiles(
        baselinePath,
        currentPath,
        options,
      )

      if (!result.passed) {
        throw new Error(
          `Visual regression detected: ${result.diffPercentage.toFixed(2)}% difference `
          + `(${result.diffPixels}/${result.totalPixels} pixels)`,
        )
      }
    } finally {
      this.cleanupTempFile(currentPath)
    }
  }

  /**
   * Assert that a PDF matches baseline
   */
  static async assertPDFMatches(
    baselinePath: string,
    currentBuffer: Buffer,
    options?: VisualComparisonOptions,
  ): Promise<void> {
    const currentPath = this.createTempFile(currentBuffer, "current.pdf")

    try {
      const result = await VisualRegressionUtils.comparePDFs(
        baselinePath,
        currentPath,
        options,
      )

      if (!result.passed) {
        throw new Error(
          `PDF regression detected: content or visual differences found`,
        )
      }
    } finally {
      this.cleanupTempFile(currentPath)
    }
  }

  /**
   * Create a temporary file for testing
   */
  private static createTempFile(buffer: Buffer, prefix: string): string {
    const tempDir = tmpdir()
    const fileName = `${prefix}-${Date.now()}.tmp`
    const filePath = join(tempDir, fileName)

    writeFileSync(filePath, buffer)
    return filePath
  }

  /**
   * Clean up temporary file
   */
  private static cleanupTempFile(filePath: string): void {
    try {
      unlinkSync(filePath)
    } catch {
      // Ignore cleanup errors
    }
  }
}
