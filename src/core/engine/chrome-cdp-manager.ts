/**
 * Chrome CDP Manager - Real Chrome DevTools Protocol implementation
 * Manages Chrome process lifecycle and CDP connections using chrome-launcher and chrome-remote-interface
 */

import process from "node:process"

import * as chromeLauncher from "chrome-launcher"
import * as CDP from "chrome-remote-interface"

import type { CDPClient } from "../../architecture/adapters/cdp/CDPClient.js"
import type { CDPLogger } from "../../architecture/adapters/cdp/types.js"
import type { Logger } from "../../architecture/strategies/types.js"

import type { CDPCaptureConfig } from "./mhtml-processor.js"
import { MHTMLProcessor } from "./mhtml-processor.js"

/**
 * Chrome process information
 */
export interface ChromeProcess {
  /** Process ID */
  pid: number
  /** Chrome port */
  port: number
  /** WebSocket debug URL */
  websocketUrl: string
  /** Process launch timestamp */
  launchTime: Date
  /** Whether process is active */
  active: boolean
  /** Chrome launcher instance */
  launcher?: chromeLauncher.LaunchedChrome
}

/**
 * Chrome CDP Manager configuration
 */
export interface ChromeCDPManagerConfig extends CDPCaptureConfig {
  /** Whether to launch Chrome if not running */
  autoLaunch?: boolean
  /** Maximum number of concurrent Chrome instances */
  maxInstances?: number
  /** Instance idle timeout in milliseconds */
  idleTimeout?: number
  /** Whether to reuse existing Chrome instances */
  reuseInstances?: boolean
}

/**
 * Chrome CDP Manager
 *
 * Provides real Chrome DevTools Protocol integration with:
 * - Chrome process launching and lifecycle management
 * - CDP connection establishment and pooling
 * - Resource cleanup and error handling
 * - Integration with MHTML processor
 */
export class ChromeCDPManager {
  private logger: Logger
  private config: ChromeCDPManagerConfig
  private activeProcesses = new Map<number, ChromeProcess>()
  private cdpConnections = new Map<number, CDP.Client>()
  private cdpClient?: CDPClient
  private lastActivity = new Date()

  constructor(logger: Logger, config: ChromeCDPManagerConfig = {}) {
    this.logger = logger
    this.config = {
      autoLaunch: true,
      maxInstances: 3,
      idleTimeout: 300000, // 5 minutes
      reuseInstances: true,
      headless: true,
      connectionTimeout: 30000,
      pageTimeout: 30000,
      ...config,
    }

    this.logger.info("Chrome CDP Manager initialized", {
      autoLaunch: this.config.autoLaunch,
      maxInstances: this.config.maxInstances,
      idleTimeout: this.config.idleTimeout,
    })

    // Setup cleanup interval
    this.setupCleanupInterval()
  }

  /**
   * Get or create a Chrome CDP manager for MHTML processing
   *
   * @returns Promise resolving to MHTMLProcessor instance
   */
  async getMHTMLProcessor(): Promise<MHTMLProcessor> {
    this.lastActivity = new Date()

    // Ensure we have an active Chrome process
    const chromeProcess = await this.getOrCreateChromeProcess()

    // Create CDP client for the process
    if (!this.cdpClient) {
      this.cdpClient = await this.createCDPClient(chromeProcess)
    }

    // Create and return MHTML processor
    const processor = new MHTMLProcessor(this.logger, this.config)
    processor.setCDPClient(this.cdpClient)

    return processor
  }

  /**
   * Launch a new Chrome instance
   *
   * @returns Promise resolving to Chrome process information
   */
  async launchChrome(): Promise<ChromeProcess> {
    this.logger.info("Launching Chrome instance")

    try {
      const launchOptions: chromeLauncher.Options = {
        chromeFlags: [
          ...(this.config.headless ? ["--headless"] : []),
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          ...(this.config.chromeArgs || []),
        ],
        port: 0, // Let chrome-launcher choose a free port
        logLevel: "silent",
        userDataDir: this.config.userDataDir,
        connectionPollInterval: 1000,
        maxConnectionRetries: 10,
        envVars: {
          DISPLAY: process?.env?.DISPLAY,
        },
      }

      const chrome = await chromeLauncher.launch(launchOptions)

      const chromeProcess: ChromeProcess = {
        pid: chrome.pid!,
        port: chrome.port!,
        websocketUrl: `ws://localhost:${chrome.port}/devtools/browser`,
        launchTime: new Date(),
        active: true,
        launcher: chrome,
      }

      this.activeProcesses.set(chromeProcess.pid, chromeProcess)
      this.logger.info("Chrome instance launched", {
        pid: chromeProcess.pid,
        port: chromeProcess.port,
        websocketUrl: chromeProcess.websocketUrl,
      })

      return chromeProcess
    } catch (error) {
      this.logger.error("Failed to launch Chrome instance", error as Error)
      throw new Error(`Chrome launch failed: ${(error as Error).message}`)
    }
  }

  /**
   * Get an existing Chrome process or create a new one
   *
   * @returns Promise resolving to Chrome process information
   */
  private async getOrCreateChromeProcess(): Promise<ChromeProcess> {
    // Check for existing active processes
    if (this.config.reuseInstances && this.activeProcesses.size > 0) {
      for (const process of Array.from(this.activeProcesses.values())) {
        if (process.active && this.isProcessAlive(process.pid)) {
          this.logger.debug("Reusing existing Chrome process", { pid: process.pid })
          return process
        }
      }
    }

    // Check if we've reached max instances
    if (this.activeProcesses.size >= this.config.maxInstances!) {
      this.logger.warn("Maximum Chrome instances reached, cleaning up idle processes")
      await this.cleanupIdleProcesses()

      if (this.activeProcesses.size >= this.config.maxInstances!) {
        throw new Error(`Maximum Chrome instances (${this.config.maxInstances}) reached`)
      }
    }

    // Launch new Chrome instance
    return await this.launchChrome()
  }

  /**
   * Create a CDP client for a Chrome process
   *
   * @param chromeProcess - Chrome process to connect to
   * @returns Promise resolving to CDP client
   */
  private async createCDPClient(chromeProcess: ChromeProcess): Promise<CDPClient> {
    this.logger.info("Creating CDP client", { port: chromeProcess.port })

    try {
      // Connect to Chrome DevTools Protocol
      const criClient = await (CDP as any).default({
        port: chromeProcess.port,
        host: "localhost",
      })

      this.cdpConnections.set(chromeProcess.pid, criClient)

      // Create adapter for our CDPClient interface
      const adapter = new ChromeRemoteInterfaceAdapter(criClient, this.createCDPLogger())

      this.logger.info("CDP client created successfully", { port: chromeProcess.port })
      return adapter as any
    } catch (error) {
      this.logger.error("Failed to create CDP client", error as Error, { port: chromeProcess.port })
      throw new Error(`CDP connection failed: ${(error as Error).message}`)
    }
  }

  /**
   * Check if a process is still alive
   *
   * @param pid - Process ID to check
   * @returns True if process is alive
   */
  private isProcessAlive(pid: number): boolean {
    try {
      // Send signal 0 to check if process exists
      process?.kill?.(pid, 0)
      return true
    } catch {
      return false
    }
  }

  /**
   * Clean up idle Chrome processes
   */
  private async cleanupIdleProcesses(): Promise<void> {
    const now = new Date()
    const idleThreshold = this.config.idleTimeout!

    for (const [pid, process] of Array.from(this.activeProcesses.entries())) {
      const idleTime = now.getTime() - this.lastActivity.getTime()

      if (idleTime > idleThreshold || !process.active || !this.isProcessAlive(pid)) {
        this.logger.info("Cleaning up idle Chrome process", { pid, idleTime })
        await this.killChromeProcess(pid)
      }
    }
  }

  /**
   * Kill a specific Chrome process
   *
   * @param pid - Process ID to kill
   */
  private async killChromeProcess(pid: number): Promise<void> {
    const process = this.activeProcesses.get(pid)
    if (!process) {
      return
    }

    try {
      // Close CDP connection
      const criClient = this.cdpConnections.get(pid)
      if (criClient) {
        await criClient.close()
        this.cdpConnections.delete(pid)
      }

      // Kill Chrome process
      if (process.launcher) {
        process.launcher.kill()
      } else {
        const { killAll } = await import("chrome-launcher")
        killAll().forEach((error) => {
          if (error) {
            this.logger.warn("Failed to kill Chrome process", error, { pid })
          }
        })
      }

      // Remove from active processes
      this.activeProcesses.delete(pid)

      this.logger.info("Chrome process killed", { pid })
    } catch (error) {
      this.logger.error("Failed to kill Chrome process", error as Error, { pid })
    }
  }

  /**
   * Setup cleanup interval for idle processes
   */
  private setupCleanupInterval(): void {
    setInterval(() => {
      this.cleanupIdleProcesses().catch((error) => {
        this.logger.error("Failed to cleanup idle processes", error as Error)
      })
    }, 60000) // Check every minute
  }

  /**
   * Create CDP logger adapter
   *
   * @returns CDP logger interface
   */
  private createCDPLogger(): CDPLogger {
    return {
      debug: (message: string, ...args: any[]) => {
        this.logger.debug(`[CRI] ${message}`, ...args)
      },
      info: (message: string, ...args: any[]) => {
        this.logger.info(`[CRI] ${message}`, ...args)
      },
      warn: (message: string, ...args: any[]) => {
        this.logger.warn(`[CRI] ${message}`, ...args)
      },
      error: (message: string, error?: Error, ...args: any[]) => {
        this.logger.error(`[CRI] ${message}`, error, ...args)
      },
    }
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    this.logger.info("Cleaning up Chrome CDP Manager")

    // Close all CDP connections
    for (const [pid, criClient] of Array.from(this.cdpConnections.entries())) {
      try {
        await criClient.close()
      } catch (error) {
        this.logger.error("Failed to close CDP connection", error as Error, { pid })
      }
    }
    this.cdpConnections.clear()

    // Kill all Chrome processes
    for (const pid of Array.from(this.activeProcesses.keys())) {
      await this.killChromeProcess(pid)
    }

    this.cdpClient = undefined
    this.logger.info("Chrome CDP Manager cleaned up")
  }

  /**
   * Get statistics about the manager
   *
   * @returns Manager statistics
   */
  getStats() {
    return {
      activeProcesses: this.activeProcesses.size,
      activeConnections: this.cdpConnections.size,
      maxInstances: this.config.maxInstances,
      lastActivity: this.lastActivity,
      processIds: Array.from(this.activeProcesses.keys()),
    }
  }
}

/**
 * Adapter for chrome-remote-interface to match our CDPClient interface
 */
class ChromeRemoteInterfaceAdapter {
  private criClient: CDP.Client
  private logger: CDPLogger
  private listeners = new Map<string, Set<(params: any) => void>>()

  constructor(criClient: CDP.Client, logger: CDPLogger) {
    this.criClient = criClient
    this.logger = logger

    // Forward CRI events to our listeners
    this.criClient.on("event", (message) => {
      const listeners = this.listeners.get(message.method)
      if (listeners) {
        for (const listener of Array.from(listeners)) {
          try {
            listener(message.params)
          } catch (error) {
            this.logger.error(`Error in event listener for ${message.method}`, error as Error)
          }
        }
      }
    })
  }

  async connect(): Promise<void> {
    // CRI is already connected when created
  }

  async close(): Promise<void> {
    await this.criClient.close()
  }

  async evaluate(expression: string, options: any = {}): Promise<any> {
    return await this.criClient.Runtime.evaluate({
      expression,
      awaitPromise: true,
      returnByValue: true,
      includeCommandLineAPI: false,
      silent: false,
      ...options,
    })
  }

  async sendCommand(method: string, params: any = {}): Promise<any> {
    const startTime = performance.now()

    try {
      const result = await (this.criClient as any)[method](params)
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

  addEventListener<T extends keyof any>(event: T, handler: (params: any) => void): string {
    const eventStr = String(event)
    if (!this.listeners.has(eventStr)) {
      this.listeners.set(eventStr, new Set())
    }
    this.listeners.get(eventStr)!.add(handler)

    // Enable the domain in CRI
    const domain = eventStr.split(".")[0]
    if (domain && (this.criClient as any)[domain] && (this.criClient as any)[domain].enable) {
      (this.criClient as any)[domain].enable().catch((error: any) => {
        this.logger.error(`Failed to enable domain ${domain}`, error as Error)
      })
    }

    return eventStr
  }

  removeEventListener<T extends keyof any>(_event: T, handler: (params: any) => void): void {
    for (const [event, listeners] of Array.from(this.listeners.entries())) {
      if (listeners.has(handler)) {
        listeners.delete(handler)
        if (listeners.size === 0) {
          this.listeners.delete(event)
        }
        break
      }
    }
  }

  getStatus(): any {
    return "connected" // CRI Client is always connected once created
  }

  getSessions(): any[] {
    return [] // CRI doesn't expose sessions in the same way
  }

  getSession(_sessionId: string): any {
    return undefined
  }

  getTargets(): any[] {
    return [] // CRI doesn't expose targets in the same way
  }

  getTarget(_targetId: string): any {
    return undefined
  }

  isConnected(): boolean {
    return true // CRI Client is always connected once created
  }
}
