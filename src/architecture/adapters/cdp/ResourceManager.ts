import process from "node:process"

import { CDPClient } from "./CDPClient.js"
import { CDPConnectionPool } from "./ConnectionPool.js"
import type { CDPLogger } from "./types.js"

/**
 * Resource type enumeration
 */
export enum ResourceType {
  CLIENT = "client",
  POOL = "pool",
  EVENT_MANAGER = "event_manager",
  TIMER = "timer",
  CUSTOM = "custom",
}

/**
 * Resource cleanup function
 */
type CleanupFunction = () => Promise<void> | void

/**
 * Resource wrapper
 */
interface Resource {
  id: string
  type: ResourceType
  name: string
  resource: any
  cleanup: CleanupFunction
  createdAt: Date
  lastUsed: Date
  cleanupAttempts: number
  maxCleanupAttempts: number
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  errorTypes: string[]
  strategy: "retry" | "reconnect" | "restart" | "ignore" | "custom"
  maxAttempts: number
  delay?: number
  customHandler?: (error: Error, context: any) => Promise<boolean>
}

/**
 * Resource Manager for CDP components
 * Handles cleanup, error recovery, and resource lifecycle management
 */
export class CDPResourceManager {
  private logger: CDPLogger
  private resources = new Map<string, Resource>()
  private errorRecoveryStrategies = new Map<string, ErrorRecoveryStrategy>()
  private isShuttingDown = false
  private cleanupInProgress = false

  constructor(logger: CDPLogger) {
    this.logger = logger

    // Set up global error handlers
    this.setupGlobalErrorHandlers()

    // Set up graceful shutdown handlers
    this.setupGracefulShutdown()
  }

  /**
   * Register a resource for cleanup
   */
  registerResource<T>(
    resource: T,
    type: ResourceType,
    name: string,
    cleanup: CleanupFunction,
    options: {
      maxCleanupAttempts?: number
    } = {},
  ): string {
    const resourceId = this.generateResourceId()
    const resourceWrapper: Resource = {
      id: resourceId,
      type,
      name,
      resource,
      cleanup,
      createdAt: new Date(),
      lastUsed: new Date(),
      cleanupAttempts: 0,
      maxCleanupAttempts: options.maxCleanupAttempts || 3,
    }

    this.resources.set(resourceId, resourceWrapper)
    this.logger.debug(`Registered resource: ${name} (${type}) with ID: ${resourceId}`)

    return resourceId
  }

  /**
   * Unregister and cleanup a resource
   */
  async unregisterResource(resourceId: string): Promise<void> {
    const resource = this.resources.get(resourceId)
    if (!resource) {
      this.logger.warn(`Attempted to unregister unknown resource: ${resourceId}`)
      return
    }

    await this.cleanupResource(resource)
    this.resources.delete(resourceId)
    this.logger.debug(`Unregistered resource: ${resource.name}`)
  }

  /**
   * Get resource by ID
   */
  getResource<T = any>(resourceId: string): T | undefined {
    const resource = this.resources.get(resourceId)
    return resource?.resource
  }

  /**
   * Update resource last used time
   */
  updateResourceUsage(resourceId: string): void {
    const resource = this.resources.get(resourceId)
    if (resource) {
      resource.lastUsed = new Date()
    }
  }

  /**
   * Register error recovery strategy
   */
  registerErrorRecoveryStrategy(errorType: string, strategy: ErrorRecoveryStrategy): void {
    this.errorRecoveryStrategies.set(errorType, strategy)
    this.logger.debug(`Registered error recovery strategy for: ${errorType}`)
  }

  /**
   * Handle error with recovery strategy
   */
  async handleError(error: Error, context: any = {}): Promise<boolean> {
    this.logger.error("Handling error with recovery strategy", error)

    const errorType = this.getErrorType(error)
    const strategy = this.errorRecoveryStrategies.get(errorType)

    if (!strategy) {
      this.logger.warn(`No recovery strategy found for error type: ${errorType}`)
      return false
    }

    return this.executeRecoveryStrategy(strategy, error, context)
  }

  /**
   * Cleanup all resources
   */
  async cleanupAll(): Promise<void> {
    if (this.cleanupInProgress) {
      this.logger.warn("Cleanup already in progress")
      return
    }

    this.cleanupInProgress = true
    this.isShuttingDown = true

    this.logger.info("Starting cleanup of all resources")

    const cleanupPromises: Promise<void>[] = []

    for (const resource of this.resources.values()) {
      cleanupPromises.push(this.cleanupResource(resource))
    }

    try {
      await Promise.allSettled(cleanupPromises)
      this.resources.clear()
      this.logger.info("Completed cleanup of all resources")
    } catch (error) {
      this.logger.error("Error during resource cleanup", error as Error)
    } finally {
      this.cleanupInProgress = false
    }
  }

  /**
   * Get resource statistics
   */
  getResourceStats(): {
    totalResources: number
    resourcesByType: { [key in ResourceType]?: number }
    oldestResource: { age: number, name: string } | null
    resourcesNeedingCleanup: number
  } {
    const resourcesByType: { [key in ResourceType]?: number } = {}
    let oldestResource: { age: number, name: string } | null = null
    let resourcesNeedingCleanup = 0

    const now = new Date()

    for (const resource of this.resources.values()) {
      // Count by type
      resourcesByType[resource.type] = (resourcesByType[resource.type] || 0) + 1

      // Find oldest resource
      const age = now.getTime() - resource.createdAt.getTime()
      if (!oldestResource || age > oldestResource.age) {
        oldestResource = { age, name: resource.name }
      }

      // Count resources needing cleanup
      if (resource.cleanupAttempts >= resource.maxCleanupAttempts) {
        resourcesNeedingCleanup++
      }
    }

    return {
      totalResources: this.resources.size,
      resourcesByType,
      oldestResource,
      resourcesNeedingCleanup,
    }
  }

  /**
   * Force cleanup of stuck resources
   */
  async forceCleanupStuckResources(): Promise<number> {
    let cleanedCount = 0

    for (const resource of this.resources.values()) {
      if (resource.cleanupAttempts >= resource.maxCleanupAttempts) {
        try {
          await this.forceCleanupResource(resource)
          this.resources.delete(resource.id)
          cleanedCount++
          this.logger.info(`Force cleaned stuck resource: ${resource.name}`)
        } catch (error) {
          this.logger.error(`Failed to force clean resource: ${resource.name}`, error as Error)
        }
      }
    }

    return cleanedCount
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Only setup process handlers in Node.js environment
    if (typeof process !== "undefined") {
      // Handle unhandled promise rejections
      process.on("unhandledRejection", async (reason, promise) => {
        this.logger.error("Unhandled promise rejection", new Error(String(reason)))
        await this.handleError(new Error(String(reason)), { promise })
      })

      // Handle uncaught exceptions
      process.on("uncaughtException", async (error) => {
        this.logger.error("Uncaught exception", error)
        await this.handleError(error, { uncaught: true })

        // Exit if we can't recover
        if (!this.isShuttingDown) {
          process.exit(1)
        }
      })
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    // Only setup process handlers in Node.js environment
    if (typeof process !== "undefined") {
      const shutdown = async (signal: string) => {
        this.logger.info(`Received ${signal}, starting graceful shutdown`)
        await this.cleanupAll()
        process.exit(0)
      }

      process.on("SIGINT", () => shutdown("SIGINT"))
      process.on("SIGTERM", () => shutdown("SIGTERM"))
    }
  }

  /**
   * Clean up a specific resource
   */
  private async cleanupResource(resource: Resource): Promise<void> {
    if (resource.cleanupAttempts >= resource.maxCleanupAttempts) {
      this.logger.warn(`Skipping cleanup for resource ${resource.name} - max attempts reached`)
      return
    }

    resource.cleanupAttempts++

    try {
      this.logger.debug(`Cleaning up resource: ${resource.name} (attempt ${resource.cleanupAttempts})`)
      await resource.cleanup()
      this.logger.debug(`Successfully cleaned up resource: ${resource.name}`)
    } catch (error) {
      this.logger.error(`Failed to cleanup resource: ${resource.name}`, error as Error)

      if (resource.cleanupAttempts < resource.maxCleanupAttempts) {
        // Retry after delay
        const delay = 2 ** resource.cleanupAttempts * 1000
        setTimeout(() => this.cleanupResource(resource), delay)
      }
    }
  }

  /**
   * Force cleanup of a stuck resource
   */
  private async forceCleanupResource(resource: Resource): Promise<void> {
    this.logger.info(`Force cleaning resource: ${resource.name}`)

    // Try different cleanup strategies based on resource type
    switch (resource.type) {
      case ResourceType.CLIENT:
        if (resource.resource instanceof CDPClient) {
          try {
            await resource.resource.close()
          } catch {
            // Ignore errors during force cleanup
          }
        }
        break

      case ResourceType.POOL:
        if (resource.resource instanceof CDPConnectionPool) {
          try {
            await resource.resource.closeAll()
          } catch {
            // Ignore errors during force cleanup
          }
        }
        break

      case ResourceType.TIMER:
        if (resource.resource && typeof resource.resource.clear === "function") {
          resource.resource.clear()
        }
        break

      default:
        // Try the cleanup function one more time
        await resource.cleanup()
        break
    }
  }

  /**
   * Get error type from error
   */
  private getErrorType(error: Error): string {
    if (error.name) {
      return error.name.toLowerCase()
    }

    if (error.message) {
      // Extract error type from message
      const match = error.message.match(/^([A-Z][a-z]+(?:Error|Exception)):/)
      if (match) {
        return match[1].toLowerCase()
      }
    }

    return "unknown"
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecoveryStrategy(
    strategy: ErrorRecoveryStrategy,
    error: Error,
    context: any,
  ): Promise<boolean> {
    const { strategy: strategyType, maxAttempts, delay = 1000 } = strategy

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.info(`Executing recovery strategy: ${strategyType} (attempt ${attempt})`)

        switch (strategyType) {
          case "retry":
            // Retry the operation that failed
            if (context.retryFunction) {
              await context.retryFunction()
              return true
            }
            break

          case "reconnect":
            // Reconnect CDP clients
            if (context.client && context.client instanceof CDPClient) {
              await context.client.close()
              await context.client.connect()
              return true
            }
            break

          case "restart":
            // Restart the component
            if (context.restartFunction) {
              await context.restartFunction()
              return true
            }
            break

          case "ignore":
            // Ignore the error
            return true

          case "custom":
            // Use custom handler
            if (strategy.customHandler) {
              return await strategy.customHandler(error, context)
            }
            break
        }

        // Wait before retry
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt))
        }
      } catch (recoveryError) {
        this.logger.error(`Recovery attempt ${attempt} failed`, recoveryError as Error)
      }
    }

    this.logger.error(`All recovery attempts failed for strategy: ${strategyType}`)
    return false
  }

  /**
   * Generate unique resource ID
   */
  private generateResourceId(): string {
    return `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
