/**
 * Chrome DevTools Protocol Manager Interface
 *
 * Environment-agnostic interface for CDP operations that provides
 * a unified API across Node.js and browser environments.
 */

import type { Logger } from "../../strategies/types.js"
import type { CDPClient, CDPConnectionConfig, CDPConnectionStatus, CDPEvents, CDPSession, CDPTarget } from "../cdp/types.js"

/**
 * CDP Environment types
 */
export enum CDPEnvironment {
  NODE = "node",
  BROWSER = "browser",
  WEB_WORKER = "web_worker",
  SERVICE_WORKER = "service_worker",
  UNKNOWN = "unknown",
}

/**
 * CDP Manager configuration options
 */
export interface CDPManagerConfig {
  /** Connection timeout in milliseconds */
  connectionTimeout?: number
  /** Maximum number of connection attempts */
  maxRetries?: number
  /** Delay between retries in milliseconds */
  retryDelay?: number
  /** Whether to enable auto-reconnection */
  autoReconnect?: boolean
  /** Idle timeout in milliseconds */
  idleTimeout?: number
  /** Whether to enable connection pooling */
  enablePooling?: boolean
  /** Maximum connections in pool */
  maxPoolSize?: number
  /** Custom Chrome flags for Node.js environment */
  chromeFlags?: string[]
  /** User data directory for Chrome */
  userDataDir?: string
  /** Whether to launch Chrome headlessly */
  headless?: boolean
  /** Whether to use existing Chrome instance */
  reuseExisting?: boolean
  /** Custom logger instance */
  logger?: Logger
}

/**
 * CDP command execution options
 */
export interface CDPCommandOptions {
  /** Command timeout in milliseconds */
  timeout?: number
  /** Whether to throw on error */
  throwOnError?: boolean
  /** Additional command parameters */
  params?: Record<string, any>
}

/**
 * CDP target creation options
 */
export interface CDPTargetOptions {
  /** Target URL to navigate to */
  url?: string
  /** Target width in pixels */
  width?: number
  /** Target height in pixels */
  height?: number
  /** Device scale factor */
  deviceScaleFactor?: number
  /** Whether to emulate mobile device */
  mobile?: boolean
  /** User agent string */
  userAgent?: string
  /** Additional target configuration */
  config?: Record<string, any>
}

/**
 * CDP session creation options
 */
export interface CDPSessionOptions {
  /** Target ID to attach to */
  targetId?: string
  /** Whether to auto-attach to new targets */
  autoAttach?: boolean
  /** Whether to enable debugger on start */
  waitForDebuggerOnStart?: boolean
  /** Session-specific configuration */
  config?: Record<string, any>
}

/**
 * CDP Manager capabilities
 */
export interface CDPCapabilities {
  /** Whether Chrome process launching is supported */
  canLaunchChrome: boolean
  /** Whether tab management is supported */
  canManageTabs: boolean
  /** Whether connection pooling is supported */
  supportsPooling: boolean
  /** Whether process isolation is supported */
  supportsIsolation: boolean
  /** Available CDP domains */
  availableDomains: string[]
  /** Maximum concurrent connections */
  maxConnections: number
  /** Supported features */
  features: {
    screenshots: boolean
    pageCapture: boolean
    networkInterception: boolean
    javascriptExecution: boolean
    domManipulation: boolean
    emulation: boolean
  }
}

/**
 * CDP Manager statistics
 */
export interface CDPManagerStats {
  /** Current connection status */
  status: CDPConnectionStatus
  /** Number of active connections */
  activeConnections: number
  /** Number of active sessions */
  activeSessions: number
  /** Number of available targets */
  availableTargets: number
  /** Total commands executed */
  totalCommands: number
  /** Total execution time in milliseconds */
  totalExecutionTime: number
  /** Average command execution time */
  averageExecutionTime: number
  /** Number of failed commands */
  failedCommands: number
  /** Success rate percentage */
  successRate: number
  /** Uptime in milliseconds */
  uptime: number
  /** Last activity timestamp */
  lastActivity: Date
}

/**
 * Chrome DevTools Protocol Manager Interface
 *
 * Provides environment-agnostic abstraction for CDP operations
 * with automatic environment detection and appropriate adapter selection.
 */
export interface ICDPManager {
  /**
   * Initialize the CDP manager
   * @param config - Configuration options
   * @returns Promise that resolves when initialization is complete
   */
  initialize(config?: CDPManagerConfig): Promise<void>

  /**
   * Connect to CDP target or launch new Chrome instance
   * @param targetUrl - Target URL or connection string
   * @param config - Connection configuration
   * @returns Promise that resolves to CDP client
   */
  connect(targetUrl?: string, config?: CDPConnectionConfig): Promise<CDPClient>

  /**
   * Disconnect from CDP target
   * @returns Promise that resolves when disconnection is complete
   */
  disconnect(): Promise<void>

  /**
   * Check if connected to CDP target
   * @returns True if connected
   */
  isConnected(): boolean

  /**
   * Get current connection status
   * @returns Connection status
   */
  getConnectionStatus(): CDPConnectionStatus

  /**
   * Execute CDP command
   * @param method - CDP method name
   * @param params - Command parameters
   * @param options - Execution options
   * @returns Promise that resolves to command result
   */
  executeCommand(method: string, params?: any, options?: CDPCommandOptions): Promise<any>

  /**
   * Evaluate JavaScript expression
   * @param expression - JavaScript expression to evaluate
   * @param options - Evaluation options
   * @returns Promise that resolves to evaluation result
   */
  evaluate(expression: string, options?: any): Promise<any>

  /**
   * Add event listener for CDP events
   * @param event - Event name
   * @param handler - Event handler function
   */
  addEventListener<T extends keyof CDPEvents>(event: T, handler: (params: CDPEvents[T]) => void): void

  /**
   * Remove event listener
   * @param event - Event name
   * @param handler - Event handler function
   */
  removeEventListener<T extends keyof CDPEvents>(event: T, handler: (params: CDPEvents[T]) => void): void

  /**
   * Get list of available targets
   * @returns Promise that resolves to list of targets
   */
  getTargets(): Promise<CDPTarget[]>

  /**
   * Get target by ID
   * @param targetId - Target ID
   * @returns Promise that resolves to target or null if not found
   */
  getTarget(targetId: string): Promise<CDPTarget | null>

  /**
   * Create new target
   * @param options - Target creation options
   * @returns Promise that resolves to created target
   */
  createTarget(options?: CDPTargetOptions): Promise<CDPTarget>

  /**
   * Close target
   * @param targetId - Target ID to close
   * @returns Promise that resolves when target is closed
   */
  closeTarget(targetId: string): Promise<void>

  /**
   * Create session for target
   * @param options - Session creation options
   * @returns Promise that resolves to session
   */
  createSession(options?: CDPSessionOptions): Promise<CDPSession>

  /**
   * Get session by ID
   * @param sessionId - Session ID
   * @returns Promise that resolves to session or null if not found
   */
  getSession(sessionId: string): Promise<CDPSession | null>

  /**
   * Get all active sessions
   * @returns Promise that resolves to list of sessions
   */
  getSessions(): Promise<CDPSession[]>

  /**
   * Close session
   * @param sessionId - Session ID to close
   * @returns Promise that resolves when session is closed
   */
  closeSession(sessionId: string): Promise<void>

  /**
   * Get current environment type
   * @returns CDP environment type
   */
  getEnvironment(): CDPEnvironment

  /**
   * Get supported capabilities
   * @returns CDP capabilities
   */
  getCapabilities(): CDPCapabilities

  /**
   * Get manager statistics
   * @returns Manager statistics
   */
  getStats(): CDPManagerStats

  /**
   * Clear all resources and cleanup
   * @returns Promise that resolves when cleanup is complete
   */
  cleanup(): Promise<void>

  /**
   * Restart the CDP manager
   * @param config - Optional new configuration
   * @returns Promise that resolves when restart is complete
   */
  restart(config?: CDPManagerConfig): Promise<void>

  /**
   * Update configuration
   * @param config - New configuration options
   */
  updateConfig(config: Partial<CDPManagerConfig>): void

  /**
   * Get current configuration
   * @returns Current configuration
   */
  getConfig(): CDPManagerConfig
}
