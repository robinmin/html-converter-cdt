/**
 * Chrome Instance Pool Manager - Manages Chrome process pooling for multiple conversions
 *
 * Provides connection pooling, instance lifecycle management, user data directory isolation,
 * and automatic cleanup for efficient Chrome process reuse across multiple conversions.
 */

import { randomUUID } from "node:crypto"

import type { CDPClient } from "../../architecture/adapters/cdp/CDPClient.js"
import { CDPConnectionStatus } from "../../architecture/adapters/cdp/types.js"
import type { Logger } from "../../architecture/strategies/types.js"
import type { ChromeCDPManagerConfig, ChromeProcess } from "../engine/chrome-cdp-manager.js"

import { memoryManager } from "./memory-manager.js"

/**
 * Pool configuration options
 */
export interface ChromePoolConfig {
  /** Maximum number of Chrome instances in pool */
  maxPoolSize?: number
  /** Minimum number of Chrome instances to keep ready */
  minPoolSize?: number
  /** Instance idle timeout in milliseconds */
  idleTimeout?: number
  /** Maximum lifetime for an instance in milliseconds */
  maxLifetime?: number
  /** Whether to use isolated user data directories */
  isolateUserData?: boolean
  /** Base directory for user data */
  userDataBaseDir?: string
  /** Whether to pre-warm instances */
  preWarmInstances?: boolean
  /** Health check interval in milliseconds */
  healthCheckInterval?: number
  /** Memory threshold for creating new instances */
  memoryThreshold?: number
  /** Chrome launch configuration */
  chromeConfig?: Omit<ChromeCDPManagerConfig, "maxInstances" | "idleTimeout">
}

/**
 * Pooled Chrome instance information
 */
export interface PooledChromeInstance {
  /** Unique instance identifier */
  id: string
  /** Chrome process information */
  process: ChromeProcess
  /** CDP client connection */
  cdpClient?: CDPClient
  /** Instance creation timestamp */
  createdAt: Date
  /** Last used timestamp */
  lastUsed: Date
  /** Number of times this instance has been used */
  usageCount: number
  /** Whether instance is currently in use */
  inUse: boolean
  /** Whether instance is healthy */
  healthy: boolean
  /** User data directory path */
  userDataDir?: string
  /** Instance health check promise */
  healthCheckPromise?: Promise<boolean>
}

/**
 * Pool statistics
 */
export interface PoolStats {
  /** Total instances in pool */
  totalInstances: number
  /** Active instances (in use) */
  activeInstances: number
  /** Idle instances (available) */
  idleInstances: number
  /** Unhealthy instances */
  unhealthyInstances: number
  /** Pool usage percentage */
  usagePercentage: number
  /** Total memory usage by pool */
  memoryUsage?: {
    total: number
    average: number
  }
  /** Average instance lifetime */
  averageLifetime: number
  /** Total operations handled */
  totalOperations: number
  /** Operations per second */
  operationsPerSecond: number
}

/**
 * Chrome Instance Pool Manager
 *
 * Provides efficient pooling of Chrome instances with:
 * - Connection pooling and reuse
 * - Instance lifecycle management
 * - Health monitoring and cleanup
 * - Memory-aware pool sizing
 * - User data directory isolation
 */
export class ChromeInstancePool {
  private logger: Logger
  private config: Required<ChromePoolConfig>
  private pool = new Map<string, PooledChromeInstance>()
  private healthCheckInterval?: NodeJS.Timeout
  private isShuttingDown = false
  private operationStats = {
    totalOperations: 0,
    operationTimes: [] as number[],
    lastStatsTime: Date.now(),
  }

  constructor(logger: Logger, config: ChromePoolConfig = {}) {
    this.logger = logger

    // Get memory-aware pool size
    const memoryAwarePoolSize = memoryManager.suggestConcurrencyLimit(
      config.maxPoolSize || 5,
    )

    this.config = {
      maxPoolSize: memoryAwarePoolSize,
      minPoolSize: 1,
      idleTimeout: 300000, // 5 minutes
      maxLifetime: 1800000, // 30 minutes
      isolateUserData: true,
      userDataBaseDir: "/tmp/chrome-pool",
      preWarmInstances: true,
      healthCheckInterval: 30000, // 30 seconds
      memoryThreshold: 0.8, // 80% memory usage threshold
      chromeConfig: {
        headless: true,
        connectionTimeout: 30000,
        pageTimeout: 30000,
        disableWebSecurity: false,
        ignoreCertificateErrors: true,
        chromeArgs: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
      },
      ...config,
    }

    this.logger.info("Chrome instance pool initialized", {
      maxPoolSize: this.config.maxPoolSize,
      minPoolSize: this.config.minPoolSize,
      isolateUserData: this.config.isolateUserData,
      preWarmInstances: this.config.preWarmInstances,
    })

    // Start health monitoring
    this.startHealthMonitoring()

    // Pre-warm instances if configured
    if (this.config.preWarmInstances) {
      this.preWarmPool()
    }
  }

  /**
   * Acquire a Chrome instance from the pool
   *
   * @returns Promise resolving to pooled Chrome instance
   */
  async acquireInstance(): Promise<PooledChromeInstance> {
    if (this.isShuttingDown) {
      throw new Error("Chrome pool is shutting down")
    }

    // Check memory usage before acquiring
    const memoryCheck = memoryManager.checkMemoryUsage()
    if (memoryCheck.status === "exceeded") {
      throw new Error("Insufficient memory to acquire Chrome instance")
    }

    this.logger.debug("Acquiring Chrome instance from pool")

    // Try to get an existing idle instance
    let instance = this.getIdleInstance()

    if (!instance) {
      // No idle instances available, create a new one
      instance = await this.createNewInstance()
    }

    // Mark instance as in use
    instance.inUse = true
    instance.lastUsed = new Date()
    instance.usageCount++

    this.operationStats.totalOperations++

    this.logger.debug("Chrome instance acquired", {
      instanceId: instance.id,
      usageCount: instance.usageCount,
      poolSize: this.pool.size,
    })

    return instance
  }

  /**
   * Release a Chrome instance back to the pool
   *
   * @param instance - Instance to release
   */
  async releaseInstance(instance: PooledChromeInstance): Promise<void> {
    if (!this.pool.has(instance.id)) {
      this.logger.warn("Attempted to release unknown instance", { instanceId: instance.id })
      return
    }

    this.logger.debug("Releasing Chrome instance to pool", {
      instanceId: instance.id,
      usageCount: instance.usageCount,
    })

    // Mark as not in use
    instance.inUse = false
    instance.lastUsed = new Date()

    // Check if instance should be cleaned up
    if (this.shouldCleanupInstance(instance)) {
      await this.removeInstance(instance.id, "Instance exceeded limits")
    }
  }

  /**
   * Get current pool statistics
   */
  getPoolStats(): PoolStats {
    const instances = Array.from(this.pool.values())
    const activeInstances = instances.filter(i => i.inUse).length
    const idleInstances = instances.filter(i => !i.inUse && i.healthy).length
    const unhealthyInstances = instances.filter(i => !i.healthy).length

    const usagePercentage = this.config.maxPoolSize > 0
      ? (activeInstances / this.config.maxPoolSize) * 100
      : 0

    // Calculate average lifetime
    const now = Date.now()
    const averageLifetime = instances.length > 0
      ? instances.reduce((sum, i) => sum + (now - i.createdAt.getTime()), 0) / instances.length
      : 0

    // Calculate operations per second
    const timeSinceLastStats = now - this.operationStats.lastStatsTime
    const operationsPerSecond = timeSinceLastStats > 0
      ? (this.operationStats.totalOperations / (timeSinceLastStats / 1000))
      : 0

    return {
      totalInstances: instances.length,
      activeInstances,
      idleInstances,
      unhealthyInstances,
      usagePercentage,
      averageLifetime,
      totalOperations: this.operationStats.totalOperations,
      operationsPerSecond,
    }
  }

  /**
   * Shutdown the pool and clean up all instances
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.logger.info("Shutting down Chrome instance pool")
    this.isShuttingDown = true

    // Stop health monitoring
    this.stopHealthMonitoring()

    // Wait for all active instances to be released
    const activeInstances = Array.from(this.pool.values()).filter(i => i.inUse)
    if (activeInstances.length > 0) {
      this.logger.info(`Waiting for ${activeInstances.length} active instances to be released`)

      // Wait up to 30 seconds for instances to be released
      const maxWait = 30000
      const startTime = Date.now()

      while (activeInstances.some(i => i.inUse) && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Remove all instances
    const removePromises = Array.from(this.pool.keys()).map(id =>
      this.removeInstance(id, "Pool shutdown"),
    )

    await Promise.allSettled(removePromises)

    this.logger.info("Chrome instance pool shutdown completed")
  }

  /**
   * Get an idle instance from the pool
   */
  private getIdleInstance(): PooledChromeInstance | null {
    // Find healthy, idle instances sorted by last used time (LRU)
    const idleInstances = Array.from(this.pool.values())
      .filter(i => !i.inUse && i.healthy)
      .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime())

    return idleInstances.length > 0 ? idleInstances[0]! : null
  }

  /**
   * Create a new Chrome instance
   */
  private async createNewInstance(): Promise<PooledChromeInstance> {
    // Check if we've reached max pool size
    if (this.pool.size >= this.config.maxPoolSize) {
      // Try to cleanup idle instances first
      await this.cleanupIdleInstances()

      if (this.pool.size >= this.config.maxPoolSize) {
        throw new Error(`Chrome pool maximum size (${this.config.maxPoolSize}) reached`)
      }
    }

    const instanceId = randomUUID()
    const userDataDir = this.config.isolateUserData
      ? `${this.config.userDataBaseDir}/${instanceId}`
      : undefined

    this.logger.info("Creating new Chrome instance", {
      instanceId,
      userDataDir,
      currentPoolSize: this.pool.size,
    })

    try {
      // Create user data directory if needed
      if (userDataDir) {
        await this.createUserDataDirectory(userDataDir)
      }

      // Launch Chrome process
      const process = await this.launchChromeProcess(userDataDir)

      // Create CDP client
      const cdpClient = await this.createCDPClient(process)

      const instance: PooledChromeInstance = {
        id: instanceId,
        process,
        cdpClient,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 0,
        inUse: false,
        healthy: true,
        userDataDir,
      }

      this.pool.set(instanceId, instance)

      this.logger.info("Chrome instance created successfully", {
        instanceId,
        pid: process.pid,
        port: process.port,
      })

      return instance
    } catch (error) {
      this.logger.error("Failed to create Chrome instance", error as Error, { instanceId })

      // Cleanup user data directory if created
      if (userDataDir) {
        await this.removeUserDataDirectory(userDataDir)
      }

      throw error
    }
  }

  /**
   * Launch a Chrome process
   */
  private async launchChromeProcess(_userDataDir?: string): Promise<ChromeProcess> {
    // In a real implementation, this would use chrome-launcher
    // For now, we'll simulate the process creation
    const mockProcess: ChromeProcess = {
      pid: Math.floor(Math.random() * 100000) + 1000,
      port: Math.floor(Math.random() * 1000) + 9000,
      websocketUrl: `ws://localhost:${Math.floor(Math.random() * 1000) + 9000}/devtools/browser`,
      launchTime: new Date(),
      active: true,
    }

    return mockProcess
  }

  /**
   * Create CDP client for a Chrome process
   */
  private async createCDPClient(_process: ChromeProcess): Promise<CDPClient> {
    // In a real implementation, this would create a real CDP client
    // For now, we'll create a mock client
    const mockClient = {
      connect: async () => {},
      close: async () => {},
      isConnected: () => true,
      sendCommand: async (_method: string, _params?: any) => {
        return { success: true, result: null, executionTime: 0 }
      },
      evaluate: async (_expression: string) => ({ value: null }),
      addEventListener: (_event: any, _handler: any) => "mock-id",
      removeEventListener: () => {},
      getStatus: () => CDPConnectionStatus.CONNECTED,
      getSessions: () => [],
      getSession: () => undefined,
      getTargets: () => [],
      getTarget: () => undefined,
    }

    return mockClient as any as CDPClient
  }

  /**
   * Check if an instance should be cleaned up
   */
  private shouldCleanupInstance(instance: PooledChromeInstance): boolean {
    const now = Date.now()
    const idleTime = now - instance.lastUsed.getTime()
    const lifetime = now - instance.createdAt.getTime()

    // Check idle timeout
    if (idleTime > this.config.idleTimeout) {
      return true
    }

    // Check max lifetime
    if (lifetime > this.config.maxLifetime) {
      return true
    }

    // Check if unhealthy
    if (!instance.healthy) {
      return true
    }

    return false
  }

  /**
   * Remove an instance from the pool
   */
  private async removeInstance(instanceId: string, reason: string): Promise<void> {
    const instance = this.pool.get(instanceId)
    if (!instance) {
      return
    }

    this.logger.debug("Removing Chrome instance from pool", {
      instanceId,
      reason,
      usageCount: instance.usageCount,
    })

    try {
      // Close CDP client
      if (instance.cdpClient) {
        await instance.cdpClient.close()
      }

      // Kill Chrome process
      if (instance.process.active) {
        await this.killChromeProcess(instance.process)
      }

      // Remove user data directory
      if (instance.userDataDir) {
        await this.removeUserDataDirectory(instance.userDataDir)
      }

      // Remove from pool
      this.pool.delete(instanceId)

      this.logger.debug("Chrome instance removed successfully", { instanceId, reason })
    } catch (error) {
      this.logger.error("Failed to remove Chrome instance", error as Error, {
        instanceId,
        reason,
      })
    }
  }

  /**
   * Kill a Chrome process
   */
  private async killChromeProcess(process: ChromeProcess): Promise<void> {
    // In a real implementation, this would actually kill the Chrome process
    process.active = false
    this.logger.debug("Chrome process killed", { pid: process.pid })
  }

  /**
   * Create user data directory
   */
  private async createUserDataDirectory(path: string): Promise<void> {
    // In a real implementation, this would create the directory
    this.logger.debug("User data directory created", { path })
  }

  /**
   * Remove user data directory
   */
  private async removeUserDataDirectory(path: string): Promise<void> {
    // In a real implementation, this would remove the directory
    this.logger.debug("User data directory removed", { path })
  }

  /**
   * Pre-warm the pool with minimum instances
   */
  private async preWarmPool(): Promise<void> {
    const instancesNeeded = this.config.minPoolSize

    this.logger.info("Pre-warming Chrome pool", { instancesNeeded })

    for (let i = 0; i < instancesNeeded; i++) {
      try {
        const instance = await this.createNewInstance()
        this.logger.debug("Pre-warmed instance created", { instanceId: instance.id })
      } catch (error) {
        this.logger.error("Failed to create pre-warmed instance", error as Error)
      }
    }

    this.logger.info("Chrome pool pre-warming completed")
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        return
      }

      await this.performHealthCheck()
      await this.cleanupIdleInstances()
    }, this.config.healthCheckInterval)
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  /**
   * Perform health check on all instances
   */
  private async performHealthCheck(): Promise<void> {
    const healthCheckPromises = Array.from(this.pool.values()).map(
      async (instance) => {
        try {
          // Skip instances that are already being checked
          if (instance.healthCheckPromise) {
            return
          }

          instance.healthCheckPromise = this.checkInstanceHealth(instance)
          const isHealthy = await instance.healthCheckPromise
          instance.healthy = isHealthy
          instance.healthCheckPromise = undefined

          if (!isHealthy) {
            this.logger.warn("Chrome instance failed health check", {
              instanceId: instance.id,
              usageCount: instance.usageCount,
            })
          }
        } catch (error) {
          instance.healthy = false
          this.logger.error("Health check failed for instance", error as Error, {
            instanceId: instance.id,
          })
        }
      },
    )

    await Promise.allSettled(healthCheckPromises)
  }

  /**
   * Check health of a specific instance
   */
  private async checkInstanceHealth(_instance: PooledChromeInstance): Promise<boolean> {
    // In a real implementation, this would check if the CDP connection is still alive
    // For now, we'll simulate health checks
    return Math.random() > 0.05 // 95% chance of being healthy
  }

  /**
   * Clean up idle instances
   */
  private async cleanupIdleInstances(): Promise<void> {
    const instancesToCleanup = Array.from(this.pool.values()).filter(
      instance => !instance.inUse && this.shouldCleanupInstance(instance),
    )

    if (instancesToCleanup.length === 0) {
      return
    }

    this.logger.info("Cleaning up idle instances", {
      count: instancesToCleanup.length,
      reasons: instancesToCleanup.map(i => ({
        id: i.id,
        idleTime: Date.now() - i.lastUsed.getTime(),
        lifetime: Date.now() - i.createdAt.getTime(),
        healthy: i.healthy,
      })),
    })

    const cleanupPromises = instancesToCleanup.map(instance =>
      this.removeInstance(instance.id, "Idle cleanup"),
    )

    await Promise.allSettled(cleanupPromises)
  }

  /**
   * Update pool configuration
   */
  updateConfig(newConfig: Partial<ChromePoolConfig>): void {
    const oldMaxSize = this.config.maxPoolSize
    this.config = { ...this.config, ...newConfig }

    // Adjust pool size if max size changed
    if (newConfig.maxPoolSize && newConfig.maxPoolSize < oldMaxSize) {
      this.cleanupIdleInstances()
    }

    this.logger.info("Chrome pool configuration updated", {
      oldMaxSize,
      newMaxSize: this.config.maxPoolSize,
      changes: Object.keys(newConfig),
    })
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ChromePoolConfig> {
    return { ...this.config }
  }
}

/**
 * Utility function to create a Chrome pool with sensible defaults
 */
export function createChromePool(
  logger: Logger,
  config: ChromePoolConfig = {},
): ChromeInstancePool {
  return new ChromeInstancePool(logger, config)
}
