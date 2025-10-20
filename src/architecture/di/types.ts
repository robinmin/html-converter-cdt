/**
 * Service lifetime enumeration for dependency injection
 */
export enum ServiceLifetime {
  /** A new instance is created for each request */
  Transient = "transient",
  /** A single instance is created and shared across all requests */
  Singleton = "singleton",
  /** A single instance is created per scope */
  Scoped = "scoped",
}

/**
 * Service descriptor for registered dependencies
 */
export interface ServiceDescriptor {
  /** Unique token identifying the service */
  token: string
  /** Service factory function */
  factory: ServiceFactory
  /** Service lifetime */
  lifetime: ServiceLifetime
  /** Dependencies required by this service */
  dependencies?: string[]
  /** Whether this service is currently being resolved (for circular dependency detection) */
  resolving?: boolean
  /** Cached instance for singleton services */
  instance?: any
  /** Registration timestamp */
  registeredAt: Date
}

/**
 * Service factory function type
 */
export type ServiceFactory = (container: any) => any

/**
 * Service registration options
 */
export interface ServiceRegistrationOptions {
  /** Service lifetime (defaults to Transient) */
  lifetime?: ServiceLifetime
  /** Dependencies required by this service */
  dependencies?: string[]
  /** Replace existing registration if exists */
  replace?: boolean
}

/**
 * DI container configuration options
 */
export interface DIContainerConfig {
  /** Enable circular dependency detection */
  enableCircularDependencyDetection?: boolean
  /** Maximum resolution depth to prevent infinite loops */
  maxResolutionDepth?: number
  /** Enable service auto-wiring */
  enableAutoWiring?: boolean
  /** Custom error messages */
  errorMessages?: {
    serviceNotRegistered?: string
    circularDependency?: string
    maxDepthExceeded?: string
    invalidFactory?: string
  }
}

/**
 * DI container error types
 */
export class DIContainerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message)
    this.name = "DIContainerError"
  }
}

/**
 * Circular dependency detected error
 */
export class CircularDependencyError extends DIContainerError {
  constructor(
    message: string,
    public readonly dependencyChain: string[],
  ) {
    super(message, "CIRCULAR_DEPENDENCY", { dependencyChain })
    this.name = "CircularDependencyError"
  }
}
