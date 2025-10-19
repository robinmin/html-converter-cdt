/**
 * Error Simulation Utilities
 *
 * This module provides utilities for simulating various error scenarios
 * during testing. It enables comprehensive testing of error handling
 * and recovery mechanisms throughout the application.
 *
 * @example
 * ```typescript
 * import { ErrorSimulator, createMockChromeError } from './error-simulation.js';
 * import { ErrorCodes } from './error-codes.js';
 *
 * const simulator = new ErrorSimulator();
 *
 * // Simulate a network error
 * const networkError = simulator.simulateError(ErrorCodes.NETWORK_ERROR, {
 *   url: 'https://example.com',
 *   attempt: 1
 * });
 *
 * // Simulate a Chrome CDP error
 * const cdpError = createMockChromeError('Target not found', {
 *   code: -32602,
 *   method: 'Page.navigate'
 * });
 * ```
 */

import type { ErrorContext } from "./conversion-error.js"
import { ConversionError, getCategoryFromCode, getSeverityFromCode } from "./conversion-error.js"
import { ERROR_MESSAGES, ErrorCode } from "./error-codes.js"

/**
 * Error simulation configuration
 */
export interface ErrorSimulationConfig {
  /** Include stack trace in simulated errors */
  includeStackTrace?: boolean
  /** Custom error message template */
  messageTemplate?: string
  /** Additional context to include */
  context?: Partial<ErrorContext>
  /** Make error recoverable */
  recoverable?: boolean
}

/**
 * Chrome DevTools Protocol error structure
 */
export interface ChromeDPError extends Error {
  code: number
  message: string
  data?: any
  response?: {
    method?: string
    sessionId?: string
    error?: any
  }
}

/**
 * File system error structure
 */
export interface FileSystemError extends NodeJS.ErrnoException {
  code: string
  path?: string
  syscall?: string
  errno?: number
}

/**
 * Error simulator for testing scenarios
 */
export class ErrorSimulator {
  private config: ErrorSimulationConfig

  constructor(config: ErrorSimulationConfig = {}) {
    this.config = {
      includeStackTrace: config.includeStackTrace ?? true,
      messageTemplate: config.messageTemplate,
      context: config.context || {},
      recoverable: config.recoverable ?? true,
    }
  }

  /**
   * Simulate an error based on error code
   */
  simulateError(errorCode: ErrorCode, context?: Partial<ErrorContext>): ConversionError {
    const errorInfo = ERROR_MESSAGES[errorCode]
    const finalContext = { ...this.config.context, ...context }

    let _message = this.config.messageTemplate || errorInfo.message
    if (this.config.messageTemplate && finalContext) {
      _message = this.interpolateMessage(this.config.messageTemplate, finalContext)
    }

    const error = new ConversionError(
      errorInfo.message,
      errorCode,
      getCategoryFromCode(errorCode),
      getSeverityFromCode(errorCode),
      finalContext,
    )

    if (this.config.includeStackTrace) {
      error.stack = this.generateMockStackTrace(errorCode)
    }

    return error
  }

  /**
   * Simulate network-related errors
   */
  simulateNetworkError(options: {
    url?: string
    timeout?: number
    statusCode?: number
    cause?: "timeout" | "connection" | "dns" | "ssl"
  } = {}): ConversionError {
    const { url = "https://example.com", timeout = 30000, statusCode, cause = "connection" } = options

    let errorCode: ErrorCode
    const context: Partial<ErrorContext> = { url, timeout }

    switch (cause) {
      case "timeout":
        errorCode = ErrorCode.NETWORK_TIMEOUT
        context.timeoutDuration = timeout
        break
      case "dns":
        errorCode = ErrorCode.NETWORK_DNS_ERROR
        context.dnsError = true
        break
      case "ssl":
        errorCode = ErrorCode.NETWORK_SSL_ERROR
        context.sslError = true
        break
      default:
        errorCode = ErrorCode.NETWORK_CONNECTION_FAILED
        context.connectionError = true
        if (statusCode) {
          context.httpStatus = statusCode
        }
    }

    return this.simulateError(errorCode, { metadata: context })
  }

  /**
   * Simulate Chrome DevTools Protocol errors
   */
  simulateCDPError(options: {
    method?: string
    sessionId?: string
    code?: number
    message?: string
  } = {}): ConversionError {
    const { method = "Page.navigate", sessionId = "session-123", code = -32602, message = "Invalid params" } = options

    return this.simulateError(ErrorCode.CDP_PROTOCOL_ERROR, {
      metadata: {
        cdpMethod: method,
        cdpSession: sessionId,
        cdpErrorCode: code,
        cdpErrorMessage: message,
      },
    })
  }

  /**
   * Simulate file system errors
   */
  simulateFileSystemError(options: {
    operation?: "read" | "write" | "delete" | "create"
    filePath?: string
    errorType?: "ENOENT" | "EACCES" | "ENOSPC" | "EEXIST"
  } = {}): ConversionError {
    const { operation = "read", filePath = "/tmp/test.html", errorType = "ENOENT" } = options

    // Map error types to proper error codes
    let errorCode: ErrorCode
    switch (errorType) {
      case "ENOENT":
        errorCode = ErrorCode.FILE_NOT_FOUND
        break
      case "EACCES":
        errorCode = ErrorCode.FILE_ACCESS_DENIED
        break
      case "ENOSPC":
        errorCode = ErrorCode.DISK_FULL
        break
      case "EEXIST":
        errorCode = ErrorCode.FILE_ALREADY_EXISTS
        break
      default:
        errorCode = ErrorCode.FILE_NOT_FOUND
    }

    return this.simulateError(errorCode, {
      fileOperation: operation,
      filePath,
      errnoCode: errorType,
    })
  }

  /**
   * Simulate conversion errors
   */
  simulateConversionError(options: {
    sourceFormat?: string
    targetFormat?: string
    stage?: "rendering" | "capture" | "export" | "processing"
    details?: string
  } = {}): ConversionError {
    const { sourceFormat = "HTML", targetFormat = "MHTML", stage = "capture", details } = options

    let errorCode: ErrorCode
    switch (stage) {
      case "rendering":
        errorCode = ErrorCode.RENDERING_FAILED
        break
      case "export":
        errorCode = ErrorCode.EXPORT_FAILED
        break
      default:
        errorCode = ErrorCode.CONVERSION_FAILED
    }

    return this.simulateError(errorCode, {
      sourceFormat,
      targetFormat,
      conversionStage: stage,
      errorDetails: details,
    })
  }

  /**
   * Simulate memory errors
   */
  simulateMemoryError(options: {
    operation?: string
    memoryUsage?: number
    limit?: number
  } = {}): ConversionError {
    const { operation = "page rendering", memoryUsage = 1024 * 1024 * 1024, limit = 512 * 1024 * 1024 } = options

    return this.simulateError(ErrorCode.MEMORY_LIMIT_EXCEEDED, {
      memoryOperation: operation,
      currentMemoryUsage: memoryUsage,
      memoryLimit: limit,
    })
  }

  /**
   * Generate a sequence of related errors for testing error chains
   */
  simulateErrorChain(errorCodes: ErrorCode[]): ConversionError[] {
    return errorCodes.map((code, index) => {
      const context: Partial<ErrorContext> = {
        chainIndex: index,
        chainLength: errorCodes.length,
        previousError: index > 0 ? errorCodes[index - 1] : undefined,
      }

      return this.simulateError(code, context)
    })
  }

  /**
   * Simulate errors with varying severity levels
   */
  simulateErrorWithSeverity(severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"): ConversionError {
    const severityMap = {
      LOW: ErrorCode.INVALID_OPTIONS,
      MEDIUM: ErrorCode.NETWORK_CONNECTION_FAILED,
      HIGH: ErrorCode.CDP_CONNECTION_FAILED,
      CRITICAL: ErrorCode.OUT_OF_MEMORY,
    } as const

    return this.simulateError(severityMap[severity], {
      severity,
      priority: severity,
    })
  }

  private interpolateMessage(template: string, context: ErrorContext): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key]?.toString() || match
    })
  }

  private generateMockStackTrace(errorCode: ErrorCode): string {
    const errorInfo = ERROR_MESSAGES[errorCode]
    const stackLines = [
      `Error: ${errorInfo.message}`,
      `    at simulateError (${__filename}:42:14)`,
      `    at ErrorSimulator.simulateError (${__filename}:42:14)`,
      `    at Object.<anonymous> (${__filename}:1:1)`,
      `    at Module._compile (node:internal/modules/cjs/loader:1254:14)`,
      `    at Module._extensions..js (node:internal/modules/cjs/loader:1270:10)`,
      `    at Module.load (node:internal/modules/cjs/loader:1094:32)`,
      `    at Module._load (node:internal/modules/cjs/loader:940:12)`,
      `    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:81:12)`,
      `    at node:internal/main/run_main_module:17:47`,
    ]

    return stackLines.join("\n")
  }
}

/**
 * Create a mock Chrome DevTools Protocol error
 */
export function createMockChromeError(
  message: string,
  options: {
    code?: number
    method?: string
    sessionId?: string
    data?: any
  } = {},
): ChromeDPError {
  const error = new Error(message) as ChromeDPError
  error.code = options.code || -32602
  error.message = message
  error.data = options.data
  error.response = {
    method: options.method,
    sessionId: options.sessionId,
  }

  return error
}

/**
 * Create a mock file system error
 */
export function createMockFileSystemError(
  message: string,
  options: {
    code?: string
    path?: string
    syscall?: string
    errno?: number
  } = {},
): FileSystemError {
  const error = new Error(message) as FileSystemError
  error.code = options.code || "ENOENT"
  error.message = message
  error.path = options.path
  error.syscall = options.syscall
  error.errno = options.errno

  return error
}

/**
 * Create a mock network error
 */
export function createMockNetworkError(
  message: string,
  options: {
    code?: string
    statusCode?: number
    url?: string
  } = {},
): Error & { code?: string, statusCode?: number, url?: string } {
  const error = new Error(message) as Error & { code?: string, statusCode?: number, url?: string }
  error.code = options.code || "ECONNREFUSED"
  error.message = message

  if (options.statusCode) {
    error.statusCode = options.statusCode
  }
  if (options.url) {
    error.url = options.url
  }

  return error
}

/**
 * Predefined error scenarios for common testing cases
 */
export const ErrorScenarios = {
  /**
   * Common network failure scenarios
   */
  network: {
    connectionRefused: () => new ErrorSimulator().simulateNetworkError({ cause: "connection" }),
    timeout: () => new ErrorSimulator().simulateNetworkError({ cause: "timeout", timeout: 5000 }),
    dnsFailure: () => new ErrorSimulator().simulateNetworkError({ cause: "dns" }),
    sslError: () => new ErrorSimulator().simulateNetworkError({ cause: "ssl" }),
    http4xx: () => new ErrorSimulator().simulateNetworkError({ statusCode: 404 }),
    http5xx: () => new ErrorSimulator().simulateNetworkError({ statusCode: 500 }),
  },

  /**
   * Chrome DevTools Protocol failure scenarios
   */
  cdp: {
    targetNotFound: () => new ErrorSimulator().simulateCDPError({
      method: "Target.attachToTarget",
      code: -32602,
      message: "Target not found",
    }),
    sessionClosed: () => new ErrorSimulator().simulateCDPError({
      method: "Page.navigate",
      code: -32000,
      message: "Session closed",
    }),
    invalidParams: () => new ErrorSimulator().simulateCDPError({
      method: "Runtime.evaluate",
      code: -32602,
      message: "Invalid parameters",
    }),
  },

  /**
   * File system failure scenarios
   */
  filesystem: {
    fileNotFound: () => new ErrorSimulator().simulateFileSystemError({
      operation: "read",
      errorType: "ENOENT",
    }),
    permissionDenied: () => new ErrorSimulator().simulateFileSystemError({
      operation: "write",
      errorType: "EACCES",
    }),
    diskFull: () => new ErrorSimulator().simulateFileSystemError({
      operation: "write",
      errorType: "ENOSPC",
    }),
    fileExists: () => new ErrorSimulator().simulateFileSystemError({
      operation: "create",
      errorType: "EEXIST",
    }),
  },

  /**
   * Conversion failure scenarios
   */
  conversion: {
    renderingFailed: () => new ErrorSimulator().simulateConversionError({
      stage: "rendering",
      details: "JavaScript execution timeout",
    }),
    captureFailed: () => new ErrorSimulator().simulateConversionError({
      stage: "capture",
      details: "Page too large to capture",
    }),
    exportFailed: () => new ErrorSimulator().simulateConversionError({
      stage: "export",
      details: "Invalid MHTML structure",
    }),
  },
} as const
