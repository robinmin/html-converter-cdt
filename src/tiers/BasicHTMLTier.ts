import type { ConversionResult, ConverterStrategy, Logger, ValidationResult } from "../architecture/strategies/types"

/**
 * Basic HTML Tier configuration options
 */
export interface BasicHTMLTierConfig {
  /** Whether to inline CSS styles */
  inlineStyles?: boolean
  /** Whether to include JavaScript */
  includeJavaScript?: boolean
  /** Whether to compress HTML output */
  compressHTML?: boolean
  /** Whether to add HTML comments for metadata */
  includeMetadata?: boolean
  /** Custom CSS to add to the document */
  customCSS?: string
  /** Maximum file size for export (bytes) */
  maxFileSize?: number
}

/**
 * Basic HTML Tier - Tier 4 Progressive Enhancement Implementation
 *
 * Provides basic HTML export functionality using native DOM manipulation
 * and file download APIs as the ultimate fallback when all other tiers are unavailable.
 */
export class BasicHTMLTier implements ConverterStrategy {
  private logger: Logger
  private config: Required<BasicHTMLTierConfig>

  constructor(logger: Logger, config: BasicHTMLTierConfig = {}) {
    this.logger = logger

    // Default configuration
    this.config = {
      inlineStyles: true,
      includeJavaScript: false, // Security: default to excluding JS
      compressHTML: false,
      includeMetadata: true,
      customCSS: "",
      maxFileSize: 10 * 1024 * 1024, // 10MB
      ...config,
    }

    this.logger.info("Basic HTML Tier initialized", {
      inlineStyles: this.config.inlineStyles,
      includeJavaScript: this.config.includeJavaScript,
      compressHTML: this.config.compressHTML,
    })
  }

  /**
   * Convert HTML document to enhanced HTML format
   *
   * @param input - HTML document to convert
   * @returns Promise resolving to conversion result
   */
  async convert(input: HTMLDocument): Promise<ConversionResult> {
    const startTime = Date.now()

    this.logger.info("Starting Basic HTML conversion", {
      inlineStyles: this.config.inlineStyles,
      includeJavaScript: this.config.includeJavaScript,
    })

    try {
      // Get HTML content
      let htmlContent = this.serializeHTMLDocument(input)

      // Process content based on configuration
      if (this.config.inlineStyles) {
        htmlContent = await this.inlineStyles(input, htmlContent)
      }

      if (!this.config.includeJavaScript) {
        htmlContent = this.removeJavaScript(htmlContent)
      }

      if (this.config.customCSS) {
        htmlContent = this.addCustomCSS(htmlContent)
      }

      if (this.config.includeMetadata) {
        htmlContent = this.addMetadata(htmlContent)
      }

      if (this.config.compressHTML) {
        htmlContent = this.compressHTML(htmlContent)
      }

      // Validate final content size
      if (htmlContent.length > this.config.maxFileSize) {
        throw new Error(`HTML export exceeds maximum size: ${htmlContent.length} > ${this.config.maxFileSize}`)
      }

      const executionTime = Date.now() - startTime

      const result: ConversionResult = {
        content: htmlContent,
        mimeType: "text/html",
        metadata: {
          sourceType: "text/html",
          targetFormat: "html",
          timestamp: new Date(),
          size: htmlContent.length,
          executionTime,
          tier: 4,
          conversionMethod: "basic-html",
          inlinedStyles: this.config.inlineStyles,
          javascriptRemoved: !this.config.includeJavaScript,
          compressed: this.config.compressHTML,
        },
      }

      this.logger.info("Basic HTML conversion completed", {
        size: htmlContent.length,
        executionTime,
        inlinedStyles: this.config.inlineStyles,
      })

      return result
    } catch (error) {
      const executionTime = Date.now() - startTime

      this.logger.error("Basic HTML conversion failed", error as Error, {
        executionTime,
      })

      throw new Error(`Basic HTML conversion failed: ${(error as Error).message}`)
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
      if (htmlContent.includes("<script") && !this.config.includeJavaScript) {
        warnings.push("JavaScript detected - will be removed for security")
      }

      // Check for external resource dependencies
      const externalResources = this.getExternalResourceCount(htmlContent)
      if (externalResources > 10) {
        warnings.push(`High number of external resources (${externalResources}) - consider inlining for better portability`)
      }

      // Check for CSS complexity
      const cssComplexity = this.assessCSSComplexity(htmlContent)
      if (cssComplexity > 0.8 && this.config.inlineStyles) {
        warnings.push("Complex CSS detected - inlining may result in large file size")
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        context: {
          contentType: "text/html",
          size: htmlContent.length,
          externalResourceCount: externalResources,
          cssComplexity,
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
    return "Basic HTML Tier"
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
    return "text/html"
  }

  // Private helper methods

  /**
   * Serialize HTML document to string
   */
  private serializeHTMLDocument(document: HTMLDocument): string {
    // In a browser environment, we can use document.documentElement.outerHTML
    if (typeof document !== "undefined" && document.documentElement) {
      return document.documentElement.outerHTML
    }

    // In Node.js environment, we need to handle serialization differently
    if (typeof window === "undefined") {
      // Basic serialization for Node.js
      const docType = document.doctype ? `<!DOCTYPE ${document.doctype.name}>` : ""
      const htmlContent = document.body?.innerHTML || ""
      return `${docType}\n<html>\n<head>\n<title>${document.title || "Document"}</title>\n</head>\n<body>${htmlContent}</body>\n</html>`
    }

    throw new Error("Cannot serialize HTML document: unsupported environment")
  }

  /**
   * Inline CSS styles into the HTML document
   */
  private async inlineStyles(document: HTMLDocument, htmlContent: string): Promise<string> {
    try {
      // This is a simplified inlining implementation
      // In a real implementation, you would:
      // 1. Extract CSS from <style> tags and external stylesheets
      // 2. Parse CSS rules
      // 3. Apply rules to matching elements
      // 4. Inject inline styles into elements

      // For now, just move <style> content to inline styles on <head>
      let processedContent = htmlContent

      // Extract styles from <style> tags
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
      const styleMatches = []
      let match

      while (true) {
        match = styleRegex.exec(htmlContent)
        if (match === null) {
          break
        }
        styleMatches.push(match[1])
      }

      // If we found styles, add them as a comprehensive inline style
      if (styleMatches.length > 0) {
        const combinedStyles = styleMatches.join("\n")
        const inlineStyleTag = `<style type="text/css">\n${combinedStyles}\n</style>`

        // Replace existing style tags with our comprehensive one
        processedContent = processedContent.replace(styleRegex, "")

        // Add the comprehensive style tag to the head
        processedContent = processedContent.replace(
          /<head([^>]*)>/i,
          `<head$1>\n${inlineStyleTag}`,
        )
      }

      return processedContent
    } catch (error) {
      this.logger.warn("CSS inlining failed, using original HTML", error)
      return htmlContent
    }
  }

  /**
   * Remove JavaScript from HTML content
   */
  private removeJavaScript(htmlContent: string): string {
    try {
      // Remove <script> tags and their content
      let processedContent = htmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")

      // Remove event handlers from HTML elements
      const eventHandlers = [
        "onload",
        "onunload",
        "onclick",
        "ondblclick",
        "onmousedown",
        "onmouseup",
        "onmouseover",
        "onmousemove",
        "onmouseout",
        "onfocus",
        "onblur",
        "onchange",
        "onsubmit",
        "onreset",
        "onselect",
        "onkeydown",
        "onkeypress",
        "onkeyup",
      ]

      eventHandlers.forEach((handler) => {
        const regex = new RegExp(`\\s${handler}\\s*=\\s*["'][^"']*["']`, "gi")
        processedContent = processedContent.replace(regex, "")
      })

      // Remove javascript: URLs
      processedContent = processedContent.replace(/javascript:/gi, "")

      return processedContent
    } catch (error) {
      this.logger.warn("JavaScript removal failed, using original HTML", error)
      return htmlContent
    }
  }

  /**
   * Add custom CSS to the HTML document
   */
  private addCustomCSS(htmlContent: string): string {
    try {
      const customStyleTag = `<style type="text/css">\n${this.config.customCSS}\n</style>`

      // Insert custom CSS into the head, after existing styles
      return htmlContent.replace(
        /<\/head>/i,
        `${customStyleTag}\n</head>`,
      )
    } catch (error) {
      this.logger.warn("Custom CSS addition failed", error)
      return htmlContent
    }
  }

  /**
   * Add metadata comments to the HTML document
   */
  private addMetadata(htmlContent: string): string {
    try {
      const timestamp = new Date().toISOString()
      const metadata = [
        `<!-- Basic HTML Export - Generated at ${timestamp} -->`,
        `<!-- Export Method: Basic HTML Tier (Progressive Enhancement Tier 4) -->`,
        `<!-- Features: Styles Inlined: ${this.config.inlineStyles}, JavaScript Removed: ${!this.config.includeJavaScript} -->`,
      ]

      // Add metadata at the beginning of the document
      const metadataHTML = metadata.join("\n") + "\n"

      if (htmlContent.startsWith("<!DOCTYPE")) {
        return htmlContent.replace(/(<!DOCTYPE[^>]*>\n?)/i, `$1${metadataHTML}`)
      } else {
        return metadataHTML + htmlContent
      }
    } catch (error) {
      this.logger.warn("Metadata addition failed", error)
      return htmlContent
    }
  }

  /**
   * Compress HTML by removing unnecessary whitespace
   */
  private compressHTML(htmlContent: string): string {
    try {
      return htmlContent
        // Remove comments (except our metadata comments)
        .replace(/<!--(?!\s*Basic HTML Export)[\s\S]*?-->/g, "")
        // Remove whitespace between tags
        .replace(/>\s+</g, "><")
        // Remove multiple spaces
        .replace(/\s+/g, " ")
        // Remove leading/trailing whitespace
        .trim()
    } catch (error) {
      this.logger.warn("HTML compression failed, using original HTML", error)
      return htmlContent
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
   * Assess CSS complexity (0-1 scale)
   */
  private assessCSSComplexity(htmlContent: string): number {
    try {
      // Extract CSS content
      const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
      let cssContent = ""
      let match

      while (true) {
        match = styleRegex.exec(htmlContent)
        if (match === null) {
          break
        }
        cssContent += match[1] + "\n"
      }

      if (!cssContent) {
        return 0
      }

      // Simple complexity assessment based on various factors
      const complexityFactors = {
        selectors: (cssContent.match(/[.#]?[\w-]+[\s>+~,[]*\{/g) || []).length,
        properties: (cssContent.match(/[\w-]+:[^;]+;/g) || []).length,
        mediaQueries: (cssContent.match(/@media[^{]*\{/g) || []).length,
        keyframes: (cssContent.match(/@keyframes[^{]*\{/g) || []).length,
        imports: (cssContent.match(/@import[^;]+;/g) || []).length,
      }

      // Calculate complexity score
      const totalFactors = Object.values(complexityFactors).reduce((sum, count) => sum + count, 0)

      // Normalize to 0-1 scale (50+ factors = high complexity)
      return Math.min(1, totalFactors / 50)
    } catch {
      return 0
    }
  }

  /**
   * Estimate conversion time based on content size and complexity
   */
  private estimateConversionTime(contentSize: number, _externalResources: number): number {
    // Base time for basic HTML processing
    let baseTime = 100 // 100ms base time

    // Add time for content processing (0.1ms per KB)
    baseTime += Math.ceil(contentSize / 10240)

    // Add time for CSS inlining if enabled
    if (this.config.inlineStyles) {
      baseTime += 500 // 500ms for CSS processing
    }

    // Add time for JavaScript removal
    if (!this.config.includeJavaScript) {
      baseTime += 200 // 200ms for JS removal
    }

    return baseTime
  }
}
