/**
 * Secure File Manager
 *
 * Provides secure temporary file handling, streaming capabilities,
 * and comprehensive error handling for file operations.
 */

import { Buffer } from "node:buffer"
import { randomBytes } from "node:crypto"
import { chmodSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import process from "node:process"
import type { Readable, Writable } from "node:stream"
import { Transform } from "node:stream"
import { pipeline } from "node:stream/promises"

import type { Logger } from "../../architecture/strategies/types.js"

/**
 * File operation options
 */
export interface FileOperationOptions {
  /** Encoding for text files */
  encoding?: BufferEncoding
  /** File permissions (octal) */
  mode?: number
  /** Whether to create directories if they don't exist */
  createDir?: boolean
  /** Maximum file size in bytes */
  maxSize?: number
  /** Timeout for file operations in milliseconds */
  timeout?: number
}

/**
 * Temporary file options
 */
export interface TempFileOptions extends FileOperationOptions {
  /** Prefix for temporary file name */
  prefix?: string
  /** Suffix for temporary file name */
  suffix?: string
  /** Whether to delete file on process exit */
  cleanupOnExit?: boolean
}

/**
 * Streaming operation options
 */
export interface StreamingOptions {
  /** Chunk size for streaming operations */
  chunkSize?: number
  /** High water mark for streams */
  highWaterMark?: number
  /** Progress callback */
  onProgress?: (bytesRead: number, totalBytes: number) => void
  /** Transform function for data processing */
  transform?: (chunk: Buffer) => Buffer | string
}

/**
 * File information
 */
export interface FileInfo {
  /** File path */
  path: string
  /** File size in bytes */
  size: number
  /** Last modified date */
  lastModified: Date
  /** Whether file exists */
  exists: boolean
  /** File permissions */
  mode: number
  /** MIME type if detectable */
  mimeType?: string
}

/**
 * Stream operation result
 */
export interface StreamResult {
  /** Bytes read/written */
  bytesTransferred: number
  /** Operation duration in milliseconds */
  duration: number
  /** Whether operation completed successfully */
  success: boolean
  /** Error message if operation failed */
  error?: string
}

/**
 * File operation error
 */
export class FileOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly filePath?: string,
    public readonly originalError?: Error,
  ) {
    super(message)
    this.name = "FileOperationError"
  }
}

/**
 * Secure File Manager
 *
 * Handles secure temporary file operations, streaming, and resource cleanup
 */
export class SecureFileManager {
  private logger: Logger
  private tempFiles = new Set<string>()
  private tempDirs = new Set<string>()
  private isShuttingDown = false

  constructor(logger: Logger) {
    this.logger = logger
    this.setupCleanupHandlers()
  }

  /**
   * Create a secure temporary directory
   */
  async createTempDirectory(prefix = "html-converter"): Promise<string> {
    if (this.isShuttingDown) {
      throw new FileOperationError("Cannot create temp directory during shutdown", "createTempDir")
    }

    const tempDir = join(tmpdir(), `${prefix}_${randomBytes(8).toString("hex")}`)

    try {
      mkdirSync(tempDir, { mode: 0o700, recursive: true })

      // Verify directory was created with correct permissions
      const stats = statSync(tempDir)
      if (!stats.isDirectory()) {
        throw new Error("Created path is not a directory")
      }

      // Check permissions are secure (owner read/write/execute only)
      if ((stats.mode & 0o777) !== 0o700) {
        // Try to fix permissions
        try {
          chmodSync(tempDir, 0o700)
        } catch (chmodError) {
          // If we can't fix permissions, remove directory and fail
          rmSync(tempDir, { recursive: true, force: true })
          throw new FileOperationError(
            "Failed to set secure permissions on temp directory",
            "createTempDir",
            tempDir,
            chmodError as Error,
          )
        }
      }

      this.tempDirs.add(tempDir)
      this.logger.debug(`Created secure temporary directory: ${tempDir}`)

      return tempDir
    } catch (error) {
      this.logger.error("Failed to create temporary directory", error as Error)
      throw new FileOperationError(
        "Failed to create temporary directory",
        "createTempDir",
        tempDir,
        error as Error,
      )
    }
  }

  /**
   * Create a secure temporary file
   */
  async createTempFile(options: TempFileOptions = {}): Promise<string> {
    if (this.isShuttingDown) {
      throw new FileOperationError("Cannot create temp file during shutdown", "createTempFile")
    }

    const {
      prefix = "temp",
      suffix = "",
      mode = 0o600,
      cleanupOnExit = true,
      _createDir = true,
    } = options

    // Create temporary directory if needed
    const tempDir = await this.createTempDirectory()

    // Generate secure random filename
    const filename = `${prefix}_${randomBytes(12).toString("hex")}${suffix}`
    const filePath = join(tempDir, filename)

    try {
      // Create empty file with secure permissions
      writeFileSync(filePath, "", { mode })

      // Verify file was created with correct permissions
      const stats = statSync(filePath)
      if (!stats.isFile()) {
        throw new Error("Created path is not a file")
      }

      // Check permissions are secure
      if ((stats.mode & 0o777) !== mode) {
        try {
          chmodSync(filePath, mode)
        } catch (chmodError) {
          // If we can't fix permissions, remove file and fail
          unlinkSync(filePath)
          throw new FileOperationError(
            "Failed to set secure permissions on temp file",
            "createTempFile",
            filePath,
            chmodError as Error,
          )
        }
      }

      if (cleanupOnExit) {
        this.tempFiles.add(filePath)
      }

      this.logger.debug(`Created secure temporary file: ${filePath}`)
      return filePath
    } catch (error) {
      this.logger.error("Failed to create temporary file", error as Error)
      throw new FileOperationError(
        "Failed to create temporary file",
        "createTempFile",
        filePath,
        error as Error,
      )
    }
  }

  /**
   * Write data to file securely
   */
  async writeFile(
    filePath: string,
    data: string | Buffer | NodeJS.ArrayBufferView,
    options: FileOperationOptions = {},
  ): Promise<void> {
    const {
      encoding = "utf8",
      mode = 0o644,
      createDir = true,
      maxSize = 100 * 1024 * 1024, // 100MB default
      timeout = 30000, // 30 seconds default
    } = options

    try {
      // Check data size
      const dataSize = typeof data === "string" ? Buffer.byteLength(data) : data.byteLength
      if (dataSize > maxSize) {
        throw new FileOperationError(
          `Data size (${dataSize}) exceeds maximum allowed size (${maxSize})`,
          "writeFile",
          filePath,
        )
      }

      // Create directory if needed
      if (createDir) {
        const dir = dirname(filePath)
        if (!existsSync(dir)) {
          mkdirSync(dir, { mode: 0o755, recursive: true })
        }
      }

      // Write with timeout
      await this.withTimeout(
        writeFileSync(filePath, data, { encoding, mode }),
        timeout,
        `Write operation timed out for file: ${filePath}`,
      )

      this.logger.debug(`Successfully wrote file: ${filePath} (${dataSize} bytes)`)
    } catch (error) {
      this.logger.error(`Failed to write file: ${filePath}`, error as Error)
      if (error instanceof FileOperationError) {
        throw error
      }
      throw new FileOperationError(
        "Failed to write file",
        "writeFile",
        filePath,
        error as Error,
      )
    }
  }

  /**
   * Read data from file securely
   */
  async readFile(
    filePath: string,
    options: FileOperationOptions = {},
  ): Promise<string | Buffer> {
    const {
      encoding = "utf8",
      maxSize = 100 * 1024 * 1024, // 100MB default
      timeout = 30000, // 30 seconds default
    } = options

    try {
      // Check if file exists and get size
      const stats = statSync(filePath)
      if (!stats.isFile()) {
        throw new FileOperationError(
          "Path is not a file or does not exist",
          "readFile",
          filePath,
        )
      }

      if (stats.size > maxSize) {
        throw new FileOperationError(
          `File size (${stats.size}) exceeds maximum allowed size (${maxSize})`,
          "readFile",
          filePath,
        )
      }

      // Read with timeout
      const data = await this.withTimeout(
        readFileSync(filePath, { encoding }),
        timeout,
        `Read operation timed out for file: ${filePath}`,
      )

      this.logger.debug(`Successfully read file: ${filePath} (${stats.size} bytes)`)
      return data
    } catch (error) {
      this.logger.error(`Failed to read file: ${filePath}`, error as Error)
      if (error instanceof FileOperationError) {
        throw error
      }
      throw new FileOperationError(
        "Failed to read file",
        "readFile",
        filePath,
        error as Error,
      )
    }
  }

  /**
   * Stream data from source to destination
   */
  async streamData(
    source: string | Readable,
    destination: string | Writable,
    options: StreamingOptions & FileOperationOptions = {},
  ): Promise<StreamResult> {
    const {
      _chunkSize = 64 * 1024, // 64KB chunks
      highWaterMark = 1024 * 1024, // 1MB buffer
      onProgress,
      transform,
      timeout = 300000, // 5 minutes default
      maxSize = 1024 * 1024 * 1024, // 1GB default
      createDir = true,
    } = options

    const startTime = Date.now()
    let bytesRead = 0
    let bytesWritten = 0

    try {
      // Create source stream if path provided
      const sourceStream = typeof source === "string"
        ? createReadStream(source, { highWaterMark })
        : source

      // Create destination stream if path provided
      let destinationStream: Writable
      if (typeof destination === "string") {
        if (createDir) {
          const dir = dirname(destination)
          if (!existsSync(dir)) {
            mkdirSync(dir, { mode: 0o755, recursive: true })
          }
        }
        destinationStream = createWriteStream(destination, { highWaterMark })
      } else {
        destinationStream = destination
      }

      // Create transform stream if needed
      let transformStream: Transform | undefined
      if (transform) {
        transformStream = new Transform({
          transform(chunk: Buffer, encoding, callback) {
            try {
              const transformed = transform(chunk)
              callback(undefined, Buffer.from(transformed))
            } catch (error) {
              callback(error as Error)
            }
          },
        })
      }

      // Progress tracking
      let totalBytes = 0
      if (typeof source === "string") {
        try {
          const stats = statSync(source)
          totalBytes = stats.size

          if (totalBytes > maxSize) {
            throw new FileOperationError(
              `Source file size (${totalBytes}) exceeds maximum allowed size (${maxSize})`,
              "streamData",
              source,
            )
          }
        } catch {
          // Can't get size for non-files or missing files
        }
      }

      // Progress tracking transform
      const progressTransform = new Transform({
        transform(chunk: Buffer, encoding, callback) {
          bytesRead += chunk.length
          bytesWritten += chunk.length

          if (onProgress) {
            onProgress(bytesRead, totalBytes)
          }

          // Check size limit
          if (maxSize && bytesRead > maxSize) {
            return callback(new FileOperationError(
              `Streamed data size (${bytesRead}) exceeds maximum allowed size (${maxSize})`,
              "streamData",
            ))
          }

          callback(undefined, chunk)
        },
      })

      // Build pipeline
      const streams: NodeJS.ReadableStream[] = [sourceStream, progressTransform]
      if (transformStream) {
        streams.push(transformStream)
      }
      streams.push(destinationStream)

      // Execute pipeline with timeout
      await this.withTimeout(
        pipeline(streams),
        timeout,
        "Streaming operation timed out",
      )

      const duration = Date.now() - startTime
      this.logger.info(`Streaming completed successfully`, {
        bytesTransferred: bytesWritten,
        duration,
        source: typeof source === "string" ? source : "stream",
        destination: typeof destination === "string" ? destination : "stream",
      })

      return {
        bytesTransferred: bytesWritten,
        duration,
        success: true,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Streaming operation failed", error as Error)

      return {
        bytesTransferred: bytesWritten,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = statSync(filePath)
      return {
        path: filePath,
        size: stats.size,
        lastModified: stats.mtime,
        exists: true,
        mode: stats.mode,
        mimeType: this.detectMimeType(filePath),
      }
    } catch {
      return {
        path: filePath,
        size: 0,
        lastModified: new Date(0),
        exists: false,
        mode: 0,
      }
    }
  }

  /**
   * Securely delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
        this.tempFiles.delete(filePath)
        this.logger.debug(`Deleted file: ${filePath}`)
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filePath}`, error as Error)
      throw new FileOperationError(
        "Failed to delete file",
        "deleteFile",
        filePath,
        error as Error,
      )
    }
  }

  /**
   * Securely delete a directory and its contents
   */
  async deleteDirectory(dirPath: string, recursive = true): Promise<void> {
    try {
      if (existsSync(dirPath)) {
        rmSync(dirPath, { recursive, force: true })
        this.tempDirs.delete(dirPath)
        this.logger.debug(`Deleted directory: ${dirPath}`)
      }
    } catch (error) {
      this.logger.error(`Failed to delete directory: ${dirPath}`, error as Error)
      throw new FileOperationError(
        "Failed to delete directory",
        "deleteDirectory",
        dirPath,
        error as Error,
      )
    }
  }

  /**
   * Cleanup all temporary files and directories
   */
  async cleanup(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    this.logger.info("Starting cleanup of temporary files and directories")

    const cleanupPromises: Promise<void>[] = []

    // Cleanup temp files
    for (const filePath of this.tempFiles) {
      cleanupPromises.push(
        this.deleteFile(filePath).catch((error) => {
          this.logger.warn(`Failed to delete temp file: ${filePath}`, error)
        }),
      )
    }

    // Cleanup temp directories
    for (const dirPath of this.tempDirs) {
      cleanupPromises.push(
        this.deleteDirectory(dirPath, true).catch((error) => {
          this.logger.warn(`Failed to delete temp directory: ${dirPath}`, error)
        }),
      )
    }

    await Promise.allSettled(cleanupPromises)

    this.tempFiles.clear()
    this.tempDirs.clear()
    this.logger.info("Completed cleanup of temporary files and directories")
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats(): {
    tempFilesCount: number
    tempDirectoriesCount: number
    isShuttingDown: boolean
  } {
    return {
      tempFilesCount: this.tempFiles.size,
      tempDirectoriesCount: this.tempDirs.size,
      isShuttingDown: this.isShuttingDown,
    }
  }

  /**
   * Setup cleanup handlers for process exit
   */
  private setupCleanupHandlers(): void {
    const cleanup = async (signal: string) => {
      this.logger.info(`Received ${signal}, cleaning up temporary files`)
      await this.cleanup()
    }

    process.once("SIGINT", () => cleanup("SIGINT"))
    process.once("SIGTERM", () => cleanup("SIGTERM"))
    process.once("beforeExit", () => cleanup("beforeExit"))
    process.once("exit", () => cleanup("exit"))
  }

  /**
   * Execute operation with timeout
   */
  private async withTimeout<T>(
    operation: T,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    if (typeof operation === "object" && typeof operation.then === "function") {
      // It's already a promise
      return Promise.race([
        operation as Promise<T>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs),
        ),
      ])
    }

    // Sync operation, just return it
    return operation
  }

  /**
   * Detect MIME type based on file extension
   */
  private detectMimeType(filePath: string): string | undefined {
    const ext = filePath.split(".").pop()?.toLowerCase()

    const mimeTypes: { [key: string]: string } = {
      html: "text/html",
      htm: "text/html",
      css: "text/css",
      js: "application/javascript",
      json: "application/json",
      xml: "application/xml",
      txt: "text/plain",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      webp: "image/webp",
      pdf: "application/pdf",
      zip: "application/zip",
      mht: "message/rfc822",
      mhtml: "message/rfc822",
    }

    return mimeTypes[ext || ""]
  }
}
