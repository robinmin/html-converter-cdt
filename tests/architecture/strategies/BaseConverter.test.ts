import { beforeEach, describe, expect, it, vi } from "vitest"

import { BaseConverter } from "../../../src/architecture/strategies/BaseConverter.js"
import type { ConversionResult, Logger } from "../../../src/architecture/strategies/types.js"

// Mock XMLSerializer for Node.js environment
globalThis.XMLSerializer = class MockXMLSerializer {
  serializeToString(_node: Node): string {
    return "<mock>serialized</mock>"
  }
} as any

// Mock implementation of BaseConverter for testing
class MockConverter extends BaseConverter {
  constructor(logger: Logger) {
    super(logger)
  }

  async convert(input: HTMLDocument): Promise<ConversionResult> {
    if (!this.validate(input).isValid) {
      throw new Error("Invalid input")
    }

    return this.createConversionResult(
      "<div>Converted content</div>",
      "text/html",
      "text/html",
      "text/html",
    )
  }

  getName(): string {
    return "MockConverter"
  }

  canHandle(contentType: string): boolean {
    return contentType === "text/html"
  }

  getSupportedContentTypes(): string[] {
    return ["text/html"]
  }

  getOutputFormat(): string {
    return "text/html"
  }
}

// Mock logger
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

describe("baseConverter", () => {
  let converter: MockConverter

  beforeEach(() => {
    vi.clearAllMocks()
    converter = new MockConverter(mockLogger)
  })

  describe("validation", () => {
    it("should validate correct HTML document", () => {
      const mockDocument = {
        documentElement: {
          children: [{}, {}], // Non-empty document
        },
      } as unknown as HTMLDocument

      const result = converter.validate(mockDocument)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.context?.contentType).toBe("text/html")
      expect(result.context?.size).toBeGreaterThan(0)
    })

    it("should reject null input", () => {
      const result = converter.validate(null as any)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("Input HTMLDocument is null or undefined")
    })

    it("should reject undefined input", () => {
      const result = converter.validate(undefined as any)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("Input HTMLDocument is null or undefined")
    })

    it("should reject document without document element", () => {
      const mockDocument = {} as HTMLDocument

      const result = converter.validate(mockDocument)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("Input HTMLDocument has no document element")
    })

    it("should warn for empty documents", () => {
      const mockDocument = {
        documentElement: {
          children: [], // Empty document
        },
      } as unknown as HTMLDocument

      const result = converter.validate(mockDocument)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain("HTML document appears to be empty")
    })
  })

  describe("conversion", () => {
    it("should convert valid HTML document", async () => {
      const mockDocument = {
        documentElement: {
          children: [{}, {}],
        },
      } as unknown as HTMLDocument

      const result = await converter.convert(mockDocument)

      expect(result.content).toBe("<div>Converted content</div>")
      expect(result.mimeType).toBe("text/html")
      expect(result.metadata.sourceType).toBe("text/html")
      expect(result.metadata.targetFormat).toBe("text/html")
      expect(result.metadata.timestamp).toBeInstanceOf(Date)
      expect(result.metadata.size).toBeGreaterThan(0)
    })

    it("should throw error for invalid input during conversion", async () => {
      await expect(converter.convert(null as any)).rejects.toThrow("Invalid input")
    })
  })

  describe("helper methods", () => {
    it("should measure conversion time", async () => {
      const startTime = performance.now()

      const { result, duration } = await converter.measureConversionTime(async () => {
        return "test result"
      })

      expect(result).toBe("test result")
      expect(duration).toBeGreaterThanOrEqual(0)
      expect(duration).toBeLessThan(performance.now() - startTime + 10) // Allow small margin
    })

    it("should validate dependencies correctly", () => {
      expect(() => converter.validateDependencies({ dep1: "value", dep2: 123 })).not.toThrow()

      expect(() => converter.validateDependencies({ dep1: null as any })).toThrow(
        "Required dependency 'dep1' is null or undefined",
      )

      expect(() => converter.validateDependencies({ dep1: undefined as any })).toThrow(
        "Required dependency 'dep1' is null or undefined",
      )
    })

    it("should create conversion result with metadata", () => {
      const result = converter.createConversionResult(
        "test content",
        "text/plain",
        "text/html",
        "text/plain",
        { customField: "custom value" },
      )

      expect(result.content).toBe("test content")
      expect(result.mimeType).toBe("text/plain")
      expect(result.metadata.sourceType).toBe("text/html")
      expect(result.metadata.targetFormat).toBe("text/plain")
      expect(result.metadata.timestamp).toBeInstanceOf(Date)
      expect(result.metadata.size).toBe("test content".length)
      expect(result.metadata.customField).toBe("custom value")
    })
  })

  describe("strategy interface compliance", () => {
    it("should implement strategy interface correctly", () => {
      expect(converter.getName()).toBe("MockConverter")
      expect(converter.canHandle("text/html")).toBe(true)
      expect(converter.canHandle("application/json")).toBe(false)
      expect(converter.getSupportedContentTypes()).toEqual(["text/html"])
      expect(converter.getOutputFormat()).toBe("text/html")
    })
  })
})
