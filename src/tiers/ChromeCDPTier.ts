import { Buffer } from "node:buffer"

import type { ConversionResult, ConverterStrategy, Logger, ValidationResult } from "../architecture/strategies/types"
import type { ChromeCDPManager } from "../core/engine/chrome-cdp-manager"

/**
 * Chrome CDP Tier configuration options
 */
export interface ChromeCDPTierConfig {
  /** Maximum file size for conversion (bytes) */
  maxFileSize?: number
  /** Conversion timeout in milliseconds */
  timeout?: number
  /** Whether to capture screenshots before conversion */
  captureScreenshot?: boolean
  /** PDF generation options */
  pdfOptions?: {
    /** Paper format */
    format?: "A4" | "A3" | "A5" | "Letter" | "Legal"
    /** Print background graphics */
    printBackground?: boolean
    /** Page margins (inches) */
    margin?: {
      top?: number
      right?: number
      bottom?: number
      left?: number
    }
    /** Page orientation */
    landscape?: boolean
    /** Page ranges to print */
    pageRanges?: string
  }
  /** Image generation options */
  imageOptions?: {
    /** Output format */
    format?: "png" | "jpeg" | "webp"
    /** Image quality (0-1, for JPEG) */
    quality?: number
    /** Output dimensions */
    dimensions?: {
      width?: number
      height?: number
    }
    /** Capture full page or just viewport */
    fullPage?: boolean
  }
  /** Whether to generate MHTML */
  generateMHTML?: boolean
  /** Chrome launch options */
  chromeOptions?: {
    /** Headless mode */
    headless?: boolean
    /** Chrome window size */
    windowSize?: {
      width: number
      height: number
    }
    /** Additional Chrome arguments */
    chromeArgs?: string[]
  }
}

/**
 * Conversion format types supported by Chrome CDP
 */
export type ConversionFormat = "pdf" | "png" | "jpeg" | "webp" | "mhtml"

/**
 * Chrome CDP Tier - Tier 1 Progressive Enhancement Implementation
 *
 * Provides high-fidelity HTML conversion using Chrome DevTools Protocol with:
 * - PDF generation using Page.printToPDF
 * - Image generation using Page.screenshot
 * - MHTML creation using Page.captureSnapshot
 * - Error handling and timeout management
 * - Resource cleanup and performance optimization
 */
export class ChromeCDPTier implements ConverterStrategy {
  private logger: Logger
  private config: Required<ChromeCDPTierConfig>
  private chromeManager: ChromeCDPManager

  constructor(logger: Logger, chromeManager: ChromeCDPManager, config: ChromeCDPTierConfig = {}) {
    this.logger = logger
    this.chromeManager = chromeManager

    // Default configuration
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      timeout: 60000, // 60 seconds
      captureScreenshot: true,
      pdfOptions: {
        format: "A4",
        printBackground: true,
        margin: { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4 },
        landscape: false,
        pageRanges: "",
      },
      imageOptions: {
        format: "png",
        quality: 0.9,
        dimensions: { width: 1920, height: 1080 },
        fullPage: true,
      },
      generateMHTML: true,
      chromeOptions: {
        headless: true,
        windowSize: { width: 1920, height: 1080 },
        chromeArgs: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
      },
      ...config,
    }

    this.logger.info("Chrome CDP Tier initialized", {
      maxFileSize: this.config.maxFileSize,
      timeout: this.config.timeout,
      pdfFormat: this.config.pdfOptions.format,
      imageFormat: this.config.imageOptions.format,
    })
  }

  /**
   * Convert HTML document to the target format using Chrome CDP
   *
   * @param input - HTML document to convert
   * @returns Promise resolving to conversion result
   */
  async convert(input: HTMLDocument): Promise<ConversionResult> {
    const startTime = Date.now()
    const inputHTML = this.serializeHTMLDocument(input)
    const format = this.detectTargetFormat(inputHTML)

    this.logger.info("Starting Chrome CDP conversion", {
      format,
      inputSize: inputHTML.length,
      timeout: this.config.timeout,
    })

    try {
      // Validate input size
      if (inputHTML.length > this.config.maxFileSize) {
        throw new Error(`Input exceeds maximum file size: ${inputHTML.length} > ${this.config.maxFileSize}`)
      }

      // Get MHTML processor from Chrome manager
      const mhtmlProcessor = await this.chromeManager.getMHTMLProcessor()

      // Set up the HTML document in Chrome
      const { targetId } = await this.setupDocumentInChrome(mhtmlProcessor, inputHTML)

      // Capture pre-conversion screenshot if requested
      let preConversionScreenshot: string | undefined
      if (this.config.captureScreenshot) {
        preConversionScreenshot = await this.captureScreenshot(mhtmlProcessor, targetId, "png")
      }

      // Convert based on target format
      let content: string
      let mimeType: string

      switch (format) {
        case "pdf": {
          const pdfResult = await this.convertToPDF(mhtmlProcessor, targetId)
          content = pdfResult.content
          mimeType = "application/pdf"
          break
        }

        case "png":
        case "jpeg":
        case "webp": {
          const imageResult = await this.convertToImage(mhtmlProcessor, targetId, format)
          content = imageResult.content
          mimeType = `image/${format}`
          break
        }

        case "mhtml": {
          const mhtmlResult = await this.convertToMHTML(mhtmlProcessor, targetId)
          content = mhtmlResult.content
          mimeType = "multipart/related"
          break
        }

        default:
          throw new Error(`Unsupported conversion format: ${format}`)
      }

      const executionTime = Date.now() - startTime
      const contentSize = content.length

      const result: ConversionResult = {
        content,
        mimeType,
        metadata: {
          sourceType: "text/html",
          targetFormat: format,
          timestamp: new Date(),
          size: contentSize,
          executionTime,
          tier: 1,
          preConversionScreenshot,
          conversionMethod: "chrome-cdp",
          targetId,
        },
      }

      this.logger.info("Chrome CDP conversion completed", {
        format,
        size: contentSize,
        executionTime,
        targetId,
      })

      return result
    } catch (error) {
      const executionTime = Date.now() - startTime

      this.logger.error("Chrome CDP conversion failed", error as Error, {
        format,
        executionTime,
        inputSize: inputHTML.length,
      })

      throw new Error(`Chrome CDP conversion failed: ${(error as Error).message}`)
    }
  }

  /**
   * Validate HTML document before conversion
   *
   * @param input - HTML document to validate
   * @returns Validation result with any errors or warnings
   */
  validate(input: HTMLDocument): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      const htmlContent = this.serializeHTMLDocument(input)

      // Check for empty document
      if (!htmlContent || htmlContent.trim().length === 0) {
        errors.push("HTML document is empty")
      }

      // Check file size limits
      if (htmlContent.length > this.config.maxFileSize) {
        errors.push(`HTML document exceeds maximum size: ${htmlContent.length} bytes > ${this.config.maxFileSize} bytes`)
      }

      // Check for valid HTML structure
      if (!htmlContent.includes("<html") || !htmlContent.includes("</html>")) {
        warnings.push("HTML document may be missing proper HTML structure")
      }

      // Check for potentially problematic content
      if (htmlContent.includes("<script") && !this.config.chromeOptions.headless) {
        warnings.push("JavaScript detected - ensure Chrome runs in headless mode for security")
      }

      // Check for external resource dependencies
      const externalResources = this.getExternalResourceCount(htmlContent)
      if (externalResources > 50) {
        warnings.push(`High number of external resources (${externalResources}) - conversion may be slow`)
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        context: {
          contentType: "text/html",
          size: htmlContent.length,
          externalResourceCount: externalResources,
          estimatedConversionTime: this.estimateConversionTime(htmlContent.length, externalResources),
        },
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${(error as Error).message}`],
        warnings,
      }
    }
  }

  /**
   * Check if this strategy can handle the given content type
   *
   * @param contentType - MIME type to check
   * @returns True if this strategy can handle the content type
   */
  canHandle(contentType: string): boolean {
    return contentType === "text/html" || contentType === "application/xhtml+xml"
  }

  /**
   * Get the name of this converter strategy
   *
   * @returns Strategy name
   */
  getName(): string {
    return "Chrome CDP Tier"
  }

  /**
   * Get supported content types
   *
   * @returns Array of supported MIME types
   */
  getSupportedContentTypes(): string[] {
    return ["text/html", "application/xhtml+xml"]
  }

  /**
   * Get output format MIME type
   *
   * @returns Output MIME type
   */
  getOutputFormat(): string {
    return "application/pdf" // Default output format
  }

  // Private helper methods

  /**
   * Serialize HTML document to string
   */
  private serializeHTMLDocument(document: HTMLDocument): string {
    // Check for valid document structure
    if (!document.documentElement) {
      throw new Error("Cannot serialize HTML document: documentElement is null")
    }

    // In a browser environment, we can use document.documentElement.outerHTML
    if (typeof document !== "undefined" && document.documentElement) {
      return document.documentElement.outerHTML
    }

    // In Node.js environment, we need to handle serialization differently
    if (typeof window === "undefined") {
      // This would need a proper HTML serialization library in Node.js
      return `<html><head><title>Document</title></head><body>${document.body?.innerHTML || ""}</body></html>`
    }

    throw new Error("Cannot serialize HTML document: unsupported environment")
  }

  /**
   * Detect the target conversion format based on document content or configuration
   */
  private detectTargetFormat(htmlContent: string): ConversionFormat {
    // Check for format hints in the HTML
    if (htmlContent.includes("data-export=\"pdf\"") || htmlContent.includes("export-pdf")) {
      return "pdf"
    }
    if (htmlContent.includes("data-export=\"image\"") || htmlContent.includes("export-image")) {
      return this.config.imageOptions.format as ConversionFormat
    }
    if (htmlContent.includes("data-export=\"mhtml\"") || htmlContent.includes("export-mhtml")) {
      return "mhtml"
    }

    // Default to PDF for documents with significant content
    return "pdf"
  }

  /**
   * Set up HTML document in Chrome for conversion
   */
  private async setupDocumentInChrome(
    mhtmlProcessor: any,
    htmlContent: string,
  ): Promise<{ targetId: string }> {
    try {
      // Navigate to about:blank first to get a clean state
      const { targetId } = await mhtmlProcessor.navigate("about:blank")

      // Set the HTML content
      await mhtmlProcessor.setContent(htmlContent)

      // Wait for the page to load
      await mhtmlProcessor.waitForLoad()

      this.logger.debug("Document set up in Chrome", { targetId, contentLength: htmlContent.length })

      return { targetId }
    } catch (error) {
      this.logger.error("Failed to set up document in Chrome", error as Error)
      throw error
    }
  }

  /**
   * Convert document to PDF using Page.printToPDF
   */
  private async convertToPDF(mhtmlProcessor: any, targetId: string): Promise<{ content: string }> {
    try {
      this.logger.debug("Converting to PDF", { targetId })

      const pdfOptions = {
        format: this.config.pdfOptions.format,
        printBackground: this.config.pdfOptions.printBackground,
        margin: {
          top: this.config.pdfOptions.margin?.top ?? 0.4,
          right: this.config.pdfOptions.margin?.right ?? 0.4,
          bottom: this.config.pdfOptions.margin?.bottom ?? 0.4,
          left: this.config.pdfOptions.margin?.left ?? 0.4,
        },
        landscape: this.config.pdfOptions.landscape,
        pageRanges: this.config.pdfOptions.pageRanges,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
      }

      const pdfData = await mhtmlProcessor.printToPDF(pdfOptions)
      const base64Content = Buffer.from(pdfData).toString("base64")

      return { content: base64Content }
    } catch (error) {
      this.logger.error("Failed to convert to PDF", error as Error, { targetId })
      throw new Error(`PDF conversion failed: ${(error as Error).message}`)
    }
  }

  /**
   * Convert document to image using Page.screenshot
   */
  private async convertToImage(
    mhtmlProcessor: any,
    targetId: string,
    format: ConversionFormat,
  ): Promise<{ content: string }> {
    try {
      this.logger.debug("Converting to image", { targetId, format })

      const screenshotOptions = {
        format: this.config.imageOptions.format,
        quality: format === "jpeg" ? Math.round((this.config.imageOptions.quality ?? 0.9) * 100) : undefined,
        fullPage: this.config.imageOptions.fullPage,
        clip: this.config.imageOptions.dimensions
          ? {
              x: 0,
              y: 0,
              width: this.config.imageOptions.dimensions.width,
              height: this.config.imageOptions.dimensions.height,
            }
          : undefined,
      }

      const imageData = await mhtmlProcessor.screenshot(screenshotOptions)
      const base64Content = Buffer.from(imageData).toString("base64")

      return { content: base64Content }
    } catch (error) {
      this.logger.error("Failed to convert to image", error as Error, { targetId, format })
      throw new Error(`Image conversion failed: ${(error as Error).message}`)
    }
  }

  /**
   * Convert document to MHTML using Page.captureSnapshot
   */
  private async convertToMHTML(mhtmlProcessor: any, targetId: string): Promise<{ content: string }> {
    try {
      this.logger.debug("Converting to MHTML", { targetId })

      const mhtmlData = await mhtmlProcessor.captureSnapshot({
        format: "mhtml",
      })

      return { content: Buffer.from(mhtmlData).toString("base64") }
    } catch (error) {
      this.logger.error("Failed to convert to MHTML", error as Error, { targetId })
      throw new Error(`MHTML conversion failed: ${(error as Error).message}`)
    }
  }

  /**
   * Capture screenshot of the current page
   */
  private async captureScreenshot(
    mhtmlProcessor: any,
    targetId: string,
    format: string,
  ): Promise<string | undefined> {
    try {
      const screenshotData = await mhtmlProcessor.screenshot({
        format: format as any,
        fullPage: false,
        quality: 80,
      })

      return Buffer.from(screenshotData).toString("base64")
    } catch (error) {
      this.logger.warn("Failed to capture pre-conversion screenshot", error as Error, { targetId })
      return undefined
    }
  }

  /**
   * Count external resources in HTML content
   */
  private getExternalResourceCount(htmlContent: string): number {
    const patterns = [
      /<link[^>]+href=["']http[^"']*["']/gi,
      /<script[^>]+src=["']http[^"']*["']/gi,
      /<img[^>]+src=["']http[^"']*["']/gi,
      /url\(["']?http[^"')]*["']?\)/gi,
    ]

    return patterns.reduce((total, pattern) => {
      const matches = htmlContent.match(pattern)
      return total + (matches?.length || 0)
    }, 0)
  }

  /**
   * Estimate conversion time based on content size and complexity
   */
  private estimateConversionTime(contentSize: number, externalResources: number): number {
    // Base time for content processing
    let baseTime = 1000 // 1 second base time

    // Add time for content size (1ms per KB)
    baseTime += Math.ceil(contentSize / 1024)

    // Add time for external resources (100ms per resource)
    baseTime += externalResources * 100

    // Add overhead for CDP operations
    baseTime += 2000

    return baseTime
  }
}
