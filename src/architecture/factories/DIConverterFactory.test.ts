import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DIContainer } from "../di/index.js"
import { ServiceHelpers, ServiceTokens } from "../di/index.js"
import type { ConverterStrategy, Logger } from "../strategies/types.js"

import type { DIFactoryConfig } from "./DIConverterFactory.js"
import { DIConverterFactory } from "./DIConverterFactory.js"

// Mock logger for testing
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Mock converter strategy for testing
const createMockConverter = (name: string): ConverterStrategy => ({
  convert: vi.fn().mockResolvedValue({
    content: `converted-${name}`,
    mimeType: `text/${name}`,
    metadata: {
      sourceType: "text/html",
      targetFormat: name,
      timestamp: new Date(),
      size: 10,
    },
  }),
  validate: vi.fn().mockReturnValue({
    isValid: true,
    errors: [],
    warnings: [],
  }),
  canHandle: vi.fn().mockReturnValue(true),
  getName: () => name,
  getSupportedContentTypes: () => ["text/html"],
  getOutputFormat: () => `text/${name}`,
})

describe("dIConverterFactory", () => {
  let container: DIContainer
  let factory: DIConverterFactory
  let config: DIFactoryConfig

  beforeEach(() => {
    container = ServiceHelpers.createConfiguredContainer(mockLogger, { test: true })
    config = {
      container,
      strictValidation: true,
      enableAutoDI: false,
    }
    factory = new DIConverterFactory(mockLogger, config)
    vi.clearAllMocks()
  })

  afterEach(() => {
    container.clear()
    factory.clear()
  })

  describe("basic Registration and Creation", () => {
    it("should register and create a simple converter", () => {
      const mockConverter = createMockConverter("test")
      factory.registerConverter("test", _logger => mockConverter)

      const created = factory.createConverter("test")
      expect(created).toBe(mockConverter)
      expect(created.getName()).toBe("test")
    })

    it("should register and create a DI converter", () => {
      const mockConverter = createMockConverter("di-test")
      factory.registerDIConverter("di-test", (container) => {
        const logger = container.resolve(ServiceTokens.Logger)
        const config = container.resolve(ServiceTokens.Configuration)
        return {
          ...mockConverter,
          logger,
          config,
        }
      })

      const created = factory.createDIConverter("di-test")
      expect(created.getName()).toBe("di-test")
      expect((created as any).logger).toBe(mockLogger)
      expect((created as any).config).toEqual({ test: true })
    })

    it("should throw error for unknown converter type", () => {
      expect(() => {
        factory.createConverter("unknown")
      }).toThrow("Unknown converter type: 'unknown'. Available types: ")
    })

    it("should throw error for empty converter type", () => {
      expect(() => {
        factory.createConverter("")
      }).toThrow("Converter type must be a non-empty string")
    })

    it("should throw error for disabled converter", () => {
      factory.registerConverter("test", () => createMockConverter("test"))
      factory.setConverterEnabled("test", false)

      expect(() => {
        factory.createConverter("test")
      }).toThrow("Converter 'test' is disabled")
    })
  })

  describe("dI Integration", () => {
    it("should resolve dependencies from DI container", () => {
      const mockConverter = createMockConverter("dep-test")
      let resolvedLogger: Logger | undefined
      let resolvedConfig: any

      factory.registerDIConverter("dep-test", (container) => {
        resolvedLogger = container.resolve(ServiceTokens.Logger)
        resolvedConfig = container.resolve(ServiceTokens.Configuration)
        return mockConverter
      })

      const created = factory.createDIConverter("dep-test")
      expect(resolvedLogger).toBe(mockLogger)
      expect(resolvedConfig).toEqual({ test: true })
      expect(created).toBe(mockConverter)
    })

    it("should throw error when DI dependency is missing", () => {
      factory.registerDIConverter("missing-dep", (container) => {
        container.resolve("NonExistentService")
        return createMockConverter("missing-dep")
      }, ["NonExistentService"])

      expect(() => {
        factory.createDIConverter("missing-dep")
      }).toThrow("Dependency 'NonExistentService' not found in DI container")
    })

    it("should auto-register dependencies when enableAutoDI is true", () => {
      const autoConfig = { ...config, enableAutoDI: true }
      const autoFactory = new DIConverterFactory(mockLogger, autoConfig)

      // Register a service in the main container
      container.registerSingleton("AutoService", () => ({ name: "auto-service" }))

      autoFactory.registerDIConverter("auto-test", (container) => {
        const service = container.resolve("AutoService")
        return {
          ...createMockConverter("auto-test"),
          service,
        }
      }, ["AutoService"])

      const created = autoFactory.createDIConverter("auto-test")
      expect((created as any).service.name).toBe("auto-service")
    })

    it("should fallback to regular creation when DI creation fails", () => {
      const mockConverter = createMockConverter("fallback")
      factory.registerConverter("fallback", _logger => mockConverter)

      // This should work because fallback is registered as a regular converter
      const created = factory.createDIConverter("fallback")
      expect(created).toBe(mockConverter)
    })
  })

  describe("converter Management", () => {
    it("should register multiple converters", () => {
      factory.registerConverter("type1", () => createMockConverter("type1"))
      factory.registerConverter("type2", () => createMockConverter("type2"))
      factory.registerDIConverter("type3", _container => createMockConverter("type3"))

      expect(factory.getRegisteredTypes()).toEqual(["type1", "type2", "type3"])
      expect(factory.getEnabledTypes()).toEqual(["type1", "type2", "type3"])
    })

    it("should check if converter exists", () => {
      factory.registerConverter("exists", () => createMockConverter("exists"))

      expect(factory.hasConverter("exists")).toBe(true)
      expect(factory.hasConverter("nonexistent")).toBe(false)
    })

    it("should enable and disable converters", () => {
      factory.registerConverter("toggle", () => createMockConverter("toggle"))

      expect(factory.hasConverter("toggle")).toBe(true)

      factory.setConverterEnabled("toggle", false)
      expect(factory.hasConverter("toggle")).toBe(false)

      factory.setConverterEnabled("toggle", true)
      expect(factory.hasConverter("toggle")).toBe(true)
    })

    it("should unregister converters", () => {
      factory.registerConverter("remove", () => createMockConverter("remove"))
      expect(factory.hasConverter("remove")).toBe(true)

      factory.unregisterConverter("remove")
      expect(factory.hasConverter("remove")).toBe(false)
    })

    it("should clear all converters", () => {
      factory.registerConverter("keep1", () => createMockConverter("keep1"))
      factory.registerConverter("keep2", () => createMockConverter("keep2"))
      expect(factory.getRegisteredTypes()).toHaveLength(2)

      factory.clear()
      expect(factory.getRegisteredTypes()).toHaveLength(0)
    })

    it("should get converter info", () => {
      factory.registerConverter("info", () => createMockConverter("info"), ["dep1", "dep2"])

      const info = factory.getConverterInfo("info")
      expect(info).toEqual({
        type: "info",
        enabled: true,
        dependencies: ["dep1", "dep2"],
        registeredAt: expect.any(Date),
      })
    })

    it("should get all converter info", () => {
      factory.registerConverter("info1", () => createMockConverter("info1"))
      factory.registerConverter("info2", () => createMockConverter("info2"), ["dep"])

      const allInfo = factory.getAllConverterInfo()
      expect(allInfo).toHaveLength(2)
      expect(allInfo[0].type).toBe("info1")
      expect(allInfo[1].type).toBe("info2")
      expect(allInfo[1].dependencies).toEqual(["dep"])
    })

    it("should create default converters", () => {
      const defaultConfig = {
        ...config,
        defaultConverters: ["type1", "type2"],
      }
      const defaultFactory = new DIConverterFactory(mockLogger, defaultConfig)

      defaultFactory.registerConverter("type1", () => createMockConverter("type1"))
      defaultFactory.registerConverter("type2", () => createMockConverter("type2"))

      const converters = defaultFactory.createDefaultConverters()
      expect(converters).toHaveLength(2)
      expect(converters[0].getName()).toBe("type1")
      expect(converters[1].getName()).toBe("type2")
    })

    it("should handle missing default converters gracefully", () => {
      const defaultConfig = {
        ...config,
        defaultConverters: ["missing1", "existing"],
        strictValidation: false,
      }
      const defaultFactory = new DIConverterFactory(mockLogger, defaultConfig)

      defaultFactory.registerConverter("existing", () => createMockConverter("existing"))

      const converters = defaultFactory.createDefaultConverters()
      expect(converters).toHaveLength(1)
      expect(converters[0].getName()).toBe("existing")
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it("should throw error when default converters fail in strict mode", () => {
      const defaultConfig = {
        ...config,
        defaultConverters: ["missing"],
        strictValidation: true,
      }
      const defaultFactory = new DIConverterFactory(mockLogger, defaultConfig)

      expect(() => {
        defaultFactory.createDefaultConverters()
      }).toThrow("Failed to create required default converter 'missing'")
    })
  })

  describe("error Handling", () => {
    it("should throw error for invalid converter registration", () => {
      expect(() => {
        factory.registerConverter("", () => createMockConverter("invalid"))
      }).toThrow("Converter type must be a non-empty string")

      expect(() => {
        factory.registerConverter("invalid", "not a function" as any)
      }).toThrow("Factory must be a function")
    })

    it("should throw error for invalid DI converter registration", () => {
      expect(() => {
        factory.registerDIConverter("", _container => createMockConverter("invalid"))
      }).toThrow("Converter type must be a non-empty string")

      expect(() => {
        factory.registerDIConverter("invalid", "not a function" as any)
      }).toThrow("Factory must be a function")
    })

    it("should throw error when factory returns null", () => {
      factory.registerConverter("null", () => null as any)

      expect(() => {
        factory.createConverter("null")
      }).toThrow("Invalid converter factory for type: 'null'")
    })

    it("should throw error when converter is missing required methods", () => {
      const incompleteConverter = {
        convert: vi.fn(),
        // Missing other required methods
      }

      factory.registerConverter("incomplete", () => incompleteConverter as any)

      expect(() => {
        factory.createConverter("incomplete")
      }).toThrow("Converter 'incomplete' is missing required method")
    })

    it("should throw error when getName returns empty string", () => {
      const invalidConverter = {
        convert: vi.fn(),
        validate: vi.fn(),
        canHandle: vi.fn(),
        getName: () => "",
        getSupportedContentTypes: vi.fn(),
        getOutputFormat: vi.fn(),
      }

      factory.registerConverter("invalid-name", () => invalidConverter)

      expect(() => {
        factory.createConverter("invalid-name")
      }).toThrow("Converter 'invalid-name' getName() returned empty string")
    })

    it("should wrap creation errors properly", () => {
      factory.registerConverter("error", () => {
        throw new Error("Creation failed")
      })

      expect(() => {
        factory.createConverter("error")
      }).toThrow("Failed to create converter 'error': Creation failed")
    })

    it("should wrap DI creation errors properly", () => {
      factory.registerDIConverter("di-error", () => {
        throw new Error("DI creation failed")
      })

      expect(() => {
        factory.createDIConverter("di-error")
      }).toThrow("Failed to create converter 'di-error': DI creation failed")
    })
  })

  describe("container Integration", () => {
    it("should provide access to DI container", () => {
      const containerAccess = factory.getContainer()
      expect(containerAccess).toBe(container)
    })

    it("should validate dependencies against DI container", () => {
      // Register a converter with non-existent dependencies
      factory.registerConverter("missing-deps", () => createMockConverter("missing-deps"), ["NonExistent"])

      // Should log warning but not throw error during registration
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Dependency 'NonExistent' not found in DI container"),
      )
    })
  })
})
