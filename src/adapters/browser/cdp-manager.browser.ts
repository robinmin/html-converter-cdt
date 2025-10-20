/**
 * Browser Extension CDP Manager Implementation
 *
 * Implements ICDPManager interface for browser extension environment using
 * Chrome extension debugging API for tab attachment and command execution.
 */

import type { CDPClient } from "../../architecture/adapters/cdp/CDPClient.js"
// Declare Chrome API types for browser extension environment
import {
  CDPConnectionStatus,
} from "../../architecture/adapters/cdp/types.js"
import type {
  CDPConnectionConfig,
  CDPEvents,
  CDPSession,
  CDPTarget,
} from "../../architecture/adapters/cdp/types.js"
import type { Logger } from "../../architecture/strategies/types.js"
import {
  CDPEnvironment,
} from "../cdp-manager.interface.js"
import type {
  CDPCapabilities,
  CDPCommandOptions,
  CDPManagerConfig,
  CDPManagerStats,
  CDPSessionOptions,
  CDPTargetOptions,
  ICDPManager,
} from "../cdp-manager.interface.js"

declare const chrome: {
  runtime: {
    lastError?: {
      message: string
    }
  }
  debugger: any
  tabs: any
}

/**
 * Chrome extension debugging API types
 */
interface ChromeDebugger {
  sendCommand: (
    targetId: string,
    method: string,
    commandParams?: any,
    callback?: (result: any) => void
  ) => void
  attach: (targetId: string, requiredVersion: string, callback?: (result: any) => void) => void
  detach: (targetId: string, callback?: (result: any) => void) => void
  getTargets: (callback?: (result: { targetInfo: ChromeDebugTarget[] }) => void) => void
  onEvent: {
    addListener: (targetId: string, method: string, listener: (params: any) => void) => void
    removeListener: (targetId: string, method: string, listener: (params: any) => void) => void
  }
  onDetach: {
    addListener: (listener: (source: any, reason: string) => void) => void
    removeListener: (listener: (source: any, reason: string) => void) => void
  }
  onTargetCreated: {
    addListener: (listener: (target: ChromeDebugTarget) => void) => void
    removeListener: (listener: (target: ChromeDebugTarget) => void) => void
  }
  onTargetDestroyed: {
    addListener: (listener: (targetId: string) => void) => void
    removeListener: (listener: (targetId: string) => void) => void
  }
}

interface ChromeDebugTarget {
  id: string
  type: string
  title: string
  url: string
  faviconUrl?: string
  attached: boolean
}

interface ChromeTabs {
  query: (queryInfo: any, callback?: (tabs: ChromeTab[]) => void) => void
  create: (createProperties: any, callback?: (tab: ChromeTab) => void) => void
  remove: (tabIds: number | number[], callback?: () => void) => void
  sendMessage: (tabId: number, message: any, callback?: (response: any) => void) => void
  onUpdated: {
    addListener: (listener: (tabId: number, changeInfo: any, tab: ChromeTab) => void) => void
    removeListener: (listener: (tabId: number, changeInfo: any, tab: ChromeTab) => void) => void
  }
  onRemoved: {
    addListener: (listener: (tabId: number, removeInfo: any) => void) => void
    removeListener: (listener: (tabId: number, removeInfo: any) => void) => void
  }
}

interface ChromeTab {
  id: number
  url: string
  title: string
  active: boolean
  windowId: number
  status?: string
}

/**
 * Browser Extension CDP Manager
 *
 * Provides Chrome DevTools Protocol management for browser extension environment
 * using Chrome debugging API for tab management and command execution.
 */
export class BrowserCDPManager implements ICDPManager {
  private config: Required<CDPManagerConfig>
  private connectionStatus: CDPConnectionStatus = CDPConnectionStatus.DISCONNECTED
  private sessions = new Map<string, CDPSession>()
  private targets = new Map<string, CDPTarget>()
  private eventListeners = new Map<string, Set<(params: any) => void>>()
  private currentTargetId?: string
  private cdpClient?: CDPClient
  private stats: CDPManagerStats
  private startTime = new Date()
  private isInitialized = false

  // Chrome extension APIs
  private chromeDebugger: ChromeDebugger
  private chromeTabs: ChromeTabs

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
      headless: false, // Not applicable for browser extension
      reuseExisting: true,
      logger: this.createDefaultLogger(),
      ...config,
    }

    // Get Chrome extension APIs
    this.chromeDebugger = (globalThis as any).chrome?.debugger
    this.chromeTabs = (globalThis as any).chrome?.tabs

    if (!this.chromeDebugger) {
      throw new Error("Chrome debugger API not available. Ensure running in browser extension context with 'debugger' permission.")
    }

    if (!this.chromeTabs) {
      throw new Error("Chrome tabs API not available. Ensure running in browser extension context with 'tabs' permission.")
    }

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

    this.setupChromeEventListeners()
  }

  /**
   * Initialize the CDP manager
   */
  async initialize(config?: CDPManagerConfig): Promise<void> {
    if (this.isInitialized) {
      this.config.logger?.info("BrowserCDPManager already initialized")
      return
    }

    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.config.logger?.info("Initializing BrowserCDPManager", {
      enablePooling: this.config.enablePooling,
      reuseExisting: this.config.reuseExisting,
    })

    try {
      // Get initial targets
      await this.refreshTargets()

      this.isInitialized = true
      this.updateConnectionStatus(CDPConnectionStatus.DISCONNECTED)

      this.config.logger?.info("BrowserCDPManager initialized successfully")
    } catch (error) {
      this.config.logger?.error("Failed to initialize BrowserCDPManager", error as Error)
      throw new Error(`BrowserCDPManager initialization failed: ${(error as Error).message}`)
    }
  }

  /**
   * Connect to CDP target (attach to existing tab or create new one)
   */
  async connect(targetUrl?: string, config?: CDPConnectionConfig): Promise<CDPClient> {
    if (this.cdpClient && this.connectionStatus === CDPConnectionStatus.CONNECTED) {
      this.config.logger?.debug("Already connected to CDP target")
      return this.cdpClient
    }

    this.updateConnectionStatus(CDPConnectionStatus.CONNECTING)
    this.config.logger?.info("Connecting to CDP target", { targetUrl })

    try {
      // Find or create target
      const target = await this.findOrCreateTarget(targetUrl, config)
      this.currentTargetId = target.id

      // Attach debugger to target
      await this.attachDebugger(target.id)

      // Create CDP client adapter
      this.cdpClient = this.createCDPClientAdapter()

      // Enable required domains
      await this.enableDomains(target.id)

      // Update targets cache
      await this.refreshTargets()

      this.updateConnectionStatus(CDPConnectionStatus.CONNECTED)
      this.stats.activeConnections = 1
      this.stats.lastActivity = new Date()

      this.config.logger?.info("Connected to CDP target successfully", {
        targetId: target.id,
        url: target.url,
        title: target.title,
      })

      if (!this.cdpClient) {
        throw new Error("CDP client not initialized after connection")
      }

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
      // Detach debugger if attached
      if (this.currentTargetId) {
        await this.detachDebugger(this.currentTargetId)
        this.currentTargetId = undefined
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
    return this.connectionStatus === CDPConnectionStatus.CONNECTED && !!this.cdpClient && !!this.currentTargetId
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
    if (!this.isConnected() || !this.currentTargetId) {
      throw new Error("Not connected to CDP target")
    }

    const startTime = performance.now()
    this.stats.totalCommands++
    this.stats.lastActivity = new Date()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stats.failedCommands++
        this.stats.successRate = ((this.stats.totalCommands - this.stats.failedCommands) / this.stats.totalCommands) * 100
        reject(new Error(`Command ${method} timed out`))
      }, options?.timeout || this.config.connectionTimeout)

      this.chromeDebugger.sendCommand(
        this.currentTargetId!,
        method,
        params,
        (result: any) => {
          clearTimeout(timeout)

          const executionTime = performance.now() - startTime
          this.stats.totalExecutionTime += executionTime
          this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.totalCommands

          if (chrome.runtime.lastError) {
            this.stats.failedCommands++
            this.stats.successRate = ((this.stats.totalCommands - this.stats.failedCommands) / this.stats.totalCommands) * 100

            this.config.logger?.error("CDP command failed", new Error(chrome.runtime.lastError.message), { method })

            if (options?.throwOnError !== false) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(null)
            }
          } else {
            this.config.logger?.debug("CDP command executed successfully", {
              method,
              executionTime: Math.round(executionTime),
            })

            resolve({
              result,
              success: true,
              executionTime,
            })
          }
        },
      )
    })
  }

  /**
   * Evaluate JavaScript expression
   */
  async evaluate(expression: string, options?: any): Promise<any> {
    if (!this.isConnected()) {
      throw new Error("Not connected to CDP target")
    }

    this.stats.lastActivity = new Date()

    const result = await this.executeCommand("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      includeCommandLineAPI: false,
      silent: false,
      ...options,
    })

    if (result.success && result.result?.result?.subtype === "error") {
      throw new Error(result.result.result.description || "Evaluation error")
    }

    return result.success ? result.result?.result?.value : null
  }

  /**
   * Add event listener for CDP events
   */
  addEventListener<T extends keyof CDPEvents>(event: T, handler: (params: CDPEvents[T]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(handler as any)

    // Forward to Chrome debugger if available
    if (this.isConnected() && this.currentTargetId) {
      this.chromeDebugger.onEvent.addListener(this.currentTargetId, event.toString(), handler as any)
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

    // Remove from Chrome debugger if available
    if (this.isConnected() && this.currentTargetId) {
      this.chromeDebugger.onEvent.removeListener(this.currentTargetId, event.toString(), handler as any)
    }

    this.config.logger?.debug(`Removed event listener for: ${event}`)
  }

  /**
   * Get list of available targets
   */
  async getTargets(): Promise<CDPTarget[]> {
    try {
      const targets = await this.getChromeTargets()

      // Update internal targets cache
      for (const target of targets) {
        this.targets.set(target.id, {
          targetId: target.id,
          type: target.type,
          title: target.title,
          url: target.url,
          attached: target.attached,
          createdTime: 0, // Not provided by Chrome debugger API
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
    try {
      const url = options?.url || "about:blank"

      const tab = await this.createChromeTab(url)

      const target: CDPTarget = {
        targetId: tab.id.toString(),
        type: "page",
        title: tab.title || "",
        url,
        attached: false,
        createdTime: Date.now(),
      }

      this.targets.set(target.targetId, target)
      this.stats.availableTargets = this.targets.size

      this.config.logger?.info("Created new target", { targetId: target.targetId, url })

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
    try {
      const tabId = Number.parseInt(targetId, 10)
      if (Number.isNaN(tabId)) {
        throw new TypeError(`Invalid target ID: ${targetId}`)
      }

      await this.removeChromeTab(tabId)

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
    if (!this.isConnected()) {
      throw new Error("Not connected to CDP target")
    }

    try {
      const targetId = options?.targetId || this.currentTargetId
      if (!targetId) {
        throw new Error("No target available for session")
      }

      // In browser extension context, the session is implicit when debugger is attached
      const session: CDPSession = {
        sessionId: `browser-session-${targetId}`,
        targetId,
        createdAt: new Date(),
        isActive: true,
        lastActivity: new Date(),
      }

      this.sessions.set(session.sessionId, session)
      this.stats.activeSessions = this.sessions.size

      this.config.logger?.info("Created session", { sessionId: session.sessionId, targetId })

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
    const session = this.sessions.get(sessionId)
    if (session) {
      session.isActive = false
      this.sessions.delete(sessionId)
      this.stats.activeSessions = this.sessions.size

      this.config.logger?.info("Closed session", { sessionId })
    }
  }

  /**
   * Get current environment type
   */
  getEnvironment(): CDPEnvironment {
    return CDPEnvironment.BROWSER
  }

  /**
   * Get supported capabilities
   */
  getCapabilities(): CDPCapabilities {
    return {
      canLaunchChrome: false, // Cannot launch Chrome from extension
      canManageTabs: true,
      supportsPooling: false, // Limited pooling in extension context
      supportsIsolation: false, // Limited isolation in extension context
      availableDomains: ["Page", "Runtime", "Network", "DOM", "Input", "Emulation", "Target"],
      maxConnections: 1, // Extension typically manages one connection
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
    this.config.logger?.info("Cleaning up BrowserCDPManager")

    try {
      // Disconnect
      await this.disconnect()

      // Clear event listeners
      this.eventListeners.clear()

      // Remove Chrome event listeners
      this.removeChromeEventListeners()

      this.isInitialized = false
      this.config.logger?.info("BrowserCDPManager cleaned up successfully")
    } catch (error) {
      this.config.logger?.error("Error during cleanup", error as Error)
    }
  }

  /**
   * Restart the CDP manager
   */
  async restart(config?: CDPManagerConfig): Promise<void> {
    this.config.logger?.info("Restarting BrowserCDPManager")

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
  }

  /**
   * Get current configuration
   */
  getConfig(): CDPManagerConfig {
    return { ...this.config }
  }

  /**
   * Find or create target for connection
   */
  private async findOrCreateTarget(targetUrl?: string, _config?: CDPConnectionConfig): Promise<ChromeDebugTarget> {
    const targets = await this.getChromeTargets()

    // Try to find existing target
    if (targetUrl) {
      const existingTarget = targets.find(target => target.url === targetUrl)
      if (existingTarget && !existingTarget.attached) {
        return existingTarget
      }
    }

    // Find first available unattached target
    const unattachedTarget = targets.find(target => !target.attached)
    if (unattachedTarget) {
      return unattachedTarget
    }

    // Create new target
    const tab = await this.createChromeTab(targetUrl || "about:blank")

    // Wait a bit for tab to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))

    const newTargets = await this.getChromeTargets()
    const newTarget = newTargets.find(target => target.id === tab.id.toString())

    if (!newTarget) {
      throw new Error("Failed to create or find target")
    }

    return newTarget
  }

  /**
   * Attach debugger to target
   */
  private async attachDebugger(targetId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.chromeDebugger.attach(
        targetId,
        "1.3", // CDP version
        () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        },
      )
    })
  }

  /**
   * Detach debugger from target
   */
  private async detachDebugger(targetId: string): Promise<void> {
    return new Promise((resolve) => {
      this.chromeDebugger.detach(
        targetId,
        () => {
          // Ignore errors during detachment
          resolve()
        },
      )
    })
  }

  /**
   * Enable required CDP domains for target
   */
  private async enableDomains(targetId: string): Promise<void> {
    const domains = ["Page.enable", "Runtime.enable", "Network.enable", "DOM.enable"]

    for (const domain of domains) {
      try {
        await this.executeDomainCommand(targetId, domain)
      } catch (error) {
        // DOM might not be available for all targets, ignore errors
        this.config.logger?.warn(`Failed to enable domain ${domain}`, error)
      }
    }

    this.config.logger?.debug("CDP domains enabled successfully")
  }

  /**
   * Execute domain-specific command
   */
  private async executeDomainCommand(targetId: string, command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.chromeDebugger.sendCommand(
        targetId,
        command,
        {},
        () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        },
      )
    })
  }

  /**
   * Get Chrome targets using debugger API
   */
  private async getChromeTargets(): Promise<ChromeDebugTarget[]> {
    return new Promise((resolve, reject) => {
      this.chromeDebugger.getTargets((result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(result.targetInfo || [])
        }
      })
    })
  }

  /**
   * Create new Chrome tab
   */
  private async createChromeTab(url: string): Promise<ChromeTab> {
    return new Promise((resolve, reject) => {
      this.chromeTabs.create({ url, active: false }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else if (!tab) {
          reject(new Error("Failed to create tab"))
        } else {
          resolve(tab)
        }
      })
    })
  }

  /**
   * Remove Chrome tab
   */
  private async removeChromeTab(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.chromeTabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
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
  private createCDPClientAdapter(): any {
    return new BrowserCDPAdapter(this, this.config.logger!)
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
    // TODO: Implement reconnection logic for browser extension
    this.config.logger?.info("Reconnection scheduled (not implemented)")
  }

  /**
   * Setup Chrome event listeners
   */
  private setupChromeEventListeners(): void {
    // Listen for target events
    this.chromeDebugger.onTargetCreated.addListener((target: ChromeDebugTarget) => {
      this.config.logger?.debug("Target created", { targetId: target.id })
      this.refreshTargets()
    })

    this.chromeDebugger.onTargetDestroyed.addListener((targetId: string) => {
      this.config.logger?.debug("Target destroyed", { targetId })
      this.targets.delete(targetId)
      this.refreshTargets()
    })

    this.chromeDebugger.onDetach.addListener((source: any, reason: string) => {
      this.config.logger?.warn("Debugger detached", { source, reason })

      if (source.targetId === this.currentTargetId) {
        this.updateConnectionStatus(CDPConnectionStatus.DISCONNECTED)
        this.currentTargetId = undefined
        this.cdpClient = undefined
      }
    })

    // Listen for tab events
    this.chromeTabs.onUpdated.addListener((tabId: number, changeInfo: any, tab: ChromeTab) => {
      if (this.currentTargetId === tabId.toString() && changeInfo.status === "complete") {
        this.config.logger?.debug("Target tab updated", { tabId, url: tab.url })
        this.refreshTargets()
      }
    })

    this.chromeTabs.onRemoved.addListener((tabId: number) => {
      if (this.currentTargetId === tabId.toString()) {
        this.config.logger?.warn("Connected tab was closed", { tabId })
        this.updateConnectionStatus(CDPConnectionStatus.DISCONNECTED)
        this.currentTargetId = undefined
        this.cdpClient = undefined
      }
    })
  }

  /**
   * Remove Chrome event listeners
   */
  private removeChromeEventListeners(): void {
    // Note: Chrome extension API doesn't provide a way to remove all listeners at once
    // This would require tracking individual listeners and removing them explicitly
    this.config.logger?.debug("Chrome event listeners cleanup (manual removal required)")
  }

  /**
   * Create default logger instance
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, context?: any) => {
        if (typeof console !== "undefined" && console.debug) {
          console.debug(`[BrowserCDPManager] ${message}`, context || "")
        }
      },
      info: (message: string, context?: any) => {
        if (typeof console !== "undefined" && console.info) {
          console.info(`[BrowserCDPManager] ${message}`, context || "")
        }
      },
      warn: (message: string, context?: any) => {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(`[BrowserCDPManager] ${message}`, context || "")
        }
      },
      error: (message: string, context?: any) => {
        if (typeof console !== "undefined" && console.error) {
          console.error(`[BrowserCDPManager] ${message}`, context || "")
        }
      },
    }
  }
}

/**
 * Browser CDP Adapter
 *
 * Adapts BrowserCDPManager to match our CDPClient interface
 */
/**
 * Browser CDP adapter that provides a simplified interface
 * Note: This doesn't fully implement CDPClient as browser environment has different capabilities
 */
class BrowserCDPAdapter {
  private manager: BrowserCDPManager
  private logger: Logger

  constructor(manager: BrowserCDPManager, logger: Logger) {
    this.manager = manager
    this.logger = logger
  }

  async connect(): Promise<void> {
    // Manager is already connected via connect() method
  }

  async close(): Promise<void> {
    await this.manager.disconnect()
  }

  async evaluate(expression: string, options: any = {}): Promise<any> {
    return await this.manager.evaluate(expression, options)
  }

  async sendCommand(method: string, params: any = {}): Promise<any> {
    const startTime = performance.now()

    try {
      const result = await this.manager.executeCommand(method, params)

      const executionTime = performance.now() - startTime
      this.logger.debug("CDP command executed", { method, executionTime: Math.round(executionTime) })

      return result
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

  addEventListener<T extends keyof any>(event: T, handler: (params: any) => void): void {
    this.manager.addEventListener(event as any, handler as any)
  }

  removeEventListener<T extends keyof any>(event: T, handler: (params: any) => void): void {
    this.manager.removeEventListener(event as any, handler as any)
  }

  getStatus(): any {
    return this.manager.getConnectionStatus()
  }

  getSessions(): any[] {
    return [] // Browser sessions are managed differently
  }

  getSession(_sessionId: string): any {
    return undefined
  }

  getTargets(): any[] {
    return [] // Browser targets are managed differently
  }

  getTarget(_targetId: string): any {
    return undefined
  }

  isConnected(): boolean {
    return this.manager.isConnected()
  }
}
