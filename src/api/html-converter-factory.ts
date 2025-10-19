/**
 * HTML Converter Factory
 *
 * This module provides factory functions for creating HTMLConverter instances
 * with sensible defaults and configuration options.
 */

import type {
  HTMLConverterConfig,
  HTMLConverterFactoryOptions,
  IHTMLConverter,
} from "../types/public-api.js"

import { HTMLConverter } from "./html-converter.js"

/**
 * Create a new HTMLConverter instance with default configuration
 *
 * @returns New HTMLConverter instance
 *
 * @example
 * ```typescript
 * import { createHTMLConverter } from 'html-converter-cdt'
 *
 * const converter = createHTMLConverter()
 * const result = await converter.convert('https://example.com', 'pdf')
 * converter.dispose()
 * ```
 */
export function createHTMLConverter(): IHTMLConverter

/**
 * Create a new HTMLConverter instance with custom configuration
 *
 * @param options - Factory options for customizing the converter
 * @returns New HTMLConverter instance
 *
 * @example
 * ```typescript
 * import { createHTMLConverter } from 'html-converter-cdt'
 *
 * const converter = createHTMLConverter({
 *   config: {
 *     defaultTimeout: 60000,
 *     maxConcurrentConversions: 5,
 *     enablePerformanceMonitoring: true
 *   },
 *   enableAutoDiscovery: true
 * })
 *
 * const result = await converter.convert('https://example.com', 'pdf')
 * converter.dispose()
 * ```
 */
export function createHTMLConverter(
  options?: HTMLConverterFactoryOptions
): IHTMLConverter

export function createHTMLConverter(
  options?: HTMLConverterFactoryOptions,
): IHTMLConverter {
  return new HTMLConverter(options)
}

/**
 * Create a new HTMLConverter instance optimized for server-side usage
 *
 * @param options - Additional configuration options
 * @returns HTMLConverter instance optimized for server environments
 *
 * @example
 * ```typescript
 * import { createServerHTMLConverter } from 'html-converter-cdt'
 *
 * // In a Node.js server environment
 * const converter = createServerHTMLConverter({
 *   maxConcurrentConversions: 10,
 *   enablePerformanceMonitoring: false // Disable for better performance
 * })
 *
 * // Use for multiple conversions
 * const results = await Promise.all([
 *   converter.convert('https://example1.com', 'pdf'),
 *   converter.convert('https://example2.com', 'pdf')
 * ])
 *
 * converter.dispose()
 * ```
 */
export function createServerHTMLConverter(
  options?: Partial<HTMLConverterFactoryOptions>,
): IHTMLConverter {
  const serverConfig: HTMLConverterConfig = {
    defaultTimeout: 60000, // Longer timeout for server usage
    maxConcurrentConversions: 5,
    enablePerformanceMonitoring: false, // Disable for better performance
    enableProgressiveEnhancement: true,
    chromeCDP: {
      enabled: true,
      headless: true, // Always headless on servers
      chromeArgs: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    },
    serverSideFallback: {
      enabled: true,
      endpoints: [],
      timeout: 30000,
      retryAttempts: 3,
    },
  }

  return new HTMLConverter({
    config: { ...serverConfig, ...options?.config },
    enableAutoDiscovery: options?.enableAutoDiscovery ?? true,
    logger: options?.logger,
  })
}

/**
 * Create a new HTMLConverter instance optimized for browser/client usage
 *
 * @param options - Additional configuration options
 * @returns HTMLConverter instance optimized for browser environments
 *
 * @example
 * ```typescript
 * import { createBrowserHTMLConverter } from 'html-converter-cdt'
 *
 * // In a browser environment
 * const converter = createBrowserHTMLConverter({
 *   maxConcurrentConversions: 2, // Lower for browser
 *   enablePerformanceMonitoring: true
 * })
 *
 * const result = await converter.convert('https://example.com', 'pdf')
 * converter.dispose()
 * ```
 */
export function createBrowserHTMLConverter(
  options?: Partial<HTMLConverterFactoryOptions>,
): IHTMLConverter {
  const browserConfig: HTMLConverterConfig = {
    defaultTimeout: 30000, // Shorter timeout for better UX
    maxConcurrentConversions: 2, // Lower for browser resources
    enablePerformanceMonitoring: true,
    enableProgressiveEnhancement: true,
    defaultViewport: {
      width: 1200,
      height: 800,
      deviceScaleFactor: 1,
    },
    chromeCDP: {
      enabled: true,
      headless: false, // Show browser for debugging in development
      chromeArgs: [],
    },
    serverSideFallback: {
      enabled: false, // Disabled by default in browser
      endpoints: [],
      timeout: 30000,
      retryAttempts: 1,
    },
  }

  return new HTMLConverter({
    config: { ...browserConfig, ...options?.config },
    enableAutoDiscovery: options?.enableAutoDiscovery ?? true,
    logger: options?.logger,
  })
}

/**
 * Create a new HTMLConverter instance with minimal configuration
 * for simple use cases or testing
 *
 * @param options - Additional configuration options
 * @returns HTMLConverter instance with minimal setup
 *
 * @example
 * ```typescript
 * import { createSimpleHTMLConverter } from 'html-converter-cdt'
 *
 * const converter = createSimpleHTMLConverter()
 *
 * // Simple conversion with minimal overhead
 * const result = await converter.convert('https://example.com', 'pdf')
 * converter.dispose()
 * ```
 */
export function createSimpleHTMLConverter(
  options?: Partial<HTMLConverterFactoryOptions>,
): IHTMLConverter {
  const simpleConfig: HTMLConverterConfig = {
    defaultTimeout: 30000,
    maxConcurrentConversions: 1,
    enablePerformanceMonitoring: false,
    enableProgressiveEnhancement: true,
    chromeCDP: {
      enabled: true,
      headless: true,
      chromeArgs: ["--no-sandbox"],
    },
    serverSideFallback: {
      enabled: false,
      endpoints: [],
      timeout: 30000,
      retryAttempts: 1,
    },
  }

  return new HTMLConverter({
    config: { ...simpleConfig, ...options?.config },
    enableAutoDiscovery: false, // Skip discovery for faster startup
    logger: options?.logger,
  })
}
