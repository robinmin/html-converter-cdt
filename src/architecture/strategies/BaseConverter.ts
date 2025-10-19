import type { ConversionResult, IConverter, Logger, ValidationResult } from "./types.js"

/**
 * Abstract base class for all converter implementations
 * Provides common functionality and enforces the converter interface
 */
export abstract class BaseConverter implements IConverter {
  protected logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  /**
   * Convert HTML document to the target format
   * Must be implemented by concrete converters
   */
  abstract convert(input: HTMLDocument): Promise<ConversionResult>

  /**
   * Validate input before conversion
   * Provides default validation that can be extended by subclasses
   */
  validate(input: HTMLDocument): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic validation
    if (!input) {
      errors.push("Input HTMLDocument is null or undefined")
    }

    if (input && !input.documentElement) {
      errors.push("Input HTMLDocument has no document element")
    }

    // Check if document is empty
    if (input && input.documentElement && (!input.documentElement.children || input.documentElement.children.length === 0)) {
      warnings.push("HTML document appears to be empty")
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      context: {
        contentType: "text/html",
        size: this.calculateDocumentSize(input),
      },
    }
  }

  /**
   * Helper method to calculate document size
   */
  protected calculateDocumentSize(input: HTMLDocument): number {
    if (!input || !input.documentElement) {
      return 0
    }

    // Handle XMLSerializer not being available (test environments)
    if (typeof XMLSerializer === "undefined") {
      // Fallback: use outerHTML or textContent
      return (input.documentElement.outerHTML || input.documentElement.textContent || "").length
    }

    return new XMLSerializer().serializeToString(input.documentElement).length
  }

  /**
   * Helper method to create a conversion result
   */
  protected createConversionResult(
    content: string,
    mimeType: string,
    sourceType: string,
    targetFormat: string,
    additionalMetadata?: Record<string, any>,
  ): ConversionResult {
    return {
      content,
      mimeType,
      metadata: {
        sourceType,
        targetFormat,
        timestamp: new Date(),
        size: content.length,
        ...additionalMetadata,
      },
    }
  }

  /**
   * Helper method to validate required dependencies
   */
  protected validateDependencies(dependencies: Record<string, any>): void {
    for (const [name, dependency] of Object.entries(dependencies)) {
      if (dependency === null || dependency === undefined) {
        throw new Error(`Required dependency '${name}' is null or undefined`)
      }
    }
  }

  /**
   * Helper method to measure conversion performance
   */
  protected async measureConversionTime<T>(
    operation: () => Promise<T>,
  ): Promise<{ result: T, duration: number }> {
    const startTime = performance.now()
    const result = await operation()
    const endTime = performance.now()
    return {
      result,
      duration: endTime - startTime,
    }
  }
}
