/**
 * Memory Manager
 *
 * Handles memory-efficient processing, monitoring, and optimization
 * for large file operations and resource-intensive tasks.
 */

import { Buffer } from "node:buffer"
import { freemem, totalmem } from "node:os"
import process from "node:process"

import type { Logger } from "../../architecture/strategies/types.js"

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  /** Total memory usage in bytes */
  total: number
  /** Free memory in bytes */
  free: number
  /** Used memory in bytes */
  used: number
  /** Memory usage percentage */
  usagePercentage: number
  /** Heap size in bytes */
  heapUsed: number
  /** Total heap size in bytes */
  heapTotal: number
  /** External memory in bytes */
  external: number
  /** RSS (Resident Set Size) in bytes */
  rss: number
}

/**
 * Memory threshold configuration
 */
export interface MemoryThresholds {
  /** Warning threshold percentage (0-100) */
  warning: number
  /** Critical threshold percentage (0-100) */
  critical: number
  /** Maximum memory usage in bytes */
  maxMemory?: number
}

/**
 * Memory optimization options
 */
export interface MemoryOptimizationOptions {
  /** Enable garbage collection hints */
  enableGCHints?: boolean
  /** Enable memory monitoring */
  enableMonitoring?: boolean
  /** Monitoring interval in milliseconds */
  monitoringInterval?: number
  /** Force garbage collection at threshold */
  forceGCAtThreshold?: number
}

/**
 * Memory pressure event
 */
export interface MemoryPressureEvent {
  /** Current memory usage */
  usage: MemoryStats
  /** Pressure level */
  level: "normal" | "warning" | "critical"
  /** Timestamp */
  timestamp: Date
  /** Available actions */
  actions: string[]
}

/**
 * Memory-aware processor interface
 */
export interface IMemoryAwareProcessor {
  /**
   * Get memory usage for this processor
   */
  getMemoryUsage(): number

  /**
   * Release unused memory
   */
  releaseMemory(): Promise<void>

  /**
   * Check if processor can handle more work
   */
  canAcceptWork(): boolean
}

/**
 * Chunk processor for memory-efficient operations
 */
export interface ChunkProcessor<T> {
  /**
   * Process a chunk of data
   */
  processChunk(chunk: T, chunkIndex: number): Promise<T>

  /**
   * Called when processing is complete
   */
  onComplete?(totalChunks: number): Promise<void>

  /**
   * Called when processing fails
   */
  onError?(error: Error, chunkIndex: number): Promise<void>
}

/**
 * Memory Manager
 *
 * Monitors and optimizes memory usage during file operations
 */
export class MemoryManager {
  private logger: Logger
  private thresholds: MemoryThresholds
  private options: Required<MemoryOptimizationOptions>
  private monitoringInterval?: NodeJS.Timeout
  private processors = new Set<IMemoryAwareProcessor>()
  private memoryPressureListeners = new Set<(event: MemoryPressureEvent) => void>()
  private lastGC = 0
  private isMonitoring = false

  constructor(
    logger: Logger,
    thresholds: MemoryThresholds = { warning: 75, critical: 90 },
    options: MemoryOptimizationOptions = {},
  ) {
    this.logger = logger
    this.thresholds = thresholds
    this.options = {
      enableGCHints: options.enableGCHints ?? true,
      enableMonitoring: options.enableMonitoring ?? false,
      monitoringInterval: options.monitoringInterval ?? 5000,
      forceGCAtThreshold: options.forceGCAtThreshold ?? 80,
    }

    if (this.options.enableMonitoring) {
      this.startMonitoring()
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage()
    const totalMem = totalmem()
    const freeMem = freemem()

    return {
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem,
      usagePercentage: ((totalMem - freeMem) / totalMem) * 100,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    }
  }

  /**
   * Check if memory is under pressure
   */
  checkMemoryPressure(): MemoryPressureEvent {
    const stats = this.getMemoryStats()
    const usagePercentage = stats.usagePercentage

    let level: "normal" | "warning" | "critical" = "normal"
    const actions: string[] = []

    if (usagePercentage >= this.thresholds.critical) {
      level = "critical"
      actions.push(
        "Force garbage collection",
        "Release unused resources",
        "Consider aborting operations",
      )
    } else if (usagePercentage >= this.thresholds.warning) {
      level = "warning"
      actions.push(
        "Monitor closely",
        "Prepare to release resources",
        "Consider reducing concurrency",
      )
    }

    const event: MemoryPressureEvent = {
      usage: stats,
      level,
      timestamp: new Date(),
      actions,
    }

    // Notify listeners
    if (level !== "normal") {
      this.notifyMemoryPressure(event)
    }

    return event
  }

  /**
   * Process data in chunks to manage memory
   */
  async processInChunks<T, R>(
    data: T[],
    chunkSize: number,
    processor: ChunkProcessor<R>,
  ): Promise<R[]> {
    const results: R[] = []
    const totalChunks = Math.ceil(data.length / chunkSize)

    this.logger.debug(`Starting chunked processing`, {
      totalItems: data.length,
      chunkSize,
      totalChunks,
    })

    try {
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunkIndex = Math.floor(i / chunkSize)
        const chunk = data.slice(i, i + chunkSize)

        // Check memory pressure before processing each chunk
        const pressure = this.checkMemoryPressure()
        if (pressure.level === "critical") {
          await this.handleCriticalMemoryPressure()
        }

        // Process each item in the chunk
        for (let j = 0; j < chunk.length; j++) {
          try {
            const result = await processor.processChunk(chunk[j], chunkIndex * chunkSize + j)
            results.push(result)
          } catch (error) {
            if (processor.onError) {
              await processor.onError(error as Error, chunkIndex * chunkSize + j)
            }
            throw error
          }
        }

        // Periodic cleanup
        if (chunkIndex % 10 === 0) {
          await this.periodicCleanup()
        }
      }

      if (processor.onComplete) {
        await processor.onComplete(totalChunks)
      }

      this.logger.debug(`Completed chunked processing`, {
        totalChunks,
        resultsCount: results.length,
      })

      return results
    } catch (error) {
      this.logger.error("Chunked processing failed", error as Error)
      throw error
    }
  }

  /**
   * Stream data with memory management
   */
  async streamWithMemoryManagement<T>(
    stream: NodeJS.ReadableStream,
    processor: (chunk: T) => Promise<void>,
    options: {
      maxMemoryUsage?: number
      chunkSize?: number
      memoryCheckInterval?: number
    } = {},
  ): Promise<void> {
    const {
      maxMemoryUsage = this.thresholds.maxMemory || (1024 * 1024 * 1024), // 1GB default
      chunkSize = 1024,
      memoryCheckInterval = 100,
    } = options

    let processedBytes = 0
    let lastMemoryCheck = 0

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let currentChunkSize = 0

      stream.on("data", async (data: Buffer) => {
        try {
          chunks.push(data)
          currentChunkSize += data.length
          processedBytes += data.length

          // Check memory usage periodically
          if (processedBytes - lastMemoryCheck > memoryCheckInterval * 1024) {
            const stats = this.getMemoryStats()
            if (stats.heapUsed > maxMemoryUsage) {
              stream.pause()
              await this.optimizeMemory()
              stream.resume()
            }
            lastMemoryCheck = processedBytes
          }

          // Process chunk when it reaches target size
          if (currentChunkSize >= chunkSize) {
            const chunk = Buffer.concat(chunks, currentChunkSize)
            chunks.length = 0
            currentChunkSize = 0

            await processor(chunk as any)
          }
        } catch (error) {
          stream.destroy()
          reject(error)
        }
      })

      stream.on("end", async () => {
        try {
          // Process remaining data
          if (chunks.length > 0) {
            const chunk = Buffer.concat(chunks, currentChunkSize)
            await processor(chunk as any)
          }
          resolve()
        } catch (error) {
          reject(error)
        }
      })

      stream.on("error", reject)
    })
  }

  /**
   * Register a memory-aware processor
   */
  registerProcessor(processor: IMemoryAwareProcessor): void {
    this.processors.add(processor)
    this.logger.debug("Registered memory-aware processor")
  }

  /**
   * Unregister a memory-aware processor
   */
  unregisterProcessor(processor: IMemoryAwareProcessor): void {
    this.processors.delete(processor)
    this.logger.debug("Unregistered memory-aware processor")
  }

  /**
   * Add memory pressure event listener
   */
  onMemoryPressure(listener: (event: MemoryPressureEvent) => void): void {
    this.memoryPressureListeners.add(listener)
  }

  /**
   * Remove memory pressure event listener
   */
  offMemoryPressure(listener: (event: MemoryPressureEvent) => void): void {
    this.memoryPressureListeners.delete(listener)
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): boolean {
    if (!this.options.enableGCHints) {
      return false
    }

    try {
      // Check if globalThis.gc is available (requires --expose-gc flag)
      if (globalThis.gc) {
        const now = Date.now()
        // Limit GC frequency to avoid performance impact
        if (now - this.lastGC > 1000) {
          globalThis.gc()
          this.lastGC = now
          this.logger.debug("Forced garbage collection")
          return true
        }
      }
    } catch (error) {
      this.logger.warn("Failed to force garbage collection", error)
    }

    return false
  }

  /**
   * Optimize memory usage
   */
  async optimizeMemory(): Promise<void> {
    this.logger.debug("Starting memory optimization")

    // Force garbage collection
    const gcResult = this.forceGarbageCollection()

    // Release memory from all registered processors
    const releasePromises: Promise<void>[] = []
    for (const processor of this.processors) {
      releasePromises.push(
        processor.releaseMemory().catch((error) => {
          this.logger.warn("Failed to release memory from processor", error)
        }),
      )
    }

    await Promise.allSettled(releasePromises)

    const stats = this.getMemoryStats()
    this.logger.debug("Memory optimization completed", {
      heapUsed: stats.heapUsed,
      heapTotal: stats.heapTotal,
      gcForced: gcResult,
    })
  }

  /**
   * Handle critical memory pressure
   */
  private async handleCriticalMemoryPressure(): Promise<void> {
    this.logger.warn("Handling critical memory pressure")

    // Force garbage collection
    this.forceGarbageCollection()

    // Release memory from processors
    const releasePromises: Promise<void>[] = []
    for (const processor of this.processors) {
      if (processor.canAcceptWork()) {
        releasePromises.push(
          processor.releaseMemory().catch((error) => {
            this.logger.warn("Failed to release memory from processor during critical pressure", error)
          }),
        )
      }
    }

    await Promise.allSettled(releasePromises)

    // Wait a bit for memory to be freed
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check if pressure is relieved
    const pressure = this.checkMemoryPressure()
    if (pressure.level === "critical") {
      this.logger.error("Critical memory pressure not relieved, may need to abort operations")
    }
  }

  /**
   * Periodic cleanup
   */
  private async periodicCleanup(): Promise<void> {
    const stats = this.getMemoryStats()

    // Force GC if we're above the threshold
    if (stats.usagePercentage >= this.options.forceGCAtThreshold) {
      this.forceGarbageCollection()
    }

    // Release memory from processors that can't accept more work
    const releasePromises: Promise<void>[] = []
    for (const processor of this.processors) {
      if (!processor.canAcceptWork()) {
        releasePromises.push(
          processor.releaseMemory().catch((error) => {
            this.logger.warn("Failed to release memory during periodic cleanup", error)
          }),
        )
      }
    }

    if (releasePromises.length > 0) {
      await Promise.allSettled(releasePromises)
    }
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.monitoringInterval = setInterval(() => {
      const pressure = this.checkMemoryPressure()
      if (pressure.level !== "normal") {
        this.logger.warn("Memory pressure detected", {
          level: pressure.level,
          usagePercentage: pressure.usage.usagePercentage,
          heapUsed: pressure.usage.heapUsed,
          rss: pressure.usage.rss,
        })
      }
    }, this.options.monitoringInterval)

    this.logger.debug("Started memory monitoring")
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    this.isMonitoring = false
    this.logger.debug("Stopped memory monitoring")
  }

  /**
   * Notify memory pressure listeners
   */
  private notifyMemoryPressure(event: MemoryPressureEvent): void {
    for (const listener of this.memoryPressureListeners) {
      try {
        listener(event)
      } catch (error) {
        this.logger.error("Memory pressure listener error", error as Error)
      }
    }
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    this.stopMonitoring()
    this.processors.clear()
    this.memoryPressureListeners.clear()
    await this.optimizeMemory()
    this.logger.debug("Memory manager cleanup completed")
  }

  /**
   * Get memory manager statistics
   */
  getStats(): {
    isMonitoring: boolean
    registeredProcessors: number
    pressureListeners: number
    thresholds: MemoryThresholds
    currentMemory: MemoryStats
  } {
    return {
      isMonitoring: this.isMonitoring,
      registeredProcessors: this.processors.size,
      pressureListeners: this.memoryPressureListeners.size,
      thresholds: this.thresholds,
      currentMemory: this.getMemoryStats(),
    }
  }
}
