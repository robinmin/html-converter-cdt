/**
 * Default Configuration Values
 *
 * Provides comprehensive default configuration with security-focused
 * and performance-optimized settings for all conversion formats.
 */

import process from "node:process"

import type { BaseConfig, Config, DOCXConfig, ImageConfig, MarkdownConfig, MHTMLConfig, PDFConfig } from "./schema"

/**
 * Default base configuration with security and performance settings
 */
export const DEFAULT_BASE_CONFIG: BaseConfig = {
  // Core conversion settings - conservative defaults for reliability
  maxRetries: 3,
  timeout: 30000, // 30 seconds - reasonable for most conversions
  verbose: false,

  // Chrome/Chromium settings - security-focused defaults
  chromePath: undefined, // Let system find Chrome automatically
  chromeArgs: [
    "--no-sandbox", // Required in some environments
    "--disable-dev-shm-usage", // Prevents memory issues in Docker
    "--disable-gpu", // Disable GPU acceleration for better compatibility
    "--disable-web-security", // Required for local file access
    "--disable-features=TranslateUI", // Remove unnecessary features
    "--disable-ipc-flooding-protection", // Prevent timeouts
    "--disable-renderer-backgrounding", // Ensure consistent rendering
  ],
  headless: true,

  // Security settings - secure by default
  enableSandbox: true,
  allowInsecureConnections: false,

  // Performance settings - balanced for most use cases
  concurrency: 3, // Good balance between performance and resource usage
  memoryLimit: 512, // 512MB - reasonable for most conversions
}

/**
 * Default PDF configuration optimized for standard document conversion
 */
export const DEFAULT_PDF_CONFIG: PDFConfig = {
  // Standard document layout
  layout: "standard",
  pageSize: "A4", // Most common page size
  scale: 1.0,

  // Standard margins (1cm on all sides)
  margins: {
    top: "1cm",
    right: "1cm",
    bottom: "1cm",
    left: "1cm",
  },

  // Print settings
  printBackground: true, // Include backgrounds for better fidelity
  displayHeaderFooter: false, // Simple documents don't need headers/footers
  headerTemplate: "<div></div>",
  footerTemplate: "<div></div>",

  // Advanced PDF settings
  preferCSSPageSize: false, // Use our pageSize setting
  generateTaggedPDF: false, // Only enable when accessibility is needed
}

/**
 * Default image configuration optimized for web and screenshots
 */
export const DEFAULT_IMAGE_CONFIG: ImageConfig = {
  // Standard web format
  format: "png", // Lossless, good for screenshots
  quality: 80, // Good balance between quality and file size

  // Standard document layout
  layout: "standard",

  // Standard viewport for web content
  viewport: {
    width: 1920, // Full HD width
    height: 1080, // Full HD height
    deviceScaleFactor: 1.0, // Standard pixel density
  },

  // Rendering options
  omitBackground: false, // Include backgrounds for accurate representation
  captureBeyondViewport: false, // Only capture visible content
}

/**
 * Default Markdown configuration optimized for GitHub compatibility
 */
export const DEFAULT_MARKDOWN_CONFIG: MarkdownConfig = {
  // GitHub Flavored Markdown - most popular
  flavor: "gfm",

  // Content handling
  embedImages: true, // Include images in markdown
  preserveWhitespace: false, // Clean output

  // Style preferences
  headingStyle: "atx", // # headings (more common)
  bulletMarker: "-", // Standard bullet
  codeBlockStyle: "fenced", // ``` code blocks
  fence: "```", // Standard fence
  emDelimiter: "*", // Standard emphasis
  strongDelimiter: "**", // Standard strong emphasis
  linkStyle: "inlined", // More readable

  // Asset management
  imageAssetPath: "./assets", // Standard assets directory

  // GFM features
  strikethrough: true, // Support ~strikethrough~
  tables: true, // Support table syntax
  tasklists: true, // Support - [x] task lists
}

/**
 * Default DOCX configuration optimized for business documents
 */
export const DEFAULT_DOCX_CONFIG: DOCXConfig = {
  // Document formatting
  preserveStyle: true, // Preserve original styling
  fontFamily: "Arial", // Widely compatible font
  fontSize: 12, // Standard business document size

  // Page layout - standard business document
  pageLayout: {
    size: "A4", // Standard international page size
    orientation: "portrait", // Most common orientation
    margins: {
      top: 1.0, // 1 inch margins (standard)
      right: 1.0,
      bottom: 1.0,
      left: 1.0,
    },
  },

  // Text formatting
  lineSpacing: 1.15, // Standard business document spacing
  paragraphSpacing: 6, // Points between paragraphs

  // Content handling
  embedImages: true, // Include images in document
  convertTables: true, // Convert HTML tables to DOCX tables
  convertLists: true, // Convert HTML lists to DOCX lists
  preserveLinks: true, // Keep hyperlinks active
}

/**
 * Default MHTML configuration optimized for archive completeness
 */
export const DEFAULT_MHTML_CONFIG: MHTMLConfig = {
  // Archive settings
  preserveOriginal: true, // Keep original structure
  compressResources: false, // Preserve quality over size
  includeMetadata: true, // Include document metadata

  // Encoding and structure
  encoding: "utf-8", // Standard encoding
  boundaryPrefix: "----=_NextPart_", // Standard MHTML boundary

  // Resource handling
  maxResourceSize: 1048576, // 1MB per resource limit
  timeoutPerResource: 10000, // 10 seconds per resource
}

/**
 * Complete default configuration combining all format settings
 */
export const DEFAULT_CONFIG: Config = {
  // Base configuration
  base: DEFAULT_BASE_CONFIG,

  // Format-specific configurations
  pdf: DEFAULT_PDF_CONFIG,
  image: DEFAULT_IMAGE_CONFIG,
  markdown: DEFAULT_MARKDOWN_CONFIG,
  docx: DEFAULT_DOCX_CONFIG,
  mhtml: DEFAULT_MHTML_CONFIG,

  // Global settings
  defaultFormat: "pdf", // Most common conversion target
  outputPath: undefined, // Let system determine output location
  outputFilename: undefined, // Generate filename automatically

  // Advanced settings
  experimental: false, // Stable features only by default
  debugMode: false, // Production mode by default
  logLevel: "info", // Standard logging level
}

/**
 * Environment-specific default configurations
 */

/**
 * Development environment defaults with more debugging
 */
export const DEVELOPMENT_DEFAULTS: Partial<Config> = {
  base: {
    ...DEFAULT_BASE_CONFIG,
    verbose: true,
    timeout: 60000, // Longer timeout for debugging
  },
  debugMode: true,
  logLevel: "debug",
  experimental: true, // Enable experimental features for testing
}

/**
 * Production environment defaults with enhanced security
 */
export const PRODUCTION_DEFAULTS: Partial<Config> = {
  base: {
    ...DEFAULT_BASE_CONFIG,
    maxRetries: 5, // More retries for reliability
    timeout: 45000, // Conservative timeout
    enableSandbox: true,
    allowInsecureConnections: false,
    memoryLimit: 256, // Lower memory limit for production
  },
  debugMode: false,
  logLevel: "warn", // Only warnings and errors in production
  experimental: false, // No experimental features in production
}

/**
 * Testing environment defaults optimized for CI/CD
 */
export const TESTING_DEFAULTS: Partial<Config> = {
  base: {
    ...DEFAULT_BASE_CONFIG,
    timeout: 10000, // Short timeout for fast tests
    maxRetries: 1, // Fail fast in tests
    concurrency: 1, // Sequential execution for predictable tests
    memoryLimit: 128, // Minimal memory usage
    chromeArgs: [
      ...DEFAULT_BASE_CONFIG.chromeArgs,
      "--disable-software-rasterizer", // Faster rendering
      "--disable-background-timer-throttling", // Consistent timing
    ],
  },
  debugMode: true,
  logLevel: "error", // Only errors in tests to reduce noise
}

/**
 * High-performance defaults for batch processing
 */
export const PERFORMANCE_DEFAULTS: Partial<Config> = {
  base: {
    ...DEFAULT_BASE_CONFIG,
    concurrency: 10, // Maximum parallelism
    timeout: 20000, // Shorter timeout for batch processing
    memoryLimit: 1024, // More memory for faster processing
    chromeArgs: [
      ...DEFAULT_BASE_CONFIG.chromeArgs,
      "--disable-extensions", // Faster startup
      "--disable-plugins", // No plugins needed
      "--disable-images", // Disable image loading if not needed
    ],
  },
  logLevel: "warn", // Minimal logging for performance
}

/**
 * Low-resource defaults for constrained environments
 */
export const LOW_RESOURCE_DEFAULTS: Partial<Config> = {
  base: {
    ...DEFAULT_BASE_CONFIG,
    concurrency: 1, // Sequential processing
    timeout: 60000, // Longer timeout for slower hardware
    memoryLimit: 128, // Minimal memory usage
    chromeArgs: [
      ...DEFAULT_BASE_CONFIG.chromeArgs,
      "--disable-background-networking", // Reduce network usage
      "--disable-sync", // No background sync
      "--disable-translate", // No translation features
    ],
  },
  pdf: {
    ...DEFAULT_PDF_CONFIG,
    scale: 0.8, // Smaller scale to reduce memory usage
  },
  image: {
    ...DEFAULT_IMAGE_CONFIG,
    viewport: {
      width: 1280, // Smaller viewport
      height: 720,
      deviceScaleFactor: 1.0,
    },
  },
}

/**
 * Function to get defaults based on environment
 */
export function getDefaults(environment: "development" | "production" | "testing" | "performance" | "low-resource" = "production"): Config {
  const environmentDefaults = {
    "development": DEVELOPMENT_DEFAULTS,
    "production": PRODUCTION_DEFAULTS,
    "testing": TESTING_DEFAULTS,
    "performance": PERFORMANCE_DEFAULTS,
    "low-resource": LOW_RESOURCE_DEFAULTS,
  }[environment] || {}

  // Deep merge environment defaults with base defaults
  return mergeDeep(DEFAULT_CONFIG, environmentDefaults)
}

/**
 * Function to get format-specific defaults
 */
export function getFormatDefaults<T>(format: "pdf" | "image" | "markdown" | "docx" | "mhtml"): T {
  const formatDefaults = {
    pdf: DEFAULT_PDF_CONFIG,
    image: DEFAULT_IMAGE_CONFIG,
    markdown: DEFAULT_MARKDOWN_CONFIG,
    docx: DEFAULT_DOCX_CONFIG,
    mhtml: DEFAULT_MHTML_CONFIG,
  }[format]

  return formatDefaults as T
}

/**
 * Deep merge utility function for combining configurations
 */
function mergeDeep<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target }

  for (const key in source) {
    if (source[key] !== undefined) {
      if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key])) {
        result[key] = mergeDeep((result[key] as Record<string, any>) || {}, source[key] as any) as T[Extract<keyof T, string>]
      } else {
        result[key] = source[key] as any
      }
    }
  }

  return result
}

/**
 * Export the main defaults function
 */
export function getDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG }
}

/**
 * Export environment-specific defaults function
 */
export function getEnvironmentConfig(environment?: string): Config {
  const env = environment || process.env.NODE_ENV || "production"

  // Map common environment names to our supported environments
  const environmentMap: Record<string, "development" | "production" | "testing" | "performance" | "low-resource"> = {
    "dev": "development",
    "development": "development",
    "prod": "production",
    "production": "production",
    "test": "testing",
    "testing": "testing",
    "perf": "performance",
    "performance": "performance",
    "low": "low-resource",
    "low-resource": "low-resource",
  }

  const mappedEnv = environmentMap[env] || "production"
  return getDefaults(mappedEnv)
}

/**
 * Validate that defaults meet security requirements
 */
export function validateSecurityDefaults(config: Config): { isValid: boolean, warnings: string[] } {
  const warnings: string[] = []
  const base = config.base ?? DEFAULT_BASE_CONFIG

  // Check security-critical settings
  if (!base.enableSandbox) {
    warnings.push("Sandboxing is disabled - this may pose security risks")
  }

  if (base.allowInsecureConnections) {
    warnings.push("Insecure connections are allowed - this may pose security risks")
  }

  if (base.timeout > 300000) {
    warnings.push("Very long timeout may allow resource exhaustion attacks")
  }

  if (base.memoryLimit > 2048) {
    warnings.push("High memory limit may allow resource exhaustion attacks")
  }

  // Check Chrome security settings
  if (base.chromeArgs && base.chromeArgs.includes("--no-sandbox")) {
    warnings.push("Chrome sandboxing is disabled - this may pose security risks")
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  }
}

/**
 * Validate that defaults meet performance requirements
 */
export function validatePerformanceDefaults(config: Config): { isValid: boolean, suggestions: string[] } {
  const suggestions: string[] = []
  const base = config.base ?? DEFAULT_BASE_CONFIG
  const pdf = config.pdf ?? DEFAULT_PDF_CONFIG
  const image = config.image ?? DEFAULT_IMAGE_CONFIG

  // Check performance settings
  if (base.concurrency < 1 || base.concurrency > 10) {
    suggestions.push("Consider setting concurrency between 1-10 for optimal performance")
  }

  if (base.timeout < 5000) {
    suggestions.push("Very short timeout may cause conversion failures")
  }

  if (base.memoryLimit < 128) {
    suggestions.push("Very low memory limit may cause conversion failures")
  }

  // Check format-specific performance settings
  if (pdf.scale < 0.5 || pdf.scale > 2.0) {
    suggestions.push("Consider PDF scale between 0.5-2.0 for optimal performance")
  }

  if (image.quality < 50 || image.quality > 95) {
    suggestions.push("Consider image quality between 50-95 for optimal performance")
  }

  return {
    isValid: suggestions.length === 0,
    suggestions,
  }
}
