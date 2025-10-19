/**
 * Main HTML Converter Implementation
 *
 * This module provides the main HTMLConverter class that implements the IHTMLConverter interface.
 * It serves as the primary entry point for all conversion operations and provides a unified API
 * for converting HTML documents to various formats.
 */

import { Buffer } from "node:buffer"

import { v4 as uuidv4 } from "uuid"

import type { ConversionError } from "../core/errors/conversion-error.js"
import { defaultErrorHandler } from "../core/errors/error-handler.js"
import { ProgressiveEnhancementManager } from "../core/ProgressiveEnhancementManager.js"
// Import tier implementations
import type {
  BatchCompleteEventData,
  BatchConversionItem,
  BatchConversionResult,
  ConversionCompleteEventData,
  ConversionErrorEventData,
  ConversionFormat,
  ConversionInput,
  ConversionOptions,
  ConversionProgress,
  ConverterEvent,
  ConverterEventType,
  EnhancedConversionResult,
  EventListener,
  HTMLConverterConfig,
  HTMLConverterFactoryOptions,
  IHTMLConverter,
  ProgressEventData,
  ValidationResult,
} from "../types/public-api.js"

/**
 * Main HTML Converter class implementing the IHTMLConverter interface
 *
 * This class provides a unified API for converting HTML documents to various formats
 * using progressive enhancement and multiple conversion strategies.
 *
 * @example
 * ```typescript
 * import { HTMLConverter } from 'html-converter-cdt'
 *
 * const converter = new HTMLConverter()
 *
 * // Convert to PDF
 * const pdfResult = await converter.convert('https://example.com', 'pdf', {
 *   format: 'A4',
 *   printBackground: true
 * })
 *
 * // Convert to MHTML
 * const mhtmlResult = await converter.convert('https://example.com', 'mhtml')
 *
 * // Batch conversion
 * const batchResult = await converter.convertBatch([
 *   { input: 'https://example1.com', format: 'pdf' },
 *   { input: 'https://example2.com', format: 'mhtml' }
 * ])
 *
 * converter.dispose()
 * ```
 */
export class HTMLConverter implements IHTMLConverter {
  private config: HTMLConverterConfig
  private progressiveEnhancementManager: ProgressiveEnhancementManager
  private eventListeners: Map<ConverterEventType, Set<EventListener>> = new Map()
  private activeConversions: Map<string, { cancel: () => void }> = new Map()
  private statistics = {
    totalConversions: 0,
    successfulConversions: 0,
    failedConversions: 0,
    totalConversionTime: 0,
    formatUsage: {} as Record<ConversionFormat, number>,
    tierUsage: {} as Record<string, number>,
  }

  constructor(options: HTMLConverterFactoryOptions = {}) {
    // Initialize configuration with defaults
    this.config = {
      defaultTimeout: 30000,
      maxConcurrentConversions: 3,
      enablePerformanceMonitoring: true,
      enableProgressiveEnhancement: true,
      userAgent: undefined,
      defaultViewport: {
        width: 1200,
        height: 800,
        deviceScaleFactor: 1,
      },
      serverSideFallback: {
        enabled: true,
        endpoints: [],
        timeout: 30000,
        retryAttempts: 3,
      },
      chromeCDP: {
        enabled: true,
        headless: true,
        chromeArgs: [],
      },
      ...options.config,
    }

    // Initialize progressive enhancement manager
    // TODO: Properly initialize with required dependencies
    this.progressiveEnhancementManager = new ProgressiveEnhancementManager(
      (options as any).logger as any,
      (options as any).capabilityDetector as any,
      (options as any).chromeManager as any,
    )

    // Initialize event listeners map
    this.initializeEventListeners()

    // Set up capabilities discovery if enabled
    if (options.enableAutoDiscovery !== false) {
      this.initializeCapabilities()
    }
  }

  /**
   * Convert HTML to specified format
   */
  async convert<T extends ConversionFormat>(
    input: ConversionInput,
    format: T,
    options: ConversionOptions = {},
  ): Promise<EnhancedConversionResult> {
    const conversionId = uuidv4()
    let cancelFn: () => void = () => {}

    try {
      // Emit conversion start event
      this.emitEvent("conversion-start", { conversionId })

      // Create cancellation function
      const cancelPromise = new Promise<never>((_, reject) => {
        cancelFn = () => reject(new Error("Conversion cancelled"))
      })
      this.activeConversions.set(conversionId, { cancel: cancelFn })

      // Start performance timing
      const startTime = performance.now()

      // Validate input
      await this.validate(input, format)

      // Merge options with defaults
      const mergedOptions = this.mergeOptions(options)

      // Get the appropriate conversion strategy
      const strategy = "progressive-enhancement"

      // Emit progress
      this.emitProgressEvent(conversionId, {
        percentage: 10,
        message: `Converting to ${format.toUpperCase()} using ${strategy}`,
        currentStep: "Strategy Selection",
        totalSteps: 4,
        currentStepNumber: 1,
      })

      // Perform conversion with race against cancellation
      const result = await Promise.race([
        this.performConversion(input, format, mergedOptions, conversionId),
        cancelPromise,
      ])

      // Calculate performance metrics
      const endTime = performance.now()
      const conversionTime = endTime - startTime

      // Create enhanced result
      const enhancedResult: EnhancedConversionResult = {
        ...result,
        format,
        suggestedFileName: this.generateFileName(input, format),
        usedFallback: false,
        conversionTier: strategy,
        performance: {
          conversionTime,
          memoryUsage: this.getMemoryUsage(),
          resourcesProcessed: this.getResourceCount(result),
        },
      }

      // Update statistics
      this.updateStatistics(format, strategy, conversionTime, true)

      // Emit completion event
      this.emitEvent("conversion-complete", {
        result: enhancedResult,
        conversionId,
      } as ConversionCompleteEventData)

      return enhancedResult
    } catch (error) {
      // Update statistics for failure
      this.updateStatistics(format, "unknown", 0, false)

      // Handle and normalize error
      const normalizedError = this.handleError(error, conversionId)

      // Emit error event
      this.emitEvent("conversion-error", {
        error: normalizedError,
        conversionId,
      } as ConversionErrorEventData)

      throw normalizedError
    } finally {
      // Clean up
      this.activeConversions.delete(conversionId)
    }
  }

  /**
   * Validate input before conversion
   */
  async validate(input: ConversionInput, format: ConversionFormat): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic input validation
    if (!input) {
      errors.push("Input is required")
    }

    // Format validation
    const supportedFormats = this.getSupportedFormats()
    if (!supportedFormats.includes(format)) {
      errors.push(`Unsupported format: ${format}. Supported formats: ${supportedFormats.join(", ")}`)
    }

    // URL validation
    if (typeof input === "string" && this.isURL(input)) {
      try {
        void new URL(input)
      } catch {
        errors.push("Invalid URL format")
      }
    }

    // Content size validation
    if (typeof input === "string" && !this.isURL(input)) {
      const size = Buffer.byteLength(input, "utf8")
      if (size > 50 * 1024 * 1024) { // 50MB
        warnings.push("Large content size detected, conversion may take longer")
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      context: {
        contentType: this.detectContentType(input),
        size: this.getInputSize(input),
      },
    }
  }

  /**
   * Convert multiple items in batch
   */
  async convertBatch(
    items: BatchConversionItem[],
    options: {
      maxConcurrency?: number
      continueOnError?: boolean
      onProgress?: (progress: ConversionProgress) => void
    } = {},
  ): Promise<BatchConversionResult> {
    const batchId = uuidv4()
    const startTime = performance.now()

    this.emitEvent("batch-start", { batchId })

    const {
      maxConcurrency = this.config.maxConcurrentConversions,
      continueOnError = true,
      onProgress,
    } = options

    const results: BatchConversionResult["results"] = []
    const semaphore = new Semaphore(maxConcurrency ?? 3)

    try {
      // Process items with controlled concurrency
      const promises = items.map(async (item, index) => {
        await semaphore.acquire()

        try {
          const result = await this.convert(item.input, item.format, item.options)

          results.push({
            id: item.id || `item-${index}`,
            result,
            success: true,
          })

          // Report progress
          if (onProgress) {
            onProgress({
              percentage: Math.round(((results.length) / items.length) * 100),
              message: `Completed ${results.length} of ${items.length} conversions`,
              currentStep: "Batch Processing",
              totalSteps: items.length,
              currentStepNumber: results.length,
            })
          }
        } catch (error) {
          const conversionError = error as ConversionError

          results.push({
            id: item.id || `item-${index}`,
            result: conversionError,
            success: false,
          })

          if (!continueOnError) {
            throw conversionError
          }
        } finally {
          semaphore.release()
        }
      })

      await Promise.all(promises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      const batchResult: BatchConversionResult = {
        results,
        statistics: {
          total: items.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          totalTime,
          averageTime: totalTime / items.length,
        },
      }

      this.emitEvent("batch-complete", { result: batchResult, batchId } as BatchCompleteEventData)

      return batchResult
    } catch (error) {
      this.emitEvent("error" as ConverterEventType, { batchId, error: error as Error } as any)
      throw error
    }
  }

  /**
   * Add event listener for converter events
   */
  on<T = any>(eventType: ConverterEventType, listener: EventListener<T>): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)!.add(listener)
  }

  /**
   * Remove event listener
   */
  off<T = any>(eventType: ConverterEventType, listener: EventListener<T>): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): ConversionFormat[] {
    return ["mhtml", "pdf", "png", "jpeg", "markdown", "docx"]
  }

  /**
   * Check if format is supported
   */
  isFormatSupported(format: ConversionFormat): boolean {
    return this.getSupportedFormats().includes(format)
  }

  /**
   * Get current configuration
   */
  getConfig(): HTMLConverterConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HTMLConverterConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get conversion statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      averageConversionTime: this.statistics.totalConversions > 0
        ? this.statistics.totalConversionTime / this.statistics.totalConversions
        : 0,
    }
  }

  /**
   * Cancel ongoing conversion
   */
  cancelConversion(conversionId: string): void {
    const conversion = this.activeConversions.get(conversionId)
    if (conversion) {
      conversion.cancel()
      this.activeConversions.delete(conversionId)
    }
  }

  /**
   * Cancel all ongoing conversions
   */
  cancelAllConversions(): void {
    for (const [_id, conversion] of this.activeConversions) {
      conversion.cancel()
    }
    this.activeConversions.clear()
  }

  /**
   * Dispose of converter resources
   */
  dispose(): void {
    // Cancel all ongoing conversions
    this.cancelAllConversions()

    // Clear event listeners
    this.eventListeners.clear()

    // Dispose of progressive enhancement manager
    if (this.progressiveEnhancementManager) {
      (this.progressiveEnhancementManager as any).dispose?.()
    }
  }

  // Private helper methods

  private initializeEventListeners(): void {
    const eventTypes: ConverterEventType[] = [
      "conversion-start",
      "conversion-progress",
      "conversion-complete",
      "conversion-error",
      "batch-start",
      "batch-progress",
      "batch-complete",
    ]

    for (const eventType of eventTypes) {
      this.eventListeners.set(eventType, new Set())
    }
  }

  private async initializeCapabilities(): Promise<void> {
    try {
      await (this.progressiveEnhancementManager as any).initializeCapabilities?.()
    } catch (error) {
      console.warn("Failed to initialize capabilities:", error)
    }
  }

  private mergeOptions(options: ConversionOptions): ConversionOptions {
    const defaults = {
      timeout: this.config.defaultTimeout,
      includeMetadata: true,
      waitTime: 1000,
      viewport: this.config.defaultViewport,
      userAgent: this.config.userAgent,
    }

    return { ...defaults, ...options }
  }

  private async performConversion(
    input: ConversionInput,
    format: ConversionFormat,
    options: ConversionOptions,
    conversionId: string,
  ): Promise<any> {
    // This would integrate with the actual conversion strategies
    // For now, we'll simulate the conversion process

    this.emitProgressEvent(conversionId, {
      percentage: 30,
      message: `Loading content...`,
      currentStep: "Content Loading",
      totalSteps: 4,
      currentStepNumber: 2,
    })

    // Simulate content loading
    await this.delay(100)

    this.emitProgressEvent(conversionId, {
      percentage: 60,
      message: `Converting to ${format.toUpperCase()}...`,
      currentStep: "Conversion",
      totalSteps: 4,
      currentStepNumber: 3,
    })

    // Simulate conversion
    await this.delay(200)

    this.emitProgressEvent(conversionId, {
      percentage: 90,
      message: `Finalizing ${format.toUpperCase()} output...`,
      currentStep: "Finalization",
      totalSteps: 4,
      currentStepNumber: 4,
    })

    // Simulate finalization
    await this.delay(100)

    // Return mock result
    return {
      content: format === "pdf" ? Buffer.from("mock-pdf-content") : "mock-content",
      mimeType: this.getMimeType(format),
      metadata: {
        sourceType: "text/html",
        targetFormat: format,
        timestamp: new Date(),
        size: 1000,
      },
    }
  }

  private emitEvent<T = any>(eventType: ConverterEventType, data: T): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      const event: ConverterEvent<T> = {
        type: eventType,
        timestamp: new Date(),
        data,
      }

      for (const listener of listeners) {
        try {
          listener(event)
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error)
        }
      }
    }
  }

  private emitProgressEvent(conversionId: string, progress: ConversionProgress): void {
    this.emitEvent("conversion-progress", { progress, conversionId } as ProgressEventData)
  }

  private handleError(error: any, _conversionId: string): ConversionError {
    return defaultErrorHandler.normalizeError(error, {
      operation: "convert",
      timestamp: new Date(),
    } as any)
  }

  private updateStatistics(
    format: ConversionFormat,
    tier: string,
    conversionTime: number,
    success: boolean,
  ): void {
    this.statistics.totalConversions++

    if (success) {
      this.statistics.successfulConversions++
      this.statistics.totalConversionTime += conversionTime
    } else {
      this.statistics.failedConversions++
    }

    this.statistics.formatUsage[format] = (this.statistics.formatUsage[format] || 0) + 1
    this.statistics.tierUsage[tier] = (this.statistics.tierUsage[tier] || 0) + 1
  }

  private generateFileName(input: ConversionInput, format: ConversionFormat): string {
    if (typeof input === "string" && this.isURL(input)) {
      try {
        const url = new URL(input)
        const hostname = url.hostname.replace(/[^a-z0-9]/gi, "_")
        return `${hostname}.${format}`
      } catch {
        // Fallback if URL parsing fails
      }
    }

    return `converted-document.${format}`
  }

  private isURL(str: string): boolean {
    try {
      void new URL(str)
      return true
    } catch {
      return false
    }
  }

  private detectContentType(input: ConversionInput): string {
    if (typeof input === "string") {
      if (this.isURL(input)) {
        return "text/html" // Assume HTML for URLs
      }
      if (input.trim().startsWith("<")) {
        return "text/html"
      }
    } else if (Buffer.isBuffer(input) || input instanceof ArrayBuffer) {
      return "application/octet-stream"
    } else if (input && input.nodeType === 9) { // Document node
      return "text/html"
    }

    return "unknown"
  }

  private getInputSize(input: ConversionInput): number {
    if (typeof input === "string") {
      return Buffer.byteLength(input, "utf8")
    } else if (Buffer.isBuffer(input)) {
      return input.length
    } else if (input instanceof ArrayBuffer) {
      return input.byteLength
    } else if (input && input.documentElement) {
      return new XMLSerializer().serializeToString(input.documentElement).length
    }

    return 0
  }

  private getMimeType(format: ConversionFormat): string {
    const mimeTypes: Record<ConversionFormat, string> = {
      mhtml: "multipart/related",
      pdf: "application/pdf",
      png: "image/png",
      jpeg: "image/jpeg",
      markdown: "text/markdown",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }

    return mimeTypes[format] || "application/octet-stream"
  }

  private getMemoryUsage(): number {
    // Simplified memory usage calculation
    if (typeof performance !== "undefined" && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  private getResourceCount(_result: any): number {
    // Simplified resource count calculation
    return 1
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Simple semaphore implementation for controlling concurrency
 */
class Semaphore {
  private permits: number
  private waitQueue: (() => void)[] = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve)
    })
  }

  release(): void {
    this.permits++
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!
      resolve()
      this.permits--
    }
  }
}
