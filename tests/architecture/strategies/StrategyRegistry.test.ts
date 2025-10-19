import { beforeEach, describe, expect, it, vi } from "vitest"

import { StrategyRegistry } from "../../../src/architecture/strategies/StrategyRegistry.js"
import type { ConverterStrategy, Logger } from "../../../src/architecture/strategies/types.js"

// Mock strategy implementation
class MockStrategy implements ConverterStrategy {
  constructor(
    private name: string,
    private supportedTypes: string[],
    private outputFormat: string,
  ) {}

  getName(): string {
    return this.name
  }

  canHandle(contentType: string): boolean {
    return this.supportedTypes.includes(contentType.toLowerCase())
  }

  getSupportedContentTypes(): string[] {
    return this.supportedTypes
  }

  getOutputFormat(): string {
    return this.outputFormat
  }

  async convert(_input: HTMLDocument): Promise<any> {
    return { content: "mock conversion", format: this.outputFormat }
  }

  validate(_input: HTMLDocument): any {
    return { isValid: true, errors: [], warnings: [] }
  }
}

// Mock logger
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

describe("strategyRegistry", () => {
  let registry: StrategyRegistry
  let mockStrategy1: ConverterStrategy
  let mockStrategy2: ConverterStrategy
  let mockStrategy3: ConverterStrategy

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new StrategyRegistry(mockLogger)

    mockStrategy1 = new MockStrategy("HTMLConverter", ["text/html", "application/xhtml+xml"], "text/html")
    mockStrategy2 = new MockStrategy("PDFConverter", ["text/html"], "application/pdf")
    mockStrategy3 = new MockStrategy("JSONConverter", ["application/json", "text/plain"], "application/json")
  })

  describe("registration", () => {
    it("should register a strategy successfully", () => {
      registry.register(mockStrategy1)

      expect(registry.hasStrategy("HTMLConverter")).toBe(true)
      expect(registry.getStrategy("HTMLConverter")).toBe(mockStrategy1)
      expect(mockLogger.debug).toHaveBeenCalledWith("Registered converter strategy: HTMLConverter")
    })

    it("should handle duplicate strategy registration", () => {
      registry.register(mockStrategy1)
      registry.register(mockStrategy1) // Register same strategy again

      expect(registry.getStrategyCount()).toBe(1)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Strategy 'HTMLConverter' is already registered. Overwriting.",
      )
    })

    it("should throw error for null strategy", () => {
      expect(() => registry.register(null as any)).toThrow("Strategy cannot be null or undefined")
    })

    it("should throw error for strategy with empty name", () => {
      const emptyStrategy = { ...mockStrategy1, getName: () => "" }
      expect(() => registry.register(emptyStrategy as any)).toThrow(
        "Strategy name must be a non-empty string",
      )
    })

    it("should unregister a strategy successfully", () => {
      registry.register(mockStrategy1)
      registry.unregister("HTMLConverter")

      expect(registry.hasStrategy("HTMLConverter")).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith("Unregistered converter strategy: HTMLConverter")
    })

    it("should warn when unregistering non-existent strategy", () => {
      registry.unregister("NonExistentStrategy")

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Attempted to unregister non-existent strategy: NonExistentStrategy",
      )
    })

    it("should throw error for empty strategy name when unregistering", () => {
      expect(() => registry.unregister("")).toThrow("Strategy name must be a non-empty string")
    })
  })

  describe("strategy retrieval", () => {
    beforeEach(() => {
      registry.register(mockStrategy1)
      registry.register(mockStrategy2)
      registry.register(mockStrategy3)
    })

    it("should get strategy by name", () => {
      const strategy = registry.getStrategy("PDFConverter")

      expect(strategy).toBe(mockStrategy2)
    })

    it("should return undefined for non-existent strategy", () => {
      const strategy = registry.getStrategy("NonExistent")

      expect(strategy).toBeUndefined()
      expect(mockLogger.debug).toHaveBeenCalledWith("Strategy not found: NonExistent")
    })

    it("should return undefined for empty strategy name", () => {
      const strategy = registry.getStrategy("")

      expect(strategy).toBeUndefined()
      expect(mockLogger.warn).toHaveBeenCalledWith("Attempted to get strategy with empty name")
    })

    it("should get all strategies", () => {
      const allStrategies = registry.getAllStrategies()

      expect(allStrategies).toHaveLength(3)
      expect(allStrategies).toContain(mockStrategy1)
      expect(allStrategies).toContain(mockStrategy2)
      expect(allStrategies).toContain(mockStrategy3)
    })

    it("should get strategy count", () => {
      expect(registry.getStrategyCount()).toBe(3)
    })

    it("should check if strategy exists", () => {
      expect(registry.hasStrategy("HTMLConverter")).toBe(true)
      expect(registry.hasStrategy("NonExistent")).toBe(false)
      expect(registry.hasStrategy("")).toBe(false)
    })
  })

  describe("content type matching", () => {
    beforeEach(() => {
      registry.register(mockStrategy1) // text/html, application/xhtml+xml
      registry.register(mockStrategy2) // text/html
      registry.register(mockStrategy3) // application/json, text/plain
    })

    it("should find strategy for content type", () => {
      const strategy = registry.findStrategyForContentType("text/html")

      expect(strategy).toBe(mockStrategy1) // First registered strategy that matches
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Found strategy 'HTMLConverter' for content type: text/html",
      )
    })

    it("should find strategy for different content type", () => {
      const strategy = registry.findStrategyForContentType("application/json")

      expect(strategy).toBe(mockStrategy3)
    })

    it("should return undefined for unsupported content type", () => {
      const strategy = registry.findStrategyForContentType("image/png")

      expect(strategy).toBeUndefined()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "No strategy found for content type: image/png",
      )
    })

    it("should handle case insensitive content type matching", () => {
      const strategy = registry.findStrategyForContentType("TEXT/HTML")

      expect(strategy).toBe(mockStrategy1)
    })

    it("should handle whitespace in content type", () => {
      const strategy = registry.findStrategyForContentType("  text/html  ")

      expect(strategy).toBe(mockStrategy1)
    })

    it("should return undefined for empty content type", () => {
      const strategy = registry.findStrategyForContentType("")

      expect(strategy).toBeUndefined()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Attempted to find strategy for empty content type",
      )
    })

    it("should find all strategies for content type", () => {
      const strategies = registry.findStrategiesForContentType("text/html")

      expect(strategies).toHaveLength(2)
      expect(strategies).toContain(mockStrategy1)
      expect(strategies).toContain(mockStrategy2)
    })

    it("should return empty array for unsupported content type", () => {
      const strategies = registry.findStrategiesForContentType("image/png")

      expect(strategies).toHaveLength(0)
    })
  })

  describe("content type aggregation", () => {
    beforeEach(() => {
      registry.register(mockStrategy1)
      registry.register(mockStrategy2)
      registry.register(mockStrategy3)
    })

    it("should get all supported content types", () => {
      const contentTypes = registry.getSupportedContentTypes()

      expect(contentTypes).toHaveLength(4)
      expect(contentTypes).toContain("application/json")
      expect(contentTypes).toContain("application/xhtml+xml")
      expect(contentTypes).toContain("text/html")
      expect(contentTypes).toContain("text/plain")
    })

    it("should return sorted content types", () => {
      const contentTypes = registry.getSupportedContentTypes()

      expect(contentTypes).toEqual([...contentTypes].sort())
    })
  })

  describe("registry management", () => {
    beforeEach(() => {
      registry.register(mockStrategy1)
      registry.register(mockStrategy2)
    })

    it("should clear all strategies", () => {
      registry.clear()

      expect(registry.getStrategyCount()).toBe(0)
      expect(registry.getAllStrategies()).toHaveLength(0)
      expect(mockLogger.debug).toHaveBeenCalledWith("Cleared 2 registered strategies")
    })

    it("should get registry information", () => {
      const info = registry.getRegistryInfo()

      expect(info).toHaveLength(2)
      expect(info[0]).toEqual({
        name: "HTMLConverter",
        supportedTypes: ["text/html", "application/xhtml+xml"],
        outputFormat: "text/html",
      })
      expect(info[1]).toEqual({
        name: "PDFConverter",
        supportedTypes: ["text/html"],
        outputFormat: "application/pdf",
      })
    })
  })
})
