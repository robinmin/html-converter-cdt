/**
 * Conversion Error
 *
 * Comprehensive error handling system for HTML conversion operations.
 * Provides structured error classification, context preservation, and debugging information.
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_FORMAT = "INVALID_FORMAT",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  CDP_ERROR = "CDP_ERROR",
  FILE_SYSTEM_ERROR = "FILE_SYSTEM_ERROR",
  MEMORY_ERROR = "MEMORY_ERROR",
  CONVERSION_FAILED = "CONVERSION_FAILED",
  RENDERING_ERROR = "RENDERING_ERROR",
  EXPORT_ERROR = "EXPORT_ERROR",
  RESOURCE_ERROR = "RESOURCE_ERROR",
  PERMISSION_ERROR = "PERMISSION_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
}

/**
 * Standard error codes with user-friendly messages
 */
export enum ErrorCode {
  // Network errors
  NETWORK_CONNECTION_FAILED = "NETWORK_CONNECTION_FAILED",
  NETWORK_DNS_ERROR = "NETWORK_DNS_ERROR",
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  NETWORK_SSL_ERROR = "NETWORK_SSL_ERROR",
  NETWORK_PROXY_ERROR = "NETWORK_PROXY_ERROR",

  // Timeout errors
  OPERATION_TIMEOUT = "OPERATION_TIMEOUT",
  CDP_TIMEOUT = "CDP_TIMEOUT",
  CONVERSION_TIMEOUT = "CONVERSION_TIMEOUT",

  // Input validation errors
  INVALID_FILE_PATH = "INVALID_FILE_PATH",
  INVALID_URL = "INVALID_URL",
  INVALID_HTML = "INVALID_HTML",
  INVALID_OPTIONS = "INVALID_OPTIONS",
  MALFORMED_INPUT = "MALFORMED_INPUT",

  // Format errors
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  FORMAT_CONVERSION_FAILED = "FORMAT_CONVERSION_FAILED",
  INVALID_OUTPUT_FORMAT = "INVALID_OUTPUT_FORMAT",

  // CDP errors
  CDP_CONNECTION_FAILED = "CDP_CONNECTION_FAILED",
  CDP_PROTOCOL_ERROR = "CDP_PROTOCOL_ERROR",
  CDP_TARGET_NOT_FOUND = "CDP_TARGET_NOT_FOUND",
  CDP_COMMAND_FAILED = "CDP_COMMAND_FAILED",
  CHROME_NOT_FOUND = "CHROME_NOT_FOUND",
  CHROME_LAUNCH_FAILED = "CHROME_LAUNCH_FAILED",

  // File system errors
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_ACCESS_DENIED = "FILE_ACCESS_DENIED",
  FILE_ALREADY_EXISTS = "FILE_ALREADY_EXISTS",
  DISK_FULL = "DISK_FULL",
  INVALID_PATH = "INVALID_PATH",

  // Memory errors
  OUT_OF_MEMORY = "OUT_OF_MEMORY",
  MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED",
  BUFFER_OVERFLOW = "BUFFER_OVERFLOW",

  // Conversion errors
  CONVERSION_FAILED = "CONVERSION_FAILED",
  CONVERSION_ABORTED = "CONVERSION_ABORTED",
  CONVERSION_CORRUPTED = "CONVERSION_CORRUPTED",

  // Rendering errors
  RENDERING_FAILED = "RENDERING_FAILED",
  RENDERING_CRASHED = "RENDERING_CRASHED",
  RENDERING_TIMEOUT = "RENDERING_TIMEOUT",
  JAVASCRIPT_ERROR = "JAVASCRIPT_ERROR",

  // Export errors
  EXPORT_FAILED = "EXPORT_FAILED",
  EXPORT_PERMISSION_DENIED = "EXPORT_PERMISSION_DENIED",
  EXPORT_INVALID_PATH = "EXPORT_INVALID_PATH",

  // Resource errors
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_LOAD_FAILED = "RESOURCE_LOAD_FAILED",
  RESOURCE_BLOCKED = "RESOURCE_BLOCKED",
  RESOURCE_TIMEOUT = "RESOURCE_TIMEOUT",

  // Permission errors
  PERMISSION_DENIED = "PERMISSION_DENIED",
  INSUFFICIENT_PRIVILEGES = "INSUFFICIENT_PRIVILEGES",
  SANDBOX_VIOLATION = "SANDBOX_VIOLATION",

  // Configuration errors
  CONFIG_INVALID = "CONFIG_INVALID",
  CONFIG_MISSING = "CONFIG_MISSING",
  CONFIG_INCOMPATIBLE = "CONFIG_INCOMPATIBLE",
}

/**
 * Error context information for debugging
 */
export interface ErrorContext {
  /** Operation being performed when error occurred */
  operation?: string
  /** File path or URL involved */
  resource?: string
  /** Additional metadata */
  metadata?: Record<string, any>
  /** Correlation ID for tracking errors across operations */
  correlationId?: string
  /** Stack trace from original error */
  originalStack?: string
  /** User-friendly suggestions */
  suggestions?: string[]
  /** Retry information */
  retryInfo?: {
    canRetry: boolean
    maxRetries?: number
    currentRetry?: number
    backoffMs?: number
  }
}

/**
 * Conversion error with comprehensive context and classification
 *
 * ConversionError provides structured error handling for HTML conversion operations
 * with standardized error codes, user-friendly messages, and debugging information.
 * Each error includes context metadata, recovery suggestions, and retry information.
 *
 * @example
 * ```typescript
 * // Create a conversion error
 * const error = new ConversionError(
 *   "Failed to convert URL: https://example.com",
 *   ErrorCode.NETWORK_CONNECTION_FAILED,
 *   ErrorCategory.NETWORK_ERROR,
 *   ErrorSeverity.HIGH,
 *   {
 *     operation: "URL conversion",
 *     resource: "https://example.com",
 *     suggestions: ["Check internet connection", "Verify URL"],
 *     retryInfo: { canRetry: true, maxRetries: 3 }
 *   }
 * );
 *
 * // Get user-friendly message
 * console.log(error.getUserMessage());
 *
 * // Check if error is retryable
 * if (error.isRetryable()) {
 *   console.log("This error can be retried");
 * }
 *
 * // Serialize for logging
 * console.log(JSON.stringify(error.toJSON(), null, 2));
 * ```
 */
export class ConversionError extends Error {
  /** Error class name for identification */
  public readonly name = "ConversionError"

  /**
   * Creates a new ConversionError instance
   *
   * @param message - Human-readable error message
   * @param code - Standardized error code from ErrorCode enum
   * @param category - Error category for classification and routing
   * @param severity - Error severity level (default: MEDIUM)
   * @param context - Additional context information for debugging
   * @param originalError - Original error that caused this ConversionError
   * @param timestamp - When the error occurred (default: current time)
   */
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly category: ErrorCategory,
    public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public readonly context: ErrorContext = {},
    public readonly originalError?: Error,
    public readonly timestamp: Date = new Date(),
  ) {
    super(message)

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ConversionError.prototype)

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConversionError)
    }
  }

  /**
   * Get user-friendly message with suggestions
   *
   * Returns a formatted error message with recovery suggestions if available.
   * This method is designed to provide clear, actionable feedback to end users.
   *
   * @returns Formatted error message with suggestions
   *
   * @example
   * ```typescript
   * const error = new ConversionError(
   *   "Network connection failed",
   *   ErrorCode.NETWORK_CONNECTION_FAILED,
   *   ErrorCategory.NETWORK_ERROR,
   *   ErrorSeverity.HIGH,
   *   {
   *     suggestions: [
   *       "Check your internet connection",
   *       "Verify the URL is correct",
   *       "Try again later"
   *     ]
   *   }
   * );
   *
   * console.log(error.getUserMessage());
   * // Output:
   * // Network connection failed
   * //
   * // Suggestions:
   * // 1. Check your internet connection
   * // 2. Verify the URL is correct
   * // 3. Try again later
   * ```
   */
  getUserMessage(): string {
    let message = this.message

    // Add suggestions if available
    if (this.context.suggestions && this.context.suggestions.length > 0) {
      message += "\n\nSuggestions:"
      this.context.suggestions.forEach((suggestion, index) => {
        message += `\n${index + 1}. ${suggestion}`
      })
    }

    return message
  }

  /**
   * Check if error is retryable
   *
   * Determines whether the operation that caused this error can be retried.
   * This is based on both explicit retry information in the context and
   * the error category's default retryability.
   *
   * @returns True if the error can be retried, false otherwise
   *
   * @example
   * ```typescript
   * const networkError = new ConversionError(
   *   "Connection failed",
   *   ErrorCode.NETWORK_CONNECTION_FAILED,
   *   ErrorCategory.NETWORK_ERROR,
   *   ErrorSeverity.HIGH,
   *   {
   *     retryInfo: { canRetry: true, maxRetries: 3 }
   *   }
   * );
   *
   * if (networkError.isRetryable()) {
   *   // Implement retry logic
   *   await retryOperation();
   * }
   * ```
   */
  isRetryable(): boolean {
    return this.context.retryInfo?.canRetry ?? this.getDefaultRetryability()
  }

  /**
   * Get retry information
   *
   * Returns the retry configuration for this error, including whether
   * it can be retried, maximum retry attempts, current retry count,
   * and backoff delay.
   *
   * @returns Retry information object or undefined if not available
   *
   * @example
   * ```typescript
   * const retryInfo = error.getRetryInfo();
   * if (retryInfo && retryInfo.canRetry) {
   *   console.log(`Can retry ${retryInfo.maxRetries} times`);
   *   if (retryInfo.backoffMs) {
   *     await setTimeout(retryInfo.backoffMs);
   *   }
   * }
   * ```
   */
  getRetryInfo(): ErrorContext["retryInfo"] {
    return this.context.retryInfo
  }

  /**
   * Serialize error to JSON for logging
   *
   * Converts the error to a JSON-serializable object for logging,
   * debugging, and API responses. Sensitive information like
   * original stack traces are filtered out for security.
   *
   * @returns JSON-serializable error object
   *
   * @example
   * ```typescript
   * // Log error to file
   * const logData = JSON.stringify(error.toJSON(), null, 2);
   * logger.error('Conversion failed', logData);
   *
   * // Send error to monitoring service
   * fetch('/api/errors', {
   *   method: 'POST',
   *   body: JSON.stringify(error.toJSON()),
   *   headers: { 'Content-Type': 'application/json' }
   * });
   * ```
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      context: {
        ...this.context,
        // Don't include potentially sensitive original stack in JSON
        originalStack: undefined,
      },
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
          }
        : undefined,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    }
  }

  /**
   * Convert error to string representation with code
   *
   * Returns a concise string representation of the error including
   * the error name, code, and message. Useful for logging and debugging.
   *
   * @returns String representation in format "ConversionError [CODE]: message"
   *
   * @example
   * ```typescript
   * console.log(error.toString());
   * // Output: "ConversionError [NETWORK_CONNECTION_FAILED]: Network connection failed"
   * ```
   */
  toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`
  }

  /**
   * Add context information to the error
   *
   * Allows adding additional context metadata after the error has been created.
   * This is useful for enriching error information as it propagates through
   * different layers of the application.
   *
   * @param key - Context key (e.g., 'userId', 'sessionId', 'requestId')
   * @param value - Context value
   *
   * @example
   * ```typescript
   * try {
   *   await processRequest();
   * } catch (error) {
   *     const conversionError = errorHandler.normalizeError(error);
   *     conversionError.addContext('userId', getCurrentUser().id);
   *     conversionError.addContext('requestId', request.id);
   *     throw conversionError;
   *   }
   * ```
   */
  addContext(key: string, value: any): void {
    // Convert context to Map if it's not already
    if (!this.context.metadata) {
      this.context.metadata = {}
    }
    this.context.metadata[key] = value
  }

  /**
   * Create error from unknown error
   */
  static fromError(
    error: unknown,
    defaultMessage = "An unknown error occurred",
    defaultCode = ErrorCode.CONVERSION_FAILED,
    defaultCategory = ErrorCategory.CONVERSION_FAILED,
    context?: ErrorContext,
  ): ConversionError {
    if (error instanceof ConversionError) {
      return error
    }

    // Defensive checks for undefined parameters
    const safeMessage = defaultMessage || "An unknown error occurred"
    const safeCode = defaultCode != null ? defaultCode : ErrorCode.CONVERSION_FAILED
    const safeCategory = defaultCategory != null ? defaultCategory : ErrorCategory.CONVERSION_FAILED
    const safeContext = context || {}

    if (error instanceof Error) {
      // Try to map common error patterns
      const mappedError = ConversionError.mapErrorToConversionError(error)
      if (mappedError) {
        return mappedError
      }

      return new ConversionError(
        error.message || safeMessage,
        safeCode,
        safeCategory,
        ErrorSeverity.MEDIUM,
        { originalStack: error.stack, ...safeContext },
        error,
      )
    }

    return new ConversionError(
      typeof error === "string" ? error : safeMessage,
      safeCode,
      safeCategory,
      ErrorSeverity.MEDIUM,
      safeContext,
    )
  }

  /**
   * Map common Node.js/Chrome errors to ConversionError
   */
  private static mapErrorToConversionError(error: Error): ConversionError | null {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ""

    // Network errors
    if (message.includes("econnrefused") || message.includes("enotfound")) {
      return new ConversionError(
        "Network connection failed. Please check your internet connection and try again.",
        ErrorCode.NETWORK_CONNECTION_FAILED,
        ErrorCategory.NETWORK_ERROR,
        ErrorSeverity.HIGH,
        {
          suggestions: ["Check your internet connection", "Verify the URL is correct", "Try again later"],
          retryInfo: { canRetry: true, maxRetries: 3 },
        },
        error,
      )
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("timed out")) {
      return new ConversionError(
        "The operation took too long and was cancelled. Try increasing the timeout or simplifying the content.",
        ErrorCode.OPERATION_TIMEOUT,
        ErrorCategory.TIMEOUT,
        ErrorSeverity.MEDIUM,
        {
          suggestions: ["Increase timeout settings", "Simplify the content", "Check system resources"],
          retryInfo: { canRetry: true, maxRetries: 2, backoffMs: 1000 },
        },
        error,
      )
    }

    // File system errors
    if (message.includes("enoent") || message.includes("file not found")) {
      return new ConversionError(
        "The specified file was not found. Please check the file path and try again.",
        ErrorCode.FILE_NOT_FOUND,
        ErrorCategory.FILE_SYSTEM_ERROR,
        ErrorSeverity.HIGH,
        { suggestions: ["Verify the file path is correct", "Check if the file exists"] },
        error,
      )
    }

    if (message.includes("eacces") || message.includes("permission denied")) {
      return new ConversionError(
        "Permission denied. Please check file permissions and try again.",
        ErrorCode.FILE_ACCESS_DENIED,
        ErrorCategory.PERMISSION_ERROR,
        ErrorSeverity.HIGH,
        { suggestions: ["Check file permissions", "Run with appropriate privileges"] },
        error,
      )
    }

    // Chrome/CDP errors
    if (stack.includes("chrome") || message.includes("chrome") || message.includes("devtools")) {
      return new ConversionError(
        "Failed to communicate with Chrome. Make sure Chrome is installed and up to date.",
        ErrorCode.CDP_CONNECTION_FAILED,
        ErrorCategory.CDP_ERROR,
        ErrorSeverity.HIGH,
        {
          suggestions: ["Install or update Chrome", "Check Chrome installation path", "Try restarting Chrome"],
          retryInfo: { canRetry: true, maxRetries: 2 },
        },
        error,
      )
    }

    // Memory errors
    if (message.includes("out of memory") || message.includes("memory")) {
      return new ConversionError(
        "The system ran out of memory. Try reducing the content size or closing other applications.",
        ErrorCode.OUT_OF_MEMORY,
        ErrorCategory.MEMORY_ERROR,
        ErrorSeverity.CRITICAL,
        { suggestions: ["Close other applications", "Reduce content size", "Increase system memory"] },
        error,
      )
    }

    return null
  }

  /**
   * Get default retryability based on error category
   */
  private getDefaultRetryability(): boolean {
    switch (this.category) {
      case ErrorCategory.NETWORK_ERROR:
      case ErrorCategory.TIMEOUT:
      case ErrorCategory.CDP_ERROR:
      case ErrorCategory.RESOURCE_ERROR:
        return true
      case ErrorCategory.INVALID_INPUT:
      case ErrorCategory.INVALID_FORMAT:
      case ErrorCategory.PERMISSION_ERROR:
      case ErrorCategory.FILE_SYSTEM_ERROR:
        return false
      default:
        return false
    }
  }
}

/**
 * Type guard to check if error is ConversionError
 */
export function isConversionError(error: unknown): error is ConversionError {
  return error instanceof ConversionError
}

/**
 * Create conversion error with convenience method
 */
export function createConversionError(
  message: string,
  code: ErrorCode,
  context?: ErrorContext,
  originalError?: Error,
): ConversionError {
  // Ensure all parameters are defined - handle all falsy values
  const safeMessage = message || "An error occurred"
  const safeCode = code != null ? code : ErrorCode.CONVERSION_FAILED
  const safeContext = context || {}

  // Determine category and severity from code
  const category = getCategoryFromCode(safeCode)
  const severity = getSeverityFromCode(safeCode)

  // Additional defensive check - ensure severity is valid
  const safeSeverity = severity || ErrorSeverity.MEDIUM

  return new ConversionError(safeMessage, safeCode, category, safeSeverity, safeContext, originalError)
}

/**
 * Helper functions for ConversionError class
 */
export function getCategoryFromCode(code: ErrorCode): ErrorCategory {
  // Defensive check for undefined code
  if (code === undefined || code === null) {
    return ErrorCategory.CONVERSION_FAILED
  }

  // Ensure code is a string before calling string methods
  const codeStr = String(code)

  // Check for permission errors first (highest priority for access issues)
  if (codeStr.startsWith("PERMISSION_") || codeStr.includes("SANDBOX") || codeStr.includes("ACCESS_DENIED")) {
    return ErrorCategory.PERMISSION_ERROR
  }
  if (codeStr.startsWith("NETWORK_")) {
    return ErrorCategory.NETWORK_ERROR
  }
  if (codeStr.startsWith("TIMEOUT_") || codeStr.includes("TIMEOUT")) {
    return ErrorCategory.TIMEOUT
  }
  if (codeStr.startsWith("INVALID_") || codeStr.startsWith("MALFORMED")) {
    return ErrorCategory.INVALID_INPUT
  }
  if (codeStr.includes("FORMAT")) {
    return ErrorCategory.INVALID_FORMAT
  }
  if (codeStr.startsWith("CDP_") || codeStr.startsWith("CHROME_")) {
    return ErrorCategory.CDP_ERROR
  }
  if (codeStr.startsWith("FILE_") || codeStr.includes("DISK") || codeStr.includes("PATH")) {
    return ErrorCategory.FILE_SYSTEM_ERROR
  }
  if (codeStr.includes("MEMORY") || codeStr.includes("BUFFER")) {
    return ErrorCategory.MEMORY_ERROR
  }
  if (codeStr.startsWith("CONVERSION_")) {
    return ErrorCategory.CONVERSION_FAILED
  }
  if (codeStr.startsWith("RENDERING_") || codeStr.includes("JAVASCRIPT")) {
    return ErrorCategory.RENDERING_ERROR
  }
  if (codeStr.startsWith("EXPORT_")) {
    return ErrorCategory.EXPORT_ERROR
  }
  if (codeStr.startsWith("RESOURCE_")) {
    return ErrorCategory.RESOURCE_ERROR
  }
  if (codeStr.startsWith("CONFIG_")) {
    return ErrorCategory.CONFIGURATION_ERROR
  }
  return ErrorCategory.CONVERSION_FAILED
}

export function getSeverityFromCode(code: ErrorCode): ErrorSeverity {
  // Defensive checks for undefined code
  if (code === undefined || code === null) {
    return ErrorSeverity.MEDIUM
  }

  // Ensure code is a string before calling string methods
  const codeStr = String(code)

  if (codeStr.includes("CRITICAL") || codeStr.includes("CRASHED") || codeStr.includes("CORRUPTED") || codeStr === "OUT_OF_MEMORY") {
    return ErrorSeverity.CRITICAL
  }
  if (codeStr.includes("FAILED") || codeStr.includes("DENIED") || codeStr.includes("NOT_FOUND")) {
    return ErrorSeverity.HIGH
  }
  if (codeStr === "CONFIG_INVALID") {
    return ErrorSeverity.LOW
  }
  if (codeStr.includes("INVALID") || codeStr.includes("MALFORMED")) {
    return ErrorSeverity.MEDIUM
  }
  if (codeStr.includes("TIMEOUT")) {
    return ErrorSeverity.MEDIUM
  }
  return ErrorSeverity.LOW
}
