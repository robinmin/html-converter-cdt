import type { CDPEvents, CDPLogger } from "./types.js"

/**
 * Event handler wrapper
 */
interface EventHandler<T = any> {
  handler: (params: T) => void
  once: boolean
  priority: number
}

/**
 * Event filter function
 */
type EventFilter<T = any> = (params: T) => boolean

/**
 * Event transformer function
 */
type EventTransformer<T = any, R = any> = (params: T) => R

/**
 * Enhanced CDP Event Manager
 * Provides sophisticated event handling with filtering, transformation, and priority
 */
export class CDPEventManager {
  private logger: CDPLogger
  private listeners = new Map<keyof CDPEvents, Map<string, EventHandler>>()
  private eventHistory: Array<{
    event: keyof CDPEvents
    params: any
    timestamp: Date
  }> = []

  private maxHistorySize: number
  private middleware: Array<{
    events: Array<keyof CDPEvents> | "*"
    handler: (event: keyof CDPEvents, params: any, next: () => void) => void
  }> = []

  constructor(logger: CDPLogger, maxHistorySize: number = 1000) {
    this.logger = logger
    this.maxHistorySize = maxHistorySize
  }

  /**
   * Add event listener with options
   */
  on<T extends keyof CDPEvents>(
    event: T,
    handler: (params: CDPEvents[T]) => void,
    options: {
      priority?: number
      once?: boolean
      id?: string
    } = {},
  ): string {
    const listenerId = options.id || this.generateListenerId()
    const priority = options.priority || 0

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Map())
    }

    const eventListeners = this.listeners.get(event)!
    eventListeners.set(listenerId, {
      handler: handler as any,
      once: options.once || false,
      priority,
    })

    this.logger.debug(`Added listener for ${event} with ID: ${listenerId}`)
    return listenerId
  }

  /**
   * Add one-time event listener
   */
  once<T extends keyof CDPEvents>(
    event: T,
    handler: (params: CDPEvents[T]) => void,
    options: { priority?: number, id?: string } = {},
  ): string {
    return this.on(event, handler, { ...options, once: true })
  }

  /**
   * Remove event listener by ID
   */
  off(listenerId: string): boolean {
    for (const [event, eventListeners] of this.listeners) {
      if (eventListeners.delete(listenerId)) {
        this.logger.debug(`Removed listener ${listenerId} from ${event}`)
        return true
      }
    }
    return false
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: keyof CDPEvents): void {
    if (event) {
      const count = this.listeners.get(event)?.size || 0
      this.listeners.delete(event)
      this.logger.debug(`Removed ${count} listeners from ${event}`)
    } else {
      let totalRemoved = 0
      for (const eventListeners of this.listeners.values()) {
        totalRemoved += eventListeners.size
      }
      this.listeners.clear()
      this.logger.debug(`Removed ${totalRemoved} listeners from all events`)
    }
  }

  /**
   * Emit event to all listeners
   */
  async emit<T extends keyof CDPEvents>(event: T, params: CDPEvents[T]): Promise<void> {
    // Add to history
    this.addToHistory(event, params)

    // Process middleware
    await this.processMiddleware(event, params, () => {
      this.processEventListeners(event, params)
    })
  }

  /**
   * Add middleware for event processing
   */
  use(
    events: Array<keyof CDPEvents> | "*",
    handler: (event: keyof CDPEvents, params: any, next: () => void) => void,
  ): void {
    this.middleware.push({ events, handler })
    this.logger.debug(`Added middleware for events: ${events === "*" ? "all" : events.join(", ")}`)
  }

  /**
   * Create filtered event listener
   */
  onFiltered<T extends keyof CDPEvents>(
    event: T,
    filter: EventFilter<CDPEvents[T]>,
    handler: (params: CDPEvents[T]) => void,
    options?: { priority?: number, id?: string },
  ): string {
    return this.on(event, (params) => {
      if (filter(params)) {
        handler(params)
      }
    }, options)
  }

  /**
   * Create transformed event listener
   */
  onTransformed<T extends keyof CDPEvents, R>(
    event: T,
    transformer: EventTransformer<CDPEvents[T], R>,
    handler: (params: R) => void,
    options?: { priority?: number, id?: string },
  ): string {
    return this.on(event, (params) => {
      const transformed = transformer(params)
      handler(transformed)
    }, options)
  }

  /**
   * Wait for specific event
   */
  waitForEvent<T extends keyof CDPEvents>(
    event: T,
    timeout: number = 30000,
    filter?: EventFilter<CDPEvents[T]>,
  ): Promise<CDPEvents[T]> {
    return new Promise<CDPEvents[T]>((resolve, reject) => {
      let listenerId: string

      const timeoutId = setTimeout(() => {
        this.off(listenerId)
        reject(new Error(`Timeout waiting for event: ${event}`))
      }, timeout)

      listenerId = this.on(event, (params) => {
        if (!filter || filter(params)) {
          clearTimeout(timeoutId)
          resolve(params)
        }
      }, { once: true })
    })
  }

  /**
   * Wait for multiple events
   */
  waitForEvents<T extends keyof CDPEvents>(
    events: T[],
    timeout: number = 30000,
  ): Promise<{ [K in T]: CDPEvents[K] }> {
    return new Promise((resolve, reject) => {
      const results = {} as { [K in T]: CDPEvents[K] }
      const listenerIds: string[] = []
      let completedEvents = 0

      let timeoutId: NodeJS.Timeout

      const cleanup = () => {
        clearTimeout(timeoutId)
        listenerIds.forEach(id => this.off(id))
      }

      timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error("Timeout waiting for events"))
      }, timeout)

      for (const event of events) {
        const listenerId = this.on(event, (params) => {
          (results as any)[event] = params
          completedEvents++

          if (completedEvents === events.length) {
            cleanup()
            resolve(results)
          }
        }, { once: true })

        listenerIds.push(listenerId)
      }
    })
  }

  /**
   * Get event history
   */
  getHistory<T extends keyof CDPEvents>(
    event?: T,
    limit?: number,
  ): Array<{ event: keyof CDPEvents, params: any, timestamp: Date }> {
    let history = this.eventHistory

    if (event) {
      history = history.filter(item => item.event === event)
    }

    return history.slice(-limit || history.length)
  }

  /**
   * Clear event history
   */
  clearHistory(event?: keyof CDPEvents): void {
    if (event) {
      this.eventHistory = this.eventHistory.filter(item => item.event !== event)
      this.logger.debug(`Cleared history for event: ${event}`)
    } else {
      this.eventHistory = []
      this.logger.debug("Cleared all event history")
    }
  }

  /**
   * Get listener count for event
   */
  getListenerCount(event?: keyof CDPEvents): number {
    if (event) {
      return this.listeners.get(event)?.size || 0
    }

    let total = 0
    for (const eventListeners of this.listeners.values()) {
      total += eventListeners.size
    }
    return total
  }

  /**
   * Get event statistics
   */
  getStats(): {
    totalEvents: number
    totalListeners: number
    eventCounts: { [K in keyof CDPEvents]?: number }
    listenerCounts: { [K in keyof CDPEvents]?: number }
  } {
    const eventCounts: { [K in keyof CDPEvents]?: number } = {}
    const listenerCounts: { [K in keyof CDPEvents]?: number } = {}

    // Count events in history
    for (const item of this.eventHistory) {
      eventCounts[item.event] = (eventCounts[item.event] || 0) + 1
    }

    // Count listeners
    for (const [event, eventListeners] of this.listeners) {
      listenerCounts[event] = eventListeners.size
    }

    return {
      totalEvents: this.eventHistory.length,
      totalListeners: this.getListenerCount(),
      eventCounts,
      listenerCounts,
    }
  }

  /**
   * Process event listeners for an event
   */
  private processEventListeners<T extends keyof CDPEvents>(event: T, params: CDPEvents[T]): void {
    const eventListeners = this.listeners.get(event)
    if (!eventListeners || eventListeners.size === 0) {
      return
    }

    // Sort listeners by priority (higher priority first)
    const sortedListeners = Array.from(eventListeners.entries())
      .sort(([, a], [, b]) => b.priority - a.priority)

    const toRemove: string[] = []

    for (const [listenerId, eventHandler] of sortedListeners) {
      try {
        eventHandler.handler(params)

        if (eventHandler.once) {
          toRemove.push(listenerId)
        }
      } catch (error) {
        this.logger.error(`Error in event listener for ${event}`, error as Error)
      }
    }

    // Remove one-time listeners
    for (const listenerId of toRemove) {
      eventListeners.delete(listenerId)
    }
  }

  /**
   * Process middleware chain
   */
  private async processMiddleware<T extends keyof CDPEvents>(
    event: T,
    params: CDPEvents[T],
    finalHandler: () => void,
  ): Promise<void> {
    const applicableMiddleware = this.middleware.filter(mw =>
      mw.events === "*" || mw.events.includes(event),
    )

    if (applicableMiddleware.length === 0) {
      finalHandler()
      return
    }

    let index = 0

    const next = () => {
      if (index >= applicableMiddleware.length) {
        finalHandler()
        return
      }

      const middleware = applicableMiddleware[index++]
      try {
        middleware.handler(event, params, next)
      } catch (error) {
        this.logger.error("Middleware error", error as Error)
        next() // Continue to next middleware on error
      }
    }

    next()
  }

  /**
   * Add event to history
   */
  private addToHistory<T extends keyof CDPEvents>(event: T, params: CDPEvents[T]): void {
    this.eventHistory.push({
      event,
      params,
      timestamp: new Date(),
    })

    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      const excess = this.eventHistory.length - this.maxHistorySize
      this.eventHistory.splice(0, excess)
    }
  }

  /**
   * Generate unique listener ID
   */
  private generateListenerId(): string {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
