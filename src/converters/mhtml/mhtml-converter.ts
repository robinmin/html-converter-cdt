/**
 * MHTML Converter - Converts HTML documents to MHTML format
 * Supports both direct MHTML output and intermediate generation for other converters
 */

import { BaseConverter } from "../../architecture/strategies/BaseConverter.js"
import type { Logger } from "../../architecture/strategies/types.js"
import type { ChromeCDPManager } from "../../core/engine/chrome-cdp-manager.js"

import type {
  ExternalResource,
  ICDPCapture,
  IMHTMLBuilder,
  IResourceFetcher,
  MHTMLConversionResult,
  MHTMLMetadata,
  MHTMLOptions,
} from "./types.js"

/**
 * Default MHTML conversion options
 */
const DEFAULT_MHTML_OPTIONS: Required<Omit<MHTMLOptions, "viewport" | "userAgent">> = {
  keepResources: true,
  compression: false,
  includeMetadata: true,
  captureScreenshot: false,
  waitTime: 1000,
  timeout: 30000,
}

/**
 * MHTML Converter implementation
 *
 * This converter handles:
 * - Direct MHTML conversion from HTML documents
 * - Intermediate MHTML generation for other converters
 * - External resource detection and embedding
 * - Chrome DevTools Protocol integration for page capture
 * - RFC 2557 compliant MHTML format generation
 */
export class MHTMLConverter extends BaseConverter {
  private resourceFetcher: IResourceFetcher
  private mhtmlBuilder: IMHTMLBuilder
  private cdpCapture?: ICDPCapture
  private cdpManager?: ChromeCDPManager

  constructor(
    logger: Logger,
    resourceFetcher: IResourceFetcher,
    mhtmlBuilder: IMHTMLBuilder,
    cdpCapture?: ICDPCapture,
    cdpManager?: ChromeCDPManager,
  ) {
    super(logger)
    this.resourceFetcher = resourceFetcher
    this.mhtmlBuilder = mhtmlBuilder
    this.cdpCapture = cdpCapture
    this.cdpManager = cdpManager

    this.logger.info("MHTML Converter initialized", {
      hasCDPSupport: !!cdpCapture,
      hasResourceFetcher: !!resourceFetcher,
      hasMHTMLBuilder: !!mhtmlBuilder,
      hasCDPManager: !!cdpManager,
    })
  }

  /**
   * Convert HTML document to MHTML format
   *
   * @param input - HTML document to convert
   * @returns Promise resolving to MHTML conversion result
   */
  async convert(input: HTMLDocument): Promise<MHTMLConversionResult> {
    // Validate input first
    const validation = this.validate(input)
    if (!validation.isValid) {
      throw new Error(`Input validation failed: ${validation.errors.join(", ")}`)
    }

    this.logger.info("Starting MHTML conversion", {
      documentSize: this.calculateDocumentSize(input),
      hasTitle: !!input.title,
    })

    // Warn about any validation warnings
    if (validation.warnings.length > 0) {
      this.logger.warn("Input validation warnings", validation.warnings)
    }

    const { result: mhtmlContent, duration } = await this.measureConversionTime(async () => {
      return await this.performMHTMLConversion(input)
    })

    // Update performance time in result
    if (mhtmlContent.performance) {
      mhtmlContent.performance.conversionTime = duration
    }

    this.logger.info("MHTML conversion completed", {
      duration,
      outputSize: mhtmlContent.content.length,
      resourceCount: (mhtmlContent as any).externalResources?.length || 0,
      fetchedCount: mhtmlContent.metadata.fetchedCount || 0,
    })

    return mhtmlContent
  }

  /**
   * Check if this converter can handle the given content type
   *
   * @param contentType - MIME type to check
   * @returns True if this converter can handle the content type
   */
  canHandle(contentType: string): boolean {
    const supportedTypes = this.getSupportedContentTypes()
    return supportedTypes.includes(contentType.toLowerCase())
  }

  /**
   * Get the name of this converter strategy
   *
   * @returns Converter name
   */
  getName(): string {
    return "mhtml"
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
    return "multipart/related"
  }

  /**
   * Perform the actual MHTML conversion
   *
   * @param input - HTML document to convert
   * @param options - MHTML conversion options
   * @returns Promise resolving to MHTML conversion result
   */
  private async performMHTMLConversion(
    input: HTMLDocument,
    options: MHTMLOptions = {},
  ): Promise<MHTMLConversionResult> {
    const mergedOptions = { ...DEFAULT_MHTML_OPTIONS, ...options }
    this.logger.debug("Using MHTML conversion options", mergedOptions)

    // Try CDP-based conversion first if available and we have a URL
    if (this.cdpManager && input.URL) {
      try {
        return await this.performCDPConversion(input.URL, mergedOptions)
      } catch (error) {
        this.logger.warn("CDP conversion failed, falling back to manual conversion", error as Error)
      }
    }

    // Fallback to manual conversion
    return await this.performManualConversion(input, mergedOptions)
  }

  /**
   * Perform CDP-based MHTML conversion
   *
   * @param url - URL to convert
   * @param options - Conversion options
   * @returns Promise resolving to MHTML conversion result
   */
  private async performCDPConversion(
    url: string,
    options: MHTMLOptions,
  ): Promise<MHTMLConversionResult> {
    this.logger.info("Starting CDP-based MHTML conversion", { url })

    if (!this.cdpManager) {
      throw new Error("CDP Manager not available")
    }

    const processor = await this.cdpManager.getMHTMLProcessor()
    const mhtmlContent = await processor.capturePageAsMHTML(url, options)

    // Get page information
    const pageInfo = await processor.getPageInfo(url)

    // Create external resources from page info
    const externalResources = pageInfo.resources.map(resourceUrl => ({
      originalUrl: resourceUrl,
      resolvedUrl: resourceUrl,
      type: "link" as const,
      contentType: "application/octet-stream",
      fetched: false,
      error: "Not fetched - handled by CDP",
    }))

    // Create metadata
    const metadata = this.createMHTMLMetadata(
      { title: pageInfo.title, URL: pageInfo.url } as HTMLDocument,
      externalResources,
      options,
    )

    // Generate boundary
    const boundary = this.mhtmlBuilder.generateBoundary()

    // Return conversion result
    return {
      content: mhtmlContent,
      mimeType: "multipart/related",
      metadata: {
        sourceType: "text/html",
        targetFormat: "mhtml",
        timestamp: new Date(),
        size: mhtmlContent.length,
        title: metadata.title,
        url: metadata.url,
        captureDate: metadata.captureDate,
        resourceCount: metadata.resourceCount,
        fetchedCount: metadata.fetchedCount,
        totalSize: metadata.totalSize,
        chromeVersion: metadata.chromeVersion,
        viewport: metadata.viewport,
      },
      format: "mhtml",
      externalResources,
      boundary,
      performance: {
        conversionTime: 0, // Will be set by measureConversionTime
      },
    }
  }

  /**
   * Perform manual MHTML conversion (fallback)
   *
   * @param input - HTML document to convert
   * @param options - Conversion options
   * @returns Promise resolving to MHTML conversion result
   */
  private async performManualConversion(
    input: HTMLDocument,
    options: MHTMLOptions,
  ): Promise<MHTMLConversionResult> {
    this.logger.info("Starting manual MHTML conversion")

    // Serialize HTML document
    const htmlContent = this.serializeHTMLDocument(input)

    // Detect external resources
    const externalUrls = this.detectExternalResources(htmlContent)
    this.logger.debug("Detected external resources", { count: externalUrls.length })

    // Fetch external resources if enabled
    let externalResources: ExternalResource[] = []
    if (options.keepResources && externalUrls.length > 0) {
      externalResources = await this.fetchExternalResources(externalUrls)
    }

    // Generate MIME boundary
    const boundary = this.mhtmlBuilder.generateBoundary()

    // Build MHTML content
    const mhtmlContent = this.mhtmlBuilder.build(htmlContent, externalResources, boundary)

    // Create metadata
    const metadata = this.createMHTMLMetadata(input, externalResources, options)

    // Return conversion result
    return {
      content: mhtmlContent,
      mimeType: "multipart/related",
      metadata: {
        sourceType: "text/html",
        targetFormat: "mhtml",
        timestamp: new Date(),
        size: mhtmlContent.length,
        title: metadata.title,
        url: metadata.url,
        captureDate: metadata.captureDate,
        resourceCount: metadata.resourceCount,
        fetchedCount: metadata.fetchedCount,
        totalSize: metadata.totalSize,
        chromeVersion: metadata.chromeVersion,
        viewport: metadata.viewport,
      },
      format: "mhtml",
      externalResources,
      boundary,
      performance: {
        conversionTime: 0, // Will be set by measureConversionTime
      },
    }
  }

  /**
   * Serialize HTML document to string
   *
   * @param input - HTML document to serialize
   * @returns Serialized HTML content
   */
  private serializeHTMLDocument(input: HTMLDocument): string {
    if (typeof XMLSerializer !== "undefined") {
      return new XMLSerializer().serializeToString(input)
    }

    // Fallback for environments without XMLSerializer
    return input.documentElement.outerHTML
  }

  /**
   * Detect external resources in HTML content
   *
   * @param htmlContent - HTML content to analyze
   * @returns Array of external resource URLs
   */
  private detectExternalResources(htmlContent: string): string[] {
    const urls = new Set<string>()

    // Pattern to match external URLs
    const patterns = [
      // Images: <img src="...">
      /<img[^>]+src\s*=\s*["']([^"']+)["']/gi,
      // Stylesheets: <link rel="stylesheet" href="...">
      /<link[^>]+href\s*=\s*["']([^"']+)["']/gi,
      // Scripts: <script src="...">
      /<script[^>]+src\s*=\s*["']([^"']+)["']/gi,
      // IFrames: <iframe src="...">
      /<iframe[^>]+src\s*=\s*["']([^"']+)["']/gi,
      // CSS imports: @import url(...)
      /@import\s+url\(["']?([^"')]+)["']?\)/gi,
      // CSS backgrounds: url(...)
      /background(?:-image)?\s*:[^;]*url\(["']?([^"')]+)["']?\)/gi,
    ]

    for (const pattern of patterns) {
      let match
      // eslint-disable-next-line no-cond-assign
      while ((match = pattern.exec(htmlContent)) !== null) {
        const url = match[1]
        // Only include HTTP/HTTPS URLs (skip data:, javascript:, etc.)
        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
          urls.add(url)
        }
      }
    }

    return Array.from(urls)
  }

  /**
   * Fetch external resources
   *
   * @param urls - Array of resource URLs to fetch
   * @returns Promise resolving to array of external resources
   */
  private async fetchExternalResources(urls: string[]): Promise<ExternalResource[]> {
    this.logger.debug("Fetching external resources", { count: urls.length })

    try {
      const resources = await this.resourceFetcher.fetchResources(urls)

      const successful = resources.filter(r => r.fetched).length
      const failed = resources.filter(r => !r.fetched).length

      this.logger.info("External resource fetching completed", {
        total: resources.length,
        successful,
        failed,
      })

      if (failed > 0) {
        const errors = resources
          .filter(r => !r.fetched && r.error)
          .map(r => `${r.originalUrl}: ${r.error}`)

        this.logger.warn("Some resources failed to fetch", errors)
      }

      return resources
    } catch (error) {
      this.logger.error("Failed to fetch external resources", error as Error)
      return []
    }
  }

  /**
   * Create MHTML metadata
   *
   * @param input - HTML document
   * @param resources - External resources
   * @param options - Conversion options
   * @returns MHTML metadata object
   */
  private createMHTMLMetadata(
    input: HTMLDocument,
    resources: ExternalResource[],
    options: MHTMLOptions,
  ): MHTMLMetadata {
    const successfulResources = resources.filter(r => r.fetched)
    const totalSize = successfulResources.reduce((sum, r) => sum + (r.size || 0), 0)

    return {
      title: input.title || undefined,
      url: input.URL || input.location?.href || undefined,
      captureDate: new Date(),
      resourceCount: resources.length,
      fetchedCount: successfulResources.length,
      totalSize,
      viewport: options.viewport,
    }
  }

  /**
   * Set CDP capture instance
   *
   * @param cdpCapture - CDP capture instance
   */
  setCDPCapture(cdpCapture: ICDPCapture): void {
    this.cdpCapture = cdpCapture
    this.logger.info("CDP capture instance set")
  }

  /**
   * Set resource fetcher instance
   *
   * @param resourceFetcher - Resource fetcher instance
   */
  setResourceFetcher(resourceFetcher: IResourceFetcher): void {
    this.resourceFetcher = resourceFetcher
    this.logger.info("Resource fetcher instance set")
  }

  /**
   * Set MHTML builder instance
   *
   * @param mhtmlBuilder - MHTML builder instance
   */
  setMHTMLBuilder(mhtmlBuilder: IMHTMLBuilder): void {
    this.mhtmlBuilder = mhtmlBuilder
    this.logger.info("MHTML builder instance set")
  }

  /**
   * Set Chrome CDP manager instance
   *
   * @param cdpManager - Chrome CDP manager instance
   */
  setCDPManager(cdpManager: ChromeCDPManager): void {
    this.cdpManager = cdpManager
    this.logger.info("Chrome CDP manager instance set")
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.cdpManager) {
      await this.cdpManager.cleanup()
    }
    this.logger.info("MHTML converter cleanup completed")
  }
}
