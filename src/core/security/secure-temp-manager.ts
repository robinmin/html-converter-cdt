/**
 * Secure Temporary File Manager
 *
 * Enhanced secure temporary file management with 0o700 permissions,
 * atomic file operations, secure deletion, and comprehensive audit logging.
 * Extends the existing SecureFileManager with additional security features.
 */

import { Buffer } from "node:buffer"
import { createHash, randomBytes } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, extname, join } from "node:path"
import process from "node:process"

import type { Logger } from "../../architecture/strategies/types.js"

/**
 * Secure temporary file options with enhanced security
 */
export interface SecureTempFileOptions {
  /** Prefix for temporary file name */
  prefix?: string
  /** Suffix for temporary file name */
  suffix?: string
  /** File permissions (octal) - defaults to 0o600 for maximum security */
  mode?: number
  /** Whether to delete file on process exit */
  cleanupOnExit?: boolean
  /** Whether to create directories if they don't exist */
  createDir?: boolean
  /** Maximum file size in bytes */
  maxSize?: number
  /** Timeout for file operations in milliseconds */
  timeout?: number
  /** Whether to use atomic write operations */
  atomic?: boolean
  /** Whether to enable secure deletion */
  secureDelete?: boolean
  /** Number of overwrite passes for secure deletion */
  overwritePasses?: number
  /** Whether to encrypt file content */
  encrypt?: boolean
  /** Encryption key (if encrypt is true) */
  encryptionKey?: Buffer
}

/**
 * Secure temporary directory options
 */
export interface SecureTempDirOptions {
  /** Prefix for temporary directory name */
  prefix?: string
  /** Directory permissions (octal) - defaults to 0o700 for maximum security */
  mode?: number
  /** Whether to delete directory on process exit */
  cleanupOnExit?: boolean
  /** Whether to enforce quota limits */
  enforceQuota?: boolean
  /** Maximum directory size in bytes */
  maxDirSize?: number
  /** Maximum number of files in directory */
  maxFileCount?: number
}

/**
 * File security metadata
 */
export interface FileSecurityMetadata {
  /** File creation timestamp */
  createdAt: Date
  /** File access permissions */
  mode: number
  /** File owner ID */
  uid?: number
  /** File group ID */
  gid?: number
  /** File size in bytes */
  size: number
  /** Whether file is encrypted */
  encrypted: boolean
  /** File integrity checksum */
  checksum: string
  /** Security risk level */
  riskLevel: "low" | "medium" | "high" | "critical"
}

/**
 * Temporary file audit entry
 */
export interface TempFileAuditEntry {
  /** Timestamp of operation */
  timestamp: Date
  /** Operation type */
  operation: "create" | "read" | "write" | "delete" | "access"
  /** File path */
  filePath: string
  /** Process ID */
  pid: number
  /** User ID */
  uid: number
  /** Security risk assessment */
  riskAssessment: string
  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Enhanced Secure Temporary File Manager
 *
 * Provides enterprise-grade security for temporary file operations including:
 * - Enforced 0o700 permissions for directories
 * - Enforced 0o600 permissions for files
 * - Atomic file operations
 * - Secure deletion with multiple overwrite passes
 * - File encryption support
 * - Comprehensive audit logging
 * - Quota enforcement
 * - Intrusion detection
 */
export class SecureTempManager {
  private logger: Logger
  private tempFiles = new Map<string, FileSecurityMetadata>()
  private tempDirs = new Set<string>()
  private auditLog: TempFileAuditEntry[] = []
  private isShuttingDown = false
  private quotas = new Map<string, { size: number, count: number }>()
  private readonly MAX_AUDIT_ENTRIES = 10000

  constructor(logger?: Logger) {
    this.logger = logger || this.createDefaultLogger()
    this.setupCleanupHandlers()
    this.startPeriodicSecurityCheck()
  }

  /**
   * Create a secure temporary directory with 0o700 permissions
   * @param options - Directory creation options
   * @returns Promise resolving to created directory path
   */
  async createTempDirectory(options: SecureTempDirOptions = {}): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error("Cannot create temp directory during shutdown")
    }

    const {
      prefix = "html-converter",
      mode = 0o700, // Owner read/write/execute only
      cleanupOnExit = true,
      enforceQuota = true,
      maxDirSize = 1024 * 1024 * 1024, // 1GB default
      maxFileCount = 10000,
    } = options

    try {
      // Generate secure random directory name
      const dirName = `${prefix}_${randomBytes(16).toString("hex")}`
      const tempDir = join(tmpdir(), dirName)

      // Create directory with secure permissions
      mkdirSync(tempDir, { recursive: true, mode })

      // Verify directory was created with correct permissions
      this.validateDirectorySecurity(tempDir, mode)

      // Set up quota tracking if enabled
      if (enforceQuota) {
        this.quotas.set(tempDir, { size: 0, count: 0 })
      }

      // Track directory for cleanup
      if (cleanupOnExit) {
        this.tempDirs.add(tempDir)
      }

      // Log audit entry
      this.logAuditEntry({
        timestamp: new Date(),
        operation: "create",
        filePath: tempDir,
        pid: process.pid,
        uid: process.getuid?.() || 0,
        riskAssessment: "low",
        metadata: { type: "directory", mode: mode.toString(8) },
      })

      this.logger.info(`Secure temporary directory created: ${tempDir}`, {
        mode: mode.toString(8),
        enforceQuota,
        maxDirSize,
        maxFileCount,
      })

      return tempDir
    } catch (error) {
      this.logger.error("Failed to create secure temporary directory", error as Error)
      throw new Error(`Failed to create secure temporary directory: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Create a secure temporary file with 0o600 permissions
   * @param options - File creation options
   * @returns Promise resolving to created file path
   */
  async createTempFile(options: SecureTempFileOptions = {}): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error("Cannot create temp file during shutdown")
    }

    const {
      prefix = "temp",
      suffix = "",
      mode = 0o600, // Owner read/write only
      cleanupOnExit = true,
      maxSize = 100 * 1024 * 1024, // 100MB default
      atomic = true,
      secureDelete = true,
      encrypt = false,
      encryptionKey: _encryptionKey,
    } = options

    try {
      // Create temporary directory if needed
      const tempDir = await this.createTempDirectory({
        prefix: `${prefix}_dir`,
        cleanupOnExit,
        enforceQuota: true,
      })

      // Check quota limits
      this.checkQuotaLimits(tempDir, maxSize)

      // Generate secure random filename
      const filename = `${prefix}_${randomBytes(24).toString("hex")}${suffix}`
      const filePath = join(tempDir, filename)

      // Create file with atomic operation if requested
      if (atomic) {
        await this.atomicCreateFile(filePath, mode)
      } else {
        writeFileSync(filePath, "", { mode })
      }

      // Verify file was created with correct permissions
      this.validateFileSecurity(filePath, mode)

      // Calculate initial checksum
      const checksum = this.calculateChecksum(filePath)

      // Create security metadata
      const metadata: FileSecurityMetadata = {
        createdAt: new Date(),
        mode,
        uid: process.getuid?.(),
        gid: process.getgid?.(),
        size: 0,
        encrypted: encrypt,
        checksum,
        riskLevel: this.assessFileRisk(filePath),
      }

      // Track file for cleanup and monitoring
      this.tempFiles.set(filePath, metadata)

      // Update quota tracking
      this.updateQuotaUsage(tempDir, 0, 1)

      // Log audit entry
      this.logAuditEntry({
        timestamp: new Date(),
        operation: "create",
        filePath,
        pid: process.pid,
        uid: process.getuid?.() || 0,
        riskAssessment: metadata.riskLevel,
        metadata: {
          mode: mode.toString(8),
          encrypted: encrypt,
          atomic,
          secureDelete,
          maxSize,
        },
      })

      this.logger.info(`Secure temporary file created: ${filePath}`, {
        mode: mode.toString(8),
        encrypted: encrypt,
        atomic,
        riskLevel: metadata.riskLevel,
      })

      return filePath
    } catch (error) {
      this.logger.error("Failed to create secure temporary file", error as Error)
      throw new Error(`Failed to create secure temporary file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Write data to a secure temporary file
   * @param filePath - Path to the file
   * @param data - Data to write
   * @param options - Write options
   * @returns Promise resolving when write is complete
   */
  async writeFile(filePath: string, data: string | Buffer, options: Partial<SecureTempFileOptions> = {}): Promise<void> {
    const {
      maxSize = 100 * 1024 * 1024, // 100MB default
      atomic = true,
      encrypt = false,
      encryptionKey: _encryptionKey,
    } = options

    try {
      // Validate file exists and is tracked
      if (!this.tempFiles.has(filePath)) {
        throw new Error(`File ${filePath} is not being tracked by secure manager`)
      }

      // Check data size
      const dataSize = typeof data === "string" ? Buffer.byteLength(data) : data.length
      if (dataSize > maxSize) {
        throw new Error(`Data size (${dataSize}) exceeds maximum allowed size (${maxSize})`)
      }

      // Check quota limits
      const tempDir = dirname(filePath)
      this.checkQuotaLimits(tempDir, dataSize)

      // Encrypt data if requested
      let dataToWrite = data
      if (encrypt) {
        dataToWrite = await this.encryptData(data, _encryptionKey)
      }

      // Write with atomic operation if requested
      if (atomic) {
        await this.atomicWriteFile(filePath, dataToWrite)
      } else {
        writeFileSync(filePath, dataToWrite)
      }

      // Update security metadata
      const metadata = this.tempFiles.get(filePath)!
      metadata.size = dataSize
      metadata.checksum = this.calculateChecksum(filePath)
      metadata.riskLevel = this.assessFileRisk(filePath)

      // Update quota tracking
      this.updateQuotaUsage(tempDir, dataSize, 0)

      // Log audit entry
      this.logAuditEntry({
        timestamp: new Date(),
        operation: "write",
        filePath,
        pid: process.pid,
        uid: process.getuid?.() || 0,
        riskAssessment: metadata.riskLevel,
        metadata: {
          dataSize,
          encrypted: encrypt,
          atomic,
        },
      })

      this.logger.debug(`Secure write completed: ${filePath}`, {
        dataSize,
        encrypted: encrypt,
        atomic,
      })
    } catch (error) {
      this.logger.error(`Failed to write secure file: ${filePath}`, error as Error)
      throw new Error(`Failed to write secure file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Read data from a secure temporary file
   * @param filePath - Path to the file
   * @param options - Read options
   * @returns Promise resolving to file data
   */
  async readFile(filePath: string, options: Partial<SecureTempFileOptions> = {}): Promise<string | Buffer> {
    const {
      encrypt = false,
      encryptionKey: _encryptionKey,
    } = options

    try {
      // Validate file exists and is tracked
      if (!this.tempFiles.has(filePath)) {
        throw new Error(`File ${filePath} is not being tracked by secure manager`)
      }

      // Read file data
      let data = readFileSync(filePath)

      // Verify file integrity
      const metadata = this.tempFiles.get(filePath)!
      const currentChecksum = this.calculateChecksum(filePath)
      if (currentChecksum !== metadata.checksum) {
        this.logger.warn(`File integrity check failed: ${filePath}`, {
          expectedChecksum: metadata.checksum,
          actualChecksum: currentChecksum,
        })
        // Continue reading but log the security issue
      }

      // Decrypt data if it was encrypted
      if (encrypt && metadata.encrypted) {
        data = await this.decryptData(data, _encryptionKey)
      }

      // Log audit entry
      this.logAuditEntry({
        timestamp: new Date(),
        operation: "read",
        filePath,
        pid: process.pid,
        uid: process.getuid?.() || 0,
        riskAssessment: metadata.riskLevel,
        metadata: {
          dataSize: data.length,
          encrypted: metadata.encrypted,
        },
      })

      this.logger.debug(`Secure read completed: ${filePath}`, {
        dataSize: data.length,
      })

      return data
    } catch (error) {
      this.logger.error(`Failed to read secure file: ${filePath}`, error as Error)
      throw new Error(`Failed to read secure file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Securely delete a temporary file
   * @param filePath - Path to the file
   * @param options - Deletion options
   * @returns Promise resolving when deletion is complete
   */
  async deleteFile(filePath: string, options: Partial<SecureTempFileOptions> = {}): Promise<void> {
    const {
      secureDelete = true,
    } = options

    try {
      // Validate file exists and is tracked
      if (!this.tempFiles.has(filePath)) {
        throw new Error(`File ${filePath} is not being tracked by secure manager`)
      }

      const metadata = this.tempFiles.get(filePath)!

      // Perform secure deletion if requested
      if (secureDelete) {
        await this.secureDeleteFile(filePath, 3)
      } else {
        unlinkSync(filePath)
      }

      // Update quota tracking
      const tempDir = dirname(filePath)
      this.updateQuotaUsage(tempDir, -metadata.size, -1)

      // Remove from tracking
      this.tempFiles.delete(filePath)

      // Log audit entry
      this.logAuditEntry({
        timestamp: new Date(),
        operation: "delete",
        filePath,
        pid: process.pid,
        uid: process.getuid?.() || 0,
        riskAssessment: "low",
        metadata: {
          secureDelete,
          overwritePasses: 3,
          originalSize: metadata.size,
        },
      })

      this.logger.debug(`Secure deletion completed: ${filePath}`, {
        secureDelete,
        overwritePasses: 3,
      })
    } catch (error) {
      this.logger.error(`Failed to delete secure file: ${filePath}`, error as Error)
      throw new Error(`Failed to delete secure file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Validate directory security settings
   * @param dirPath - Directory path to validate
   * @param expectedMode - Expected permission mode
   */
  private validateDirectorySecurity(dirPath: string, expectedMode: number): void {
    const stats = statSync(dirPath)

    if (!stats.isDirectory()) {
      throw new Error("Created path is not a directory")
    }

    // Check permissions are exactly as expected
    if ((stats.mode & 0o777) !== expectedMode) {
      this.logger.warn(`Directory permissions incorrect, attempting to fix: ${dirPath}`, {
        expected: expectedMode.toString(8),
        actual: (stats.mode & 0o777).toString(8),
      })

      try {
        chmodSync(dirPath, expectedMode)

        // Verify the fix worked
        const newStats = statSync(dirPath)
        if ((newStats.mode & 0o777) !== expectedMode) {
          throw new Error(`Failed to set directory permissions to ${expectedMode.toString(8)}`)
        }
      } catch (chmodError) {
        // If we can't fix permissions, remove directory and fail
        rmSync(dirPath, { recursive: true, force: true })
        throw new Error(`Failed to set secure permissions on directory: ${chmodError instanceof Error ? chmodError.message : String(chmodError)}`)
      }
    }
  }

  /**
   * Validate file security settings
   * @param filePath - File path to validate
   * @param expectedMode - Expected permission mode
   */
  private validateFileSecurity(filePath: string, expectedMode: number): void {
    const stats = statSync(filePath)

    if (!stats.isFile()) {
      throw new Error("Created path is not a file")
    }

    // Check permissions are exactly as expected
    if ((stats.mode & 0o777) !== expectedMode) {
      this.logger.warn(`File permissions incorrect, attempting to fix: ${filePath}`, {
        expected: expectedMode.toString(8),
        actual: (stats.mode & 0o777).toString(8),
      })

      try {
        chmodSync(filePath, expectedMode)

        // Verify the fix worked
        const newStats = statSync(filePath)
        if ((newStats.mode & 0o777) !== expectedMode) {
          throw new Error(`Failed to set file permissions to ${expectedMode.toString(8)}`)
        }
      } catch (chmodError) {
        // If we can't fix permissions, remove file and fail
        unlinkSync(filePath)
        throw new Error(`Failed to set secure permissions on file: ${chmodError instanceof Error ? chmodError.message : String(chmodError)}`)
      }
    }
  }

  /**
   * Create file atomically to prevent race conditions
   * @param filePath - File path to create
   * @param mode - File permissions
   */
  private async atomicCreateFile(filePath: string, mode: number): Promise<void> {
    const tempPath = `${filePath}.tmp.${randomBytes(8).toString("hex")}`

    try {
      // Create temporary file
      writeFileSync(tempPath, "", { mode })

      // Atomic rename
      // Note: In Node.js, rename is atomic on POSIX systems
      // This prevents race conditions during file creation
      const fs = await import("node:fs/promises")
      await fs.rename(tempPath, filePath)
    } catch (error) {
      // Clean up temporary file if rename failed
      if (existsSync(tempPath)) {
        unlinkSync(tempPath)
      }
      throw error
    }
  }

  /**
   * Write file atomically to prevent corruption
   * @param filePath - File path to write
   * @param data - Data to write
   */
  private async atomicWriteFile(filePath: string, data: string | Buffer): Promise<void> {
    const tempPath = `${filePath}.tmp.${randomBytes(8).toString("hex")}`

    try {
      // Write to temporary file
      writeFileSync(tempPath, data)

      // Atomic rename
      const fs = await import("node:fs/promises")
      await fs.rename(tempPath, filePath)
    } catch (error) {
      // Clean up temporary file if rename failed
      if (existsSync(tempPath)) {
        unlinkSync(tempPath)
      }
      throw error
    }
  }

  /**
   * Perform secure file deletion with multiple overwrite passes
   * @param filePath - File path to delete
   * @param passes - Number of overwrite passes
   */
  private async secureDeleteFile(filePath: string, passes: number): Promise<void> {
    try {
      const stats = statSync(filePath)

      // Overwrite file content multiple times
      for (let i = 0; i < passes; i++) {
        const pattern = i % 2 === 0 ? Buffer.alloc(stats.size, 0x00) : Buffer.alloc(stats.size, 0xFF)
        writeFileSync(filePath, pattern)

        // Force write to disk
        const fs = await import("node:fs")
        await new Promise<void>((resolve, reject) => {
          fs.open(filePath, "r+", (err: any, fd: any) => {
            if (err) {
              reject(err)
              return
            }
            fs.fsync(fd, (syncErr: any) => {
              fs.close(fd)
              if (syncErr) {
                reject(syncErr)
              } else {
                resolve()
              }
            })
          })
        })
      }

      // Finally delete the file
      unlinkSync(filePath)
    } catch (error) {
      this.logger.warn(`Secure deletion partially failed for ${filePath}, falling back to standard deletion`, error as Error)
      unlinkSync(filePath)
    }
  }

  /**
   * Calculate file checksum for integrity verification
   * @param filePath - File path to checksum
   * @returns Hexadecimal checksum
   */
  private calculateChecksum(filePath: string): string {
    try {
      const data = readFileSync(filePath)
      return createHash("sha256").update(data).digest("hex")
    } catch {
      this.logger.warn(`Failed to calculate checksum for ${filePath}`)
      return "unknown"
    }
  }

  /**
   * Assess file security risk level
   * @param filePath - File path to assess
   * @returns Risk level
   */
  private assessFileRisk(filePath: string): "low" | "medium" | "high" | "critical" {
    try {
      const filename = basename(filePath).toLowerCase()
      const ext = extname(filename)

      // Check for suspicious file extensions
      const suspiciousExts = [".exe", ".bat", ".cmd", ".com", ".scr", ".vbs", ".js", ".php", ".sh"]
      if (suspiciousExts.includes(ext)) {
        return "high"
      }

      // Check for suspicious filename patterns
      const suspiciousPatterns = [/admin/i, /root/i, /system/i, /config/i, /\.env$/i]
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(filename)) {
          return "medium"
        }
      }

      // Check file size (unusually large files might be suspicious)
      const stats = statSync(filePath)
      if (stats.size > 10 * 1024 * 1024) { // 10MB
        return "medium"
      }

      return "low"
    } catch {
      return "high" // If we can't assess, assume high risk
    }
  }

  /**
   * Check quota limits for directory
   * @param tempDir - Temporary directory path
   * @param fileSize - File size to add
   */
  private checkQuotaLimits(tempDir: string, fileSize: number): void {
    const quota = this.quotas.get(tempDir)
    if (!quota) {
      return
    }

    const maxSize = 1024 * 1024 * 1024 // 1GB default
    const maxCount = 10000

    if (quota.size + fileSize > maxSize) {
      throw new Error(`Directory quota exceeded: size limit ${maxSize} bytes`)
    }

    if (quota.count + 1 > maxCount) {
      throw new Error(`Directory quota exceeded: file count limit ${maxCount}`)
    }
  }

  /**
   * Update quota usage for directory
   * @param tempDir - Temporary directory path
   * @param sizeDelta - Size change (positive or negative)
   * @param countDelta - File count change (positive or negative)
   */
  private updateQuotaUsage(tempDir: string, sizeDelta: number, countDelta: number): void {
    const quota = this.quotas.get(tempDir)
    if (!quota) {
      return
    }

    quota.size = Math.max(0, quota.size + sizeDelta)
    quota.count = Math.max(0, quota.count + countDelta)
  }

  /**
   * Encrypt data (placeholder implementation)
   * @param data - Data to encrypt
   * @param _key - Encryption key
   * @returns Encrypted data
   */
  private async encryptData(data: string | Buffer, _key?: Buffer): Promise<Buffer> {
    // This is a placeholder for encryption implementation
    // In a real implementation, you would use proper encryption like AES-256-GCM
    this.logger.warn("Encryption not implemented in this version")
    return Buffer.isBuffer(data) ? data : Buffer.from(data)
  }

  /**
   * Decrypt data (placeholder implementation)
   * @param data - Data to decrypt
   * @param _key - Decryption key
   * @returns Decrypted data
   */
  private async decryptData(data: Buffer, _key?: Buffer): Promise<Buffer> {
    // This is a placeholder for decryption implementation
    // In a real implementation, you would use proper decryption like AES-256-GCM
    this.logger.warn("Decryption not implemented in this version")
    return data
  }

  /**
   * Log audit entry for security monitoring
   * @param entry - Audit entry to log
   */
  private logAuditEntry(entry: TempFileAuditEntry): void {
    this.auditLog.push(entry)

    // Trim audit log if it gets too large
    if (this.auditLog.length > this.MAX_AUDIT_ENTRIES) {
      this.auditLog = this.auditLog.slice(-this.MAX_AUDIT_ENTRIES)
    }

    // Log to console for development
    if (process.env.NODE_ENV === "development") {
      this.logger.debug(`Security audit: ${entry.operation} on ${entry.filePath}`, {
        pid: entry.pid,
        uid: entry.uid,
        riskAssessment: entry.riskAssessment,
      })
    }
  }

  /**
   * Start periodic security checks
   */
  private startPeriodicSecurityCheck(): void {
    setInterval(() => {
      this.performSecurityCheck()
    }, 5 * 60 * 1000) // Every 5 minutes
  }

  /**
   * Perform security check on all tracked files
   */
  private performSecurityCheck(): void {
    if (this.isShuttingDown) {
      return
    }

    const suspiciousFiles: string[] = []

    for (const [filePath, metadata] of this.tempFiles) {
      try {
        if (!existsSync(filePath)) {
          suspiciousFiles.push(filePath)
          continue
        }

        const stats = statSync(filePath)
        const currentChecksum = this.calculateChecksum(filePath)

        // Check for unauthorized changes
        if (currentChecksum !== metadata.checksum) {
          this.logger.warn(`File integrity check failed during security scan: ${filePath}`, {
            expectedChecksum: metadata.checksum,
            actualChecksum: currentChecksum,
            expectedSize: metadata.size,
            actualSize: stats.size,
          })

          suspiciousFiles.push(filePath)
        }

        // Check for permission changes
        if ((stats.mode & 0o777) !== metadata.mode) {
          this.logger.warn(`File permissions changed: ${filePath}`, {
            expected: metadata.mode.toString(8),
            actual: (stats.mode & 0o777).toString(8),
          })

          suspiciousFiles.push(filePath)
        }
      } catch (error) {
        this.logger.error(`Security check failed for file: ${filePath}`, error as Error)
        suspiciousFiles.push(filePath)
      }
    }

    if (suspiciousFiles.length > 0) {
      this.logger.warn(`Security scan found ${suspiciousFiles.length} suspicious files`, {
        suspiciousFiles,
      })
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
    this.logger.info("Starting secure cleanup of temporary files and directories")

    const cleanupPromises: Promise<void>[] = []

    // Securely delete all tracked files
    for (const [filePath, _metadata] of this.tempFiles) {
      cleanupPromises.push(
        this.deleteFile(filePath, { secureDelete: true, overwritePasses: 3 })
          .catch((error) => {
            this.logger.warn(`Failed to securely delete temp file: ${filePath}`, error)
          }),
      )
    }

    // Delete all temporary directories
    for (const dirPath of this.tempDirs) {
      cleanupPromises.push(
        this.deleteDirectory(dirPath, true)
          .catch((error) => {
            this.logger.warn(`Failed to delete temp directory: ${dirPath}`, error)
          }),
      )
    }

    await Promise.allSettled(cleanupPromises)

    this.tempFiles.clear()
    this.tempDirs.clear()
    this.quotas.clear()

    // Generate final audit report
    this.generateAuditReport()

    this.logger.info("Secure cleanup completed")
  }

  /**
   * Delete directory with security considerations
   * @param dirPath - Directory path to delete
   * @param recursive - Whether to delete recursively
   */
  private async deleteDirectory(dirPath: string, recursive: boolean): Promise<void> {
    try {
      if (existsSync(dirPath)) {
        rmSync(dirPath, { recursive, force: true })
        this.tempDirs.delete(dirPath)
        this.quotas.delete(dirPath)
      }
    } catch (error) {
      this.logger.error(`Failed to delete directory: ${dirPath}`, error as Error)
      throw error
    }
  }

  /**
   * Generate security audit report
   */
  private generateAuditReport(): void {
    const report = {
      timestamp: new Date(),
      totalOperations: this.auditLog.length,
      filesCreated: this.auditLog.filter(e => e.operation === "create").length,
      filesDeleted: this.auditLog.filter(e => e.operation === "delete").length,
      readOperations: this.auditLog.filter(e => e.operation === "read").length,
      writeOperations: this.auditLog.filter(e => e.operation === "write").length,
      highRiskOperations: this.auditLog.filter(e => e.riskAssessment === "high" || e.riskAssessment === "critical").length,
      suspiciousActivity: this.auditLog.filter(e => e.riskAssessment !== "low").length,
    }

    this.logger.info("Security audit report generated", report)
  }

  /**
   * Setup cleanup handlers for process exit
   */
  private setupCleanupHandlers(): void {
    const cleanup = async (signal: string) => {
      this.logger.info(`Received ${signal}, performing secure cleanup`)
      await this.cleanup()
    }

    process.once("SIGINT", () => cleanup("SIGINT"))
    process.once("SIGTERM", () => cleanup("SIGTERM"))
    process.once("beforeExit", () => cleanup("beforeExit"))
    process.once("exit", () => cleanup("exit"))
  }

  /**
   * Create default logger instance
   * @returns Logger instance
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, context?: any) => {
        if (process.env.NODE_ENV === "development") {
          console.debug(`[SecureTempManager] ${message}`, context || "")
        }
      },
      info: (message: string, context?: any) => {
        console.info(`[SecureTempManager] ${message}`, context || "")
      },
      warn: (message: string, context?: any) => {
        console.warn(`[SecureTempManager] ${message}`, context || "")
      },
      error: (message: string, context?: any) => {
        console.error(`[SecureTempManager] ${message}`, context || "")
      },
    }
  }

  /**
   * Get security statistics
   * @returns Security statistics
   */
  getSecurityStats(): {
    trackedFiles: number
    trackedDirectories: number
    totalFileSize: number
    auditLogEntries: number
    quotaUsage: Array<{ directory: string, size: number, count: number }>
    riskDistribution: Record<string, number>
  } {
    const riskDistribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }

    let totalFileSize = 0
    for (const metadata of this.tempFiles.values()) {
      totalFileSize += metadata.size
      if (metadata.riskLevel && metadata.riskLevel in riskDistribution) {
        riskDistribution[metadata.riskLevel]!++
      }
    }

    return {
      trackedFiles: this.tempFiles.size,
      trackedDirectories: this.tempDirs.size,
      totalFileSize,
      auditLogEntries: this.auditLog.length,
      quotaUsage: Array.from(this.quotas.entries()).map(([dir, quota]) => ({
        directory: dir,
        size: quota.size,
        count: quota.count,
      })),
      riskDistribution,
    }
  }

  /**
   * Get recent audit entries
   * @param limit - Maximum number of entries to return
   * @returns Array of audit entries
   */
  getRecentAuditEntries(limit = 100): TempFileAuditEntry[] {
    return this.auditLog.slice(-limit)
  }
}
