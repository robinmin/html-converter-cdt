import type {
  CDPCommandResult,
  CDPConnectionConfig,
  CDPEvaluateOptions,
  CDPEventListener,
  CDPEvents,
  CDPLogger,
  CDPSession,
  CDPTarget,
  CDPWebSocket,
} from "./types.js"
import { CDPConnectionStatus } from "./types.js"

/**
 * Chrome DevTools Protocol Client
 * Provides a high-level abstraction for CDP operations
 */
export class CDPClient {
  private config: CDPConnectionConfig
  private logger: CDPLogger
  private webSocket?: CDPWebSocket
  private status: CDPConnectionStatus = CDPConnectionStatus.DISCONNECTED
  private sessions = new Map<string, CDPSession>()
  private targets = new Map<string, CDPTarget>()
  private eventListeners = new Map<string, Set<CDPEventListener>>()
  private commandId = 1
  private pendingCommands = new Map<number, {
    resolve: (result: CDPCommandResult) => void
    reject: (error: Error) => void
    timeout?: NodeJS.Timeout
  }>()

  private reconnectAttempts = 0
  private reconnectTimer?: NodeJS.Timeout

  constructor(config: CDPConnectionConfig, logger: CDPLogger) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      autoReconnect: true,
      ...config,
    }
    this.logger = logger
  }

  /**
   * Connect to CDP target
   */
  async connect(): Promise<void> {
    if (this.status === CDPConnectionStatus.CONNECTED) {
      throw new Error("CDPClient is already connected")
    }

    if (this.status === CDPConnectionStatus.CONNECTING) {
      throw new Error("CDPClient is already connecting")
    }

    this.setStatus(CDPConnectionStatus.CONNECTING)
    this.logger.info(`Connecting to CDP target: ${this.config.targetUrl}`)

    try {
      await this.performConnect()
      // Status is already set to CONNECTED in performConnect()
      this.reconnectAttempts = 0
      this.logger.info("CDPClient connected successfully")
    } catch (error) {
      this.setStatus(CDPConnectionStatus.ERROR)
      this.logger.error("Failed to connect to CDP target", error as Error)

      if (this.config.autoReconnect && this.reconnectAttempts < (this.config.maxRetries || 3)) {
        this.scheduleReconnect()
      } else {
        throw error
      }
    }
  }

  /**
   * Disconnect from CDP target
   */
  async close(): Promise<void> {
    this.clearReconnectTimer()
    this.setStatus(CDPConnectionStatus.DISCONNECTED)

    // Clear all pending commands
    for (const [_id, command] of Array.from(this.pendingCommands)) {
      if (command.timeout) {
        clearTimeout(command.timeout)
      }
      command.reject(new Error("Connection closed"))
    }
    this.pendingCommands.clear()

    // Close WebSocket connection
    if (this.webSocket) {
      this.webSocket.close()
      this.webSocket = undefined
    }

    // Clear sessions and targets
    this.sessions.clear()
    this.targets.clear()

    this.logger.info("CDPClient disconnected")
  }

  /**
   * Execute JavaScript expression in the target
   */
  async evaluate(expression: string, options: CDPEvaluateOptions = {}): Promise<any> {
    if (this.status !== CDPConnectionStatus.CONNECTED) {
      throw new Error("CDPClient is not connected")
    }

    const result = await this.sendCommand("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      includeCommandLineAPI: false,
      silent: false,
      ...options,
    })

    if (result.success) {
      return result.result.result?.value
    } else {
      throw new Error(result.error || "Evaluation failed")
    }
  }

  /**
   * Send command to CDP target
   */
  async sendCommand(method: string, params: any = {}): Promise<CDPCommandResult> {
    if (this.status !== CDPConnectionStatus.CONNECTED) {
      throw new Error("CDPClient is not connected")
    }

    const id = this.commandId++
    const _startTime = performance.now()

    return new Promise<CDPCommandResult>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(id)
        reject(new Error(`Command ${method} timed out`))
      }, this.config.timeout || 30000)

      // Store pending command
      this.pendingCommands.set(id, {
        resolve,
        reject,
        timeout,
      })

      // Send command
      const message = JSON.stringify({
        id,
        method,
        params,
      })

      this.webSocket?.send(message).catch((error) => {
        clearTimeout(timeout)
        this.pendingCommands.delete(id)
        reject(error)
      })
    })
  }

  /**
   * Add event listener
   */
  addEventListener<T extends keyof CDPEvents>(event: T, handler: (params: CDPEvents[T]) => void): string {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    const listenerId = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.eventListeners.get(event)!.add({ event: event as string, handler: handler as any, id: listenerId })
    this.logger.debug(`Added event listener for: ${event}`)
    return listenerId
  }

  /**
   * Remove event listener
   */
  removeEventListener<T extends keyof CDPEvents>(event: T, handler: (params: CDPEvents[T]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const listener of Array.from(listeners)) {
        if (listener.handler === handler) {
          listeners.delete(listener)
          break
        }
      }
      if (listeners.size === 0) {
        this.eventListeners.delete(event)
      }
    }
    this.logger.debug(`Removed event listener for: ${event}`)
  }

  /**
   * Get current connection status
   */
  getStatus(): CDPConnectionStatus {
    return this.status
  }

  /**
   * Get all active sessions
   */
  getSessions(): CDPSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CDPSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get all targets
   */
  getTargets(): CDPTarget[] {
    return Array.from(this.targets.values())
  }

  /**
   * Get target by ID
   */
  getTarget(targetId: string): CDPTarget | undefined {
    return this.targets.get(targetId)
  }

  /**
   * Check if connected to CDP target
   */
  isConnected(): boolean {
    return this.status === CDPConnectionStatus.CONNECTED
  }

  /**
   * Perform the actual connection
   */
  private async performConnect(): Promise<void> {
    // Create WebSocket connection
    this.webSocket = await this.createWebSocket(this.config.targetUrl)

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers()

    // Set status to connected before sending initialization commands
    this.setStatus(CDPConnectionStatus.CONNECTED)

    // Send initial commands
    await this.initializeConnection()
  }

  /**
   * Create WebSocket connection
   */
  private async createWebSocket(_url: string): Promise<CDPWebSocket> {
    // In a real implementation, this would create an actual WebSocket
    // For now, we create a mock implementation
    return new MockWebSocket()
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.webSocket) {
      return
    }

    this.webSocket.addEventListener("open", () => {
      this.logger.debug("WebSocket connection opened")
    })

    this.webSocket.addEventListener("message", (event) => {
      this.handleMessage(event.data)
    })

    this.webSocket.addEventListener("close", () => {
      this.logger.warn("WebSocket connection closed")
      this.handleConnectionClosed()
    })

    this.webSocket.addEventListener("error", (error) => {
      this.logger.error("WebSocket error", error)
      this.handleConnectionError(error)
    })
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)

      if (message.id) {
        // Command response
        this.handleCommandResponse(message)
      } else if (message.method) {
        // Event
        this.handleEvent(message)
      }
    } catch (error) {
      this.logger.error("Failed to parse WebSocket message", error as Error)
    }
  }

  /**
   * Handle command response
   */
  private handleCommandResponse(message: any): void {
    const { id, result, error } = message
    const command = this.pendingCommands.get(id)

    if (command) {
      this.pendingCommands.delete(id)

      if (command.timeout) {
        clearTimeout(command.timeout)
      }

      if (error) {
        command.resolve({
          result: null,
          success: false,
          error: error.message || "Unknown error",
          executionTime: 0,
        })
      } else {
        command.resolve({
          result,
          success: true,
          executionTime: 0,
        })
      }
    }
  }

  /**
   * Handle CDP event
   */
  private handleEvent(message: any): void {
    const { method, params } = message
    const listeners = this.eventListeners.get(method)

    if (listeners) {
      for (const listener of Array.from(listeners)) {
        try {
          listener.handler(params)
        } catch (error) {
          this.logger.error(`Error in event listener for ${method}`, error as Error)
        }
      }
    }

    // Handle built-in events
    this.handleBuiltInEvent(method, params)
  }

  /**
   * Handle built-in CDP events
   */
  private handleBuiltInEvent(method: string, params: any): void {
    switch (method) {
      case "Target.targetCreated":
        this.targets.set(params.targetInfo.targetId, params.targetInfo)
        break
      case "Target.targetDestroyed":
        this.targets.delete(params.targetId)
        break
      case "Target.attachedToTarget":
        this.sessions.set(params.sessionId, {
          sessionId: params.sessionId,
          targetId: params.targetInfo.targetId,
          createdAt: new Date(),
          isActive: true,
          lastActivity: new Date(),
        })
        break
      case "Target.detachedFromTarget": {
        const session = this.sessions.get(params.sessionId)
        if (session) {
          session.isActive = false
        }
        break
      }
    }
  }

  /**
   * Initialize connection with required commands
   */
  private async initializeConnection(): Promise<void> {
    // Enable domains
    await this.sendCommand("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
    })

    await this.sendCommand("Page.enable")
    await this.sendCommand("Runtime.enable")
    await this.sendCommand("Network.enable")
  }

  /**
   * Handle connection closed event
   */
  private handleConnectionClosed(): void {
    this.setStatus(CDPConnectionStatus.DISCONNECTED)

    if (this.config.autoReconnect && this.reconnectAttempts < (this.config.maxRetries || 3)) {
      this.scheduleReconnect()
    }
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: any): void {
    this.setStatus(CDPConnectionStatus.ERROR)
    this.logger.error("CDP connection error", error)
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimer()

    const delay = (this.config.retryDelay || 1000) * 2 ** this.reconnectAttempts
    this.reconnectAttempts++

    this.logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`)

    this.reconnectTimer = setTimeout(() => {
      this.setStatus(CDPConnectionStatus.RECONNECTING)
      this.connect().catch((error) => {
        this.logger.error("Reconnection failed", error)
      })
    }, delay)
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
  }

  /**
   * Set connection status
   */
  private setStatus(status: CDPConnectionStatus): void {
    if (this.status !== status) {
      this.logger.debug(`CDP status changed: ${this.status} -> ${status}`)
      this.status = status
    }
  }
}

/**
 * Mock WebSocket implementation for testing
 */
class MockWebSocket implements CDPWebSocket {
  readyState = 1 // OPEN
  private listeners = new Map<string, Set<(event: any) => void>>()

  async connect(_url: string): Promise<void> {
    // Mock implementation
  }

  async send(message: string): Promise<void> {
    // Mock implementation - in real scenario would send to WebSocket
    setTimeout(() => {
      // Mock response
      const parsed = JSON.parse(message)
      this.handleMessage({
        id: parsed.id,
        result: { result: { value: "mock result" } },
      })
    }, 10)
  }

  close(_code?: number, _reason?: string): void {
    // Mock implementation
  }

  addEventListener(event: string, handler: (event: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  removeEventListener(event: string, handler: (event: any) => void): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(handler)
      if (listeners.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  private handleMessage(message: any): void {
    setTimeout(() => {
      const listeners = this.listeners.get("message")
      if (listeners) {
        for (const listener of Array.from(listeners)) {
          listener({ data: JSON.stringify(message) })
        }
      }
    }, 5)
  }
}
