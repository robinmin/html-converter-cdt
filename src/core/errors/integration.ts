/**
 * Error Handling Integration Utilities
 *
 * This module provides integration utilities for incorporating error handling
 * throughout the HTML converter codebase. It offers convenient wrappers,
 * middleware, and utilities for consistent error handling across components.
 *
 * @example
 * ```typescript
 * import { ErrorIntegration, createErrorAwareOperation } from './integration.js';
 * import { ErrorHandler } from './error-handler.js';
 *
 * const errorHandler = new ErrorHandler();
 * const integration = new ErrorIntegration(errorHandler);
 *
 * // Wrap an operation with automatic error handling
 * const safeOperation = createErrorAwareOperation(
 *   async (url: string) => {
 *     // Your conversion logic here
 *     return await convertUrl(url);
 *   },
 *   { errorHandler, context: 'URL conversion' }
 * );
 *
 * try {
 *   const result = await safeOperation('https://example.com');
 * } catch (error) {
 *   // Error is already normalized and logged
 * }
 * ```
 */

import process from "node:process"

import type { ErrorContext } from "./conversion-error.js"
import { ConversionError, ErrorCategory, ErrorCode, ErrorSeverity } from "./conversion-error.js"
import { ErrorHandler } from "./error-handler.js"
import { ErrorRecovery } from "./error-recovery.js"

/**
 * Configuration options for error integration
 */
export interface ErrorIntegrationConfig {
  /** Custom error handler instance (optional) */
  errorHandler?: ErrorHandler
  /** Default context for errors */
  defaultContext?: string
  /** Enable automatic recovery attempts */
  enableRecovery?: boolean
  /** Maximum retry attempts */
  maxRetries?: number
  /** Custom logging function */
  logger?: (error: ConversionError, context?: string) => void
}

/**
 * Error integration utilities and middleware
 */
export class ErrorIntegration {
  private errorHandler: ErrorHandler
  private config: Required<ErrorIntegrationConfig>

  constructor(config: ErrorIntegrationConfig = {}) {
    this.errorHandler = config.errorHandler || new ErrorHandler()
    this.config = {
      errorHandler: this.errorHandler,
      defaultContext: config.defaultContext || "Unknown operation",
      enableRecovery: config.enableRecovery ?? true,
      maxRetries: config.maxRetries ?? 3,
      logger: config.logger || this.defaultLogger,
    }
  }

  /**
   * Wrap an async operation with automatic error handling and recovery
   */
  async wrapOperation<T>(
    operation: () => Promise<T>,
    options: {
      context?: string
      retries?: number
      errorHandler?: any
    } = {},
  ): Promise<T> {
    const context = options.context || this.config.defaultContext
    const retries = options.retries ?? this.config.maxRetries
    const errorHandlerOptions = { ...this.config.errorHandler, ...options.errorHandler }

    let lastError: ConversionError | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = this.errorHandler.normalizeError(error, {
          operation: context,
          metadata: {
            attempt: attempt + 1,
            maxAttempts: retries + 1,
            timestamp: new Date().toISOString(),
            ...(errorHandlerOptions.metadata || {}),
          },
        })

        this.config.logger(lastError, context)

        // Don't retry on certain error types
        if (!this.shouldRetry(lastError, attempt, retries)) {
          break
        }

        // Apply recovery strategy if enabled
        if (this.config.enableRecovery && attempt < retries) {
          await ErrorRecovery.attemptRecovery(lastError)
        }
      }
    }

    throw lastError
  }

  /**
   * Create middleware for Express.js or similar frameworks
   */
  createMiddleware() {
    return (error: Error, req: any, res: any, _next: any) => {
      const conversionError = this.errorHandler.normalizeError(error, {
        operation: `${req.method} ${req.path}`,
        metadata: {
          userAgent: req.get("User-Agent"),
          ip: req.ip,
          timestamp: new Date().toISOString(),
        },
      })

      this.config.logger(conversionError, "HTTP request")

      // Send appropriate response based on error type
      const statusCode = this.getStatusCodeForError(conversionError)
      res.status(statusCode).json({
        error: {
          code: conversionError.code,
          message: conversionError.getUserMessage(),
          timestamp: conversionError.timestamp,
          requestId: req.id || "unknown",
        },
      })
    }
  }

  /**
   * Process errors from Chrome DevTools Protocol
   */
  processCDPError(error: any, context: string = "CDP operation"): ConversionError {
    // If error is already a ConversionError, preserve its context and add CDP-specific metadata
    if (error instanceof ConversionError) {
      // Create new metadata object with existing and additional CDP-specific metadata
      const newMetadata = { ...error.context.metadata }

      // Add CDP source if not already present
      if (!newMetadata.source) {
        newMetadata.source = "chrome-devtools-protocol"
      }

      // Map camelCase metadata to snake_case for consistency with test expectations
      if (error.context.metadata?.cdpMethod && !newMetadata.cdp_method) {
        newMetadata.cdp_method = error.context.metadata.cdpMethod
      }
      if (error.context.metadata?.cdpSession && !newMetadata.cdp_session) {
        newMetadata.cdp_session = error.context.metadata.cdpSession
      }

      // Create new ConversionError with updated metadata
      newMetadata.timestamp = new Date().toISOString()
      const newError = new ConversionError(
        error.message,
        error.code,
        error.category,
        error.severity,
        {
          ...error.context,
          metadata: newMetadata,
          operation: context,
        },
        error.originalError,
        error.timestamp,
      )

      this.config.logger(newError, context)
      return newError
    }

    // For raw errors, normalize them and add CDP context
    const cdpError = this.errorHandler.normalizeError(error, {
      operation: context,
      metadata: {
        source: "chrome-devtools-protocol",
        timestamp: new Date().toISOString(),
      },
    })

    // Add CDP-specific context from raw error
    if (error.response && error.response.method) {
      cdpError.addContext("cdp_method", error.response.method)
    }
    if (error.response && error.response.sessionId) {
      cdpError.addContext("cdp_session", error.response.sessionId)
    }

    this.config.logger(cdpError, context)
    return cdpError
  }

  /**
   * Process file system errors
   */
  processFileSystemError(error: NodeJS.ErrnoException, operation: string, filePath?: string): ConversionError {
    const fsError = this.errorHandler.normalizeError(error, {
      operation,
      resource: filePath,
      metadata: {
        source: "file-system",
        timestamp: new Date().toISOString(),
      },
    })

    // Add file system specific context
    if (filePath) {
      fsError.addContext("file_path", filePath)
    }
    if (error.code) {
      fsError.addContext("errno_code", error.code)
    }
    if (error.path) {
      fsError.addContext("error_path", error.path)
    }

    this.config.logger(fsError, operation)
    return fsError
  }

  /**
   * Create a domain-specific error handler
   */
  createDomainHandler(domain: string) {
    return {
      wrap: <T>(operation: () => Promise<T>, context?: string) =>
        this.wrapOperation(operation, {
          context: context || `${domain} operation`,
          errorHandler: {
            metadata: { domain },
          },
        }),

      process: (error: Error, context?: string) =>
        this.errorHandler.normalizeError(error, {
          operation: context || `${domain} error`,
          metadata: {
            domain,
            timestamp: new Date().toISOString(),
          },
        }),

      log: (error: ConversionError, context?: string) =>
        this.config.logger(error, context || domain),
    }
  }

  private shouldRetry(error: ConversionError, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) {
      return false
    }

    // Don't retry on validation errors
    if (error.code === ErrorCode.INVALID_OPTIONS) {
      return false
    }

    // Don't retry on certain CDP errors
    if (error.code === ErrorCode.CDP_PROTOCOL_ERROR && error.context.metadata?.cdp_method === "Target.closeTarget") {
      return false
    }

    // Retry on network errors, timeouts, and general conversion failures
    return error.code === ErrorCode.NETWORK_CONNECTION_FAILED
      || error.code === ErrorCode.NETWORK_TIMEOUT
      || error.code === ErrorCode.RESOURCE_LOAD_FAILED
      || error.code === ErrorCode.CONVERSION_FAILED
  }

  private getStatusCodeForError(error: ConversionError): number {
    switch (error.category) {
      case ErrorCategory.INVALID_INPUT:
      case ErrorCategory.VALIDATION_ERROR:
        return 400 // Bad Request
      case ErrorCategory.NETWORK_ERROR:
      case ErrorCategory.TIMEOUT:
      case ErrorCategory.RESOURCE_ERROR:
        return 503 // Service Unavailable
      case ErrorCategory.CDP_ERROR:
        return 502 // Bad Gateway
      case ErrorCategory.FILE_SYSTEM_ERROR:
        return 500 // Internal Server Error
      case ErrorCategory.MEMORY_ERROR:
        return 507 // Insufficient Storage
      case ErrorCategory.CONVERSION_FAILED:
      case ErrorCategory.RENDERING_ERROR:
      case ErrorCategory.EXPORT_ERROR:
        return 422 // Unprocessable Entity
      default:
        return 500
    }
  }

  private defaultLogger(error: ConversionError, context?: string): void {
    const logMessage = `[${context || "Error"}] ${error.code}: ${error.getUserMessage()}`

    if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH) {
      console.error(logMessage)
      if (process.env.NODE_ENV === "development") {
        console.error("Stack trace:", error.stack)
        console.error("Context:", error.context)
      }
    } else {
      console.warn(logMessage)
    }
  }
}

/**
 * Create an error-aware operation wrapper
 */
export function createErrorAwareOperation<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  config: ErrorIntegrationConfig & { context?: string } = {},
): (...args: T) => Promise<R> {
  const integration = new ErrorIntegration(config)

  return (...args: T) => integration.wrapOperation(() => operation(...args), {
    context: config.context,
  })
}

/**
 * Utility to add error context to existing operations
 */
export function withErrorContext<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  contextProvider: (...args: T) => Partial<ErrorContext>,
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    try {
      return await fn(...args)
    } catch (error) {
      const errorHandler = new ErrorHandler()
      const context = contextProvider(...args)

      throw errorHandler.normalizeError(error as Error, {
        ...context,
        metadata: {
          ...context.metadata,
          timestamp: new Date().toISOString(),
        },
      })
    }
  }
}

/**
 * Retry decorator for automatic error recovery
 */
export function withRetry<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    maxRetries?: number
    retryCondition?: (error: ConversionError) => boolean
    delay?: number
  } = {},
): (...args: T) => Promise<R> {
  const {
    maxRetries = 3,
    retryCondition = error => error.category === ErrorCategory.NETWORK_ERROR || error.category === ErrorCategory.TIMEOUT || error.category === ErrorCategory.CONVERSION_FAILED,
    delay = 1000,
  } = options

  return async (...args: T) => {
    let lastError: ConversionError | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args)
      } catch (error) {
        const errorHandler = new ErrorHandler()
        lastError = errorHandler.normalizeError(error as Error, {
          operation: fn.name || "anonymous function",
          metadata: {
            attempt: attempt + 1,
            maxAttempts: maxRetries + 1,
            timestamp: new Date().toISOString(),
          },
        })

        if (attempt === maxRetries || !retryCondition(lastError)) {
          throw lastError
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * 2 ** attempt))
      }
    }

    throw lastError
  }
}
