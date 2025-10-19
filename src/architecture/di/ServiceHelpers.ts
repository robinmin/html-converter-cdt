import type { ConverterFactory } from "../factories/ConverterFactory.js"
import type { Logger } from "../strategies/types.js"

import { DIContainer } from "./DIContainer.js"
import type { ServiceFactory } from "./types.js"
import { ServiceLifetime } from "./types.js"

/**
 * Common service tokens used throughout the application
 */
export const ServiceTokens = {
  /** Logger service */
  Logger: "Logger",
  /** Converter factory service */
  ConverterFactory: "ConverterFactory",
  /** Configuration service */
  Configuration: "Configuration",
  /** Event manager service */
  EventManager: "EventManager",
  /** Connection pool service */
  ConnectionPool: "ConnectionPool",
  /** Target manager service */
  TargetManager: "TargetManager",
  /** Resource manager service */
  ResourceManager: "ResourceManager",
  /** Environment detector service */
  EnvironmentDetector: "EnvironmentDetector",
  /** CDP client service */
  CDPClient: "CDPClient",
} as const

export type ServiceToken = typeof ServiceTokens[keyof typeof ServiceTokens]

/**
 * Service registration helpers for common converter dependencies
 */
export class ServiceHelpers {
  /**
   * Register a logger service
   * @param container - DI container instance
   * @param logger - Logger instance or factory
   */
  static registerLogger(container: DIContainer, logger: Logger | ServiceFactory): void {
    if (typeof logger === "function") {
      container.registerSingleton(ServiceTokens.Logger, logger)
    } else {
      container.registerInstance(ServiceTokens.Logger, logger)
    }
  }

  /**
   * Register a converter factory service
   * @param container - DI container instance
   * @param factory - ConverterFactory instance or factory
   */
  static registerConverterFactory(
    container: DIContainer,
    factory: ConverterFactory | ServiceFactory,
  ): void {
    if (typeof factory === "function") {
      container.registerSingleton(ServiceTokens.ConverterFactory, factory, {
        dependencies: [ServiceTokens.Logger],
      })
    } else {
      container.registerInstance(ServiceTokens.ConverterFactory, factory)
    }
  }

  /**
   * Register configuration service
   * @param container - DI container instance
   * @param config - Configuration object or factory
   */
  static registerConfiguration<T = Record<string, any>>(
    container: DIContainer,
    config: T | ServiceFactory,
  ): void {
    if (typeof config === "function") {
      container.registerSingleton(ServiceTokens.Configuration, config)
    } else {
      container.registerInstance(ServiceTokens.Configuration, config)
    }
  }

  /**
   * Register converter dependencies with default implementations
   * @param container - DI container instance
   * @param logger - Logger instance (required)
   * @param config - Optional configuration
   */
  static registerConverterDependencies(
    container: DIContainer,
    logger: Logger,
    config?: Record<string, any>,
  ): void {
    // Register logger (required dependency)
    this.registerLogger(container, logger)

    // Register configuration if provided
    if (config) {
      this.registerConfiguration(container, config)
    }

    // Register default implementations for CDP services
    this.registerCDPServices(container)
  }

  /**
   * Register CDP-related services
   * Note: This method is a placeholder for future CDP service registration
   * @param container - DI container instance
   */
  static registerCDPServices(container: DIContainer): void {
    // CDP services will be registered when their implementations are available
    // For now, we'll register placeholder factories that can be overridden
    container.registerSingleton(ServiceTokens.EventManager, () => {
      throw new Error("EventManager not yet implemented in DI container")
    }, {
      dependencies: [ServiceTokens.Logger],
    })

    container.registerSingleton(ServiceTokens.ConnectionPool, () => {
      throw new Error("ConnectionPool not yet implemented in DI container")
    }, {
      dependencies: [ServiceTokens.Logger, ServiceTokens.Configuration],
    })

    container.registerSingleton(ServiceTokens.TargetManager, () => {
      throw new Error("TargetManager not yet implemented in DI container")
    }, {
      dependencies: [ServiceTokens.Logger],
    })

    container.registerSingleton(ServiceTokens.ResourceManager, () => {
      throw new Error("ResourceManager not yet implemented in DI container")
    }, {
      dependencies: [ServiceTokens.Logger],
    })

    container.registerTransient(ServiceTokens.CDPClient, () => {
      throw new Error("CDPClient not yet implemented in DI container")
    }, {
      dependencies: [ServiceTokens.Logger, ServiceTokens.EventManager],
    })

    container.registerSingleton(ServiceTokens.EnvironmentDetector, () => {
      throw new Error("EnvironmentDetector not yet implemented in DI container")
    }, {
      dependencies: [ServiceTokens.Logger],
    })
  }

  /**
   * Create a container with all common services pre-registered
   * @param logger - Logger instance (required)
   * @param config - Optional configuration
   * @param customServices - Custom service registrations
   * @returns Configured DI container
   */
  static createConfiguredContainer(
    logger: Logger,
    config?: Record<string, any>,
    customServices?: Array<{
      token: string
      factory: ServiceFactory
      lifetime?: ServiceLifetime
      dependencies?: string[]
    }>,
  ): DIContainer {
    const container = new DIContainer()

    // Register common dependencies
    this.registerConverterDependencies(container, logger, config)

    // Register custom services
    if (customServices) {
      for (const service of customServices) {
        container.register(
          service.token,
          service.factory,
          {
            lifetime: service.lifetime || ServiceLifetime.Transient,
            dependencies: service.dependencies,
          },
        )
      }
    }

    return container
  }

  /**
   * Register a converter strategy with dependencies
   * @param container - DI container instance
   * @param token - Service token for the converter
   * @param converterFactory - Factory function for the converter
   * @param dependencies - Optional dependencies
   */
  static registerConverterStrategy(
    container: DIContainer,
    token: string,
    converterFactory: (logger: Logger, ...deps: any[]) => any,
    dependencies: string[] = [],
  ): void {
    container.registerTransient(token, (container) => {
      const logger = container.resolve<Logger>(ServiceTokens.Logger)
      const deps = dependencies.map(dep => container.resolve(dep))
      return converterFactory(logger, ...deps)
    }, {
      dependencies: [ServiceTokens.Logger, ...dependencies],
    })
  }

  /**
   * Get all required dependencies for a converter
   * @param converterType - Type of converter
   * @returns Array of required service tokens
   */
  static getConverterDependencies(converterType: string): string[] {
    const baseDependencies = [ServiceTokens.Logger]

    switch (converterType) {
      case "markdown":
      case "html":
        return baseDependencies
      case "pdf":
      case "docx":
        return [...baseDependencies, ServiceTokens.Configuration]
      case "image":
        return [...baseDependencies, ServiceTokens.EnvironmentDetector]
      default:
        return baseDependencies
    }
  }
}
