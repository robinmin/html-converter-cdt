/**
 * Error Handler Tests
 *
 * Comprehensive test suite for the ErrorHandler class covering error normalization,
 * classification, logging, and recovery strategy generation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ConversionError,
  createConversionError,
  ErrorCategory,
  ErrorCode,
  ErrorSeverity,
} from "./conversion-error.js"
import {
  createErrorHandler,
  defaultErrorHandler,
  ErrorHandler,

  ErrorSource,
  handleError,
} from "./error-handler.js"
import type { ErrorHandlerConfig } from "./error-handler.js"

describe("errorHandler", () => {
  let errorHandler: ErrorHandler
  let mockLogger: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockLogger = vi.fn()
    errorHandler = new ErrorHandler({
      debug: true,
      logger: mockLogger,
      correlationIdGenerator: () => "test-correlation-id",
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("constructor", () => {
    it("should create handler with default configuration", () => {
      const handler = new ErrorHandler()
      expect(handler).toBeInstanceOf(ErrorHandler)
    })

    it("should create handler with custom configuration", () => {
      const customHandler = new ErrorHandler({
        debug: false,
        maxStackLines: 10,
        sanitizeMessages: true,
      })
      expect(customHandler).toBeInstanceOf(ErrorHandler)
    })

    it("should initialize metrics with zero values", () => {
      const metrics = errorHandler.getMetrics()
      expect(metrics.totalErrors).toBe(0)
      expect(Object.values(metrics.errorsByCategory).every(count => count === 0)).toBe(true)
      expect(Object.values(metrics.errorsBySource).every(count => count === 0)).toBe(true)
      expect(metrics.frequentErrors).toHaveLength(0)
    })
  })

  describe("handleError", () => {
    it("should handle existing ConversionError", () => {
      const conversionError = createConversionError(
        "Test error",
        ErrorCode.CONVERSION_FAILED,
        { operation: "test" },
      )

      const result = errorHandler.handleError(conversionError)

      expect(result.error.message).toBe(conversionError.message)
      expect(result.error.code).toBe(conversionError.code)
      expect(result.error.category).toBe(conversionError.category)
      expect(result.originalErrorType).toBe("ConversionError")
      expect(result.classificationConfidence).toBe(1.0)
      expect(result.additionalContext.metadata?.enhanced).toBe(true)
    })

    it("should enhance ConversionError with additional context", () => {
      const conversionError = createConversionError(
        "Test error",
        ErrorCode.CONVERSION_FAILED,
      )

      const result = errorHandler.handleError(conversionError, {
        operation: "enhanced_operation",
        resource: "test-resource",
      })

      expect(result.error.context.operation).toBe("enhanced_operation")
      expect(result.error.context.resource).toBe("test-resource")
      expect(result.error.context.correlationId).toBe("test-correlation-id")
    })

    it("should update metrics when handling errors", () => {
      const error = new Error("Test error")
      errorHandler.handleError(error)

      const metrics = errorHandler.getMetrics()
      expect(metrics.totalErrors).toBe(1)
    })

    it("should call custom handler if provided", () => {
      const customHandler = vi.fn()
      const handlerWithCustom = new ErrorHandler({
        customHandler,
      })

      const error = new Error("Test error")
      handlerWithCustom.handleError(error)

      expect(customHandler).toHaveBeenCalledWith(expect.any(ConversionError))
    })

    it("should handle custom handler failures gracefully", () => {
      const customHandler = vi.fn(() => {
        throw new Error("Custom handler failed")
      })

      const handlerWithFailingCustom = new ErrorHandler({
        logger: mockLogger,
        customHandler,
      })

      const error = new Error("Test error")
      const result = handlerWithFailingCustom.handleError(error)

      expect(result.error).toBeInstanceOf(ConversionError)
      expect(mockLogger).toHaveBeenCalledWith(
        "error",
        "Custom error handler failed",
        expect.objectContaining({
          originalError: expect.any(ConversionError),
          handlerError: expect.any(Error),
        }),
      )
    })
  })

  describe("error classification", () => {
    it("should classify JavaScript runtime errors", () => {
      const typeError = new TypeError("Cannot read property 'foo' of undefined")
      const result = errorHandler.handleError(typeError)

      expect(result.originalErrorType).toBe("JavaScriptError")
      expect(result.error.code).toBe(ErrorCode.JAVASCRIPT_ERROR)
      expect(result.error.category).toBe(ErrorCategory.RENDERING_ERROR)
    })

    it("should classify network errors", () => {
      const networkError = new Error("ECONNREFUSED: Connection refused")
      networkError.name = "Error"
      const result = errorHandler.handleError(networkError)

      expect(result.originalErrorType).toBe("NodeNetworkError")
      expect(result.error.code).toBe(ErrorCode.NETWORK_CONNECTION_FAILED)
      expect(result.error.category).toBe(ErrorCategory.NETWORK_ERROR)
    })

    it("should classify DNS errors", () => {
      const dnsError = new Error("ENOTFOUND: DNS lookup failed")
      const result = errorHandler.handleError(dnsError)

      expect(result.error.code).toBe(ErrorCode.NETWORK_DNS_ERROR)
    })

    it("should classify file system errors", () => {
      const fsError = new Error("ENOENT: no such file or directory")
      const result = errorHandler.handleError(fsError)

      expect(result.originalErrorType).toBe("FileSystemError")
      expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND)
      expect(result.error.category).toBe(ErrorCategory.FILE_SYSTEM_ERROR)
    })

    it("should classify permission errors", () => {
      const permissionError = new Error("EACCES: permission denied")
      const result = errorHandler.handleError(permissionError)

      expect(result.error.code).toBe(ErrorCode.FILE_ACCESS_DENIED)
      expect(result.error.category).toBe(ErrorCategory.PERMISSION_ERROR)
    })

    it("should classify CDP errors", () => {
      const cdpError = new Error("WebSocket connection to Chrome DevTools failed")
      cdpError.stack = "Error: WebSocket connection failed\n    at ChromeDevToolsProtocol.connect"
      const result = errorHandler.handleError(cdpError)

      expect(result.originalErrorType).toBe("CdpError")
      expect(result.error.code).toBe(ErrorCode.CDP_CONNECTION_FAILED)
      expect(result.error.category).toBe(ErrorCategory.CDP_ERROR)
    })

    it("should classify memory errors", () => {
      const memoryError = new Error("Out of memory: JavaScript heap out of memory")
      const result = errorHandler.handleError(memoryError)

      expect(result.error.code).toBe(ErrorCode.OUT_OF_MEMORY)
      expect(result.error.category).toBe(ErrorCategory.MEMORY_ERROR)
      expect(result.error.severity).toBe(ErrorSeverity.CRITICAL)
    })

    it("should handle unknown errors", () => {
      const unknownError = "Just a string error"
      const result = errorHandler.handleError(unknownError)

      expect(result.originalErrorType).toBe("UnknownError")
      expect(result.error.code).toBe(ErrorCode.CONVERSION_FAILED)
      expect(result.classificationConfidence).toBe(0.5)
    })
  })

  describe("error normalization", () => {
    it("should preserve original error in ConversionError", () => {
      const originalError = new Error("Original error message")
      const result = errorHandler.handleError(originalError)

      expect(result.error.originalError).toBe(originalError)
    })

    it("should truncate long stack traces", () => {
      const longStack = Array.from({ length: 50 }).fill("    at test (test.js:1:1)").join("\n")
      const error = new Error("Test error")
      error.stack = `Error: Test error\n${longStack}`

      const handler = new ErrorHandler({ maxStackLines: 10 })
      const result = handler.handleError(error)

      const stackLines = result.error.context.originalStack?.split("\n") || []
      expect(stackLines.length).toBeLessThanOrEqual(10)
    })

    it("should add correlation ID to errors", () => {
      const error = new Error("Test error")
      const result = errorHandler.handleError(error)

      expect(result.error.context.correlationId).toBe("test-correlation-id")
    })

    it("should provide retry information for retryable errors", () => {
      const networkError = new Error("ECONNREFUSED: Connection refused")
      const result = errorHandler.handleError(networkError)

      expect(result.error.isRetryable()).toBe(true)
      expect(result.error.getRetryInfo()?.canRetry).toBe(true)
    })

    it("should not provide retry information for non-retryable errors", () => {
      const inputError = new TypeError("Invalid input type")
      const result = errorHandler.handleError(inputError)

      expect(result.error.isRetryable()).toBe(false)
      expect(result.error.getRetryInfo()?.canRetry).toBe(false)
    })
  })

  describe("logging", () => {
    it("should log critical errors at error level", () => {
      const criticalError = createConversionError(
        "Critical error",
        ErrorCode.OUT_OF_MEMORY,
        {},
        new Error("Original"),
      )

      errorHandler.handleError(criticalError)

      expect(mockLogger).toHaveBeenCalledWith(
        "error",
        criticalError.message,
        expect.objectContaining({
          code: ErrorCode.OUT_OF_MEMORY,
          severity: ErrorSeverity.CRITICAL,
        }),
      )
    })

    it("should log high severity errors at error level", () => {
      const highError = createConversionError(
        "High severity error",
        ErrorCode.NETWORK_CONNECTION_FAILED,
      )

      errorHandler.handleError(highError)

      expect(mockLogger).toHaveBeenCalledWith(
        "error",
        highError.message,
        expect.objectContaining({
          severity: ErrorSeverity.HIGH,
        }),
      )
    })

    it("should log medium severity errors at warn level", () => {
      const mediumError = createConversionError(
        "Medium severity error",
        ErrorCode.MALFORMED_INPUT,
      )

      errorHandler.handleError(mediumError)

      expect(mockLogger).toHaveBeenCalledWith(
        "warn",
        mediumError.message,
        expect.objectContaining({
          severity: ErrorSeverity.MEDIUM,
        }),
      )
    })

    it("should log low severity errors at info level", () => {
      const lowError = createConversionError(
        "Low severity error",
        ErrorCode.CONFIG_INVALID,
      )

      errorHandler.handleError(lowError)

      expect(mockLogger).toHaveBeenCalledWith(
        "info",
        lowError.message,
        expect.objectContaining({
          severity: ErrorSeverity.LOW,
        }),
      )
    })

    it("should log debug information when debug mode is enabled", () => {
      const error = new Error("Test error")
      errorHandler.handleError(error)

      expect(mockLogger).toHaveBeenCalledWith(
        "debug",
        "Full error details",
        expect.objectContaining({
          error: expect.any(Object),
          originalType: expect.any(String),
          stack: expect.any(String),
        }),
      )
    })

    it("should not log debug information when debug mode is disabled", () => {
      const handler = new ErrorHandler({ debug: false, logger: mockLogger })
      const error = new Error("Test error")
      handler.handleError(error)

      expect(mockLogger).not.toHaveBeenCalledWith(
        "debug",
        "Full error details",
        expect.any(Object),
      )
    })
  })

  describe("metrics", () => {
    it("should track errors by category", () => {
      const networkError = new Error("ECONNREFUSED: Connection refused")
      const inputError = new TypeError("Invalid input")

      errorHandler.handleError(networkError)
      errorHandler.handleError(inputError)

      const metrics = errorHandler.getMetrics()
      expect(metrics.errorsByCategory[ErrorCategory.NETWORK_ERROR]).toBe(1)
      expect(metrics.errorsByCategory[ErrorCategory.INVALID_INPUT]).toBe(1)
      expect(metrics.totalErrors).toBe(2)
    })

    it("should track errors by source", () => {
      const networkError = new Error("ECONNREFUSED: Connection refused")
      const jsError = new TypeError("Cannot read property")

      errorHandler.handleError(networkError)
      errorHandler.handleError(jsError)

      const metrics = errorHandler.getMetrics()
      expect(metrics.errorsBySource[ErrorSource.NODE_NETWORK]).toBe(1)
      expect(metrics.errorsBySource[ErrorSource.JAVASCRIPT_RUNTIME]).toBe(1)
    })

    it("should track frequent errors", () => {
      const networkError = new Error("ECONNREFUSED: Connection refused")

      errorHandler.handleError(networkError)
      errorHandler.handleError(networkError)
      errorHandler.handleError(networkError)

      const metrics = errorHandler.getMetrics()
      expect(metrics.frequentErrors).toHaveLength(1)
      expect(metrics.frequentErrors[0].code).toBe(ErrorCode.NETWORK_CONNECTION_FAILED)
      expect(metrics.frequentErrors[0].count).toBe(3)
    })

    it("should limit frequent errors to top 10", () => {
      // Create 15 different errors
      for (let i = 0; i < 15; i++) {
        const error = new Error(`Different error ${i}`)
        errorHandler.handleError(error)
      }

      const metrics = errorHandler.getMetrics()
      expect(metrics.frequentErrors.length).toBeLessThanOrEqual(10)
    })

    it("should reset metrics", () => {
      errorHandler.handleError(new Error("Test error"))

      errorHandler.resetMetrics()
      const metrics = errorHandler.getMetrics()

      expect(metrics.totalErrors).toBe(0)
      expect(Object.values(metrics.errorsByCategory).every(count => count === 0)).toBe(true)
      expect(metrics.frequentErrors).toHaveLength(0)
    })
  })

  describe("user-friendly reporting", () => {
    it("should create user-friendly error report", () => {
      const error = createConversionError(
        "Test error message",
        ErrorCode.NETWORK_CONNECTION_FAILED,
        {
          operation: "test_operation",
          resource: "https://example.com/resource?password=secret123",
          correlationId: "test-123",
          retryInfo: { canRetry: true, maxRetries: 3 },
        },
      )

      const report = errorHandler.createUserFriendlyReport(error)

      expect(report).toContain("Error: Test error message")
      expect(report).toContain("Code: NETWORK_CONNECTION_FAILED")
      expect(report).toContain("Category: NETWORK_ERROR")
      expect(report).toContain("Operation: test_operation")
      expect(report).toContain("Resource: https://example.com/resource?password=***")
      expect(report).toContain("Reference ID: test-123")
      expect(report).toContain("This error can be retried")
    })

    it("should sanitize sensitive information in resource URLs", () => {
      const error = createConversionError(
        "Test error",
        ErrorCode.INVALID_URL,
        {
          resource: "https://user:password@example.com/path?token=secret123&key=value",
        },
      )

      const report = errorHandler.createUserFriendlyReport(error)

      expect(report).toContain("Resource: https://user:***@example.com/path?token=***&key=value")
    })
  })

  describe("error export", () => {
    it("should export errors to structured format", () => {
      const error1 = createConversionError("Error 1", ErrorCode.NETWORK_CONNECTION_FAILED)
      const error2 = createConversionError("Error 2", ErrorCode.MALFORMED_INPUT)

      const exported = errorHandler.exportErrors([error1, error2])
      const parsed = JSON.parse(exported)

      expect(parsed.version).toBe("1.0")
      expect(parsed.timestamp).toBeDefined()
      expect(parsed.errors).toHaveLength(2)
      expect(parsed.errors[0].code).toBe(ErrorCode.NETWORK_CONNECTION_FAILED)
      expect(parsed.errors[1].code).toBe(ErrorCode.MALFORMED_INPUT)
      expect(parsed.errors[0].message).toBe("Error 1")
      expect(parsed.errors[1].message).toBe("Error 2")
    })

    it("should include metrics in export", () => {
      const error = createConversionError("Test error", ErrorCode.NETWORK_CONNECTION_FAILED)
      errorHandler.handleError(error)

      const exported = errorHandler.exportErrors([error])
      const parsed = JSON.parse(exported)

      expect(parsed.metrics).toBeDefined()
      expect(parsed.metrics.totalErrors).toBe(1)
    })
  })

  describe("recovery strategies", () => {
    it("should provide recovery suggestions for retryable errors", () => {
      const networkError = new Error("ECONNREFUSED: Connection refused")
      const result = errorHandler.handleError(networkError)

      expect(result.recommendedActions).toContain("Check your internet connection")
      expect(result.recommendedActions).toContain("Verify the URL is correct and accessible")
    })

    it("should provide recovery suggestions for non-retryable errors", () => {
      const inputError = new TypeError("Invalid input type")
      const result = errorHandler.handleError(inputError)

      expect(result.recommendedActions.length).toBeGreaterThan(0)
      expect(result.recommendedActions[0]).toContain("input format")
    })
  })

  describe("enhanced error handling with recovery", () => {
    let recoveryEnabledHandler: ErrorHandler

    beforeEach(() => {
      recoveryEnabledHandler = new ErrorHandler({
        enableAutoRecovery: true,
        recoveryConfig: {
          maxRetries: 2,
          initialDelayMs: 10,
          maxDelayMs: 100,
        },
        logger: mockLogger,
        correlationIdGenerator: () => "recovery-test-id",
      })
    })

    it("should handle error with successful recovery", async () => {
      const error = createConversionError(
        "Network error",
        ErrorCode.NETWORK_CONNECTION_FAILED,
        {
          retryInfo: { canRetry: true, maxRetries: 2 },
        },
      )

      // Ensure the error is retryable
      expect(error.isRetryable()).toBe(true)

      let attempts = 0
      const operation = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts === 1) {
          throw error
        }
        return "recovered_success"
      })

      const result = await recoveryEnabledHandler.handleErrorWithRecovery(error, operation, {
        operation: "test_with_recovery",
      })

      expect(result.error).toBeDefined()
      expect(result.recovery?.success).toBe(true)
      expect(result.recovery?.attempts).toBe(2)
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it("should fail recovery for non-retryable errors", async () => {
      const error = createConversionError(
        "Invalid input",
        ErrorCode.MALFORMED_INPUT,
        {
          retryInfo: { canRetry: false },
        },
      )

      const operation = vi.fn().mockRejectedValue(error)

      const result = await recoveryEnabledHandler.handleErrorWithRecovery(error, operation)

      expect(result.error).toBeDefined()
      expect(result.recovery).toBeUndefined()
      expect(operation).not.toHaveBeenCalled()
    })

    it("should execute operations with error handling", async () => {
      const operation = vi.fn().mockResolvedValue("success")

      const result = await recoveryEnabledHandler.executeWithErrorHandling(operation, {
        operation: "successful_operation",
      })

      expect(result.result).toBe("success")
      expect(result.error).toBeUndefined()
    })

    it("should handle failed operations without recovery", async () => {
      recoveryEnabledHandler = new ErrorHandler({
        enableAutoRecovery: false,
        logger: mockLogger,
      })

      const error = new Error("Operation failed")
      const operation = vi.fn().mockRejectedValue(error)

      const result = await recoveryEnabledHandler.executeWithErrorHandling(operation)

      expect(result.result).toBeUndefined()
      expect(result.error).toBeInstanceOf(ConversionError)
      expect(result.recovery).toBeUndefined()
    })

    it("should enhance context with performance metrics", () => {
      const error = new Error("Test error")
      const result = errorHandler.handleError(error, { operation: "performance_test" })

      expect(result.error.context.metadata?.performance).toBeDefined()
      expect(result.error.context.correlationId).toBe("test-correlation-id")
    })

    it("should track operation duration", () => {
      const startTime = Date.now() - 500 // 500ms ago
      const error = new Error("Test error")

      const result = errorHandler.handleError(error, {
        operation: "duration_test",
        metadata: { startTime },
      })

      expect(result.error.context.metadata?.duration).toBeGreaterThanOrEqual(500)
    })

    it("should provide circuit breaker state", () => {
      const state = recoveryEnabledHandler.getCircuitBreakerState()
      expect(typeof state).toBe("object")
    })

    it("should provide rate limiter state", () => {
      const state = recoveryEnabledHandler.getRateLimiterState()
      expect(typeof state).toBe("object")
    })

    it("should reset recovery mechanisms", () => {
      expect(() => recoveryEnabledHandler.resetRecoveryMechanisms()).not.toThrow()
      expect(mockLogger).toHaveBeenCalledWith("info", "Recovery mechanisms reset")
    })

    it("should include enhanced context in error export", () => {
      const startTime = Date.now() - 1000 // 1 second ago
      const error = createConversionError(
        "Test error",
        ErrorCode.CONVERSION_FAILED,
        {
          operation: "export_test",
          metadata: {
            startTime,
            custom: "test_value",
          },
        },
      )

      errorHandler.handleError(error, { metadata: { startTime } }) // Process the error with startTime
      const exported = errorHandler.exportErrors([error])
      const parsed = JSON.parse(exported)

      expect(parsed.circuitBreakerState).toBeDefined()
      expect(parsed.rateLimiterState).toBeDefined()
      expect(parsed.errors[0].context.duration).toBeGreaterThanOrEqual(1000)
      expect(parsed.errors[0].context.performance).toBeDefined()
      expect(parsed.errors[0].context.stackAnalysis).toBeDefined()
      // Note: custom field is not exported, only specific context fields are
    })
  })
})

describe("defaultErrorHandler", () => {
  it("should provide a default handler instance", () => {
    expect(defaultErrorHandler).toBeInstanceOf(ErrorHandler)
  })

  it("should handle errors with default configuration", () => {
    const error = new Error("Test error")
    const result = defaultErrorHandler.handleError(error)

    expect(result.error).toBeInstanceOf(ConversionError)
    expect(result.originalErrorType).toBe("UnknownError")
  })
})

describe("handleError convenience function", () => {
  it("should handle errors using default handler", () => {
    const error = new Error("Test error")
    const result = handleError(error)

    expect(result.error).toBeInstanceOf(ConversionError)
  })
})

describe("createErrorHandler", () => {
  it("should create handler with custom configuration", () => {
    const config: ErrorHandlerConfig = {
      debug: false,
      maxStackLines: 5,
      sanitizeMessages: true,
    }

    const handler = createErrorHandler(config)
    expect(handler).toBeInstanceOf(ErrorHandler)
  })
})

describe("integration with ConversionError", () => {
  let integrationHandler: ErrorHandler

  beforeEach(() => {
    integrationHandler = new ErrorHandler()
  })

  it("should work seamlessly with ConversionError.fromError", () => {
    const originalError = new Error("Original error")
    const conversionError = ConversionError.fromError(originalError)

    const result = integrationHandler.handleError(conversionError)

    expect(result.error.message).toBe(conversionError.message)
    expect(result.error.code).toBe(conversionError.code)
    expect(result.originalErrorType).toBe("ConversionError")
  })

  it("should preserve error context through multiple transformations", () => {
    const originalError = new Error("Original error")
    const context = {
      operation: "test_operation",
      resource: "test_resource",
      metadata: { custom: "value" },
    }

    const conversionError = ConversionError.fromError(
      originalError,
      "Message",
      ErrorCode.CONVERSION_FAILED,
      ErrorCategory.CONVERSION_FAILED,
      context,
    )

    const result = integrationHandler.handleError(conversionError, {
      metadata: { additionalContext: "additional_value" },
    })

    expect(result.error.context.operation).toBe("test_operation")
    expect(result.error.context.resource).toBe("test_resource")
    expect(result.error.context.metadata?.additionalContext).toBe("additional_value")
    // Should have enhanced context added
    expect(result.error.context.metadata?.performance).toBeDefined()
    expect(result.error.context.correlationId).toBeDefined()
  })
})
