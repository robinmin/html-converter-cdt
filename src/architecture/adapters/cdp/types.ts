/**
 * Chrome DevTools Protocol connection configuration
 */
export interface CDPConnectionConfig {
  /** Target URL or WebSocket endpoint */
  targetUrl: string
  /** Connection timeout in milliseconds */
  timeout?: number
  /** Maximum number of connection attempts */
  maxRetries?: number
  /** Delay between retries in milliseconds */
  retryDelay?: number
  /** Custom headers for connection */
  headers?: Record<string, string>
  /** Whether to enable auto-reconnection */
  autoReconnect?: boolean
}

/**
 * CDP session information
 */
export interface CDPSession {
  /** Unique session identifier */
  sessionId: string
  /** Target identifier */
  targetId: string
  /** Session creation timestamp */
  createdAt: Date
  /** Whether the session is active */
  isActive: boolean
  /** Last activity timestamp */
  lastActivity: Date
}

/**
 * CDP target information
 */
export interface CDPTarget {
  /** Target identifier */
  targetId: string
  /** Target type (page, background_page, etc.) */
  type: string
  /** Target title */
  title: string
  /** Target URL */
  url: string
  /** Whether target is attached */
  attached: boolean
  /** Target creation timestamp */
  createdTime: number
}

/**
 * CDP command result
 */
export interface CDPCommandResult {
  /** Command result data */
  result: any
  /** Command execution success status */
  success: boolean
  /** Error message if command failed */
  error?: string
  /** Command execution time in milliseconds */
  executionTime: number
}

/**
 * CDP evaluation options
 */
export interface CDPEvaluateOptions {
  /** Whether to await promise resolution */
  awaitPromise?: boolean
  /** Evaluation context */
  contextId?: number
  /** Whether to return value as JSON */
  returnByValue?: boolean
  /** Whether to include command line API */
  includeCommandLineAPI?: boolean
  /** Whether to be silent */
  silent?: boolean
  /** Object group for result */
  objectGroup?: string
  /** Whether to throw on side effects */
  throwOnSideEffect?: boolean
  /** Unique identifier for this evaluation */
  id?: string
}

/**
 * CDP event listener
 */
export interface CDPEventListener {
  /** Event name */
  event: string
  /** Event handler function */
  handler: (params: any) => void
  /** Whether listener is one-time */
  once?: boolean
  /** Unique listener ID */
  id?: string
}

/**
 * CDP connection status
 */
export enum CDPConnectionStatus {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

/**
 * CDP logging interface
 */
export interface CDPLogger {
  debug(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  error(message: string, error?: Error, ...args: any[]): void
}

/**
 * CDP event types
 */
export interface CDPEvents {
  /** Target events */
  "target.attachedToTarget": { sessionId: string, targetInfo: CDPTarget }
  "target.detachedFromTarget": { sessionId: string, targetId: string }
  "target.targetCreated": { targetInfo: CDPTarget }
  "target.targetDestroyed": { targetId: string }
  "target.targetInfoChanged": { targetInfo: CDPTarget }

  /** Page events */
  "page.loadEventFired": { timestamp: number }
  "page.domContentEventFired": { timestamp: number }
  "page.frameAttached": { frameId: string, parentFrameId: string }
  "page.frameDetached": { frameId: string }
  "page.frameNavigated": { frame: any }
  "page.javascriptDialogOpening": { message: string, type: string }
  "page.javascriptDialogClosed": { result: boolean }

  /** Runtime events */
  "runtime.consoleAPICalled": { type: string, args: any[], executionContextId: number }
  "runtime.exceptionThrown": { exceptionDetails: any }
  "runtime.executionContextCreated": { context: any }
  "runtime.executionContextDestroyed": { executionContextId: number }

  /** Network events */
  "network.requestWillBeSent": { requestId: string, request: any }
  "network.responseReceived": { requestId: string, response: any }
  "network.loadingFinished": { requestId: string, timestamp: number }
  "network.loadingFailed": { requestId: string, errorText: string }
}

/**
 * WebSocket interface for CDP connection
 */
export interface CDPWebSocket {
  /** Connect to WebSocket endpoint */
  connect(url: string): Promise<void>
  /** Send message to WebSocket */
  send(message: string): Promise<void>
  /** Close WebSocket connection */
  close(code?: number, reason?: string): void
  /** Add event listener */
  addEventListener(event: string, handler: (event: any) => void): void
  /** Remove event listener */
  removeEventListener(event: string, handler: (event: any) => void): void
  /** Current connection state */
  readyState: number
}

/**
 * Connection pool configuration
 */
export interface CDPConnectionPoolConfig {
  /** Maximum number of connections in pool */
  maxConnections: number
  /** Connection timeout in milliseconds */
  connectionTimeout: number
  /** Idle timeout in milliseconds */
  idleTimeout: number
  /** Whether to enable connection health checks */
  enableHealthChecks: boolean
  /** Health check interval in milliseconds */
  healthCheckInterval: number
}
