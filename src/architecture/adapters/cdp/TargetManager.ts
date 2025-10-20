import type { CDPClient } from "./CDPClient.js"
import type { CDPConnectionPool } from "./ConnectionPool.js"
import type { CDPEventManager } from "./EventManager.js"
import type { CDPResourceManager } from "./ResourceManager.js"
import { ResourceType } from "./ResourceManager.js"
import type {
  CDPLogger,
  CDPSession,
  CDPTarget,
} from "./types.js"

/**
 * Target filtering options
 */
export interface TargetFilterOptions {
  type?: string
  url?: string | RegExp
  title?: string | RegExp
  attached?: boolean
  excludeType?: string[]
  includeOnlyAttached?: boolean
}

/**
 * Session creation options
 */
export interface SessionOptions {
  /** Whether to automatically enable required domains */
  autoEnableDomains?: boolean
  /** Domains to enable */
  domains?: string[]
  /** Custom session configuration */
  config?: any
}

/**
 * Target and Session Manager
 * Manages multiple CDP targets and their sessions
 */
export class CDPTargetManager {
  private logger: CDPLogger
  private connectionPool: CDPConnectionPool
  private eventManager: CDPEventManager
  private resourceManager: CDPResourceManager
  private targets = new Map<string, CDPTarget>()
  private sessions = new Map<string, CDPSession>()
  private targetClients = new Map<string, CDPClient>()
  private sessionClients = new Map<string, CDPClient>()

  constructor(
    connectionPool: CDPConnectionPool,
    eventManager: CDPEventManager,
    resourceManager: CDPResourceManager,
    logger: CDPLogger,
  ) {
    this.connectionPool = connectionPool
    this.eventManager = eventManager
    this.resourceManager = resourceManager
    this.logger = logger

    this.setupEventHandlers()
  }

  /**
   * Discover available targets
   */
  async discoverTargets(filter?: TargetFilterOptions): Promise<CDPTarget[]> {
    this.logger.info("Discovering CDP targets")

    // Get a client to query for targets
    const client = await this.connectionPool.acquire("ws://localhost:9222")

    try {
      const result = await client.sendCommand("Target.getTargets", {})
      let targets: CDPTarget[] = result.result.targetInfos || []

      // Apply filters
      if (filter) {
        targets = this.applyTargetFilters(targets, filter)
      }

      // Update internal target cache
      for (const target of targets) {
        this.targets.set(target.targetId, target)
      }

      this.logger.info(`Discovered ${targets.length} targets`)
      return targets
    } finally {
      this.connectionPool.release(client)
    }
  }

  /**
   * Get target by ID
   */
  getTarget(targetId: string): CDPTarget | undefined {
    return this.targets.get(targetId)
  }

  /**
   * Get all targets
   */
  getAllTargets(): CDPTarget[] {
    return Array.from(this.targets.values())
  }

  /**
   * Get targets matching filter criteria
   */
  getFilteredTargets(filter: TargetFilterOptions): CDPTarget[] {
    const allTargets = Array.from(this.targets.values())
    return this.applyTargetFilters(allTargets, filter)
  }

  /**
   * Attach to a target
   */
  async attachToTarget(targetId: string, options: SessionOptions = {}): Promise<CDPSession> {
    this.logger.info(`Attaching to target: ${targetId}`)

    // Check if session already exists
    const existingSession = this.sessions.get(targetId)
    if (existingSession && existingSession.isActive) {
      this.logger.warn(`Already attached to target: ${targetId}`)
      return existingSession
    }

    // Get client for the target
    const client = await this.connectionPool.acquire(`ws://localhost:9222/devtools/page/${targetId}`)

    try {
      // Attach to target
      const result = await client.sendCommand("Target.attachToTarget", {
        targetId,
        flatten: true,
      })

      const sessionId = result.result.sessionId
      const target = this.targets.get(targetId)

      if (!target) {
        throw new Error(`Target not found: ${targetId}`)
      }

      const session: CDPSession = {
        sessionId,
        targetId,
        createdAt: new Date(),
        isActive: true,
        lastActivity: new Date(),
      }

      // Store session and client mappings
      this.sessions.set(sessionId, session)
      this.sessionClients.set(sessionId, client)
      this.targetClients.set(targetId, client)

      // Auto-enable domains if requested
      if (options.autoEnableDomains) {
        await this.enableSessionDomains(sessionId, options.domains)
      }

      // Register session for cleanup
      this.resourceManager.registerResource(
        session,
        ResourceType.CLIENT,
        `session-${sessionId}`,
        async () => await this.detachFromTarget(targetId),
        { maxCleanupAttempts: 3 },
      )

      this.logger.info(`Successfully attached to target: ${targetId}`)
      return session
    } catch (error) {
      this.connectionPool.release(client)
      throw error
    }
  }

  /**
   * Detach from a target
   */
  async detachFromTarget(targetId: string): Promise<void> {
    this.logger.info(`Detaching from target: ${targetId}`)

    const target = this.targets.get(targetId)
    if (!target) {
      this.logger.warn(`Target not found: ${targetId}`)
      return
    }

    const client = this.targetClients.get(targetId)
    if (!client) {
      this.logger.warn(`No client found for target: ${targetId}`)
      return
    }

    try {
      // Find session for this target
      const session = Array.from(this.sessions.values()).find(s => s.targetId === targetId)
      if (session) {
        await client.sendCommand("Target.detachFromTarget", {
          sessionId: session.sessionId,
        })

        // Mark session as inactive
        session.isActive = false
        this.sessions.delete(session.sessionId)
        this.sessionClients.delete(session.sessionId)
      }

      this.targetClients.delete(targetId)
      this.connectionPool.release(client)

      this.logger.info(`Successfully detached from target: ${targetId}`)
    } catch (error) {
      this.logger.error(`Error detaching from target: ${targetId}`, error as Error)
    }
  }

  /**
   * Execute command in target session
   */
  async executeInTarget(
    targetId: string,
    method: string,
    params: any = {},
  ): Promise<any> {
    const client = this.targetClients.get(targetId)
    if (!client) {
      throw new Error(`Not attached to target: ${targetId}`)
    }

    const session = Array.from(this.sessions.values()).find(s => s.targetId === targetId)
    if (!session || !session.isActive) {
      throw new Error(`No active session for target: ${targetId}`)
    }

    // Update session activity
    session.lastActivity = new Date()

    return await client.sendCommand(method, {
      ...params,
      sessionId: session.sessionId,
    })
  }

  /**
   * Execute JavaScript in target
   */
  async evaluateInTarget(
    targetId: string,
    expression: string,
    options: any = {},
  ): Promise<any> {
    return await this.executeInTarget(targetId, "Runtime.evaluate", {
      expression,
      ...options,
    })
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CDPSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): CDPSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive)
  }

  /**
   * Get sessions for a target
   */
  getTargetSessions(targetId: string): CDPSession[] {
    return Array.from(this.sessions.values()).filter(session => session.targetId === targetId)
  }

  /**
   * Close target
   */
  async closeTarget(targetId: string): Promise<void> {
    this.logger.info(`Closing target: ${targetId}`)

    // First detach from target
    await this.detachFromTarget(targetId)

    // Then close the target
    const client = await this.connectionPool.acquire("ws://localhost:9222")
    try {
      await client.sendCommand("Target.closeTarget", { targetId })
      this.targets.delete(targetId)
    } finally {
      this.connectionPool.release(client)
    }
  }

  /**
   * Create new target
   */
  async createTarget(url: string, options: any = {}): Promise<CDPTarget> {
    this.logger.info(`Creating new target with URL: ${url}`)

    const client = await this.connectionPool.acquire("ws://localhost:9222")
    try {
      const result = await client.sendCommand("Target.createTarget", {
        url,
        ...options,
      })

      const targetId = result.result.targetId
      const target: CDPTarget = {
        targetId,
        type: "page",
        title: "",
        url,
        attached: false,
        createdTime: Date.now(),
      }

      this.targets.set(targetId, target)
      this.logger.info(`Created target: ${targetId}`)

      return target
    } finally {
      this.connectionPool.release(client)
    }
  }

  /**
   * Activate target (bring to front)
   */
  async activateTarget(targetId: string): Promise<void> {
    const client = await this.connectionPool.acquire("ws://localhost:9222")
    try {
      await client.sendCommand("Target.activateTarget", { targetId })
      this.logger.debug(`Activated target: ${targetId}`)
    } finally {
      this.connectionPool.release(client)
    }
  }

  /**
   * Get target manager statistics
   */
  getStats(): {
    totalTargets: number
    activeSessions: number
    attachedTargets: number
    targetTypes: { [type: string]: number }
  } {
    const targetTypes: { [type: string]: number } = {}

    for (const target of this.targets.values()) {
      targetTypes[target.type] = (targetTypes[target.type] || 0) + 1
    }

    return {
      totalTargets: this.targets.size,
      activeSessions: this.getAllSessions().length,
      attachedTargets: this.targetClients.size,
      targetTypes,
    }
  }

  /**
   * Setup event handlers for target management
   */
  private setupEventHandlers(): void {
    this.eventManager.on("Target.targetCreated" as any, (params: any) => {
      this.targets.set(params.targetInfo.targetId, params.targetInfo)
      this.logger.debug(`Target created: ${params.targetInfo.targetId}`)
    })

    this.eventManager.on("Target.targetDestroyed" as any, (params: any) => {
      this.targets.delete(params.targetId)
      this.logger.debug(`Target destroyed: ${params.targetId}`)
    })

    this.eventManager.on("Target.targetInfoChanged" as any, (params: any) => {
      this.targets.set(params.targetInfo.targetId, params.targetInfo)
      this.logger.debug(`Target info changed: ${params.targetInfo.targetId}`)
    })

    this.eventManager.on("Target.detachedFromTarget" as any, (params: any) => {
      const session = this.sessions.get(params.sessionId)
      if (session) {
        session.isActive = false
        this.sessions.delete(params.sessionId)
        this.sessionClients.delete(params.sessionId)
        this.logger.debug(`Detached from target: ${params.targetId}`)
      }
    })
  }

  /**
   * Apply filters to target list
   */
  private applyTargetFilters(targets: CDPTarget[], filter: TargetFilterOptions): CDPTarget[] {
    return targets.filter((target) => {
      // Filter by type
      if (filter.type && target.type !== filter.type) {
        return false
      }

      // Filter by URL
      if (filter.url) {
        if (filter.url instanceof RegExp) {
          if (!filter.url.test(target.url)) {
            return false
          }
        } else if (!target.url.includes(filter.url)) {
          return false
        }
      }

      // Filter by title
      if (filter.title) {
        if (filter.title instanceof RegExp) {
          if (!filter.title.test(target.title)) {
            return false
          }
        } else if (!target.title.includes(filter.title)) {
          return false
        }
      }

      // Filter by attachment status
      if (filter.attached !== undefined && target.attached !== filter.attached) {
        return false
      }

      // Exclude specific types
      if (filter.excludeType && filter.excludeType.includes(target.type)) {
        return false
      }

      // Include only attached targets
      if (filter.includeOnlyAttached && !target.attached) {
        return false
      }

      return true
    })
  }

  /**
   * Enable domains for a session
   */
  private async enableSessionDomains(sessionId: string, domains?: string[]): Promise<void> {
    const client = this.sessionClients.get(sessionId)
    if (!client) {
      return
    }

    const defaultDomains = ["Page", "Runtime", "Network", "DOM"]
    const domainsToEnable = domains || defaultDomains

    for (const domain of domainsToEnable) {
      try {
        await client.sendCommand(`${domain}.enable`, {})
        this.logger.debug(`Enabled domain: ${domain} for session: ${sessionId}`)
      } catch (error) {
        this.logger.warn(`Failed to enable domain: ${domain}`, error as Error)
      }
    }
  }
}
