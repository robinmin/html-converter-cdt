/**
 * Batch Converter - Handles concurrent conversion operations with progress tracking
 *
 * Provides batch conversion capabilities with configurable concurrency limits,
 * resource pool management, and error isolation for efficient processing
 * of multiple HTML to MHTML conversions.
 */

import type { Logger } from "../../architecture/strategies/types.js"
import type { MHTMLOptions } from "../../converters/mhtml/types.js"
import { memoryManager, withMemoryMonitoring } from "../performance/memory-manager.js"

/**
 * Batch conversion input item
 */
export interface BatchInput {
  /** Unique identifier for this conversion */
  id: string
  /** URL or file path to convert */
  input: string
  /** Output format (currently only 'mhtml' supported) */
  format: string
  /** Conversion options */
  options?: MHTMLOptions
  /** Optional metadata for this item */
  metadata?: Record<string, any>
}

/**
 * Batch conversion result
 */
export interface BatchResult {
  /** Unique identifier matching input */
  id: string
  /** Conversion success status */
  success: boolean
  /** Result data or error */
  data?: string
  /** Error information if failed */
  error?: {
    message: string
    code?: string
    details?: any
  }
  /** Processing metrics */
  metrics: {
    startTime: number
    endTime: number
    duration: number
    memoryUsage?: number
    resourceCount?: number
    outputSize?: number
  }
  /** Input metadata */
  metadata?: Record<string, any>
}

/**
 * Batch conversion progress information
 */
export interface BatchProgress {
  /** Total number of items in batch */
  total: number
  /** Number of completed items */
  completed: number
  /** Number of items currently processing */
  processing: number
  /** Number of failed items */
  failed: number
  /** Current concurrency level */
  concurrency: number
  /** Estimated remaining time (ms) */
  estimatedTimeRemaining?: number
  /** Overall progress percentage (0-100) */
  progressPercentage: number
  /** Processing rate (items per second) */
  processingRate?: number
  /** Memory usage statistics */
  memoryUsage?: {
    used: number
    total: number
    percentage: number
  }
}

/**
 * Batch conversion configuration
 */
export interface BatchConfig {
  /** Maximum concurrent conversions */
  concurrency?: number
  /** Delay between starting new conversions (ms) */
  startupDelay?: number
  /** Maximum memory usage for batch (MB) */
  memoryLimit?: number
  /** Whether to fail fast on first error */
  failFast?: boolean
  /** Maximum retry attempts per item */
  maxRetries?: number
  /** Delay between retries (ms) */
  retryDelay?: number
  /** Progress update callback */
  onProgress?: (progress: BatchProgress) => void
  /** Item completion callback */
  onItemComplete?: (result: BatchResult) => void
  /** Error callback */
  onError?: (error: Error, itemId: string) => void
}

/**
 * Batch Converter with configurable concurrency and progress tracking
 */
export class BatchConverter {
  private logger: Logger
  private config: Required<BatchConfig>
  private activeConversions = new Map<string, Promise<void>>()
  private completedResults: BatchResult[] = []
  private isProcessing = false
  private startTime?: number
  private progressUpdateInterval?: NodeJS.Timeout

  constructor(logger: Logger, config: BatchConfig = {}) {
    this.logger = logger

    // Get memory-aware concurrency limit
    const memoryAwareConcurrency = memoryManager.suggestConcurrencyLimit(
      config.concurrency || 5,
    )

    this.config = {
      concurrency: memoryAwareConcurrency,
      startupDelay: 100,
      memoryLimit: 500, // 500MB default
      failFast: false,
      maxRetries: 2,
      retryDelay: 1000,
      onProgress: () => {},
      onItemComplete: () => {},
      onError: () => {},
      ...config,
    }

    this.logger.info("Batch converter initialized", {
      concurrency: this.config.concurrency,
      memoryLimit: this.config.memoryLimit,
      failFast: this.config.failFast,
    })
  }

  /**
   * Convert multiple inputs in batch with concurrency control
   *
   * @param inputs - Array of batch inputs to convert
   * @param convertFunction - Function to perform individual conversion
   * @returns Promise resolving to array of batch results
   */
  async convertBatch<T = string>(
    inputs: BatchInput[],
    convertFunction: (input: string, options?: MHTMLOptions) => Promise<T>,
  ): Promise<BatchResult[]> {
    if (inputs.length === 0) {
      this.logger.warn("Empty batch provided")
      return []
    }

    if (this.isProcessing) {
      throw new Error("Batch converter is already processing")
    }

    this.isProcessing = true
    this.startTime = Date.now()
    this.completedResults = []
    this.activeConversions.clear()

    this.logger.info("Starting batch conversion", {
      totalItems: inputs.length,
      concurrency: this.config.concurrency,
      memoryLimit: this.config.memoryLimit,
    })

    try {
      // Start progress monitoring
      this.startProgressMonitoring(inputs.length)

      // Process items in batches with concurrency control
      await this.processBatch(inputs, convertFunction)

      // Wait for all active conversions to complete
      await this.waitForActiveConversions()

      // Stop progress monitoring
      this.stopProgressMonitoring()

      // Log final results
      this.logBatchResults()

      return [...this.completedResults]
    } finally {
      this.isProcessing = false
      this.activeConversions.clear()
      this.stopProgressMonitoring()
    }
  }

  /**
   * Get current batch progress
   */
  getCurrentProgress(): BatchProgress | null {
    if (!this.isProcessing || !this.startTime) {
      return null
    }

    const total = this.completedResults.length + this.activeConversions.size
    const completed = this.completedResults.length
    const processing = this.activeConversions.size
    const failed = this.completedResults.filter(r => !r.success).length
    const progressPercentage = total > 0 ? (completed / total) * 100 : 0

    // Calculate processing rate
    const elapsedMs = Date.now() - this.startTime
    const processingRate = elapsedMs > 0 ? (completed / (elapsedMs / 1000)) : 0

    // Estimate remaining time
    let estimatedTimeRemaining: number | undefined
    if (processingRate > 0 && processing > 0) {
      estimatedTimeRemaining = (processing / processingRate) * 1000
    }

    // Get memory usage
    const memoryStats = memoryManager.getMemoryStats()
    const memoryUsage = memoryStats
      ? {
          used: memoryStats.used,
          total: memoryStats.total,
          percentage: memoryStats.percentage,
        }
      : undefined

    return {
      total: this.completedResults.length + this.activeConversions.size,
      completed,
      processing,
      failed,
      concurrency: this.config.concurrency,
      estimatedTimeRemaining,
      progressPercentage,
      processingRate,
      memoryUsage,
    }
  }

  /**
   * Cancel ongoing batch processing
   */
  async cancel(): Promise<void> {
    if (!this.isProcessing) {
      return
    }

    this.logger.info("Cancelling batch conversion")

    // Cancel all active conversions
    const cancelPromises = Array.from(this.activeConversions.entries()).map(
      ([id, promise]) => {
        // Note: In a real implementation, you'd need to cancel the underlying operations
        this.logger.warn(`Cancelling conversion for item ${id}`)
        return promise.catch(() => {}) // Ignore errors during cancellation
      },
    )

    await Promise.allSettled(cancelPromises)
    this.activeConversions.clear()
    this.isProcessing = false
    this.stopProgressMonitoring()

    this.logger.info("Batch conversion cancelled")
  }

  /**
   * Process items in batches with concurrency control
   */
  private async processBatch<T>(
    inputs: BatchInput[],
    convertFunction: (input: string, options?: MHTMLOptions) => Promise<T>,
  ): Promise<void> {
    const { concurrency, startupDelay, memoryLimit, failFast } = this.config

    for (let i = 0; i < inputs.length; i += concurrency) {
      // Check memory usage before starting new batch
      if (memoryLimit && !memoryManager.hasAvailableMemory(memoryLimit)) {
        this.logger.warn(`Memory limit (${memoryLimit}MB) reached, waiting for completions`)
        await this.waitForActiveConversions()

        // Recheck after waiting
        if (!memoryManager.hasAvailableMemory(memoryLimit)) {
          throw new Error(`Insufficient memory for batch processing (limit: ${memoryLimit}MB)`)
        }
      }

      // Get current batch
      const batch = inputs.slice(i, i + concurrency)

      // Start conversions for this batch
      const batchPromises = batch.map(async (input) => {
        try {
          // Add small delay to prevent overwhelming resources
          if (startupDelay > 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, startupDelay))
          }

          await this.processSingleItem(input, convertFunction)
        } catch (error) {
          this.logger.error("Error processing batch item", error as Error, { itemId: input.id })

          if (failFast) {
            throw error
          }
        }
      })

      // Wait for this batch to complete before starting next one
      await Promise.all(batchPromises)

      // Trigger garbage collection if memory pressure is high
      const memoryCheck = memoryManager.checkMemoryUsage()
      if (memoryCheck.status === "warning" || memoryCheck.status === "critical") {
        await memoryManager.triggerGarbageCollection()
      }
    }
  }

  /**
   * Process a single conversion item
   */
  private async processSingleItem<T>(
    input: BatchInput,
    convertFunction: (input: string, options?: MHTMLOptions) => Promise<T>,
  ): Promise<void> {
    const { maxRetries, retryDelay } = this.config
    let _lastError: Error | undefined

    // Check if already processing
    if (this.activeConversions.has(input.id)) {
      this.logger.warn(`Item ${input.id} is already being processed`)
      return
    }

    const conversionPromise = this.performConversionWithRetry(
      input,
      convertFunction,
      maxRetries,
      retryDelay,
    )

    this.activeConversions.set(input.id, conversionPromise)

    try {
      await conversionPromise
    } finally {
      this.activeConversions.delete(input.id)
    }
  }

  /**
   * Perform conversion with retry logic
   */
  private async performConversionWithRetry<T>(
    input: BatchInput,
    convertFunction: (input: string, options?: MHTMLOptions) => Promise<T>,
    maxRetries: number,
    retryDelay: number,
  ): Promise<void> {
    let attempt = 0
    let lastError: Error | undefined

    while (attempt <= maxRetries) {
      try {
        const result = await this.performSingleConversion(input, convertFunction)
        this.completedResults.push(result)
        this.config.onItemComplete(result)
        return
      } catch (error) {
        lastError = error as Error
        attempt++

        if (attempt <= maxRetries) {
          this.logger.warn(`Conversion attempt ${attempt} failed for item ${input.id}, retrying...`, {
            error: lastError.message,
            retryDelay,
          })

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        } else {
          this.logger.error(`All conversion attempts failed for item ${input.id}`, lastError)

          // Add failed result
          const failedResult: BatchResult = {
            id: input.id,
            success: false,
            error: {
              message: lastError.message,
              details: lastError,
            },
            metrics: {
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 0,
            },
            metadata: input.metadata,
          }

          this.completedResults.push(failedResult)
          this.config.onError(lastError, input.id)
        }
      }
    }
  }

  /**
   * Perform a single conversion with monitoring
   */
  private async performSingleConversion<T>(
    input: BatchInput,
    convertFunction: (input: string, options?: MHTMLOptions) => Promise<T>,
  ): Promise<BatchResult> {
    const startTime = Date.now()
    const _startMemory = memoryManager.getMemoryStats()

    this.logger.debug(`Starting conversion for item ${input.id}`, {
      input: input.input,
      format: input.format,
    })

    try {
      // Perform conversion with memory monitoring
      const result = await withMemoryMonitoring(
        () => convertFunction(input.input, input.options),
        {
          requiredMemoryMB: 50,
          timeoutMs: 30000,
        },
      )

      const endTime = Date.now()
      const endMemory = memoryManager.getMemoryStats()
      const duration = endTime - startTime

      // Calculate output size if result is string
      const outputSize = typeof result === "string" ? result.length : 0

      const batchResult: BatchResult = {
        id: input.id,
        success: true,
        data: result as unknown as string,
        metrics: {
          startTime,
          endTime,
          duration,
          memoryUsage: endMemory?.used,
          outputSize,
        },
        metadata: input.metadata,
      }

      this.logger.debug(`Conversion completed for item ${input.id}`, {
        duration,
        outputSize,
        memoryUsed: endMemory?.used,
      })

      return batchResult
    } catch (error) {
      const endTime = Date.now()
      const duration = endTime - startTime

      this.logger.error(`Conversion failed for item ${input.id}`, error as Error, {
        duration,
      })

      throw error
    }
  }

  /**
   * Wait for all active conversions to complete
   */
  private async waitForActiveConversions(): Promise<void> {
    if (this.activeConversions.size === 0) {
      return
    }

    this.logger.debug(`Waiting for ${this.activeConversions.size} active conversions to complete`)

    const promises = Array.from(this.activeConversions.values())
    await Promise.allSettled(promises)

    this.logger.debug("All active conversions completed")
  }

  /**
   * Start progress monitoring with periodic updates
   */
  private startProgressMonitoring(_totalItems: number): void {
    this.progressUpdateInterval = setInterval(() => {
      const progress = this.getCurrentProgress()
      if (progress) {
        this.config.onProgress(progress)
      }
    }, 1000) // Update every second
  }

  /**
   * Stop progress monitoring
   */
  private stopProgressMonitoring(): void {
    if (this.progressUpdateInterval) {
      clearInterval(this.progressUpdateInterval)
      this.progressUpdateInterval = undefined
    }
  }

  /**
   * Log final batch results summary
   */
  private logBatchResults(): void {
    const total = this.completedResults.length
    const successful = this.completedResults.filter(r => r.success).length
    const failed = total - successful
    const totalDuration = this.startTime ? Date.now() - this.startTime : 0
    const averageDuration = total > 0 ? totalDuration / total : 0

    // Calculate total output size
    const totalOutputSize = this.completedResults.reduce((sum, result) => {
      return sum + (result.metrics.outputSize || 0)
    }, 0)

    // Calculate average processing rate
    const processingRate = totalDuration > 0 ? (total / (totalDuration / 1000)) : 0

    this.logger.info("Batch conversion completed", {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      totalDuration,
      averageDuration,
      processingRate,
      totalOutputSize,
    })

    if (failed > 0) {
      const failedResults = this.completedResults.filter(r => !r.success)
      this.logger.warn(`Failed conversions: ${failed}`, {
        failedItems: failedResults.map(r => ({
          id: r.id,
          error: r.error?.message,
        })),
      })
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    const oldConcurrency = this.config.concurrency

    this.config = { ...this.config, ...newConfig }

    // Re-calculate memory-aware concurrency if not explicitly set
    if (newConfig.concurrency === undefined) {
      this.config.concurrency = memoryManager.suggestConcurrencyLimit(
        this.config.concurrency,
      )
    }

    this.logger.info("Batch converter configuration updated", {
      oldConcurrency,
      newConcurrency: this.config.concurrency,
      changes: Object.keys(newConfig),
    })
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<BatchConfig> {
    return { ...this.config }
  }

  /**
   * Check if currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing
  }

  /**
   * Get number of active conversions
   */
  getActiveConversionsCount(): number {
    return this.activeConversions.size
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    used: number
    total: number
    percentage: number
    available: number
  } | null {
    const stats = memoryManager.getMemoryStats()
    if (!stats) {
      return null
    }

    return {
      used: stats.used,
      total: stats.total,
      percentage: stats.percentage,
      available: stats.limit - stats.used,
    }
  }
}

/**
 * Utility function to create a batch converter with sensible defaults
 */
export function createBatchConverter(
  logger: Logger,
  config: BatchConfig = {},
): BatchConverter {
  return new BatchConverter(logger, config)
}

/**
 * Utility function to convert URLs with automatic batch handling
 */
export async function convertUrlsInBatch(
  urls: string[],
  convertFunction: (url: string, options?: MHTMLOptions) => Promise<string>,
  logger: Logger,
  options: BatchConfig = {},
): Promise<BatchResult[]> {
  // Convert URLs to batch inputs
  const inputs: BatchInput[] = urls.map((url, index) => ({
    id: `url-${index + 1}`,
    input: url,
    format: "mhtml",
    metadata: { url, index },
  }))

  // Create batch converter
  const converter = new BatchConverter(logger, options)

  // Process batch
  return await converter.convertBatch(inputs, convertFunction)
}
