import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Logger } from "../strategies/types.js"

import {
  CircularDependencyError,
  DIContainer,
  DIContainerError,
  ServiceHelpers,
  ServiceLifetime,
  ServiceTokens,
} from "./index.js"

// Mock logger for testing
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

describe("dIContainer", () => {
  let container: DIContainer

  beforeEach(() => {
    container = new DIContainer()
    vi.clearAllMocks()
  })

  afterEach(() => {
    container.clear()
  })

  describe("basic Registration and Resolution", () => {
    it("should register and resolve a simple service", () => {
      const mockService = { name: "test" }
      container.register("TestService", () => mockService)

      const resolved = container.resolve("TestService")
      expect(resolved).toBe(mockService)
    })

    it("should register and resolve a singleton service", () => {
      let callCount = 0
      container.registerSingleton("Counter", () => {
        callCount++
        return { count: callCount }
      })

      const first = container.resolve("Counter")
      const second = container.resolve("Counter")

      expect(first).toBe(second)
      expect(first.count).toBe(1)
      expect(callCount).toBe(1)
    })

    it("should register and resolve a transient service", () => {
      let callCount = 0
      container.registerTransient("Counter", () => {
        callCount++
        return { count: callCount }
      })

      const first = container.resolve("Counter")
      const second = container.resolve("Counter")

      expect(first).not.toBe(second)
      expect(first.count).toBe(1)
      expect(second.count).toBe(2)
      expect(callCount).toBe(2)
    })

    it("should register and resolve an instance", () => {
      const instance = { name: "instance" }
      container.registerInstance("InstanceService", instance)

      const resolved = container.resolve("InstanceService")
      expect(resolved).toBe(instance)
    })

    it("should throw error when registering with invalid token", () => {
      expect(() => {
        container.register("", () => ({}))
      }).toThrow(DIContainerError)

      expect(() => {
        container.register("   ", () => ({}))
      }).toThrow(DIContainerError)
    })

    it("should throw error when registering with invalid factory", () => {
      expect(() => {
        container.register("Test", "not a function" as any)
      }).toThrow(DIContainerError)
    })

    it("should throw error when service is not registered", () => {
      expect(() => {
        container.resolve("NonExistent")
      }).toThrow(DIContainerError)
    })

    it("should replace existing service when replace option is true", () => {
      container.register("Test", () => ({ version: 1 }))
      container.register("Test", () => ({ version: 2 }), { replace: true })

      const resolved = container.resolve("Test")
      expect(resolved.version).toBe(2)
    })

    it("should throw error when registering existing service without replace", () => {
      container.register("Test", () => ({ version: 1 }))

      expect(() => {
        container.register("Test", () => ({ version: 2 }))
      }).toThrow(DIContainerError)
    })
  })

  describe("dependency Resolution", () => {
    it("should resolve simple dependencies", () => {
      container.registerSingleton("Database", () => ({ name: "test-db" }))
      container.registerSingleton("UserService", (container) => {
        const db = container.resolve("Database")
        return { db, name: "user-service" }
      })

      const userService = container.resolve("UserService")
      expect(userService.db.name).toBe("test-db")
      expect(userService.name).toBe("user-service")
    })

    it("should resolve complex dependency chains", () => {
      container.registerSingleton("Config", () => ({ apiUrl: "http://test.com" }))
      container.registerSingleton("Database", (container) => {
        const config = container.resolve("Config")
        return { name: "db", url: config.apiUrl }
      })
      container.registerSingleton("Repository", (container) => {
        const db = container.resolve("Database")
        return { db, name: "repository" }
      })
      container.registerSingleton("Service", (container) => {
        const repo = container.resolve("Repository")
        return { repo, name: "service" }
      })

      const service = container.resolve("Service")
      expect(service.repo.db.url).toBe("http://test.com")
      expect(service.name).toBe("service")
    })

    it("should resolve dependencies specified in options", () => {
      container.registerSingleton("Database", () => ({ name: "test-db" }))
      container.registerSingleton("Cache", () => ({ name: "test-cache" }))
      container.registerSingleton(
        "UserService",
        (container) => {
          const db = container.resolve("Database")
          const cache = container.resolve("Cache")
          return { db, cache, name: "user-service" }
        },
        { dependencies: ["Database", "Cache"] },
      )

      const userService = container.resolve("UserService")
      expect(userService.db.name).toBe("test-db")
      expect(userService.cache.name).toBe("test-cache")
    })
  })

  describe("circular Dependency Detection", () => {
    it("should detect simple circular dependencies", () => {
      container.registerSingleton("A", (container) => {
        const b = container.resolve("B")
        return { name: "A", dep: b }
      })
      container.registerSingleton("B", (container) => {
        const a = container.resolve("A")
        return { name: "B", dep: a }
      })

      expect(() => {
        container.resolve("A")
      }).toThrow(CircularDependencyError)
    })

    it("should detect complex circular dependencies", () => {
      container.registerSingleton("A", (container) => {
        const b = container.resolve("B")
        return { name: "A", dep: b }
      })
      container.registerSingleton("B", (container) => {
        const c = container.resolve("C")
        return { name: "B", dep: c }
      })
      container.registerSingleton("C", (container) => {
        const a = container.resolve("A")
        return { name: "C", dep: a }
      })

      expect(() => {
        container.resolve("A")
      }).toThrow(CircularDependencyError)
    })

    it("should work fine with non-circular dependencies", () => {
      container.registerSingleton("A", (container) => {
        const b = container.resolve("B")
        return { name: "A", dep: b }
      })
      container.registerSingleton("B", (container) => {
        const c = container.resolve("C")
        return { name: "B", dep: c }
      })
      container.registerSingleton("C", () => ({ name: "C" }))

      expect(() => {
        const a = container.resolve("A")
        expect(a.dep.dep.name).toBe("C")
      }).not.toThrow()
    })

    it("should allow disabling circular dependency detection", () => {
      const containerNoDetection = new DIContainer({
        enableCircularDependencyDetection: false,
      })

      containerNoDetection.registerSingleton("A", (container) => {
        const b = container.resolve("B")
        return { name: "A", dep: b }
      })
      containerNoDetection.registerSingleton("B", (container) => {
        const a = container.resolve("A")
        return { name: "B", dep: a }
      })

      // This should work but might cause infinite recursion in real scenarios
      // For test purposes, we'll just check it doesn't throw CircularDependencyError
      expect(() => {
        containerNoDetection.resolve("A")
      }).not.toThrow(CircularDependencyError)
    })
  })

  describe("container Management", () => {
    it("should check if service is registered", () => {
      container.register("Test", () => ({}))

      expect(container.isRegistered("Test")).toBe(true)
      expect(container.isRegistered("NonExistent")).toBe(false)
    })

    it("should get registered tokens", () => {
      container.register("C", () => ({}))
      container.register("A", () => ({}))
      container.register("B", () => ({}))

      const tokens = container.getRegisteredTokens()
      expect(tokens).toEqual(["A", "B", "C"])
    })

    it("should get service info", () => {
      container.registerSingleton("Test", () => ({}), {
        dependencies: ["Dep1", "Dep2"],
      })

      const info = container.getServiceInfo("Test")
      expect(info).toEqual({
        token: "Test",
        lifetime: ServiceLifetime.Singleton,
        dependencies: ["Dep1", "Dep2"],
        registeredAt: expect.any(Date),
        hasInstance: false,
      })
    })

    it("should get all service info", () => {
      container.registerSingleton("Service1", () => ({}))
      container.registerTransient("Service2", () => ({}))

      const allInfo = container.getAllServiceInfo()
      expect(allInfo).toHaveLength(2)
      expect(allInfo[0].lifetime).toBe(ServiceLifetime.Singleton)
      expect(allInfo[1].lifetime).toBe(ServiceLifetime.Transient)
    })

    it("should unregister services", () => {
      container.register("Test", () => ({}))
      expect(container.isRegistered("Test")).toBe(true)

      container.unregister("Test")
      expect(container.isRegistered("Test")).toBe(false)
    })

    it("should clear all services", () => {
      container.register("Test1", () => ({}))
      container.register("Test2", () => ({}))
      expect(container.getRegisteredTokens()).toHaveLength(2)

      container.clear()
      expect(container.getRegisteredTokens()).toHaveLength(0)
    })

    it("should create child container", () => {
      container.registerSingleton("Parent", () => ({ name: "parent" }))

      const child = container.createChild()
      child.registerSingleton("Child", () => ({ name: "child" }))

      expect(child.resolve("Parent").name).toBe("parent")
      expect(child.resolve("Child").name).toBe("child")
      expect(container.isRegistered("Child")).toBe(false)
    })
  })

  describe("error Handling", () => {
    it("should throw error when factory returns null", () => {
      container.register("NullService", () => null)

      expect(() => {
        container.resolve("NullService")
      }).toThrow(DIContainerError)
    })

    it("should throw error when factory returns undefined", () => {
      container.register("UndefinedService", () => undefined)

      expect(() => {
        container.resolve("UndefinedService")
      }).toThrow(DIContainerError)
    })

    it("should throw error when registering null instance", () => {
      expect(() => {
        container.registerInstance("NullInstance", null as any)
      }).toThrow(DIContainerError)
    })

    it("should respect max resolution depth", () => {
      const shallowContainer = new DIContainer({ maxResolutionDepth: 3 })

      shallowContainer.registerSingleton("A", (container) => {
        return container.resolve("B")
      })
      shallowContainer.registerSingleton("B", (container) => {
        return container.resolve("C")
      })
      shallowContainer.registerSingleton("C", (container) => {
        return container.resolve("D")
      })

      expect(() => {
        shallowContainer.resolve("A")
      }).toThrow(DIContainerError)
    })

    it("should handle tryResolve gracefully", () => {
      container.register("Test", () => ({ name: "test" }))

      const existing = container.tryResolve("Test")
      const nonExistent = container.tryResolve("NonExistent")

      expect(existing?.name).toBe("test")
      expect(nonExistent).toBeUndefined()
    })
  })
})

describe("serviceHelpers", () => {
  let container: DIContainer

  beforeEach(() => {
    container = new DIContainer()
  })

  afterEach(() => {
    container.clear()
  })

  describe("logger Registration", () => {
    it("should register logger instance", () => {
      ServiceHelpers.registerLogger(container, mockLogger)

      const resolved = container.resolve(ServiceTokens.Logger)
      expect(resolved).toBe(mockLogger)
    })

    it("should register logger factory", () => {
      ServiceHelpers.registerLogger(container, () => mockLogger)

      const resolved = container.resolve(ServiceTokens.Logger)
      expect(resolved).toBe(mockLogger)
    })
  })

  describe("configuration Registration", () => {
    it("should register configuration instance", () => {
      const config = { apiUrl: "http://test.com" }
      ServiceHelpers.registerConfiguration(container, config)

      const resolved = container.resolve(ServiceTokens.Configuration)
      expect(resolved).toBe(config)
    })

    it("should register configuration factory", () => {
      const config = { apiUrl: "http://test.com" }
      ServiceHelpers.registerConfiguration(container, () => config)

      const resolved = container.resolve(ServiceTokens.Configuration)
      expect(resolved).toBe(config)
    })
  })

  describe("converter Dependencies Registration", () => {
    it("should register basic converter dependencies", () => {
      ServiceHelpers.registerConverterDependencies(container, mockLogger)

      expect(container.isRegistered(ServiceTokens.Logger)).toBe(true)
      expect(container.isRegistered(ServiceTokens.Configuration)).toBe(false) // Not provided
    })

    it("should register converter dependencies with config", () => {
      const config = { apiUrl: "http://test.com" }
      ServiceHelpers.registerConverterDependencies(container, mockLogger, config)

      expect(container.isRegistered(ServiceTokens.Logger)).toBe(true)
      expect(container.isRegistered(ServiceTokens.Configuration)).toBe(true)
    })
  })

  describe("cDP Services Registration", () => {
    it("should register placeholder CDP services", () => {
      ServiceHelpers.registerCDPServices(container)

      expect(container.isRegistered(ServiceTokens.EventManager)).toBe(true)
      expect(container.isRegistered(ServiceTokens.ConnectionPool)).toBe(true)
      expect(container.isRegistered(ServiceTokens.TargetManager)).toBe(true)
      expect(container.isRegistered(ServiceTokens.ResourceManager)).toBe(true)
      expect(container.isRegistered(ServiceTokens.CDPClient)).toBe(true)
      expect(container.isRegistered(ServiceTokens.EnvironmentDetector)).toBe(true)
    })

    it("should throw errors when resolving placeholder CDP services", () => {
      // Register logger first since CDP services depend on it
      ServiceHelpers.registerLogger(container, mockLogger)
      ServiceHelpers.registerCDPServices(container)

      expect(() => {
        container.resolve(ServiceTokens.EventManager)
      }).toThrow("EventManager not yet implemented in DI container")
    })
  })

  describe("configured Container Creation", () => {
    it("should create configured container with logger", () => {
      const configuredContainer = ServiceHelpers.createConfiguredContainer(mockLogger)

      expect(configuredContainer.isRegistered(ServiceTokens.Logger)).toBe(true)
      expect(configuredContainer.resolve(ServiceTokens.Logger)).toBe(mockLogger)
    })

    it("should create configured container with logger and config", () => {
      const config = { apiUrl: "http://test.com" }
      const configuredContainer = ServiceHelpers.createConfiguredContainer(mockLogger, config)

      expect(configuredContainer.isRegistered(ServiceTokens.Logger)).toBe(true)
      expect(configuredContainer.isRegistered(ServiceTokens.Configuration)).toBe(true)
      expect(configuredContainer.resolve(ServiceTokens.Configuration)).toBe(config)
    })

    it("should create configured container with custom services", () => {
      const customServices = [
        {
          token: "CustomService",
          factory: () => ({ name: "custom" }),
          lifetime: ServiceLifetime.Singleton,
        },
      ]

      const configuredContainer = ServiceHelpers.createConfiguredContainer(
        mockLogger,
        undefined,
        customServices,
      )

      expect(configuredContainer.isRegistered("CustomService")).toBe(true)
      expect(configuredContainer.resolve("CustomService")).toEqual({ name: "custom" })
    })
  })

  describe("converter Strategy Registration", () => {
    it("should register converter strategy with dependencies", () => {
      const converterFactory = (logger: Logger, config: any) => ({
        logger,
        config,
        name: "test-converter",
      })

      ServiceHelpers.registerConverterStrategy(
        container,
        "TestConverter",
        converterFactory,
        [ServiceTokens.Configuration],
      )

      expect(container.isRegistered("TestConverter")).toBe(true)
    })
  })

  describe("converter Dependencies Helper", () => {
    it("should return base dependencies for simple converters", () => {
      const deps = ServiceHelpers.getConverterDependencies("markdown")
      expect(deps).toEqual([ServiceTokens.Logger])
    })

    it("should return extended dependencies for complex converters", () => {
      const pdfDeps = ServiceHelpers.getConverterDependencies("pdf")
      expect(pdfDeps).toEqual([ServiceTokens.Logger, ServiceTokens.Configuration])

      const imageDeps = ServiceHelpers.getConverterDependencies("image")
      expect(imageDeps).toEqual([ServiceTokens.Logger, ServiceTokens.EnvironmentDetector])
    })
  })
})
