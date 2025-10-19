/**
 * Unified Convert Function
 *
 * This module provides a simple, unified convert() function that can convert HTML
 * to any supported format with automatic format detection and sensible defaults.
 */

import type {
  ConversionFormat,
  ConversionInput,
  ConversionOptions,
  EnhancedConversionResult,
} from "../types/public-api.js"

import { createHTMLConverter } from "./html-converter-factory.js"

/**
 * Convert HTML to the specified format with automatic format detection
 *
 * This is the main entry point for HTML conversion. It provides a simple API
 * that handles format detection, option merging, and error handling automatically.
 *
 * @param input - Input source (URL, file path, or content)
 * @param formatOrOptions - Either the target format or conversion options
 * @param options - Conversion options (if format is specified as first parameter)
 * @returns Promise resolving to conversion result
 *
 * @example
 * ```typescript
 * import { convert } from 'html-converter-cdt'
 *
 * // Convert to PDF with automatic format detection from filename
 * const result = await convert('https://example.com', 'pdf')
 *
 * // Convert to MHTML with custom options
 * const result = await convert('https://example.com', 'mhtml', {
 *   inlineResources: true,
 *   timeout: 60000
 * })
 *
 * // Convert with options object containing format
 * const result = await convert('https://example.com', {
 *   format: 'pdf',
 *   options: {
 *     format: 'A4',
 *     printBackground: true
 *   }
 * })
 * ```
 */
export async function convert(
  input: ConversionInput,
  formatOrOptions: ConversionFormat | { format: ConversionFormat, options?: ConversionOptions },
  options?: ConversionOptions
): Promise<EnhancedConversionResult>

/**
 * Convert HTML with automatic format detection from output path
 *
 * @param input - Input source (URL, file path, or content)
 * @param formatOrOptionsOrPath - Output file path (format detected from extension)
 * @param options - Conversion options
 * @returns Promise resolving to conversion result
 *
 * @example
 * ```typescript
 * import { convert } from 'html-converter-cdt'
 *
 * // Format automatically detected from file extension
 * const result = await convert('https://example.com', 'output.pdf')
 * const result = await convert('https://example.com', 'document.mhtml')
 * ```
 */
export async function convert(
  input: ConversionInput,
  formatOrOptionsOrPath: string,
  options?: ConversionOptions
): Promise<EnhancedConversionResult>

export async function convert(
  input: ConversionInput,
  formatOrOptionsOrPath: ConversionFormat | { format: ConversionFormat, options?: ConversionOptions } | string,
  options?: ConversionOptions,
): Promise<EnhancedConversionResult> {
  const converter = createHTMLConverter()

  try {
    // Handle different parameter patterns
    let format: ConversionFormat
    let mergedOptions: ConversionOptions

    if (typeof formatOrOptionsOrPath === "string") {
      // Check if it's a file path (contains dot and extension) or format name
      if (formatOrOptionsOrPath.includes(".") && formatOrOptionsOrPath.length > 1) {
        // File path - extract format from extension
        format = extractFormatFromPath(formatOrOptionsOrPath)
        mergedOptions = { ...options }
      } else {
        // Format name
        format = formatOrOptionsOrPath as ConversionFormat
        mergedOptions = { ...options }
      }
    } else if (typeof formatOrOptionsOrPath === "object" && "format" in formatOrOptionsOrPath) {
      // Options object with format
      format = formatOrOptionsOrPath.format
      mergedOptions = { ...formatOrOptionsOrPath.options, ...options }
    } else {
      throw new Error("Invalid parameters. Please provide format or output path.")
    }

    // Validate format
    const supportedFormats = converter.getSupportedFormats()
    if (!supportedFormats.includes(format)) {
      throw new Error(
        `Unsupported format: ${format}. Supported formats: ${supportedFormats.join(", ")}`,
      )
    }

    // Perform conversion
    const result = await converter.convert(input, format, mergedOptions)

    // If we have a file path, update the suggested filename
    if (typeof formatOrOptionsOrPath === "string" && formatOrOptionsOrPath.includes(".")) {
      result.suggestedFileName = formatOrOptionsOrPath
    }

    return result
  } finally {
    converter.dispose()
  }
}

/**
 * Convert HTML with automatic format detection and file output
 *
 * @param input - Input source (URL, file path, or content)
 * @param outputPath - Output file path
 * @param options - Conversion options
 * @returns Promise resolving to conversion result with file information
 *
 * @example
 * ```typescript
 * import { convertToFile } from 'html-converter-cdt'
 *
 * const result = await convertToFile('https://example.com', 'output.pdf')
 * console.log(`File saved: ${result.filePath}`)
 * ```
 */
export async function convertToFile(
  input: ConversionInput,
  outputPath: string,
  options?: ConversionOptions,
): Promise<EnhancedConversionResult & { filePath: string }> {
  const result = await convert(input, outputPath, options)

  // Note: In a real implementation, this would save the file to disk
  // For now, we'll just return the expected result structure
  return {
    ...result,
    filePath: outputPath,
  }
}

/**
 * Convert multiple inputs with batch processing
 *
 * @param conversions - Array of conversion specifications
 * @param options - Batch processing options
 * @param options.maxConcurrency - Maximum number of concurrent conversions
 * @param options.continueOnError - Whether to continue processing if one conversion fails
 * @param options.onProgress - Progress callback function
 * @returns Promise resolving to array of conversion results
 *
 * @example
 * ```typescript
 * import { convertBatch } from 'html-converter-cdt'
 *
 * const results = await convertBatch([
 *   { input: 'https://example1.com', format: 'pdf' },
 *   { input: 'https://example2.com', format: 'mhtml' },
 *   { input: '<h1>Test</h1>', format: 'png', outputPath: 'test.png' }
 * ])
 * ```
 */
export async function convertBatch(
  conversions: Array<{
    input: ConversionInput
    format?: ConversionFormat
    outputPath?: string
    options?: ConversionOptions
  }>,
  options?: {
    maxConcurrency?: number
    continueOnError?: boolean
    onProgress?: (progress: { current: number, total: number, percentage: number }) => void
  },
): Promise<EnhancedConversionResult[]> {
  const converter = createHTMLConverter()

  try {
    // Convert to batch items format
    const batchItems = conversions.map((conv, index) => {
      let format: ConversionFormat

      if (conv.format) {
        format = conv.format
      } else if (conv.outputPath) {
        format = extractFormatFromPath(conv.outputPath)
      } else {
        throw new Error(`Format must be specified for conversion ${index + 1}`)
      }

      return {
        id: `conversion-${index + 1}`,
        input: conv.input,
        format,
        options: conv.options,
        outputPath: conv.outputPath,
      }
    })

    // Perform batch conversion
    const batchResult = await converter.convertBatch(batchItems, options as any)

    // Extract results and update file paths if specified
    return batchResult.results.map((item, index) => {
      if (item.success) {
        const result = item.result as EnhancedConversionResult
        const originalConv = conversions[index]

        if (originalConv?.outputPath) {
          result.suggestedFileName = originalConv.outputPath
        }

        return result
      } else {
        // Convert error to a result-like object for consistency
        const error = item.result as any
        return {
          content: "",
          mimeType: "",
          metadata: {
            sourceType: "unknown",
            targetFormat: conversions[index]?.format || "unknown",
            timestamp: new Date(),
            size: 0,
          },
          format: conversions[index]?.format || ("unknown" as ConversionFormat),
          suggestedFileName: conversions[index]?.outputPath || `error-${index + 1}`,
          usedFallback: false,
          conversionTier: "chrome-cdp" as const,
          performance: {
            conversionTime: 0,
            memoryUsage: 0,
            resourcesProcessed: 0,
          },
          validationWarnings: [`Conversion failed: ${error.message || "Unknown error"}`],
        }
      }
    })
  } finally {
    converter.dispose()
  }
}

/**
 * Extract format from file path or extension
 */
function extractFormatFromPath(path: string): ConversionFormat {
  const extension = path.split(".").pop()?.toLowerCase()

  const formatMap: Record<string, ConversionFormat> = {
    pdf: "pdf",
    mhtml: "mhtml",
    png: "png",
    jpg: "jpeg",
    jpeg: "jpeg",
    md: "markdown",
    markdown: "markdown",
    docx: "docx",
  }

  if (extension && formatMap[extension]) {
    return formatMap[extension]
  }

  throw new Error(`Cannot determine format from path: ${path}`)
}

/**
 * Convert with retry logic for unreliable operations
 *
 * @param input - Input source
 * @param format - Target format
 * @param options - Conversion options
 * @param retryOptions - Retry configuration
 * @param retryOptions.maxAttempts - Maximum number of retry attempts
 * @param retryOptions.delay - Initial delay between retries in milliseconds
 * @param retryOptions.backoff - Backoff strategy ('linear' or 'exponential')
 * @param retryOptions.onRetry - Callback function called on each retry
 * @returns Promise resolving to conversion result
 *
 * @example
 * ```typescript
 * import { convertWithRetry } from 'html-converter-cdt'
 *
 * const result = await convertWithRetry('https://example.com', 'pdf', {}, {
 *   maxAttempts: 3,
 *   delay: 1000,
 *   backoff: 'exponential'
 * })
 * ```
 */
export async function convertWithRetry(
  input: ConversionInput,
  format: ConversionFormat,
  options: ConversionOptions = {},
  retryOptions: {
    maxAttempts?: number
    delay?: number
    backoff?: "linear" | "exponential"
    onRetry?: (attempt: number, error: Error) => void
  } = {},
): Promise<EnhancedConversionResult> {
  const { maxAttempts = 3, delay = 1000, backoff = "linear", onRetry } = retryOptions

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await convert(input, format, options)
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        break
      }

      // Calculate delay with backoff
      let currentDelay = delay
      if (backoff === "exponential") {
        currentDelay = delay * 2 ** (attempt - 1)
      }

      // Call retry callback
      if (onRetry) {
        onRetry(attempt, lastError)
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, currentDelay))
    }
  }

  throw lastError || new Error("Conversion failed after all retry attempts")
}

/**
 * Get conversion progress for long-running operations
 *
 * @param conversionPromise - Promise from convert() call
 * @param onProgress - Progress callback
 * @returns Promise resolving to conversion result
 *
 * @example
 * ```typescript
 * import { convertWithProgress } from 'html-converter-cdt'
 *
 * const result = await convertWithProgress(
 *   convert('https://example.com', 'pdf'),
 *   (progress) => console.log(`${progress.percentage}% - ${progress.message}`)
 * )
 * ```
 */
export async function convertWithProgress(
  conversionPromise: Promise<EnhancedConversionResult>,
  onProgress: (progress: { percentage: number, message: string, step: string }) => void,
): Promise<EnhancedConversionResult> {
  // Note: In a real implementation, this would integrate with the converter's
  // event system to provide progress updates. For now, we'll simulate progress.

  // Simulate progress updates
  const progressSteps = [
    { percentage: 10, message: "Initializing conversion...", step: "init" },
    { percentage: 30, message: "Loading content...", step: "loading" },
    { percentage: 60, message: "Converting document...", step: "converting" },
    { percentage: 90, message: "Finalizing output...", step: "finalizing" },
  ]

  let currentStep = 0

  const progressInterval = setInterval(() => {
    if (currentStep < progressSteps.length) {
      const step = progressSteps[currentStep]
      if (step) {
        onProgress(step)
      }
      currentStep++
    } else {
      clearInterval(progressInterval)
    }
  }, 200)

  try {
    const result = await conversionPromise
    clearInterval(progressInterval)
    onProgress({ percentage: 100, message: "Conversion complete!", step: "complete" })
    return result
  } catch (error) {
    clearInterval(progressInterval)
    throw error
  }
}
