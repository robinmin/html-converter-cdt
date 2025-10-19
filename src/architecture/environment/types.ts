/**
 * Environment detection types and interfaces
 */

/**
 * Runtime environment types
 */
export enum RuntimeEnvironment {
  BROWSER = "browser",
  NODE = "node",
  WEB_WORKER = "web-worker",
  SERVICE_WORKER = "service-worker",
  UNKNOWN = "unknown",
}

/**
 * Browser feature detection results
 */
export interface BrowserFeatures {
  /** Canvas API support */
  canvas: boolean
  /** Web Workers support */
  webWorkers: boolean
  /** Service Workers support */
  serviceWorkers: boolean
  /** Chrome DevTools Protocol availability */
  cdp: boolean
  /** Local storage support */
  localStorage: boolean
  /** Session storage support */
  sessionStorage: boolean
  /** Fetch API support */
  fetch: boolean
  /** WebSocket support */
  webSocket: boolean
  /** WebRTC support */
  webRTC: boolean
  /** WebGL support */
  webgl: boolean
  /** Geolocation support */
  geolocation: boolean
  /** Notification support */
  notifications: boolean
}

/**
 * Browser information
 */
export interface BrowserInfo {
  /** Browser name (chrome, firefox, safari, edge, etc.) */
  name: string
  /** Browser version */
  version: string
  /** User agent string */
  userAgent: string
  /** Operating system */
  os: string
  /** Whether browser is headless */
  isHeadless: boolean
  /** Browser language */
  language: string
  /** Platform information */
  platform: string
}

/**
 * Node.js environment information
 */
export interface NodeInfo {
  /** Node.js version */
  version: string
  /** Platform (darwin, linux, win32, etc.) */
  platform: string
  /** Architecture (x64, arm64, etc.) */
  arch: string
  /** Whether running in development mode */
  isDevelopment: boolean
  /** Whether running in test environment */
  isTest: boolean
  /** Available Node.js modules */
  availableModules: string[]
}

/**
 * Server-side rendering context information
 */
export interface SSRContext {
  /** Whether running in SSR context */
  isSSR: boolean
  /** Framework name (next, nuxt, sveltekit, etc.) */
  framework?: string
  /** Whether in static generation mode */
  isStaticGeneration: boolean
  /** Whether in server-side rendering mode */
  isServerRendering: boolean
}

/**
 * Complete environment detection result
 */
export interface EnvironmentInfo {
  /** Current runtime environment */
  runtime: RuntimeEnvironment
  /** Browser information (if applicable) */
  browser?: BrowserInfo
  /** Node.js information (if applicable) */
  node?: NodeInfo
  /** SSR context information */
  ssr: SSRContext
  /** Available features */
  features: BrowserFeatures
  /** Detection timestamp */
  timestamp: Date
}

/**
 * Feature detection options
 */
export interface FeatureDetectionOptions {
  /** Whether to perform intensive feature checks */
  intensive: boolean
  /** Timeout for feature detection (ms) */
  timeout: number
  /** Whether to cache results */
  cache: boolean
}

/**
 * Environment detector interface
 */
export interface IEnvironmentDetector {
  /**
   * Detect current runtime environment
   * @returns Current runtime environment
   */
  detectRuntime(): RuntimeEnvironment

  /**
   * Get browser information
   * @returns Browser information or undefined if not in browser
   */
  getBrowserInfo(): BrowserInfo | undefined

  /**
   * Get Node.js information
   * @returns Node.js information or undefined if not in Node.js
   */
  getNodeInfo(): NodeInfo | undefined

  /**
   * Detect available features
   * @param options - Feature detection options
   * @returns Available features
   */
  detectFeatures(options?: FeatureDetectionOptions): BrowserFeatures

  /**
   * Get SSR context information
   * @returns SSR context information
   */
  getSSRContext(): SSRContext

  /**
   * Get complete environment information
   * @param options - Feature detection options
   * @returns Complete environment information
   */
  getEnvironmentInfo(options?: FeatureDetectionOptions): EnvironmentInfo

  /**
   * Check if running in headless browser
   * @returns True if running in headless browser
   */
  isHeadless(): boolean

  /**
   * Check if CDP is available
   * @returns True if CDP is available
   */
  isCDPAvailable(): boolean

  /**
   * Check if specific feature is available
   * @param feature - Feature name to check
   * @returns True if feature is available
   */
  hasFeature(feature: keyof BrowserFeatures): boolean
}
