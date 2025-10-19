import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ConversionResult, ConverterStrategy, Logger, ValidationResult } from "../strategies/types.js"

import { ConverterFactory, ConverterFactoryError } from "./ConverterFactory.js"

// Mock converter implementation for testing
class MockConverter implements ConverterStrategy {
  constructor(private name: string, private supportedTypes: string[] = ["text/html"]) {}

  async convert(_input: HTMLDocument): Promise<ConversionResult> {
    return {
      content: `<mock conversion by ${this.name}>`,
      mimeType: "text/plain",
      metadata: {
        sourceType: "text/html",
        targetFormat: "text/plain",
        timestamp: new Date(),
        size: 20,
      },
    }
  }

  validate(_input: HTMLDocument): ValidationResult {
    return {
      isValid: true,
      errors: [],
      warnings: [],
    }
  }

  canHandle(contentType: string): boolean {
    return this.supportedTypes.includes(contentType)
  }

  getName(): string {
    return this.name
  }

  getSupportedContentTypes(): string[] {
    return this.supportedTypes
  }

  getOutputFormat(): string {
    return "text/plain"
  }
}

// Mock logger for testing
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

describe("converterFactory", () => {
  let factory: ConverterFactory

  beforeEach(() => {
    vi.clearAllMocks()
    factory = new ConverterFactory(mockLogger)
  })

  describe("constructor", () => {
    it("should initialize with default config", () => {
      expect(factory).toBeInstanceOf(ConverterFactory)
      expect(mockLogger.debug).toHaveBeenCalledWith("ConverterFactory initialized", {
        strictValidation: true,
        defaultConverters: undefined,
      })
    })

    it("should initialize with custom config", () => {
      const config = {
        strictValidation: false,
        defaultConverters: ["mock-converter"],
        errorMessages: {
          unknownConverter: "Custom unknown converter message",
        },
      }

      const customFactory = new ConverterFactory(mockLogger, config)
      expect(customFactory).toBeInstanceOf(ConverterFactory)
      expect(mockLogger.debug).toHaveBeenCalledWith("ConverterFactory initialized", {
        strictValidation: false,
        defaultConverters: ["mock-converter"],
      })
    })
  })

  describe("registerConverter", () => {
    it("should register a converter successfully", () => {
      const factoryFn = (_logger: Logger) => new MockConverter("test-converter")

      factory.registerConverter("test-converter", factoryFn)

      expect(factory.hasConverter("test-converter")).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith("Registered converter factory: test-converter", {
        dependencies: undefined,
        enabled: true,
      })
    })

    it("should throw error for empty type", () => {
      const factoryFn = (_logger: Logger) => new MockConverter("test")

      expect(() => factory.registerConverter("", factoryFn)).toThrow(ConverterFactoryError)
      expect(() => factory.registerConverter("   ", factoryFn)).toThrow(ConverterFactoryError)
    })

    it("should throw error for invalid factory", () => {
      expect(() => factory.registerConverter("invalid", {} as any)).toThrow(ConverterFactoryError)
    })

    it("should register converter with dependencies", () => {
      process.env.TEST_VAR = "test-value"
      const factoryFn = (_logger: Logger) => new MockConverter("test-converter")
      const dependencies = ["env:TEST_VAR"]

      factory.registerConverter("test-converter", factoryFn, dependencies)

      expect(factory.getConverterInfo("test-converter")?.dependencies).toEqual(dependencies)

      delete process.env.TEST_VAR
    })
  })

  describe("createConverter", () => {
    beforeEach(() => {
      const factoryFn = (_logger: Logger) => new MockConverter("test-converter")
      factory.registerConverter("test-converter", factoryFn)
    })

    it("should create converter successfully", () => {
      const converter = factory.createConverter("test-converter")

      expect(converter).toBeInstanceOf(MockConverter)
      expect(converter.getName()).toBe("test-converter")
      expect(mockLogger.debug).toHaveBeenCalledWith("Creating converter instance: test-converter")
      expect(mockLogger.debug).toHaveBeenCalledWith("Successfully created converter: test-converter")
    })

    it("should throw error for unknown converter type", () => {
      expect(() => factory.createConverter("unknown")).toThrow(ConverterFactoryError)

      const error = (() => {
        try {
          factory.createConverter("unknown")
        } catch (e) {
          return e
        }
      })() as ConverterFactoryError

      expect(error.code).toBe("UNKNOWN_CONVERTER")
      expect(error.details?.type).toBe("unknown")
      expect(error.details?.availableTypes).toContain("test-converter")
    })

    it("should throw error for empty type", () => {
      expect(() => factory.createConverter("")).toThrow(ConverterFactoryError)
      expect(() => factory.createConverter("   ")).toThrow(ConverterFactoryError)
    })

    it("should create converter with dependencies", () => {
      process.env.TEST_VAR = "test-value"
      const factoryFn = (_logger: Logger) => new MockConverter("dep-converter")
      factory.registerConverter("dep-converter", factoryFn, ["env:TEST_VAR"])

      const converter = factory.createConverter("dep-converter")
      expect(converter.getName()).toBe("dep-converter")

      delete process.env.TEST_VAR
    })

    it("should throw error for missing environment dependency", () => {
      const factoryFn = (_logger: Logger) => new MockConverter("dep-converter")

      expect(() => factory.registerConverter("dep-converter", factoryFn, ["env:MISSING_VAR"])).toThrow(ConverterFactoryError)
    })

    it("should throw error if factory returns null", () => {
      const nullFactory = (_logger: Logger) => null as any
      factory.registerConverter("null-converter", nullFactory)

      expect(() => factory.createConverter("null-converter")).toThrow(ConverterFactoryError)
    })

    it("should throw error if factory throws", () => {
      const errorFactory = (_logger: Logger) => {
        throw new Error("Factory error")
      }
      factory.registerConverter("error-converter", errorFactory)

      expect(() => factory.createConverter("error-converter")).toThrow(ConverterFactoryError)
    })
  })

  describe("unregisterConverter", () => {
    beforeEach(() => {
      const factoryFn = (_logger: Logger) => new MockConverter("test-converter")
      factory.registerConverter("test-converter", factoryFn)
    })

    it("should unregister converter successfully", () => {
      factory.unregisterConverter("test-converter")

      expect(factory.hasConverter("test-converter")).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith("Unregistered converter factory: test-converter")
    })

    it("should log warning for non-existent converter", () => {
      factory.unregisterConverter("non-existent")

      expect(mockLogger.warn).toHaveBeenCalledWith("Attempted to unregister non-existent converter: non-existent")
    })

    it("should throw error for empty type", () => {
      expect(() => factory.unregisterConverter("")).toThrow(ConverterFactoryError)
      expect(() => factory.unregisterConverter("   ")).toThrow(ConverterFactoryError)
    })
  })

  describe("setConverterEnabled", () => {
    beforeEach(() => {
      const factoryFn = (_logger: Logger) => new MockConverter("test-converter")
      factory.registerConverter("test-converter", factoryFn)
    })

    it("should disable converter", () => {
      factory.setConverterEnabled("test-converter", false)

      expect(factory.hasConverter("test-converter")).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith("Disabled converter: test-converter")
    })

    it("should re-enable converter", () => {
      factory.setConverterEnabled("test-converter", false)
      factory.setConverterEnabled("test-converter", true)

      expect(factory.hasConverter("test-converter")).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith("Enabled converter: test-converter")
    })

    it("should throw error for unknown converter", () => {
      expect(() => factory.setConverterEnabled("unknown", false)).toThrow(ConverterFactoryError)
    })
  })

  describe("hasConverter", () => {
    beforeEach(() => {
      const factoryFn = (_logger: Logger) => new MockConverter("test-converter")
      factory.registerConverter("test-converter", factoryFn)
    })

    it("should return true for registered enabled converter", () => {
      expect(factory.hasConverter("test-converter")).toBe(true)
    })

    it("should return false for disabled converter", () => {
      factory.setConverterEnabled("test-converter", false)
      expect(factory.hasConverter("test-converter")).toBe(false)
    })

    it("should return false for unknown converter", () => {
      expect(factory.hasConverter("unknown")).toBe(false)
    })

    it("should return false for empty type", () => {
      expect(factory.hasConverter("")).toBe(false)
      expect(factory.hasConverter("   ")).toBe(false)
    })
  })

  describe("getRegisteredTypes", () => {
    it("should return empty array for no converters", () => {
      expect(factory.getRegisteredTypes()).toEqual([])
    })

    it("should return sorted array of registered types", () => {
      const factoryFn1 = (_logger: Logger) => new MockConverter("zebra")
      const factoryFn2 = (_logger: Logger) => new MockConverter("alpha")
      const factoryFn3 = (_logger: Logger) => new MockConverter("beta")

      factory.registerConverter("zebra", factoryFn1)
      factory.registerConverter("alpha", factoryFn2)
      factory.registerConverter("beta", factoryFn3)

      expect(factory.getRegisteredTypes()).toEqual(["alpha", "beta", "zebra"])
    })
  })

  describe("getEnabledTypes", () => {
    beforeEach(() => {
      factory.registerConverter("enabled1", (_logger: Logger) => new MockConverter("enabled1"))
      factory.registerConverter("enabled2", (_logger: Logger) => new MockConverter("enabled2"))
      factory.registerConverter("disabled", (_logger: Logger) => new MockConverter("disabled"))
      factory.setConverterEnabled("disabled", false)
    })

    it("should return only enabled types", () => {
      const enabledTypes = factory.getEnabledTypes()
      expect(enabledTypes).toEqual(["enabled1", "enabled2"])
      expect(enabledTypes).not.toContain("disabled")
    })

    it("should return sorted array", () => {
      factory.registerConverter("zebra", (_logger: Logger) => new MockConverter("zebra"))
      factory.registerConverter("alpha", (_logger: Logger) => new MockConverter("alpha"))

      const enabledTypes = factory.getEnabledTypes()
      expect(enabledTypes).toEqual(["alpha", "enabled1", "enabled2", "zebra"])
    })
  })

  describe("getConverterInfo", () => {
    beforeEach(() => {
      const factoryFn = (_logger: Logger) => new MockConverter("test-converter")
      factory.registerConverter("test-converter", factoryFn, ["dep1", "dep2"])
    })

    it("should return converter info", () => {
      const info = factory.getConverterInfo("test-converter")

      expect(info).toEqual({
        type: "test-converter",
        enabled: true,
        dependencies: ["dep1", "dep2"],
        registeredAt: expect.any(Date),
      })
    })

    it("should return undefined for unknown converter", () => {
      expect(factory.getConverterInfo("unknown")).toBeUndefined()
    })
  })

  describe("getAllConverterInfo", () => {
    beforeEach(() => {
      factory.registerConverter("converter1", (_logger: Logger) => new MockConverter("converter1"))
      factory.registerConverter("converter2", (_logger: Logger) => new MockConverter("converter2"), ["dep1"])
      factory.setConverterEnabled("converter2", false)
    })

    it("should return info for all converters", () => {
      const allInfo = factory.getAllConverterInfo()

      expect(allInfo).toHaveLength(2)
      expect(allInfo[0]).toEqual({
        type: "converter1",
        enabled: true,
        dependencies: [],
        registeredAt: expect.any(Date),
      })
      expect(allInfo[1]).toEqual({
        type: "converter2",
        enabled: false,
        dependencies: ["dep1"],
        registeredAt: expect.any(Date),
      })
    })
  })

  describe("clear", () => {
    beforeEach(() => {
      factory.registerConverter("converter1", (_logger: Logger) => new MockConverter("converter1"))
      factory.registerConverter("converter2", (_logger: Logger) => new MockConverter("converter2"))
    })

    it("should clear all converters", () => {
      factory.clear()

      expect(factory.getRegisteredTypes()).toEqual([])
      expect(mockLogger.debug).toHaveBeenCalledWith("Cleared 2 registered converter factories")
    })
  })

  describe("createDefaultConverters", () => {
    it("should return empty array when no default converters configured", () => {
      const converters = factory.createDefaultConverters()
      expect(converters).toEqual([])
      expect(mockLogger.debug).toHaveBeenCalledWith("No default converters configured")
    })

    it("should create default converters successfully", () => {
      const config = { defaultConverters: ["converter1", "converter2"] }
      const configFactory = new ConverterFactory(mockLogger, config)

      configFactory.registerConverter("converter1", (_logger: Logger) => new MockConverter("converter1"))
      configFactory.registerConverter("converter2", (_logger: Logger) => new MockConverter("converter2"))

      const converters = configFactory.createDefaultConverters()

      expect(converters).toHaveLength(2)
      expect(converters[0].getName()).toBe("converter1")
      expect(converters[1].getName()).toBe("converter2")
    })

    it("should handle missing default converter in non-strict mode", () => {
      const config = { defaultConverters: ["converter1", "missing"], strictValidation: false }
      const configFactory = new ConverterFactory(mockLogger, config)

      configFactory.registerConverter("converter1", (_logger: Logger) => new MockConverter("converter1"))

      const converters = configFactory.createDefaultConverters()

      expect(converters).toHaveLength(1)
      expect(converters[0].getName()).toBe("converter1")
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to create default converter 'missing':",
        expect.any(Error),
      )
    })

    it("should throw error for missing default converter in strict mode", () => {
      const config = { defaultConverters: ["converter1", "missing"], strictValidation: true }
      const configFactory = new ConverterFactory(mockLogger, config)

      configFactory.registerConverter("converter1", (_logger: Logger) => new MockConverter("converter1"))

      expect(() => configFactory.createDefaultConverters()).toThrow(ConverterFactoryError)
    })
  })

  describe("converterFactoryError", () => {
    it("should create error with code and details", () => {
      const details = { type: "test", additional: "info" }
      const error = new ConverterFactoryError("Test message", "TEST_CODE", details)

      expect(error.name).toBe("ConverterFactoryError")
      expect(error.message).toBe("Test message")
      expect(error.code).toBe("TEST_CODE")
      expect(error.details).toEqual(details)
    })
  })
})
