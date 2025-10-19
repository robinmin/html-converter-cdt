/**
 * Result type for converter operations
 */
export interface ConversionResult {
  /** The converted content */
  content: string
  /** The MIME type of the converted content */
  mimeType: string
  /** Metadata about the conversion */
  metadata: {
    /** Original content type */
    sourceType: string
    /** Target format */
    targetFormat: string
    /** Conversion timestamp */
    timestamp: Date
    /** File size in bytes */
    size: number
    /** Additional conversion-specific data */
    [key: string]: any
  }
}

/**
 * Validation result for input checking
 */
export interface ValidationResult {
  /** Whether the input is valid */
  isValid: boolean
  /** Error messages if validation fails */
  errors: string[]
  /** Warning messages for potential issues */
  warnings: string[]
  /** Context information about validation */
  context?: {
    /** Detected content type */
    contentType?: string
    /** Content size */
    size?: number
    /** Additional context */
    [key: string]: any
  }
}

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  debug(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  error(message: string, error?: Error, ...args: any[]): void
}

/**
 * Base converter interface that all converters must implement
 */
export interface IConverter {
  /**
   * Convert HTML document to the target format
   * @param input - HTML document to convert
   * @returns Promise resolving to conversion result
   */
  convert(input: HTMLDocument): Promise<ConversionResult>

  /**
   * Validate input before conversion
   * @param input - HTML document to validate
   * @returns Validation result with any errors or warnings
   */
  validate(input: HTMLDocument): ValidationResult
}

/**
 * Strategy interface for converter selection
 */
export interface ConverterStrategy extends IConverter {
  /**
   * Check if this strategy can handle the given content type
   * @param contentType - MIME type to check
   * @returns True if this strategy can handle the content type
   */
  canHandle(contentType: string): boolean

  /**
   * Get the name of this converter strategy
   */
  getName(): string

  /**
   * Get supported content types
   */
  getSupportedContentTypes(): string[]

  /**
   * Get output format MIME type
   */
  getOutputFormat(): string
}

/**
 * Strategy registry interface for managing available converters
 */
export interface IStrategyRegistry {
  /**
   * Register a converter strategy
   * @param strategy - Strategy to register
   */
  register(strategy: ConverterStrategy): void

  /**
   * Unregister a converter strategy
   * @param name - Name of strategy to unregister
   */
  unregister(name: string): void

  /**
   * Get a strategy by name
   * @param name - Name of strategy
   * @returns Strategy instance or undefined if not found
   */
  getStrategy(name: string): ConverterStrategy | undefined

  /**
   * Get all registered strategies
   * @returns Array of all strategies
   */
  getAllStrategies(): ConverterStrategy[]

  /**
   * Find a strategy that can handle the given content type
   * @param contentType - MIME type to find strategy for
   * @returns Strategy instance or undefined if none found
   */
  findStrategyForContentType(contentType: string): ConverterStrategy | undefined

  /**
   * Clear all registered strategies
   */
  clear(): void
}
