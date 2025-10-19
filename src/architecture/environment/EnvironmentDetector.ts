import process from "node:process"

import type { Logger } from "../strategies/types"

import type {
  BrowserFeatures,
  BrowserInfo,
  EnvironmentInfo,
  FeatureDetectionOptions,
  IEnvironmentDetector,
  NodeInfo,
  SSRContext,
} from "./types"
import { RuntimeEnvironment } from "./types"

/**
 * Environment detection utility with comprehensive runtime and feature detection
 */
export class EnvironmentDetector implements IEnvironmentDetector {
  private cache: EnvironmentInfo | null = null
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  /**
   * Detect current runtime environment
   */
  detectRuntime(): RuntimeEnvironment {
    try {
      // Check for Web Worker
      if (typeof globalThis !== "undefined" && typeof importScripts === "function") {
        return RuntimeEnvironment.WEB_WORKER
      }

      // Check for Service Worker
      if (typeof globalThis !== "undefined" && typeof globalThis.addEventListener === "function"
        && typeof globalThis.skipWaiting === "function") {
        return RuntimeEnvironment.SERVICE_WORKER
      }

      // Check for Browser
      if (typeof window !== "undefined" && typeof document !== "undefined") {
        return RuntimeEnvironment.BROWSER
      }

      // Check for Node.js
      if (typeof process !== "undefined" && process.versions?.node) {
        return RuntimeEnvironment.NODE
      }

      return RuntimeEnvironment.UNKNOWN
    } catch (error) {
      this.logger.warn("Failed to detect runtime environment", error)
      return RuntimeEnvironment.UNKNOWN
    }
  }

  /**
   * Get browser information
   */
  getBrowserInfo(): BrowserInfo | undefined {
    const runtime = this.detectRuntime()
    if (runtime !== RuntimeEnvironment.BROWSER && runtime !== RuntimeEnvironment.WEB_WORKER) {
      return undefined
    }

    try {
      const userAgent = navigator.userAgent
      const language = navigator.language || "unknown"
      const platform = navigator.platform || "unknown"

      // Parse browser name and version from user agent
      const { name, version } = this.parseBrowserNameAndVersion(userAgent)
      const os = this.parseOperatingSystem(userAgent, platform)

      return {
        name,
        version,
        userAgent,
        os,
        isHeadless: this.detectHeadlessBrowser(userAgent),
        language,
        platform,
      }
    } catch (error) {
      this.logger.warn("Failed to get browser information", error)
      return undefined
    }
  }

  /**
   * Get Node.js information
   */
  getNodeInfo(): NodeInfo | undefined {
    const runtime = this.detectRuntime()
    if (runtime !== RuntimeEnvironment.NODE) {
      return undefined
    }

    try {
      const version = process.version
      const platform = process.platform
      const arch = process.arch
      const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV
      const isTest = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "testing"

      // Get available core modules
      const availableModules = this.getAvailableNodeModules()

      return {
        version,
        platform,
        arch,
        isDevelopment,
        isTest,
        availableModules,
      }
    } catch (error) {
      this.logger.warn("Failed to get Node.js information", error)
      return undefined
    }
  }

  /**
   * Detect available features
   */
  detectFeatures(options: FeatureDetectionOptions = { intensive: false, timeout: 5000, cache: true }): BrowserFeatures {
    const defaultFeatures: BrowserFeatures = {
      canvas: false,
      webWorkers: false,
      serviceWorkers: false,
      cdp: false,
      localStorage: false,
      sessionStorage: false,
      fetch: false,
      webSocket: false,
      webRTC: false,
      webgl: false,
      geolocation: false,
      notifications: false,
    }

    try {
      const runtime = this.detectRuntime()

      // Canvas support
      if (runtime === RuntimeEnvironment.BROWSER || runtime === RuntimeEnvironment.WEB_WORKER) {
        defaultFeatures.canvas = this.detectCanvasSupport()
        defaultFeatures.webgl = this.detectWebGLSupport()
        defaultFeatures.geolocation = this.detectGeolocationSupport()
        defaultFeatures.notifications = this.detectNotificationSupport()
      }

      // Web Workers support
      if (runtime === RuntimeEnvironment.BROWSER) {
        defaultFeatures.webWorkers = this.detectWebWorkerSupport()
        defaultFeatures.serviceWorkers = this.detectServiceWorkerSupport()
      }

      // CDP availability (browser only)
      if (runtime === RuntimeEnvironment.BROWSER) {
        defaultFeatures.cdp = this.detectCDPSupport(options)
      }

      // Storage support
      if (runtime === RuntimeEnvironment.BROWSER) {
        defaultFeatures.localStorage = this.detectLocalStorageSupport()
        defaultFeatures.sessionStorage = this.detectSessionStorageSupport()
      }

      // Network features
      defaultFeatures.fetch = this.detectFetchSupport()
      defaultFeatures.webSocket = this.detectWebSocketSupport()
      defaultFeatures.webRTC = this.detectWebRTCSupport()

      return defaultFeatures
    } catch (error) {
      this.logger.warn("Failed to detect features", error)
      return defaultFeatures
    }
  }

  /**
   * Get SSR context information
   */
  getSSRContext(): SSRContext {
    const runtime = this.detectRuntime()

    if (runtime === RuntimeEnvironment.BROWSER) {
      return {
        isSSR: false,
        isStaticGeneration: false,
        isServerRendering: false,
      }
    }

    // Detect SSR frameworks
    const framework = this.detectSSRFramework()
    const isStaticGeneration = this.detectStaticGenerationMode()
    const isServerRendering = !isStaticGeneration && runtime === RuntimeEnvironment.NODE

    return {
      isSSR: runtime === RuntimeEnvironment.NODE || framework !== undefined,
      framework,
      isStaticGeneration,
      isServerRendering,
    }
  }

  /**
   * Get complete environment information
   */
  getEnvironmentInfo(options: FeatureDetectionOptions = { intensive: false, timeout: 5000, cache: true }): EnvironmentInfo {
    if (options.cache && this.cache) {
      return this.cache
    }

    const runtime = this.detectRuntime()
    const browser = this.getBrowserInfo()
    const node = this.getNodeInfo()
    const ssr = this.getSSRContext()
    const features = this.detectFeatures(options)

    const environmentInfo: EnvironmentInfo = {
      runtime,
      browser,
      node,
      ssr,
      features,
      timestamp: new Date(),
    }

    if (options.cache) {
      this.cache = environmentInfo
    }

    this.logger.info("Environment information detected", environmentInfo)
    return environmentInfo
  }

  /**
   * Check if running in headless browser
   */
  isHeadless(): boolean {
    const browserInfo = this.getBrowserInfo()
    return browserInfo?.isHeadless ?? false
  }

  /**
   * Check if CDP is available
   */
  isCDPAvailable(): boolean {
    return this.detectFeatures().cdp
  }

  /**
   * Check if specific feature is available
   */
  hasFeature(feature: keyof BrowserFeatures): boolean {
    const features = this.detectFeatures()
    return features[feature] ?? false
  }

  // Private helper methods

  private parseBrowserNameAndVersion(userAgent: string): { name: string, version: string } {
    // Chrome
    const chromeMatch = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/)
    if (chromeMatch && !userAgent.includes("Edg")) {
      return { name: "chrome", version: chromeMatch[1] }
    }

    // Edge
    const edgeMatch = userAgent.match(/Edg\/(\d+\.\d+\.\d+\.\d+)/)
    if (edgeMatch) {
      return { name: "edge", version: edgeMatch[1] }
    }

    // Firefox
    const firefoxMatch = userAgent.match(/Firefox\/(\d+\.\d+)/)
    if (firefoxMatch) {
      return { name: "firefox", version: firefoxMatch[1] }
    }

    // Safari
    const safariMatch = userAgent.match(/Version\/(\d+\.\d+) Safari/)
    if (safariMatch && userAgent.includes("Safari")) {
      return { name: "safari", version: safariMatch[1] }
    }

    // Default fallback
    return { name: "unknown", version: "unknown" }
  }

  private parseOperatingSystem(userAgent: string, platform: string): string {
    if (userAgent.includes("Windows")) {
      return "Windows"
    }
    if (userAgent.includes("Mac OS")) {
      return "macOS"
    }
    if (userAgent.includes("Linux")) {
      return "Linux"
    }
    if (userAgent.includes("Android")) {
      return "Android"
    }
    if (userAgent.includes("iOS")) {
      return "iOS"
    }
    if (platform) {
      return platform
    }

    return "unknown"
  }

  private detectHeadlessBrowser(userAgent: string): boolean {
    // Common headless browser indicators
    const headlessIndicators = [
      "HeadlessChrome",
      "PhantomJS",
      "SlimerJS",
      "jsdom",
      "Node.js",
      "ChromeDriver",
      "Selenium",
    ]

    return headlessIndicators.some(indicator => userAgent.includes(indicator))
  }

  private detectCanvasSupport(): boolean {
    try {
      const canvas = document.createElement("canvas")
      return !!(canvas.getContext && canvas.getContext("2d"))
    } catch {
      return false
    }
  }

  private detectWebGLSupport(): boolean {
    try {
      const canvas = document.createElement("canvas")
      return !!(canvas.getContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))
    } catch {
      return false
    }
  }

  private detectWebWorkerSupport(): boolean {
    return typeof Worker !== "undefined"
  }

  private detectServiceWorkerSupport(): boolean {
    return typeof navigator !== "undefined"
      && typeof navigator.serviceWorker !== "undefined"
  }

  private detectCDPSupport(options: FeatureDetectionOptions): boolean {
    if (options.intensive) {
      // Try to detect Chrome DevTools Protocol availability
      try {
        // Check if we can access Chrome debugging features
        const isChrome = typeof chrome !== "undefined" && chrome.runtime
        const hasRemoteDebugging = typeof window !== "undefined"
          && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__

        return isChrome || hasRemoteDebugging
      } catch {
        return false
      }
    }

    // Simple detection for non-intensive mode
    return typeof chrome !== "undefined"
      || (typeof window !== "undefined" && window.location.protocol === "chrome-extension:")
  }

  private detectLocalStorageSupport(): boolean {
    try {
      const testKey = "__localStorage_test__"
      localStorage.setItem(testKey, "test")
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  private detectSessionStorageSupport(): boolean {
    try {
      const testKey = "__sessionStorage_test__"
      sessionStorage.setItem(testKey, "test")
      sessionStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  private detectFetchSupport(): boolean {
    return typeof fetch !== "undefined"
  }

  private detectWebSocketSupport(): boolean {
    return typeof WebSocket !== "undefined"
  }

  private detectWebRTCSupport(): boolean {
    return typeof RTCPeerConnection !== "undefined"
      || (typeof window !== "undefined" && window.RTCPeerConnection)
      || (typeof globalThis !== "undefined" && globalThis.RTCPeerConnection)
  }

  private detectGeolocationSupport(): boolean {
    return typeof navigator !== "undefined"
      && typeof navigator.geolocation !== "undefined"
  }

  private detectNotificationSupport(): boolean {
    return typeof Notification !== "undefined"
  }

  private getAvailableNodeModules(): string[] {
    try {
      const commonModules = [
        "fs",
        "path",
        "http",
        "https",
        "url",
        "querystring",
        "util",
        "events",
        "stream",
        "buffer",
        "crypto",
        "os",
      ]

      return commonModules.filter((module) => {
        try {
          require.resolve(module)
          return true
        } catch {
          return false
        }
      })
    } catch {
      return []
    }
  }

  private detectSSRFramework(): string | undefined {
    // Check for common SSR framework globals
    if (typeof window !== "undefined") {
      // Next.js
      if ((window as any).__NEXT_DATA__) {
        return "next"
      }

      // Nuxt.js
      if ((window as any).__NUXT__) {
        return "nuxt"
      }

      // SvelteKit
      if ((window as any).__SVELTEKIT__) {
        return "sveltekit"
      }
    }

    if (typeof process !== "undefined") {
      // Check process.env for framework indicators
      const { NODE_ENV: _NODE_ENV } = process.env

      // Next.js
      if (process.env.NEXT_RUNTIME) {
        return "next"
      }

      // Nuxt.js
      if (process.env.NUXT_ENV) {
        return "nuxt"
      }
    }

    return undefined
  }

  private detectStaticGenerationMode(): boolean {
    if (typeof window !== "undefined") {
      // Check for static generation indicators
      return !!(window as any).__STATIC_GENERATION__
        || (window as any).__NEXT_DATA__?.props?.pageProps?.__N_SSG === true
    }

    return false
  }
}
