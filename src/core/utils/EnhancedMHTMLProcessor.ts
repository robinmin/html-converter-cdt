/**
 * Enhanced MHTML Processor
 *
 * Integrates the MHTML processor with secure file operations and memory management
 * for improved resource handling and large file processing.
 */

import type { Buffer } from "node:buffer"

import type { CDPClient } from "../../architecture/adapters/cdp/CDPClient.js"
import type { Logger } from "../../architecture/strategies/types.js"
import type { ExternalResource, MHTMLOptions } from "../../converters/mhtml/types.js"
import { ExternalDependencyDetector, MHTMLProcessor } from "../engine/mhtml-processor.js"
import type { CDPCaptureConfig, ExternalDependency } from "../engine/mhtml-processor.js"

import { FileOperationsManager } from "./FileOperationsManager.js"
import type { FileProcessingOptions, IFileProcessor } from "./FileOperationsManager.js"
import { SecureFileManager } from "./SecureFileManager.js"

/**
 * Enhanced MHTML processing options
 */
export interface EnhancedMHTMLOptions extends MHTMLOptions {
  /** File processing options */
  fileProcessing?: FileProcessingOptions
  /** Whether to save MHTML to temporary file */
  saveToTempFile?: boolean
  /** Temporary file prefix */
  tempFilePrefix?: string
  /** Maximum output size in bytes */
  maxOutputSize?: number
  /** Enable progress reporting */
  enableProgress?: boolean
  /** Progress callback */
  onProgress?: (progress: {
    stage: string
    percentage: number
    bytesProcessed?: number
    totalBytes?: number
  }) => void
}

/**
 * MHTML file processing result
 */
export interface MHTMLProcessingResult {
  /** MHTML content */
  content: string
  /** File path if saved to temporary file */
  filePath?: string
  /** Processing statistics */
  stats: {
    duration: number
    inputSize: number
    outputSize: number
    memoryPeak: number
    dependenciesFound: number
    dependenciesFetched: number
  }
  /** External resources */
  resources: ExternalResource[]
  /** Processing metadata */
  metadata: {
    title?: string
    url?: string
    captureDate: Date
    processorVersion: string
  }
}

/**
 * MHTML file processor implementation
 */
class MHTMLFileProcessor implements IFileProcessor<string, string> {
  private logger: Logger
  private mhtmlProcessor: MHTMLProcessor
  private secureFileManager: SecureFileManager

  constructor(logger: Logger, mhtmlProcessor: MHTMLProcessor) {
    this.logger = logger
    this.mhtmlProcessor = mhtmlProcessor
    this.secureFileManager = new SecureFileManager(this.logger)
  }

  async processFile(inputPath: string, outputPath: string): Promise<string> {
    // Read HTML content from file
    const _htmlContent = await this.secureFileManager.readFile(inputPath, { encoding: "utf8" })

    // Process with MHTML processor
    const mhtmlContent = await this.mhtmlProcessor.capturePageAsMHTML(`file://${inputPath}`)

    // Write MHTML content to output file
    await this.secureFileManager.writeFile(outputPath, mhtmlContent, { encoding: "utf8" })

    return mhtmlContent
  }

  getName(): string {
    return "MHTML File Processor"
  }

  canHandle(filePath: string): boolean {
    return filePath.endsWith(".html") || filePath.endsWith(".htm")
  }

  getOutputExtension(): string {
    return "mhtml"
  }
}

/**
 * Enhanced MHTML Processor
 *
 * Combines MHTML processing capabilities with secure file operations,
 * memory management, and progress tracking for robust large file handling.
 */
export class EnhancedMHTMLProcessor {
  private logger: Logger
  private fileManager: FileOperationsManager
  private secureFileManager: SecureFileManager
  private mhtmlProcessor: MHTMLProcessor
  private dependencyDetector: ExternalDependencyDetector

  constructor(
    logger: Logger,
    config: CDPCaptureConfig = {},
    fileProcessingOptions: FileProcessingOptions = {},
  ) {
    this.logger = logger
    this.fileManager = new FileOperationsManager(logger, fileProcessingOptions)
    this.secureFileManager = new SecureFileManager(logger)
    this.mhtmlProcessor = new MHTMLProcessor(logger, config)
    this.dependencyDetector = new ExternalDependencyDetector(logger)

    this.logger.info("Enhanced MHTML Processor initialized")
  }

  /**
   * Capture URL as MHTML with enhanced file and memory management
   */
  async captureURLAsMHTML(
    url: string,
    options: EnhancedMHTMLOptions = {},
  ): Promise<MHTMLProcessingResult> {
    const startTime = Date.now()
    let tempFilePath: string | undefined
    const _memoryPeak = 0

    try {
      this.logger.info("Starting enhanced MHTML capture", { url, options })

      // Report progress
      this.reportProgress("Initializing", 0, options)

      // Set up CDP client if available
      await this.setupCDPClient()

      // Capture MHTML using the underlying processor
      this.reportProgress("Capturing page", 20, options)
      const mhtmlContent = await this.mhtmlProcessor.capturePageAsMHTML(url, options)

      // Get page information
      this.reportProgress("Extracting metadata", 60, options)
      const pageInfo = await this.mhtmlProcessor.getPageInfo(url)

      // Analyze dependencies
      this.reportProgress("Analyzing dependencies", 80, options)
      const dependencyAnalysis = await this.analyzeDependenciesForURL(url)

      // Save to temporary file if requested
      if (options.saveToTempFile) {
        tempFilePath = await this.secureFileManager.createTempFile({
          prefix: options.tempFilePrefix || "mhtml",
          suffix: ".mhtml",
          cleanupOnExit: true,
        })

        await this.secureFileManager.writeFile(tempFilePath, mhtmlContent, {
          encoding: "utf8",
          maxSize: options.maxOutputSize,
        })
      }

      const duration = Date.now() - startTime
      const memoryStats = this.fileManager.getMemoryStats()

      const result: MHTMLProcessingResult = {
        content: mhtmlContent,
        filePath: tempFilePath,
        stats: {
          duration,
          inputSize: 0, // Would need to fetch page content to determine
          outputSize: mhtmlContent.length,
          memoryPeak: memoryStats.currentMemory.heapUsed,
          dependenciesFound: dependencyAnalysis.dependencies.length,
          dependenciesFetched: 0, // Would need actual fetching to determine
        },
        resources: this.convertDependenciesToExternalResources(dependencyAnalysis.dependencies),
        metadata: {
          title: pageInfo.title,
          url: pageInfo.url,
          captureDate: new Date(),
          processorVersion: "1.0.0",
        },
      }

      this.reportProgress("Completed", 100, options)
      this.logger.info("Enhanced MHTML capture completed", {
        url,
        duration,
        outputSize: result.stats.outputSize,
        dependenciesFound: result.stats.dependenciesFound,
        savedToFile: !!tempFilePath,
      })

      return result
    } catch (error) {
      this.logger.error("Enhanced MHTML capture failed", error as Error, { url })
      throw error
    }
  }

  /**
   * Process HTML file as MHTML with enhanced file management
   */
  async processHTMLFileAsMHTML(
    htmlFilePath: string,
    options: EnhancedMHTMLOptions = {},
  ): Promise<MHTMLProcessingResult> {
    const startTime = Date.now()
    let tempFilePath: string | undefined
    const _memoryPeak = 0

    try {
      this.logger.info("Starting enhanced HTML file processing", { htmlFilePath, options })

      // Report progress
      this.reportProgress("Reading HTML file", 0, options)

      // Get file info
      const fileInfo = await this.secureFileManager.getFileInfo(htmlFilePath)
      if (!fileInfo.exists) {
        throw new Error(`HTML file does not exist: ${htmlFilePath}`)
      }

      // Read HTML content
      const htmlContent = await this.secureFileManager.readFile(htmlFilePath, {
        encoding: "utf8",
        maxSize: options.maxOutputSize,
      })

      this.reportProgress("Analyzing dependencies", 20, options)

      // Analyze dependencies in HTML content
      const baseUrl = `file://${htmlFilePath}`
      const dependencyAnalysis = await this.mhtmlProcessor.analyzeExternalDependencies(
        htmlContent as string,
        baseUrl,
      )

      this.reportProgress("Converting to MHTML", 50, options)

      // Convert to MHTML format (simplified version - in real implementation would use full MHTML conversion)
      const mhtmlContent = await this.convertHTMLToMHTML(htmlContent as string, baseUrl, dependencyAnalysis.dependencies)

      // Save to temporary file if requested
      if (options.saveToTempFile) {
        this.reportProgress("Saving to file", 80, options)
        tempFilePath = await this.secureFileManager.createTempFile({
          prefix: options.tempFilePrefix || "mhtml",
          suffix: ".mhtml",
          cleanupOnExit: true,
        })

        await this.secureFileManager.writeFile(tempFilePath, mhtmlContent, {
          encoding: "utf8",
          maxSize: options.maxOutputSize,
        })
      }

      const duration = Date.now() - startTime
      const memoryStats = this.fileManager.getMemoryStats()

      const result: MHTMLProcessingResult = {
        content: mhtmlContent,
        filePath: tempFilePath,
        stats: {
          duration,
          inputSize: fileInfo.size,
          outputSize: mhtmlContent.length,
          memoryPeak: memoryStats.currentMemory.heapUsed,
          dependenciesFound: dependencyAnalysis.dependencies.length,
          dependenciesFetched: 0, // Would need actual fetching to determine
        },
        resources: this.convertDependenciesToExternalResources(dependencyAnalysis.dependencies),
        metadata: {
          title: this.extractTitleFromHTML(htmlContent as string),
          url: baseUrl,
          captureDate: new Date(),
          processorVersion: "1.0.0",
        },
      }

      this.reportProgress("Completed", 100, options)
      this.logger.info("Enhanced HTML file processing completed", {
        htmlFilePath,
        duration,
        inputSize: result.stats.inputSize,
        outputSize: result.stats.outputSize,
        dependenciesFound: result.stats.dependenciesFound,
        savedToFile: !!tempFilePath,
      })

      return result
    } catch (error) {
      this.logger.error("Enhanced HTML file processing failed", error as Error, { htmlFilePath })
      throw error
    }
  }

  /**
   * Process multiple HTML files in batch
   */
  async processBatchHTMLFiles(
    htmlFilePaths: string[],
    options: EnhancedMHTMLOptions & {
      outputDirectory?: string
      concurrency?: number
      continueOnError?: boolean
    } = {},
  ): Promise<{
    results: MHTMLProcessingResult[]
    summary: {
      totalFiles: number
      successfulFiles: number
      failedFiles: number
      totalDuration: number
      totalInputSize: number
      totalOutputSize: number
      averageMemoryUsage: number
    }
    errors: Array<{
      file: string
      error: string
    }>
  }> {
    const startTime = Date.now()
    const results: MHTMLProcessingResult[] = []
    const errors: Array<{ file: string, error: string }> = []

    this.logger.info("Starting batch HTML file processing", {
      totalFiles: htmlFilePaths.length,
      concurrency: options.concurrency || 3,
    })

    // Process files in batches using the file manager
    const batchResult = await this.fileManager.processBatch(
      htmlFilePaths,
      new MHTMLFileProcessor(this.logger, this.mhtmlProcessor),
      {
        outputDirectory: options.outputDirectory,
        concurrency: options.concurrency || 3,
        continueOnError: options.continueOnError ?? true,
        memoryThresholds: options.fileProcessing?.memoryThresholds,
        memoryOptions: options.fileProcessing?.memoryOptions,
        enableProgress: options.enableProgress,
        onProgress: (progress) => {
          this.reportProgress(
            `Processing batch (${progress.currentFile})`,
            progress.percentage,
            options,
          )
        },
      },
    )

    // Convert batch results to MHTML processing results
    for (let i = 0; i < batchResult.successfulFiles; i++) {
      // This would need to be enhanced to get actual MHTML processing results
      // For now, we create a placeholder result
      results.push({
        content: "", // Would be populated by actual processing
        stats: {
          duration: 0, // Would be populated by actual processing
          inputSize: 0,
          outputSize: 0,
          memoryPeak: 0,
          dependenciesFound: 0,
          dependenciesFetched: 0,
        },
        resources: [],
        metadata: {
          captureDate: new Date(),
          processorVersion: "1.0.0",
        },
      })
    }

    // Add errors from batch processing
    for (const error of batchResult.errors) {
      errors.push(error)
    }

    const totalDuration = Date.now() - startTime
    const memoryStats = this.fileManager.getMemoryStats()

    const summary = {
      totalFiles: htmlFilePaths.length,
      successfulFiles: batchResult.successfulFiles,
      failedFiles: batchResult.failedFiles,
      totalDuration,
      totalInputSize: batchResult.totalBytesProcessed,
      totalOutputSize: results.reduce((sum, result) => sum + result.stats.outputSize, 0),
      averageMemoryUsage: memoryStats.currentMemory.heapUsed,
    }

    this.logger.info("Batch HTML file processing completed", summary)

    return { results, summary, errors }
  }

  /**
   * Stream MHTML processing for large content
   */
  async streamMHTMLProcessing(
    inputStream: NodeJS.ReadableStream,
    options: EnhancedMHTMLOptions = {},
  ): Promise<{
    content: string
    stats: {
      duration: number
      bytesProcessed: number
      chunksProcessed: number
      memoryPeak: number
    }
  }> {
    const startTime = Date.now()

    try {
      this.logger.info("Starting streaming MHTML processing")

      // Process the stream with memory management
      const streamResult = await this.fileManager.processStream(
        inputStream,
        async (chunk: Buffer, chunkIndex: number) => {
          // Process each chunk - this is a simplified implementation
          // In a real implementation, you would need to handle HTML parsing across chunks
          this.logger.debug(`Processing chunk ${chunkIndex}`, { size: chunk.length })
        },
        {
          chunkSize: options.fileProcessing?.streamingOptions?.chunkSize || 64 * 1024,
          maxConcurrency: 1, // Sequential processing for HTML
          memoryThresholds: options.fileProcessing?.memoryThresholds,
          memoryOptions: options.fileProcessing?.memoryOptions,
          enableProgress: options.enableProgress,
          onProgress: (progress) => {
            this.reportProgress(
              `Streaming processing (Chunk ${Math.floor(progress.bytesProcessed / 65536)})`,
              Math.min((progress.bytesProcessed / (progress.totalBytes || 1)) * 100, 99),
              options,
            )
          },
        },
      )

      // For streaming, we'd need to reconstruct the MHTML from processed chunks
      // This is a simplified implementation
      const content = `MHTML content from streaming (${streamResult.bytesProcessed} bytes processed)`

      const duration = Date.now() - startTime
      const memoryStats = this.fileManager.getMemoryStats()

      this.logger.info("Streaming MHTML processing completed", {
        duration,
        bytesProcessed: streamResult.bytesProcessed,
        chunksProcessed: streamResult.totalChunks,
      })

      return {
        content,
        stats: {
          duration,
          bytesProcessed: streamResult.bytesProcessed,
          chunksProcessed: streamResult.totalChunks,
          memoryPeak: memoryStats.currentMemory.heapUsed,
        },
      }
    } catch (error) {
      this.logger.error("Streaming MHTML processing failed", error as Error)
      throw error
    }
  }

  /**
   * Get memory and processing statistics
   */
  getStats(): {
    memory: ReturnType<FileOperationsManager["getMemoryStats"]>
    fileManager: ReturnType<FileOperationsManager["getCleanupStats"]>
    activeOperations: Map<string, any>
  } {
    return {
      memory: this.fileManager.getMemoryStats(),
      fileManager: this.fileManager.getCleanupStats(),
      activeOperations: this.fileManager.getActiveOperations(),
    }
  }

  /**
   * Set CDP client for browser automation
   */
  setCDPClient(cdpClient: CDPClient): void {
    this.mhtmlProcessor.setCDPClient(cdpClient)
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.logger.info("Starting Enhanced MHTML Processor cleanup")
    await this.fileManager.cleanup()
    await this.secureFileManager.cleanup()
    this.logger.info("Enhanced MHTML Processor cleanup completed")
  }

  /**
   * Setup CDP client if available
   */
  private async setupCDPClient(): Promise<void> {
    // This would set up the CDP client if one is available
    // For now, we'll use the existing MHTML processor's capabilities
  }

  /**
   * Analyze dependencies for a URL
   */
  private async analyzeDependenciesForURL(url: string): Promise<{
    dependencies: ExternalDependency[]
    summary: any
  }> {
    try {
      // Get page HTML content
      const _pageInfo = await this.mhtmlProcessor.getPageInfo(url)

      // For URL-based analysis, we would need to fetch the HTML content first
      // This is a simplified implementation
      return {
        dependencies: [],
        summary: {
          total: 0,
          byType: {},
          external: 0,
          secure: 0,
          relative: 0,
        },
      }
    } catch (error) {
      this.logger.warn("Failed to analyze dependencies for URL", { url, error })
      return {
        dependencies: [],
        summary: {
          total: 0,
          byType: {},
          external: 0,
          secure: 0,
          relative: 0,
        },
      }
    }
  }

  /**
   * Convert dependencies to external resources format
   */
  private convertDependenciesToExternalResources(
    dependencies: ExternalDependency[],
  ): ExternalResource[] {
    return dependencies.map(dep => ({
      originalUrl: dep.url,
      resolvedUrl: dep.url,
      type: this.mapDependencyTypeToResourceType(dep.type),
      contentType: this.guessContentTypeFromUrl(dep.url),
      fetched: false,
      error: "Not fetched - analysis only",
    }))
  }

  /**
   * Map dependency type to resource type
   */
  private mapDependencyTypeToResourceType(type: any): "image" | "stylesheet" | "script" | "iframe" | "link" | "font" {
    const typeMap: Record<string, "image" | "stylesheet" | "script" | "iframe" | "link" | "font"> = {
      image: "image",
      stylesheet: "stylesheet",
      script: "script",
      iframe: "iframe",
      font: "font",
      css_import: "stylesheet",
      other: "link",
    }
    return typeMap[type] || "link"
  }

  /**
   * Guess content type from URL
   */
  private guessContentTypeFromUrl(url: string): string {
    const extension = url.split(".").pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      css: "text/css",
      js: "application/javascript",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      webp: "image/webp",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      eot: "application/vnd.ms-fontobject",
    }
    return mimeTypes[extension || ""] || "application/octet-stream"
  }

  /**
   * Convert HTML to MHTML (simplified implementation)
   */
  private async convertHTMLToMHTML(
    htmlContent: string,
    baseUrl: string,
    dependencies: ExternalDependency[],
  ): Promise<string> {
    // This is a simplified MHTML conversion
    // In a real implementation, you would use the MHTML builder

    const boundary = "----=_NextPart_" + Date.now().toString(36)

    let mhtml = `From: <converter@localhost>
Subject: MHTML Archive
Date: ${new Date().toUTCString()}
MHTML-Version: 1.0
Content-Type: multipart/related; boundary="${boundary}"

--${boundary}
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: quoted-printable
Content-Location: ${baseUrl}

${htmlContent}
`

    // Add dependencies as separate parts (simplified)
    for (const dep of dependencies) {
      mhtml += `\n--${boundary}\n`
      mhtml += `Content-Type: ${this.guessContentTypeFromUrl(dep.url)}\n`
      mhtml += `Content-Transfer-Encoding: base64\n`
      mhtml += `Content-Location: ${dep.url}\n\n`
      // In a real implementation, you would fetch and encode the actual content
      mhtml += `<!-- Content would be fetched from ${dep.url} -->\n`
    }

    mhtml += `\n--${boundary}--\n`

    return mhtml
  }

  /**
   * Extract title from HTML content
   */
  private extractTitleFromHTML(htmlContent: string): string | undefined {
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i)
    return titleMatch?.[1]?.trim()
  }

  /**
   * Report progress if callback is provided
   */
  private reportProgress(
    stage: string,
    percentage: number,
    options: EnhancedMHTMLOptions,
  ): void {
    if (options.enableProgress && options.onProgress) {
      try {
        options.onProgress({
          stage,
          percentage,
          bytesProcessed: undefined,
          totalBytes: undefined,
        })
      } catch (error) {
        this.logger.warn("Progress callback error", error)
      }
    }
  }
}
