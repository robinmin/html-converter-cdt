/**
 * Browser capability detection types for progressive enhancement
 */

/**
 * Capability detection result for conversion features
 */
export interface BrowserCapabilityResult {
  /** Whether the capability is available */
  available: boolean
  /** Capability confidence score (0-1) */
  confidence: number
  /** Additional capability details */
  details?: {
    version?: string
    performance?: number
    limitations?: string[]
  }
}

/**
 * Chrome DevTools Protocol capability details
 */
export interface ChromeCDPCapability {
  /** Whether CDP is available */
  available: boolean
  /** Connection method type */
  connectionType: "native" | "extension" | "remote" | "unavailable"
  /** Supported protocols */
  supportedProtocols: string[]
  /** Available target types */
  availableTargets: string[]
  /** Performance rating (0-1) */
  performance: number
}

/**
 * Canvas rendering capability details
 */
export interface CanvasCapability {
  /** Whether canvas is available */
  available: boolean
  /** Canvas context support */
  context2D: boolean
  /** WebGL support */
  webgl: boolean
  /** Canvas size limits */
  maxSize: { width: number, height: number }
  /** Export format support */
  exportFormats: string[]
  /** Performance rating (0-1) */
  performance: number
}

/**
 * Network access capability details
 */
export interface NetworkCapability {
  /** Whether network access is available */
  available: boolean
  /** Fetch API support */
  fetchSupported: boolean
  /** XMLHttpRequest support */
  xhrSupported: boolean
  /** CORS capabilities */
  corsEnabled: boolean
  /** Timeout limits */
  timeoutLimits: { min: number, max: number }
  /** Concurrent request limits */
  concurrentLimit: number
}

/**
 * Complete browser capability assessment
 */
export interface BrowserCapabilityAssessment {
  /** Chrome DevTools Protocol capability */
  chromeCDP: ChromeCDPCapability
  /** Canvas rendering capability */
  canvas: CanvasCapability
  /** Network access capability */
  network: NetworkCapability
  /** Overall capability score (0-1) */
  overallScore: number
  /** Recommended conversion tier */
  recommendedTier: 1 | 2 | 3 | 4
  /** Assessment timestamp */
  timestamp: Date
}

/**
 * Capability detection options
 */
export interface CapabilityDetectionOptions {
  /** Whether to perform intensive detection */
  intensive?: boolean
  /** Detection timeout in milliseconds */
  timeout?: number
  /** Whether to cache results */
  cache?: boolean
  /** Skip performance tests */
  skipPerformanceTests?: boolean
}

/**
 * Browser capability detector interface
 */
export interface IBrowserCapabilityDetector {
  /**
   * Detect Chrome DevTools Protocol capability
   * @param options - Detection options
   * @returns Chrome CDP capability assessment
   */
  detectChromeCapability(options?: CapabilityDetectionOptions): Promise<ChromeCDPCapability>

  /**
   * Detect canvas rendering capability
   * @param options - Detection options
   * @returns Canvas capability assessment
   */
  detectCanvasSupport(options?: CapabilityDetectionOptions): Promise<CanvasCapability>

  /**
   * Detect network access capability
   * @param options - Detection options
   * @returns Network capability assessment
   */
  detectNetworkAccess(options?: CapabilityDetectionOptions): Promise<NetworkCapability>

  /**
   * Detect runtime environment
   * @returns Current runtime environment
   */
  detectEnvironment(): "browser" | "node" | "web-worker" | "unknown"

  /**
   * Get complete capability assessment
   * @param options - Detection options
   * @returns Complete browser capability assessment
   */
  getCompleteAssessment(options?: CapabilityDetectionOptions): Promise<BrowserCapabilityAssessment>

  /**
   * Get recommended conversion tier
   * @param assessment - Capability assessment (optional)
   * @returns Recommended conversion tier
   */
  getRecommendedTier(assessment?: BrowserCapabilityAssessment): 1 | 2 | 3 | 4

  /**
   * Clear capability cache
   */
  clearCache(): void

  /**
   * Check if specific capability is available
   * @param capability - Capability name to check
   * @returns Whether capability is available
   */
  hasCapability(capability: keyof BrowserCapabilityAssessment): boolean
}
