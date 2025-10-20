/**
 * Streaming MHTML Processor - Handles large file processing with streaming architecture
 *
 * Provides streaming capabilities for large MHTML files with incremental resource
 * fetching, backpressure handling, and cancellation support for efficient processing
 * of large documents.
 */

import { Buffer } from "node:buffer"
import { Readable } from "node:stream"

import type { Logger } from "../../architecture/strategies/types.js"
import type { MHTMLOptions } from "../../converters/mhtml/types.js"
import type { ExternalDependency } from "../engine/mhtml-processor.js"

import { memoryManager } from "./memory-manager.js"

/**
 * Streaming configuration options
 */
export interface StreamingConfig {
  /** Chunk size for processing (bytes) */
  chunkSize?: number
  /** Maximum concurrent resource downloads */
  maxConcurrentResources?: number
  /** Timeout for individual resource downloads (ms) */
  resourceTimeout?: number
  /** Maximum memory usage for buffering (MB) */
  maxBufferMemory?: number
  /** Enable backpressure handling */
  enableBackpressure?: boolean
  /** Progress callback */
  onProgress?: (progress: StreamingProgress) => void
  /** Resource callback */
  onResourceProcessed?: (resource: ProcessedResource) => void
}

/**
 * Streaming progress information
 */
export interface StreamingProgress {
  /** Total bytes processed */
  totalBytes: number
  /** Bytes processed so far */
  processedBytes: number
  /** Number of resources found */
  totalResources: number
  /** Number of resources processed */
  processedResources: number
  /** Processing rate (bytes per second) */
  processingRate?: number
  /** Estimated remaining time (ms) */
  estimatedTimeRemaining?: number
  /** Current operation */
  currentOperation: "parsing" | "fetching" | "processing" | "completed"
  /** Memory usage statistics */
  memoryUsage?: {
    used: number
    total: number
    percentage: number
  }
}

/**
 * Processed resource information
 */
export interface ProcessedResource {
  /** Resource URL */
  url: string
  /** Resource type */
  type: string
  /** Resource size in bytes */
  size: number
  /** Processing time in ms */
  processingTime: number
  /** Whether resource was successfully processed */
  success: boolean
  /** Error if processing failed */
  error?: string
  /** Content hash for caching */
  contentHash?: string
}

/**
 * Parsed input for streaming processing
 */
export interface ParsedInput {
  /** Input URL or file path */
  url: string
  /** Base URL for resolving relative URLs */
  baseUrl?: string
  /** Initial HTML content */
  htmlContent?: string
  /** Detected external dependencies */
  dependencies?: ExternalDependency[]
  /** Input metadata */
  metadata?: Record<string, any>
}

/**
 * Conversion context for streaming operations
 */
export interface ConversionContext {
  /** Conversion options */
  options: MHTMLOptions
  /** Logger instance */
  logger: Logger
  /** User agent string */
  userAgent?: string
  /** Request headers */
  headers?: Record<string, string>
  /** Timeout settings */
  timeouts?: {
    connect: number
    request: number
    response: number
  }
}

/**
 * Resource fetch queue item
 */
interface ResourceQueueItem {
  resource: ExternalDependency
  priority: number
  retryCount: number
  abortController: AbortController
}

/**
 * Streaming MHTML Processor with incremental resource fetching
 */
export class StreamingMHTMLProcessor {
  private logger: Logger
  private config: Required<StreamingConfig>
  private isProcessing = false
  private isCancelled = false
  private startTime?: number
  private processedBytes = 0
  private totalBytes = 0
  private processedResources: ProcessedResource[] = []
  private resourceQueue: ResourceQueueItem[] = []
  private activeFetches = new Map<string, Promise<void>>()
  private progressUpdateInterval?: NodeJS.Timeout

  constructor(logger: Logger, config: StreamingConfig = {}) {
    this.logger = logger

    // Get optimal buffer size from memory manager
    const optimalChunkSize = memoryManager.getOptimalBufferSize()

    this.config = {
      chunkSize: Math.min(optimalChunkSize, 64 * 1024), // Max 64KB chunks
      maxConcurrentResources: 5,
      resourceTimeout: 30000,
      maxBufferMemory: 100, // 100MB default
      enableBackpressure: true,
      onProgress: () => {},
      onResourceProcessed: () => {},
      ...config,
    }

    // Adjust concurrent resources based on memory
    this.config.maxConcurrentResources = memoryManager.suggestConcurrencyLimit(
      this.config.maxConcurrentResources,
    )

    this.logger.info("Streaming MHTML processor initialized", {
      chunkSize: this.config.chunkSize,
      maxConcurrentResources: this.config.maxConcurrentResources,
      maxBufferMemory: this.config.maxBufferMemory,
    })
  }

  /**
   * Generate a readable stream for MHTML processing
   *
   * @param input - Parsed input information
   * @param context - Conversion context
   * @returns Promise resolving to readable stream
   */
  async generateStream(
    input: ParsedInput,
    context: ConversionContext,
  ): Promise<Readable> {
    if (this.isProcessing) {
      throw new Error("Processor is already running")
    }

    this.isProcessing = true
    this.isCancelled = false
    this.startTime = Date.now()
    this.processedBytes = 0
    this.processedResources = []

    this.logger.info("Starting streaming MHTML generation", {
      url: input.url,
      enableBackpressure: this.config.enableBackpressure,
    })

    try {
      // Start progress monitoring
      this.startProgressMonitoring()

      // Create readable stream
      const stream = new Readable({
        highWaterMark: this.config.chunkSize,
        read: async () => {
          // This will be called when the consumer is ready for more data
          await this.handleStreamRead(input, context, stream)
        },
      })

      // Handle stream errors
      stream.on("error", (error) => {
        this.logger.error("Stream error occurred", error)
        this.cleanup()
      })

      stream.on("end", () => {
        this.logger.info("Stream processing completed")
        this.cleanup()
      })

      return stream
    } catch (error) {
      this.cleanup()
      throw error
    }
  }

  /**
   * Cancel ongoing streaming operation
   */
  async cancel(): Promise<void> {
    if (!this.isProcessing) {
      return
    }

    this.logger.info("Cancelling streaming operation")
    this.isCancelled = true

    // Cancel all active resource fetches
    for (const [url, _fetchPromise] of this.activeFetches) {
      // Note: In a real implementation, you'd need to cancel the underlying fetch
      this.logger.debug(`Cancelling resource fetch for ${url}`)
    }

    // Clear resource queue
    this.resourceQueue = []

    this.cleanup()
  }

  /**
   * Handle stream read operation
   */
  private async handleStreamRead(
    input: ParsedInput,
    context: ConversionContext,
    stream: Readable,
  ): Promise<void> {
    if (this.isCancelled) {
      stream.push(null) // End stream
      return
    }

    try {
      // Generate MHTML content in chunks
      const chunk = await this.generateMHTMLChunk(input, context)

      if (chunk) {
        // Push chunk to stream
        const canPush = stream.push(chunk)

        // Handle backpressure
        if (!canPush && this.config.enableBackpressure) {
          this.logger.debug("Backpressure detected, waiting for drain")
          await new Promise<void>((resolve) => {
            stream.once("drain", resolve)
          })
        }

        this.processedBytes += chunk.length
      } else {
        // No more data, end stream
        stream.push(null)
      }
    } catch (error) {
      this.logger.error("Error generating MHTML chunk", error instanceof Error ? error : new Error(String(error)))
      stream.destroy(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Generate MHTML content in chunks
   */
  private async generateMHTMLChunk(
    input: ParsedInput,
    context: ConversionContext,
  ): Promise<Buffer | null> {
    // For this implementation, we'll generate the MHTML in stages:
    // 1. Headers
    // 2. HTML content
    // 3. Resources (streamed)

    if (!this.startTime) {
      // First chunk - MHTML headers
      return this.generateMHTMLHeaders(input)
    }

    const elapsed = Date.now() - this.startTime
    const phase = this.getCurrentProcessingPhase(elapsed)

    switch (phase) {
      case "parsing":
        return this.generateHTMLContentChunk(input, context)
      case "fetching":
        return await this.generateResourceChunk(input, context)
      case "completed":
        return null // Signal end of stream
      default:
        return null
    }
  }

  /**
   * Generate MHTML headers
   */
  private generateMHTMLHeaders(input: ParsedInput): Buffer {
    const headers = [
      "From: <converter@localhost>",
      `Subject: MHTML Archive: ${input.url}`,
      `Date: ${new Date().toUTCString()}`,
      "MHTML-Version: 1.0",
      "Content-Type: multipart/related;",
      `\tboundary="----=_NextPart_${Date.now()}"`,
      "",
      "This is a multi-part message in MIME format.",
      "",
    ].join("\r\n")

    this.logger.debug("Generated MHTML headers")
    return Buffer.from(headers, "utf-8")
  }

  /**
   * Generate HTML content chunk
   */
  private generateHTMLContentChunk(input: ParsedInput, _context: ConversionContext): Buffer | null {
    if (!input.htmlContent) {
      return null
    }

    // For simplicity, return all HTML content at once
    // In a real implementation, this would be chunked
    const boundary = `----=_NextPart_${Date.now()}`
    const htmlPart = [
      boundary,
      "Content-Type: text/html; charset=\"utf-8\"",
      "Content-Transfer-Encoding: quoted-printable",
      "Content-Location: " + input.url,
      "",
      input.htmlContent,
      "",
    ].join("\r\n")

    this.logger.debug("Generated HTML content chunk")
    return Buffer.from(htmlPart, "utf-8")
  }

  /**
   * Generate resource chunk
   */
  private async generateResourceChunk(
    input: ParsedInput,
    context: ConversionContext,
  ): Promise<Buffer | null> {
    // Initialize resource queue if not done yet
    if (this.resourceQueue.length === 0 && input.dependencies) {
      this.initializeResourceQueue(input.dependencies)
    }

    // Process next resource from queue
    if (this.resourceQueue.length > 0) {
      const resourceItem = this.resourceQueue.shift()!
      return await this.processResource(resourceItem, context)
    }

    // Wait for active fetches to complete
    if (this.activeFetches.size > 0) {
      await Promise.allSettled(Array.from(this.activeFetches.values()))
      return Buffer.from("\r\n", "utf-8") // Small separator
    }

    // No more resources
    return null
  }

  /**
   * Initialize resource processing queue
   */
  private initializeResourceQueue(dependencies: ExternalDependency[]): void {
    this.resourceQueue = dependencies.map((dep, _index) => ({
      resource: dep,
      priority: this.calculateResourcePriority(dep),
      retryCount: 0,
      abortController: new AbortController(),
    }))

    // Sort by priority (higher priority first)
    this.resourceQueue.sort((a, b) => b.priority - a.priority)

    this.totalBytes = dependencies.length * 1024 * 10 // Estimate 10KB per resource
    this.logger.info(`Resource queue initialized with ${dependencies.length} resources`)
  }

  /**
   * Calculate resource priority for processing order
   */
  private calculateResourcePriority(resource: ExternalDependency): number {
    let priority = 100 // Base priority

    // Prioritize critical resources
    switch (resource.type) {
      case "stylesheet":
        priority += 50
        break
      case "script":
        priority += 40
        break
      case "image":
        priority += 30
        break
      case "font":
        priority += 20
        break
      default:
        priority += 10
    }

    // Prioritize secure resources
    if (resource.isSecure) {
      priority += 10
    }

    // Penalize external resources (more likely to be slow)
    if (!resource.isRelative) {
      priority -= 20
    }

    return priority
  }

  /**
   * Process a single resource
   */
  private async processResource(
    resourceItem: ResourceQueueItem,
    context: ConversionContext,
  ): Promise<Buffer> {
    const startTime = Date.now()
    const { resource, abortController } = resourceItem

    this.logger.debug(`Processing resource: ${resource.url}`)

    try {
      // Check memory usage before processing
      if (!memoryManager.hasAvailableMemory(20)) { // 20MB per resource
        this.logger.warn("Low memory, triggering garbage collection")
        await memoryManager.triggerGarbageCollection()
      }

      // Fetch resource content
      const content = await this.fetchResourceContent(resource, context, abortController)

      const processingTime = Date.now() - startTime
      const size = content ? content.length : 0

      const processedResource: ProcessedResource = {
        url: resource.url,
        type: resource.type,
        size,
        processingTime,
        success: true,
      }

      this.processedResources.push(processedResource)
      this.config.onResourceProcessed(processedResource)

      // Generate MHTML part for this resource
      if (content) {
        return this.generateResourceMHTMLPart(resource, content)
      } else {
        return Buffer.from("", "utf-8")
      }
    } catch (error) {
      const processingTime = Date.now() - startTime
      const errorMessage = (error as Error).message

      this.logger.error(`Failed to process resource: ${resource.url}`, error as Error)

      const processedResource: ProcessedResource = {
        url: resource.url,
        type: resource.type,
        size: 0,
        processingTime,
        success: false,
        error: errorMessage,
      }

      this.processedResources.push(processedResource)
      this.config.onResourceProcessed(processedResource)

      // Return empty part for failed resource
      return Buffer.from("", "utf-8")
    }
  }

  /**
   * Fetch resource content with timeout and cancellation
   */
  private async fetchResourceContent(
    resource: ExternalDependency,
    context: ConversionContext,
    abortController: AbortController,
  ): Promise<Buffer | null> {
    // In a real implementation, this would use fetch or http module
    // For now, we'll simulate resource fetching
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Resource fetch timeout: ${resource.url}`))
      }, this.config.resourceTimeout)

      // Simulate fetch delay
      setTimeout(() => {
        clearTimeout(timeout)

        if (abortController.signal.aborted) {
          reject(new Error("Fetch aborted"))
          return
        }

        // Simulate successful fetch
        resolve(Buffer.from(`Simulated content for ${resource.url}`, "utf-8"))
      }, Math.random() * 1000 + 500) // 500-1500ms delay
    })
  }

  /**
   * Generate MHTML part for a resource
   */
  private generateResourceMHTMLPart(resource: ExternalDependency, content: Buffer): Buffer {
    const boundary = `----=_NextPart_${Date.now()}`
    const contentType = this.getContentTypeForResource(resource)
    const contentTransferEncoding = this.getContentTransferEncoding(content)

    const part = [
      boundary,
      `Content-Type: ${contentType}`,
      "Content-Transfer-Encoding: " + contentTransferEncoding,
      "Content-Location: " + resource.url,
      "",
      content.toString("base64"),
      "",
    ].join("\r\n")

    return Buffer.from(part, "utf-8")
  }

  /**
   * Get content type for a resource
   */
  private getContentTypeForResource(resource: ExternalDependency): string {
    const extension = this.getFileExtension(resource.url)

    const contentTypes: Record<string, string> = {
      css: "text/css",
      js: "application/javascript",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      eot: "application/vnd.ms-fontobject",
    }

    return contentTypes[extension] || "application/octet-stream"
  }

  /**
   * Get file extension from URL
   */
  private getFileExtension(url: string): string {
    const match = url.match(/\.([^.?#]+)(?:[?#]|$)/)
    return match?.[1]?.toLowerCase() ?? ""
  }

  /**
   * Get appropriate content transfer encoding
   */
  private getContentTransferEncoding(content: Buffer): string {
    // Use base64 for binary content, quoted-printable for text
    const isText = this.isTextContent(content)
    return isText ? "quoted-printable" : "base64"
  }

  /**
   * Check if content is likely text
   */
  private isTextContent(content: Buffer): boolean {
    // Simple heuristic: if most bytes are printable ASCII, consider it text
    let printableCount = 0
    const sample = Math.min(content.length, 1000)

    for (let i = 0; i < sample; i++) {
      const byte = content[i]!
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        printableCount++
      }
    }

    return (printableCount / sample) > 0.7
  }

  /**
   * Get current processing phase based on elapsed time
   */
  private getCurrentProcessingPhase(elapsed: number): "parsing" | "fetching" | "processing" | "completed" {
    // Simple time-based phase determination
    if (elapsed < 100) {
      return "parsing"
    }
    if (elapsed < 10000) {
      return "fetching"
    }
    return "completed"
  }

  /**
   * Start progress monitoring
   */
  private startProgressMonitoring(): void {
    this.progressUpdateInterval = setInterval(() => {
      const progress = this.getCurrentProgress()
      if (progress) {
        this.config.onProgress(progress)
      }
    }, 1000)
  }

  /**
   * Get current streaming progress
   */
  private getCurrentProgress(): StreamingProgress | null {
    if (!this.startTime) {
      return null
    }

    const elapsedMs = Date.now() - this.startTime
    const processingRate = elapsedMs > 0 ? (this.processedBytes / (elapsedMs / 1000)) : 0

    const totalResources = this.resourceQueue.length + this.processedResources.length
    const processedResources = this.processedResources.length

    let estimatedTimeRemaining: number | undefined
    if (processingRate > 0 && this.processedBytes < this.totalBytes) {
      const remainingBytes = this.totalBytes - this.processedBytes
      estimatedTimeRemaining = (remainingBytes / processingRate) * 1000
    }

    const memoryStats = memoryManager.getMemoryStats()
    const memoryUsage = memoryStats
      ? {
          used: memoryStats.used,
          total: memoryStats.total,
          percentage: memoryStats.percentage,
        }
      : undefined

    return {
      totalBytes: this.totalBytes,
      processedBytes: this.processedBytes,
      totalResources,
      processedResources,
      processingRate,
      estimatedTimeRemaining,
      currentOperation: this.getCurrentProcessingPhase(elapsedMs),
      memoryUsage,
    }
  }

  /**
   * Cleanup resources and stop monitoring
   */
  private cleanup(): void {
    this.isProcessing = false

    if (this.progressUpdateInterval) {
      clearInterval(this.progressUpdateInterval)
      this.progressUpdateInterval = undefined
    }

    // Clear active fetches
    this.activeFetches.clear()

    this.logger.debug("Streaming processor cleanup completed")
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.logger.info("Streaming processor configuration updated", {
      changes: Object.keys(newConfig),
    })
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<StreamingConfig> {
    return { ...this.config }
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    totalProcessed: number
    totalResources: number
    successfulResources: number
    failedResources: number
    averageProcessingTime: number
    totalDataSize: number
  } {
    const successful = this.processedResources.filter(r => r.success).length
    const failed = this.processedResources.length - successful
    const totalTime = this.processedResources.reduce((sum, r) => sum + r.processingTime, 0)
    const averageTime = this.processedResources.length > 0 ? totalTime / this.processedResources.length : 0
    const totalSize = this.processedResources.reduce((sum, r) => sum + r.size, 0)

    return {
      totalProcessed: this.processedBytes,
      totalResources: this.processedResources.length,
      successfulResources: successful,
      failedResources: failed,
      averageProcessingTime: averageTime,
      totalDataSize: totalSize,
    }
  }
}

/**
 * Utility function to create a streaming processor with sensible defaults
 */
export function createStreamingProcessor(
  logger: Logger,
  config: StreamingConfig = {},
): StreamingMHTMLProcessor {
  return new StreamingMHTMLProcessor(logger, config)
}
