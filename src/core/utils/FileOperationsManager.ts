/**
 * File Operations Manager
 *
 * High-level file operations manager that combines secure file handling
 * with memory management for efficient and safe file processing.
 */

import { Buffer } from "node:buffer"
import { join, parse } from "node:path"
import type { Readable, Writable } from "node:stream"

import type { Logger } from "../../architecture/strategies/types.js"

import { MemoryManager } from "./MemoryManager.js"
import type { MemoryOptimizationOptions, MemoryThresholds } from "./MemoryManager.js"
import { FileOperationError, SecureFileManager } from "./SecureFileManager.js"
import type { FileInfo, StreamingOptions, StreamResult } from "./SecureFileManager.js"

/**
 * File processing operation configuration
 */
export interface FileProcessingOptions {
  /** Memory thresholds for processing */
  memoryThresholds?: MemoryThresholds
  /** Memory optimization options */
  memoryOptions?: MemoryOptimizationOptions
  /** Streaming options */
  streamingOptions?: StreamingOptions
  /** Maximum file size for processing */
  maxFileSize?: number
  /** Whether to process files in chunks */
  chunkProcessing?: boolean
  /** Chunk size for processing */
  chunkSize?: number
  /** Enable progress reporting */
  enableProgress?: boolean
  /** Progress callback */
  onProgress?: (progress: FileProcessingProgress) => void
}

/**
 * File processing progress
 */
export interface FileProcessingProgress {
  /** Current operation */
  operation: string
  /** Bytes processed */
  bytesProcessed: number
  /** Total bytes */
  totalBytes: number
  /** Percentage complete */
  percentage: number
  /** Current file being processed */
  currentFile?: string
  /** Processing speed in bytes/second */
  speed?: number
  /** Estimated time remaining in milliseconds */
  eta?: number
}

/**
 * Batch file processing result
 */
export interface BatchProcessingResult {
  /** Total files processed */
  totalFiles: number
  /** Successfully processed files */
  successfulFiles: number
  /** Failed files */
  failedFiles: number
  /** Total bytes processed */
  totalBytesProcessed: number
  /** Processing duration in milliseconds */
  duration: number
  /** Processing errors */
  errors: Array<{
    file: string
    error: string
  }>
  /** Average processing speed in bytes/second */
  averageSpeed: number
}

/**
 * File processor interface
 */
export interface IFileProcessor<TInput, TOutput> {
  /**
   * Process a single file
   */
  processFile(inputPath: string, outputPath: string, data?: TInput): Promise<TOutput>

  /**
   * Get the processor name
   */
  getName(): string

  /**
   * Check if processor can handle the file
   */
  canHandle(filePath: string): boolean

  /**
   * Get output file extension
   */
  getOutputExtension(): string
}

/**
 * File Operations Manager
 *
 * Provides high-level file operations with security, memory management,
 * and progress tracking capabilities
 */
export class FileOperationsManager {
  private logger: Logger
  private secureFileManager: SecureFileManager
  private memoryManager: MemoryManager
  private activeOperations = new Map<string, FileProcessingProgress>()
  private operationCounter = 0

  constructor(
    logger: Logger,
    options: {
      memoryThresholds?: MemoryThresholds
      memoryOptions?: MemoryOptimizationOptions
    } = {},
  ) {
    this.logger = logger
    this.secureFileManager = new SecureFileManager(logger)
    this.memoryManager = new MemoryManager(logger, options.memoryThresholds, options.memoryOptions)

    this.logger.info("File Operations Manager initialized")
  }

  /**
   * Process a single file with memory management
   */
  async processFile<TInput, TOutput>(
    inputPath: string,
    processor: IFileProcessor<TInput, TOutput>,
    outputPath?: string,
    options: FileProcessingOptions = {},
  ): Promise<{
    result: TOutput
    outputPath?: string
    stats: {
      inputSize: number
      outputSize?: number
      duration: number
      memoryPeak: number
    }
  }> {
    const operationId = this.startOperation("processFile", inputPath)
    const startTime = Date.now()
    let peakMemory = 0

    try {
      // Check if processor can handle the file
      if (!processor.canHandle(inputPath)) {
        throw new FileOperationError(
          `Processor ${processor.getName()} cannot handle file: ${inputPath}`,
          "processFile",
          inputPath,
        )
      }

      // Get file info
      const fileInfo = await this.secureFileManager.getFileInfo(inputPath)
      if (!fileInfo.exists) {
        throw new FileOperationError(
          `Input file does not exist: ${inputPath}`,
          "processFile",
          inputPath,
        )
      }

      // Check file size limits
      if (options.maxFileSize && fileInfo.size > options.maxFileSize) {
        throw new FileOperationError(
          `File size (${fileInfo.size}) exceeds maximum allowed size (${options.maxFileSize})`,
          "processFile",
          inputPath,
        )
      }

      // Generate output path if not provided
      const finalOutputPath = outputPath || this.generateOutputPath(inputPath, processor.getOutputExtension())

      // Update progress
      this.updateProgress(operationId, {
        operation: "Reading input file",
        bytesProcessed: 0,
        totalBytes: fileInfo.size,
        percentage: 0,
        currentFile: inputPath,
      })

      // Monitor memory during processing
      const memoryMonitor = setInterval(() => {
        const stats = this.memoryManager.getMemoryStats()
        peakMemory = Math.max(peakMemory, stats.heapUsed)

        // Check memory pressure
        const pressure = this.memoryManager.checkMemoryPressure()
        if (pressure.level === "critical") {
          this.logger.warn("Critical memory pressure during file processing", {
            file: inputPath,
            heapUsed: stats.heapUsed,
          })
        }
      }, 1000)

      try {
        // Process the file
        const result = await processor.processFile(inputPath, finalOutputPath)

        clearInterval(memoryMonitor)

        // Get output file info if output file was created
        let outputSize: number | undefined
        if (finalOutputPath) {
          const outputInfo = await this.secureFileManager.getFileInfo(finalOutputPath)
          outputSize = outputInfo.size
        }

        const duration = Date.now() - startTime

        this.updateProgress(operationId, {
          operation: "Completed",
          bytesProcessed: fileInfo.size,
          totalBytes: fileInfo.size,
          percentage: 100,
          currentFile: inputPath,
          speed: fileInfo.size / (duration / 1000),
        })

        this.logger.info(`File processing completed`, {
          inputPath,
          outputPath: finalOutputPath,
          duration,
          inputSize: fileInfo.size,
          outputSize,
          peakMemory,
        })

        return {
          result,
          outputPath: finalOutputPath,
          stats: {
            inputSize: fileInfo.size,
            outputSize,
            duration,
            memoryPeak: peakMemory,
          },
        }
      } catch (error) {
        clearInterval(memoryMonitor)
        throw error
      }
    } catch (error) {
      this.logger.error(`File processing failed: ${inputPath}`, error as Error)
      throw error
    } finally {
      this.endOperation(operationId)
    }
  }

  /**
   * Process multiple files in batch
   */
  async processBatch<TInput, TOutput>(
    inputPaths: string[],
    processor: IFileProcessor<TInput, TOutput>,
    options: FileProcessingOptions & {
      outputDirectory?: string
      concurrency?: number
      continueOnError?: boolean
    } = {},
  ): Promise<BatchProcessingResult> {
    const {
      outputDirectory,
      concurrency = 3,
      continueOnError = true,
      ...processingOptions
    } = options

    const operationId = this.startOperation("processBatch", `${inputPaths.length} files`)
    const startTime = Date.now()
    const result: BatchProcessingResult = {
      totalFiles: inputPaths.length,
      successfulFiles: 0,
      failedFiles: 0,
      totalBytesProcessed: 0,
      duration: 0,
      errors: [],
      averageSpeed: 0,
    }

    try {
      this.logger.info(`Starting batch processing`, {
        totalFiles: inputPaths.length,
        concurrency,
        processor: processor.getName(),
      })

      // Create output directory if specified
      if (outputDirectory) {
        await this.secureFileManager.createTempDirectory() // This will be replaced with actual directory creation
      }

      // Process files in batches
      const chunks = this.chunkArray(inputPaths, concurrency)
      let processedFiles = 0

      for (const chunk of chunks) {
        const promises = chunk.map(async (inputPath) => {
          try {
            // Generate output path
            let outputPath: string | undefined
            if (outputDirectory) {
              outputPath = this.generateOutputPath(inputPath, processor.getOutputExtension(), outputDirectory)
            }

            // Process file
            const processResult = await this.processFile(inputPath, processor, outputPath, processingOptions)

            result.successfulFiles++
            result.totalBytesProcessed += processResult.stats.inputSize

            // Update batch progress
            processedFiles++
            this.updateProgress(operationId, {
              operation: "Processing batch",
              bytesProcessed: result.totalBytesProcessed,
              totalBytes: 0, // Total bytes calculation would require async operations
              percentage: (processedFiles / inputPaths.length) * 100,
            })

            return processResult
          } catch (error) {
            result.failedFiles++
            result.errors.push({
              file: inputPath,
              error: error instanceof Error ? error.message : String(error),
            })

            this.logger.error(`Failed to process file in batch: ${inputPath}`, error as Error)

            if (!continueOnError) {
              throw error
            }

            return null
          }
        })

        await Promise.allSettled(promises)

        // Memory cleanup between batches
        await this.memoryManager.optimizeMemory()
      }

      result.duration = Date.now() - startTime
      result.averageSpeed = result.duration > 0 ? (result.totalBytesProcessed / result.duration) * 1000 : 0

      this.logger.info(`Batch processing completed`, {
        totalFiles: result.totalFiles,
        successfulFiles: result.successfulFiles,
        failedFiles: result.failedFiles,
        duration: result.duration,
        averageSpeed: result.averageSpeed,
      })

      return result
    } catch (error) {
      this.logger.error("Batch processing failed", error as Error)
      throw error
    } finally {
      this.endOperation(operationId)
    }
  }

  /**
   * Stream processing with memory management
   */
  async processStream<T>(
    inputStream: NodeJS.ReadableStream,
    processor: (chunk: T, chunkIndex: number) => Promise<void>,
    options: FileProcessingOptions & {
      chunkSize?: number
      maxConcurrency?: number
    } = {},
  ): Promise<{
    totalChunks: number
    bytesProcessed: number
    duration: number
  }> {
    const operationId = this.startOperation("processStream", "stream")
    const startTime = Date.now()
    let totalChunks = 0
    let bytesProcessed = 0

    try {
      const _result = await this.memoryManager.streamWithMemoryManagement(
        inputStream,
        async (chunk: T) => {
          await processor(chunk, totalChunks++)
          bytesProcessed += Buffer.byteLength(String(chunk))

          this.updateProgress(operationId, {
            operation: "Processing stream",
            bytesProcessed,
            totalBytes: 0, // Unknown for streams
            percentage: 0, // Can't calculate for streams
            currentFile: `Chunk ${totalChunks}`,
          })
        },
        {
          maxMemoryUsage: options.maxFileSize,
          chunkSize: options.chunkSize,
          memoryCheckInterval: 1000,
        },
      )

      const duration = Date.now() - startTime

      this.logger.info(`Stream processing completed`, {
        totalChunks,
        bytesProcessed,
        duration,
      })

      return {
        totalChunks,
        bytesProcessed,
        duration,
      }
    } catch (error) {
      this.logger.error("Stream processing failed", error as Error)
      throw error
    } finally {
      this.endOperation(operationId)
    }
  }

  /**
   * Create a secure temporary file
   */
  async createTempFile(options?: {
    prefix?: string
    suffix?: string
    cleanupOnExit?: boolean
  }): Promise<string> {
    return await this.secureFileManager.createTempFile(options)
  }

  /**
   * Create a secure temporary directory
   */
  async createTempDirectory(prefix?: string): Promise<string> {
    return await this.secureFileManager.createTempDirectory(prefix)
  }

  /**
   * Write data to file with memory management
   */
  async writeFile(
    filePath: string,
    data: string | Buffer | NodeJS.ArrayBufferView,
    options?: {
      encoding?: BufferEncoding
      createDir?: boolean
      maxSize?: number
    },
  ): Promise<void> {
    await this.secureFileManager.writeFile(filePath, data, options)
  }

  /**
   * Read data from file with memory management
   */
  async readFile(
    filePath: string,
    options?: {
      encoding?: BufferEncoding
      maxSize?: number
    },
  ): Promise<string | Buffer> {
    return await this.secureFileManager.readFile(filePath, options)
  }

  /**
   * Stream data between files or streams
   */
  async streamData(
    source: string | Readable,
    destination: string | Writable,
    options?: StreamingOptions & {
      maxSize?: number
      createDir?: boolean
    },
  ): Promise<StreamResult> {
    return await this.secureFileManager.streamData(source, destination, options)
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    return await this.secureFileManager.getFileInfo(filePath)
  }

  /**
   * Delete file securely
   */
  async deleteFile(filePath: string): Promise<void> {
    await this.secureFileManager.deleteFile(filePath)
  }

  /**
   * Delete directory securely
   */
  async deleteDirectory(dirPath: string, recursive = true): Promise<void> {
    await this.secureFileManager.deleteDirectory(dirPath, recursive)
  }

  /**
   * Get current operation progress
   */
  getOperationProgress(operationId?: string): FileProcessingProgress | undefined {
    if (operationId) {
      return this.activeOperations.get(operationId)
    }
    // Return the most recent operation if no ID specified
    const operations = Array.from(this.activeOperations.values())
    return operations[operations.length - 1]
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): Map<string, FileProcessingProgress> {
    return new Map(this.activeOperations)
  }

  /**
   * Get memory manager statistics
   */
  getMemoryStats(): ReturnType<MemoryManager["getStats"]> {
    return this.memoryManager.getStats()
  }

  /**
   * Get file manager cleanup statistics
   */
  getCleanupStats(): ReturnType<SecureFileManager["getCleanupStats"]> {
    return this.secureFileManager.getCleanupStats()
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    this.logger.info("Starting File Operations Manager cleanup")

    this.activeOperations.clear()
    await this.memoryManager.cleanup()
    await this.secureFileManager.cleanup()

    this.logger.info("File Operations Manager cleanup completed")
  }

  /**
   * Start tracking an operation
   */
  private startOperation(operation: string, target: string): string {
    const operationId = `op_${++this.operationCounter}_${Date.now()}`
    const progress: FileProcessingProgress = {
      operation,
      bytesProcessed: 0,
      totalBytes: 0,
      percentage: 0,
      currentFile: target,
    }

    this.activeOperations.set(operationId, progress)
    this.logger.debug(`Started operation: ${operation}`, { operationId, target })

    return operationId
  }

  /**
   * Update operation progress
   */
  private updateProgress(operationId: string, progress: Partial<FileProcessingProgress>): void {
    const existing = this.activeOperations.get(operationId)
    if (existing) {
      Object.assign(existing, progress)
      this.logger.debug(`Updated progress for operation: ${operationId}`, {
        percentage: existing.percentage,
        bytesProcessed: existing.bytesProcessed,
        totalBytes: existing.totalBytes,
      })
    }
  }

  /**
   * End operation tracking
   */
  private endOperation(operationId: string): void {
    this.activeOperations.delete(operationId)
    this.logger.debug(`Ended operation: ${operationId}`)
  }

  /**
   * Generate output path for processed file
   */
  private generateOutputPath(
    inputPath: string,
    outputExtension: string,
    outputDirectory?: string,
  ): string {
    // parse and join already imported above
    const parsed = parse(inputPath)

    if (outputDirectory) {
      return join(outputDirectory, `${parsed.name}.${outputExtension}`)
    }

    return join(parsed.dir, `${parsed.name}.${outputExtension}`)
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }
}
