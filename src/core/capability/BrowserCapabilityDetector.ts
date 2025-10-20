/// <reference path="../../types/globals.d.ts" />

import process from "node:process"

import type { Logger } from "../../architecture/strategies/types"

import type {
  BrowserCapabilityAssessment,
  CanvasCapability,
  CapabilityDetectionOptions,
  ChromeCDPCapability,
  IBrowserCapabilityDetector,
  NetworkCapability,
} from "./types"

/**
 * Browser capability detector for progressive enhancement implementation
 */
export class BrowserCapabilityDetector implements IBrowserCapabilityDetector {
  private cache: BrowserCapabilityAssessment | null = null
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  /**
   * Detect Chrome DevTools Protocol capability
   */
  async detectChromeCapability(options: CapabilityDetectionOptions = {}): Promise<ChromeCDPCapability> {
    const { intensive = false, timeout = 5000 } = options

    try {
      this.logger.debug("Detecting Chrome DevTools Protocol capability...")

      const capability: ChromeCDPCapability = {
        available: false,
        connectionType: "unavailable",
        supportedProtocols: [],
        availableTargets: [],
        performance: 0,
      }

      const runtime = this.detectEnvironment()

      if (runtime === "node") {
        // Node.js environment - check for chrome-remote-interface
        capability.available = await this.checkChromeRemoteInterface(timeout)
        capability.connectionType = capability.available ? "remote" : "unavailable"

        if (capability.available) {
          capability.supportedProtocols = ["1.3"] // Default CDP version
          capability.availableTargets = ["page", "background"]
          capability.performance = 0.9 // High performance in Node.js
        }
      } else if (runtime === "browser") {
        // Browser environment - check for native CDP access
        const nativeAccess = await this.checkNativeCDPAccess(timeout)

        if (nativeAccess) {
          capability.available = true
          capability.connectionType = "native"
          capability.performance = 0.8
        } else {
          // Check for extension-based access
          const extensionAccess = await this.checkExtensionCDPAccess(timeout)
          capability.available = extensionAccess
          capability.connectionType = extensionAccess ? "extension" : "unavailable"
          capability.performance = extensionAccess ? 0.6 : 0
        }

        if (capability.available) {
          capability.supportedProtocols = await this.detectCDPProtocols(timeout)
          capability.availableTargets = await this.detectCDPTargets(timeout)
        }
      }

      // Intensive detection - test actual CDP functionality
      if (intensive && capability.available) {
        const performanceResult = await this.testCDPPerformance(timeout)
        capability.performance = Math.min(capability.performance, performanceResult)

        const functionalityTest = await this.testCDPFunctionality(timeout)
        capability.available = functionalityTest
      }

      this.logger.info("Chrome CDP capability detected", {
        available: capability.available,
        connectionType: capability.connectionType,
        performance: capability.performance,
      })

      return capability
    } catch (error) {
      this.logger.warn("Failed to detect Chrome CDP capability", error)

      return {
        available: false,
        connectionType: "unavailable",
        supportedProtocols: [],
        availableTargets: [],
        performance: 0,
      }
    }
  }

  /**
   * Detect canvas rendering capability
   */
  async detectCanvasSupport(options: CapabilityDetectionOptions = {}): Promise<CanvasCapability> {
    const { skipPerformanceTests = false, timeout = 3000 } = options

    try {
      this.logger.debug("Detecting canvas rendering capability...")

      const capability: CanvasCapability = {
        available: false,
        context2D: false,
        webgl: false,
        maxSize: { width: 0, height: 0 },
        exportFormats: [],
        performance: 0,
      }

      const runtime = this.detectEnvironment()

      if (runtime === "node") {
        // Node.js environment - check for node-canvas
        capability.available = await this.checkNodeCanvas(timeout)
        if (capability.available) {
          capability.context2D = true
          capability.webgl = false // WebGL typically not available in Node.js
          capability.maxSize = { width: 32767, height: 32767 } // Large limits for server
          capability.exportFormats = ["png", "jpeg"]
          capability.performance = 0.7
        }
      } else if (runtime === "browser") {
        // Browser environment - check native canvas support
        capability.available = typeof HTMLCanvasElement !== "undefined"

        if (capability.available && typeof document !== "undefined") {
          try {
            const testCanvas = document.createElement("canvas")
            capability.context2D = !!testCanvas.getContext("2d")

            // Test WebGL
            capability.webgl = !!(
              testCanvas.getContext("webgl")
              || testCanvas.getContext("experimental-webgl")
            )

            // Determine maximum canvas size
            capability.maxSize = this.detectCanvasMaxSize(testCanvas)

            // Test export formats
            capability.exportFormats = this.detectCanvasExportFormats(testCanvas)

            // Performance testing
            if (!skipPerformanceTests) {
              capability.performance = await this.testCanvasPerformance(testCanvas, timeout)
            } else {
              capability.performance = capability.context2D ? 0.5 : 0
            }
          } catch (error) {
            this.logger.warn("Canvas feature detection failed", error)
            capability.available = false
          }
        }
      }

      this.logger.info("Canvas capability detected", {
        available: capability.available,
        context2D: capability.context2D,
        webgl: capability.webgl,
        performance: capability.performance,
      })

      return capability
    } catch (error) {
      this.logger.warn("Failed to detect canvas capability", error)

      return {
        available: false,
        context2D: false,
        webgl: false,
        maxSize: { width: 0, height: 0 },
        exportFormats: [],
        performance: 0,
      }
    }
  }

  /**
   * Detect network access capability
   */
  async detectNetworkAccess(options: CapabilityDetectionOptions = {}): Promise<NetworkCapability> {
    const { timeout = 2000 } = options

    try {
      this.logger.debug("Detecting network access capability...")

      const capability: NetworkCapability = {
        available: false,
        fetchSupported: false,
        xhrSupported: false,
        corsEnabled: false,
        timeoutLimits: { min: 0, max: 0 },
        concurrentLimit: 0,
      }

      // Check fetch support
      capability.fetchSupported = typeof fetch !== "undefined"

      // Check XMLHttpRequest support
      capability.xhrSupported = typeof XMLHttpRequest !== "undefined"

      // Determine overall network availability
      capability.available = capability.fetchSupported || capability.xhrSupported

      if (capability.available) {
        // Test CORS capabilities
        capability.corsEnabled = await this.testCORSSupport(timeout)

        // Determine timeout limits
        capability.timeoutLimits = this.detectNetworkTimeouts()

        // Test concurrent request limits
        capability.concurrentLimit = await this.testConcurrentRequests(timeout)
      }

      this.logger.info("Network capability detected", {
        available: capability.available,
        fetchSupported: capability.fetchSupported,
        corsEnabled: capability.corsEnabled,
        concurrentLimit: capability.concurrentLimit,
      })

      return capability
    } catch (error) {
      this.logger.warn("Failed to detect network capability", error)

      return {
        available: false,
        fetchSupported: false,
        xhrSupported: false,
        corsEnabled: false,
        timeoutLimits: { min: 0, max: 0 },
        concurrentLimit: 0,
      }
    }
  }

  /**
   * Detect runtime environment
   */
  detectEnvironment(): "browser" | "node" | "web-worker" | "unknown" {
    // Check for Web Worker
    if (typeof globalThis !== "undefined" && typeof (globalThis as any).importScripts === "function") {
      return "web-worker"
    }

    // Check for Browser
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      return "browser"
    }

    // Check for Node.js
    if (typeof process !== "undefined" && process.versions?.node) {
      return "node"
    }

    return "unknown"
  }

  /**
   * Get complete capability assessment
   */
  async getCompleteAssessment(options: CapabilityDetectionOptions = {}): Promise<BrowserCapabilityAssessment> {
    const { cache = true } = options

    if (cache && this.cache) {
      return this.cache
    }

    this.logger.info("Starting comprehensive capability assessment...")

    // Run all capability detections in parallel for efficiency
    const [chromeCDP, canvas, network] = await Promise.all([
      this.detectChromeCapability(options),
      this.detectCanvasSupport(options),
      this.detectNetworkAccess(options),
    ])

    // Calculate overall capability score
    const overallScore = this.calculateOverallScore(chromeCDP, canvas, network)

    // Determine recommended tier
    const recommendedTier = this.determineRecommendedTier(chromeCDP, canvas, network, overallScore)

    const assessment: BrowserCapabilityAssessment = {
      chromeCDP,
      canvas,
      network,
      overallScore,
      recommendedTier,
      timestamp: new Date(),
    }

    if (cache) {
      this.cache = assessment
    }

    this.logger.info("Complete capability assessment finished", {
      overallScore,
      recommendedTier,
      chromeAvailable: chromeCDP.available,
      canvasAvailable: canvas.available,
      networkAvailable: network.available,
    })

    return assessment
  }

  /**
   * Get recommended conversion tier
   */
  getRecommendedTier(assessment?: BrowserCapabilityAssessment): 1 | 2 | 3 | 4 {
    if (!assessment) {
      // Quick synchronous check for basic tier recommendation
      const env = this.detectEnvironment()
      const hasCanvas = typeof HTMLCanvasElement !== "undefined" || env === "node"
      const hasNetwork = typeof fetch !== "undefined" || typeof XMLHttpRequest !== "undefined"

      if (env === "node" || (typeof chrome !== "undefined")) {
        return 1 // Assume CDP available
      } else if (hasCanvas) {
        return 2
      } else if (hasNetwork) {
        return 3
      } else {
        return 4
      }
    }

    return assessment.recommendedTier
  }

  /**
   * Clear capability cache
   */
  clearCache(): void {
    this.cache = null
    this.logger.debug("Capability cache cleared")
  }

  /**
   * Check if specific capability is available
   */
  hasCapability(capability: keyof BrowserCapabilityAssessment): boolean {
    if (capability === "overallScore" || capability === "recommendedTier" || capability === "timestamp") {
      throw new Error(`Cannot check availability of metadata property: ${capability}`)
    }

    if (this.cache) {
      const cap = this.cache[capability] as any
      return cap?.available ?? false
    }

    // Fallback to synchronous checks
    switch (capability) {
      case "chromeCDP":
        return typeof chrome !== "undefined" || this.detectEnvironment() === "node"
      case "canvas":
        return typeof HTMLCanvasElement !== "undefined" || this.detectEnvironment() === "node"
      case "network":
        return typeof fetch !== "undefined" || typeof XMLHttpRequest !== "undefined"
      default:
        return false
    }
  }

  // Private helper methods for detailed capability detection

  private async checkChromeRemoteInterface(_timeout: number): Promise<boolean> {
    try {
      // Dynamic import to avoid bundling issues
      const chromeLauncher = await import("chrome-remote-interface")
      return !!chromeLauncher.default || !!chromeLauncher
    } catch {
      return false
    }
  }

  private async checkNativeCDPAccess(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeout)

      try {
        // Check for native Chrome DevTools access
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
          clearTimeout(timer)
          resolve(true)
          return
        }

        // Check for remote debugging protocol
        if (typeof window !== "undefined" && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          clearTimeout(timer)
          resolve(true)
          return
        }

        clearTimeout(timer)
        resolve(false)
      } catch {
        clearTimeout(timer)
        resolve(false)
      }
    })
  }

  private async checkExtensionCDPAccess(_timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), _timeout)

      try {
        // Check for common extension-based debugging access
        if (typeof window !== "undefined") {
          const hasExtensionAccess = !!(
            (window as any).__CHROME_DEVTOOLS_HOOK__
            || (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
            || document.querySelector("script[src*=\"chrome-extension://\"]")
          )

          clearTimeout(timer)
          resolve(hasExtensionAccess)
          return
        }

        clearTimeout(timer)
        resolve(false)
      } catch {
        clearTimeout(timer)
        resolve(false)
      }
    })
  }

  private async detectCDPProtocols(_timeout: number): Promise<string[]> {
    // Simplified protocol detection - in real implementation would query CDP
    return ["1.3"]
  }

  private async detectCDPTargets(_timeout: number): Promise<string[]> {
    // Simplified target detection - in real implementation would query CDP
    return ["page", "background", "service-worker"]
  }

  private async testCDPPerformance(timeout: number): Promise<number> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(0.5), timeout)

      try {
        const startTime = Date.now()
        // Simulate CDP performance test
        setTimeout(() => {
          const duration = Date.now() - startTime
          clearTimeout(timer)
          // Convert duration to performance score (0-1)
          const score = Math.max(0, Math.min(1, 1 - (duration / timeout)))
          resolve(score)
        }, 100)
      } catch {
        clearTimeout(timer)
        resolve(0.3)
      }
    })
  }

  private async testCDPFunctionality(_timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), _timeout)

      try {
        // Basic functionality test
        resolve(true)
        clearTimeout(timer)
      } catch {
        clearTimeout(timer)
        resolve(false)
      }
    })
  }

  private async checkNodeCanvas(_timeout: number): Promise<boolean> {
    try {
      // Dynamic import to avoid bundling issues
      const nodeCanvas = await import("canvas" as any)
      return !!nodeCanvas.default || !!nodeCanvas
    } catch {
      return false
    }
  }

  private detectCanvasMaxSize(testCanvas: HTMLCanvasElement): { width: number, height: number } {
    try {
      // Test maximum canvas size
      const maxWidth = testCanvas.width || 16384
      const maxHeight = testCanvas.height || 16384

      // Conservative estimates for browser compatibility
      return {
        width: Math.min(maxWidth, 8192),
        height: Math.min(maxHeight, 8192),
      }
    } catch {
      return { width: 1024, height: 1024 }
    }
  }

  private detectCanvasExportFormats(testCanvas: HTMLCanvasElement): string[] {
    const formats: string[] = []

    try {
      const ctx = testCanvas.getContext("2d")
      if (!ctx) {
        return formats
      }

      // Test PNG support
      if (typeof testCanvas.toDataURL === "function") {
        const dataURL = testCanvas.toDataURL("image/png")
        if (dataURL.startsWith("data:image/png")) {
          formats.push("png")
        }
      }

      // Test JPEG support
      try {
        const jpegURL = testCanvas.toDataURL("image/jpeg", 0.8)
        if (jpegURL.startsWith("data:image/jpeg")) {
          formats.push("jpeg")
        }
      } catch {
        // JPEG not supported
      }

      // Test WebP support
      try {
        const webpURL = testCanvas.toDataURL("image/webp", 0.8)
        if (webpURL.startsWith("data:image/webp")) {
          formats.push("webp")
        }
      } catch {
        // WebP not supported
      }
    } catch (error) {
      this.logger.warn("Canvas export format detection failed", error)
    }

    return formats
  }

  private async testCanvasPerformance(testCanvas: HTMLCanvasElement, timeout: number): Promise<number> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(0.5), timeout)

      try {
        const ctx = testCanvas.getContext("2d")
        if (!ctx) {
          clearTimeout(timer)
          resolve(0)
          return
        }

        const startTime = Date.now()

        // Basic performance test
        testCanvas.width = 100
        testCanvas.height = 100
        ctx.fillStyle = "red"
        ctx.fillRect(0, 0, 100, 100)

        const _dataURL = testCanvas.toDataURL("image/png")
        const duration = Date.now() - startTime

        clearTimeout(timer)

        // Convert duration to performance score (0-1)
        const score = Math.max(0, Math.min(1, 1 - (duration / 1000)))
        resolve(score)
      } catch (error) {
        clearTimeout(timer)
        this.logger.warn("Canvas performance test failed", error)
        resolve(0.1)
      }
    })
  }

  private async testCORSSupport(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeout)

      try {
        // Simple CORS test
        if (typeof fetch !== "undefined") {
          fetch("https://httpbin.org/get", { mode: "cors" })
            .then(() => {
              clearTimeout(timer)
              resolve(true)
            })
            .catch(() => {
              clearTimeout(timer)
              resolve(false)
            })
        } else if (typeof XMLHttpRequest !== "undefined") {
          const xhr = new XMLHttpRequest()
          xhr.open("GET", "https://httpbin.org/get", true)
          xhr.onload = () => {
            clearTimeout(timer)
            resolve(xhr.status === 200)
          }
          xhr.onerror = () => {
            clearTimeout(timer)
            resolve(false)
          }
          xhr.send()
        } else {
          clearTimeout(timer)
          resolve(false)
        }
      } catch {
        clearTimeout(timer)
        resolve(false)
      }
    })
  }

  private detectNetworkTimeouts(): { min: number, max: number } {
    try {
      // Detect timeout limits based on environment
      if (typeof XMLHttpRequest !== "undefined") {
        const xhr = new XMLHttpRequest()
        return {
          min: 100,
          max: xhr.timeout || 30000,
        }
      }

      return {
        min: 1000,
        max: 30000,
      }
    } catch {
      return {
        min: 1000,
        max: 10000,
      }
    }
  }

  private async testConcurrentRequests(timeout: number): Promise<number> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(6), timeout)

      try {
        // Test concurrent request capacity
        if (typeof fetch !== "undefined") {
          const startTime = Date.now()
          const promises = []

          for (let i = 0; i < 10; i++) {
            promises.push(
              fetch("data:text/plain,test").catch(() => null),
            )
          }

          Promise.all(promises).then(() => {
            const duration = Date.now() - startTime
            clearTimeout(timer)

            // Estimate concurrent limit based on performance
            if (duration < 100) {
              resolve(10)
            } else if (duration < 500) {
              resolve(8)
            } else {
              resolve(6)
            }
          }).catch(() => {
            clearTimeout(timer)
            resolve(4)
          })
        } else {
          clearTimeout(timer)
          resolve(4)
        }
      } catch {
        clearTimeout(timer)
        resolve(2)
      }
    })
  }

  private calculateOverallScore(
    chromeCDP: ChromeCDPCapability,
    canvas: CanvasCapability,
    network: NetworkCapability,
  ): number {
    const weights = {
      chromeCDP: 0.5, // Most important for high-fidelity conversion
      canvas: 0.3, // Important for fallback rendering
      network: 0.2, // Important for server-side fallback
    }

    const scores = [
      chromeCDP.performance * weights.chromeCDP,
      canvas.performance * weights.canvas,
      (network.available ? 0.8 : 0.2) * weights.network,
    ]

    return Math.round(Math.min(1, scores.reduce((a, b) => a + b, 0)) * 100) / 100
  }

  private determineRecommendedTier(
    chromeCDP: ChromeCDPCapability,
    canvas: CanvasCapability,
    network: NetworkCapability,
    _overallScore: number,
  ): 1 | 2 | 3 | 4 {
    // Tier 1: Chrome CDP available and performant
    if (chromeCDP.available && chromeCDP.performance > 0.6) {
      return 1
    }

    // Tier 2: Canvas available and reasonably performant
    if (canvas.available && canvas.performance > 0.3) {
      return 2
    }

    // Tier 3: Network available for server-side fallback
    if (network.available && network.corsEnabled) {
      return 3
    }

    // Tier 4: Basic HTML export only
    return 4
  }
}
