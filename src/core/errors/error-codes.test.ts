/**
 * Error Codes and Recovery Strategy Tests
 */

import { describe, expect, it } from "vitest"

import {
  ERROR_MESSAGES,
  ErrorCategory,
  ErrorCode,
  ErrorSeverity,
  getErrorMessage,
  getErrorMetadata,
  getRecoveryStrategy,
  isRetryableError,
} from "./error-codes"

describe("errorCode", () => {
  it("should have unique error codes", () => {
    const codes = Object.values(ErrorCode)
    const uniqueCodes = new Set(codes)
    expect(codes.length).toBe(uniqueCodes.size)
  })

  it("should categorize network errors correctly", () => {
    const networkCodes = [
      ErrorCode.NETWORK_CONNECTION_FAILED,
      ErrorCode.NETWORK_DNS_ERROR,
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.NETWORK_SSL_ERROR,
      ErrorCode.NETWORK_PROXY_ERROR,
    ]

    networkCodes.forEach((code) => {
      const metadata = getErrorMetadata(code)
      expect(metadata.category).toBe(ErrorCategory.NETWORK_ERROR)
      expect(metadata.severity).toBe(ErrorSeverity.HIGH)
    })
  })

  it("should categorize timeout errors correctly", () => {
    const timeoutCodes = [
      ErrorCode.OPERATION_TIMEOUT,
      ErrorCode.CDP_TIMEOUT,
      ErrorCode.CONVERSION_TIMEOUT,
      ErrorCode.RENDERING_TIMEOUT,
    ]

    timeoutCodes.forEach((code) => {
      const metadata = getErrorMetadata(code)
      expect(metadata.category).toBe(ErrorCategory.TIMEOUT)
      expect(metadata.severity).toBe(ErrorSeverity.MEDIUM)
    })
  })

  it("should categorize CDP errors correctly", () => {
    const cdpCodes = [
      ErrorCode.CDP_CONNECTION_FAILED,
      ErrorCode.CDP_PROTOCOL_ERROR,
      ErrorCode.CDP_TARGET_NOT_FOUND,
      ErrorCode.CDP_COMMAND_FAILED,
      ErrorCode.CHROME_NOT_FOUND,
      ErrorCode.CHROME_LAUNCH_FAILED,
    ]

    cdpCodes.forEach((code) => {
      const metadata = getErrorMetadata(code)
      expect(metadata.category).toBe(ErrorCategory.CDP_ERROR)
      expect(metadata.severity).toBe(ErrorSeverity.HIGH)
    })
  })

  it("should categorize memory errors with appropriate severity", () => {
    const { category: outOfMemoryCategory, severity: outOfMemorySeverity } = getErrorMetadata(ErrorCode.OUT_OF_MEMORY)
    expect(outOfMemoryCategory).toBe(ErrorCategory.MEMORY_ERROR)
    expect(outOfMemorySeverity).toBe(ErrorSeverity.CRITICAL)

    const { category: bufferCategory, severity: bufferSeverity } = getErrorMetadata(ErrorCode.BUFFER_OVERFLOW)
    expect(bufferCategory).toBe(ErrorCategory.MEMORY_ERROR)
    expect(bufferSeverity).toBe(ErrorSeverity.HIGH)
  })
})

describe("eRROR_MESSAGES", () => {
  it("should have messages for all error codes", () => {
    const allCodes = Object.values(ErrorCode)
    allCodes.forEach((code) => {
      expect(ERROR_MESSAGES[code]).toBeDefined()
      expect(ERROR_MESSAGES[code].message).toBeTruthy()
      expect(ERROR_MESSAGES[code].recovery).toBeDefined()
      expect(ERROR_MESSAGES[code].recovery.suggestions).toBeDefined()
      expect(ERROR_MESSAGES[code].recovery.suggestions.length).toBeGreaterThan(0)
    })
  })

  it("should have meaningful messages", () => {
    const sampleCodes = [
      ErrorCode.NETWORK_CONNECTION_FAILED,
      ErrorCode.INVALID_FILE_PATH,
      ErrorCode.CONVERSION_FAILED,
      ErrorCode.PERMISSION_DENIED,
    ]

    sampleCodes.forEach((code) => {
      const errorMessage = ERROR_MESSAGES[code]
      expect(errorMessage.message.length).toBeGreaterThan(10)
      expect(errorMessage.details.length).toBeGreaterThan(10)
      expect(errorMessage.recovery.suggestions.length).toBeGreaterThan(0)
    })
  })

  it("should have retryable network errors", () => {
    const networkErrors = [
      ErrorCode.NETWORK_CONNECTION_FAILED,
      ErrorCode.NETWORK_DNS_ERROR,
      ErrorCode.NETWORK_TIMEOUT,
    ]

    networkErrors.forEach((code) => {
      expect(ERROR_MESSAGES[code].recovery.canRetry).toBe(true)
      expect(ERROR_MESSAGES[code].recovery.maxRetries).toBeGreaterThan(0)
    })
  })

  it("should have non-retryable permission errors", () => {
    const permissionErrors = [
      ErrorCode.PERMISSION_DENIED,
      ErrorCode.FILE_ACCESS_DENIED,
      ErrorCode.INVALID_FILE_PATH,
    ]

    permissionErrors.forEach((code) => {
      expect(ERROR_MESSAGES[code].recovery.canRetry).toBe(false)
    })
  })
})

describe("getErrorMessage", () => {
  it("should return correct error message", () => {
    const message = getErrorMessage(ErrorCode.NETWORK_CONNECTION_FAILED)
    expect(message.message).toBe("Network connection failed")
    expect(message.details).toBeTruthy()
    expect(message.recovery.suggestions.length).toBeGreaterThan(0)
  })

  it("should return fallback message for unknown error", () => {
    const unknownCode = "UNKNOWN_ERROR" as ErrorCode
    const message = getErrorMessage(unknownCode)
    expect(message.message).toBe("Unknown error occurred")
    expect(message.recovery.canRetry).toBe(false)
  })
})

describe("getRecoveryStrategy", () => {
  it("should return recovery strategy for retryable errors", () => {
    const strategy = getRecoveryStrategy(ErrorCode.NETWORK_CONNECTION_FAILED)
    expect(strategy.canRetry).toBe(true)
    expect(strategy.maxRetries).toBe(3)
    expect(strategy.suggestions.length).toBeGreaterThan(0)
  })

  it("should return non-retryable strategy for permission errors", () => {
    const strategy = getRecoveryStrategy(ErrorCode.PERMISSION_DENIED)
    expect(strategy.canRetry).toBe(false)
    expect(strategy.suggestions.length).toBeGreaterThan(0)
  })

  it("should include backoff information for network errors", () => {
    const strategy = getRecoveryStrategy(ErrorCode.NETWORK_CONNECTION_FAILED)
    expect(strategy.backoffMs).toBe(1000)
    expect(strategy.exponentialBackoff).toBe(true)
  })
})

describe("isRetryableError", () => {
  it("should identify retryable errors", () => {
    const retryableCodes = [
      ErrorCode.NETWORK_CONNECTION_FAILED,
      ErrorCode.OPERATION_TIMEOUT,
      ErrorCode.CDP_CONNECTION_FAILED,
      ErrorCode.CONVERSION_FAILED,
      ErrorCode.RENDERING_FAILED,
    ]

    retryableCodes.forEach((code) => {
      expect(isRetryableError(code)).toBe(true)
    })
  })

  it("should identify non-retryable errors", () => {
    const nonRetryableCodes = [
      ErrorCode.PERMISSION_DENIED,
      ErrorCode.INVALID_FILE_PATH,
      ErrorCode.UNSUPPORTED_FORMAT,
      ErrorCode.FILE_ACCESS_DENIED,
    ]

    nonRetryableCodes.forEach((code) => {
      expect(isRetryableError(code)).toBe(false)
    })
  })
})

describe("error Message Quality", () => {
  it("should provide actionable suggestions", () => {
    const message = getErrorMessage(ErrorCode.NETWORK_CONNECTION_FAILED)
    const suggestions = message.recovery.suggestions

    suggestions.forEach((suggestion) => {
      expect(suggestion.length).toBeGreaterThan(10)
      expect(suggestion[0]).toBe(suggestion[0].toUpperCase())
    })
  })

  it("should have appropriate retry counts", () => {
    const networkStrategy = getRecoveryStrategy(ErrorCode.NETWORK_CONNECTION_FAILED)
    expect(networkStrategy.maxRetries).toBeLessThanOrEqual(5)
    expect(networkStrategy.maxRetries).toBeGreaterThan(0)

    const criticalStrategy = getRecoveryStrategy(ErrorCode.OUT_OF_MEMORY)
    expect(criticalStrategy.canRetry).toBe(false)
  })

  it("should include alternatives where appropriate", () => {
    const networkMessage = getErrorMessage(ErrorCode.NETWORK_CONNECTION_FAILED)
    expect(networkMessage.recovery.alternatives).toBeDefined()
    expect(networkMessage.recovery.alternatives!.length).toBeGreaterThan(0)
  })
})
