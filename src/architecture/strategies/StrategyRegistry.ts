import type { ConverterStrategy, IStrategyRegistry, Logger } from "./types.js"

/**
 * Registry for managing converter strategies
 * Provides thread-safe strategy registration and lookup functionality
 */
export class StrategyRegistry implements IStrategyRegistry {
  private strategies = new Map<string, ConverterStrategy>()
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  /**
   * Register a converter strategy
   */
  register(strategy: ConverterStrategy): void {
    if (!strategy) {
      throw new Error("Strategy cannot be null or undefined")
    }

    const name = strategy.getName()
    if (!name || name.trim() === "") {
      throw new Error("Strategy name must be a non-empty string")
    }

    if (this.strategies.has(name)) {
      this.logger.warn(`Strategy '${name}' is already registered. Overwriting.`)
    }

    this.strategies.set(name, strategy)
    this.logger.debug(`Registered converter strategy: ${name}`)
  }

  /**
   * Unregister a converter strategy
   */
  unregister(name: string): void {
    if (!name || name.trim() === "") {
      throw new Error("Strategy name must be a non-empty string")
    }

    if (this.strategies.delete(name)) {
      this.logger.debug(`Unregistered converter strategy: ${name}`)
    } else {
      this.logger.warn(`Attempted to unregister non-existent strategy: ${name}`)
    }
  }

  /**
   * Get a strategy by name
   */
  getStrategy(name: string): ConverterStrategy | undefined {
    if (!name || name.trim() === "") {
      this.logger.warn("Attempted to get strategy with empty name")
      return undefined
    }

    const strategy = this.strategies.get(name)
    if (!strategy) {
      this.logger.debug(`Strategy not found: ${name}`)
    }
    return strategy
  }

  /**
   * Get all registered strategies
   */
  getAllStrategies(): ConverterStrategy[] {
    return Array.from(this.strategies.values())
  }

  /**
   * Find a strategy that can handle the given content type
   */
  findStrategyForContentType(contentType: string): ConverterStrategy | undefined {
    if (!contentType || contentType.trim() === "") {
      this.logger.warn("Attempted to find strategy for empty content type")
      return undefined
    }

    // Normalize content type to lowercase for comparison
    const normalizedContentType = contentType.toLowerCase().trim()

    // Find first strategy that can handle the content type
    for (const strategy of this.strategies.values()) {
      if (strategy.canHandle(normalizedContentType)) {
        this.logger.debug(`Found strategy '${strategy.getName()}' for content type: ${contentType}`)
        return strategy
      }
    }

    this.logger.debug(`No strategy found for content type: ${contentType}`)
    return undefined
  }

  /**
   * Find all strategies that can handle the given content type
   */
  findStrategiesForContentType(contentType: string): ConverterStrategy[] {
    if (!contentType || contentType.trim() === "") {
      this.logger.warn("Attempted to find strategies for empty content type")
      return []
    }

    const normalizedContentType = contentType.toLowerCase().trim()
    const matchingStrategies: ConverterStrategy[] = []

    for (const strategy of this.strategies.values()) {
      if (strategy.canHandle(normalizedContentType)) {
        matchingStrategies.push(strategy)
      }
    }

    this.logger.debug(`Found ${matchingStrategies.length} strategies for content type: ${contentType}`)
    return matchingStrategies
  }

  /**
   * Get all supported content types across all strategies
   */
  getSupportedContentTypes(): string[] {
    const contentTypes = new Set<string>()

    for (const strategy of this.strategies.values()) {
      for (const contentType of strategy.getSupportedContentTypes()) {
        contentTypes.add(contentType.toLowerCase())
      }
    }

    return Array.from(contentTypes).sort()
  }

  /**
   * Get strategy count
   */
  getStrategyCount(): number {
    return this.strategies.size
  }

  /**
   * Check if a strategy is registered
   */
  hasStrategy(name: string): boolean {
    if (!name || name.trim() === "") {
      return false
    }
    return this.strategies.has(name)
  }

  /**
   * Clear all registered strategies
   */
  clear(): void {
    const count = this.strategies.size
    this.strategies.clear()
    this.logger.debug(`Cleared ${count} registered strategies`)
  }

  /**
   * Get strategy information for debugging
   */
  getRegistryInfo(): Array<{
    name: string
    supportedTypes: string[]
    outputFormat: string
  }> {
    return Array.from(this.strategies.values()).map(strategy => ({
      name: strategy.getName(),
      supportedTypes: strategy.getSupportedContentTypes(),
      outputFormat: strategy.getOutputFormat(),
    }))
  }
}
