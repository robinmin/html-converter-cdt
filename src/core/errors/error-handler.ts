/**
 * Error Handler
 *
 * Comprehensive error normalization and handling system for the HTML converter.
 * Provides error mapping, user-friendly message generation, structured logging,
 * and recovery strategy suggestions for various error sources.
 */

import type {
  ErrorContext,
} from "./conversion-error.js"
import {
  ConversionError,
  createConversionError,
  ErrorCategory,
  ErrorCode,
  ErrorSeverity,
  isConversionError,
} from "./conversion-error.js"
import {
  getErrorMessage,
} from "./error-codes.js"
import type {
  CircuitBreakerConfig,
  ContextEnhancementConfig,
  ContextManager,
  RateLimiterConfig,
  RecoveryManager,
  RecoveryResult,
  RetryConfig,
} from "./error-recovery.js"
import {
  defaultContextManager,
  defaultRecoveryManager,

} from "./error-recovery.js"

/**
 * Error handler configuration options
 */
export interface ErrorHandlerConfig {
  /** Enable debug logging for development */
  debug?: boolean
  /** Maximum number of stack trace lines to preserve */
  maxStackLines?: number
  /** Enable user-friendly message sanitization */
  sanitizeMessages?: boolean
  /** Custom error handler function */
  customHandler?: (error: ConversionError) => void
  /** Logger integration function */
  logger?: (level: "debug" | "info" | "warn" | "error", message: string, context?: any) => void
  /** Correlation ID generator function */
  correlationIdGenerator?: () => string
  /** Recovery configuration */
  recoveryConfig?: Partial<RetryConfig>
  /** Circuit breaker configuration */
  circuitBreakerConfig?: CircuitBreakerConfig
  /** Rate limiter configuration */
  rateLimiterConfig?: RateLimiterConfig
  /** Context enhancement configuration */
  contextConfig?: ContextEnhancementConfig
  /** Custom recovery manager */
  recoveryManager?: RecoveryManager
  /** Custom context manager */
  contextManager?: ContextManager
  /** Enable automatic recovery attempts */
  enableAutoRecovery?: boolean
}

/**
 * Error normalization result with enhanced context
 */
export interface ErrorNormalizationResult {
  /** Normalized ConversionError instance */
  error: ConversionError
  /** Original error type detection */
  originalErrorType: string
  /** Confidence in error classification (0-1) */
  classificationConfidence: number
  /** Additional context gathered during normalization */
  additionalContext: Partial<ErrorContext>
  /** Recommended actions */
  recommendedActions: string[]
}

/**
 * Error source classification
 */
export enum ErrorSource {
  /** Node.js system errors */
  NODE_SYSTEM = "NODE_SYSTEM",
  /** Node.js network errors */
  NODE_NETWORK = "NODE_NETWORK",
  /** Chrome DevTools Protocol errors */
  CDP_ERROR = "CDP_ERROR",
  /** JavaScript runtime errors */
  JAVASCRIPT_RUNTIME = "JAVASCRIPT_RUNTIME",
  /** File system errors */
  FILE_SYSTEM = "FILE_SYSTEM",
  /** User input validation errors */
  USER_INPUT = "USER_INPUT",
  /** Custom application errors */
  APPLICATION = "APPLICATION",
  /** Unknown error source */
  UNKNOWN = "UNKNOWN",
}

/**
 * Error statistics and metrics
 */
export interface ErrorMetrics {
  /** Total errors handled */
  totalErrors: number
  /** Error count by category */
  errorsByCategory: Record<ErrorCategory, number>
  /** Error count by source */
  errorsBySource: Record<ErrorSource, number>
  /** Most frequent errors */
  frequentErrors: Array<{
    code: ErrorCode
    count: number
    lastOccurred: Date
  }>
  /** Error recovery success rate */
  recoverySuccessRate: number
}

/**
 * Comprehensive error handler for normalization and management
 */
export class ErrorHandler {
  private config: Required<ErrorHandlerConfig>
  private metrics: ErrorMetrics
  private correlationIdCounter = 0
  private recoveryManager: RecoveryManager
  private contextManager: ContextManager

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      debug: config.debug ?? false,
      maxStackLines: config.maxStackLines ?? 20,
      sanitizeMessages: config.sanitizeMessages ?? true,
      customHandler: config.customHandler ?? (() => {}),
      logger: config.logger ?? (() => {}),
      correlationIdGenerator: config.correlationIdGenerator ?? (() => this.generateCorrelationId()),
      recoveryConfig: config.recoveryConfig ?? {},
      circuitBreakerConfig: config.circuitBreakerConfig ?? { failureThreshold: 5, recoveryTimeoutMs: 60000, successThreshold: 3 },
      rateLimiterConfig: config.rateLimiterConfig ?? { maxErrors: 10, windowMs: 60000, perOperation: true },
      contextConfig: config.contextConfig ?? {
        capturePerformance: true,
        trackDuration: true,
        captureSystemState: false,
        maxStackFrames: 10,
        sanitizeContext: true,
      },
      recoveryManager: config.recoveryManager ?? defaultRecoveryManager,
      contextManager: config.contextManager ?? defaultContextManager,
      enableAutoRecovery: config.enableAutoRecovery ?? false,
    }

    // Initialize recovery and context managers
    this.recoveryManager = this.config.recoveryManager
    this.contextManager = this.config.contextManager

    this.metrics = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySource: {} as Record<ErrorSource, number>,
      frequentErrors: [],
      recoverySuccessRate: 0,
    }

    // Initialize error counters
    Object.values(ErrorCategory).forEach((category) => {
      this.metrics.errorsByCategory[category] = 0
    })
    Object.values(ErrorSource).forEach((source) => {
      this.metrics.errorsBySource[source] = 0
    })
  }

  /**
   * Normalize and handle an error from any source
   */
  handleError(error: unknown, context?: Partial<ErrorContext>): ErrorNormalizationResult {
    this.metrics.totalErrors++

    // Add start time to context for duration tracking
    const initialContext = {
      ...context,
      metadata: {
        ...context?.metadata,
        startTime: context?.metadata?.startTime || Date.now(),
      },
    }

    const result = this._normalizeError(error, initialContext)

    // Enhance context with additional information
    const enhancedContext = this.contextManager.enhanceContext(result.error, result.error.context)

    // Merge additional context into enhanced context
    if (result.additionalContext) {
      enhancedContext.metadata = {
        ...enhancedContext.metadata,
        ...result.additionalContext.metadata,
      }
    }

    // Check if result.error is a valid object with required properties
    if (!result.error || typeof result.error !== "object") {
      this.config.logger("error", "Invalid error object in normalization result", {
        result,
        errorType: typeof result.error,
      })
      // Create a new ConversionError from scratch and return immediately
      result.error = new ConversionError(
        "An error occurred during conversion",
        ErrorCode.CONVERSION_FAILED,
        ErrorCategory.CONVERSION_FAILED,
        ErrorSeverity.MEDIUM,
        enhancedContext,
      )
      // Update metrics for the recreated error
      this.updateMetrics(result.error)
      // Log the error
      this.logError(result.error, result.originalErrorType)
      // Call custom handler if provided
      try {
        this.config.customHandler(result.error)
      } catch (handlerError) {
        this.config.logger("error", "Custom error handler failed", {
          originalError: result.error,
          handlerError,
        })
      }
      return result
    }

    // Create new ConversionError with enhanced context
    // Skip recreating if it's already properly formatted
    if (result.error instanceof ConversionError
      && result.error.code
      && result.error.category
      && result.error.severity) {
      // Just update the context
      Object.assign(result.error.context, enhancedContext)
      // Update metrics for the enhanced error
      this.updateMetrics(result.error)
      // Log the error
      this.logError(result.error, result.originalErrorType)
      // Call custom handler if provided
      try {
        this.config.customHandler(result.error)
      } catch (handlerError) {
        this.config.logger("error", "Custom error handler failed", {
          originalError: result.error,
          handlerError,
        })
      }
      return result
    }

    // Ensure we have valid values for the ConversionError constructor
    const safeCode = result.error.code || ErrorCode.CONVERSION_FAILED
    const safeCategory = result.error.category || ErrorCategory.CONVERSION_FAILED
    const safeSeverity = result.error.severity || ErrorSeverity.MEDIUM

    result.error = new ConversionError(
      result.error.message || "An error occurred during conversion",
      safeCode,
      safeCategory,
      safeSeverity,
      enhancedContext,
      result.error.originalError,
      result.error.timestamp,
    )

    // Update metrics
    this.updateMetrics(result.error)

    // Log the error
    this.logError(result.error, result.originalErrorType)

    // Call custom handler if provided
    try {
      this.config.customHandler(result.error)
    } catch (handlerError) {
      this.config.logger("error", "Custom error handler failed", {
        originalError: result.error,
        handlerError,
      })
    }

    return result
  }

  /**
   * Normalize an error to ConversionError format (convenience method)
   * Returns just the ConversionError instance without additional metadata
   */
  normalizeError(error: unknown, context?: Partial<ErrorContext>): ConversionError {
    const result = this.handleError(error, context)
    return result.error
  }

  /**
   * Internal normalize error method that returns full result
   */
  private _normalizeError(
    error: unknown,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    // If it's already a ConversionError, enhance it
    if (isConversionError(error)) {
      return this.enhanceExistingConversionError(error, context)
    }

    // Classify error source
    const errorSource = this.classifyErrorSource(error)

    // Convert based on source
    switch (errorSource) {
      case ErrorSource.NODE_SYSTEM:
        return this.handleNodeSystemError(error, context)

      case ErrorSource.NODE_NETWORK:
        return this.handleNodeNetworkError(error, context)

      case ErrorSource.CDP_ERROR:
        return this.handleCdpError(error, context)

      case ErrorSource.JAVASCRIPT_RUNTIME:
        return this.handleJavaScriptError(error, context)

      case ErrorSource.FILE_SYSTEM:
        return this.handleFileSystemError(error, context)

      case ErrorSource.USER_INPUT:
        return this.handleUserInputError(error, context)

      case ErrorSource.APPLICATION:
        return this.handleApplicationError(error, context)

      default:
        // For unknown errors, preserve any metadata from context
        return this.handleUnknownError(error, context)
    }
  }

  /**
   * Classify the source of an error
   */
  private classifyErrorSource(error: unknown): ErrorSource {
    if (!(error instanceof Error)) {
      return ErrorSource.UNKNOWN
    }

    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ""
    const constructor = error.constructor.name.toLowerCase()

    // Check for input validation errors first (highest priority for user-facing errors)
    if (message.includes("invalid input") || message.includes("invalid format")
      || (constructor.includes("typeerror") && (message.includes("invalid") || message.includes("input")))) {
      return ErrorSource.USER_INPUT
    }

    // Check constructor name for JavaScript errors (but exclude input-related ones)
    if (constructor.includes("typeerror") || constructor.includes("referenceerror")) {
      return ErrorSource.JAVASCRIPT_RUNTIME
    }

    // Check for CDP/Chrome related errors
    if (stack.includes("chrome") || stack.includes("devtools")
      || stack.includes("websocket") || message.includes("cdp")) {
      return ErrorSource.CDP_ERROR
    }

    // Check for network errors
    if (message.includes("econnrefused") || message.includes("enotfound")
      || message.includes("timeout") || message.includes("network")
      || message.includes("http") || message.includes("fetch")) {
      return ErrorSource.NODE_NETWORK
    }

    // Check for file system errors
    if (message.includes("enoent") || message.includes("eacces")
      || message.includes("file") || message.includes("path")
      || message.includes("directory") || message.includes("disk")) {
      return ErrorSource.FILE_SYSTEM
    }

    // Check for system errors
    if (constructor.includes("error")
      && (message.includes("system") || message.includes("process")
        || message.includes("permission") || message.includes("memory"))) {
      return ErrorSource.NODE_SYSTEM
    }

    return ErrorSource.UNKNOWN
  }

  /**
   * Handle Node.js system errors
   */
  private handleNodeSystemError(
    error: unknown,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    if (!(error instanceof Error)) {
      return this.createGenericError(error, ErrorSource.NODE_SYSTEM, context)
    }

    const message = error.message.toLowerCase()
    let errorCode = ErrorCode.CONVERSION_FAILED
    let conversionError: ConversionError

    // Memory errors
    if (message.includes("out of memory") || message.includes("memory")) {
      errorCode = ErrorCode.OUT_OF_MEMORY
      conversionError = createConversionError(
        "The system ran out of memory during conversion.",
        errorCode,
        {
          ...context,
          correlationId: this.config.correlationIdGenerator(),
          operation: "memory_allocation",
          originalStack: this.truncateStack(error.stack),
          suggestions: [
            "Close other applications to free memory",
            "Reduce the content size or complexity",
            "Increase system memory if possible",
          ],
          retryInfo: { canRetry: false },
        },
        error,
      )
    } else if (message.includes("permission") || message.includes("eacces")) { // Permission errors
      errorCode = ErrorCode.PERMISSION_DENIED
      conversionError = createConversionError(
        "Permission denied. Check file and directory permissions.",
        errorCode,
        {
          ...context,
          correlationId: this.config.correlationIdGenerator(),
          operation: "system_access",
          originalStack: this.truncateStack(error.stack),
          suggestions: [
            "Run with appropriate privileges",
            "Check file and directory permissions",
            "Ensure the process has required access rights",
          ],
          retryInfo: { canRetry: false },
        },
        error,
      )
    } else { // Generic system error
      conversionError = createConversionError(
        `System error: ${error.message}`,
        errorCode,
        {
          ...context,
          correlationId: this.config.correlationIdGenerator(),
          operation: "system_operation",
          originalStack: this.truncateStack(error.stack),
        },
        error,
      )
    }

    return {
      error: conversionError,
      originalErrorType: "NodeSystemError",
      classificationConfidence: 0.8,
      additionalContext: { metadata: { source: ErrorSource.NODE_SYSTEM } },
      recommendedActions: this.getRecommendedActions(errorCode),
    }
  }

  /**
   * Handle Node.js network errors
   */
  private handleNodeNetworkError(
    error: unknown,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    if (!(error instanceof Error)) {
      return this.createGenericError(error, ErrorSource.NODE_NETWORK, context)
    }

    const message = error.message.toLowerCase()
    let errorCode = ErrorCode.NETWORK_CONNECTION_FAILED

    // Specific network error mapping
    if (message.includes("enotfound") || message.includes("dns")) {
      errorCode = ErrorCode.NETWORK_DNS_ERROR
    } else if (message.includes("timeout") || message.includes("timed out")) {
      errorCode = ErrorCode.NETWORK_TIMEOUT
    } else if (message.includes("ssl") || message.includes("tls") || message.includes("certificate")) {
      errorCode = ErrorCode.NETWORK_SSL_ERROR
    }

    const conversionError = createConversionError(
      `Network error: ${error.message}`,
      errorCode,
      {
        ...context,
        correlationId: this.config.correlationIdGenerator(),
        operation: "network_operation",
        originalStack: this.truncateStack(error.stack),
        suggestions: [
          "Check your internet connection",
          "Verify the URL is correct and accessible",
          "Try again later",
        ],
        retryInfo: { canRetry: true, maxRetries: 3, backoffMs: 1000 },
      },
      error,
    )

    return {
      error: conversionError,
      originalErrorType: "NodeNetworkError",
      classificationConfidence: 0.9,
      additionalContext: { metadata: { source: ErrorSource.NODE_NETWORK } },
      recommendedActions: [
        "Check your internet connection",
        "Verify the URL is correct and accessible",
        "Try again later",
      ],
    }
  }

  /**
   * Handle Chrome DevTools Protocol errors
   */
  private handleCdpError(
    error: unknown,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    if (!(error instanceof Error)) {
      return this.createGenericError(error, ErrorSource.CDP_ERROR, context)
    }

    const message = error.message.toLowerCase()
    let errorCode = ErrorCode.CDP_CONNECTION_FAILED

    // Specific CDP error mapping
    if (message.includes("timeout")) {
      errorCode = ErrorCode.CDP_TIMEOUT
    } else if (message.includes("target") && message.includes("not found")) {
      errorCode = ErrorCode.CDP_TARGET_NOT_FOUND
    } else if (message.includes("command") && message.includes("failed")) {
      errorCode = ErrorCode.CDP_COMMAND_FAILED
    } else if (message.includes("protocol") || message.includes("invalid")) {
      errorCode = ErrorCode.CDP_PROTOCOL_ERROR
    }

    const conversionError = createConversionError(
      `Chrome DevTools Protocol error: ${error.message}`,
      errorCode,
      {
        ...context,
        correlationId: this.config.correlationIdGenerator(),
        operation: "chrome_devtools_protocol",
        originalStack: this.truncateStack(error.stack),
        suggestions: [
          "Check if Chrome is installed and running",
          "Verify Chrome DevTools Protocol is enabled",
          "Try restarting Chrome",
        ],
        retryInfo: { canRetry: true, maxRetries: 2, backoffMs: 1000 },
      },
      error,
    )

    return {
      error: conversionError,
      originalErrorType: "CdpError",
      classificationConfidence: 0.95,
      additionalContext: { metadata: { source: ErrorSource.CDP_ERROR } },
      recommendedActions: [
        "Check if Chrome is installed and running",
        "Verify Chrome DevTools Protocol is enabled",
        "Try restarting Chrome",
      ],
    }
  }

  /**
   * Handle JavaScript runtime errors
   */
  private handleJavaScriptError(
    error: unknown,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    if (!(error instanceof Error)) {
      return this.createGenericError(error, ErrorSource.JAVASCRIPT_RUNTIME, context)
    }

    const constructor = error.constructor.name.toLowerCase()
    let errorCode = ErrorCode.JAVASCRIPT_ERROR

    // Specific JavaScript error mapping
    if (constructor.includes("typeerror")) {
      errorCode = ErrorCode.JAVASCRIPT_ERROR
    } else if (constructor.includes("referenceerror")) {
      errorCode = ErrorCode.JAVASCRIPT_ERROR
    }

    const conversionError = createConversionError(
      `JavaScript error: ${error.message}`,
      errorCode,
      {
        ...context,
        correlationId: this.config.correlationIdGenerator(),
        operation: "javascript_execution",
        originalStack: this.truncateStack(error.stack),
        suggestions: [
          "Check the browser console for detailed error information",
          "Verify JavaScript code is valid",
          "Try disabling JavaScript if not required for conversion",
        ],
        retryInfo: { canRetry: false }, // JavaScript errors are not retryable
      },
      error,
    )

    return {
      error: conversionError,
      originalErrorType: "JavaScriptError",
      classificationConfidence: 0.85,
      additionalContext: { metadata: { source: ErrorSource.JAVASCRIPT_RUNTIME } },
      recommendedActions: [
        "Check the input format and data types",
        "Verify JavaScript code syntax and logic",
        "Check browser console for detailed error information",
      ],
    }
  }

  /**
   * Handle file system errors
   */
  private handleFileSystemError(
    error: unknown,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    if (!(error instanceof Error)) {
      return this.createGenericError(error, ErrorSource.FILE_SYSTEM, context)
    }

    const message = error.message.toLowerCase()
    let errorCode = ErrorCode.FILE_NOT_FOUND

    // Specific file system error mapping
    if (message.includes("enoent") || message.includes("not found")) {
      errorCode = ErrorCode.FILE_NOT_FOUND
    } else if (message.includes("eacces") || message.includes("permission denied")) {
      errorCode = ErrorCode.FILE_ACCESS_DENIED
    } else if (message.includes("eexist") || message.includes("already exists")) {
      errorCode = ErrorCode.FILE_ALREADY_EXISTS
    } else if (message.includes("enospc") || message.includes("disk full")) {
      errorCode = ErrorCode.DISK_FULL
    }

    const conversionError = createConversionError(
      `File system error: ${error.message}`,
      errorCode,
      {
        ...context,
        correlationId: this.config.correlationIdGenerator(),
        operation: "file_system_operation",
        originalStack: this.truncateStack(error.stack),
        suggestions: [
          "Check if the file exists and is accessible",
          "Verify file and directory permissions",
          "Ensure sufficient disk space is available",
        ],
        retryInfo: { canRetry: false },
      },
      error,
    )

    return {
      error: conversionError,
      originalErrorType: "FileSystemError",
      classificationConfidence: 0.9,
      additionalContext: { metadata: { source: ErrorSource.FILE_SYSTEM } },
      recommendedActions: [
        "Check if the file exists and is accessible",
        "Verify file and directory permissions",
        "Ensure sufficient disk space is available",
      ],
    }
  }

  /**
   * Handle user input validation errors
   */
  private handleUserInputError(
    error: unknown,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    if (!(error instanceof Error)) {
      return this.createGenericError(error, ErrorSource.USER_INPUT, context)
    }

    const errorCode = ErrorCode.MALFORMED_INPUT

    const conversionError = createConversionError(
      `Invalid input: ${error.message}`,
      errorCode,
      {
        ...context,
        correlationId: this.config.correlationIdGenerator(),
        operation: "input_validation",
        originalStack: this.truncateStack(error.stack),
        suggestions: [
          "Check input format and requirements",
          "Verify all required fields are provided",
          "Consult the documentation for valid input formats",
        ],
        retryInfo: { canRetry: false },
      },
      error,
    )

    return {
      error: conversionError,
      originalErrorType: "UserInputError",
      classificationConfidence: 0.8,
      additionalContext: { metadata: { source: ErrorSource.USER_INPUT } },
      recommendedActions: [
        "Check input format and requirements",
        "Verify all required fields are provided",
        "Consult the documentation for valid input formats",
      ],
    }
  }

  /**
   * Handle custom application errors
   */
  private handleApplicationError(
    error: unknown,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    if (!(error instanceof Error)) {
      return this.createGenericError(error, ErrorSource.APPLICATION, context)
    }

    const errorCode = ErrorCode.CONVERSION_FAILED

    const conversionError = createConversionError(
      error.message || "An application error occurred",
      errorCode,
      {
        ...context,
        correlationId: this.config.correlationIdGenerator(),
        operation: "application_operation",
        originalStack: this.truncateStack(error.stack),
        suggestions: [
          "Check application configuration",
          "Verify all dependencies are installed",
          "Try restarting the application",
        ],
        retryInfo: { canRetry: true, maxRetries: 2 },
      },
      error,
    )

    return {
      error: conversionError,
      originalErrorType: "ApplicationError",
      classificationConfidence: 0.7,
      additionalContext: { metadata: { source: ErrorSource.APPLICATION } },
      recommendedActions: [
        "Check application configuration",
        "Verify all dependencies are installed",
        "Try restarting the application",
      ],
    }
  }

  /**
   * Handle unknown errors
   */
  private handleUnknownError(
    error: unknown,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    const errorCode = ErrorCode.CONVERSION_FAILED

    // Get original stack trace if it's an Error
    const originalStack = error instanceof Error ? this.truncateStack(error.stack) : undefined

    const conversionError = ConversionError.fromError(
      error,
      "An unknown error occurred during conversion",
      errorCode,
      ErrorCategory.CONVERSION_FAILED,
      {
        ...context,
        correlationId: this.config.correlationIdGenerator(),
        originalStack,
      },
    )

    return {
      error: conversionError,
      originalErrorType: "UnknownError",
      classificationConfidence: 0.5,
      additionalContext: {
        metadata: {
          // Preserve existing source from context if it exists, otherwise use UNKNOWN
          source: context?.metadata?.source || ErrorSource.UNKNOWN,
          // Preserve any other metadata from context
          ...context?.metadata,
        },
      },
      recommendedActions: [
        "Check system logs for more details",
        "Try the operation again with different parameters",
        "Contact support if the problem persists",
      ],
    }
  }

  /**
   * Enhance an existing ConversionError with additional context
   */
  private enhanceExistingConversionError(
    error: ConversionError,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    // Add correlation ID if not present
    if (!error.context.correlationId) {
      error.context.correlationId = this.config.correlationIdGenerator()
    }

    // Merge additional context
    if (context) {
      Object.assign(error.context, context)
    }

    return {
      error,
      originalErrorType: "ConversionError",
      classificationConfidence: 1.0,
      additionalContext: { metadata: { enhanced: true } },
      recommendedActions: error.context.suggestions || [],
    }
  }

  /**
   * Create a generic error for unknown error types
   */
  private createGenericError(
    error: unknown,
    source: ErrorSource,
    context?: Partial<ErrorContext>,
  ): ErrorNormalizationResult {
    // Get original stack trace if it's an Error
    const originalStack = error instanceof Error ? this.truncateStack(error.stack) : undefined

    const conversionError = ConversionError.fromError(
      error,
      `An unexpected ${source.replace(/_/g, " ").toLowerCase()} error occurred`,
      ErrorCode.CONVERSION_FAILED,
      ErrorCategory.CONVERSION_FAILED,
      {
        ...context,
        correlationId: this.config.correlationIdGenerator(),
        originalStack,
      },
    )

    return {
      error: conversionError,
      originalErrorType: source,
      classificationConfidence: 0.6,
      additionalContext: {
        metadata: {
          source,
          // Preserve any other metadata from context
          ...context?.metadata,
        },
      },
      recommendedActions: ["Try the operation again", "Check system status"],
    }
  }

  /**
   * Generate correlation ID for error tracking
   */
  private generateCorrelationId(): string {
    return `err_${Date.now()}_${++this.correlationIdCounter}`
  }

  /**
   * Truncate stack trace to prevent overly long logs
   */
  private truncateStack(stack?: string): string | undefined {
    if (!stack) {
      return undefined
    }

    const lines = stack.split("\n")
    if (lines.length <= this.config.maxStackLines) {
      return stack
    }

    return lines.slice(0, this.config.maxStackLines).join("\n")
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: ConversionError, originalType: string): void {
    const logData = {
      code: error.code,
      category: error.category,
      severity: error.severity,
      originalType,
      correlationId: error.context.correlationId,
      operation: error.context.operation,
      resource: error.context.resource,
    }

    // Log based on severity
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.config.logger("error", error.message, logData)
        break
      case ErrorSeverity.HIGH:
        this.config.logger("error", error.message, logData)
        break
      case ErrorSeverity.MEDIUM:
        this.config.logger("warn", error.message, logData)
        break
      case ErrorSeverity.LOW:
        this.config.logger("info", error.message, logData)
        break
    }

    // Debug logging with full details
    if (this.config.debug) {
      this.config.logger("debug", "Full error details", {
        error: error.toJSON(),
        originalType,
        stack: error.stack,
      })
    }
  }

  /**
   * Update error metrics
   */
  private updateMetrics(error: ConversionError): void {
    // Update category counts
    this.metrics.errorsByCategory[error.category]++

    // Update source counts (get from additionalContext or infer from error classification)
    const source = this.inferErrorSource(error)
    this.metrics.errorsBySource[source]++

    // Update frequent errors
    this.updateFrequentErrors(error)
  }

  /**
   * Infer error source from error characteristics
   */
  private inferErrorSource(error: ConversionError): ErrorSource {
    // Check if source is already tracked in context metadata
    if (error.context.metadata?.source) {
      return error.context.metadata.source as ErrorSource
    }

    // Infer from error category and code
    if (error.category === ErrorCategory.NETWORK_ERROR) {
      return ErrorSource.NODE_NETWORK
    }
    if (error.category === ErrorCategory.PERMISSION_ERROR || error.category === ErrorCategory.FILE_SYSTEM_ERROR) {
      return ErrorSource.FILE_SYSTEM
    }
    if (error.category === ErrorCategory.CDP_ERROR) {
      return ErrorSource.CDP_ERROR
    }
    if (error.category === ErrorCategory.RENDERING_ERROR && error.code === ErrorCode.JAVASCRIPT_ERROR) {
      return ErrorSource.JAVASCRIPT_RUNTIME
    }
    if (error.category === ErrorCategory.INVALID_INPUT) {
      return ErrorSource.USER_INPUT
    }

    return ErrorSource.APPLICATION
  }

  /**
   * Update frequent errors tracking
   */
  private updateFrequentErrors(error: ConversionError): void {
    const existing = this.metrics.frequentErrors.find(item => item.code === error.code)

    if (existing) {
      existing.count++
      existing.lastOccurred = new Date()
    } else {
      this.metrics.frequentErrors.push({
        code: error.code,
        count: 1,
        lastOccurred: new Date(),
      })
    }

    // Keep only top 10 most frequent errors
    this.metrics.frequentErrors.sort((a, b) => b.count - a.count)
    this.metrics.frequentErrors = this.metrics.frequentErrors.slice(0, 10)
  }

  /**
   * Get recommended actions for an error code
   */
  private getRecommendedActions(errorCode: ErrorCode): string[] {
    const errorMessage = getErrorMessage(errorCode)
    return errorMessage.recovery.suggestions || []
  }

  /**
   * Get current error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset error metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySource: {} as Record<ErrorSource, number>,
      frequentErrors: [],
      recoverySuccessRate: 0,
    }

    // Re-initialize counters
    Object.values(ErrorCategory).forEach((category) => {
      this.metrics.errorsByCategory[category] = 0
    })
    Object.values(ErrorSource).forEach((source) => {
      this.metrics.errorsBySource[source] = 0
    })
  }

  /**
   * Create a user-friendly error report
   */
  createUserFriendlyReport(error: ConversionError): string {
    let report = `Error: ${error.getUserMessage()}\n`
    report += `Code: ${error.code}\n`
    report += `Category: ${error.category}\n`
    report += `Time: ${error.timestamp.toISOString()}\n`

    if (error.context.correlationId) {
      report += `Reference ID: ${error.context.correlationId}\n`
    }

    if (error.context.operation) {
      report += `Operation: ${error.context.operation}\n`
    }

    if (error.context.resource) {
      report += `Resource: ${this.sanitizeResource(error.context.resource)}\n`
    }

    if (error.isRetryable()) {
      const retryInfo = error.getRetryInfo()
      if (retryInfo) {
        report += `This error can be retried.`
        if (retryInfo.maxRetries) {
          report += ` Maximum retries: ${retryInfo.maxRetries}`
        }
        report += "\n"
      }
    }

    return report
  }

  /**
   * Sanitize resource information for user display
   */
  private sanitizeResource(resource: string): string {
    if (!resource) {
      return ""
    }

    // Remove sensitive information like passwords, tokens, etc.
    let sanitized = resource

    // Sanitize basic auth credentials
    sanitized = sanitized.replace(/\/\/([^:]+):[^@]+@/g, "//$1:***@")

    // Sanitize URL parameters with sensitive names (but not 'key' as it's often used for non-sensitive purposes)
    sanitized = sanitized.replace(/([?&](password|token|secret|api_key|auth)=)[^&]*/gi, "$1***")

    return sanitized
  }

  /**
   * Handle error with automatic recovery attempt
   */
  async handleErrorWithRecovery(
    error: unknown,
    operation: () => Promise<any>,
    context?: Partial<ErrorContext>,
  ): Promise<{ result?: any, error: ConversionError, recovery?: RecoveryResult }> {
    // First normalize the error
    const normalizationResult = this.handleError(error, context)

    // If auto-recovery is disabled, return immediately
    if (!this.config.enableAutoRecovery) {
      return { error: normalizationResult.error }
    }

    // Check if error is retryable
    if (!normalizationResult.error.isRetryable()) {
      return { error: normalizationResult.error }
    }

    try {
      // Attempt recovery
      const recoveryResult = await this.recoveryManager.attemptRecovery(
        normalizationResult.error,
        operation,
        normalizationResult.error.context,
      )

      if (recoveryResult.success) {
        // Update metrics with successful recovery
        this.metrics.recoverySuccessRate = this.calculateRecoverySuccessRate(true)

        this.config.logger("info", "Error recovery successful", {
          correlationId: normalizationResult.error.context.correlationId,
          attempts: recoveryResult.attempts,
          duration: recoveryResult.totalDurationMs,
          degraded: recoveryResult.degraded,
        })

        return { error: normalizationResult.error, recovery: recoveryResult }
      } else {
        // Update metrics with failed recovery
        this.metrics.recoverySuccessRate = this.calculateRecoverySuccessRate(false)

        this.config.logger("warn", "Error recovery failed", {
          correlationId: normalizationResult.error.context.correlationId,
          attempts: recoveryResult.attempts,
          duration: recoveryResult.totalDurationMs,
        })

        return { error: normalizationResult.error, recovery: recoveryResult }
      }
    } catch (recoveryError) {
      // Recovery itself failed
      const recoveryFailureError = this.handleRecoveryFailure(recoveryError, normalizationResult.error)

      this.config.logger("error", "Error recovery mechanism failed", {
        originalError: normalizationResult.error,
        recoveryError,
        correlationId: normalizationResult.error.context.correlationId,
      })

      return { error: recoveryFailureError }
    }
  }

  /**
   * Handle recovery mechanism failures
   */
  private handleRecoveryFailure(recoveryError: unknown, originalError: ConversionError): ConversionError {
    const error = recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError))

    return createConversionError(
      `Recovery mechanism failed: ${error.message}`,
      ErrorCode.CONVERSION_FAILED,
      {
        ...originalError.context,
        operation: "error_recovery",
        metadata: {
          ...originalError.context.metadata,
          recoveryError: error.message,
        },
        suggestions: [
          "Try the operation again manually",
          "Check system resources and connectivity",
          "Contact support if the problem persists",
        ],
        retryInfo: { canRetry: false }, // Don't retry recovery failures
      },
      error,
    )
  }

  /**
   * Calculate recovery success rate
   */
  private calculateRecoverySuccessRate(success: boolean): number {
    // This is a simplified calculation - in a real implementation,
    // you'd track total recovery attempts and successes over time
    const currentRate = this.metrics.recoverySuccessRate
    const weight = 0.1 // Weight for new results

    return success
      ? currentRate + (1 - currentRate) * weight
      : currentRate * (1 - weight)
  }

  /**
   * Execute operation with error handling and recovery
   */
  async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context?: Partial<ErrorContext>,
  ): Promise<{ result?: T, error?: ConversionError, recovery?: RecoveryResult }> {
    try {
      const result = await operation()
      return { result }
    } catch (error) {
      if (this.config.enableAutoRecovery) {
        return await this.handleErrorWithRecovery(error, operation, context)
      } else {
        const errorResult = this.handleError(error, context)
        return { error: errorResult.error }
      }
    }
  }

  /**
   * Get circuit breaker state for monitoring
   */
  getCircuitBreakerState(): Record<string, any> {
    return this.recoveryManager.getCircuitBreakerState()
  }

  /**
   * Get rate limiter state for monitoring
   */
  getRateLimiterState(): Record<string, any> {
    return this.recoveryManager.getRateLimiterState()
  }

  /**
   * Reset all recovery mechanisms
   */
  resetRecoveryMechanisms(): void {
    this.recoveryManager.reset()
    this.config.logger("info", "Recovery mechanisms reset")
  }

  /**
   * Export errors to a structured format for external analysis
   */
  exportErrors(errors: ConversionError[]): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      metrics: this.metrics,
      circuitBreakerState: this.getCircuitBreakerState(),
      rateLimiterState: this.getRateLimiterState(),
      errors: errors.map(error => ({
        code: error.code,
        category: error.category,
        severity: error.severity,
        message: error.message,
        timestamp: error.timestamp.toISOString(),
        operation: error.context.operation,
        resource: this.sanitizeResource(error.context.resource || ""),
        correlationId: error.context.correlationId,
        retryable: error.isRetryable(),
        suggestions: error.context.suggestions || [],
        context: {
          duration: error.context.metadata?.duration,
          performance: error.context.metadata?.performance,
          stackAnalysis: error.context.metadata?.stackAnalysis,
          systemState: error.context.metadata?.systemState,
        },
      })),
    }

    return JSON.stringify(exportData, null, 2)
  }
}

/**
 * Default global error handler instance
 */
export const defaultErrorHandler = new ErrorHandler()

/**
 * Convenience function to handle errors with default configuration
 */
export function handleError(error: unknown, context?: Partial<ErrorContext>): ErrorNormalizationResult {
  return defaultErrorHandler.handleError(error, context)
}

/**
 * Create a custom error handler with specific configuration
 */
export function createErrorHandler(config: ErrorHandlerConfig): ErrorHandler {
  return new ErrorHandler(config)
}
