/**
 * Node.js CDP Manager Implementation
 *
 * Implements ICDPManager interface for Node.js environment using
 * chrome-launcher for process management and chrome-remote-interface
 * for CDP communication.
 */

import process from "node:process"

import CDP from "chrome-remote-interface"

import { CDPClient } from "../../architecture/adapters/cdp/CDPClient.js"
import {
  CDPConnectionStatus,
} from "../../architecture/adapters/cdp/types.js"
import type {
  CDPEvents,
  CDPSession,
  CDPTarget,
} from "../../architecture/adapters/cdp/types.js"
import type { Logger } from "../../architecture/strategies/types.js"
import { CDPEnvironment } from "../cdp-manager.interface.js"
import type {
  CDPCapabilities,
  CDPCommandOptions,
  CDPConnectionConfig,
  CDPManagerConfig,
  CDPManagerStats,
  CDPSessionOptions,
  CDPTargetOptions,
  ICDPManager,
} from "../cdp-manager.interface.js"

import { ChromeLauncher } from "./chrome-launcher.js"
import type { ChromeProcessInfo } from "./chrome-launcher.js"

/**
 * Node.js CDP Manager
 *
 * Provides Chrome DevTools Protocol management for Node.js environment
 * with secure Chrome process launching and robust connection handling.
 */
export class NodeCDPManager implements ICDPManager {
  private config: Required<CDPManagerConfig>
  private chromeLauncher: ChromeLauncher
  private cdpClient?: CDPClient
  private connectionStatus: CDPConnectionStatus = CDPConnectionStatus.DISCONNECTED
  private sessions = new Map<string, CDPSession>()
  private targets = new Map<string, CDPTarget>()
  private eventListeners = new Map<string, Set<(params: any) => void>>()
  private chromeProcess?: ChromeProcessInfo
  private criClient?: CDP.Client
  private connectionUrl?: string
  private stats: CDPManagerStats
  private startTime = new Date()
  private isInitialized = false

  constructor(config: CDPManagerConfig = {}) {
    this.config = {
      connectionTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      autoReconnect: true,
      idleTimeout: 300000,
      enablePooling: false,
      maxPoolSize: 1,
      chromeFlags: [],
      userDataDir: "",
      headless: true,
      reuseExisting: true,
      logger: this.createDefaultLogger(),
      ...config,
    }

    this.chromeLauncher = new ChromeLauncher({
      chromeFlags: this.config.chromeFlags,
      headless: this.config.headless,
      userDataDir: this.config.userDataDir,
      reuseExisting: this.config.reuseExisting,
      logger: this.config.logger,
    })

    this.stats = {
      status: CDPConnectionStatus.DISCONNECTED,
      activeConnections: 0,
      activeSessions: 0,
      availableTargets: 0,
      totalCommands: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      failedCommands: 0,
      successRate: 100,
      uptime: 0,
      lastActivity: new Date(),
    }

    this.setupProcessCleanup()
  }

  /**
   * Initialize the CDP manager
   */
  async initialize(config?: CDPManagerConfig): Promise<void> {
    if (this.isInitialized) {
      this.config.logger?.info("NodeCDPManager already initialized")
      return
    }

    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.config.logger?.info("Initializing NodeCDPManager", {
      headless: this.config.headless,
      reuseExisting: this.config.reuseExisting,
      enablePooling: this.config.enablePooling,
    })

    try {
      // Initialize Chrome launcher
      // Note: Chrome will be launched on first connect if needed
      this.isInitialized = true
      this.updateConnectionStatus(CDPConnectionStatus.DISCONNECTED)

      this.config.logger?.info("NodeCDPManager initialized successfully")
    } catch (error) {
      this.config.logger?.error("Failed to initialize NodeCDPManager", error as Error)
      throw new Error(`NodeCDPManager initialization failed: ${(error as Error).message}`)
    }
  }

  /**
   * Connect to CDP target or launch new Chrome instance
   */
  async connect(targetUrl?: string, _config?: CDPConnectionConfig): Promise<CDPClient> {
    if (this.cdpClient && this.connectionStatus === CDPConnectionStatus.CONNECTED) {
      this.config.logger?.debug("Already connected to CDP target")
      return this.cdpClient
    }

    this.updateConnectionStatus(CDPConnectionStatus.CONNECTING)
    this.config.logger?.info("Connecting to CDP target", { targetUrl })

    try {
      // Launch Chrome if not already running
      if (!this.chromeProcess || !this.chromeLauncher.isProcessActive(this.chromeProcess.pid)) {
        this.chromeProcess = await this.chromeLauncher.launch()
        this.config.logger?.info("Chrome launched", {
          pid: this.chromeProcess.pid,
          port: this.chromeProcess.port,
          websocketUrl: this.chromeProcess.websocketUrl,
        })
      }

      // Connect to CDP using chrome-remote-interface
      this.criClient = await CDP({
        port: this.chromeProcess.port,
        host: "localhost",
        target: targetUrl || undefined,
      })

      // Create CDP client adapter
      this.cdpClient = this.createCDPClientAdapter()

      // Enable required domains
      await this.enableDomains()

      // Get initial targets
      await this.refreshTargets()

      this.updateConnectionStatus(CDPConnectionStatus.CONNECTED)
      this.stats.activeConnections = 1
      this.stats.lastActivity = new Date()

      this.config.logger?.info("Connected to CDP target successfully", {
        port: this.chromeProcess.port,
        targetUrl,
      })

      return this.cdpClient
    } catch (error) {
      this.updateConnectionStatus(CDPConnectionStatus.ERROR)
      this.config.logger?.error("Failed to connect to CDP target", error as Error, { targetUrl })

      if (this.config.autoReconnect) {
        this.scheduleReconnect()
      }

      throw new Error(`CDP connection failed: ${(error as Error).message}`)
    }
  }

  /**
   * Disconnect from CDP target
   */
  async disconnect(): Promise<void> {
    this.config.logger?.info("Disconnecting from CDP target")

    try {
      // Close CRI client
      if (this.criClient) {
        await this.criClient.close()
        this.criClient = undefined
      }

      // Clear client
      this.cdpClient = undefined

      // Clear sessions and targets
      this.sessions.clear()
      this.targets.clear()

      // Update status
      this.updateConnectionStatus(CDPConnectionStatus.DISCONNECTED)
      this.stats.activeConnections = 0

      this.config.logger?.info("Disconnected from CDP target successfully")
    } catch (error) {
      this.config.logger?.error("Error during disconnection", error as Error)
    }
  }

  /**
   * Check if connected to CDP target
   */
  isConnected(): boolean {
    return this.connectionStatus === CDPConnectionStatus.CONNECTED && !!this.cdpClient
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): CDPConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Execute CDP command
   */
  async executeCommand(method: string, params?: any, options?: CDPCommandOptions): Promise<any> {
    if (!this.cdpClient) {
      throw new Error("Not connected to CDP target")
    }

    const startTime = performance.now()
    this.stats.totalCommands++
    this.stats.lastActivity = new Date()

    try {
      const result = await this.cdpClient.sendCommand(method, params)

      const executionTime = performance.now() - startTime
      this.stats.totalExecutionTime += executionTime
      this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.totalCommands

      this.config.logger?.debug("CDP command executed successfully", {
        method,
        executionTime: Math.round(executionTime),
      })

      return result
    } catch (error) {
      this.stats.failedCommands++
      this.stats.successRate = ((this.stats.totalCommands - this.stats.failedCommands) / this.stats.totalCommands) * 100

      this.config.logger?.error("CDP command failed", error as Error, { method })

      if (options?.throwOnError !== false) {
        throw error
      }

      return null
    }
  }

  /**
   * Evaluate JavaScript expression
   */
  async evaluate(expression: string, options?: any): Promise<any> {
    if (!this.cdpClient) {
      throw new Error("Not connected to CDP target")
    }

    this.stats.lastActivity = new Date()

    return await this.cdpClient.evaluate(expression, options)
  }

  /**
   * Add event listener for CDP events
   */
  addEventListener<T extends keyof CDPEvents>(event: T, handler: (params: CDPEvents[T]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(handler as any)

    // Forward to CRI client if available
    if (this.criClient) {
      this.criClient.on(event as string, handler as any)

      // Enable domain if needed
      const domain = event.toString().split(".")[0]
      if (domain && (this.criClient as any)[domain] && (this.criClient as any)[domain].enable) {
        ;(this.criClient as any)[domain].enable().catch((error: Error) => {
          this.config.logger?.warn(`Failed to enable domain ${domain}`, error)
        })
      }
    }

    this.config.logger?.debug(`Added event listener for: ${event}`)
  }

  /**
   * Remove event listener
   */
  removeEventListener<T extends keyof CDPEvents>(event: T, handler: (params: CDPEvents[T]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(handler as any)
      if (listeners.size === 0) {
        this.eventListeners.delete(event)
      }
    }

    // CRI doesn't support off() - listeners are managed internally

    this.config.logger?.debug(`Removed event listener for: ${event}`)
  }

  /**
   * Get list of available targets
   */
  async getTargets(): Promise<CDPTarget[]> {
    if (!this.criClient) {
      return []
    }

    try {
      const targets = await this.criClient.Target.getTargets()

      // Update internal targets cache
      for (const target of targets.targetInfos) {
        this.targets.set(target.targetId, {
          targetId: target.targetId,
          type: target.type,
          title: target.title,
          url: target.url,
          attached: target.attached,
          createdTime: 0, // Not provided by CRI
        })
      }

      this.stats.availableTargets = this.targets.size
      return Array.from(this.targets.values())
    } catch (error) {
      this.config.logger?.error("Failed to get targets", error as Error)
      return []
    }
  }

  /**
   * Get target by ID
   */
  async getTarget(targetId: string): Promise<CDPTarget | null> {
    if (!this.criClient) {
      return null
    }

    // Check cache first
    const cached = this.targets.get(targetId)
    if (cached) {
      return cached
    }

    // Refresh targets and try again
    await this.getTargets()
    return this.targets.get(targetId) || null
  }

  /**
   * Create new target
   */
  async createTarget(options?: CDPTargetOptions): Promise<CDPTarget> {
    if (!this.criClient) {
      throw new Error("Not connected to CDP target")
    }

    try {
      const url = options?.url || "about:blank"
      const result = await this.criClient.Target.createTarget({ url })

      const target: CDPTarget = {
        targetId: result.targetId,
        type: "page",
        title: "",
        url,
        attached: false,
        createdTime: Date.now(),
      }

      this.targets.set(result.targetId, target)
      this.stats.availableTargets = this.targets.size

      this.config.logger?.info("Created new target", { targetId: result.targetId, url })

      return target
    } catch (error) {
      this.config.logger?.error("Failed to create target", error as Error, { options })
      throw error
    }
  }

  /**
   * Close target
   */
  async closeTarget(targetId: string): Promise<void> {
    if (!this.criClient) {
      throw new Error("Not connected to CDP target")
    }

    try {
      await this.criClient.Target.closeTarget({ targetId })

      this.targets.delete(targetId)
      this.stats.availableTargets = this.targets.size

      this.config.logger?.info("Closed target", { targetId })
    } catch (error) {
      this.config.logger?.error("Failed to close target", error as Error, { targetId })
      throw error
    }
  }

  /**
   * Create session for target
   */
  async createSession(options?: CDPSessionOptions): Promise<CDPSession> {
    if (!this.criClient) {
      throw new Error("Not connected to CDP target")
    }

    try {
      const targetId = options?.targetId || (await this.getTargets())[0]?.targetId
      if (!targetId) {
        throw new Error("No target available for session")
      }

      const { sessionId } = await this.criClient.Target.attachToTarget({
        targetId,
        flatten: true,
      })

      const session: CDPSession = {
        sessionId,
        targetId,
        createdAt: new Date(),
        isActive: true,
        lastActivity: new Date(),
      }

      this.sessions.set(sessionId, session)
      this.stats.activeSessions = this.sessions.size

      this.config.logger?.info("Created session", { sessionId, targetId })

      return session
    } catch (error) {
      this.config.logger?.error("Failed to create session", error as Error, { options })
      throw error
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<CDPSession | null> {
    return this.sessions.get(sessionId) || null
  }

  /**
   * Get all active sessions
   */
  async getSessions(): Promise<CDPSession[]> {
    return Array.from(this.sessions.values())
  }

  /**
   * Close session
   */
  async closeSession(sessionId: string): Promise<void> {
    if (!this.criClient) {
      return
    }

    try {
      await this.criClient.Target.detachFromTarget({ sessionId })

      const session = this.sessions.get(sessionId)
      if (session) {
        session.isActive = false
        this.sessions.delete(sessionId)
        this.stats.activeSessions = this.sessions.size
      }

      this.config.logger?.info("Closed session", { sessionId })
    } catch (error) {
      this.config.logger?.error("Failed to close session", error as Error, { sessionId })
    }
  }

  /**
   * Get current environment type
   */
  getEnvironment(): CDPEnvironment {
    return CDPEnvironment.NODE
  }

  /**
   * Get supported capabilities
   */
  getCapabilities(): CDPCapabilities {
    return {
      canLaunchChrome: true,
      canManageTabs: true,
      supportsPooling: this.config.enablePooling,
      supportsIsolation: true,
      availableDomains: ["Page", "Runtime", "Network", "DOM", "Input", "Emulation", "Target"],
      maxConnections: this.config.maxPoolSize,
      features: {
        screenshots: true,
        pageCapture: true,
        networkInterception: true,
        javascriptExecution: true,
        domManipulation: true,
        emulation: true,
      },
    }
  }

  /**
   * Get manager statistics
   */
  getStats(): CDPManagerStats {
    this.stats.uptime = Date.now() - this.startTime.getTime()
    this.stats.status = this.connectionStatus
    this.stats.activeSessions = this.sessions.size
    this.stats.availableTargets = this.targets.size

    return { ...this.stats }
  }

  /**
   * Clear all resources and cleanup
   */
  async cleanup(): Promise<void> {
    this.config.logger?.info("Cleaning up NodeCDPManager")

    try {
      // Disconnect
      await this.disconnect()

      // Kill Chrome process
      if (this.chromeProcess) {
        await this.chromeLauncher.kill(this.chromeProcess.pid)
        this.chromeProcess = undefined
      }

      // Shutdown launcher
      await this.chromeLauncher.shutdown()

      // Clear event listeners
      this.eventListeners.clear()

      this.isInitialized = false
      this.config.logger?.info("NodeCDPManager cleaned up successfully")
    } catch (error) {
      this.config.logger?.error("Error during cleanup", error as Error)
    }
  }

  /**
   * Restart the CDP manager
   */
  async restart(config?: CDPManagerConfig): Promise<void> {
    this.config.logger?.info("Restarting NodeCDPManager")

    await this.cleanup()

    if (config) {
      this.config = { ...this.config, ...config }
    }

    await this.initialize()
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CDPManagerConfig>): void {
    this.config = { ...this.config, ...config }

    // Update Chrome launcher config
    if (config.chromeFlags || config.headless !== undefined || config.userDataDir !== undefined) {
      // Note: ChromeLauncher doesn't support config updates after initialization
      this.config.logger?.warn("Chrome launcher config changes require restart")
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CDPManagerConfig {
    return { ...this.config }
  }

  /**
   * Enable required CDP domains
   */
  private async enableDomains(): Promise<void> {
    if (!this.criClient) {
      return
    }

    try {
      await Promise.all([
        this.criClient.Page.enable(),
        this.criClient.Runtime.enable(),
        this.criClient.Network.enable(),
        this.criClient.DOM.enable().catch(() => null), // DOM might not be available for all targets
      ])

      this.config.logger?.debug("CDP domains enabled successfully")
    } catch (error) {
      this.config.logger?.warn("Failed to enable some CDP domains", error)
    }
  }

  /**
   * Refresh targets list
   */
  private async refreshTargets(): Promise<void> {
    try {
      await this.getTargets()
    } catch (error) {
      this.config.logger?.warn("Failed to refresh targets", error)
    }
  }

  /**
   * Create CDP client adapter
   */
  private createCDPClientAdapter(): CDPClient {
    const cdpConfig: CDPConnectionConfig = {
      targetUrl: this.connectionUrl || "",
      timeout: this.config.connectionTimeout,
      maxRetries: this.config.maxRetries,
    }
    return new ChromeRemoteInterfaceAdapter(this.criClient!, this.config.logger!, cdpConfig)
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(status: CDPConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.config.logger?.debug(`Connection status changed: ${this.connectionStatus} -> ${status}`)
      this.connectionStatus = status
      this.stats.status = status
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    // TODO: Implement reconnection logic
    this.config.logger?.info("Reconnection scheduled (not implemented)")
  }

  /**
   * Setup process cleanup handlers
   */
  private setupProcessCleanup(): void {
    const cleanup = async () => {
      await this.cleanup()
    }

    process.once("exit", cleanup)
    process.once("SIGINT", cleanup)
    process.once("SIGTERM", cleanup)
    process.once("uncaughtException", cleanup)
    process.once("unhandledRejection", cleanup)
  }

  /**
   * Create default logger instance
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, context?: any) => {
        if (process.env.NODE_ENV === "development") {
          console.debug(`[NodeCDPManager] ${message}`, context || "")
        }
      },
      info: (message: string, context?: any) => {
        console.info(`[NodeCDPManager] ${message}`, context || "")
      },
      warn: (message: string, context?: any) => {
        console.warn(`[NodeCDPManager] ${message}`, context || "")
      },
      error: (message: string, context?: any) => {
        console.error(`[NodeCDPManager] ${message}`, context || "")
      },
    }
  }
}

/**
 * Chrome Remote Interface Adapter
 *
 * Adapts chrome-remote-interface client to work with our CDPClient base class
 */
class ChromeRemoteInterfaceAdapter extends CDPClient {
  private criClient: CDP.Client
  private eventHandlers = new Map<string, Set<(...args: any[]) => void>>()

  constructor(criClient: CDP.Client, logger: Logger, config: CDPConnectionConfig) {
    super(config, logger)
    this.criClient = criClient
  }

  async connect(): Promise<void> {
    // CRI client is already connected, just call parent
    // Parent will set status to CONNECTED
  }

  async close(): Promise<void> {
    // Clear tracked handlers (CRI will clean up on close)
    this.eventHandlers.clear()

    await this.criClient.close()
    await super.close()
  }

  async evaluate(expression: string, options: any = {}): Promise<any> {
    const result = await this.criClient.Runtime.evaluate({
      expression,
      awaitPromise: true,
      returnByValue: true,
      includeCommandLineAPI: false,
      silent: false,
      ...options,
    })

    if (result.result?.subtype === "error") {
      throw new Error(result.result.description || "Evaluation error")
    }

    return result.result?.value
  }

  async sendCommand(method: string, params: any = {}): Promise<any> {
    const startTime = performance.now()

    try {
      // Handle domain-specific commands
      const [domain, command] = method.split(".")
      if (!domain || !command || !(this.criClient as any)[domain]) {
        throw new Error(`Unknown CDP method: ${method}`)
      }

      const result = await (this.criClient as any)[domain][command](params)

      const executionTime = performance.now() - startTime

      return {
        result,
        success: true,
        executionTime,
      }
    } catch (error) {
      const executionTime = performance.now() - startTime

      return {
        result: null,
        success: false,
        error: (error as Error).message,
        executionTime,
      }
    }
  }

  addEventListener<T extends keyof CDPEvents>(event: T, handler: (params: CDPEvents[T]) => void): string {
    const wrappedHandler = (params: any) => handler(params)

    if (!this.eventHandlers.has(event as string)) {
      this.eventHandlers.set(event as string, new Set())
    }
    this.eventHandlers.get(event as string)!.add(wrappedHandler)

    this.criClient.on(event as string, wrappedHandler)
    return super.addEventListener(event, handler)
  }

  removeEventListener<T extends keyof CDPEvents>(event: T, handler: (params: CDPEvents[T]) => void): void {
    const handlers = this.eventHandlers.get(event as string)
    if (handlers) {
      // Clear tracked handlers for this event (CRI manages actual listeners)
      handlers.clear()
    }
    super.removeEventListener(event, handler)
  }
}
