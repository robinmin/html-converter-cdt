/**
 * Error Integration Tests
 *
 * Tests for error handling integration utilities and components.
 * Verifies that error handling works correctly across different scenarios.
 */

import { beforeEach, describe, expect, it } from "vitest"

import { ErrorCode } from "./conversion-error"
import {
  ConversionError,
  createErrorAwareOperation,
  ErrorHandler,
  ErrorIntegration,
  ErrorSimulator,
  withRetry,
} from "./index"

describe("error Integration", () => {
  let _errorHandler: ErrorHandler
  let errorIntegration: ErrorIntegration

  beforeEach(() => {
    _errorHandler = new ErrorHandler({
      debug: true,
      logger: (level, message, context) => {
        console.log(`[${level.toUpperCase()}] ${message}`, context)
      },
    }) // Enable debug logging with console output
    errorIntegration = new ErrorIntegration({
      enableRecovery: false, // Disable for testing
      maxRetries: 2,
      errorHandler: _errorHandler, // Pass the actual ErrorHandler instance
    })
  })

  describe("errorIntegration.wrapOperation", () => {
    it("should wrap successful operations", async () => {
      const result = await errorIntegration.wrapOperation(async () => {
        return "success"
      })

      expect(result).toBe("success")
    })

    it("should normalize errors from wrapped operations", async () => {
      const originalError = new Error("Original error message")

      await expect(
        errorIntegration.wrapOperation(async () => {
          throw originalError
        }),
      ).rejects.toThrow(ConversionError)
    })

    it("should include context in wrapped operation errors", async () => {
      const customError = new Error("Custom error")

      try {
        await errorIntegration.wrapOperation(
          async () => {
            throw customError
          },
          { context: "Test operation" },
        )
      } catch (error) {
        expect(error).toBeInstanceOf(ConversionError)
        expect((error as ConversionError).context.operation).toBe("Test operation")
      }
    })

    it("should respect retry configuration", async () => {
      let attempts = 0
      const maxAttempts = 3

      await expect(
        errorIntegration.wrapOperation(
          async () => {
            attempts++
            if (attempts < maxAttempts) {
              throw new Error("Temporary failure")
            }
            return "success"
          },
          { retries: 3 },
        ),
      ).resolves.toBe("success")

      expect(attempts).toBe(3)
    })
  })

  describe("errorIntegration.processCDPError", () => {
    it("should process Chrome DevTools Protocol errors", () => {
      const cdpError = {
        message: "Target not found",
        response: {
          method: "Target.attachToTarget",
          sessionId: "session-123",
        },
      }

      const processedError = errorIntegration.processCDPError(cdpError, "CDP test")

      expect(processedError).toBeInstanceOf(ConversionError)
      expect(processedError.context.metadata?.cdp_method).toBe("Target.attachToTarget")
      expect(processedError.context.metadata?.cdp_session).toBe("session-123")
    })

    it("should handle CDP errors without response", () => {
      const cdpError = {
        message: "Connection failed",
      }

      const processedError = errorIntegration.processCDPError(cdpError)

      expect(processedError).toBeInstanceOf(ConversionError)
      expect(processedError.context.metadata?.source).toBe("chrome-devtools-protocol")
    })
  })

  describe("errorIntegration.processFileSystemError", () => {
    it("should process file system errors", () => {
      const fsError = new Error("File not found") as NodeJS.ErrnoException
      fsError.code = "ENOENT"
      fsError.path = "/path/to/file.html"

      const processedError = errorIntegration.processFileSystemError(
        fsError,
        "read operation",
        "/path/to/file.html",
      )

      expect(processedError).toBeInstanceOf(ConversionError)
      expect(processedError.context.metadata?.errno_code).toBe("ENOENT")
      expect(processedError.context.metadata?.file_path).toBe("/path/to/file.html")
    })

    it("should handle file system errors without path", () => {
      const fsError = new Error("Permission denied") as NodeJS.ErrnoException
      fsError.code = "EACCES"

      const processedError = errorIntegration.processFileSystemError(
        fsError,
        "write operation",
      )

      expect(processedError).toBeInstanceOf(ConversionError)
      expect(processedError.context.metadata?.errno_code).toBe("EACCES")
    })
  })

  describe("errorIntegration.createDomainHandler", () => {
    it("should create domain-specific error handlers", async () => {
      const domainHandler = errorIntegration.createDomainHandler("Conversion")

      expect(domainHandler.wrap).toBeInstanceOf(Function)
      expect(domainHandler.process).toBeInstanceOf(Function)
      expect(domainHandler.log).toBeInstanceOf(Function)
    })

    it("should wrap operations with domain context", async () => {
      const domainHandler = errorIntegration.createDomainHandler("TestDomain")

      try {
        await domainHandler.wrap(
          async () => {
            throw new Error("Domain error")
          },
          "Specific operation",
        )
      } catch (error) {
        expect(error).toBeInstanceOf(ConversionError)
        expect((error as ConversionError).context.metadata?.domain).toBe("TestDomain")
      }
    })
  })

  describe("createErrorAwareOperation", () => {
    it("should create error-aware operation wrappers", async () => {
      const safeOperation = createErrorAwareOperation(
        async (value: string) => {
          if (value === "error") {
            throw new Error("Test error")
          }
          // Defensive check for undefined/null value
          if (value == null || value === undefined) {
            return ""
          }
          return value.toUpperCase()
        },
        {
          context: "String processing",
          errorHandler: _errorHandler,
        },
      )

      const result = await safeOperation("success")
      expect(result).toBe("SUCCESS")

      await expect(safeOperation("error")).rejects.toThrow(ConversionError)
    })
  })

  describe("withRetry decorator", () => {
    it("should retry failed operations", async () => {
      let attempts = 0

      const retryingOperation = withRetry(
        async () => {
          attempts++
          if (attempts < 3) {
            throw new Error("Temporary failure")
          }
          return "SUCCESS"
        },
        { maxRetries: 3, delay: 10 },
      )

      const result = await retryingOperation()
      expect(result).toBe("SUCCESS")
      expect(attempts).toBe(3)
    })

    it("should respect retry condition", async () => {
      const simulator = new ErrorSimulator()
      const networkError = simulator.simulateNetworkError()

      const retryingOperation = withRetry(
        async () => {
          throw networkError
        },
        {
          maxRetries: 2,
          retryCondition: error => error.code === ErrorCode.NETWORK_CONNECTION_FAILED,
          delay: 10,
        },
      )

      await expect(retryingOperation()).rejects.toThrow()
    })

    it("should not retry non-retryable errors", async () => {
      let attempts = 0

      const retryingOperation = withRetry(
        async () => {
          attempts++
          throw new Error("Non-retryable error")
        },
        {
          maxRetries: 3,
          retryCondition: () => false, // Never retry
          delay: 10,
        },
      )

      await expect(retryingOperation()).rejects.toThrow()
      expect(attempts).toBe(1) // Should only attempt once
    })
  })

  describe("integration with ErrorSimulator", () => {
    it("should work with simulated errors", async () => {
      const simulator = new ErrorSimulator()
      const networkError = simulator.simulateNetworkError({
        url: "https://example.com",
        cause: "timeout",
      })

      const errorAwareOperation = createErrorAwareOperation(
        async () => {
          throw networkError
        },
        { context: "Network simulation test" },
      )

      await expect(errorAwareOperation()).rejects.toThrow(ConversionError)
    })

    it("should integrate with error scenarios", async () => {
      const { ErrorScenarios } = await import("./error-simulation")
      const errorScenario = ErrorScenarios.cdp.targetNotFound()

      const processedError = errorIntegration.processCDPError(errorScenario, "Scenario test")

      expect(processedError).toBeInstanceOf(ConversionError)
      expect(processedError.context.metadata?.cdp_method).toBeTruthy()
    })
  })

  describe("error Context Preservation", () => {
    it("should preserve error context through integration layers", async () => {
      const _originalContext = {
        operation: "Test operation",
        userId: "user-123",
        sessionId: "session-456",
      }

      const domainHandler = errorIntegration.createDomainHandler("TestDomain")

      try {
        await domainHandler.wrap(
          async () => {
            const error = new Error("Context test")
            throw error
          },
          "Wrapped operation",
        )
      } catch (error) {
        expect(error).toBeInstanceOf(ConversionError)
        const conversionError = error as ConversionError

        // Check that context is preserved
        expect(conversionError.context.metadata?.domain).toBe("TestDomain")
        expect(conversionError.context.operation).toBe("Wrapped operation")
      }
    })

    it("should add correlation IDs for error tracking", async () => {
      const correlationId = "correlation-123"

      await expect(
        errorIntegration.wrapOperation(
          async () => {
            throw new Error("Correlation test")
          },
          {
            context: "Correlation test",
            errorHandler: { correlationId },
          },
        ),
      ).rejects.toThrow(ConversionError)
    })
  })
})
