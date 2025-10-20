/**
 * Input Validation and Sanitization System
 *
 * Provides comprehensive input validation for HTML converter security.
 * Prevents path traversal attacks, validates URLs, blocks private IPs,
 * and sanitizes user inputs to prevent various attack vectors.
 */

import { randomBytes } from "node:crypto"
import { existsSync, statSync } from "node:fs"
import { extname, isAbsolute, normalize, relative } from "node:path"
import process from "node:process"

import type { Logger } from "../../architecture/strategies/types.js"

/**
 * Validation result interface
 */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean
  /** Error message if validation failed */
  errorMessage?: string
  /** Sanitized value */
  sanitizedValue?: string
  /** Security warnings */
  warnings?: string[]
  /** Validation metadata */
  metadata?: Record<string, any>
}

/**
 * File validation options
 */
export interface FileValidationOptions {
  /** Whether to allow relative paths */
  allowRelativePaths?: boolean
  /** Allowed file extensions */
  allowedExtensions?: string[]
  /** Blocked file extensions */
  blockedExtensions?: string[]
  /** Maximum file size in bytes */
  maxFileSize?: number
  /** Whether to check if file exists */
  checkExists?: boolean
  /** Allowed base directories */
  allowedBaseDirs?: string[]
  /** Whether to allow symlinks */
  allowSymlinks?: boolean
}

/**
 * URL validation options
 */
export interface URLValidationOptions {
  /** Whether to allow private IP addresses */
  allowPrivateIPs?: boolean
  /** Whether to allow localhost */
  allowLocalhost?: boolean
  /** Allowed URL schemes */
  allowedSchemes?: string[]
  /** Blocked domains */
  blockedDomains?: string[]
  /** Allowed domains */
  allowedDomains?: string[]
  /** Maximum URL length */
  maxLength?: number
  /** Whether to validate SSL certificates */
  validateSSL?: boolean
}

/**
 * Input validation options
 */
export interface InputValidationOptions {
  /** Maximum input length */
  maxLength?: number
  /** Whether to strip HTML tags */
  stripHTML?: boolean
  /** Whether to allow Unicode characters */
  allowUnicode?: boolean
  /** Whether to sanitize special characters */
  sanitizeSpecialChars?: boolean
  /** Custom validation pattern */
  pattern?: RegExp
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  /** Whether input is secure */
  isSecure: boolean
  /** Risk level (low, medium, high, critical) */
  riskLevel: "low" | "medium" | "high" | "critical"
  /** Detected threats */
  threats: string[]
  /** Security recommendations */
  recommendations: string[]
  /** Sanitized input */
  sanitizedInput?: string
  /** Security warnings */
  warnings?: string[]
}

/**
 * Input Validator class for comprehensive security validation
 *
 * Provides protection against:
 * - Path traversal attacks (../, ..\, etc.)
 * - Private IP address access
 * - Malicious URLs and domains
 * - Prototype pollution
 * - Directory traversal
 * - Code injection attempts
 */
export class InputValidator {
  private logger: Logger

  // Private IP ranges (RFC 1918, RFC 4193, etc.)
  private readonly PRIVATE_IP_RANGES = [
    { start: "10.0.0.0", end: "10.255.255.255" },
    { start: "172.16.0.0", end: "172.31.255.255" },
    { start: "192.168.0.0", end: "192.168.255.255" },
    { start: "127.0.0.0", end: "127.255.255.255" }, // localhost
    { start: "169.254.0.0", end: "169.254.255.255" }, // link-local
    { start: "224.0.0.0", end: "255.255.255.255" }, // multicast
    { start: "fc00::", end: "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff" }, // IPv6 private
    { start: "::1", end: "::1" }, // IPv6 localhost
  ]

  // Dangerous file extensions
  private readonly DANGEROUS_EXTENSIONS = [
    ".exe",
    ".bat",
    ".cmd",
    ".com",
    ".pif",
    ".scr",
    ".vbs",
    ".js",
    ".jar",
    ".app",
    ".deb",
    ".pkg",
    ".dmg",
    ".rpm",
    ".msi",
    ".php",
    ".asp",
    ".aspx",
    ".jsp",
    ".sh",
    ".ps1",
    ".py",
    ".rb",
    ".pl",
    ".cgi",
    ".dll",
    ".so",
    ".dylib",
  ]

  // Dangerous patterns in input
  private readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /onload=/gi,
    /onerror=/gi,
    /onclick=/gi,
    /onmouseover=/gi,
    /expression\s*\(/gi,
    /@import/gi,
    /__proto__/gi,
    /constructor\./gi,
    /prototype\./gi,
  ]

  // Path traversal patterns
  private readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.[/\\]/g, // ../ or ..\
    /\.\.[/\\]/g, // ../ or ..\
    /%2e%2e[/\\]/gi, // URL encoded ../
    /%2e%2e%2f/gi, // URL encoded ../
    /%2e%2e%5c/gi, // URL encoded ..\
    /\.\.%2f/gi, // mixed encoding ../
    /\.\.%5c/gi, // mixed encoding ..\
  ]

  constructor(logger?: Logger) {
    this.logger = logger || this.createDefaultLogger()
  }

  /**
   * Validate and sanitize file path for security
   * @param filePath - File path to validate
   * @param options - Validation options
   * @returns Validation result
   */
  validateFilePath(filePath: string, options: FileValidationOptions = {}): ValidationResult {
    const {
      allowRelativePaths = false,
      allowedExtensions = [],
      blockedExtensions = this.DANGEROUS_EXTENSIONS,
      maxFileSize = 100 * 1024 * 1024, // 100MB
      checkExists = false,
      allowedBaseDirs = [],
      allowSymlinks = false,
    } = options

    const warnings: string[] = []

    try {
      // Check for empty input
      if (!filePath || filePath.trim().length === 0) {
        return {
          isValid: false,
          errorMessage: "File path cannot be empty",
        }
      }

      // Check for path traversal attempts
      const pathTraversalResult = this.detectPathTraversal(filePath)
      if (!pathTraversalResult.isSecure) {
        return {
          isValid: false,
          errorMessage: `Path traversal detected: ${pathTraversalResult.threats.join(", ")}`,
          warnings: pathTraversalResult.warnings,
        }
      }

      // Normalize the path
      const normalizedPath = normalize(filePath)

      // Check if absolute path is required
      if (!allowRelativePaths && !isAbsolute(normalizedPath)) {
        return {
          isValid: false,
          errorMessage: "Relative paths are not allowed",
        }
      }

      // Check against allowed base directories
      if (allowedBaseDirs.length > 0 && isAbsolute(normalizedPath)) {
        const isAllowed = allowedBaseDirs.some((baseDir) => {
          const relativePath = relative(baseDir, normalizedPath)
          return !relativePath.startsWith("..") && !relativePath.startsWith("..\\")
        })

        if (!isAllowed) {
          return {
            isValid: false,
            errorMessage: "File path is outside allowed directories",
          }
        }
      }

      // Check file extension
      const fileExt = extname(normalizedPath).toLowerCase()
      if (allowedExtensions.length > 0 && !allowedExtensions.includes(fileExt)) {
        return {
          isValid: false,
          errorMessage: `File extension '${fileExt}' is not allowed`,
        }
      }

      if (blockedExtensions.includes(fileExt)) {
        return {
          isValid: false,
          errorMessage: `File extension '${fileExt}' is blocked for security reasons`,
        }
      }

      // Check if file exists (if required)
      if (checkExists) {
        if (!existsSync(normalizedPath)) {
          return {
            isValid: false,
            errorMessage: "File does not exist",
          }
        }

        try {
          const stats = statSync(normalizedPath)

          // Check file size
          if (stats.size > maxFileSize) {
            return {
              isValid: false,
              errorMessage: `File size (${stats.size}) exceeds maximum allowed size (${maxFileSize})`,
            }
          }

          // Check for symlinks
          if (!allowSymlinks && stats.isSymbolicLink()) {
            return {
              isValid: false,
              errorMessage: "Symbolic links are not allowed",
            }
          }
        } catch (error) {
          return {
            isValid: false,
            errorMessage: `Unable to access file: ${error instanceof Error ? error.message : String(error)}`,
          }
        }
      }

      this.logger.debug(`File path validation successful`, { filePath: normalizedPath })

      return {
        isValid: true,
        sanitizedValue: normalizedPath,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    } catch (error) {
      this.logger.error("File path validation error", error as Error)
      return {
        isValid: false,
        errorMessage: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Validate and sanitize URL for security
   * @param url - URL to validate
   * @param options - Validation options
   * @returns Validation result
   */
  validateURL(url: string, options: URLValidationOptions = {}): ValidationResult {
    const {
      allowPrivateIPs = false,
      allowLocalhost = false,
      allowedSchemes = ["http", "https"],
      blockedDomains = [],
      allowedDomains = [],
      maxLength = 2048,
      validateSSL: _validateSSL = true,
    } = options

    const warnings: string[] = []

    try {
      // Check for empty input
      if (!url || url.trim().length === 0) {
        return {
          isValid: false,
          errorMessage: "URL cannot be empty",
        }
      }

      // Check URL length
      if (url.length > maxLength) {
        return {
          isValid: false,
          errorMessage: `URL length (${url.length}) exceeds maximum allowed length (${maxLength})`,
        }
      }

      // Parse URL
      let parsedURL: URL
      try {
        parsedURL = new URL(url)
      } catch (error) {
        return {
          isValid: false,
          errorMessage: `Invalid URL format: ${error instanceof Error ? error.message : String(error)}`,
        }
      }

      // Check URL scheme
      if (!allowedSchemes.includes(parsedURL.protocol.replace(":", ""))) {
        return {
          isValid: false,
          errorMessage: `URL scheme '${parsedURL.protocol}' is not allowed`,
        }
      }

      // Check domain against blacklists and whitelists
      const hostname = parsedURL.hostname
      if (!hostname) {
        return {
          isValid: false,
          errorMessage: "URL must have a valid hostname",
        }
      }

      if (blockedDomains.some(domain => hostname.includes(domain))) {
        return {
          isValid: false,
          errorMessage: `Domain '${hostname}' is blocked`,
        }
      }

      if (allowedDomains.length > 0 && !allowedDomains.some(domain => hostname.includes(domain))) {
        return {
          isValid: false,
          errorMessage: `Domain '${hostname}' is not in the allowed list`,
        }
      }

      // Check for private IP addresses
      if (!allowPrivateIPs || (!allowLocalhost && hostname === "localhost")) {
        const ipCheck = this.isPrivateIP(hostname)
        if (ipCheck.isPrivate) {
          return {
            isValid: false,
            errorMessage: `Access to private IP '${hostname}' is not allowed`,
          }
        }
      }

      // Check for dangerous patterns in URL
      const dangerousPatterns = [
        /javascript:/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
        /<script/gi,
      ]

      for (const pattern of dangerousPatterns) {
        if (pattern.test(url)) {
          return {
            isValid: false,
            errorMessage: "URL contains potentially dangerous content",
          }
        }
      }

      this.logger.debug(`URL validation successful`, { url: parsedURL.href })

      return {
        isValid: true,
        sanitizedValue: parsedURL.href,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    } catch (error) {
      this.logger.error("URL validation error", error as Error)
      return {
        isValid: false,
        errorMessage: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Validate and sanitize general input
   * @param input - Input string to validate
   * @param options - Validation options
   * @returns Validation result
   */
  validateInput(input: string, options: InputValidationOptions = {}): ValidationResult {
    const {
      maxLength = 10000,
      stripHTML = true,
      allowUnicode = true,
      sanitizeSpecialChars = true,
      pattern,
    } = options

    const warnings: string[] = []

    try {
      // Check for empty input
      if (!input || input.trim().length === 0) {
        return {
          isValid: false,
          errorMessage: "Input cannot be empty",
        }
      }

      // Check input length
      if (input.length > maxLength) {
        return {
          isValid: false,
          errorMessage: `Input length (${input.length}) exceeds maximum allowed length (${maxLength})`,
        }
      }

      // Check for dangerous patterns
      for (const dangerousPattern of this.DANGEROUS_PATTERNS) {
        if (dangerousPattern.test(input)) {
          return {
            isValid: false,
            errorMessage: "Input contains potentially dangerous content",
          }
        }
      }

      // Sanitize input
      let sanitizedInput = input

      if (stripHTML) {
        sanitizedInput = sanitizedInput.replace(/<[^>]*>/g, "")
      }

      if (sanitizeSpecialChars) {
        sanitizedInput = sanitizedInput.replace(/[<>"'&]/g, (match) => {
          const entityMap: { [key: string]: string } = {
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;",
            "&": "&amp;",
          }
          return entityMap[match] || match
        })
      }

      // Apply custom pattern validation
      if (pattern && !pattern.test(sanitizedInput)) {
        return {
          isValid: false,
          errorMessage: "Input does not match required pattern",
        }
      }

      // Check for Unicode characters
      // eslint-disable-next-line no-control-regex
      if (!allowUnicode && /[^\x00-\x7F]/.test(sanitizedInput)) {
        warnings.push("Unicode characters detected")
      }

      this.logger.debug(`Input validation successful`, {
        originalLength: input.length,
        sanitizedLength: sanitizedInput.length,
        hasWarnings: warnings.length > 0,
      })

      return {
        isValid: true,
        sanitizedValue: sanitizedInput,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    } catch (error) {
      this.logger.error("Input validation error", error as Error)
      return {
        isValid: false,
        errorMessage: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Detect path traversal attempts
   * @param path - Path to check
   * @returns Security validation result
   */
  private detectPathTraversal(path: string): SecurityValidationResult {
    const threats: string[] = []
    const warnings: string[] = []
    let riskLevel: "low" | "medium" | "high" | "critical" = "low"

    // Check for path traversal patterns
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(path)) {
        threats.push("Path traversal pattern detected")
        riskLevel = "high"
      }
    }

    // Check for encoded path traversal
    const decodedPath = decodeURIComponent(path)
    if (decodedPath !== path) {
      warnings.push("URL encoded characters detected")
      riskLevel = "medium"

      // Check decoded path for traversal
      for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
        if (pattern.test(decodedPath)) {
          threats.push("Encoded path traversal detected")
          riskLevel = "critical"
        }
      }
    }

    // Check for null bytes

    if (path.includes(String.fromCharCode(0)) || path.includes("%00")) {
      threats.push("Null byte injection detected")
      riskLevel = "critical"
    }

    // Check for very long paths (potential buffer overflow)
    if (path.length > 4096) {
      warnings.push("Unusually long path detected")
      riskLevel = "medium"
    }

    const isSecure = threats.length === 0

    return {
      isSecure,
      riskLevel,
      threats,
      recommendations: isSecure
        ? []
        : [
            "Use absolute paths",
            "Validate user input properly",
            "Use file access controls",
          ],
      sanitizedInput: isSecure ? path : this.sanitizePath(path),
    }
  }

  /**
   * Check if IP address is private
   * @param hostname - Hostname to check
   * @returns Object with isPrivate flag and IP information
   */
  private isPrivateIP(hostname: string): { isPrivate: boolean, ip?: string } {
    // Simple hostname check
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      return { isPrivate: true, ip: hostname }
    }

    // Check if it's an IP address
    const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(hostname)) {
      return { isPrivate: false }
    }

    const ip = hostname
    const parts = ip.split(".").map(Number)

    for (const range of this.PRIVATE_IP_RANGES) {
      const startParts = range.start.split(".").map(Number)
      const endParts = range.end.split(".").map(Number)

      if (this.isIPInRange(parts, startParts, endParts)) {
        return { isPrivate: true, ip }
      }
    }

    return { isPrivate: false, ip }
  }

  /**
   * Check if IP is in range
   * @param ip - IP parts
   * @param start - Start range parts
   * @param end - End range parts
   * @returns True if IP is in range
   */
  private isIPInRange(ip: number[], start: number[], end: number[]): boolean {
    for (let i = 0; i < 4; i++) {
      if (ip[i]! < start[i]! || ip[i]! > end[i]!) {
        return false
      }
    }
    return true
  }

  /**
   * Sanitize path for safe usage
   * @param path - Path to sanitize
   * @returns Sanitized path
   */
  private sanitizePath(path: string): string {
    // Remove path traversal patterns
    let sanitized = path
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      sanitized = sanitized.replace(pattern, "")
    }

    // Remove null bytes
    sanitized = sanitized.replace(new RegExp(String.fromCharCode(0), "g"), "")

    // Normalize path
    sanitized = normalize(sanitized)

    return sanitized
  }

  /**
   * Create default logger instance
   * @returns Logger instance
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, context?: any) => {
        if (process.env.NODE_ENV === "development") {
          console.debug(`[InputValidator] ${message}`, context || "")
        }
      },
      info: (message: string, context?: any) => {
        console.info(`[InputValidator] ${message}`, context || "")
      },
      warn: (message: string, context?: any) => {
        console.warn(`[InputValidator] ${message}`, context || "")
      },
      error: (message: string, context?: any) => {
        console.error(`[InputValidator] ${message}`, context || "")
      },
    }
  }

  /**
   * Generate secure random identifier
   * @param length - Length of identifier
   * @returns Random identifier
   */
  generateSecureId(length = 16): string {
    return randomBytes(Math.ceil(length / 2))
      .toString("hex")
      .slice(0, length)
  }

  /**
   * Validate configuration object
   * @param config - Configuration to validate
   * @param schema - Validation schema
   * @returns Validation result
   */
  validateConfiguration(config: any, schema: any): ValidationResult {
    try {
      // Basic configuration validation
      if (!config || typeof config !== "object") {
        return {
          isValid: false,
          errorMessage: "Configuration must be an object",
        }
      }

      // Check for prototype pollution
      if (Object.getPrototypeOf(config) !== Object.prototype || config.constructor || config.prototype) {
        return {
          isValid: false,
          errorMessage: "Configuration contains prototype pollution",
        }
      }

      // Recursively validate configuration
      const result = this.validateObject(config, schema)
      return result
    } catch (error) {
      this.logger.error("Configuration validation error", error as Error)
      return {
        isValid: false,
        errorMessage: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Recursively validate object against schema
   * @param obj - Object to validate
   * @param schema - Schema to validate against
   * @returns Validation result
   */
  private validateObject(obj: any, schema: any): ValidationResult {
    // Simple schema validation - can be extended with JSON Schema
    if (!schema || typeof schema !== "object") {
      return {
        isValid: true,
        sanitizedValue: obj,
      }
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof key !== "string" || !this.isValidKey(key)) {
        return {
          isValid: false,
          errorMessage: `Invalid configuration key: ${key}`,
        }
      }

      if (typeof value === "object" && value !== null) {
        const result = this.validateObject(value, schema[key])
        if (!result.isValid) {
          return result
        }
      }
    }

    return {
      isValid: true,
      sanitizedValue: obj,
    }
  }

  /**
   * Check if configuration key is valid
   * @param key - Key to check
   * @returns True if key is valid
   */
  private isValidKey(key: string): boolean {
    // Check for dangerous keys
    const dangerousKeys = [
      "__proto__",
      "constructor",
      "prototype",
      "__defineGetter__",
      "__defineSetter__",
      "__lookupGetter__",
      "__lookupSetter__",
    ]

    return !dangerousKeys.includes(key) && /^[a-z_$][\w$]*$/i.test(key)
  }
}
