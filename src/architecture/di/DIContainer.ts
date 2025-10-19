import type {
  DIContainerConfig,
  ServiceDescriptor,
  ServiceFactory,
  ServiceRegistrationOptions,
} from "./types.js"
import {
  CircularDependencyError,
  DIContainerError,
  ServiceLifetime,
} from "./types.js"

/**
 * Lightweight dependency injection container for managing converter dependencies
 * Provides service registration, resolution, and lifetime management
 */
export class DIContainer {
  private services = new Map<string, ServiceDescriptor>()
  private config: Required<DIContainerConfig>
  private resolutionDepth = 0

  constructor(config: DIContainerConfig = {}) {
    this.config = {
      enableCircularDependencyDetection: true,
      maxResolutionDepth: 50,
      enableAutoWiring: false,
      errorMessages: {
        serviceNotRegistered: "Service '{token}' is not registered",
        circularDependency: "Circular dependency detected: {chain}",
        maxDepthExceeded: "Maximum resolution depth ({maxDepth}) exceeded while resolving '{token}'",
        invalidFactory: "Service factory for '{token}' returned undefined or null",
      },
      ...config,
    }
  }

  /**
   * Register a service with the container
   * @param token - Unique identifier for the service
   * @param factory - Factory function to create the service
   * @param options - Registration options
   */
  register(
    token: string,
    factory: ServiceFactory,
    options: ServiceRegistrationOptions = {},
  ): void {
    if (!token || token.trim() === "") {
      throw new DIContainerError(
        "Service token must be a non-empty string",
        "INVALID_TOKEN",
      )
    }

    if (typeof factory !== "function") {
      throw new DIContainerError(
        "Service factory must be a function",
        "INVALID_FACTORY",
        { token },
      )
    }

    // Check if service already exists
    if (this.services.has(token) && !options.replace) {
      throw new DIContainerError(
        `Service '${token}' is already registered. Use replace: true to override.`,
        "SERVICE_ALREADY_REGISTERED",
        { token },
      )
    }

    const descriptor: ServiceDescriptor = {
      token,
      factory,
      lifetime: options.lifetime || ServiceLifetime.Transient,
      dependencies: options.dependencies,
      resolving: false,
      registeredAt: new Date(),
    }

    this.services.set(token, descriptor)
  }

  /**
   * Register a singleton service
   * @param token - Unique identifier for the service
   * @param factory - Factory function to create the service
   * @param options - Registration options
   */
  registerSingleton(
    token: string,
    factory: ServiceFactory,
    options: Omit<ServiceRegistrationOptions, "lifetime"> = {},
  ): void {
    this.register(token, factory, { ...options, lifetime: ServiceLifetime.Singleton })
  }

  /**
   * Register a transient service
   * @param token - Unique identifier for the service
   * @param factory - Factory function to create the service
   * @param options - Registration options
   */
  registerTransient(
    token: string,
    factory: ServiceFactory,
    options: Omit<ServiceRegistrationOptions, "lifetime"> = {},
  ): void {
    this.register(token, factory, { ...options, lifetime: ServiceLifetime.Transient })
  }

  /**
   * Register a scoped service
   * @param token - Unique identifier for the service
   * @param factory - Factory function to create the service
   * @param options - Registration options
   */
  registerScoped(
    token: string,
    factory: ServiceFactory,
    options: Omit<ServiceRegistrationOptions, "lifetime"> = {},
  ): void {
    this.register(token, factory, { ...options, lifetime: ServiceLifetime.Scoped })
  }

  /**
   * Register an instance as a singleton
   * @param token - Unique identifier for the service
   * @param instance - The instance to register
   * @param options - Registration options
   */
  registerInstance(
    token: string,
    instance: any,
    options: Omit<ServiceRegistrationOptions, "lifetime" | "dependencies"> = {},
  ): void {
    if (instance === null || instance === undefined) {
      throw new DIContainerError(
        "Cannot register null or undefined instance",
        "INVALID_INSTANCE",
        { token },
      )
    }

    const descriptor: ServiceDescriptor = {
      token,
      factory: () => instance,
      lifetime: ServiceLifetime.Singleton,
      instance,
      registeredAt: new Date(),
    }

    if (this.services.has(token) && !options.replace) {
      throw new DIContainerError(
        `Service '${token}' is already registered. Use replace: true to override.`,
        "SERVICE_ALREADY_REGISTERED",
        { token },
      )
    }

    this.services.set(token, descriptor)
  }

  /**
   * Resolve a service from the container
   * @param token - Service token to resolve
   * @returns Service instance
   * @throws DIContainerError if service is not registered or resolution fails
   */
  resolve<T>(token: string): T {
    // Check maximum resolution depth
    if (this.resolutionDepth >= this.config.maxResolutionDepth) {
      throw new DIContainerError(
        this.formatErrorMessage(this.config.errorMessages.maxDepthExceeded, {
          token,
          maxDepth: this.config.maxResolutionDepth,
        }),
        "MAX_DEPTH_EXCEEDED",
        { token, maxDepth: this.config.maxResolutionDepth },
      )
    }

    const descriptor = this.services.get(token)
    if (!descriptor) {
      throw new DIContainerError(
        this.formatErrorMessage(this.config.errorMessages.serviceNotRegistered, { token }),
        "SERVICE_NOT_REGISTERED",
        { token },
      )
    }

    // Check for circular dependencies
    if (this.config.enableCircularDependencyDetection && descriptor.resolving) {
      const chain = this.getResolutionChain(token)
      throw new CircularDependencyError(
        this.formatErrorMessage(this.config.errorMessages.circularDependency, {
          chain: chain.join(" -> "),
        }),
        chain,
      )
    }

    // Return cached instance for singletons
    if (descriptor.lifetime === ServiceLifetime.Singleton && descriptor.instance !== undefined) {
      return descriptor.instance
    }

    // Mark as resolving to detect circular dependencies
    descriptor.resolving = true
    this.resolutionDepth++

    try {
      // Resolve dependencies first
      if (descriptor.dependencies) {
        for (const dependency of descriptor.dependencies) {
          this.resolve(dependency)
        }
      }

      // Create new instance
      const instance = descriptor.factory(this)

      if (instance === null || instance === undefined) {
        throw new DIContainerError(
          this.formatErrorMessage(this.config.errorMessages.invalidFactory, { token }),
          "INVALID_FACTORY_RESULT",
          { token },
        )
      }

      // Cache instance for singletons
      if (descriptor.lifetime === ServiceLifetime.Singleton) {
        descriptor.instance = instance
      }

      return instance
    } finally {
      descriptor.resolving = false
      this.resolutionDepth--
    }
  }

  /**
   * Resolve a service or return undefined if not registered
   * @param token - Service token to resolve
   * @returns Service instance or undefined
   */
  tryResolve<T>(token: string): T | undefined {
    try {
      return this.resolve<T>(token)
    } catch (error) {
      if (error instanceof DIContainerError && error.code === "SERVICE_NOT_REGISTERED") {
        return undefined
      }
      throw error
    }
  }

  /**
   * Check if a service is registered
   * @param token - Service token to check
   * @returns True if service is registered
   */
  isRegistered(token: string): boolean {
    return this.services.has(token)
  }

  /**
   * Unregister a service
   * @param token - Service token to unregister
   */
  unregister(token: string): void {
    if (this.services.delete(token)) {
      // Clear any cached singleton instance
      const descriptor = this.services.get(token)
      if (descriptor?.instance) {
        descriptor.instance = undefined
      }
    }
  }

  /**
   * Clear all registered services
   */
  clear(): void {
    this.services.clear()
  }

  /**
   * Get all registered service tokens
   * @returns Array of service tokens
   */
  getRegisteredTokens(): string[] {
    return Array.from(this.services.keys()).sort()
  }

  /**
   * Get information about a registered service
   * @param token - Service token
   * @returns Service information or undefined if not found
   */
  getServiceInfo(token: string): {
    token: string
    lifetime: ServiceLifetime
    dependencies: string[]
    registeredAt: Date
    hasInstance: boolean
  } | undefined {
    const descriptor = this.services.get(token)
    if (!descriptor) {
      return undefined
    }

    return {
      token: descriptor.token,
      lifetime: descriptor.lifetime,
      dependencies: descriptor.dependencies || [],
      registeredAt: descriptor.registeredAt,
      hasInstance: descriptor.instance !== undefined,
    }
  }

  /**
   * Get information about all registered services
   * @returns Array of service information objects
   */
  getAllServiceInfo(): Array<{
    token: string
    lifetime: ServiceLifetime
    dependencies: string[]
    registeredAt: Date
    hasInstance: boolean
  }> {
    return Array.from(this.services.values()).map(descriptor => ({
      token: descriptor.token,
      lifetime: descriptor.lifetime,
      dependencies: descriptor.dependencies || [],
      registeredAt: descriptor.registeredAt,
      hasInstance: descriptor.instance !== undefined,
    }))
  }

  /**
   * Create a child container that inherits from this container
   * @param config - Configuration for the child container
   * @returns New child container
   */
  createChild(config: DIContainerConfig = {}): DIContainer {
    const child = new DIContainer(config)

    // Copy all services to child
    for (const [token, descriptor] of this.services) {
      child.services.set(token, { ...descriptor })
    }

    return child
  }

  /**
   * Get the resolution chain for circular dependency detection
   * @param token - Starting token
   * @returns Array of tokens in the resolution chain
   */
  private getResolutionChain(token: string): string[] {
    const chain: string[] = []
    const visited = new Set<string>()

    const buildChain = (currentToken: string): boolean => {
      if (visited.has(currentToken)) {
        return true // Circular dependency found
      }

      visited.add(currentToken)
      chain.push(currentToken)

      const descriptor = this.services.get(currentToken)
      if (descriptor?.dependencies) {
        for (const dependency of descriptor.dependencies) {
          if (buildChain(dependency)) {
            return true
          }
        }
      }

      chain.pop()
      return false
    }

    buildChain(token)
    return chain
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
