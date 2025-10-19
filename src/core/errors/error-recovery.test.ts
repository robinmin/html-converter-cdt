/**
 * Error Recovery Tests
 *
 * Tests for error recovery mechanisms, context management,
 * and enhanced error handling features.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createConversionError,
  ErrorCode,
} from "./conversion-error.js"
import {
  ContextManager,
  defaultContextManager,
  defaultRecoveryManager,
  RecoveryManager,
  RecoveryStrategy,
} from "./error-recovery.js"

describe("recoveryManager", () => {
  let recoveryManager: RecoveryManager

  beforeEach(() => {
    recoveryManager = new RecoveryManager({
      maxRetries: 3,
      initialDelayMs: 10, // Short delays for tests
      maxDelayMs: 100,
    })
  })

  afterEach(() => {
    recoveryManager.reset()
  })

  describe("attemptRecovery", () => {
    it("should successfully recover from retryable errors", async () => {
      const error = createConversionError(
        "Network error",
        ErrorCode.NETWORK_CONNECTION_FAILED,
        {
          retryInfo: { canRetry: true, maxRetries: 3 },
        },
      )

      let attempts = 0
      const operation = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts < 2) {
          throw error
        }
        return "success"
      })

      const result = await recoveryManager.attemptRecovery(error, operation, {
        operation: "test_operation",
      })

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(2)
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it("should not retry non-retryable errors", async () => {
      const error = createConversionError(
        "Invalid input",
        ErrorCode.MALFORMED_INPUT,
        {
          retryInfo: { canRetry: false },
        },
      )

      const operation = vi.fn().mockRejectedValue(error)

      const result = await recoveryManager.attemptRecovery(error, operation)

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(0)
      expect(operation).not.toHaveBeenCalled()
    })

    it("should handle graceful degradation", async () => {
      const error = createConversionError(
        "Rendering failed",
        ErrorCode.RENDERING_FAILED,
        {
          retryInfo: { canRetry: true, maxRetries: 1 },
        },
      )

      const operation = vi.fn().mockRejectedValue(error)

      const result = await recoveryManager.attemptRecovery(error, operation)

      expect(result.success).toBe(true)
      expect(result.degraded).toBe(true)
      expect(result.actions).toContain("Graceful degradation successful")
    })
  })

  describe("circuit Breaker", () => {
    it("should provide circuit breaker state", () => {
      const state = recoveryManager.getCircuitBreakerState()
      expect(typeof state).toBe("object")
    })
  })

  describe("rate Limiting", () => {
    it("should provide rate limiter state", () => {
      const state = recoveryManager.getRateLimiterState()
      expect(typeof state).toBe("object")
    })
  })

  describe("recovery Strategies", () => {
    it("should use exponential backoff for network errors", async () => {
      const error = createConversionError(
        "Network timeout",
        ErrorCode.NETWORK_TIMEOUT,
        {
          retryInfo: { canRetry: true, maxRetries: 3 },
        },
      )

      const strategy = recoveryManager.determineRecoveryStrategy(error)
      expect(strategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF)
    })

    it("should use linear backoff for timeout errors", async () => {
      const error = createConversionError(
        "Operation timeout",
        ErrorCode.OPERATION_TIMEOUT,
        {
          retryInfo: { canRetry: true, maxRetries: 3 },
        },
      )

      const strategy = recoveryManager.determineRecoveryStrategy(error)
      expect(strategy).toBe(RecoveryStrategy.LINEAR_BACKOFF)
    })

    it("should use circuit breaker for CDP errors", async () => {
      const error = createConversionError(
        "CDP connection failed",
        ErrorCode.CDP_CONNECTION_FAILED,
        {
          retryInfo: { canRetry: true, maxRetries: 3 },
        },
      )

      const strategy = recoveryManager.determineRecoveryStrategy(error)
      expect(strategy).toBe(RecoveryStrategy.CIRCUIT_BREAKER)
    })

    it("should use no recovery for non-retryable errors", async () => {
      const error = createConversionError(
        "Invalid input",
        ErrorCode.MALFORMED_INPUT,
        {
          retryInfo: { canRetry: false },
        },
      )

      const strategy = recoveryManager.determineRecoveryStrategy(error)
      expect(strategy).toBe(RecoveryStrategy.NONE)
    })
  })
})

describe("contextManager", () => {
  let contextManager: ContextManager

  beforeEach(() => {
    contextManager = new ContextManager({
      capturePerformance: true,
      trackDuration: true,
      captureSystemState: false,
      maxStackFrames: 5,
      sanitizeContext: true,
    })
  })

  describe("enhanceContext", () => {
    it("should enhance context with correlation ID", () => {
      const error = createConversionError("Test error", ErrorCode.CONVERSION_FAILED)
      const initialContext = { operation: "test" }

      const enhanced = contextManager.enhanceContext(error, initialContext)

      expect(enhanced.correlationId).toBeDefined()
      expect(enhanced.correlationId).toMatch(/^err_\d+_[a-z0-9]+$/)
      expect(enhanced.operation).toBe("test")
    })

    it("should preserve existing correlation ID", () => {
      const error = createConversionError("Test error", ErrorCode.CONVERSION_FAILED)
      const existingId = "existing_correlation_id"
      const initialContext = { correlationId: existingId }

      const enhanced = contextManager.enhanceContext(error, initialContext)

      expect(enhanced.correlationId).toBe(existingId)
    })

    it("should capture performance metrics", () => {
      const error = createConversionError("Test error", ErrorCode.CONVERSION_FAILED)

      const enhanced = contextManager.enhanceContext(error)

      expect(enhanced.metadata?.performance).toBeDefined()
    })

    it("should calculate duration when start time is provided", () => {
      const error = createConversionError("Test error", ErrorCode.CONVERSION_FAILED)
      const startTime = Date.now() - 1000 // 1 second ago

      const enhanced = contextManager.enhanceContext(error, {
        metadata: { startTime },
      })

      expect(enhanced.metadata?.duration).toBeGreaterThanOrEqual(1000)
    })

    it("should analyze stack trace", () => {
      const error = new Error("Test error")
      const conversionError = createConversionError(
        error.message,
        ErrorCode.JAVASCRIPT_ERROR,
        { originalStack: error.stack },
      )

      const enhanced = contextManager.enhanceContext(error, conversionError.context)

      expect(enhanced.metadata?.stackAnalysis).toBeDefined()
      expect(enhanced.metadata?.stackAnalysis.totalFrames).toBeGreaterThan(0)
    })

    it("should sanitize sensitive information", () => {
      const error = createConversionError("Test error", ErrorCode.CONVERSION_FAILED)
      const sensitiveContext = {
        resource: "https://user:password@example.com?token=secret123",
        metadata: {
          apiKey: "secret_key",
          password: "hidden_password",
          safeData: "public_info",
        },
      }

      const enhanced = contextManager.enhanceContext(error, sensitiveContext)

      expect(enhanced.resource).toContain("user:***@")
      expect(enhanced.resource).toContain("token=***")
      expect(enhanced.metadata?.apiKey).toBe("***")
      expect(enhanced.metadata?.password).toBe("***")
      expect(enhanced.metadata?.safeData).toBe("public_info")
    })
  })

  describe("stack Trace Analysis", () => {
    it("should identify async patterns", () => {
      const stack = `Error: Test error
    at asyncFunction (async.js:10:5)
    at async wrapper (async.js:20:10)
    at main (index.js:5:15)`

      const analysis = contextManager.analyzeStackTrace(stack)

      expect(analysis.patterns.async).toBe(true)
      expect(analysis.functions).toContain("asyncFunction")
      expect(analysis.files).toContain("async.js")
    })

    it("should identify promise patterns", () => {
      const stack = `Error: Promise rejected
    at Promise.then.catch (promise.js:15:30)
    at processTicksAndRejections (internal/process/task_queues.js:93:5)`

      const analysis = contextManager.analyzeStackTrace(stack)

      expect(analysis.patterns.promise).toBe(true)
    })

    it("should limit stack frames", () => {
      // Create a stack with many frames
      const frames = Array.from({ length: 20 }, (_, i) =>
        `  at frame${i} (file${i}.js:${i}:10)`).join("\n")
      const stack = `Error: Test error\n${frames}`

      const analysis = contextManager.analyzeStackTrace(stack)

      expect(analysis.totalFrames).toBeLessThanOrEqual(5)
    })
  })

  describe("resource Sanitization", () => {
    it("should sanitize basic auth credentials", () => {
      const resource = "https://username:secret123@example.com/path"
      const sanitized = contextManager.sanitizeResource(resource)

      expect(sanitized).toBe("https://username:***@example.com/path")
    })

    it("should sanitize URL parameters", () => {
      const resource = "https://example.com/api?password=secret&token=abc123&safe=data"
      const sanitized = contextManager.sanitizeResource(resource)

      expect(sanitized).toContain("password=***")
      expect(sanitized).toContain("token=***")
      expect(sanitized).toContain("safe=data")
    })

    it("should sanitize authorization headers", () => {
      const resource = "https://example.com/api?authorization=bearer.token.123"
      const sanitized = contextManager.sanitizeResource(resource)

      expect(sanitized).toContain("authorization=***")
    })
  })
})

describe("default Instances", () => {
  it("should provide working default recovery manager", async () => {
    const error = createConversionError(
      "Test error",
      ErrorCode.NETWORK_CONNECTION_FAILED,
      {
        retryInfo: { canRetry: true, maxRetries: 1 },
      },
    )

    let attempts = 0
    const operation = vi.fn().mockImplementation(() => {
      attempts++
      if (attempts === 1) {
        throw error
      }
      return "success"
    })

    const result = await defaultRecoveryManager.attemptRecovery(error, operation)

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(2)
  })

  it("should provide working default context manager", () => {
    const error = createConversionError("Test error", ErrorCode.CONVERSION_FAILED)
    const context = { operation: "test" }

    const enhanced = defaultContextManager.enhanceContext(error, context)

    expect(enhanced.correlationId).toBeDefined()
    expect(enhanced.operation).toBe("test")
  })
})
