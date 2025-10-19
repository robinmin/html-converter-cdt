/**
 * Memory Management Utilities
 *
 * Provides memory monitoring, heap usage tracking, garbage collection triggering,
 * and memory usage alerts for Chrome extension environment.
 */

export interface MemoryStats {
  used: number
  total: number
  limit: number
  percentage: number
  timestamp: number
}

export interface MemoryThresholds {
  warning: number // Alert threshold (default: 70%)
  critical: number // Critical threshold (default: 85%)
  maximum: number // Maximum allowed (default: 95%)
}

export interface BufferConfig {
  minSize: number
  maxSize: number
  defaultSize: number
}

/**
 * Memory management utilities for Chrome extension environment
 */
export class MemoryManager {
  private static instance: MemoryManager
  private thresholds: MemoryThresholds = {
    warning: 0.7,
    critical: 0.85,
    maximum: 0.95,
  }

  private bufferConfig: BufferConfig = {
    minSize: 8 * 1024, // 8KB
    maxSize: 1024 * 1024, // 1MB
    defaultSize: 64 * 1024, // 64KB
  }

  private memoryHistory: MemoryStats[] = []
  private maxHistorySize = 100
  private lastGC = 0
  private gcCooldown = 5000 // 5 seconds between GC calls

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats | null {
    try {
      // Chrome extension environment - use performance.memory if available
      if ("memory" in performance && (performance as any).memory) {
        const memory = (performance as any).memory
        const stats: MemoryStats = {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          percentage: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
          timestamp: Date.now(),
        }

        // Store in history
        this.addToHistory(stats)
        return stats
      }

      // Fallback for environments without performance.memory
      return null
    } catch (error) {
      console.warn("Failed to get memory stats:", error)
      return null
    }
  }

  /**
   * Check if memory usage is within acceptable limits
   */
  checkMemoryUsage(): {
    status: "normal" | "warning" | "critical" | "exceeded"
    stats?: MemoryStats
    message?: string
  } {
    const stats = this.getMemoryStats()

    if (!stats) {
      return { status: "normal", message: "Memory monitoring unavailable" }
    }

    const { percentage } = stats
    const { warning, critical, maximum } = this.thresholds

    if (percentage >= maximum) {
      return {
        status: "exceeded",
        stats,
        message: `Memory usage (${(percentage * 100).toFixed(1)}%) exceeded maximum threshold`,
      }
    }

    if (percentage >= critical) {
      return {
        status: "critical",
        stats,
        message: `Memory usage (${(percentage * 100).toFixed(1)}%) reached critical level`,
      }
    }

    if (percentage >= warning) {
      return {
        status: "warning",
        stats,
        message: `Memory usage (${(percentage * 100).toFixed(1)}%) above warning threshold`,
      }
    }

    return { status: "normal", stats }
  }

  /**
   * Trigger garbage collection if available and cooldown has passed
   */
  async triggerGarbageCollection(): Promise<boolean> {
    const now = Date.now()

    // Respect cooldown period
    if (now - this.lastGC < this.gcCooldown) {
      return false
    }

    try {
      // Chrome extension environment - use window.gc if available
      if (typeof window !== "undefined" && "gc" in window && typeof (window as any).gc === "function") {
        (window as any).gc()
        this.lastGC = now
        return true
      }

      // Fallback: suggest cleanup through other means
      await this.performManualCleanup()
      this.lastGC = now
      return true
    } catch (error) {
      console.warn("Failed to trigger garbage collection:", error)
      return false
    }
  }

  /**
   * Manual cleanup operations
   */
  private async performManualCleanup(): Promise<void> {
    // Clear memory history if too large
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-50)
    }

    // Trigger cleanup in other modules if they have cleanup methods
    if (typeof globalThis !== "undefined" && (globalThis as any).cleanupResources) {
      try {
        await (globalThis as any).cleanupResources()
      } catch (error) {
        console.warn("Manual cleanup failed:", error)
      }
    }
  }

  /**
   * Get optimal buffer size based on current memory usage
   */
  getOptimalBufferSize(): number {
    const memoryCheck = this.checkMemoryUsage()
    const { minSize, maxSize, defaultSize } = this.bufferConfig

    switch (memoryCheck.status) {
      case "exceeded":
        return minSize
      case "critical":
        return minSize
      case "warning":
        return Math.min(defaultSize * 0.75, maxSize)
      default:
        return defaultSize
    }
  }

  /**
   * Check if system has available memory for operations
   */
  hasAvailableMemory(requiredMB = 50): boolean {
    const stats = this.getMemoryStats()
    if (!stats) {
      return true
    } // Assume available if can't check

    const availableMB = (stats.limit - stats.used) / (1024 * 1024)
    return availableMB >= requiredMB
  }

  /**
   * Monitor memory usage over time
   */
  startMemoryMonitoring(intervalMs = 5000): () => void {
    const interval = setInterval(() => {
      const check = this.checkMemoryUsage()

      if (check.status !== "normal") {
        console.warn(`Memory Alert: ${check.message}`)

        // Auto-trigger GC for critical/exceeded levels
        if (check.status === "critical" || check.status === "exceeded") {
          this.triggerGarbageCollection()
        }
      }
    }, intervalMs)

    // Return stop function
    return () => clearInterval(interval)
  }

  /**
   * Get memory usage trend
   */
  getMemoryTrend(minutes = 10): {
    trend: "increasing" | "decreasing" | "stable"
    rate: number // MB per minute
    samples: number
  } {
    const cutoff = Date.now() - (minutes * 60 * 1000)
    const recentStats = this.memoryHistory.filter(s => s.timestamp >= cutoff)

    if (recentStats.length < 2) {
      return { trend: "stable", rate: 0, samples: recentStats.length }
    }

    const first = recentStats[0]
    const last = recentStats[recentStats.length - 1]
    const timeDiff = (last.timestamp - first.timestamp) / (1000 * 60) // minutes
    const memDiff = (last.used - first.used) / (1024 * 1024) // MB

    const rate = memDiff / timeDiff

    let trend: "increasing" | "decreasing" | "stable"
    if (Math.abs(rate) < 1) {
      trend = "stable"
    } else if (rate > 0) {
      trend = "increasing"
    } else {
      trend = "decreasing"
    }

    return { trend, rate, samples: recentStats.length }
  }

  /**
   * Configure memory thresholds
   */
  setThresholds(thresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  /**
   * Configure buffer settings
   */
  setBufferConfig(config: Partial<BufferConfig>): void {
    this.bufferConfig = { ...this.bufferConfig, ...config }
  }

  /**
   * Add memory stats to history
   */
  private addToHistory(stats: MemoryStats): void {
    this.memoryHistory.push(stats)

    // Keep only recent history
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * Get memory history
   */
  getMemoryHistory(limit?: number): MemoryStats[] {
    return limit ? this.memoryHistory.slice(-limit) : [...this.memoryHistory]
  }

  /**
   * Clear memory history
   */
  clearHistory(): void {
    this.memoryHistory = []
  }

  /**
   * Get memory pressure level (0-1)
   */
  getMemoryPressure(): number {
    const stats = this.getMemoryStats()
    if (!stats) {
      return 0
    }

    const { percentage } = stats
    const { warning, critical, maximum } = this.thresholds

    if (percentage < warning) {
      return percentage / warning // 0 to warning% scaled to 0-0.7
    } else if (percentage < critical) {
      return 0.7 + ((percentage - warning) / (critical - warning)) * 0.2 // warning to critical scaled to 0.7-0.9
    } else if (percentage < maximum) {
      return 0.9 + ((percentage - critical) / (maximum - critical)) * 0.1 // critical to maximum scaled to 0.9-1.0
    } else {
      return 1.0 // Exceeded maximum
    }
  }

  /**
   * Estimate memory available for new operations
   */
  estimateAvailableMemory(): number {
    const stats = this.getMemoryStats()
    if (!stats) {
      return 100 * 1024 * 1024
    } // Default 100MB estimate

    return Math.max(0, stats.limit - stats.used)
  }

  /**
   * Suggest concurrent operation limit based on memory
   */
  suggestConcurrencyLimit(baseLimit = 5): number {
    const _pressure = this.getMemoryPressure()
    const memoryCheck = this.checkMemoryUsage()

    if (memoryCheck.status === "exceeded") {
      return 1 // Only one operation at a time
    } else if (memoryCheck.status === "critical") {
      return Math.max(1, Math.floor(baseLimit * 0.3))
    } else if (memoryCheck.status === "warning") {
      return Math.max(1, Math.floor(baseLimit * 0.6))
    } else {
      return baseLimit // Full concurrency allowed
    }
  }
}

/**
 * Global memory manager instance
 */
export const memoryManager = MemoryManager.getInstance()

/**
 * Utility function to run operation with memory monitoring
 */
export async function withMemoryMonitoring<T>(
  operation: () => Promise<T>,
  options: {
    requiredMemoryMB?: number
    timeoutMs?: number
    onMemoryPressure?: (pressure: number) => void
  } = {},
): Promise<T> {
  const { requiredMemoryMB = 50, timeoutMs = 30000, onMemoryPressure: _onMemoryPressure } = options

  // Check initial memory
  const initialCheck = memoryManager.checkMemoryUsage()
  if (initialCheck.status === "exceeded"
    || (requiredMemoryMB && !memoryManager.hasAvailableMemory(requiredMemoryMB))) {
    throw new Error(`Insufficient memory for operation: ${initialCheck.message}`)
  }

  // Start monitoring
  const stopMonitoring = memoryManager.startMemoryMonitoring(1000)

  try {
    // Set timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
    })

    // Run operation
    const result = await Promise.race([
      operation(),
      timeoutPromise,
    ])

    return result
  } finally {
    stopMonitoring()

    // Trigger cleanup if needed
    const finalCheck = memoryManager.checkMemoryUsage()
    if (finalCheck.status !== "normal") {
      await memoryManager.triggerGarbageCollection()
    }
  }
}
