/**
 * Multi-Source ConfigLoader Class
 *
 * The main ConfigLoader class supporting configuration discovery,
 * file loading, and multi-source integration with validation.
 */

import { promises as fs } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import process from "node:process"

import { getEnvironmentConfig } from "./defaults"
import { EnvironmentMapper } from "./env-mapper"
import type { ArrayMergeStrategy, ConfigSource } from "./merger"
import { ConfigMerger } from "./merger"
import type { Config } from "./schema"
import { createDefaultConfig, validateConfig } from "./schema"

/**
 * Configuration file discovery options
 */
export interface ConfigDiscoveryOptions {
  // Search paths
  searchPaths?: string[]
  // Configuration file names to look for
  configFileNames?: string[]
  // Whether to search in user home directory
  searchHomeDir?: boolean
  // Whether to search in project directories
  searchProjectRoot?: boolean
  // Maximum depth to search for config files
  maxDepth?: number
}

/**
 * ConfigLoader options
 */
export interface ConfigLoaderOptions {
  // Environment to use for defaults
  environment?: string
  // Whether to validate configuration during loading
  validate?: boolean
  // Custom configuration discovery options
  discovery?: ConfigDiscoveryOptions
  // Whether to use environment variables
  useEnvironment?: boolean
  // Environment variables prefix
  envPrefix?: string
  // Custom configuration sources to include
  additionalSources?: ConfigSource[]
  // Merge options
  mergeOptions?: {
    validateDuringMerge?: boolean
    arrayMergeStrategies?: Record<string, ArrayMergeStrategy>
  }
}

/**
 * Configuration loading result
 */
export interface ConfigLoadResult {
  config: Config
  sources: ConfigSource[]
  errors: string[]
  warnings: string[]
  metadata: {
    loadTime: number
    filesScanned: number
    filesLoaded: number
    environmentVariablesUsed: number
  }
}

/**
 * Configuration file format
 */
export interface ConfigFile {
  path: string
  format: "json" | "js" | "ts"
  content: Partial<Config>
}

/**
 * Main ConfigLoader class
 */
export class ConfigLoader {
  private options: Required<ConfigLoaderOptions>
  private envMapper: EnvironmentMapper

  constructor(options: ConfigLoaderOptions = {}) {
    this.options = {
      environment: options.environment || "production",
      validate: options.validate !== false,
      discovery: {
        searchPaths: [],
        configFileNames: [
          "html-converter.config.json",
          "html-converter.config.js",
          "html-converter.config.ts",
          ".html-converter.json",
          ".html-converter.js",
          ".html-converter.ts",
          ".html-converterrc",
          ".html-converterrc.json",
        ],
        searchHomeDir: true,
        searchProjectRoot: true,
        maxDepth: 3,
        ...options.discovery,
      },
      useEnvironment: options.useEnvironment !== false,
      envPrefix: options.envPrefix || "HTML_CONVERTER_",
      additionalSources: options.additionalSources || [],
      mergeOptions: {
        validateDuringMerge: options.validate !== false,
        arrayMergeStrategies: {},
        ...options.mergeOptions,
      },
    }

    this.envMapper = new EnvironmentMapper(this.options.envPrefix)
  }

  /**
   * Load configuration from all sources
   */
  async load(workingDirectory?: string): Promise<ConfigLoadResult> {
    const startTime = Date.now()
    const sources: ConfigSource[] = []
    const errors: string[] = []
    const warnings: string[] = []
    const metadata = {
      loadTime: 0,
      filesScanned: 0,
      filesLoaded: 0,
      environmentVariablesUsed: 0,
    }

    try {
      // 1. Load default configuration
      const defaultConfig = getEnvironmentConfig(this.options.environment)
      sources.push(ConfigMerger.createDefaultsSource(defaultConfig))

      // 2. Discover and load configuration files
      const configFiles = await this.discoverConfigFiles(workingDirectory)
      metadata.filesScanned = configFiles.scanned

      for (const configFile of configFiles.files) {
        try {
          const loadedFile = await this.loadConfigFile(configFile.path)
          sources.push(ConfigMerger.createFileSource(loadedFile.content, configFile.path))
          metadata.filesLoaded++
        } catch (error) {
          errors.push(`Failed to load config file ${configFile.path}: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }

      // 3. Load environment variables
      if (this.options.useEnvironment) {
        const envResult = this.envMapper.mapEnvironmentVariables()
        sources.push(ConfigMerger.createEnvironmentSource(envResult.config))
        metadata.environmentVariablesUsed = Object.keys(envResult.config).length

        errors.push(...envResult.errors.map(error => `Environment variable error: ${error.envVar} - ${error.message}`))
        warnings.push(...envResult.warnings)
      }

      // 4. Add additional sources
      sources.push(...this.options.additionalSources)

      // 5. Merge all configurations
      const merger = new ConfigMerger()
      sources.forEach(source => merger.addSource(source))

      const config = merger.merge(this.options.mergeOptions)

      // 6. Final validation if requested
      if (this.options.validate) {
        const validation = validateConfig(config)
        if (!validation.isValid) {
          errors.push(`Configuration validation failed: ${validation.errors.join(", ")}`)
        }
      }

      metadata.loadTime = Date.now() - startTime

      return {
        config,
        sources,
        errors,
        warnings,
        metadata,
      }
    } catch (error) {
      metadata.loadTime = Date.now() - startTime
      errors.push(`Configuration loading failed: ${error instanceof Error ? error.message : "Unknown error"}`)

      // Return default configuration on error
      return {
        config: createDefaultConfig(),
        sources: [ConfigMerger.createDefaultsSource(createDefaultConfig())],
        errors,
        warnings,
        metadata,
      }
    }
  }

  /**
   * Discover configuration files in various locations
   */
  private async discoverConfigFiles(workingDirectory?: string): Promise<{ files: ConfigFile[], scanned: number }> {
    const searchPaths = this.buildSearchPaths(workingDirectory)
    const foundFiles: ConfigFile[] = []
    let scanned = 0

    for (const searchPath of searchPaths) {
      try {
        const files = await this.searchDirectoryForConfigs(searchPath)
        foundFiles.push(...files)
        scanned += files.length
      } catch {
        // Continue searching other paths if one fails
        continue
      }
    }

    // Sort by priority (closer to working directory has higher priority)
    const workingDirPath = workingDirectory ? resolve(workingDirectory) : process.cwd()
    foundFiles.sort((a, b) => {
      const aDistance = this.getDirectoryDistance(a.path, workingDirPath)
      const bDistance = this.getDirectoryDistance(b.path, workingDirPath)
      return aDistance - bDistance
    })

    return { files: foundFiles, scanned }
  }

  /**
   * Build list of search paths for configuration files
   */
  private buildSearchPaths(workingDirectory?: string): string[] {
    const paths: string[] = []
    const cwd = workingDirectory ? resolve(workingDirectory) : process.cwd()

    // Add custom search paths
    if (this.options.discovery.searchPaths.length > 0) {
      paths.push(...this.options.discovery.searchPaths.map(path => resolve(cwd, path)))
    }

    // Add current working directory
    paths.push(cwd)

    // Add parent directories up to max depth
    if (this.options.discovery.searchProjectRoot) {
      let currentDir = cwd
      let depth = 0

      while (depth < this.options.discovery.maxDepth) {
        const parentDir = dirname(currentDir)
        if (parentDir === currentDir) {
          break
        } // Reached root

        paths.push(parentDir)
        currentDir = parentDir
        depth++
      }
    }

    // Add home directory
    if (this.options.discovery.searchHomeDir) {
      paths.push(homedir())
    }

    // Remove duplicates while preserving order
    return [...new Set(paths)]
  }

  /**
   * Search a directory for configuration files
   */
  private async searchDirectoryForConfigs(directory: string): Promise<ConfigFile[]> {
    const foundFiles: ConfigFile[] = []

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isFile()) {
          continue
        }

        const fileName = entry.name
        const filePath = join(directory, fileName)

        // Check if file matches any of our config file names
        const configFileName = this.options.discovery.configFileNames.find(name =>
          fileName === name || fileName.startsWith(name + "."),
        )

        if (configFileName) {
          const format = this.getFileFormat(fileName)
          foundFiles.push({
            path: filePath,
            format,
            content: {}, // Will be loaded later
          })
        }
      }
    } catch {
      // Directory might not exist or be inaccessible
      return []
    }

    return foundFiles
  }

  /**
   * Get file format from filename
   */
  private getFileFormat(filename: string): "json" | "js" | "ts" {
    if (filename.endsWith(".json")) {
      return "json"
    }
    if (filename.endsWith(".ts")) {
      return "ts"
    }
    if (filename.endsWith(".js")) {
      return "js"
    }
    return "json" // Default to JSON for files without extension
  }

  /**
   * Load a configuration file
   */
  private async loadConfigFile(filePath: string): Promise<ConfigFile> {
    const format = this.getFileFormat(filePath)
    let content: Partial<Config>

    switch (format) {
      case "json":
        content = await this.loadJSONConfig(filePath)
        break
      case "js":
        content = await this.loadJSConfig(filePath)
        break
      case "ts":
        content = await this.loadTSConfig(filePath)
        break
      default:
        throw new Error(`Unsupported configuration file format: ${format}`)
    }

    return {
      path: filePath,
      format,
      content,
    }
  }

  /**
   * Load JSON configuration file
   */
  private async loadJSONConfig(filePath: string): Promise<Partial<Config>> {
    const fileContent = await fs.readFile(filePath, "utf-8")

    try {
      return JSON.parse(fileContent)
    } catch (error) {
      throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Load JavaScript configuration file
   */
  private async loadJSConfig(filePath: string): Promise<Partial<Config>> {
    try {
      // Dynamic import of the configuration module
      const module = await import(filePath)
      return module.default || module
    } catch (error) {
      throw new Error(`Failed to load JS config from ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Load TypeScript configuration file
   */
  private async loadTSConfig(filePath: string): Promise<Partial<Config>> {
    try {
      // For TS files, we would typically use a transpiler
      // For now, we'll try to import it directly (requires ts-node or similar)
      const module = await import(filePath)
      return module.default || module
    } catch (error) {
      throw new Error(`Failed to load TS config from ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Calculate directory distance between two paths
   */
  private getDirectoryDistance(path1: string, path2: string): number {
    const normalized1 = resolve(path1)
    const normalized2 = resolve(path2)

    if (normalized1 === normalized2) {
      return 0
    }

    const parts1 = normalized1.split("/")
    const parts2 = normalized2.split("/")

    // Find common prefix
    let commonLength = 0
    const minLength = Math.min(parts1.length, parts2.length)

    for (let i = 0; i < minLength; i++) {
      if (parts1[i] === parts2[i]) {
        commonLength++
      } else {
        break
      }
    }

    // Distance is the sum of remaining parts in both paths
    return (parts1.length - commonLength) + (parts2.length - commonLength)
  }

  /**
   * Reload configuration (useful for watching config files)
   */
  async reload(workingDirectory?: string): Promise<ConfigLoadResult> {
    return this.load(workingDirectory)
  }

  /**
   * Get configuration files that would be loaded
   */
  async getConfigFiles(workingDirectory?: string): Promise<string[]> {
    const configFiles = await this.discoverConfigFiles(workingDirectory)
    return configFiles.files.map(file => file.path)
  }

  /**
   * Validate configuration files without loading them
   */
  async validateConfigFiles(workingDirectory?: string): Promise<{
    valid: boolean
    errors: Array<{ file: string, error: string }>
  }> {
    const configFiles = await this.discoverConfigFiles(workingDirectory)
    const errors: Array<{ file: string, error: string }> = []

    for (const configFile of configFiles.files) {
      try {
        const loadedFile = await this.loadConfigFile(configFile.path)
        const validation = validateConfig(loadedFile.content)

        if (!validation.isValid) {
          validation.errors.forEach((error) => {
            errors.push({
              file: configFile.path,
              error,
            })
          })
        }
      } catch (error) {
        errors.push({
          file: configFile.path,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Generate configuration template
   */
  generateTemplate(format: "json" | "js" = "json"): string {
    const defaultConfig = createDefaultConfig()

    switch (format) {
      case "json":
        return JSON.stringify(defaultConfig, null, 2)

      case "js":
        return `// HTML Converter Configuration
module.exports = ${JSON.stringify(defaultConfig, null, 2)};`

      default:
        return JSON.stringify(defaultConfig, null, 2)
    }
  }
}

/**
 * Convenience function to load configuration
 */
export async function loadConfig(options?: ConfigLoaderOptions, workingDirectory?: string): Promise<ConfigLoadResult> {
  const loader = new ConfigLoader(options)
  return loader.load(workingDirectory)
}

/**
 * Convenience function to load just the configuration object
 */
export async function loadConfigOnly(options?: ConfigLoaderOptions, workingDirectory?: string): Promise<Config> {
  const result = await loadConfig(options, workingDirectory)
  return result.config
}

/**
 * Create a config loader with default options
 */
export function createConfigLoader(options?: ConfigLoaderOptions): ConfigLoader {
  return new ConfigLoader(options)
}
