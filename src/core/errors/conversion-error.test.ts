/**
 * Conversion Error Tests
 */

import { describe, expect, it } from "vitest"

import {
  ConversionError,
  createConversionError,
  ErrorCategory,
  ErrorCode,
  ErrorSeverity,
  isConversionError,
} from "./conversion-error"

describe("conversionError", () => {
  describe("constructor", () => {
    it("should create error with required fields", () => {
      const error = new ConversionError(
        "Test message",
        ErrorCode.CONVERSION_FAILED,
        ErrorCategory.CONVERSION_FAILED,
      )

      expect(error.message).toBe("Test message")
      expect(error.code).toBe(ErrorCode.CONVERSION_FAILED)
      expect(error.category).toBe(ErrorCategory.CONVERSION_FAILED)
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.name).toBe("ConversionError")
      expect(error.timestamp).toBeInstanceOf(Date)
    })

    it("should create error with all fields", () => {
      const context = {
        operation: "test",
        resource: "test.html",
        suggestions: ["Try again"],
      }
      const originalError = new Error("Original")

      const error = new ConversionError(
        "Test message",
        ErrorCode.NETWORK_CONNECTION_FAILED,
        ErrorCategory.NETWORK_ERROR,
        ErrorSeverity.HIGH,
        context,
        originalError,
      )

      expect(error.context).toEqual(context)
      expect(error.originalError).toBe(originalError)
    })
  })

  describe("getUserMessage", () => {
    it("should return message without suggestions when none provided", () => {
      const error = new ConversionError(
        "Test message",
        ErrorCode.CONVERSION_FAILED,
        ErrorCategory.CONVERSION_FAILED,
      )

      expect(error.getUserMessage()).toBe("Test message")
    })

    it("should return message with suggestions", () => {
      const error = new ConversionError(
        "Test message",
        ErrorCode.CONVERSION_FAILED,
        ErrorCategory.CONVERSION_FAILED,
        ErrorSeverity.MEDIUM,
        {
          suggestions: ["Try again", "Check input"],
        },
      )

      const userMessage = error.getUserMessage()
      expect(userMessage).toContain("Test message")
      expect(userMessage).toContain("Suggestions:")
      expect(userMessage).toContain("1. Try again")
      expect(userMessage).toContain("2. Check input")
    })
  })

  describe("isRetryable", () => {
    it("should return retryable status from context", () => {
      const error = new ConversionError(
        "Test message",
        ErrorCode.NETWORK_CONNECTION_FAILED,
        ErrorCategory.NETWORK_ERROR,
        ErrorSeverity.MEDIUM,
        { retryInfo: { canRetry: true } },
      )

      expect(error.isRetryable()).toBe(true)
    })

    it("should return default retryability for network errors", () => {
      const error = new ConversionError(
        "Test message",
        ErrorCode.NETWORK_CONNECTION_FAILED,
        ErrorCategory.NETWORK_ERROR,
      )

      expect(error.isRetryable()).toBe(true)
    })

    it("should return default retryability for input errors", () => {
      const error = new ConversionError(
        "Test message",
        ErrorCode.INVALID_INPUT,
        ErrorCategory.INVALID_INPUT,
      )

      expect(error.isRetryable()).toBe(false)
    })
  })

  describe("toJSON", () => {
    it("should serialize error to JSON", () => {
      const originalError = new Error("Original")
      const error = new ConversionError(
        "Test message",
        ErrorCode.CONVERSION_FAILED,
        ErrorCategory.CONVERSION_FAILED,
        ErrorSeverity.MEDIUM,
        { operation: "test" },
        originalError,
      )

      const json = error.toJSON()

      expect(json.name).toBe("ConversionError")
      expect(json.message).toBe("Test message")
      expect(json.code).toBe(ErrorCode.CONVERSION_FAILED)
      expect(json.category).toBe(ErrorCategory.CONVERSION_FAILED)
      expect(json.severity).toBe(ErrorSeverity.MEDIUM)
      expect(json.context.operation).toBe("test")
      expect(json.originalError).toEqual({
        name: "Error",
        message: "Original",
      })
      expect(json.timestamp).toBeDefined()
      expect(json.stack).toBeDefined()
    })

    it("should not include original stack in JSON", () => {
      const error = new ConversionError(
        "Test message",
        ErrorCode.CONVERSION_FAILED,
        ErrorCategory.CONVERSION_FAILED,
        ErrorSeverity.MEDIUM,
        { originalStack: "sensitive stack trace" },
      )

      const json = error.toJSON()
      expect(json.context.originalStack).toBeUndefined()
    })
  })

  describe("toString", () => {
    it("should return string representation with code", () => {
      const error = new ConversionError(
        "Test message",
        ErrorCode.CONVERSION_FAILED,
        ErrorCategory.CONVERSION_FAILED,
      )

      expect(error.toString()).toBe("ConversionError [CONVERSION_FAILED]: Test message")
    })
  })

  describe("fromError", () => {
    it("should return ConversionError as-is", () => {
      const originalError = new ConversionError(
        "Original",
        ErrorCode.CONVERSION_FAILED,
        ErrorCategory.CONVERSION_FAILED,
      )

      const result = ConversionError.fromError(originalError)
      expect(result).toBe(originalError)
    })

    it("should convert Error to ConversionError", () => {
      const originalError = new Error("Original error")

      const result = ConversionError.fromError(originalError)
      expect(isConversionError(result)).toBe(true)
      expect(result.message).toBe("Original error")
      expect(result.originalError).toBe(originalError)
    })

    it("should convert string to ConversionError", () => {
      const result = ConversionError.fromError("String error")
      expect(isConversionError(result)).toBe(true)
      expect(result.message).toBe("String error")
    })

    it("should map network errors", () => {
      const networkError = new Error("ECONNREFUSED: Connection refused")

      const result = ConversionError.fromError(networkError)
      expect(result.code).toBe(ErrorCode.NETWORK_CONNECTION_FAILED)
      expect(result.category).toBe(ErrorCategory.NETWORK_ERROR)
      expect(result.context.suggestions).toBeDefined()
    })

    it("should map timeout errors", () => {
      const timeoutError = new Error("Operation timed out")

      const result = ConversionError.fromError(timeoutError)
      expect(result.code).toBe(ErrorCode.OPERATION_TIMEOUT)
      expect(result.category).toBe(ErrorCategory.TIMEOUT)
    })

    it("should map file not found errors", () => {
      const fileError = new Error("ENOENT: no such file or directory")

      const result = ConversionError.fromError(fileError)
      expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND)
      expect(result.category).toBe(ErrorCategory.FILE_SYSTEM_ERROR)
    })
  })
})

describe("utility Functions", () => {
  describe("isConversionError", () => {
    it("should return true for ConversionError", () => {
      const error = new ConversionError(
        "Test",
        ErrorCode.CONVERSION_FAILED,
        ErrorCategory.CONVERSION_FAILED,
      )

      expect(isConversionError(error)).toBe(true)
    })

    it("should return false for regular Error", () => {
      const error = new Error("Test")
      expect(isConversionError(error)).toBe(false)
    })

    it("should return false for non-Error objects", () => {
      expect(isConversionError("string")).toBe(false)
      expect(isConversionError(null)).toBe(false)
      expect(isConversionError(undefined)).toBe(false)
    })
  })

  describe("createConversionError", () => {
    it("should create ConversionError with auto-detected category and severity", () => {
      const error = createConversionError(
        "Test message",
        ErrorCode.NETWORK_CONNECTION_FAILED,
        { operation: "test" },
      )

      expect(error.message).toBe("Test message")
      expect(error.code).toBe(ErrorCode.NETWORK_CONNECTION_FAILED)
      expect(error.category).toBe(ErrorCategory.NETWORK_ERROR)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.context.operation).toBe("test")
    })
  })
})
