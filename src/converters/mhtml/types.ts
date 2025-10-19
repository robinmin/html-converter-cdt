/**
 * MHTML converter specific types and interfaces
 */

/**
 * MHTML conversion options
 */
export interface MHTMLOptions {
  /** Whether to keep external resources or embed them */
  keepResources?: boolean
  /** Enable compression for the output */
  compression?: boolean
  /** Include document metadata in headers */
  includeMetadata?: boolean
  /** Capture screenshots of the page */
  captureScreenshot?: boolean
  /** Wait time before capture (milliseconds) */
  waitTime?: number
  /** Page dimensions for capture */
  viewport?: {
    width: number
    height: number
  }
  /** Custom user agent for page capture */
  userAgent?: string
  /** Timeout for page operations (milliseconds) */
  timeout?: number
}

/**
 * External resource information
 */
export interface ExternalResource {
  /** Original URL from HTML */
  originalUrl: string
  /** Resolved absolute URL */
  resolvedUrl: string
  /** Resource type */
  type: "image" | "stylesheet" | "script" | "iframe" | "link" | "font"
  /** Content type */
  contentType: string
  /** Whether the resource was successfully fetched */
  fetched: boolean
  /** Resource content (base64 encoded) */
  content?: string
  /** Content encoding */
  encoding?: "base64" | "quoted-printable"
  /** File size in bytes */
  size?: number
  /** Error message if fetching failed */
  error?: string
}

/**
 * MHTML metadata
 */
export interface MHTMLMetadata {
  /** Page title */
  title?: string
  /** Page URL */
  url?: string
  /** Capture date */
  captureDate: Date
  /** Number of external resources found */
  resourceCount: number
  /** Number of successfully fetched resources */
  fetchedCount: number
  /** Total size of all resources */
  totalSize: number
  /** Chrome version used for capture */
  chromeVersion?: string
  /** Viewport dimensions used */
  viewport?: {
    width: number
    height: number
  }
}

/**
 * MHTML conversion result with additional MHTML-specific metadata
 */
export interface MHTMLConversionResult {
  /** The converted content */
  content: string
  /** The MIME type of the converted content */
  mimeType: string
  /** The format that was converted to */
  format: string
  /** Metadata about the conversion */
  metadata: {
    /** Original content type */
    sourceType: string
    /** Target format */
    targetFormat: string
    /** Conversion timestamp */
    timestamp: Date
    /** File size in bytes */
    size: number
    /** Page title */
    title?: string
    /** Page URL */
    url?: string
    /** Capture date */
    captureDate: Date
    /** Number of external resources found */
    resourceCount: number
    /** Number of successfully fetched resources */
    fetchedCount: number
    /** Total size of all resources */
    totalSize: number
    /** Chrome version used for capture */
    chromeVersion?: string
    /** Viewport dimensions used */
    viewport?: {
      width: number
      height: number
    }
  }
  /** List of external resources */
  externalResources: ExternalResource[]
  /** MHTML boundary used in the output */
  boundary: string
  /** Performance metrics */
  performance: {
    conversionTime: number
  }
}

/**
 * Resource fetcher interface for external resource handling
 */
export interface IResourceFetcher {
  /**
   * Fetch a single external resource
   * @param url - Resource URL to fetch
   * @returns Promise resolving to resource information
   */
  fetchResource(url: string): Promise<ExternalResource>

  /**
   * Fetch multiple resources in parallel
   * @param urls - Array of resource URLs to fetch
   * @returns Promise resolving to array of resource information
   */
  fetchResources(urls: string[]): Promise<ExternalResource[]>
}

/**
 * MHTML builder interface for constructing MHTML content
 */
export interface IMHTMLBuilder {
  /**
   * Build MHTML content from document and resources
   * @param document - HTML document content
   * @param resources - External resources to include
   * @param boundary - MIME boundary string
   * @returns MHTML content string
   */
  build(document: string, resources: ExternalResource[], boundary: string): string

  /**
   * Generate a unique MIME boundary
   * @returns Boundary string
   */
  generateBoundary(): string

  /**
   * Encode content for MHTML format
   * @param content - Raw content to encode
   * @param contentType - MIME type of the content
   * @returns Encoded content string
   */
  encodeContent(content: string, contentType: string): string
}

/**
 * CDP capture interface for Chrome DevTools Protocol integration
 */
export interface ICDPCapture {
  /**
   * Navigate to a URL and capture page as MHTML
   * @param url - URL to navigate and capture
   * @param options - Capture options
   * @returns Promise resolving to MHTML content
   */
  capturePageAsMHTML(url: string, options?: MHTMLOptions): Promise<string>

  /**
   * Get page information
   * @param url - URL to get information for
   * @returns Promise resolving to page metadata
   */
  getPageInfo(url: string): Promise<{
    title: string
    url: string
    resources: string[]
  }>
}
