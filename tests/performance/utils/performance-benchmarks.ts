/**
 * Performance benchmarking utilities for HTML converter testing
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { performance } from "node:perf_hooks"
import process from "node:process"

export interface PerformanceMetrics {
  /** Operation duration in milliseconds */
  duration: number
  /** Memory usage in bytes */
  memoryUsage: NodeJS.MemoryUsage
  /** CPU usage percentage */
  cpuUsage: NodeJS.CpuUsage
  /** Timestamp when measurement started */
  timestamp: number
  /** Additional custom metrics */
  customMetrics?: Record<string, number>
}

export interface BenchmarkResult {
  /** Test name/identifier */
  testName: string
  /** Individual measurements */
  measurements: PerformanceMetrics[]
  /** Statistical summary */
  stats: {
    /** Mean duration */
    meanDuration: number
    /** Median duration */
    medianDuration: number
    /** Standard deviation */
    stdDeviation: number
    /** Minimum duration */
    minDuration: number
    /** Maximum duration */
    maxDuration: number
    /** 95th percentile */
    p95: number
    /** 99th percentile */
    p99: number
  }
  /** Memory statistics */
  memoryStats: {
    /** Mean heap used */
    meanHeapUsed: number
    /** Peak heap used */
    peakHeapUsed: number
    /** Mean heap total */
    meanHeapTotal: number
    /** Mean external memory */
    meanExternal: number
  }
  /** Whether the benchmark passed performance thresholds */
  passed: boolean
  /** Performance regression information */
  regression?: {
    /** Percentage change from baseline */
    percentageChange: number
    /** Whether this is considered a regression */
    isRegression: boolean
    /** Threshold for regression detection */
    threshold: number
  }
}

export interface BenchmarkOptions {
  /** Number of iterations to run */
  iterations?: number
  /** Warmup iterations */
  warmupIterations?: number
  /** Maximum allowed duration (ms) */
  maxDuration?: number
  /** Maximum allowed memory usage (bytes) */
  maxMemory?: number
  /** Regression detection threshold (percentage) */
  regressionThreshold?: number
  /** Whether to save detailed results */
  saveResults?: boolean
  /** Custom metrics to collect */
  customMetrics?: string[]
}

/**
 * Performance benchmarking utility class
 */
export class PerformanceBenchmark {
  private static readonly DEFAULT_OPTIONS: Required<BenchmarkOptions> = {
    iterations: 10,
    warmupIterations: 3,
    maxDuration: 10000, // 10 seconds
    maxMemory: 100 * 1024 * 1024, // 100MB
    regressionThreshold: 10, // 10%
    saveResults: true,
    customMetrics: [],
  }

  /**
   * Run a performance benchmark for a function
   */
  static async benchmark<T>(
    testName: string,
    fn: () => Promise<T> | T,
    options: BenchmarkOptions = {},
  ): Promise<BenchmarkResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }
    const measurements: PerformanceMetrics[] = []

    // Warmup iterations
    for (let i = 0; i < opts.warmupIterations; i++) {
      await fn()
    }

    // Actual benchmark iterations
    for (let i = 0; i < opts.iterations; i++) {
      const measurement = await this.measureFunction(fn, opts.customMetrics)
      measurements.push(measurement)

      // Early termination if threshold exceeded
      if (measurement.duration > opts.maxDuration) {
        console.warn(`Iteration ${i + 1} exceeded max duration: ${measurement.duration}ms`)
      }

      if (measurement.memoryUsage.heapUsed > opts.maxMemory) {
        console.warn(`Iteration ${i + 1} exceeded max memory: ${measurement.memoryUsage.heapUsed} bytes`)
      }
    }

    const result = this.calculateStats(testName, measurements)

    // Check for regression against baseline
    const baseline = this.loadBaseline(testName)
    if (baseline) {
      result.regression = this.detectRegression(result, baseline, opts.regressionThreshold)
    }

    // Save results as new baseline
    if (opts.saveResults) {
      this.saveBaseline(testName, result)
    }

    // Check performance thresholds
    result.passed = this.checkThresholds(result, opts)

    return result
  }

  /**
   * Measure a single function execution
   */
  private static async measureFunction<T>(
    fn: () => Promise<T> | T,
    _customMetrics: string[],
  ): Promise<PerformanceMetrics> {
    // Garbage collection if available
    if (globalThis.gc) {
      globalThis.gc()
    }

    const startTime = performance.now()
    const startCpu = process.cpuUsage()

    const customValues: Record<string, number> = {}

    // Execute the function
    await fn()

    const endTime = performance.now()
    const endMemory = process.memoryUsage()
    const endCpu = process.cpuUsage(startCpu)

    return {
      duration: endTime - startTime,
      memoryUsage: endMemory,
      cpuUsage: endCpu,
      timestamp: Date.now(),
      customMetrics: customValues,
    }
  }

  /**
   * Calculate statistics from measurements
   */
  private static calculateStats(
    testName: string,
    measurements: PerformanceMetrics[],
  ): BenchmarkResult {
    const durations = measurements.map(m => m.duration)
    const heapUsages = measurements.map(m => m.memoryUsage.heapUsed)
    const heapTotals = measurements.map(m => m.memoryUsage.heapTotal)
    const externals = measurements.map(m => m.memoryUsage.external)

    // Sort for percentile calculations
    const sortedDurations = [...durations].sort((a, b) => a - b)

    const stats = {
      meanDuration: this.mean(durations),
      medianDuration: this.median(sortedDurations),
      stdDeviation: this.standardDeviation(durations),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p95: this.percentile(sortedDurations, 95),
      p99: this.percentile(sortedDurations, 99),
    }

    const memoryStats = {
      meanHeapUsed: this.mean(heapUsages),
      peakHeapUsed: Math.max(...heapUsages),
      meanHeapTotal: this.mean(heapTotals),
      meanExternal: this.mean(externals),
    }

    return {
      testName,
      measurements,
      stats,
      memoryStats,
      passed: true, // Will be updated later
    }
  }

  /**
   * Check if benchmark results meet performance thresholds
   */
  private static checkThresholds(
    result: BenchmarkResult,
    options: Required<BenchmarkOptions>,
  ): boolean {
    if (result.stats.meanDuration > options.maxDuration) {
      return false
    }

    if (result.memoryStats.peakHeapUsed > options.maxMemory) {
      return false
    }

    return true
  }

  /**
   * Detect performance regression against baseline
   */
  private static detectRegression(
    current: BenchmarkResult,
    baseline: BenchmarkResult,
    threshold: number,
  ): BenchmarkResult["regression"] {
    const percentageChange = ((current.stats.meanDuration - baseline.stats.meanDuration) / baseline.stats.meanDuration) * 100

    return {
      percentageChange,
      isRegression: percentageChange > threshold,
      threshold,
    }
  }

  /**
   * Save benchmark results as baseline
   */
  private static saveBaseline(testName: string, result: BenchmarkResult): void {
    const baselinePath = this.getBaselinePath(testName)
    this.ensureDir(baselinePath)

    const baselineData = {
      testName: result.testName,
      stats: result.stats,
      memoryStats: result.memoryStats,
      timestamp: Date.now(),
      version: this.getProjectVersion(),
    }

    writeFileSync(baselinePath, JSON.stringify(baselineData, null, 2))
  }

  /**
   * Load baseline for comparison
   */
  private static loadBaseline(testName: string): BenchmarkResult | null {
    const baselinePath = this.getBaselinePath(testName)

    if (!existsSync(baselinePath)) {
      return null
    }

    try {
      const data = readFileSync(baselinePath, "utf-8")
      const baselineData = JSON.parse(data)

      // Convert baseline data to BenchmarkResult format
      return {
        testName: baselineData.testName,
        measurements: [], // Not stored in baseline
        stats: baselineData.stats,
        memoryStats: baselineData.memoryStats,
        passed: true,
      }
    } catch {
      return null
    }
  }

  /**
   * Get path for baseline file
   */
  private static getBaselinePath(testName: string): string {
    return join(
      process.cwd(),
      "tests",
      "performance",
      "benchmarks",
      `${testName}.json`,
    )
  }

  /**
   * Ensure directory exists for file path
   */
  private static ensureDir(filePath: string): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  /**
   * Get project version for baseline tracking
   */
  private static getProjectVersion(): string {
    try {
      const packageJsonPath = join(process.cwd(), "package.json")
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
      return packageJson.version || "unknown"
    } catch {
      return "unknown"
    }
  }

  // Statistical utility functions
  private static mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private static median(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2)
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid]
  }

  private static standardDeviation(values: number[]): number {
    const mean = this.mean(values)
    const squaredDiffs = values.map(val => (val - mean) ** 2)
    const variance = this.mean(squaredDiffs)
    return Math.sqrt(variance)
  }

  private static percentile(sortedValues: number[], p: number): number {
    const index = (p / 100) * (sortedValues.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index % 1

    if (lower === upper) {
      return sortedValues[lower]
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
  }
}

/**
 * Performance monitoring for concurrent operations
 */
export class ConcurrencyBenchmark {
  /**
   * Benchmark concurrent operations
   */
  static async benchmarkConcurrency<T>(
    testName: string,
    fn: () => Promise<T> | T,
    concurrencyLevels: number[],
    options: BenchmarkOptions = {},
  ): Promise<{ concurrency: number, result: BenchmarkResult }[]> {
    const results: { concurrency: number, result: BenchmarkResult }[] = []

    for (const concurrency of concurrencyLevels) {
      const concurrentTestName = `${testName}_concurrency_${concurrency}`

      const concurrentFn = async () => {
        const promises = Array.from({ length: concurrency }, () => fn())
        return Promise.all(promises)
      }

      const result = await PerformanceBenchmark.benchmark(
        concurrentTestName,
        concurrentFn,
        { ...options, iterations: Math.max(1, Math.floor(options.iterations! / concurrency)) },
      )

      results.push({ concurrency, result })
    }

    return results
  }

  /**
   * Analyze scalability of concurrent operations
   */
  static analyzeScalability(
    results: { concurrency: number, result: BenchmarkResult }[],
  ): {
    isScalable: boolean
    throughput: number[]
    efficiency: number[]
    bottlenecks: string[]
  } {
    const throughput = results.map(r =>
      r.concurrency / (r.result.stats.meanDuration / 1000), // operations per second
    )

    const efficiency = results.map((r, i) => {
      if (i === 0) {
        return 1.0
      }
      const idealThroughput = throughput[0] * r.concurrency
      return throughput[i] / idealThroughput
    })

    const bottlenecks: string[] = []

    // Detect performance degradation
    for (let i = 1; i < efficiency.length; i++) {
      if (efficiency[i] < 0.7) {
        bottlenecks.push(`Concurrency level ${results[i].concurrency} shows poor efficiency (${(efficiency[i] * 100).toFixed(1)}%)`)
      }
    }

    const isScalable = efficiency.every(e => e > 0.8) && bottlenecks.length === 0

    return {
      isScalable,
      throughput,
      efficiency,
      bottlenecks,
    }
  }
}

/**
 * Performance assertion helpers
 */
export class PerformanceAssertions {
  /**
   * Assert that performance meets duration threshold
   */
  static assertMaxDuration(result: BenchmarkResult, maxMs: number): void {
    if (result.stats.meanDuration > maxMs) {
      throw new Error(
        `Performance assertion failed: mean duration ${result.stats.meanDuration.toFixed(2)}ms `
        + `exceeds threshold ${maxMs}ms`,
      )
    }
  }

  /**
   * Assert that memory usage is within limits
   */
  static assertMaxMemory(result: BenchmarkResult, maxBytes: number): void {
    if (result.memoryStats.peakHeapUsed > maxBytes) {
      throw new Error(
        `Memory assertion failed: peak heap usage ${result.memoryStats.peakHeapUsed} bytes `
        + `exceeds threshold ${maxBytes} bytes`,
      )
    }
  }

  /**
   * Assert no significant regression from baseline
   */
  static assertNoRegression(result: BenchmarkResult): void {
    if (result.regression && result.regression.isRegression) {
      throw new Error(
        `Performance regression detected: ${result.regression.percentageChange.toFixed(2)}% `
        + `increase from baseline (threshold: ${result.regression.threshold}%)`,
      )
    }
  }

  /**
   * Assert acceptable performance variance
   */
  static assertLowVariance(result: BenchmarkResult, maxStdDevPercent: number = 20): void {
    const variancePercent = (result.stats.stdDeviation / result.stats.meanDuration) * 100
    if (variancePercent > maxStdDevPercent) {
      throw new Error(
        `Variance assertion failed: ${variancePercent.toFixed(2)}% standard deviation `
        + `exceeds threshold ${maxStdDevPercent}%`,
      )
    }
  }
}
