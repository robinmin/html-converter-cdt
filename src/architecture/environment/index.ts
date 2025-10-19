/**
 * Environment Detection Module
 *
 * Provides comprehensive environment detection capabilities for browser,
 * Node.js, and feature capability detection with support for CDP availability,
 * headless browser detection, and SSR context detection.
 */

export { EnvironmentDetector } from "./EnvironmentDetector"
export type {
  BrowserFeatures,
  BrowserInfo,
  EnvironmentInfo,
  FeatureDetectionOptions,
  IEnvironmentDetector,
  NodeInfo,
  RuntimeEnvironment,
  SSRContext,
} from "./types"

export {
  getBrowserName,
  getEnvironmentSummary,
  getOperatingSystem,
  getUserAgent,
  isBrowser,
  isBrowserLike,
  isCDPAvailable,
  isDevelopment,
  isHeadlessBrowser,
  isNode,
  isProduction,
  isServiceWorker,
  isSSR,
  isTest,
  isWebWorker,
  supportsCanvas,
  supportsFetch,
  supportsGeolocation,
  supportsLocalStorage,
  supportsNotifications,
  supportsServiceWorkers,
  supportsSessionStorage,
  supportsWebGL,
  supportsWebRTC,
  supportsWebSocket,
  supportsWebWorkers,
  validateRequiredFeatures,
} from "./utils"
