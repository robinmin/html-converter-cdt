/**
 * Quick environment detection utilities
 */

/// <reference path="../../types/globals.d.ts" />

import process from "node:process"

import type { BrowserFeatures } from "./types"
import { RuntimeEnvironment } from "./types"

/**
 * Check if running in browser environment
 */
export const isBrowser = (): boolean => {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

/**
 * Check if running in Node.js environment
 */
export const isNode = (): boolean => {
  return typeof process !== "undefined" && process.versions?.node !== undefined
}

/**
 * Check if running in Web Worker environment
 */
export const isWebWorker = (): boolean => {
  return typeof globalThis !== "undefined" && typeof importScripts === "function"
}

/**
 * Check if running in Service Worker environment
 */
export const isServiceWorker = (): boolean => {
  return typeof globalThis !== "undefined"
    && typeof (globalThis as any).addEventListener === "function"
    && typeof (globalThis as any).skipWaiting === "function"
}

/**
 * Check if running in any browser-like environment (browser, web worker, service worker)
 */
export const isBrowserLike = (): boolean => {
  return isBrowser() || isWebWorker() || isServiceWorker()
}

/**
 * Check if running in server-side rendering context
 */
export const isSSR = (): boolean => {
  if (isBrowser()) {
    return false
  }

  // Check for common SSR indicators
  if (typeof window !== "undefined") {
    return !!(window as any).__SSR__
      || !!(window as any).__NEXT_DATA__?.props?.pageProps?.__N_SSG
      || !!(window as any).__NUXT__
  }

  return isNode()
}

/**
 * Check if running in development environment
 */
export const isDevelopment = (): boolean => {
  if (typeof process !== "undefined" && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === "development"
  }

  return !!(typeof window !== "undefined"
    && (window.location.hostname === "localhost"
      || window.location.hostname === "127.0.0.1"
      || window.location.hostname.endsWith(".localhost")))
}

/**
 * Check if running in test environment
 */
export const isTest = (): boolean => {
  if (typeof process !== "undefined" && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === "test" || process.env.NODE_ENV === "testing"
  }

  return typeof window !== "undefined" && (window as any).__TEST__
}

/**
 * Check if running in production environment
 */
export const isProduction = (): boolean => {
  if (typeof process !== "undefined" && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === "production"
  }

  return !isDevelopment() && !isTest()
}

/**
 * Feature detection utilities
 */

/**
 * Check if Canvas API is supported
 */
export const supportsCanvas = (): boolean => {
  if (!isBrowserLike()) {
    return false
  }

  try {
    const canvas = document.createElement("canvas")
    return !!(canvas.getContext && canvas.getContext("2d"))
  } catch {
    return false
  }
}

/**
 * Check if Web Workers are supported
 */
export const supportsWebWorkers = (): boolean => {
  return typeof Worker !== "undefined"
}

/**
 * Check if Service Workers are supported
 */
export const supportsServiceWorkers = (): boolean => {
  return typeof navigator !== "undefined"
    && typeof navigator.serviceWorker !== "undefined"
}

/**
 * Check if Local Storage is available
 */
export const supportsLocalStorage = (): boolean => {
  if (!isBrowser()) {
    return false
  }

  try {
    const testKey = "__localStorage_test__"
    localStorage.setItem(testKey, "test")
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * Check if Session Storage is available
 */
export const supportsSessionStorage = (): boolean => {
  if (!isBrowser()) {
    return false
  }

  try {
    const testKey = "__sessionStorage_test__"
    sessionStorage.setItem(testKey, "test")
    sessionStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * Check if Fetch API is supported
 */
export const supportsFetch = (): boolean => {
  return typeof fetch !== "undefined"
}

/**
 * Check if WebSocket is supported
 */
export const supportsWebSocket = (): boolean => {
  return typeof WebSocket !== "undefined"
}

/**
 * Check if WebRTC is supported
 */
export const supportsWebRTC = (): boolean => {
  return !!(typeof RTCPeerConnection !== "undefined"
    || (typeof window !== "undefined" && window.RTCPeerConnection)
    || (typeof globalThis !== "undefined" && globalThis.RTCPeerConnection))
}

/**
 * Check if WebGL is supported
 */
export const supportsWebGL = (): boolean => {
  if (!isBrowserLike()) {
    return false
  }

  try {
    const canvas = document.createElement("canvas")
    return !!(canvas.getContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))
  } catch {
    return false
  }
}

/**
 * Check if Geolocation API is supported
 */
export const supportsGeolocation = (): boolean => {
  return typeof navigator !== "undefined"
    && typeof navigator.geolocation !== "undefined"
}

/**
 * Check if Notifications API is supported
 */
export const supportsNotifications = (): boolean => {
  return typeof Notification !== "undefined"
}

/**
 * Browser detection utilities
 */

/**
 * Get user agent string
 */
export const getUserAgent = (): string => {
  if (typeof navigator !== "undefined") {
    return navigator.userAgent
  }

  if (typeof process !== "undefined") {
    return `Node.js ${process.version} on ${process.platform}-${process.arch}`
  }

  return "Unknown"
}

/**
 * Get browser name from user agent
 */
export const getBrowserName = (): string => {
  const userAgent = getUserAgent()

  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
    return "Chrome"
  }

  if (userAgent.includes("Edg")) {
    return "Edge"
  }

  if (userAgent.includes("Firefox")) {
    return "Firefox"
  }

  if (userAgent.includes("Safari")) {
    return "Safari"
  }

  if (userAgent.includes("Node.js")) {
    return "Node.js"
  }

  return "Unknown"
}

/**
 * Check if running in headless browser
 */
export const isHeadlessBrowser = (): boolean => {
  const userAgent = getUserAgent()

  const headlessIndicators = [
    "HeadlessChrome",
    "PhantomJS",
    "SlimerJS",
    "jsdom",
    "ChromeDriver",
    "Selenium",
  ]

  return headlessIndicators.some(indicator => userAgent.includes(indicator))
}

/**
 * Check if Chrome DevTools Protocol is available
 */
export const isCDPAvailable = (): boolean => {
  return typeof chrome !== "undefined"
    || (typeof window !== "undefined" && window.location.protocol === "chrome-extension:")
    || (typeof window !== "undefined" && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__)
}

/**
 * Get operating system information
 */
export const getOperatingSystem = (): string => {
  const userAgent = getUserAgent()

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

  if (typeof process !== "undefined" && process.platform) {
    return process.platform
  }

  return "Unknown"
}

/**
 * Environment validation utilities
 */

/**
 * Validate that required features are available
 */
export const validateRequiredFeatures = (requiredFeatures: (keyof BrowserFeatures)[]): boolean => {
  const features: Partial<BrowserFeatures> = {
    canvas: supportsCanvas(),
    webWorkers: supportsWebWorkers(),
    serviceWorkers: supportsServiceWorkers(),
    cdp: isCDPAvailable(),
    localStorage: supportsLocalStorage(),
    sessionStorage: supportsSessionStorage(),
    fetch: supportsFetch(),
    webSocket: supportsWebSocket(),
    webRTC: supportsWebRTC(),
    webgl: supportsWebGL(),
    geolocation: supportsGeolocation(),
    notifications: supportsNotifications(),
  }

  return requiredFeatures.every(feature => features[feature] === true)
}

/**
 * Get environment summary
 */
export const getEnvironmentSummary = (): {
  runtime: RuntimeEnvironment
  browser: string
  os: string
  isHeadless: boolean
  hasCDP: boolean
  environment: string
} => {
  const runtime = isBrowser()
    ? RuntimeEnvironment.BROWSER
    : isWebWorker()
      ? RuntimeEnvironment.WEB_WORKER
      : isServiceWorker()
        ? RuntimeEnvironment.SERVICE_WORKER
        : isNode()
          ? RuntimeEnvironment.NODE
          : RuntimeEnvironment.UNKNOWN

  return {
    runtime,
    browser: getBrowserName(),
    os: getOperatingSystem(),
    isHeadless: isHeadlessBrowser(),
    hasCDP: isCDPAvailable(),
    environment: isDevelopment()
      ? "development"
      : isTest()
        ? "test"
        : isProduction() ? "production" : "unknown",
  }
}
