/**
 * MHTML Processor - Handles MHTML processing with Chrome DevTools Protocol integration
 * Provides CDP-based page capture and MHTML generation functionality
 */

import type { CDPClient } from "../../architecture/adapters/cdp/CDPClient.js"
import type { CDPLogger } from "../../architecture/adapters/cdp/types.js"
import type { Logger } from "../../architecture/strategies/types.js"
import type { ICDPCapture, MHTMLOptions } from "../../converters/mhtml/types.js"

/**
 * External dependency types for categorization
 */
export enum DependencyType {
  STYLESHEET = "stylesheet",
  SCRIPT = "script",
  IMAGE = "image",
  IFRAME = "iframe",
  EMBED = "embed",
  OBJECT = "object",
  VIDEO = "video",
  AUDIO = "audio",
  FONT = "font",
  CSS_IMPORT = "css_import",
  MANIFEST = "manifest",
  ICON = "icon",
  PREFETCH = "prefetch",
  PRELOAD = "preload",
  OTHER = "other",
}

/**
 * External dependency information
 */
export interface ExternalDependency {
  /** Dependency URL */
  url: string
  /** Type of dependency */
  type: DependencyType
  /** Element tag name */
  tagName: string
  /** Attribute containing the URL */
  attribute: string
  /** Whether URL is relative or absolute */
  isRelative: boolean
  /** Whether URL uses HTTPS */
  isSecure: boolean
  /** Additional metadata */
  metadata?: {
    media?: string
    crossorigin?: string
    integrity?: string
    referrerpolicy?: string
    rel?: string
    sizes?: string
    type?: string
  }
}

/**
 * Default CDP capture options
 */
const DEFAULT_CDP_OPTIONS: Required<Omit<MHTMLOptions, "viewport" | "userAgent">> = {
  keepResources: true,
  compression: false,
  includeMetadata: true,
  captureScreenshot: false,
  waitTime: 1000,
  timeout: 30000,
}

/**
 * External dependency detection patterns and logic
 */
export class ExternalDependencyDetector {
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  /**
   * Detect all external dependencies in HTML content
   *
   * @param htmlContent - HTML content to analyze
   * @param baseUrl - Base URL for resolving relative URLs
   * @returns Array of detected external dependencies
   */
  detectExternalDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    this.logger.debug("Starting external dependency detection", {
      contentLength: htmlContent.length,
      baseUrl,
    })

    const dependencies: ExternalDependency[] = []

    // Detect dependencies using regex patterns
    dependencies.push(...this.detectStylesheetDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectScriptDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectImageDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectIframeDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectEmbedDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectObjectDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectVideoDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectAudioDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectFontDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectCSSImportDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectManifestDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectIconDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectPrefetchDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectPreloadDependencies(htmlContent, baseUrl))
    dependencies.push(...this.detectOtherDependencies(htmlContent, baseUrl))

    // Remove duplicates and filter out invalid URLs
    const uniqueDependencies = this.deduplicateAndFilter(dependencies)

    this.logger.info("External dependency detection completed", {
      totalFound: dependencies.length,
      uniqueValid: uniqueDependencies.length,
      byType: this.getDependencyTypeCount(uniqueDependencies),
    })

    return uniqueDependencies
  }

  /**
   * Detect stylesheet dependencies
   */
  private detectStylesheetDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const pattern = /<link[^>]+rel\s*=\s*["'](?:stylesheet|alternate stylesheet)["'][^>]*>/gi
    return this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.STYLESHEET, baseUrl, ["href"])
  }

  /**
   * Detect script dependencies
   */
  private detectScriptDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const pattern = /<script[^>]+src\s*=\s*["'][^"']+["'][^>]*>/gi
    return this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.SCRIPT, baseUrl, ["src"])
  }

  /**
   * Detect image dependencies
   */
  private detectImageDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const patterns = [
      /<img[^>]+src\s*=\s*["'][^"']+["'][^>]*>/gi,
      /<img[^>]+srcset\s*=\s*["'][^"']+["'][^>]*>/gi,
    ]

    const dependencies: ExternalDependency[] = []
    for (const pattern of patterns) {
      dependencies.push(...this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.IMAGE, baseUrl, ["src", "srcset"]))
    }
    return dependencies
  }

  /**
   * Detect iframe dependencies
   */
  private detectIframeDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const patterns = [
      /<iframe[^>]+src\s*=\s*["'][^"']+["'][^>]*>/gi,
      /<frame[^>]+src\s*=\s*["'][^"']+["'][^>]*>/gi,
    ]

    const dependencies: ExternalDependency[] = []
    for (const pattern of patterns) {
      dependencies.push(...this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.IFRAME, baseUrl, ["src"]))
    }
    return dependencies
  }

  /**
   * Detect embed dependencies
   */
  private detectEmbedDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const pattern = /<embed[^>]+src\s*=\s*["'][^"']+["'][^>]*>/gi
    return this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.EMBED, baseUrl, ["src"])
  }

  /**
   * Detect object dependencies
   */
  private detectObjectDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const patterns = [
      /<object[^>]+data\s*=\s*["'][^"']+["'][^>]*>/gi,
      /<object[^>]+codebase\s*=\s*["'][^"']+["'][^>]*>/gi,
    ]

    const dependencies: ExternalDependency[] = []
    for (const pattern of patterns) {
      dependencies.push(...this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.OBJECT, baseUrl, ["data", "codebase"]))
    }
    return dependencies
  }

  /**
   * Detect video dependencies
   */
  private detectVideoDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const patterns = [
      /<video[^>]+src\s*=\s*["'][^"']+["'][^>]*>/gi,
      /<video[^>]+poster\s*=\s*["'][^"']+["'][^>]*>/gi,
      /<source[^>]+src\s*=\s*["'][^"']+["'][^>]*type\s*=\s*["']video\/[^"']+["'][^>]*>/gi,
    ]

    const dependencies: ExternalDependency[] = []
    for (const pattern of patterns) {
      dependencies.push(...this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.VIDEO, baseUrl, ["src", "poster"]))
    }
    return dependencies
  }

  /**
   * Detect audio dependencies
   */
  private detectAudioDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const pattern = /<source[^>]+src\s*=\s*["'][^"']+["'][^>]*type\s*=\s*["']audio\/[^"']+["'][^>]*>/gi
    return this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.AUDIO, baseUrl, ["src"])
  }

  /**
   * Detect font dependencies
   */
  private detectFontDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const patterns = [
      /@font-face\s*\{[^}]*src\s*:\s*url\s*\(\s*["']?([^"')\s]+)["']?\s*\)[^}]*\}/gi,
      /@font-face\s*\{[^}]*src\s*:\s*["']([^"']+)["'][^}]*\}/gi,
    ]

    const dependencies: ExternalDependency[] = []
    for (const pattern of patterns) {
      dependencies.push(...this.extractFontDependencies(htmlContent, pattern, baseUrl))
    }
    return dependencies
  }

  /**
   * Detect CSS import dependencies
   */
  private detectCSSImportDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const patterns = [
      /@import\s+url\s*\(\s*["']([^"')]+)["']\s*\)/gi,
      /@import\s+["']([^"']+)["']/gi,
    ]

    const dependencies: ExternalDependency[] = []
    for (const pattern of patterns) {
      dependencies.push(...this.extractCSSImportDependencies(htmlContent, pattern, baseUrl))
    }
    return dependencies
  }

  /**
   * Detect manifest dependencies
   */
  private detectManifestDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const pattern = /<link[^>]+rel\s*=\s*["']manifest["'][^>]*>/gi
    return this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.MANIFEST, baseUrl, ["href"])
  }

  /**
   * Detect icon dependencies
   */
  private detectIconDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const pattern = /<link[^>]+rel\s*=\s*["'](?:icon|apple-touch-icon|shortcut icon)["'][^>]*>/gi
    return this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.ICON, baseUrl, ["href"])
  }

  /**
   * Detect prefetch dependencies
   */
  private detectPrefetchDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const pattern = /<link[^>]+rel\s*=\s*["']prefetch["'][^>]*>/gi
    return this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.PREFETCH, baseUrl, ["href"])
  }

  /**
   * Detect preload dependencies
   */
  private detectPreloadDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const pattern = /<link[^>]+rel\s*=\s*["']preload["'][^>]*>/gi
    return this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.PRELOAD, baseUrl, ["href", "imagesrcset"])
  }

  /**
   * Detect other dependencies using generic patterns
   */
  private detectOtherDependencies(htmlContent: string, baseUrl?: string): ExternalDependency[] {
    const patterns = [
      /<(?:a|area)[^>]+href\s*=\s*["']https?:\/\/[^"']+["'][^>]*>/gi,
      /<meta[^>]+content\s*=\s*["'][^"']*https?:\/\/[^"']+["'][^>]*>/gi,
    ]

    const dependencies: ExternalDependency[] = []
    for (const pattern of patterns) {
      dependencies.push(...this.extractDependenciesFromPattern(htmlContent, pattern, DependencyType.OTHER, baseUrl, ["href", "content"]))
    }
    return dependencies
  }

  /**
   * Extract font dependencies from regex pattern matches
   */
  private extractFontDependencies(
    htmlContent: string,
    pattern: RegExp,
    baseUrl?: string,
  ): ExternalDependency[] {
    const dependencies: ExternalDependency[] = []
    let match

    // Reset regex lastIndex to ensure consistent matching
    pattern.lastIndex = 0

    while (true) {
      match = pattern.exec(htmlContent)
      if (match === null) {
        break
      }

      // The URL is captured in group 1 for font patterns
      const url = match[1]
      if (!url || !this.isValidUrl(url)) {
        continue
      }

      // Resolve relative URLs if base URL is provided
      let resolvedUrl = url
      if (baseUrl && this.isRelativeUrl(url)) {
        resolvedUrl = this.resolveRelativeUrl(url, baseUrl)
      }

      const dependency: ExternalDependency = {
        url: resolvedUrl,
        type: DependencyType.FONT,
        tagName: "style", // @font-face rules are typically inside style tags
        attribute: "src", // Use src as the attribute name for fonts
        isRelative: this.isRelativeUrl(resolvedUrl),
        isSecure: resolvedUrl.startsWith("https://"),
        metadata: undefined, // Font declarations don't have standard metadata
      }

      dependencies.push(dependency)
    }

    return dependencies
  }

  /**
   * Extract CSS import dependencies from regex pattern matches
   */
  private extractCSSImportDependencies(
    htmlContent: string,
    pattern: RegExp,
    baseUrl?: string,
  ): ExternalDependency[] {
    const dependencies: ExternalDependency[] = []
    let match

    // Reset regex lastIndex to ensure consistent matching
    pattern.lastIndex = 0

    while (true) {
      match = pattern.exec(htmlContent)
      if (match === null) {
        break
      }

      // The URL is captured in group 1 for CSS import patterns
      const url = match[1]
      if (!url || !this.isValidUrl(url)) {
        continue
      }

      // Resolve relative URLs if base URL is provided
      let resolvedUrl = url
      if (baseUrl && this.isRelativeUrl(url)) {
        resolvedUrl = this.resolveRelativeUrl(url, baseUrl)
      }

      const dependency: ExternalDependency = {
        url: resolvedUrl,
        type: DependencyType.CSS_IMPORT,
        tagName: "style", // CSS imports are typically inside style tags
        attribute: "import", // Use a custom attribute name for CSS imports
        isRelative: this.isRelativeUrl(resolvedUrl),
        isSecure: resolvedUrl.startsWith("https://"),
        metadata: undefined, // CSS imports don't have standard metadata
      }

      dependencies.push(dependency)
    }

    return dependencies
  }

  /**
   * Extract dependencies from regex pattern matches
   */
  private extractDependenciesFromPattern(
    htmlContent: string,
    pattern: RegExp,
    type: DependencyType,
    baseUrl?: string,
    attributes: string[] = ["src", "href", "data", "codebase"],
  ): ExternalDependency[] {
    const dependencies: ExternalDependency[] = []
    let match

    // Reset regex lastIndex to ensure consistent matching
    pattern.lastIndex = 0

    while (true) {
      match = pattern.exec(htmlContent)
      if (match === null) {
        break
      }
      const element = match[0]
      const tagName = this.extractTagName(element)

      for (const attribute of attributes) {
        const urls = this.extractUrlsFromAttribute(element, attribute)

        for (let url of urls) {
          if (!this.isValidUrl(url)) {
            continue
          }

          // Resolve relative URLs if base URL is provided
          if (baseUrl && this.isRelativeUrl(url)) {
            url = this.resolveRelativeUrl(url, baseUrl)
          }

          const dependency: ExternalDependency = {
            url,
            type,
            tagName,
            attribute,
            isRelative: this.isRelativeUrl(url),
            isSecure: url.startsWith("https://"),
            metadata: this.extractMetadata(element),
          }

          dependencies.push(dependency)
        }
      }
    }

    return dependencies
  }

  /**
   * Extract tag name from HTML element
   */
  private extractTagName(element: string): string {
    const match = element.match(/<(\w+)/)
    return match?.[1]?.toLowerCase() ?? "unknown"
  }

  /**
   * Extract URLs from an attribute value
   */
  private extractUrlsFromAttribute(element: string, attribute: string): string[] {
    const regex = new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i")
    const match = element.match(regex)

    if (!match || !match[1]) {
      return []
    }

    const value = match[1].trim()

    // Handle srcset and other comma-separated attributes
    if (attribute === "srcset" || attribute === "imagesrcset") {
      return value.split(",").map(src => src.trim().split(/\s+/)[0]).filter((url): url is string => url !== undefined && url.length > 0)
    }

    // Handle CSS url() syntax
    if (value.includes("url(")) {
      const urlMatch = value.match(/url\s*\(\s*["']?([^"')\s]+)["']?\s*\)/i)
      return urlMatch?.[1] ? [urlMatch[1]] : []
    }

    return [value]
  }

  /**
   * Extract metadata from HTML element
   */
  private extractMetadata(element: string): ExternalDependency["metadata"] {
    const metadata: ExternalDependency["metadata"] = {}

    // Extract common attributes
    const attributes = ["media", "crossorigin", "integrity", "referrerpolicy", "rel", "sizes", "type"]

    for (const attr of attributes) {
      const regex = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i")
      const match = element.match(regex)
      if (match?.[1]) {
        (metadata as any)[attr] = match[1].trim()
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    if (!url || url.trim().length === 0) {
      return false
    }

    const trimmedUrl = url.trim()

    // Skip data URLs, mailto, tel, javascript, etc.
    const invalidSchemes = ["data:", "mailto:", "tel:", "javascript:", "ftp:", "file:", "#"]

    for (const scheme of invalidSchemes) {
      if (trimmedUrl.startsWith(scheme)) {
        return false
      }
    }

    // Check for valid URL patterns - be more permissive
    const httpPattern = /^https?:\/\/.+/i
    const protocolPattern = /^\/\/.+/
    const absolutePattern = /^\/.+/
    const relativePattern = /^[^\\/:#]+\//
    const plainFilePattern = /^[^\\/:#]+\.[a-z0-9]+$/i

    return (
      httpPattern.test(trimmedUrl)
      || protocolPattern.test(trimmedUrl)
      || absolutePattern.test(trimmedUrl)
      || relativePattern.test(trimmedUrl)
      || plainFilePattern.test(trimmedUrl)
    )
  }

  /**
   * Check if URL is relative
   */
  private isRelativeUrl(url: string): boolean {
    return !url.startsWith("http://") && !url.startsWith("https://")
  }

  /**
   * Resolve relative URL against base URL
   */
  private resolveRelativeUrl(relativeUrl: string, baseUrl: string): string {
    try {
      const base = new URL(baseUrl)
      return new URL(relativeUrl, base).href
    } catch (error) {
      this.logger.warn("Failed to resolve relative URL", { relativeUrl, baseUrl, error: (error as Error).message })
      return relativeUrl
    }
  }

  /**
   * Remove duplicates and filter dependencies
   */
  private deduplicateAndFilter(dependencies: ExternalDependency[]): ExternalDependency[] {
    const seen = new Set<string>()
    const filtered: ExternalDependency[] = []

    for (const dep of dependencies) {
      const key = `${dep.type}:${dep.url}`
      if (!seen.has(key)) {
        seen.add(key)
        filtered.push(dep)
      }
    }

    return filtered
  }

  /**
   * Get count of dependencies by type
   */
  private getDependencyTypeCount(dependencies: ExternalDependency[]): Record<DependencyType, number> {
    const counts: Record<DependencyType, number> = {} as Record<DependencyType, number>

    for (const dep of dependencies) {
      counts[dep.type] = (counts[dep.type] || 0) + 1
    }

    return counts
  }

  /**
   * Get dependencies by type
   */
  getDependenciesByType(dependencies: ExternalDependency[], type: DependencyType): ExternalDependency[] {
    return dependencies.filter(dep => dep.type === type)
  }

  /**
   * Get external dependencies only (not relative)
   */
  getExternalDependencies(dependencies: ExternalDependency[]): ExternalDependency[] {
    return dependencies.filter(dep => !dep.isRelative)
  }

  /**
   * Get secure dependencies only (HTTPS)
   */
  getSecureDependencies(dependencies: ExternalDependency[]): ExternalDependency[] {
    return dependencies.filter(dep => dep.isSecure)
  }
}

/**
 * Chrome DevTools Protocol configuration
 */
export interface CDPCaptureConfig {
  /** Chrome executable path */
  chromePath?: string
  /** Chrome launch arguments */
  chromeArgs?: string[]
  /** CDP connection timeout */
  connectionTimeout?: number
  /** Page load timeout */
  pageTimeout?: number
  /** Whether to run in headless mode */
  headless?: boolean
  /** User data directory for Chrome */
  userDataDir?: string
  /** Whether to disable web security */
  disableWebSecurity?: boolean
  /** Whether to ignore certificate errors */
  ignoreCertificateErrors?: boolean
}

/**
 * Page capture metadata
 */
export interface PageCaptureMetadata {
  /** Page title */
  title: string
  /** Page URL */
  url: string
  /** Number of resources found */
  resourceCount: number
  /** Total page size */
  totalSize: number
  /** Chrome version used */
  chromeVersion: string
  /** Capture timestamp */
  captureTimestamp: Date
}

/**
 * MHTML Processor with Chrome DevTools Protocol integration
 *
 * This processor handles:
 * - Chrome process launching and lifecycle management
 * - CDP connection establishment and management
 * - Page navigation and resource capture
 * - MHTML generation using Page.captureSnapshot API
 * - Error handling and recovery for CDP failures
 * - Chrome process cleanup and resource management
 */
export class MHTMLProcessor implements ICDPCapture {
  private logger: Logger
  private cdpLogger: CDPLogger
  private cdpClient?: CDPClient
  private config: CDPCaptureConfig
  private isConnected = false
  private dependencyDetector: ExternalDependencyDetector

  constructor(logger: Logger, config: CDPCaptureConfig = {}) {
    this.logger = logger
    this.config = {
      headless: true,
      connectionTimeout: 30000,
      pageTimeout: 30000,
      disableWebSecurity: false,
      ignoreCertificateErrors: true,
      chromeArgs: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-images", // We'll handle images ourselves
        "--disable-javascript", // For security, unless needed
      ],
      ...config,
    }

    this.cdpLogger = {
      debug: (message: string, ...args: any[]) => {
        this.logger.debug(`[CDP] ${message}`, ...args)
      },
      info: (message: string, ...args: any[]) => {
        this.logger.info(`[CDP] ${message}`, ...args)
      },
      warn: (message: string, ...args: any[]) => {
        this.logger.warn(`[CDP] ${message}`, ...args)
      },
      error: (message: string, error?: Error, ...args: any[]) => {
        this.logger.error(`[CDP] ${message}`, error, ...args)
      },
    }

    this.dependencyDetector = new ExternalDependencyDetector(logger)

    this.logger.info("MHTML Processor initialized", {
      headless: this.config.headless,
      connectionTimeout: this.config.connectionTimeout,
      pageTimeout: this.config.pageTimeout,
    })
  }

  /**
   * Capture a web page as MHTML using Chrome DevTools Protocol
   *
   * @param url - URL to navigate and capture
   * @param options - Capture options
   * @returns Promise resolving to MHTML content string
   */
  async capturePageAsMHTML(url: string, options: MHTMLOptions = {}): Promise<string> {
    const mergedOptions = { ...DEFAULT_CDP_OPTIONS, ...options }
    this.logger.info("Starting MHTML capture", { url, options: mergedOptions })

    try {
      // Ensure CDP connection is established
      await this.ensureConnection()

      if (!this.cdpClient || !this.isConnected) {
        throw new Error("Failed to establish CDP connection")
      }

      // Navigate to the URL
      await this.navigateToPage(url, mergedOptions)

      // Wait for page to load completely
      await this.waitForPageLoad(mergedOptions)

      // Get page metadata
      const pageMetadata = await this.getPageMetadata()

      // Capture MHTML snapshot
      const mhtmlContent = await this.captureMHTMLSnapshot()

      this.logger.info("MHTML capture completed", {
        url,
        title: pageMetadata.title,
        contentLength: mhtmlContent.length,
        resourceCount: pageMetadata.resourceCount,
      })

      return mhtmlContent
    } catch (error) {
      this.logger.error("Failed to capture page as MHTML", error as Error, { url })
      throw new Error(`MHTML capture failed: ${(error as Error).message}`)
    } finally {
      // Cleanup connection if needed
      await this.cleanupConnection()
    }
  }

  /**
   * Get page information including title, URL, and resources
   *
   * @param url - URL to analyze
   * @returns Promise resolving to page information
   */
  async getPageInfo(url: string): Promise<{
    title: string
    url: string
    resources: string[]
  }> {
    this.logger.info("Getting page information", { url })

    try {
      await this.ensureConnection()

      if (!this.cdpClient || !this.isConnected) {
        throw new Error("Failed to establish CDP connection")
      }

      // Navigate to the URL
      await this.navigateToPage(url)

      // Wait for page load
      await this.waitForPageLoad()

      // Get page information
      const pageInfo = await this.extractPageInfo()

      this.logger.info("Page information retrieved", {
        url: pageInfo.url,
        title: pageInfo.title,
        resourceCount: pageInfo.resources.length,
      })

      return pageInfo
    } catch (error) {
      this.logger.error("Failed to get page information", error as Error, { url })
      throw new Error(`Failed to get page information: ${(error as Error).message}`)
    } finally {
      await this.cleanupConnection()
    }
  }

  /**
   * Set CDP client instance
   *
   * @param cdpClient - CDP client to use
   */
  setCDPClient(cdpClient: CDPClient): void {
    this.cdpClient = cdpClient
    this.isConnected = cdpClient.isConnected()
    this.logger.info("CDP client instance set", { connected: this.isConnected })
  }

  /**
   * Analyze external dependencies in HTML content
   *
   * @param htmlContent - HTML content to analyze
   * @param baseUrl - Base URL for resolving relative URLs
   * @returns Promise resolving to external dependencies analysis
   */
  async analyzeExternalDependencies(
    htmlContent: string,
    baseUrl?: string,
  ): Promise<{
    dependencies: ExternalDependency[]
    summary: {
      total: number
      byType: Record<DependencyType, number>
      external: number
      secure: number
      relative: number
    }
  }> {
    this.logger.info("Starting external dependency analysis", {
      contentLength: htmlContent.length,
      baseUrl,
    })

    try {
      const dependencies = this.dependencyDetector.detectExternalDependencies(htmlContent, baseUrl)

      const summary = {
        total: dependencies.length,
        byType: this.getDependencyTypeCount(dependencies),
        external: this.dependencyDetector.getExternalDependencies(dependencies).length,
        secure: this.dependencyDetector.getSecureDependencies(dependencies).length,
        relative: dependencies.filter(dep => dep.isRelative).length,
      }

      this.logger.info("External dependency analysis completed", summary)

      return { dependencies, summary }
    } catch (error) {
      this.logger.error("Failed to analyze external dependencies", error as Error)
      throw new Error(`External dependency analysis failed: ${(error as Error).message}`)
    }
  }

  /**
   * Get dependencies by type from a URL
   *
   * @param url - URL to analyze
   * @param type - Specific dependency type to filter by
   * @returns Promise resolving to filtered dependencies
   */
  async getDependenciesByType(url: string, type: DependencyType): Promise<ExternalDependency[]> {
    this.logger.info("Getting dependencies by type", { url, type })

    try {
      await this.ensureConnection()

      if (!this.cdpClient || !this.isConnected) {
        throw new Error("Failed to establish CDP connection")
      }

      // Navigate to the URL
      await this.navigateToPage(url)

      // Wait for page load
      await this.waitForPageLoad()

      // Get page HTML content
      const result = await this.cdpClient!.sendCommand("Runtime.evaluate", {
        expression: "document.documentElement.outerHTML",
        returnByValue: true,
      })

      if (!result.success || !result.result.result?.value) {
        throw new Error("Failed to get page HTML content")
      }

      const htmlContent = result.result.result.value

      // Detect all dependencies
      const allDependencies = this.dependencyDetector.detectExternalDependencies(htmlContent, url)

      // Filter by type
      const filteredDependencies = this.dependencyDetector.getDependenciesByType(allDependencies, type)

      this.logger.info("Dependencies by type retrieved", {
        url,
        type,
        totalFound: allDependencies.length,
        filteredCount: filteredDependencies.length,
      })

      return filteredDependencies
    } catch (error) {
      this.logger.error("Failed to get dependencies by type", error as Error, { url, type })
      throw new Error(`Failed to get dependencies by type: ${(error as Error).message}`)
    } finally {
      await this.cleanupConnection()
    }
  }

  /**
   * Get count of dependencies by type
   */
  private getDependencyTypeCount(dependencies: ExternalDependency[]): Record<DependencyType, number> {
    const counts: Record<DependencyType, number> = {} as Record<DependencyType, number>

    for (const dep of dependencies) {
      counts[dep.type] = (counts[dep.type] || 0) + 1
    }

    return counts
  }

  /**
   * Ensure CDP connection is established
   */
  private async ensureConnection(): Promise<void> {
    if (this.cdpClient && this.isConnected) {
      return
    }

    if (!this.cdpClient) {
      throw new Error("CDP client not available. Please set a CDP client instance.")
    }

    if (!this.isConnected) {
      await this.cdpClient.connect()
      this.isConnected = this.cdpClient.isConnected()
      this.logger.info("CDP connection established", { connected: this.isConnected })
    }
  }

  /**
   * Navigate to a specific URL
   *
   * @param url - URL to navigate to
   * @param options - Navigation options
   */
  private async navigateToPage(url: string, options: MHTMLOptions = {}): Promise<void> {
    this.logger.info("Navigating to page", { url })

    try {
      // Set user agent if provided
      if (options.userAgent) {
        await this.cdpClient!.sendCommand("Network.setUserAgentOverride", {
          userAgent: options.userAgent,
        })
      }

      // Set viewport if provided
      if (options.viewport) {
        await this.cdpClient!.sendCommand("Emulation.setDeviceMetricsOverride", {
          width: options.viewport.width,
          height: options.viewport.height,
          deviceScaleFactor: 1,
          mobile: false,
        })
      }

      // Navigate to the URL
      const result = await this.cdpClient!.sendCommand("Page.navigate", {
        url,
      })

      if (!result.success) {
        throw new Error(`Navigation failed: ${result.error}`)
      }

      this.logger.info("Navigation initiated", { url, frameId: result.result?.frameId })
    } catch (error) {
      this.logger.error("Failed to navigate to page", error as Error, { url })
      throw error
    }
  }

  /**
   * Wait for page to load completely
   *
   * @param options - Wait options
   */
  private async waitForPageLoad(options: MHTMLOptions = {}): Promise<void> {
    const timeout = options.timeout || DEFAULT_CDP_OPTIONS.timeout
    const waitTime = options.waitTime || DEFAULT_CDP_OPTIONS.waitTime

    this.logger.info("Waiting for page load", { timeout, waitTime })

    try {
      // Wait for load event fired
      await Promise.race([
        new Promise<void>((resolve) => {
          const loadHandler = () => {
            this.cdpClient!.removeEventListener("page.loadEventFired", loadHandler)
            resolve()
          }
          this.cdpClient!.addEventListener("page.loadEventFired", loadHandler)
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Page load timeout")), timeout)
        }),
      ])

      // Additional wait time for dynamic content
      if (waitTime > 0) {
        this.logger.debug(`Waiting additional ${waitTime}ms for dynamic content`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      this.logger.info("Page load completed")
    } catch (error) {
      this.logger.error("Failed to wait for page load", error as Error)
      throw error
    }
  }

  /**
   * Get page metadata including title and resource information
   *
   * @returns Promise resolving to page metadata
   */
  private async getPageMetadata(): Promise<PageCaptureMetadata> {
    this.logger.debug("Extracting page metadata")

    try {
      // Get page title
      const titleResult = await this.cdpClient!.sendCommand("Runtime.evaluate", {
        expression: "document.title",
        returnByValue: true,
      })

      const title = titleResult.success ? titleResult.result.result?.value || "" : ""

      // Get page URL
      const urlResult = await this.cdpClient!.sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true,
      })

      const url = urlResult.success ? urlResult.result.result?.value || "" : ""

      // Get resource count from network logs
      const resources = await this.getPageResources(url)

      // Get Chrome version
      const versionResult = await this.cdpClient!.sendCommand("Runtime.evaluate", {
        expression: "navigator.userAgent",
        returnByValue: true,
      })

      const userAgent = versionResult.success ? versionResult.result.result?.value || "" : ""

      const metadata: PageCaptureMetadata = {
        title,
        url,
        resourceCount: resources.length,
        totalSize: 0, // Would need Network.getResponseBody for each resource
        chromeVersion: userAgent,
        captureTimestamp: new Date(),
      }

      this.logger.debug("Page metadata extracted", metadata)
      return metadata
    } catch (error) {
      this.logger.error("Failed to extract page metadata", error as Error)
      throw error
    }
  }

  /**
   * Get page resources information using comprehensive dependency detection
   *
   * @param baseUrl - Base URL for resolving relative URLs
   * @returns Promise resolving to array of resource URLs
   */
  private async getPageResources(baseUrl?: string): Promise<string[]> {
    try {
      // Get page HTML content
      const result = await this.cdpClient!.sendCommand("Runtime.evaluate", {
        expression: "document.documentElement.outerHTML",
        returnByValue: true,
      })

      if (!result.success || !result.result.result?.value) {
        this.logger.warn("Failed to get page HTML content")
        return []
      }

      const htmlContent = result.result.result.value

      // Use dependency detector to find all external resources
      const dependencies = this.dependencyDetector.detectExternalDependencies(htmlContent, baseUrl)

      // Extract just the URLs
      const resourceUrls = dependencies.map(dep => dep.url)

      this.logger.debug("Page resources detected", {
        totalDependencies: dependencies.length,
        resourceUrls: resourceUrls.length,
      })

      return resourceUrls
    } catch (error) {
      this.logger.error("Failed to get page resources", error as Error)
      return []
    }
  }

  /**
   * Capture MHTML snapshot using Page.captureSnapshot API
   *
   * @returns Promise resolving to MHTML content
   */
  private async captureMHTMLSnapshot(): Promise<string> {
    this.logger.info("Capturing MHTML snapshot")

    try {
      const result = await this.cdpClient!.sendCommand("Page.captureSnapshot", {
        format: "mhtml",
      })

      if (!result.success) {
        throw new Error(`MHTML snapshot capture failed: ${result.error}`)
      }

      const mhtmlContent = result.result?.data || ""

      if (!mhtmlContent) {
        throw new Error("Received empty MHTML content from CDP")
      }

      this.logger.info("MHTML snapshot captured", {
        contentLength: mhtmlContent.length,
        previewStart: mhtmlContent.substring(0, 100) + "...",
      })

      return mhtmlContent
    } catch (error) {
      this.logger.error("Failed to capture MHTML snapshot", error as Error)
      throw error
    }
  }

  /**
   * Extract page information without capturing using comprehensive dependency detection
   *
   * @returns Promise resolving to page information
   */
  private async extractPageInfo(): Promise<{
    title: string
    url: string
    resources: string[]
  }> {
    try {
      // Get basic page information
      const basicResult = await this.cdpClient!.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            return {
              title: document.title || '',
              url: window.location.href || '',
              html: document.documentElement.outerHTML
            };
          })()
        `,
        returnByValue: true,
      })

      if (!basicResult.success || !basicResult.result.result?.value) {
        throw new Error("Failed to get basic page information")
      }

      const pageInfo = basicResult.result.result.value
      const { title, url, html } = pageInfo

      // Use dependency detector to find all external resources
      const dependencies = this.dependencyDetector.detectExternalDependencies(html, url)

      // Extract just the URLs
      const resources = dependencies.map(dep => dep.url)

      this.logger.debug("Page information extracted", {
        title,
        url,
        resourceCount: resources.length,
        dependencyTypes: Array.from(new Set(dependencies.map(dep => dep.type))),
      })

      return { title, url, resources }
    } catch (error) {
      this.logger.error("Failed to extract page information", error as Error)
      throw error
    }
  }

  /**
   * Cleanup CDP connection
   */
  private async cleanupConnection(): Promise<void> {
    if (this.cdpClient && this.isConnected) {
      try {
        await this.cdpClient.close()
        this.isConnected = false
        this.logger.debug("CDP connection cleaned up")
      } catch (error) {
        this.logger.error("Failed to cleanup CDP connection", error as Error)
      }
    }
  }

  /**
   * Process and optimize MHTML content
   *
   * @param mhtmlContent - Raw MHTML content
   * @param options - Processing options
   * @returns Processed MHTML content
   */
  private processMHTMLContent(
    mhtmlContent: string,
    options: MHTMLOptions = {},
  ): string {
    let processedContent = mhtmlContent

    try {
      // Add metadata if requested
      if (options.includeMetadata) {
        processedContent = this.addMetadata(processedContent)
      }

      // Apply compression if requested
      if (options.compression) {
        processedContent = this.applyCompression(processedContent)
      }

      this.logger.debug("MHTML content processed", {
        originalLength: mhtmlContent.length,
        processedLength: processedContent.length,
      })

      return processedContent
    } catch (error) {
      this.logger.error("Failed to process MHTML content", error as Error)
      return mhtmlContent // Return original content if processing fails
    }
  }

  /**
   * Add metadata to MHTML content
   *
   * @param mhtmlContent - MHTML content
   * @returns MHTML content with added metadata
   */
  private addMetadata(mhtmlContent: string): string {
    const metadata = `From: <converter@localhost>
Subject: MHTML Archive
Date: ${new Date().toUTCString()}
MHTML-Version: 1.0

`

    // Insert metadata after the initial MHTML headers
    const lines = mhtmlContent.split("\n")
    const insertIndex = lines.findIndex(line => line.trim() === "") + 1

    if (insertIndex > 0) {
      lines.splice(insertIndex, 0, metadata.trim())
      return lines.join("\n")
    }

    return mhtmlContent
  }

  /**
   * Apply compression to MHTML content
   *
   * @param mhtmlContent - MHTML content
   * @returns Compressed MHTML content
   */
  private applyCompression(mhtmlContent: string): string {
    // Simple compression by removing excessive whitespace
    return mhtmlContent
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim()
  }
}
