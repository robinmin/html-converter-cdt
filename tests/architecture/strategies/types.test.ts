import { describe, expect, it, vi } from "vitest"

import type { ConversionResult, Logger, ValidationResult } from "../../../src/architecture/strategies/types.js"

describe("strategy Types", () => {
  describe("conversionResult", () => {
    it("should have required properties", () => {
      const result: ConversionResult = {
        content: "<div>Test content</div>",
        mimeType: "text/html",
        metadata: {
          sourceType: "text/html",
          targetFormat: "text/html",
          timestamp: new Date(),
          size: 100,
        },
      }

      expect(result.content).toBe("<div>Test content</div>")
      expect(result.mimeType).toBe("text/html")
      expect(result.metadata.sourceType).toBe("text/html")
      expect(result.metadata.targetFormat).toBe("text/html")
      expect(result.metadata.timestamp).toBeInstanceOf(Date)
      expect(result.metadata.size).toBe(100)
    })

    it("should allow additional metadata properties", () => {
      const result: ConversionResult = {
        content: "test",
        mimeType: "text/plain",
        metadata: {
          sourceType: "text/html",
          targetFormat: "text/plain",
          timestamp: new Date(),
          size: 4,
          customProperty: "custom value",
          anotherProperty: 123,
        },
      }

      expect(result.metadata.customProperty).toBe("custom value")
      expect(result.metadata.anotherProperty).toBe(123)
    })
  })

  describe("validationResult", () => {
    it("should have required properties", () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
      }

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it("should contain errors and warnings", () => {
      const result: ValidationResult = {
        isValid: false,
        errors: ["Error 1", "Error 2"],
        warnings: ["Warning 1"],
      }

      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(["Error 1", "Error 2"])
      expect(result.warnings).toEqual(["Warning 1"])
    })

    it("should include optional context", () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        context: {
          contentType: "text/html",
          size: 1000,
          additionalInfo: "some info",
        },
      }

      expect(result.context?.contentType).toBe("text/html")
      expect(result.context?.size).toBe(1000)
      expect(result.context?.additionalInfo).toBe("some info")
    })
  })

  describe("logger", () => {
    it("should define required methods", () => {
      const logger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }

      expect(typeof logger.debug).toBe("function")
      expect(typeof logger.info).toBe("function")
      expect(typeof logger.warn).toBe("function")
      expect(typeof logger.error).toBe("function")
    })
  })
})
