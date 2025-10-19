/**
 * Configuration Merger with Priority System
 *
 * Implements deep merge algorithm for configuration objects with
 * priority-based merging and array handling strategies.
 */

import type { Config } from "./schema"
import { validateConfig } from "./schema"

/**
 * Priority levels for configuration sources
 */
export enum ConfigPriority {
  DEFAULTS = 0, // Lowest priority
  CONFIG_FILE = 1, // Configuration files
  ENVIRONMENT = 2, // Environment variables
  CLI_OPTIONS = 3, // Command line options (highest priority)
}

/**
 * Array merge strategies
 */
export enum ArrayMergeStrategy {
  REPLACE = "replace", // Replace entire array
  MERGE = "merge", // Merge arrays (deduplicate)
  APPEND = "append", // Append to existing array
  PREPEND = "prepend", // Prepend to existing array
}

/**
 * Configuration source with metadata
 */
export interface ConfigSource {
  config: Partial<Config>
  priority: ConfigPriority
  name: string
  arrayMergeStrategy?: ArrayMergeStrategy
}

/**
 * Merge options for advanced configuration merging
 */
export interface MergeOptions {
  // Validation during merge
  validateDuringMerge?: boolean
  // Custom array merge strategies by path
  arrayMergeStrategies?: Record<string, ArrayMergeStrategy>
  // Whether to deep merge or shallow merge
  deep?: boolean
  // Whether to preserve undefined values
  preserveUndefined?: boolean
}

/**
 * Configuration merger class
 */
export class ConfigMerger {
  private sources: ConfigSource[] = []

  /**
   * Add a configuration source
   */
  addSource(source: ConfigSource): void {
    this.sources.push(source)
    // Sort sources by priority (highest first)
    this.sources.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Add multiple configuration sources
   */
  addSources(sources: ConfigSource[]): void {
    sources.forEach(source => this.addSource(source))
  }

  /**
   * Clear all sources
   */
  clearSources(): void {
    this.sources = []
  }

  /**
   * Get all sources
   */
  getSources(): ConfigSource[] {
    return [...this.sources]
  }

  /**
   * Merge all configuration sources
   */
  merge(options: MergeOptions = {}): Config {
    const {
      validateDuringMerge = true,
      arrayMergeStrategies = {},
      deep = true,
      preserveUndefined = false,
    } = options

    // Start with empty configuration
    let mergedConfig: Partial<Config> = {}

    // Process sources in priority order (highest to lowest)
    for (const source of this.sources) {
      try {
        if (validateDuringMerge) {
          const validation = validateConfig(source.config)
          if (!validation.isValid) {
            throw new Error(`Invalid configuration from ${source.name}: ${validation.errors.join(", ")}`)
          }
        }

        mergedConfig = deep
          ? this.mergeDeep(mergedConfig, source.config, {
              arrayMergeStrategy: source.arrayMergeStrategy,
              customStrategies: arrayMergeStrategies,
              preserveUndefined,
            })
          : this.mergeShallow(mergedConfig, source.config, preserveUndefined)
      } catch (error) {
        throw new Error(`Failed to merge configuration from ${source.name}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    // Final validation
    if (validateDuringMerge) {
      const validation = validateConfig(mergedConfig)
      if (!validation.isValid) {
        throw new Error(`Invalid merged configuration: ${validation.errors.join(", ")}`)
      }
      return validation.config!
    }

    return mergedConfig as Config
  }

  /**
   * Deep merge two objects with array handling strategies
   */
  private mergeDeep<T extends Record<string, any>>(
    target: T,
    source: Partial<T>,
    options: {
      arrayMergeStrategy?: ArrayMergeStrategy
      customStrategies?: Record<string, ArrayMergeStrategy>
      preserveUndefined?: boolean
      path?: string
    } = {},
  ): T {
    const {
      arrayMergeStrategy = ArrayMergeStrategy.REPLACE,
      customStrategies = {},
      preserveUndefined = false,
      path = "",
    } = options

    const result = { ...target }

    for (const key in source) {
      if (source[key] === undefined && !preserveUndefined) {
        continue
      }

      const currentPath = path ? `${path}.${key}` : key
      const sourceValue = source[key]
      const targetValue = result[key]

      if (Array.isArray(sourceValue)) {
        // Handle array merging based on strategy
        const strategy = customStrategies[currentPath] || arrayMergeStrategy
        result[key] = this.mergeArrays(targetValue, sourceValue, strategy)
      } else if (
        sourceValue !== null
        && typeof sourceValue === "object"
        && !Array.isArray(sourceValue)
        && targetValue !== null
        && typeof targetValue === "object"
        && !Array.isArray(targetValue)
      ) {
        // Recursively merge objects
        result[key] = this.mergeDeep(targetValue, sourceValue, {
          ...options,
          path: currentPath,
        })
      } else {
        // Replace primitive values or incompatible types
        result[key] = sourceValue
      }
    }

    return result
  }

  /**
   * Shallow merge two objects
   */
  private mergeShallow<T extends Record<string, any>>(
    target: T,
    source: Partial<T>,
    preserveUndefined: boolean = false,
  ): T {
    const result = { ...target }

    for (const key in source) {
      if (source[key] === undefined && !preserveUndefined) {
        continue
      }
      result[key] = source[key] as any
    }

    return result
  }

  /**
   * Merge arrays based on strategy
   */
  private mergeArrays<T>(target: T[] | undefined, source: T[], strategy: ArrayMergeStrategy): T[] {
    if (!target || !Array.isArray(target)) {
      return [...source]
    }

    switch (strategy) {
      case ArrayMergeStrategy.REPLACE:
        return [...source]

      case ArrayMergeStrategy.MERGE: {
        // Merge with deduplication
        const merged = [...target]
        for (const item of source) {
          if (!merged.includes(item)) {
            merged.push(item)
          }
        }
        return merged
      }

      case ArrayMergeStrategy.APPEND:
        return [...target, ...source]

      case ArrayMergeStrategy.PREPEND:
        return [...source, ...target]

      default:
        return [...source]
    }
  }

  /**
   * Create a configuration source with defaults
   */
  static createDefaultsSource(config: Partial<Config>): ConfigSource {
    return {
      config,
      priority: ConfigPriority.DEFAULTS,
      name: "defaults",
      arrayMergeStrategy: ArrayMergeStrategy.MERGE,
    }
  }

  /**
   * Create a configuration source from file
   */
  static createFileSource(config: Partial<Config>, filename: string): ConfigSource {
    return {
      config,
      priority: ConfigPriority.CONFIG_FILE,
      name: `file:${filename}`,
      arrayMergeStrategy: ArrayMergeStrategy.REPLACE,
    }
  }

  /**
   * Create a configuration source from environment variables
   */
  static createEnvironmentSource(config: Partial<Config>): ConfigSource {
    return {
      config,
      priority: ConfigPriority.ENVIRONMENT,
      name: "environment",
      arrayMergeStrategy: ArrayMergeStrategy.REPLACE,
    }
  }

  /**
   * Create a configuration source from CLI options
   */
  static createCLISource(config: Partial<Config>): ConfigSource {
    return {
      config,
      priority: ConfigPriority.CLI_OPTIONS,
      name: "cli",
      arrayMergeStrategy: ArrayMergeStrategy.REPLACE,
    }
  }
}

/**
 * Convenience function to merge configurations
 */
export function mergeConfigs(configs: Partial<Config>[], options: MergeOptions = {}): Config {
  const merger = new ConfigMerger()

  // Add sources in order of priority (assuming they're already in priority order)
  configs.forEach((config, index) => {
    const priority = ConfigPriority.DEFAULTS + (configs.length - index - 1)
    merger.addSource({
      config,
      priority,
      name: `config-${index}`,
    })
  })

  return merger.merge(options)
}

/**
 * Merge configurations with explicit priority
 */
export function mergeConfigsWithPriority(
  defaults: Partial<Config>,
  fileConfig: Partial<Config>,
  envConfig: Partial<Config>,
  cliConfig: Partial<Config>,
  options: MergeOptions = {},
): Config {
  const merger = new ConfigMerger()

  // Add sources in priority order
  merger.addSources([
    ConfigMerger.createDefaultsSource(defaults),
    ConfigMerger.createFileSource(fileConfig, "config"),
    ConfigMerger.createEnvironmentSource(envConfig),
    ConfigMerger.createCLISource(cliConfig),
  ])

  return merger.merge(options)
}

/**
 * Deep merge utility for any objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const merger = new ConfigMerger()
  return merger.mergeDeep(target, source)
}

/**
 * Configuration conflict detection
 */
export interface ConfigConflict {
  path: string
  source1: string
  source2: string
  value1: any
  value2: any
  priority1: ConfigPriority
  priority2: ConfigPriority
}

export class ConflictDetector {
  /**
   * Detect conflicts between configuration sources
   */
  static detectConflicts(sources: ConfigSource[]): ConfigConflict[] {
    const conflicts: ConfigConflict[] = []
    const paths = new Set<string>()

    // Collect all paths from all sources
    for (const source of sources) {
      this.collectPaths(source.config, "", paths)
    }

    // Check each path for conflicts
    for (const path of paths) {
      const values = sources.map(source => ({
        source: source.name,
        priority: source.priority,
        value: this.getValueAtPath(source.config, path),
      })).filter(item => item.value !== undefined)

      if (values.length > 1) {
        // Check if values are different
        const firstValue = values[0].value
        const hasConflict = values.slice(1).some(item => !this.deepEqual(item.value, firstValue))

        if (hasConflict) {
          conflicts.push({
            path,
            source1: values[0].source,
            source2: values[1].source,
            value1: values[0].value,
            value2: values[1].value,
            priority1: values[0].priority,
            priority2: values[1].priority,
          })
        }
      }
    }

    return conflicts
  }

  /**
   * Collect all paths from an object
   */
  private static collectPaths(obj: any, prefix: string, paths: Set<string>): void {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const key in obj) {
        const path = prefix ? `${prefix}.${key}` : key
        paths.add(path)
        this.collectPaths(obj[key], path, paths)
      }
    }
  }

  /**
   * Get value at a path in an object
   */
  private static getValueAtPath(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj)
  }

  /**
   * Deep compare two values
   */
  private static deepEqual(a: any, b: any): boolean {
    if (a === b) {
      return true
    }
    if (a == null || b == null) {
      return false
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((val, index) => this.deepEqual(val, b[index]))
    }
    if (typeof a === "object" && typeof b === "object") {
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)
      return keysA.length === keysB.length && keysA.every(key => this.deepEqual(a[key], b[key]))
    }
    return false
  }
}

/**
 * Configuration inheritance helper
 */
export class ConfigInheritance {
  /**
   * Apply inheritance rules to a configuration
   */
  static applyInheritance(config: Config): Config {
    const result = { ...config }

    // Inherit base settings to format-specific configs if not specified
    this.inheritBaseSettings(result)

    // Apply format-specific inheritance rules
    this.applyFormatInheritance(result)

    return result
  }

  /**
   * Inherit base settings to format-specific configurations
   */
  private static inheritBaseSettings(config: Config): void {
    const { base } = config

    // Inherit timeout to format-specific configs if they don't have their own
    if (base.timeout) {
      // Format-specific timeout handling would be implemented here
      // This is a placeholder for the concept
    }

    // Inherit verbosity settings
    if (base.verbose !== undefined) {
      // Apply verbose setting to format-specific configs
    }
  }

  /**
   * Apply format-specific inheritance rules
   */
  private static applyFormatInheritance(config: Config): void {
    // PDF inherits from image settings for some common properties
    if (config.image && config.pdf) {
      // Inherit viewport settings if PDF doesn't specify custom layout
      if (config.pdf.layout === "standard") {
        // PDF could use image viewport for consistent sizing
      }
    }

    // Markdown and DOCX share some text processing settings
    if (config.markdown && config.docx) {
      // Inherit text processing preferences
    }
  }
}
