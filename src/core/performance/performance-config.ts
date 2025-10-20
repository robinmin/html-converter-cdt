/**
 * Performance Configuration and Monitoring System
 *
 * Provides performance settings configuration, metrics tracking, and alerting
 * for conversion timing, memory usage, and Chrome utilization.
 */

import type { Logger } from "../../architecture/strategies/types.js"

import { memoryManager } from "./memory-manager.js"

/**
 * Performance configuration settings
 */
export interface PerformanceConfig {
  /** Concurrency settings */
  concurrency?: {
    /** Default concurrent conversions */
    default: number
    /** Maximum concurrent conversions */
    maximum: number
    /** Chrome instance pool size */
    chromePoolSize: number
    /** Batch processing size */
    batchSize: number
  }

  /** Memory management settings */
  memory?: {
    /** Memory usage alert threshold (0-1) */
    alertThreshold: number
    /** Memory usage critical threshold (0-1) */
    criticalThreshold: number
    /** Maximum memory per conversion (MB) */
    maxPerConversion: number
    /** Buffer size for streaming (bytes) */
    bufferSize: number
    /** Enable automatic garbage collection */
    autoGC: boolean
  }

  /** Performance timing targets */
  timing?: {
    /** Small HTML target time (ms) */
    smallHTMLTarget: number
    /** Medium HTML target time (ms) */
    mediumHTMLTarget: number
    /** Large HTML target time (ms) */
    largeHTMLTarget: number
    /** Streaming threshold (bytes) */
    streamingThreshold: number
    /** Resource fetch timeout (ms) */
    resourceTimeout: number
    /** Connection timeout (ms) */
    connectionTimeout: number
  }

  /** Monitoring and alerting */
  monitoring?: {
    /** Enable performance monitoring */
    enabled: boolean
    /** Metrics collection interval (ms) */
    metricsInterval: number
    /** Alert on performance degradation */
    alertOnDegradation: boolean
    /** Performance degradation threshold (%) */
    degradationThreshold: number
    /** Keep metrics history size */
    historySize: number
  }

  /** Resource optimization */
  resources?: {
    /** Enable resource caching */
    enableCaching: boolean
    /** Cache size limit (MB) */
    cacheSizeLimit: number
    /** Connection pool size */
    connectionPoolSize: number
    /** Retry attempts */
    retryAttempts: number
    /** Retry delay (ms) */
    retryDelay: number
  }
}

/**
 * Performance metrics data point
 */
export interface PerformanceMetrics {
  /** Timestamp */
  timestamp: Date
  /** Conversion ID */
  conversionId: string
  /** Input size in bytes */
  inputSize: number
  /** Output size in bytes */
  outputSize: number
  /** Processing time in milliseconds */
  processingTime: number
  /** Memory usage snapshot */
  memoryUsage?: {
    used: number
    total: number
    percentage: number
  }
  /** Resource count */
  resourceCount: number
  /** Concurrent operations count */
  concurrencyLevel: number
  /** Processing type */
  processingType: "single" | "batch" | "streaming"
  /** Success status */
  success: boolean
  /** Error details if failed */
  error?: string
  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Performance alert information
 */
export interface PerformanceAlert {
  /** Alert ID */
  id: string
  /** Alert type */
  type: "memory" | "performance" | "resource" | "system"
  /** Alert severity */
  severity: "low" | "medium" | "high" | "critical"
  /** Alert message */
  message: string
  /** Alert timestamp */
  timestamp: Date
  /** Related metrics */
  metrics?: PerformanceMetrics
  /** Alert data */
  data?: Record<string, any>
  /** Whether alert was acknowledged */
  acknowledged: boolean
}

/**
 * Performance statistics summary
 */
export interface PerformanceStats {
  /** Total conversions processed */
  totalConversions: number
  /** Successful conversions */
  successfulConversions: number
  /** Failed conversions */
  failedConversions: number
  /** Success rate percentage */
  successRate: number
  /** Average processing time */
  averageProcessingTime: number
  /** Total data processed (bytes) */
  totalDataProcessed: number
  /** Average memory usage */
  averageMemoryUsage: number
  /** Peak memory usage */
  peakMemoryUsage: number
  /** Average concurrency level */
  averageConcurrency: number
  /** Processing rate (conversions per second) */
  processingRate: number
  /** Performance trend */
  performanceTrend: "improving" | "degrading" | "stable"
  /** Active alerts count */
  activeAlerts: number
}

/**
 * Performance Monitor and Configuration Manager
 */
export class PerformanceMonitor {
  private logger: Logger
  private config: Required<PerformanceConfig>
  private metricsHistory: PerformanceMetrics[] = []
  private alerts: PerformanceAlert[] = []
  private metricsInterval?: NodeJS.Timeout
  private isMonitoring = false
  private activeConversions = new Set<string>()

  constructor(logger: Logger, config: PerformanceConfig = {}) {
    this.logger = logger

    // Get memory-aware default settings
    const memoryAwareConcurrency = memoryManager.suggestConcurrencyLimit()
    const optimalBufferSize = memoryManager.getOptimalBufferSize()

    this.config = {
      concurrency: {
        default: Math.max(1, Math.floor(memoryAwareConcurrency * 0.8)),
        maximum: memoryAwareConcurrency,
        chromePoolSize: Math.max(2, Math.floor(memoryAwareConcurrency * 0.6)),
        batchSize: Math.max(1, Math.floor(memoryAwareConcurrency * 0.4)),
        ...config.concurrency,
      },

      memory: {
        alertThreshold: 0.7,
        criticalThreshold: 0.85,
        maxPerConversion: 100, // 100MB
        bufferSize: optimalBufferSize,
        autoGC: true,
        ...config.memory,
      },

      timing: {
        smallHTMLTarget: 2000, // 2 seconds
        mediumHTMLTarget: 5000, // 5 seconds
        largeHTMLTarget: 15000, // 15 seconds
        streamingThreshold: 1024 * 1024, // 1MB
        resourceTimeout: 30000, // 30 seconds
        connectionTimeout: 10000, // 10 seconds
        ...config.timing,
      },

      monitoring: {
        enabled: true,
        metricsInterval: 5000, // 5 seconds
        alertOnDegradation: true,
        degradationThreshold: 20, // 20%
        historySize: 1000,
        ...config.monitoring,
      },

      resources: {
        enableCaching: true,
        cacheSizeLimit: 50, // 50MB
        connectionPoolSize: 10,
        retryAttempts: 3,
        retryDelay: 1000, // 1 second
        ...config.resources,
      },
    }

    this.logger.info("Performance monitor initialized", {
      defaultConcurrency: this.config.concurrency.default,
      maxConcurrency: this.config.concurrency.maximum,
      bufferSize: this.config.memory.bufferSize,
      monitoringEnabled: this.config.monitoring.enabled,
    })

    // Start monitoring if enabled
    if (this.config.monitoring.enabled) {
      this.startMonitoring()
    }
  }

  /**
   * Get current performance configuration
   */
  getConfig(): Required<PerformanceConfig> {
    return { ...this.config }
  }

  /**
   * Update performance configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig }

    this.logger.info("Performance configuration updated", {
      changes: Object.keys(newConfig),
    })

    // Restart monitoring if settings changed
    if (this.config.monitoring.enabled && !this.isMonitoring) {
      this.startMonitoring()
    } else if (!this.config.monitoring.enabled && this.isMonitoring) {
      this.stopMonitoring()
    }
  }

  /**
   * Start a new conversion tracking
   *
   * @param conversionId - Unique conversion identifier
   * @param processingType - Type of processing
   */
  startConversion(conversionId: string, processingType: "single" | "batch" | "streaming" = "single"): void {
    this.activeConversions.add(conversionId)

    this.logger.debug("Conversion tracking started", {
      conversionId,
      processingType,
      activeConversions: this.activeConversions.size,
    })
  }

  /**
   * Record conversion metrics
   *
   * @param metrics - Performance metrics to record
   */
  recordMetrics(metrics: Omit<PerformanceMetrics, "timestamp" | "concurrencyLevel">): void {
    const fullMetrics: PerformanceMetrics = {
      ...metrics,
      timestamp: new Date(),
      concurrencyLevel: this.activeConversions.size,
    }

    // Add to history
    this.metricsHistory.push(fullMetrics)

    // Maintain history size limit
    if (this.metricsHistory.length > this.config.monitoring.historySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.config.monitoring.historySize)
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(fullMetrics)

    // Remove from active conversions
    this.activeConversions.delete(metrics.conversionId)

    this.logger.debug("Conversion metrics recorded", {
      conversionId: metrics.conversionId,
      processingTime: metrics.processingTime,
      success: metrics.success,
    })
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStats(): PerformanceStats {
    if (this.metricsHistory.length === 0) {
      return {
        totalConversions: 0,
        successfulConversions: 0,
        failedConversions: 0,
        successRate: 0,
        averageProcessingTime: 0,
        totalDataProcessed: 0,
        averageMemoryUsage: 0,
        peakMemoryUsage: 0,
        averageConcurrency: 0,
        processingRate: 0,
        performanceTrend: "stable",
        activeAlerts: this.alerts.filter(a => !a.acknowledged).length,
      }
    }

    const successful = this.metricsHistory.filter(m => m.success).length
    const failed = this.metricsHistory.length - successful
    const totalProcessingTime = this.metricsHistory.reduce((sum, m) => sum + m.processingTime, 0)
    const totalDataProcessed = this.metricsHistory.reduce((sum, m) => sum + m.outputSize, 0)
    const averageConcurrency = this.metricsHistory.reduce((sum, m) => sum + m.concurrencyLevel, 0) / this.metricsHistory.length

    // Calculate memory statistics
    const memoryMetrics = this.metricsHistory.filter(m => m.memoryUsage)
    const averageMemoryUsage = memoryMetrics.length > 0
      ? memoryMetrics.reduce((sum, m) => sum + m.memoryUsage!.percentage, 0) / memoryMetrics.length
      : 0
    const peakMemoryUsage = memoryMetrics.length > 0
      ? Math.max(...memoryMetrics.map(m => m.memoryUsage!.percentage))
      : 0

    // Calculate processing rate
    const timeSpan = this.metricsHistory.length > 0
      ? (Date.now() - this.metricsHistory[0]!.timestamp.getTime()) / 1000
      : 0
    const processingRate = timeSpan > 0 ? this.metricsHistory.length / timeSpan : 0

    // Calculate performance trend
    const trend = this.calculatePerformanceTrend()

    return {
      totalConversions: this.metricsHistory.length,
      successfulConversions: successful,
      failedConversions: failed,
      successRate: (successful / this.metricsHistory.length) * 100,
      averageProcessingTime: totalProcessingTime / this.metricsHistory.length,
      totalDataProcessed,
      averageMemoryUsage,
      peakMemoryUsage,
      averageConcurrency,
      processingRate,
      performanceTrend: trend,
      activeAlerts: this.alerts.filter(a => !a.acknowledged).length,
    }
  }

  /**
   * Get recent metrics
   *
   * @param limit - Maximum number of metrics to return
   * @param processingType - Filter by processing type
   */
  getRecentMetrics(limit = 100, processingType?: "single" | "batch" | "streaming"): PerformanceMetrics[] {
    let metrics = [...this.metricsHistory].reverse()

    if (processingType) {
      metrics = metrics.filter(m => m.processingType === processingType)
    }

    return metrics.slice(0, limit)
  }

  /**
   * Get active alerts
   *
   * @param acknowledged - Whether to include acknowledged alerts
   */
  getAlerts(acknowledged = false): PerformanceAlert[] {
    return this.alerts.filter(alert => !acknowledged || !alert.acknowledged)
  }

  /**
   * Acknowledge an alert
   *
   * @param alertId - Alert ID to acknowledge
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      this.logger.debug("Alert acknowledged", { alertId })
    }
  }

  /**
   * Get performance recommendations based on current metrics
   */
  getRecommendations(): string[] {
    const recommendations: string[] = []
    const stats = this.getPerformanceStats()
    const memoryCheck = memoryManager.checkMemoryUsage()

    // Memory recommendations
    if (memoryCheck.status === "warning" || memoryCheck.status === "critical") {
      recommendations.push("Consider reducing concurrency to lower memory usage")
      recommendations.push("Enable streaming for large files to reduce memory footprint")
    }

    // Performance recommendations
    if (stats.averageProcessingTime > this.config.timing.mediumHTMLTarget) {
      recommendations.push("Consider increasing batch size for better throughput")
      recommendations.push("Check for resource bottlenecks or network issues")
    }

    // Success rate recommendations
    if (stats.successRate < 95) {
      recommendations.push("Review error patterns and increase retry attempts")
      recommendations.push("Consider increasing timeout values for slow resources")
    }

    // Concurrency recommendations
    if (stats.averageConcurrency < this.config.concurrency.default * 0.5) {
      recommendations.push("Consider increasing default concurrency for better utilization")
    }

    return recommendations
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.logger.info("Performance monitoring started")

    this.metricsInterval = setInterval(() => {
      this.performPeriodicCheck()
    }, this.config.monitoring.metricsInterval)
  }

  /**
   * Stop performance monitoring
   */
  private stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.isMonitoring = false
    this.logger.info("Performance monitoring stopped")

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
      this.metricsInterval = undefined
    }
  }

  /**
   * Perform periodic monitoring checks
   */
  private performPeriodicCheck(): void {
    try {
      // Check memory usage
      const memoryCheck = memoryManager.checkMemoryUsage()
      if (memoryCheck.status !== "normal") {
        this.createMemoryAlert(memoryCheck)
      }

      // Check for performance degradation
      if (this.config.monitoring.alertOnDegradation) {
        this.checkPerformanceDegradation()
      }

      // Trigger garbage collection if needed
      if (this.config.memory.autoGC && memoryCheck.status === "warning") {
        memoryManager.triggerGarbageCollection()
      }
    } catch (error) {
      this.logger.error("Error in periodic performance check", error as Error)
    }
  }

  /**
   * Check for performance alerts based on metrics
   */
  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    // Check processing time against targets
    const targetTime = this.getTargetTime(metrics.inputSize)
    if (metrics.processingTime > targetTime * 1.5) {
      this.createAlert({
        id: `slow-conversion-${metrics.conversionId}`,
        type: "performance",
        severity: "medium",
        message: `Slow conversion detected: ${metrics.processingTime}ms (target: ${targetTime}ms)`,
        timestamp: new Date(),
        metrics,
        data: {
          actualTime: metrics.processingTime,
          targetTime,
          ratio: metrics.processingTime / targetTime,
        },
        acknowledged: false,
      })
    }

    // Check for conversion failures
    if (!metrics.success) {
      this.createAlert({
        id: `failed-conversion-${metrics.conversionId}`,
        type: "performance",
        severity: "high",
        message: `Conversion failed: ${metrics.error || "Unknown error"}`,
        timestamp: new Date(),
        metrics,
        acknowledged: false,
      })
    }

    // Check memory usage during conversion
    if (metrics.memoryUsage && metrics.memoryUsage.percentage > this.config.memory.criticalThreshold) {
      this.createAlert({
        id: `high-memory-${metrics.conversionId}`,
        type: "memory",
        severity: "high",
        message: `High memory usage during conversion: ${(metrics.memoryUsage.percentage * 100).toFixed(1)}%`,
        timestamp: new Date(),
        metrics,
        data: {
          memoryPercentage: metrics.memoryUsage.percentage,
          memoryUsed: metrics.memoryUsage.used,
        },
        acknowledged: false,
      })
    }
  }

  /**
   * Get target processing time based on input size
   */
  private getTargetTime(inputSize: number): number {
    if (inputSize < 100 * 1024) { // < 100KB
      return this.config.timing.smallHTMLTarget
    } else if (inputSize < 1024 * 1024) { // < 1MB
      return this.config.timing.mediumHTMLTarget
    } else { // >= 1MB
      return this.config.timing.largeHTMLTarget
    }
  }

  /**
   * Create memory usage alert
   */
  private createMemoryAlert(memoryCheck: ReturnType<typeof memoryManager.checkMemoryUsage>): void {
    const severity = memoryCheck.status === "critical" ? "critical" : "medium"
    const alertId = `memory-${Date.now()}`

    this.createAlert({
      id: alertId,
      type: "memory",
      severity,
      message: memoryCheck.message || "Memory usage alert",
      timestamp: new Date(),
      data: {
        status: memoryCheck.status,
        stats: memoryCheck.stats,
      },
      acknowledged: false,
    })
  }

  /**
   * Check for performance degradation
   */
  private checkPerformanceDegradation(): void {
    if (this.metricsHistory.length < 10) {
      return // Need more data for trend analysis
    }

    const recent = this.metricsHistory.slice(-10)
    const older = this.metricsHistory.slice(-20, -10)

    if (older.length === 0) {
      return
    }

    const recentAverage = recent.reduce((sum, m) => sum + m.processingTime, 0) / recent.length
    const olderAverage = older.reduce((sum, m) => sum + m.processingTime, 0) / older.length

    const degradation = ((recentAverage - olderAverage) / olderAverage) * 100

    if (degradation > this.config.monitoring.degradationThreshold) {
      this.createAlert({
        id: `performance-degradation-${Date.now()}`,
        type: "performance",
        severity: "medium",
        message: `Performance degradation detected: ${degradation.toFixed(1)}% slower than baseline`,
        timestamp: new Date(),
        data: {
          degradation,
          recentAverage,
          olderAverage,
          threshold: this.config.monitoring.degradationThreshold,
        },
        acknowledged: false,
      })
    }
  }

  /**
   * Calculate performance trend
   */
  private calculatePerformanceTrend(): "improving" | "degrading" | "stable" {
    if (this.metricsHistory.length < 6) {
      return "stable"
    }

    const recent = this.metricsHistory.slice(-3)
    const older = this.metricsHistory.slice(-6, -3)

    const recentAverage = recent.reduce((sum, m) => sum + m.processingTime, 0) / recent.length
    const olderAverage = older.reduce((sum, m) => sum + m.processingTime, 0) / older.length

    const change = ((recentAverage - olderAverage) / olderAverage) * 100

    if (change > 10) {
      return "degrading"
    } else if (change < -10) {
      return "improving"
    } else {
      return "stable"
    }
  }

  /**
   * Create and store an alert
   */
  private createAlert(alert: PerformanceAlert): void {
    // Check for similar existing alerts
    const existingAlert = this.alerts.find(a =>
      a.type === alert.type
      && a.message === alert.message
      && !a.acknowledged
      && (Date.now() - a.timestamp.getTime()) < 60000, // Within last minute
    )

    if (existingAlert) {
      return // Skip duplicate alert
    }

    this.alerts.push(alert)

    // Maintain alert history size
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    this.logger.warn("Performance alert created", {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
    })
  }

  /**
   * Cleanup old metrics and alerts
   */
  cleanup(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000) // 24 hours ago

    // Clean old metrics
    this.metricsHistory = this.metricsHistory.filter(m =>
      m.timestamp.getTime() > cutoffTime,
    )

    // Clean old acknowledged alerts
    this.alerts = this.alerts.filter(a =>
      !a.acknowledged || a.timestamp.getTime() > cutoffTime,
    )

    this.logger.debug("Performance monitor cleanup completed")
  }

  /**
   * Shutdown the performance monitor
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down performance monitor")

    this.stopMonitoring()
    this.cleanup()

    this.logger.info("Performance monitor shutdown completed")
  }
}

/**
 * Utility function to create a performance monitor with sensible defaults
 */
export function createPerformanceMonitor(
  logger: Logger,
  config: PerformanceConfig = {},
): PerformanceMonitor {
  return new PerformanceMonitor(logger, config)
}
