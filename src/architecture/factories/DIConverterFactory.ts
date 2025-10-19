import type { DIContainer } from "../di/index.js"
import type { ConverterStrategy, Logger } from "../strategies/types.js"

import type { ConverterFactoryFunction, ConverterRegistration, FactoryConfig } from "./ConverterFactory.js"
import { ConverterFactoryError } from "./ConverterFactory.js"

/**
 * DI-aware factory configuration that extends the base FactoryConfig
 */
export interface DIFactoryConfig extends FactoryConfig {
  /** DI container instance for dependency resolution */
  container: DIContainer
  /** Enable automatic dependency injection for converters */
  enableAutoDI?: boolean
}

/**
 * DI-aware converter factory that supports dependency injection
 * Integrates with the DI container to automatically resolve converter dependencies
 */
export class DIConverterFactory {
  private converters = new Map<string, ConverterRegistration>()
  private logger: Logger
  private config: DIFactoryConfig
  private container: DIContainer

  constructor(logger: Logger, config: DIFactoryConfig) {
    this.logger = logger
    this.config = config
    this.container = config.container

    this.logger.debug("DIConverterFactory initialized", {
      strictValidation: this.config.strictValidation,
      defaultConverters: this.config.defaultConverters,
      enableAutoDI: this.config.enableAutoDI,
    })
  }

  /**
   * Register a converter type with a factory function
   * @param type - Unique identifier for the converter type
   * @param factory - Factory function to create converter instances
   * @param dependencies - Optional dependencies required by this converter
   */
  registerConverter(
    type: string,
    factory: ConverterFactoryFunction,
    dependencies?: string[],
  ): void {
    if (!type || type.trim() === "") {
      throw new ConverterFactoryError(
        "Converter type must be a non-empty string",
        "INVALID_TYPE",
      )
    }

    if (typeof factory !== "function") {
      throw new ConverterFactoryError(
        "Factory must be a function",
        "INVALID_FACTORY",
        { type },
      )
    }

    const registration: ConverterRegistration = {
      factory,
      enabled: true,
      dependencies,
      registeredAt: new Date(),
    }

    // Validate dependencies if provided
    if (this.config.strictValidation && dependencies) {
      this.validateDependencies(type, dependencies)
    }

    this.converters.set(type, registration)
    this.logger.debug(`Registered converter factory: ${type}`, {
      dependencies,
      enabled: registration.enabled,
    })
  }

  /**
   * Register a converter with DI-enabled factory function
   * @param type - Unique identifier for the converter type
   * @param factory - DI-aware factory function
   * @param dependencies - Service tokens required by this converter
   */
  registerDIConverter(
    type: string,
    factory: (container: DIContainer) => ConverterStrategy,
    dependencies?: string[],
  ): void {
    if (!type || type.trim() === "") {
      throw new ConverterFactoryError(
        "Converter type must be a non-empty string",
        "INVALID_TYPE",
      )
    }

    if (typeof factory !== "function") {
      throw new ConverterFactoryError(
        "Factory must be a function",
        "INVALID_FACTORY",
        { type },
      )
    }

    const registration: ConverterRegistration = {
      factory: (logger: Logger) => {
        // Create a child container with the logger
        const childContainer = this.container.createChild()
        childContainer.registerInstance("Logger", logger, { replace: true })

        // Resolve converter using DI
        return factory(childContainer)
      },
      enabled: true,
      dependencies,
      registeredAt: new Date(),
    }

    this.converters.set(type, registration)
    this.logger.debug(`Registered DI converter factory: ${type}`, {
      dependencies,
      enabled: registration.enabled,
    })
  }

  /**
   * Create a converter instance of the specified type
   * @param type - Type of converter to create
   * @returns ConverterStrategy instance
   * @throws ConverterFactoryError if type is unknown or creation fails
   */
  createConverter(type: string): ConverterStrategy {
    if (!type || type.trim() === "") {
      throw new ConverterFactoryError(
        "Converter type must be a non-empty string",
        "EMPTY_TYPE",
      )
    }

    const registration = this.converters.get(type)
    if (!registration) {
      const availableTypes = Array.from(this.converters.keys()).sort()
      const message = this.config.errorMessages?.unknownConverter || "Unknown converter type: '{type}'. Available types: {available}"
      throw new ConverterFactoryError(
        message.replace("{type}", type).replace("{available}", availableTypes.join(", ")),
        "UNKNOWN_CONVERTER",
        { type, availableTypes },
      )
    }

    if (!registration.enabled) {
      throw new ConverterFactoryError(
        `Converter '${type}' is disabled`,
        "CONVERTER_DISABLED",
        { type },
      )
    }

    try {
      this.logger.debug(`Creating converter instance: ${type}`)

      // Validate dependencies before creation
      if (registration.dependencies) {
        this.validateDependencies(type, registration.dependencies)
      }

      const converter = registration.factory(this.logger)

      if (!converter) {
        const message = this.config.errorMessages?.invalidConverter || "Invalid converter factory for type: '{type}'"
        throw new ConverterFactoryError(
          message.replace("{type}", type),
          "INVALID_CONVERTER",
          { type },
        )
      }

      // Validate the created converter
      this.validateConverter(converter, type)

      this.logger.debug(`Successfully created converter: ${type}`)
      return converter
    } catch (error) {
      if (error instanceof ConverterFactoryError) {
        throw error
      }

      const wrappedError = new ConverterFactoryError(
        `Failed to create converter '${type}': ${error instanceof Error ? error.message : String(error)}`,
        "CREATION_FAILED",
        { type, originalError: error },
      )

      this.logger.error("Converter creation failed", wrappedError)
      throw wrappedError
    }
  }

  /**
   * Create a converter using DI with automatic dependency resolution
   * @param type - Type of converter to create
   * @returns ConverterStrategy instance
   */
  createDIConverter(type: string): ConverterStrategy {
    if (!type || type.trim() === "") {
      throw new ConverterFactoryError(
        "Converter type must be a non-empty string",
        "EMPTY_TYPE",
      )
    }

    const registration = this.converters.get(type)
    if (!registration) {
      const availableTypes = Array.from(this.converters.keys()).sort()
      const message = this.config.errorMessages?.unknownConverter || "Unknown converter type: '{type}'. Available types: {available}"
      throw new ConverterFactoryError(
        message.replace("{type}", type).replace("{available}", availableTypes.join(", ")),
        "UNKNOWN_CONVERTER",
        { type, availableTypes },
      )
    }

    try {
      this.logger.debug(`Creating DI converter instance: ${type}`)

      // Create a child container with the logger
      const childContainer = this.container.createChild()
      childContainer.registerInstance("Logger", this.logger, { replace: true })

      // Auto-register dependencies if enabled
      if (this.config.enableAutoDI && registration.dependencies) {
        for (const dep of registration.dependencies) {
          if (!childContainer.isRegistered(dep) && this.container.isRegistered(dep)) {
            // Copy service from parent container
            const serviceInfo = this.container.getServiceInfo(dep)
            if (serviceInfo) {
              childContainer.register(dep, () => this.container.resolve(dep))
            }
          }
        }
      }

      // Validate dependencies
      if (registration.dependencies) {
        for (const dep of registration.dependencies) {
          if (!childContainer.isRegistered(dep)) {
            throw new ConverterFactoryError(
              `Dependency '${dep}' not found in DI container for converter '${type}'`,
              "MISSING_DEPENDENCY",
              { type, dependency: dep },
            )
          }
        }
      }

      // Use the factory function directly (should be DI-aware)
      if (registration.dependencies && registration.dependencies.length > 0) {
        // This should be a DI converter
        const diFactory = registration.factory as any
        if (typeof diFactory === "function") {
          const converter = diFactory(this.logger, childContainer)
          if (converter) {
            this.validateConverter(converter, type)
            this.logger.debug(`Successfully created DI converter: ${type}`)
            return converter
          }
        }
      }

      // Fallback to regular creation
      return this.createConverter(type)
    } catch (error) {
      if (error instanceof ConverterFactoryError) {
        throw error
      }

      const wrappedError = new ConverterFactoryError(
        `Failed to create DI converter '${type}': ${error instanceof Error ? error.message : String(error)}`,
        "DI_CREATION_FAILED",
        { type, originalError: error },
      )

      this.logger.error("DI converter creation failed", wrappedError)
      throw wrappedError
    }
  }

  /**
   * Unregister a converter type
   * @param type - Type of converter to unregister
   */
  unregisterConverter(type: string): void {
    if (!type || type.trim() === "") {
      throw new ConverterFactoryError(
        "Converter type must be a non-empty string",
        "EMPTY_TYPE",
      )
    }

    if (this.converters.delete(type)) {
      this.logger.debug(`Unregistered converter factory: ${type}`)
    } else {
      this.logger.warn(`Attempted to unregister non-existent converter: ${type}`)
    }
  }

  /**
   * Enable or disable a converter type
   * @param type - Type of converter to enable/disable
   * @param enabled - Whether the converter should be enabled
   */
  setConverterEnabled(type: string, enabled: boolean): void {
    const registration = this.converters.get(type)
    if (!registration) {
      throw new ConverterFactoryError(
        `Unknown converter type: ${type}`,
        "UNKNOWN_CONVERTER",
        { type },
      )
    }

    registration.enabled = enabled
    this.logger.debug(`${enabled ? "Enabled" : "Disabled"} converter: ${type}`)
  }

  /**
   * Check if a converter type is registered and enabled
   * @param type - Type of converter to check
   * @returns True if converter is available
   */
  hasConverter(type: string): boolean {
    const registration = this.converters.get(type)
    return registration?.enabled ?? false
  }

  /**
   * Get all registered converter types
   * @returns Array of converter type names
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.converters.keys()).sort()
  }

  /**
   * Get enabled converter types
   * @returns Array of enabled converter type names
   */
  getEnabledTypes(): string[] {
    return Array.from(this.converters.entries())
      .filter(([, registration]) => registration.enabled)
      .map(([type]) => type)
      .sort()
  }

  /**
   * Get information about a registered converter
   * @param type - Type of converter to get info for
   * @returns Converter registration info or undefined if not found
   */
  getConverterInfo(type: string): {
    type: string
    enabled: boolean
    dependencies: string[]
    registeredAt: Date
  } | undefined {
    const registration = this.converters.get(type)
    if (!registration) {
      return undefined
    }

    return {
      type,
      enabled: registration.enabled,
      dependencies: registration.dependencies || [],
      registeredAt: registration.registeredAt,
    }
  }

  /**
   * Get information about all registered converters
   * @returns Array of converter information objects
   */
  getAllConverterInfo(): Array<{
    type: string
    enabled: boolean
    dependencies: string[]
    registeredAt: Date
  }> {
    return Array.from(this.converters.entries()).map(([type, registration]) => ({
      type,
      enabled: registration.enabled,
      dependencies: registration.dependencies || [],
      registeredAt: registration.registeredAt,
    }))
  }

  /**
   * Clear all registered converters
   */
  clear(): void {
    const count = this.converters.size
    this.converters.clear()
    this.logger.debug(`Cleared ${count} registered converter factories`)
  }

  /**
   * Create converters for all default types specified in config
   * @returns Array of created converters
   */
  createDefaultConverters(): ConverterStrategy[] {
    if (!this.config.defaultConverters || this.config.defaultConverters.length === 0) {
      this.logger.debug("No default converters configured")
      return []
    }

    const converters: ConverterStrategy[] = []

    for (const type of this.config.defaultConverters) {
      try {
        const converter = this.createConverter(type)
        converters.push(converter)
      } catch (error) {
        this.logger.warn(`Failed to create default converter '${type}':`, error)
        if (this.config.strictValidation) {
          throw new ConverterFactoryError(
            `Failed to create required default converter '${type}'`,
            "DEFAULT_CONVERTER_FAILED",
            { type, originalError: error },
          )
        }
      }
    }

    this.logger.debug(`Created ${converters.length} default converters`)
    return converters
  }

  /**
   * Get the DI container instance
   * @returns DI container
   */
  getContainer(): DIContainer {
    return this.container
  }

  /**
   * Validate that all dependencies are available
   * @param type - Converter type for error reporting
   * @param dependencies - Array of dependency names
   */
  private validateDependencies(type: string, dependencies: string[]): void {
    for (const dependency of dependencies) {
      if (!dependency || dependency.trim() === "") {
        this.logger.warn(`Empty dependency found for converter: ${type}`)
        continue
      }

      // Check if dependency is registered in DI container
      if (!this.container.isRegistered(dependency)) {
        this.logger.warn(`Dependency '${dependency}' not found in DI container for converter '${type}'`)
      }
    }
  }

  /**
   * Validate that the created converter implements the required interface
   * @param converter - Converter instance to validate
   * @param type - Converter type for error reporting
   */
  private validateConverter(converter: ConverterStrategy, type: string): void {
    if (!converter) {
      throw new ConverterFactoryError(
        "Factory function returned null or undefined",
        "NULL_CONVERTER",
        { type },
      )
    }

    // Check required methods
    const requiredMethods = ["convert", "validate", "canHandle", "getName", "getSupportedContentTypes", "getOutputFormat"]

    for (const method of requiredMethods) {
      if (typeof (converter as any)[method] !== "function") {
        throw new ConverterFactoryError(
          `Converter '${type}' is missing required method: ${method}`,
          "INVALID_CONVERTER_INTERFACE",
          { type, method },
        )
      }
    }

    // Validate that getName returns a non-empty string
    const name = converter.getName()
    if (!name || name.trim() === "") {
      throw new ConverterFactoryError(
        `Converter '${type}' getName() returned empty string`,
        "INVALID_CONVERTER_NAME",
        { type },
      )
    }
  }

  /**
   * Format error message with template variables
   * @param template - Message template with {variable} placeholders
   * @param variables - Object with variable values
   * @returns Formatted message
   */
  private formatErrorMessage(template: string, variables: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match
    })
  }
}
