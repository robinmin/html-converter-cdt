/**
 * Public API Type Definitions
 *
 * This file contains comprehensive TypeScript type definitions for the HTML Converter CDT public API.
 * These types provide a clean, user-friendly interface while maintaining type safety and
 * comprehensive configuration options.
 */

import type { Buffer } from "node:buffer"

import type { ConversionResult, ValidationResult } from "../architecture/strategies/types.js"
import type { ConversionError } from "../core/errors/conversion-error.js"

// Re-export ValidationResult for public API
export type { ValidationResult } from "../architecture/strategies/types.js"

/**
 * Supported conversion formats
 */
export type ConversionFormat
  = | "mhtml"
    | "pdf"
    | "png"
    | "jpeg"
    | "markdown"
    | "docx"

/**
 * Input types for conversion
 */
export type ConversionInput
  = | string // URL or file path
    | Buffer // Raw HTML content
    | ArrayBuffer // Binary content
    | HTMLDocument // DOM document

/**
 * Base conversion options common to all formats
 */
export interface BaseConversionOptions {
  /** Timeout for conversion in milliseconds (default: 30000) */
  timeout?: number
  /** Whether to include metadata in the result (default: true) */
  includeMetadata?: boolean
  /** Custom headers for URL-based conversions */
  headers?: Record<string, string>
  /** Authentication credentials for URL-based conversions */
  auth?: {
    username?: string
    password?: string
    token?: string
  }
  /** Wait time after page load in milliseconds (default: 1000) */
  waitTime?: number
  /** Viewport dimensions for rendering */
  viewport?: {
    width: number
    height: number
    deviceScaleFactor?: number
  }
  /** User agent string to use for conversion */
  userAgent?: string
  /** Whether to emulate mobile device */
  emulateMobile?: boolean
  /** Custom CSS to inject before conversion */
  customCSS?: string
  /** Custom JavaScript to execute before conversion */
  customJS?: string
}

/**
 * MHTML-specific conversion options
 */
export interface MHTMLOptions extends BaseConversionOptions {
  /** Whether to include binary resources inline (default: true) */
  inlineResources?: boolean
  /** Maximum size for inline resources in bytes (default: 1MB) */
  maxInlineResourceSize?: number
  /** Whether to preserve cross-origin resources (default: false) */
  preserveCrossOrigin?: boolean
}

/**
 * PDF-specific conversion options
 */
export interface PDFOptions extends BaseConversionOptions {
  /** Page format (default: A4) */
  format?: "A3" | "A4" | "A5" | "Legal" | "Letter" | "Tabloid"
  /** Page orientation (default: portrait) */
  orientation?: "portrait" | "landscape"
  /** Page margins in inches (default: 0.4) */
  margin?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  } | number
  /** Whether to print background graphics (default: true) */
  printBackground?: boolean
  /** Whether to include page numbers (default: false) */
  displayHeaderFooter?: boolean
  /** Header template for PDF */
  headerTemplate?: string
  /** Footer template for PDF */
  footerTemplate?: string
  /** Paper ranges to print (e.g., "1-5,8,11-13") */
  pageRanges?: string
  /** Scale factor for content (default: 1.0) */
  scale?: number
  /** Whether to prefer CSS page size over specified size (default: false) */
  preferCSSPageSize?: boolean
}

/**
 * Image-specific conversion options (PNG/JPEG)
 */
export interface ImageOptions extends BaseConversionOptions {
  /** Image quality for JPEG (0-100, default: 80) */
  quality?: number
  /** Whether to capture full page screenshot (default: true) */
  fullPage?: boolean
  /** Clip area to capture */
  clip?: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Whether to omit background (default: false) */
  omitBackground?: boolean
  /** Output image dimensions */
  dimensions?: {
    width?: number
    height?: number
  }
}

/**
 * Markdown-specific conversion options
 */
export interface MarkdownOptions extends BaseConversionOptions {
  /** Whether to preserve HTML comments (default: false) */
  preserveComments?: boolean
  /** Whether to preserve inline styles (default: false) */
  preserveStyles?: boolean
  /** Maximum line length for text wrapping (default: 80) */
  maxLineLength?: number
  /** Whether to include metadata as frontmatter (default: true) */
  includeFrontmatter?: boolean
  /** Custom rules for HTML to Markdown conversion */
  customRules?: Array<{
    selector: string
    replacement: string
  }>
}

/**
 * DOCX-specific conversion options
 */
export interface DOCXOptions extends BaseConversionOptions {
  /** Page orientation (default: portrait) */
  orientation?: "portrait" | "landscape"
  /** Page size (default: A4) */
  pageSize?: "A3" | "A4" | "A5" | "Letter" | "Legal"
  /** Page margins in inches (default: 1) */
  margins?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  } | number
  /** Default font family (default: "Calibri") */
  fontFamily?: string
  /** Default font size (default: 11) */
  fontSize?: number
  /** Whether to include images (default: true) */
  includeImages?: boolean
  /** Whether to include tables (default: true) */
  includeTables?: boolean
  /** Whether to preserve hyperlinks (default: true) */
  preserveLinks?: boolean
}

/**
 * Union type for all format-specific options
 */
export type ConversionOptions
  = | MHTMLOptions
    | PDFOptions
    | ImageOptions
    | MarkdownOptions
    | DOCXOptions

/**
 * Enhanced conversion result with additional metadata
 */
export interface EnhancedConversionResult extends ConversionResult {
  /** The format that was converted to */
  format: ConversionFormat
  /** File name suggestion for the result */
  suggestedFileName: string
  /** Whether the conversion used fallback methods */
  usedFallback: boolean
  /** The tier that was used for conversion */
  conversionTier: "chrome-cdp" | "canvas" | "server-side" | "basic-html"
  /** Performance metrics */
  performance: {
    /** Conversion time in milliseconds */
    conversionTime: number
    /** Memory usage during conversion in bytes */
    memoryUsage: number
    /** Number of resources processed */
    resourcesProcessed: number
  }
  /** Validation warnings if any */
  validationWarnings?: string[]
}

/**
 * Batch conversion item
 */
export interface BatchConversionItem {
  /** Unique identifier for this item */
  id: string
  /** Input source (URL, file path, or content) */
  input: ConversionInput
  /** Target format */
  format: ConversionFormat
  /** Format-specific options */
  options?: ConversionOptions
  /** Output file path (optional) */
  outputPath?: string
}

/**
 * Batch conversion options
 */
export interface BatchConversionOptions {
  /** Maximum number of concurrent conversions */
  maxConcurrency?: number
  /** Whether to continue processing if one conversion fails */
  continueOnError?: boolean
  /** Progress callback function */
  onProgress?: (progress: ConversionProgress) => void
}

/**
 * Batch conversion result
 */
export interface BatchConversionResult {
  /** Results for each item in the batch */
  results: Array<{
    /** Item ID */
    id: string
    /** Conversion result or error */
    result: EnhancedConversionResult | ConversionError
    /** Whether conversion was successful */
    success: boolean
  }>
  /** Overall batch statistics */
  statistics: {
    /** Total number of items */
    total: number
    /** Number of successful conversions */
    successful: number
    /** Number of failed conversions */
    failed: number
    /** Total time for all conversions */
    totalTime: number
    /** Average conversion time */
    averageTime: number
  }
}

/**
 * Progress information for long-running conversions
 */
export interface ConversionProgress {
  /** Progress percentage (0-100) */
  percentage: number
  /** Current progress message */
  message: string
  /** Current step being executed */
  currentStep: string
  /** Total number of steps */
  totalSteps: number
  /** Current step number (1-based) */
  currentStepNumber: number
  /** Estimated remaining time in milliseconds */
  estimatedTimeRemaining?: number
}

/**
 * Configuration for the HTML Converter
 */
export interface HTMLConverterConfig {
  /** Default timeout for all conversions (default: 30000) */
  defaultTimeout?: number
  /** Maximum concurrent conversions (default: 3) */
  maxConcurrentConversions?: number
  /** Whether to enable performance monitoring (default: true) */
  enablePerformanceMonitoring?: boolean
  /** Whether to enable progressive enhancement (default: true) */
  enableProgressiveEnhancement?: boolean
  /** Custom user agent string */
  userAgent?: string
  /** Default viewport settings */
  defaultViewport?: {
    width: number
    height: number
    deviceScaleFactor?: number
  }
  /** Server-side fallback configuration */
  serverSideFallback?: {
    enabled: boolean
    endpoints: string[]
    timeout: number
    retryAttempts: number
  }
  /** Chrome CDP configuration */
  chromeCDP?: {
    enabled: boolean
    headless: boolean
    chromeArgs?: string[]
  }
}

/**
 * Event types emitted by the converter
 */
export type ConverterEventType
  = | "conversion-start"
    | "conversion-progress"
    | "conversion-complete"
    | "conversion-error"
    | "batch-start"
    | "batch-progress"
    | "batch-complete"

/**
 * Converter event data
 */
export interface ConverterEvent<T = any> {
  /** Event type */
  type: ConverterEventType
  /** Event timestamp */
  timestamp: Date
  /** Event-specific data */
  data: T
  /** Unique conversion ID if applicable */
  conversionId?: string
  /** Batch ID if applicable */
  batchId?: string
}

/**
 * Progress event data
 */
export interface ProgressEventData {
  progress: ConversionProgress
}

/**
 * Conversion complete event data
 */
export interface ConversionCompleteEventData {
  result: EnhancedConversionResult
  conversionId: string
}

/**
 * Conversion error event data
 */
export interface ConversionErrorEventData {
  error: ConversionError
  conversionId: string
}

/**
 * Batch complete event data
 */
export interface BatchCompleteEventData {
  result: BatchConversionResult
  batchId: string
}

/**
 * Event listener function type
 */
export type EventListener<T = any> = (event: ConverterEvent<T>) => void

/**
 * Main HTML Converter interface
 */
export interface IHTMLConverter {
  /**
   * Convert HTML to specified format
   * @param input - Input source (URL, file path, or content)
   * @param format - Target format
   * @param options - Format-specific conversion options
   * @returns Promise resolving to conversion result
   */
  convert<T extends ConversionFormat>(
    input: ConversionInput,
    format: T,
    options?: ConversionOptions
  ): Promise<EnhancedConversionResult>

  /**
   * Validate input before conversion
   * @param input - Input to validate
   * @param format - Target format
   * @returns Validation result
   */
  validate(input: ConversionInput, format: ConversionFormat): Promise<ValidationResult>

  /**
   * Convert multiple items in batch
   * @param items - Array of conversion items
   * @param options - Batch options
   * @param options.maxConcurrency - Maximum number of concurrent conversions
   * @param options.continueOnError - Whether to continue processing if one conversion fails
   * @param options.onProgress - Progress callback function
   * @returns Promise resolving to batch result
   */
  convertBatch(
    items: BatchConversionItem[],
    options?: {
      maxConcurrency?: number
      continueOnError?: boolean
      onProgress?: (progress: ConversionProgress) => void
    }
  ): Promise<BatchConversionResult>

  /**
   * Add event listener for converter events
   * @param eventType - Event type to listen for
   * @param listener - Event listener function
   */
  on<T = any>(eventType: ConverterEventType, listener: EventListener<T>): void

  /**
   * Remove event listener
   * @param eventType - Event type
   * @param listener - Event listener function
   */
  off<T = any>(eventType: ConverterEventType, listener: EventListener<T>): void

  /**
   * Get supported formats
   * @returns Array of supported formats
   */
  getSupportedFormats(): ConversionFormat[]

  /**
   * Check if format is supported
   * @param format - Format to check
   * @returns Whether format is supported
   */
  isFormatSupported(format: ConversionFormat): boolean

  /**
   * Get current configuration
   * @returns Current converter configuration
   */
  getConfig(): HTMLConverterConfig

  /**
   * Update configuration
   * @param config - New configuration options
   */
  updateConfig(config: Partial<HTMLConverterConfig>): void

  /**
   * Get conversion statistics
   * @returns Performance and usage statistics
   */
  getStatistics(): {
    totalConversions: number
    successfulConversions: number
    failedConversions: number
    averageConversionTime: number
    formatUsage: Record<ConversionFormat, number>
    tierUsage: Record<string, number>
  }

  /**
   * Cancel ongoing conversion
   * @param conversionId - ID of conversion to cancel
   */
  cancelConversion(conversionId: string): void

  /**
   * Cancel all ongoing conversions
   */
  cancelAllConversions(): void

  /**
   * Dispose of converter resources
   */
  dispose(): void
}

/**
 * Factory options for creating converter instances
 */
export interface HTMLConverterFactoryOptions {
  /** Custom configuration */
  config?: HTMLConverterConfig
  /** Whether to enable auto-discovery of capabilities */
  enableAutoDiscovery?: boolean
  /** Custom logger implementation */
  logger?: {
    debug(message: string, ...args: any[]): void
    info(message: string, ...args: any[]): void
    warn(message: string, ...args: any[]): void
    error(message: string, error?: Error, ...args: any[]): void
  }
}
