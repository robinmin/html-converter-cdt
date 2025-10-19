/**
 * Security Configuration and Auditing System
 *
 * Comprehensive security manager that coordinates all security components,
 * provides environment-based configuration, security auditing, and centralized error handling.
 */

import process from "node:process"

import type { Logger } from "../../architecture/strategies/types.js"
import { InputValidator } from "../utils/validation.js"

import { ProcessIsolationManager } from "./process-isolation.js"
import { SecureTempManager } from "./secure-temp-manager.js"

/**
 * Security configuration from environment variables
 */
export interface SecurityConfig {
  /** Network security settings */
  network: {
    /** Whether to allow private IP access */
    allowPrivateIPs: boolean
    /** Whether to allow localhost access */
    allowLocalhost: boolean
    /** Maximum network request timeout */
    networkTimeout: number
    /** Maximum request size in bytes */
    maxRequestSize: number
    /** List of allowed domains */
    allowedDomains: string[]
    /** List of blocked domains */
    blockedDomains: string[]
  }
  /** File system security settings */
  fileSystem: {
    /** Maximum file size in bytes */
    maxFileSize: number
    /** Allowed file extensions */
    allowedExtensions: string[]
    /** Blocked file patterns */
    blockedPatterns: string[]
    /** Whether to enforce file permissions */
    enforcePermissions: boolean
  }
  /** Chrome security settings */
  chrome: {
    /** Security level (low, standard, high, maximum) */
    securityLevel: "low" | "standard" | "high" | "maximum"
    /** Whether to enable sandbox */
    enableSandbox: boolean
    /** Whether to disable web security */
    disableWebSecurity: boolean
    /** Whether to allow file access from files */
    allowFileAccessFromFiles: boolean
  }
  /** Process isolation settings */
  isolation: {
    /** Whether to enable process isolation */
    enabled: boolean
    /** Maximum memory per process in MB */
    maxMemoryMB: number
    /** Maximum CPU usage percentage */
    maxCpuPercentage: number
    /** Whether to enable resource monitoring */
    resourceMonitoring: boolean
  }
  /** Auditing settings */
  auditing: {
    /** Whether to enable security auditing */
    enabled: boolean
    /** Maximum number of audit entries */
    maxEntries: number
    /** Whether to log to console */
    logToConsole: boolean
    /** Whether to log to file */
    logToFile: boolean
    /** Log file path */
    logFilePath?: string
  }
}

/**
 * Security audit event
 */
export interface SecurityAuditEvent {
  /** Unique event ID */
  id: string
  /** Timestamp of event */
  timestamp: Date
  /** Event severity */
  severity: "info" | "warning" | "error" | "critical"
  /** Event category */
  category: "network" | "filesystem" | "process" | "validation" | "general"
  /** Event source */
  source: string
  /** Event message */
  message: string
  /** Additional event details */
  details?: Record<string, any>
  /** Process ID if applicable */
  processId?: string
  /** User ID if applicable */
  userId?: string
  /** IP address if applicable */
  ipAddress?: string
  /** Whether event was blocked/rejected */
  blocked: boolean
}

/**
 * Security statistics
 */
export interface SecurityStatistics {
  /** Total security events */
  totalEvents: number
  /** Blocked events */
  blockedEvents: number
  /** Critical events */
  criticalEvents: number
  /** Events by category */
  eventsByCategory: Record<string, number>
  /** Events by severity */
  eventsBySeverity: Record<string, number>
  /** Active processes */
  activeProcesses: number
  /** Total network requests */
  totalNetworkRequests: number
  /** Blocked network requests */
  blockedNetworkRequests: number
  /** Total file operations */
  totalFileOperations: number
  /** Blocked file operations */
  blockedFileOperations: number
}

/**
 * Security error without information leakage
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly category: string,
    public readonly severity: "warning" | "error" | "critical",
    public readonly details?: Record<string, any>,
  ) {
    super(message)
    this.name = "SecurityError"
  }

  /**
   * Get safe error message for external users
   */
  getSafeMessage(): string {
    // Return generic message to avoid information leakage
    switch (this.severity) {
      case "critical":
        return "A security violation occurred and the operation was blocked."
      case "error":
        return "The operation was blocked for security reasons."
      case "warning":
        return "The operation completed with security warnings."
      default:
        return "A security-related issue occurred."
    }
  }
}

/**
 * Security Manager - Central coordinator for all security components
 *
 * Provides:
 * - Environment-based security configuration
 * - Centralized security auditing
 * - Integration with all security components
 * - Security-focused error handling
 * - Comprehensive monitoring and reporting
 */
export class SecurityManager {
  private logger: Logger
  private config: SecurityConfig
  private inputValidator: InputValidator
  private tempManager: SecureTempManager
  private processManager: ProcessIsolationManager
  private auditEvents: SecurityAuditEvent[] = []
  private isInitialized = false

  constructor(logger?: Logger) {
    this.logger = logger || this.createDefaultLogger()
    this.config = this.loadSecurityConfig()
    this.inputValidator = new InputValidator(this.logger)
    this.tempManager = new SecureTempManager(this.logger)
    this.processManager = new ProcessIsolationManager(this.logger)
  }

  /**
   * Initialize the security manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      this.logSecurityEvent("info", "general", "Security manager initializing", {
        config: this.sanitizeConfigForLogging(),
      })

      // Validate security configuration
      this.validateSecurityConfig()

      // Initialize security components
      await this.initializeSecurityComponents()

      this.isInitialized = true
      this.logSecurityEvent("info", "general", "Security manager initialized successfully")
    } catch (error) {
      this.logSecurityEvent("critical", "general", "Security manager initialization failed", {
        error: this.sanitizeErrorForLogging(error),
      })
      throw new SecurityError(
        "Security initialization failed",
        "general",
        "critical",
        { originalError: error instanceof Error ? error.message : String(error) },
      )
    }
  }

  /**
   * Load security configuration from environment variables
   * @returns Security configuration
   */
  private loadSecurityConfig(): SecurityConfig {
    return {
      network: {
        allowPrivateIPs: this.parseEnvBool("HTML_CONVERTER_ALLOW_PRIVATE_IPS", false),
        allowLocalhost: this.parseEnvBool("HTML_CONVERTER_ALLOW_LOCALHOST", false),
        networkTimeout: this.parseEnvNumber("HTML_CONVERTER_NETWORK_TIMEOUT", 30000),
        maxRequestSize: this.parseEnvNumber("HTML_CONVERTER_MAX_REQUEST_SIZE", 10 * 1024 * 1024),
        allowedDomains: this.parseEnvArray("HTML_CONVERTER_ALLOWED_DOMAINS", []),
        blockedDomains: this.parseEnvArray("HTML_CONVERTER_BLOCKED_DOMAINS", []),
      },
      fileSystem: {
        maxFileSize: this.parseEnvNumber("HTML_CONVERTER_MAX_FILE_SIZE", 100 * 1024 * 1024), // 100MB
        allowedExtensions: this.parseEnvArray("HTML_CONVERTER_ALLOWED_EXTENSIONS", [
          ".html",
          ".htm",
          ".css",
          ".js",
          ".json",
          ".xml",
          ".txt",
          ".md",
        ]),
        blockedPatterns: this.parseEnvArray("HTML_CONVERTER_BLOCKED_PATTERNS", [
          "**/.env",
          "**/.ssh/**",
          "**/.aws/**",
          "**/.config/**",
        ]),
        enforcePermissions: this.parseEnvBool("HTML_CONVERTER_ENFORCE_PERMISSIONS", true),
      },
      chrome: {
        securityLevel: (process.env.HTML_CONVERTER_SECURITY_LEVEL as any) || "standard",
        enableSandbox: this.parseEnvBool("HTML_CONVERTER_ENABLE_SANDBOX", true),
        disableWebSecurity: this.parseEnvBool("HTML_CONVERTER_DISABLE_WEB_SECURITY", false),
        allowFileAccessFromFiles: this.parseEnvBool("HTML_CONVERTER_ALLOW_FILE_ACCESS", false),
      },
      isolation: {
        enabled: this.parseEnvBool("HTML_CONVERTER_ENABLE_PROCESS_ISOLATION", true),
        maxMemoryMB: this.parseEnvNumber("HTML_CONVERTER_MAX_PROCESS_MEMORY", 1024),
        maxCpuPercentage: this.parseEnvNumber("HTML_CONVERTER_MAX_PROCESS_CPU", 80),
        resourceMonitoring: this.parseEnvBool("HTML_CONVERTER_RESOURCE_MONITORING", true),
      },
      auditing: {
        enabled: this.parseEnvBool("HTML_CONVERTER_ENABLE_AUDITING", true),
        maxEntries: this.parseEnvNumber("HTML_CONVERTER_MAX_AUDIT_ENTRIES", 10000),
        logToConsole: this.parseEnvBool("HTML_CONVERTER_AUDIT_LOG_CONSOLE", true),
        logToFile: this.parseEnvBool("HTML_CONVERTER_AUDIT_LOG_FILE", false),
        logFilePath: process.env.HTML_CONVERTER_AUDIT_LOG_PATH,
      },
    }
  }

  /**
   * Parse boolean environment variable
   * @param key - Environment variable key
   * @param defaultValue - Default value if not set
   * @returns Parsed boolean value
   */
  private parseEnvBool(key: string, defaultValue: boolean): boolean {
    const value = process.env[key]?.toLowerCase()
    if (value === undefined) {
      return defaultValue
    }
    return ["true", "1", "yes", "on"].includes(value)
  }

  /**
   * Parse number environment variable
   * @param key - Environment variable key
   * @param defaultValue - Default value if not set
   * @returns Parsed number value
   */
  private parseEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key]
    if (value === undefined) {
      return defaultValue
    }
    const parsed = Number(value)
    return Number.isNaN(parsed) ? defaultValue : parsed
  }

  /**
   * Parse array environment variable
   * @param key - Environment variable key
   * @param defaultValue - Default value if not set
   * @returns Parsed array value
   */
  private parseEnvArray(key: string, defaultValue: string[]): string[] {
    const value = process.env[key]
    if (value === undefined || value === "") {
      return defaultValue
    }
    return value.split(",").map(item => item.trim()).filter(item => item.length > 0)
  }

  /**
   * Validate security configuration
   */
  private validateSecurityConfig(): void {
    const errors: string[] = []

    // Validate network settings
    if (this.config.network.networkTimeout < 1000) {
      errors.push("Network timeout must be at least 1000ms")
    }
    if (this.config.network.maxRequestSize < 1024) {
      errors.push("Max request size must be at least 1024 bytes")
    }

    // Validate file system settings
    if (this.config.fileSystem.maxFileSize < 1024) {
      errors.push("Max file size must be at least 1024 bytes")
    }

    // Validate process isolation settings
    if (this.config.isolation.maxMemoryMB < 64) {
      errors.push("Max process memory must be at least 64MB")
    }
    if (this.config.isolation.maxCpuPercentage < 1 || this.config.isolation.maxCpuPercentage > 100) {
      errors.push("Max CPU percentage must be between 1 and 100")
    }

    if (errors.length > 0) {
      throw new SecurityError(
        `Invalid security configuration: ${errors.join(", ")}`,
        "validation",
        "error",
        { errors },
      )
    }
  }

  /**
   * Initialize security components
   */
  private async initializeSecurityComponents(): Promise<void> {
    // Initialize components with current configuration
    // Components are already created in constructor, so this is mainly for validation
    this.logger.info("Security components initialized", {
      inputValidator: "ready",
      tempManager: "ready",
      processManager: "ready",
    })
  }

  /**
   * Validate input with security checks
   * @param input - Input to validate
   * @param type - Input type (url, filepath, etc.)
   * @returns Validated and sanitized input
   */
  validateInput(input: string, type: "url" | "filepath" | "general"): string {
    if (!this.isInitialized) {
      throw new SecurityError(
        "Security manager not initialized",
        "validation",
        "error",
      )
    }

    try {
      let result: string

      switch (type) {
        case "url":
          result = this.validateUrl(input)
          break
        case "filepath":
          result = this.validateFilePath(input)
          break
        case "general":
          result = this.validateGeneralInput(input)
          break
        default:
          throw new SecurityError(
            `Unknown input type: ${type}`,
            "validation",
            "error",
          )
      }

      this.logSecurityEvent("info", "validation", `Input validation successful`, {
        type,
        inputLength: input.length,
      })

      return result
    } catch (error) {
      const securityError = error instanceof SecurityError
        ? error
        : new SecurityError(
          "Input validation failed",
          "validation",
          "error",
          { type, inputLength: input.length },
        )

      this.logSecurityEvent("error", "validation", `Input validation failed`, {
        type,
        inputLength: input.length,
        blocked: true,
      })

      throw securityError
    }
  }

  /**
   * Validate URL with security checks
   * @param url - URL to validate
   * @returns Validated URL
   */
  private validateUrl(url: string): string {
    const validation = this.inputValidator.validateURL(url, {
      allowedProtocols: ["http", "https"],
      allowPrivateIPs: this.config.network.allowPrivateIPs,
      allowLocalhost: this.config.network.allowLocalhost,
      allowedDomains: this.config.network.allowedDomains,
      blockedDomains: this.config.network.blockedDomains,
    })

    if (!validation.isValid) {
      throw new SecurityError(
        "Invalid URL",
        "network",
        "error",
        { reason: validation.reason, url: url.substring(0, 100) },
      )
    }

    return validation.sanitized!
  }

  /**
   * Validate file path with security checks
   * @param filePath - File path to validate
   * @returns Validated file path
   */
  private validateFilePath(filePath: string): string {
    const validation = this.inputValidator.validateFilePath(filePath, {
      allowedExtensions: this.config.fileSystem.allowedExtensions,
      blockedPatterns: this.config.fileSystem.blockedPatterns,
      maxSize: this.config.fileSystem.maxFileSize,
      enforcePermissions: this.config.fileSystem.enforcePermissions,
    })

    if (!validation.isValid) {
      throw new SecurityError(
        "Invalid file path",
        "filesystem",
        "error",
        { reason: validation.reason, filePath: filePath.substring(0, 100) },
      )
    }

    return validation.sanitized!
  }

  /**
   * Validate general input
   * @param input - Input to validate
   * @returns Validated input
   */
  private validateGeneralInput(input: string): string {
    const validation = this.inputValidator.validateInput(input, {
      maxLength: 10000,
      allowHtml: false,
      sanitizeInput: true,
    })

    if (!validation.isValid) {
      throw new SecurityError(
        "Invalid input",
        "validation",
        "error",
        { reason: validation.reason, inputLength: input.length },
      )
    }

    return validation.sanitized!
  }

  /**
   * Create isolated process with security
   * @param processId - Process identifier
   * @returns User data directory path
   */
  async createIsolatedProcess(processId: string): Promise<string> {
    if (!this.isInitialized) {
      throw new SecurityError(
        "Security manager not initialized",
        "process",
        "error",
      )
    }

    try {
      const userDataDir = await this.processManager.createIsolatedProcess({
        processId,
        networkRestrictions: true,
        fileSystemRestrictions: true,
        resourceMonitoring: this.config.isolation.resourceMonitoring,
        maxMemoryMB: this.config.isolation.maxMemoryMB,
        maxCpuPercentage: this.config.isolation.maxCpuPercentage,
        networkTimeout: this.config.network.networkTimeout,
        allowedDomains: this.config.network.allowedDomains,
        blockedDomains: this.config.network.blockedDomains,
      })

      this.logSecurityEvent("info", "process", `Isolated process created`, {
        processId,
        userDataDir,
      })

      return userDataDir
    } catch (error) {
      const securityError = error instanceof SecurityError
        ? error
        : new SecurityError(
          "Failed to create isolated process",
          "process",
          "error",
          { processId },
        )

      this.logSecurityEvent("error", "process", `Isolated process creation failed`, {
        processId,
        blocked: true,
      })

      throw securityError
    }
  }

  /**
   * Cleanup process resources
   * @param processId - Process identifier
   */
  async cleanupProcess(processId: string): Promise<void> {
    if (!this.isInitialized) {
      return
    }

    try {
      await this.processManager.cleanupProcess(processId)
      this.logSecurityEvent("info", "process", `Process cleaned up`, { processId })
    } catch (error) {
      this.logSecurityEvent("warning", "process", `Process cleanup failed`, {
        processId,
        error: this.sanitizeErrorForLogging(error),
      })
    }
  }

  /**
   * Get security statistics
   * @returns Security statistics
   */
  getSecurityStatistics(): SecurityStatistics {
    const blockedEvents = this.auditEvents.filter(event => event.blocked)
    const criticalEvents = this.auditEvents.filter(event => event.severity === "critical")

    const eventsByCategory: Record<string, number> = {}
    const eventsBySeverity: Record<string, number> = {}

    for (const event of this.auditEvents) {
      eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1
    }

    const processReport = this.processManager.generateSecurityReport()

    return {
      totalEvents: this.auditEvents.length,
      blockedEvents: blockedEvents.length,
      criticalEvents: criticalEvents.length,
      eventsByCategory,
      eventsBySeverity,
      activeProcesses: processReport.activeProcesses,
      totalNetworkRequests: processReport.totalNetworkRequests,
      blockedNetworkRequests: processReport.blockedNetworkRequests,
      totalFileOperations: processReport.totalFileOperations,
      blockedFileOperations: processReport.blockedFileOperations,
    }
  }

  /**
   * Get recent audit events
   * @param limit - Maximum number of events to return
   * @param category - Filter by category (optional)
   * @param severity - Filter by severity (optional)
   * @returns Array of audit events
   */
  getAuditEvents(
    limit = 100,
    category?: string,
    severity?: string,
  ): SecurityAuditEvent[] {
    let events = this.auditEvents

    if (category) {
      events = events.filter(event => event.category === category)
    }

    if (severity) {
      events = events.filter(event => event.severity === severity)
    }

    return events.slice(-limit)
  }

  /**
   * Log security event
   * @param severity - Event severity
   * @param category - Event category
   * @param message - Event message
   * @param details - Additional details
   */
  private logSecurityEvent(
    severity: "info" | "warning" | "error" | "critical",
    category: "network" | "filesystem" | "process" | "validation" | "general",
    message: string,
    details?: Record<string, any>,
  ): void {
    if (!this.config.auditing.enabled) {
      return
    }

    const event: SecurityAuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      severity,
      category,
      source: "SecurityManager",
      message,
      details: this.sanitizeDetailsForLogging(details),
      blocked: severity === "error" || severity === "critical",
    }

    this.auditEvents.push(event)

    // Trim audit events if too many
    if (this.auditEvents.length > this.config.auditing.maxEntries) {
      this.auditEvents = this.auditEvents.slice(-this.config.auditing.maxEntries)
    }

    // Log to console if enabled
    if (this.config.auditing.logToConsole) {
      const logMethod = severity === "critical"
        ? "error"
        : severity === "error"
          ? "error"
          : severity === "warning" ? "warn" : "info"
      this.logger[logMethod](`[SECURITY] ${message}`, event)
    }

    // TODO: Log to file if enabled
    if (this.config.auditing.logToFile && this.config.auditing.logFilePath) {
      // Implement file logging here
    }
  }

  /**
   * Generate unique event ID
   * @returns Event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Sanitize configuration for logging
   * @returns Sanitized configuration
   */
  private sanitizeConfigForLogging(): Partial<SecurityConfig> {
    return {
      network: {
        allowPrivateIPs: this.config.network.allowPrivateIPs,
        allowLocalhost: this.config.network.allowLocalhost,
        networkTimeout: this.config.network.networkTimeout,
        maxRequestSize: this.config.network.maxRequestSize,
        allowedDomains: this.config.network.allowedDomains.length,
        blockedDomains: this.config.network.blockedDomains.length,
      },
      fileSystem: {
        maxFileSize: this.config.fileSystem.maxFileSize,
        allowedExtensions: this.config.fileSystem.allowedExtensions.length,
        blockedPatterns: this.config.fileSystem.blockedPatterns.length,
        enforcePermissions: this.config.fileSystem.enforcePermissions,
      },
      chrome: {
        securityLevel: this.config.chrome.securityLevel,
        enableSandbox: this.config.chrome.enableSandbox,
        disableWebSecurity: this.config.chrome.disableWebSecurity,
        allowFileAccessFromFiles: this.config.chrome.allowFileAccessFromFiles,
      },
      isolation: {
        enabled: this.config.isolation.enabled,
        maxMemoryMB: this.config.isolation.maxMemoryMB,
        maxCpuPercentage: this.config.isolation.maxCpuPercentage,
        resourceMonitoring: this.config.isolation.resourceMonitoring,
      },
      auditing: {
        enabled: this.config.auditing.enabled,
        maxEntries: this.config.auditing.maxEntries,
        logToConsole: this.config.auditing.logToConsole,
        logToFile: this.config.auditing.logToFile,
      },
    }
  }

  /**
   * Sanitize error details for logging
   * @param error - Error to sanitize
   * @returns Sanitized error details
   */
  private sanitizeErrorForLogging(error: unknown): Record<string, any> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message.substring(0, 200), // Limit message length
        stack: error.stack ? "[stack omitted]" : undefined,
      }
    }
    return {
      type: typeof error,
      toString: String(error).substring(0, 200),
    }
  }

  /**
   * Sanitize details for logging
   * @param details - Details to sanitize
   * @returns Sanitized details
   */
  private sanitizeDetailsForLogging(details?: Record<string, any>): Record<string, any> | undefined {
    if (!details) {
      return undefined
    }

    const sanitized: Record<string, any> = {}
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === "string") {
        sanitized[key] = value.length > 200 ? value.substring(0, 200) + "..." : value
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = "[object]" // Avoid logging complex objects
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    try {
      this.logSecurityEvent("info", "general", "Security manager cleanup started")

      // Cleanup process manager
      await this.processManager.cleanupAllProcesses()

      // Cleanup temp manager
      await this.tempManager.cleanup()

      this.isInitialized = false
      this.logSecurityEvent("info", "general", "Security manager cleanup completed")
    } catch (error) {
      this.logSecurityEvent("error", "general", "Security manager cleanup failed", {
        error: this.sanitizeErrorForLogging(error),
      })
    }
  }

  /**
   * Get current security configuration
   * @returns Current security configuration (sanitized)
   */
  getSecurityConfig(): Partial<SecurityConfig> {
    return this.sanitizeConfigForLogging()
  }

  /**
   * Create default logger instance
   * @returns Logger instance
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, context?: any) => {
        if (process.env.NODE_ENV === "development") {
          console.debug(`[SecurityManager] ${message}`, context || "")
        }
      },
      info: (message: string, context?: any) => {
        console.info(`[SecurityManager] ${message}`, context || "")
      },
      warn: (message: string, context?: any) => {
        console.warn(`[SecurityManager] ${message}`, context || "")
      },
      error: (message: string, context?: any) => {
        console.error(`[SecurityManager] ${message}`, context || "")
      },
    }
  }
}
