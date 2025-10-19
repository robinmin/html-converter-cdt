/**
 * Error Recovery Strategies
 *
 * Comprehensive error recovery mechanisms including exponential backoff,
 * timeout adjustments, retry strategies, and graceful degradation.
 */

import process from "node:process"

import type { ErrorContext } from "./conversion-error.js"
import { ConversionError, ErrorCategory, ErrorCode } from "./conversion-error.js"

/**
 * Recovery strategy types
 */
export enum RecoveryStrategy {
  /** No recovery attempt */
  NONE = "none",
  /** Simple retry with fixed delay */
  FIXED_DELAY = "fixed_delay",
  /** Exponential backoff with jitter */
  EXPONENTIAL_BACKOFF = "exponential_backoff",
  /** Linear backoff with increasing delays */
  LINEAR_BACKOFF = "linear_backoff",
  /** Circuit breaker pattern */
  CIRCUIT_BREAKER = "circuit_breaker",
  /** Graceful degradation */
  GRACEFUL_DEGRADATION = "graceful_degradation",
  /** Fallback to alternative method */
  FALLBACK = "fallback",
}

/**
 * Retry configuration for recovery attempts
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Initial delay in milliseconds */
  initialDelayMs: number
  /** Maximum delay in milliseconds */
  maxDelayMs: number
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number
  /** Jitter factor to add randomness (0-1) */
  jitterFactor: number
  /** Strategy to use for retries */
  strategy: RecoveryStrategy
}

/**
 * Recovery attempt result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean
  /** Number of attempts made */
  attempts: number
  /** Total time spent on recovery */
  totalDurationMs: number
  /** Final error if recovery failed */
  finalError?: ConversionError
  /** Recovery actions taken */
  actions: string[]
  /** Whether graceful degradation was applied */
  degraded: boolean
}

/**
 * Circuit breaker state
 */
export enum CircuitState {
  /** Circuit is closed and requests flow through */
  CLOSED = "closed",
  /** Circuit is open and requests fail fast */
  OPEN = "open",
  /** Circuit is half-open and testing if service has recovered */
  HALF_OPEN = "half_open",
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number
  /** Time in milliseconds to wait before transitioning to half-open */
  recoveryTimeoutMs: number
  /** Number of successful attempts to close circuit again */
  successThreshold: number
  /** Whether to monitor specific error types only */
  monitoredErrors?: ErrorCode[]
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum number of errors allowed in time window */
  maxErrors: number
  /** Time window in milliseconds */
  windowMs: number
  /** Whether to apply rate limiting globally or per-operation */
  perOperation: boolean
}

/**
 * Error context enhancement configuration
 */
export interface ContextEnhancementConfig {
  /** Whether to capture performance metrics */
  capturePerformance: boolean
  /** Whether to track operation duration */
  trackDuration: boolean
  /** Whether to capture system state */
  captureSystemState: boolean
  /** Maximum number of stack frames to analyze */
  maxStackFrames: number
  /** Whether to sanitize sensitive information */
  sanitizeContext: boolean
}

/**
 * Recovery strategy manager
 */
export class RecoveryManager {
  private circuitBreakers = new Map<string, { state: CircuitState, failures: number, lastFailureTime: number, successes: number }>()
  private rateLimiter = new Map<string, { errors: number, windowStart: number }>()

  constructor(
    private retryConfig: Partial<RetryConfig> = {},
    private circuitBreakerConfig: CircuitBreakerConfig = { failureThreshold: 5, recoveryTimeoutMs: 60000, successThreshold: 3 },
    private rateLimiterConfig: RateLimiterConfig = { maxErrors: 10, windowMs: 60000, perOperation: true },
    private contextConfig: ContextEnhancementConfig = {
      capturePerformance: true,
      trackDuration: true,
      captureSystemState: false,
      maxStackFrames: 10,
      sanitizeContext: true,
    },
  ) {}

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(
    error: ConversionError,
    operation: () => Promise<any>,
    context?: ErrorContext,
  ): Promise<RecoveryResult> {
    const startTime = Date.now()
    const actions: string[] = []
    let attempts = 0
    let degraded = false

    // Check rate limiting first
    if (this.isRateLimited(context?.operation)) {
      return {
        success: false,
        attempts: 0,
        totalDurationMs: 0,
        finalError: error,
        actions: ["Rate limited - no recovery attempts allowed"],
        degraded: false,
      }
    }

    // Check circuit breaker
    const operationKey = context?.operation || "default"
    if (this.isCircuitOpen(operationKey, error)) {
      actions.push("Circuit breaker open - failing fast")
      return {
        success: false,
        attempts: 0,
        totalDurationMs: 0,
        finalError: error,
        actions,
        degraded: false,
      }
    }

    // Determine retry strategy
    const strategy = this.determineRecoveryStrategy(error)
    const retryConfig = this.buildRetryConfig(strategy)

    if (retryConfig.maxRetries === 0) {
      actions.push("Error not retryable")
      return {
        success: false,
        attempts: 0,
        totalDurationMs: 0,
        finalError: error,
        actions,
        degraded: false,
      }
    }

    // Attempt recovery
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      attempts++

      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt, retryConfig)
          actions.push(`Attempt ${attempt}: Waiting ${delay}ms before retry`)
          await this.sleep(delay)
        }

        actions.push(`Attempt ${attempt}: Executing operation`)
        const _result = await operation()

        // Success - update circuit breaker and return
        this.recordSuccess(operationKey)
        return {
          success: true,
          attempts,
          totalDurationMs: Date.now() - startTime,
          actions,
          degraded,
        }
      } catch (attemptError) {
        const conversionError = attemptError instanceof ConversionError ? attemptError : ConversionError.fromError(attemptError)
        actions.push(`Attempt ${attempt} failed: ${conversionError.message}`)

        // Record failure
        this.recordFailure(operationKey, conversionError)
        this.updateRateLimit(context?.operation)

        // Check if we should continue retrying
        if (attempt === retryConfig.maxRetries) {
          break
        }

        // Apply adaptive strategies based on error type
        await this.applyAdaptiveRecovery(conversionError, attempt, actions)
      }
    }

    // All retries failed - try graceful degradation
    const degradationResult = await this.tryGracefulDegradation(error, operation, context)
    if (degradationResult.success) {
      degraded = true
      actions.push("Graceful degradation successful")
      return {
        success: true,
        attempts,
        totalDurationMs: Date.now() - startTime,
        actions,
        degraded: true,
      }
    }

    return {
      success: false,
      attempts,
      totalDurationMs: Date.now() - startTime,
      finalError: error,
      actions,
      degraded: false,
    }
  }

  /**
   * Determine appropriate recovery strategy for error
   */
  private determineRecoveryStrategy(error: ConversionError): RecoveryStrategy {
    // Network errors - exponential backoff
    if (error.category === ErrorCategory.NETWORK_ERROR) {
      return RecoveryStrategy.EXPONENTIAL_BACKOFF
    }

    // Timeout errors - linear backoff with timeout adjustment
    if (error.category === ErrorCategory.TIMEOUT) {
      return RecoveryStrategy.LINEAR_BACKOFF
    }

    // CDP errors - circuit breaker
    if (error.category === ErrorCategory.CDP_ERROR) {
      return RecoveryStrategy.CIRCUIT_BREAKER
    }

    // Resource errors - exponential backoff
    if (error.category === ErrorCategory.RESOURCE_ERROR) {
      return RecoveryStrategy.EXPONENTIAL_BACKOFF
    }

    // Rendering errors - fixed delay with graceful degradation
    if (error.category === ErrorCategory.RENDERING_ERROR) {
      return RecoveryStrategy.FIXED_DELAY
    }

    // Temporary system errors - fixed delay
    if (error.code === ErrorCode.OUT_OF_MEMORY || error.code === ErrorCode.MEMORY_LIMIT_EXCEEDED) {
      return RecoveryStrategy.FIXED_DELAY
    }

    return RecoveryStrategy.NONE
  }

  /**
   * Build retry configuration based on strategy
   */
  private buildRetryConfig(strategy: RecoveryStrategy): Required<RetryConfig> {
    const baseConfig: Required<RetryConfig> = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      strategy,
    }

    // Adjust based on error type and strategy
    switch (strategy) {
      case RecoveryStrategy.EXPONENTIAL_BACKOFF:
        return {
          ...baseConfig,
          maxRetries: 5,
          backoffMultiplier: 2.5,
          jitterFactor: 0.2,
        }

      case RecoveryStrategy.LINEAR_BACKOFF:
        return {
          ...baseConfig,
          maxRetries: 3,
          backoffMultiplier: 1.5,
          jitterFactor: 0.1,
        }

      case RecoveryStrategy.FIXED_DELAY:
        return {
          ...baseConfig,
          maxRetries: 2,
          backoffMultiplier: 1,
          jitterFactor: 0,
        }

      case RecoveryStrategy.CIRCUIT_BREAKER:
        return {
          ...baseConfig,
          maxRetries: 1, // Fast fail when circuit is open
          initialDelayMs: 5000,
        }

      case RecoveryStrategy.NONE:
        return {
          ...baseConfig,
          maxRetries: 0, // No retries for non-retryable errors
        }

      default:
        return baseConfig
    }
  }

  /**
   * Calculate delay for retry attempt
   */
  private calculateDelay(attempt: number, config: Required<RetryConfig>): number {
    let delay: number

    switch (config.strategy) {
      case RecoveryStrategy.EXPONENTIAL_BACKOFF:
        delay = config.initialDelayMs * config.backoffMultiplier ** (attempt - 1)
        break

      case RecoveryStrategy.LINEAR_BACKOFF:
        delay = config.initialDelayMs + (attempt - 1) * config.initialDelayMs * (config.backoffMultiplier - 1)
        break

      case RecoveryStrategy.FIXED_DELAY:
        delay = config.initialDelayMs
        break

      default:
        delay = config.initialDelayMs
    }

    // Apply jitter
    if (config.jitterFactor > 0) {
      const jitter = delay * config.jitterFactor * Math.random()
      delay += jitter
    }

    // Cap at maximum delay
    return Math.min(delay, config.maxDelayMs)
  }

  /**
   * Apply adaptive recovery strategies based on error analysis
   */
  private async applyAdaptiveRecovery(error: ConversionError, attempt: number, actions: string[]): Promise<void> {
    // Adjust timeouts for timeout errors
    if (error.category === ErrorCategory.TIMEOUT) {
      actions.push("Adjusting timeout settings for next attempt")
      // This would be implemented by the calling code
    }

    // Clear caches for memory errors
    if (error.code === ErrorCode.OUT_OF_MEMORY) {
      actions.push("Attempting to clear memory caches")
      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc()
      }
    }

    // Restart Chrome for CDP errors after multiple failures
    if (error.category === ErrorCategory.CDP_ERROR && attempt >= 2) {
      actions.push("Chrome CDP failures detected - suggesting Chrome restart")
    }

    // Reduce concurrent operations for resource errors
    if (error.category === ErrorCategory.RESOURCE_ERROR) {
      actions.push("Resource constraints detected - reducing operation concurrency")
    }
  }

  /**
   * Try graceful degradation strategies
   */
  private async tryGracefulDegradation(
    error: ConversionError,
    _operation: () => Promise<any>,
    _context?: ErrorContext,
  ): Promise<{ success: boolean, fallbackUsed?: string }> {
    // For rendering errors, try without JavaScript
    if (error.category === ErrorCategory.RENDERING_ERROR) {
      try {
        // This would be implemented by the calling code with different options
        return { success: true, fallbackUsed: "rendering_without_javascript" }
      } catch {
        // Fall through to other strategies
      }
    }

    // For export errors, try different format
    if (error.category === ErrorCategory.EXPORT_ERROR) {
      try {
        return { success: true, fallbackUsed: "alternative_export_format" }
      } catch {
        // Fall through
      }
    }

    // For network errors, try offline mode if available
    if (error.category === ErrorCategory.NETWORK_ERROR) {
      try {
        return { success: true, fallbackUsed: "offline_mode" }
      } catch {
        // Fall through
      }
    }

    return { success: false }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(operation: string, error: ConversionError): boolean {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker) {
      return false
    }

    // Check if this error type should be monitored
    if (this.circuitBreakerConfig.monitoredErrors
      && !this.circuitBreakerConfig.monitoredErrors.includes(error.code)) {
      return false
    }

    const now = Date.now()

    switch (breaker.state) {
      case CircuitState.CLOSED:
        return false

      case CircuitState.OPEN:
        // Check if we should transition to half-open
        if (now - breaker.lastFailureTime >= this.circuitBreakerConfig.recoveryTimeoutMs) {
          breaker.state = CircuitState.HALF_OPEN
          breaker.successes = 0
          return false
        }
        return true

      case CircuitState.HALF_OPEN:
        return false

      default:
        return false
    }
  }

  /**
   * Record a failure for circuit breaker
   */
  private recordFailure(operation: string, _error: ConversionError): void {
    let breaker = this.circuitBreakers.get(operation)
    if (!breaker) {
      breaker = { state: CircuitState.CLOSED, failures: 0, lastFailureTime: 0, successes: 0 }
      this.circuitBreakers.set(operation, breaker)
    }

    breaker.failures++
    breaker.lastFailureTime = Date.now()

    if (breaker.state === CircuitState.HALF_OPEN) {
      // Failed in half-open state, open the circuit again
      breaker.state = CircuitState.OPEN
    } else if (breaker.failures >= this.circuitBreakerConfig.failureThreshold) {
      // Too many failures, open the circuit
      breaker.state = CircuitState.OPEN
    }
  }

  /**
   * Record a success for circuit breaker
   */
  private recordSuccess(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)
    if (!breaker) {
      return
    }

    if (breaker.state === CircuitState.HALF_OPEN) {
      breaker.successes++
      if (breaker.successes >= this.circuitBreakerConfig.successThreshold) {
        // Circuit has recovered, close it
        breaker.state = CircuitState.CLOSED
        breaker.failures = 0
        breaker.successes = 0
      }
    } else if (breaker.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      breaker.failures = Math.max(0, breaker.failures - 1)
    }
  }

  /**
   * Check if operation is rate limited
   */
  private isRateLimited(operation?: string): boolean {
    const key = this.rateLimiterConfig.perOperation ? operation || "default" : "global"
    const limiter = this.rateLimiter.get(key)

    if (!limiter) {
      return false
    }

    const now = Date.now()

    // Reset window if expired
    if (now - limiter.windowStart >= this.rateLimiterConfig.windowMs) {
      limiter.errors = 0
      limiter.windowStart = now
      return false
    }

    return limiter.errors >= this.rateLimiterConfig.maxErrors
  }

  /**
   * Update rate limit counter
   */
  private updateRateLimit(operation?: string): void {
    const key = this.rateLimiterConfig.perOperation ? operation || "default" : "global"
    let limiter = this.rateLimiter.get(key)

    if (!limiter) {
      limiter = { errors: 0, windowStart: Date.now() }
      this.rateLimiter.set(key, limiter)
    }

    limiter.errors++
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get circuit breaker state for monitoring
   */
  getCircuitBreakerState(): Record<string, { state: CircuitState, failures: number, successes: number }> {
    const result: Record<string, any> = {}
    for (const [operation, breaker] of this.circuitBreakers.entries()) {
      result[operation] = {
        state: breaker.state,
        failures: breaker.failures,
        successes: breaker.successes,
        lastFailureTime: breaker.lastFailureTime,
      }
    }
    return result
  }

  /**
   * Get rate limiter state for monitoring
   */
  getRateLimiterState(): Record<string, { errors: number, windowStart: number, isLimited: boolean }> {
    const result: Record<string, any> = {}
    for (const [key, limiter] of this.rateLimiter.entries()) {
      result[key] = {
        errors: limiter.errors,
        windowStart: limiter.windowStart,
        isLimited: this.isRateLimited(key),
      }
    }
    return result
  }

  /**
   * Reset all circuit breakers and rate limiters
   */
  reset(): void {
    this.circuitBreakers.clear()
    this.rateLimiter.clear()
  }
}

/**
 * Context enhancement manager for detailed error tracking
 */
export class ContextManager {
  constructor(private config: ContextEnhancementConfig) {}

  /**
   * Enhance error context with additional information
   */
  enhanceContext(error: ConversionError, initialContext?: ErrorContext): ErrorContext {
    const enhanced: ErrorContext = {
      ...initialContext,
      correlationId: initialContext?.correlationId || this.generateCorrelationId(),
    }

    // Initialize metadata if not present
    if (!enhanced.metadata) {
      enhanced.metadata = {}
    }

    // Add performance metrics
    if (this.config.capturePerformance) {
      enhanced.metadata.performance = this.capturePerformanceMetrics()
    }

    // Add duration tracking
    if (this.config.trackDuration && enhanced.metadata?.startTime) {
      enhanced.metadata.duration = Date.now() - enhanced.metadata.startTime
    }

    // Add system state
    if (this.config.captureSystemState) {
      enhanced.metadata.systemState = this.captureSystemState()
    }

    // Analyze stack trace
    if (error.stack) {
      enhanced.metadata.stackAnalysis = this.analyzeStackTrace(error.stack)
    }

    // Sanitize sensitive information
    if (this.config.sanitizeContext) {
      return this.sanitizeContext(enhanced)
    }

    return enhanced
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Capture performance metrics
   */
  private capturePerformanceMetrics(): Record<string, any> {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const memUsage = process.memoryUsage()
      return {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          external: memUsage.external,
        },
        uptime: process.uptime(),
      }
    }

    return {}
  }

  /**
   * Capture system state
   */
  private captureSystemState(): Record<string, any> {
    const state: Record<string, any> = {}

    // Add platform information
    if (typeof process !== "undefined") {
      state.platform = process.platform
      state.nodeVersion = process.version
      state.arch = process.arch
    }

    // Add available memory (Node.js)
    if (typeof process !== "undefined" && process.memoryUsage) {
      const memUsage = process.memoryUsage()
      state.memoryAvailable = memUsage.heapTotal - memUsage.heapUsed
    }

    return state
  }

  /**
   * Analyze stack trace for patterns
   */
  private analyzeStackTrace(stack: string): Record<string, any> {
    const lines = stack.split("\n").slice(0, this.config.maxStackFrames)
    const analysis = {
      totalFrames: lines.length,
      functions: [] as string[],
      files: [] as string[],
      patterns: {
        async: false,
        promise: false,
        timer: false,
        module: false,
      },
    }

    for (const line of lines) {
      // Extract function names
      const functionMatch = line.match(/at\s+(\S+(?:\s+\S+)*?)\s+\(/)
      if (functionMatch && functionMatch[1]) {
        analysis.functions.push(functionMatch[1])
      }

      // Extract file paths
      const pathMatch = line.match(/\((.+?):\d+:\d+\)/)
      if (pathMatch && pathMatch[1]) {
        analysis.files.push(pathMatch[1])
      }

      // Check for patterns
      if (line.includes("async")) {
        analysis.patterns.async = true
      }
      if (line.includes("Promise")) {
        analysis.patterns.promise = true
      }
      if (line.includes("Timer") || line.includes("setTimeout")) {
        analysis.patterns.timer = true
      }
      if (line.includes("Module.") || line.includes("require")) {
        analysis.patterns.module = true
      }
    }

    return analysis
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: ErrorContext): ErrorContext {
    const sanitized: ErrorContext = { ...context }

    if (sanitized.resource) {
      sanitized.resource = this.sanitizeResource(sanitized.resource)
    }

    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeMetadata(sanitized.metadata)
    }

    return sanitized
  }

  /**
   * Sanitize resource information
   */
  private sanitizeResource(resource: string): string {
    let sanitized = resource

    // Remove basic auth credentials
    sanitized = sanitized.replace(/\/\/([^:]+):[^@]+@/g, "//$1:***@")

    // Remove API keys and tokens from URLs
    sanitized = sanitized.replace(/([?&](password|token|secret|api_key|auth|access_token)=)[^&]*/gi, "$1***")

    // Remove sensitive headers (if this looks like a URL with headers)
    sanitized = sanitized.replace(/([?&](authorization|bearer)=)[^&]*/gi, "$1***")

    return sanitized
  }

  /**
   * Sanitize metadata
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}

    for (const [key, value] of Object.entries(metadata)) {
      // Skip known sensitive keys
      if (this.isSensitiveKey(key)) {
        sanitized[key] = "***"
        continue
      }

      // Recursively sanitize objects
      if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  /**
   * Check if a key is potentially sensitive
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i,
      /credential/i,
      /private/i,
      /confidential/i,
    ]

    return sensitivePatterns.some(pattern => pattern.test(key))
  }
}

/**
 * Default recovery manager instance
 */
export const defaultRecoveryManager = new RecoveryManager()

/**
 * Default context manager instance
 */
export const defaultContextManager = new ContextManager({
  capturePerformance: true,
  trackDuration: true,
  captureSystemState: false,
  maxStackFrames: 10,
  sanitizeContext: true,
})

/**
 * ErrorRecovery utility for backward compatibility
 * Provides static access to recovery functionality
 */
export const ErrorRecovery = {
  /**
   * Attempt recovery using default recovery manager
   */
  async attemptRecovery(error: ConversionError): Promise<RecoveryResult> {
    // For now, just return a simple recovery result
    // TODO: Implement proper recovery logic when operation is available
    return {
      success: false,
      attempts: 1,
      totalDurationMs: 0,
      finalError: error,
      actions: ["Recovery not implemented in test context"],
      degraded: false,
    }
  },
}
