import { CDPClient } from "./CDPClient.js"
import type {
  CDPConnectionConfig,
  CDPConnectionPoolConfig,
  CDPLogger,
} from "./types.js"

/**
 * Pooled connection wrapper
 */
interface PooledConnection {
  id: string
  client: CDPClient
  createdAt: Date
  lastUsed: Date
  inUse: boolean
  healthy: boolean
  healthCheckTimer?: NodeJS.Timeout
}

/**
 * Chrome DevTools Protocol Connection Pool
 * Manages multiple CDP connections for efficient resource usage
 */
export class CDPConnectionPool {
  private config: CDPConnectionPoolConfig
  private logger: CDPLogger
  private connections = new Map<string, PooledConnection>()
  private waitingQueue: Array<{
    resolve: (client: CDPClient) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }> = []

  constructor(config: CDPConnectionPoolConfig, logger: CDPLogger) {
    this.config = {
      maxConnections: config.maxConnections ?? 5,
      connectionTimeout: config.connectionTimeout ?? 30000,
      idleTimeout: config.idleTimeout ?? 300000, // 5 minutes
      enableHealthChecks: config.enableHealthChecks ?? true,
      healthCheckInterval: config.healthCheckInterval ?? 60000, // 1 minute
    }
    this.logger = logger

    // Start cleanup timer for idle connections
    this.startCleanupTimer()
  }

  /**
   * Get a CDP client from the pool or create a new one
   */
  async acquire(targetUrl: string, additionalConfig?: Partial<CDPConnectionConfig>): Promise<CDPClient> {
    // Try to find an available healthy connection
    const availableConnection = this.findAvailableConnection(targetUrl)

    if (availableConnection) {
      availableConnection.inUse = true
      availableConnection.lastUsed = new Date()
      this.logger.debug(`Acquired existing connection: ${availableConnection.id}`)
      return availableConnection.client
    }

    // Check if we can create a new connection
    if (this.connections.size >= this.config.maxConnections) {
      // Wait for a connection to become available
      return this.waitForAvailableConnection(targetUrl, additionalConfig)
    }

    // Create new connection
    return this.createNewConnection(targetUrl, additionalConfig)
  }

  /**
   * Return a CDP client to the pool
   */
  release(client: CDPClient): void {
    const connection = Array.from(this.connections.values()).find(conn => conn.client === client)

    if (!connection) {
      this.logger.warn("Attempted to release unknown connection")
      return
    }

    connection.inUse = false
    connection.lastUsed = new Date()

    this.logger.debug(`Released connection: ${connection.id}`)

    // Check if there are waiting requests
    this.processWaitingQueue()
  }

  /**
   * Close a specific connection
   */
  async closeConnection(client: CDPClient): Promise<void> {
    const connection = Array.from(this.connections.values()).find(conn => conn.client === client)

    if (!connection) {
      return
    }

    // Clean up health check timer
    if (connection.healthCheckTimer) {
      clearInterval(connection.healthCheckTimer)
    }

    // Close the client
    await client.close()

    // Remove from pool
    this.connections.delete(connection.id)

    this.logger.info(`Closed connection: ${connection.id}`)
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(async (connection) => {
      try {
        if (connection.healthCheckTimer) {
          clearInterval(connection.healthCheckTimer)
        }
        await connection.client.close()
      } catch (error) {
        this.logger.warn(`Failed to close connection ${connection.id}`, error as Error)
      }
    })

    await Promise.allSettled(closePromises)
    this.connections.clear()

    // Clear waiting queue
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeout)
      waiter.reject(new Error("Connection pool is closing"))
    }
    this.waitingQueue.length = 0

    this.logger.info("Closed all connections in pool")
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalConnections: number
    activeConnections: number
    idleConnections: number
    healthyConnections: number
    waitingRequests: number
  } {
    const total = this.connections.size
    const active = Array.from(this.connections.values()).filter(conn => conn.inUse).length
    const idle = total - active
    const healthy = Array.from(this.connections.values()).filter(conn => conn.healthy).length
    const waiting = this.waitingQueue.length

    return {
      totalConnections: total,
      activeConnections: active,
      idleConnections: idle,
      healthyConnections: healthy,
      waitingRequests: waiting,
    }
  }

  /**
   * Find an available connection for the target URL
   */
  private findAvailableConnection(targetUrl: string): PooledConnection | undefined {
    return Array.from(this.connections.values()).find(conn =>
      !conn.inUse
      && conn.healthy
      && this.isConnectionConfigMatch(conn.client, targetUrl),
    )
  }

  /**
   * Check if connection config matches target URL
   */
  private isConnectionConfigMatch(_client: CDPClient, _targetUrl: string): boolean {
    // In a real implementation, this would check if the connection
    // can be reused for the target URL
    return true
  }

  /**
   * Wait for an available connection
   */
  private waitForAvailableConnection(
    _targetUrl: string,
    _additionalConfig?: Partial<CDPConnectionConfig>,
  ): Promise<CDPClient> {
    return new Promise<CDPClient>((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from waiting queue
        const index = this.waitingQueue.findIndex(waiter => waiter.resolve === resolve)
        if (index >= 0) {
          this.waitingQueue.splice(index, 1)
        }
        reject(new Error("Timeout waiting for available connection"))
      }, this.config.connectionTimeout)

      this.waitingQueue.push({
        resolve,
        reject,
        timeout,
      })

      this.logger.debug(`Added request to waiting queue. Queue length: ${this.waitingQueue.length}`)
    })
  }

  /**
   * Process waiting queue when connection becomes available
   */
  private processWaitingQueue(): void {
    if (this.waitingQueue.length === 0) {
      return
    }

    const waiter = this.waitingQueue.shift()
    if (!waiter) {
      return
    }

    clearTimeout(waiter.timeout)

    // Try to find or create a connection
    const availableConnection = Array.from(this.connections.values()).find(conn =>
      !conn.inUse && conn.healthy,
    )

    if (availableConnection) {
      availableConnection.inUse = true
      availableConnection.lastUsed = new Date()
      waiter.resolve(availableConnection.client)
      this.logger.debug("Satisfied waiting request with available connection")
    } else {
      // Put back in queue and try again later
      this.waitingQueue.unshift(waiter)
      this.logger.debug("No available connection for waiting request")
    }
  }

  /**
   * Create a new connection
   */
  private async createNewConnection(
    targetUrl: string,
    additionalConfig?: Partial<CDPConnectionConfig>,
  ): Promise<CDPClient> {
    const connectionId = this.generateConnectionId()
    const connectionConfig: CDPConnectionConfig = {
      targetUrl,
      ...additionalConfig,
    }

    const client = new CDPClient(connectionConfig, this.logger)

    // Connect the client
    await client.connect()

    const connection: PooledConnection = {
      id: connectionId,
      client,
      createdAt: new Date(),
      lastUsed: new Date(),
      inUse: true,
      healthy: true,
    }

    this.connections.set(connectionId, connection)

    // Start health checks if enabled
    if (this.config.enableHealthChecks) {
      this.startHealthChecks(connection)
    }

    this.logger.info(`Created new connection: ${connectionId}`)
    return client
  }

  /**
   * Start health checks for a connection
   */
  private startHealthChecks(connection: PooledConnection): void {
    connection.healthCheckTimer = setInterval(async () => {
      try {
        if (!connection.client.isConnected()) {
          connection.healthy = false
          this.logger.warn(`Connection ${connection.id} is unhealthy - not connected`)
          return
        }

        // Perform a simple health check - evaluate a simple expression
        await connection.client.evaluate("true")
        connection.healthy = true
      } catch (error) {
        connection.healthy = false
        this.logger.warn(`Health check failed for connection ${connection.id}`, error as Error)
      }
    }, this.config.healthCheckInterval)
  }

  /**
   * Start cleanup timer for idle connections
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupIdleConnections()
    }, this.config.idleTimeout / 2) // Check half as often as the idle timeout
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = new Date()
    const connectionsToRemove: PooledConnection[] = []

    for (const connection of this.connections.values()) {
      if (!connection.inUse) {
        const idleTime = now.getTime() - connection.lastUsed.getTime()

        if (idleTime > this.config.idleTimeout) {
          connectionsToRemove.push(connection)
        }
      }
    }

    if (connectionsToRemove.length > 0) {
      this.logger.info(`Cleaning up ${connectionsToRemove.length} idle connections`)

      for (const connection of connectionsToRemove) {
        await this.closeConnection(connection.client)
      }
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
