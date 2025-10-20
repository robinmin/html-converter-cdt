/**
 * Environment Variable Mapping System
 *
 * Creates environment variable mapping system with type conversion and
 * validation for HTML_CONVERTER_* variables.
 */

import process from "node:process"

import type { Config } from "./schema"
import { validateConfig } from "./schema"

/**
 * Environment variable mapping configuration
 */
export interface EnvMapping {
  envVar: string
  configPath: string
  type: "string" | "number" | "boolean" | "array" | "object"
  required?: boolean
  defaultValue?: any
  validator?: (value: any) => boolean
  transformer?: (value: any) => any
}

/**
 * Environment mapping error
 */
export interface EnvMappingError {
  envVar: string
  configPath: string
  message: string
  originalValue: string
}

/**
 * Environment mapping result
 */
export interface EnvMappingResult {
  config: Partial<Config>
  errors: EnvMappingError[]
  warnings: string[]
}

/**
 * Environment variable mapper class
 */
export class EnvironmentMapper {
  private mappings: EnvMapping[] = []
  private prefix: string

  constructor(prefix: string = "HTML_CONVERTER_") {
    this.prefix = prefix
    this.initializeDefaultMappings()
  }

  /**
   * Initialize default environment variable mappings
   */
  private initializeDefaultMappings(): void {
    // Base configuration mappings
    this.addMapping({
      envVar: "HTML_CONVERTER_MAX_RETRIES",
      configPath: "base.maxRetries",
      type: "number",
      defaultValue: 3,
      validator: (value: number) => value >= 0 && value <= 10,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_TIMEOUT",
      configPath: "base.timeout",
      type: "number",
      defaultValue: 30000,
      validator: (value: number) => value >= 1000 && value <= 300000,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_VERBOSE",
      configPath: "base.verbose",
      type: "boolean",
      defaultValue: false,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_CHROME_PATH",
      configPath: "base.chromePath",
      type: "string",
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_HEADLESS",
      configPath: "base.headless",
      type: "boolean",
      defaultValue: true,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_ENABLE_SANDBOX",
      configPath: "base.enableSandbox",
      type: "boolean",
      defaultValue: true,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_ALLOW_INSECURE",
      configPath: "base.allowInsecureConnections",
      type: "boolean",
      defaultValue: false,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_CONCURRENCY",
      configPath: "base.concurrency",
      type: "number",
      defaultValue: 3,
      validator: (value: number) => value >= 1 && value <= 10,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_MEMORY_LIMIT",
      configPath: "base.memoryLimit",
      type: "number",
      defaultValue: 512,
      validator: (value: number) => value >= 128 && value <= 2048,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_CHROME_ARGS",
      configPath: "base.chromeArgs",
      type: "array",
      transformer: (value: string) => value.split(",").map(arg => arg.trim()).filter(Boolean),
    })

    // PDF configuration mappings
    this.addMapping({
      envVar: "HTML_CONVERTER_PDF_LAYOUT",
      configPath: "pdf.layout",
      type: "string",
      defaultValue: "standard",
      validator: (value: string) => ["standard", "single-page"].includes(value),
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_PDF_PAGE_SIZE",
      configPath: "pdf.pageSize",
      type: "string",
      defaultValue: "A4",
      validator: (value: string) => ["A4", "A3", "A5", "Letter", "Legal", "Tabloid"].includes(value),
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_PDF_SCALE",
      configPath: "pdf.scale",
      type: "number",
      defaultValue: 1.0,
      validator: (value: number) => value >= 0.1 && value <= 3.0,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_PDF_PRINT_BACKGROUND",
      configPath: "pdf.printBackground",
      type: "boolean",
      defaultValue: true,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_PDF_MARGIN_TOP",
      configPath: "pdf.margins.top",
      type: "string",
      defaultValue: "1cm",
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_PDF_MARGIN_RIGHT",
      configPath: "pdf.margins.right",
      type: "string",
      defaultValue: "1cm",
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_PDF_MARGIN_BOTTOM",
      configPath: "pdf.margins.bottom",
      type: "string",
      defaultValue: "1cm",
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_PDF_MARGIN_LEFT",
      configPath: "pdf.margins.left",
      type: "string",
      defaultValue: "1cm",
    })

    // Image configuration mappings
    this.addMapping({
      envVar: "HTML_CONVERTER_IMAGE_FORMAT",
      configPath: "image.format",
      type: "string",
      defaultValue: "png",
      validator: (value: string) => ["png", "jpeg", "webp"].includes(value),
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_IMAGE_QUALITY",
      configPath: "image.quality",
      type: "number",
      defaultValue: 80,
      validator: (value: number) => value >= 1 && value <= 100,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_IMAGE_LAYOUT",
      configPath: "image.layout",
      type: "string",
      defaultValue: "standard",
      validator: (value: string) => ["standard", "single-page"].includes(value),
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_IMAGE_VIEWPORT_WIDTH",
      configPath: "image.viewport.width",
      type: "number",
      defaultValue: 1920,
      validator: (value: number) => value >= 100 && value <= 4000,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_IMAGE_VIEWPORT_HEIGHT",
      configPath: "image.viewport.height",
      type: "number",
      defaultValue: 1080,
      validator: (value: number) => value >= 100 && value <= 4000,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_IMAGE_VIEWPORT_SCALE",
      configPath: "image.viewport.deviceScaleFactor",
      type: "number",
      defaultValue: 1.0,
      validator: (value: number) => value >= 0.5 && value <= 4.0,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_IMAGE_OMIT_BACKGROUND",
      configPath: "image.omitBackground",
      type: "boolean",
      defaultValue: false,
    })

    // Markdown configuration mappings
    this.addMapping({
      envVar: "HTML_CONVERTER_MD_FLAVOR",
      configPath: "markdown.flavor",
      type: "string",
      defaultValue: "gfm",
      validator: (value: string) => ["gfm", "commonmark", "original"].includes(value),
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_MD_EMBED_IMAGES",
      configPath: "markdown.embedImages",
      type: "boolean",
      defaultValue: true,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_MD_HEADING_STYLE",
      configPath: "markdown.headingStyle",
      type: "string",
      defaultValue: "atx",
      validator: (value: string) => ["atx", "setext"].includes(value),
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_MD_BULLET_MARKER",
      configPath: "markdown.bulletMarker",
      type: "string",
      defaultValue: "-",
      validator: (value: string) => ["-", "*", "+"].includes(value),
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_MD_IMAGE_ASSET_PATH",
      configPath: "markdown.imageAssetPath",
      type: "string",
      defaultValue: "./assets",
    })

    // DOCX configuration mappings
    this.addMapping({
      envVar: "HTML_CONVERTER_DOCX_PRESERVE_STYLE",
      configPath: "docx.preserveStyle",
      type: "boolean",
      defaultValue: true,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_DOCX_FONT_FAMILY",
      configPath: "docx.fontFamily",
      type: "string",
      defaultValue: "Arial",
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_DOCX_FONT_SIZE",
      configPath: "docx.fontSize",
      type: "number",
      defaultValue: 12,
      validator: (value: number) => value >= 8 && value <= 72,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_DOCX_PAGE_SIZE",
      configPath: "docx.pageLayout.size",
      type: "string",
      defaultValue: "A4",
      validator: (value: string) => ["A4", "A3", "A5", "Letter", "Legal"].includes(value),
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_DOCX_ORIENTATION",
      configPath: "docx.pageLayout.orientation",
      type: "string",
      defaultValue: "portrait",
      validator: (value: string) => ["portrait", "landscape"].includes(value),
    })

    // MHTML configuration mappings
    this.addMapping({
      envVar: "HTML_CONVERTER_MHTML_PRESERVE_ORIGINAL",
      configPath: "mhtml.preserveOriginal",
      type: "boolean",
      defaultValue: true,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_MHTML_COMPRESS_RESOURCES",
      configPath: "mhtml.compressResources",
      type: "boolean",
      defaultValue: false,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_MHTML_ENCODING",
      configPath: "mhtml.encoding",
      type: "string",
      defaultValue: "utf-8",
      validator: (value: string) => ["utf-8", "base64", "quoted-printable"].includes(value),
    })

    // Global configuration mappings
    this.addMapping({
      envVar: "HTML_CONVERTER_DEFAULT_FORMAT",
      configPath: "defaultFormat",
      type: "string",
      defaultValue: "pdf",
      validator: (value: string) => ["pdf", "image", "markdown", "docx", "mhtml"].includes(value),
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_OUTPUT_PATH",
      configPath: "outputPath",
      type: "string",
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_OUTPUT_FILENAME",
      configPath: "outputFilename",
      type: "string",
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_EXPERIMENTAL",
      configPath: "experimental",
      type: "boolean",
      defaultValue: false,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_DEBUG",
      configPath: "debugMode",
      type: "boolean",
      defaultValue: false,
    })

    this.addMapping({
      envVar: "HTML_CONVERTER_LOG_LEVEL",
      configPath: "logLevel",
      type: "string",
      defaultValue: "info",
      validator: (value: string) => ["error", "warn", "info", "debug", "trace"].includes(value),
    })
  }

  /**
   * Add a custom environment variable mapping
   */
  addMapping(mapping: EnvMapping): void {
    this.mappings.push(mapping)
  }

  /**
   * Add multiple environment variable mappings
   */
  addMappings(mappings: EnvMapping[]): void {
    this.mappings.push(...mappings)
  }

  /**
   * Get all mappings
   */
  getMappings(): EnvMapping[] {
    return [...this.mappings]
  }

  /**
   * Map environment variables to configuration
   */
  mapEnvironmentVariables(env: NodeJS.ProcessEnv = process.env): EnvMappingResult {
    const config: Partial<Config> = {}
    const errors: EnvMappingError[] = []
    const warnings: string[] = []

    for (const mapping of this.mappings) {
      const envValue = env[mapping.envVar]

      if (envValue === undefined) {
        // Environment variable not set, use default value if available
        if (mapping.defaultValue !== undefined) {
          this.setNestedValue(config, mapping.configPath, mapping.defaultValue)
        } else if (mapping.required) {
          errors.push({
            envVar: mapping.envVar,
            configPath: mapping.configPath,
            message: "Required environment variable is not set",
            originalValue: "",
          })
        }
        continue
      }

      try {
        const convertedValue = this.convertValue(envValue, mapping)

        // Validate the converted value
        if (mapping.validator && !mapping.validator(convertedValue)) {
          errors.push({
            envVar: mapping.envVar,
            configPath: mapping.configPath,
            message: `Value validation failed: ${envValue}`,
            originalValue: envValue,
          })
          continue
        }

        // Apply custom transformer if provided
        const finalValue = mapping.transformer ? mapping.transformer(convertedValue) : convertedValue

        // Set the value in the configuration object
        this.setNestedValue(config, mapping.configPath, finalValue)
      } catch (error) {
        errors.push({
          envVar: mapping.envVar,
          configPath: mapping.configPath,
          message: error instanceof Error ? error.message : "Unknown conversion error",
          originalValue: envValue,
        })
      }
    }

    // Validate the resulting configuration
    if (Object.keys(config).length > 0) {
      const validation = validateConfig(config)
      if (!validation.isValid) {
        warnings.push(`Configuration validation warnings: ${validation.errors.join(", ")}`)
      }
    }

    return {
      config,
      errors,
      warnings,
    }
  }

  /**
   * Convert string environment variable value to specified type
   */
  private convertValue(value: string, mapping: EnvMapping): any {
    switch (mapping.type) {
      case "boolean":
        return this.convertToBoolean(value)
      case "number":
        return this.convertToNumber(value)
      case "array":
        return this.convertToArray(value)
      case "object":
        return this.convertToObject(value)
      case "string":
      default:
        return value
    }
  }

  /**
   * Convert string to boolean
   */
  private convertToBoolean(value: string): boolean {
    const lowerValue = value.toLowerCase().trim()

    if (["true", "1", "yes", "on", "enabled"].includes(lowerValue)) {
      return true
    }

    if (["false", "0", "no", "off", "disabled"].includes(lowerValue)) {
      return false
    }

    throw new Error(`Cannot convert "${value}" to boolean. Use true/false, 1/0, yes/no, on/off, or enabled/disabled.`)
  }

  /**
   * Convert string to number
   */
  private convertToNumber(value: string): number {
    const num = Number(value.trim())

    if (Number.isNaN(num)) {
      throw new TypeError(`Cannot convert "${value}" to number`)
    }

    return num
  }

  /**
   * Convert string to array
   */
  private convertToArray(value: string): string[] {
    return value.split(",").map(item => item.trim()).filter(Boolean)
  }

  /**
   * Convert string to object (JSON)
   */
  private convertToObject(value: string): any {
    try {
      return JSON.parse(value)
    } catch (error) {
      throw new Error(`Cannot convert "${value}" to JSON object: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split(".")
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!key) {
        continue
      }

      if (!(key in current) || current[key] === null || typeof current[key] !== "object") {
        current[key] = {}
      }

      current = current[key] as Record<string, any>
    }

    const lastKey = keys[keys.length - 1]
    if (lastKey) {
      current[lastKey] = value
    }
  }

  /**
   * Get environment variables that match the prefix
   */
  getEnvironmentVariables(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
    const result: Record<string, string> = {}

    for (const [key, value] of Object.entries(env)) {
      if (key.startsWith(this.prefix) && value !== undefined) {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Generate documentation for environment variables
   */
  generateDocumentation(): string {
    const lines: string[] = [
      "# Environment Variables",
      "",
      "The HTML converter supports configuration through environment variables with the `HTML_CONVERTER_` prefix.",
      "",
      "## Configuration Variables",
      "",
    ]

    const groupedMappings = this.groupMappingsByCategory()

    for (const [category, mappings] of Object.entries(groupedMappings)) {
      lines.push(`### ${category}`)
      lines.push("")

      for (const mapping of mappings) {
        lines.push(`#### ${mapping.envVar}`)
        lines.push("")
        lines.push(`**Configuration Path:** \`${mapping.configPath}\``)
        lines.push(`**Type:** ${mapping.type}`)

        if (mapping.required) {
          lines.push(`**Required:** Yes`)
        }

        if (mapping.defaultValue !== undefined) {
          lines.push(`**Default:** \`${JSON.stringify(mapping.defaultValue)}\``)
        }

        lines.push("")
      }
    }

    return lines.join("\n")
  }

  /**
   * Group mappings by category for documentation
   */
  private groupMappingsByCategory(): Record<string, EnvMapping[]> {
    const grouped: Record<string, EnvMapping[]> = {
      "Base Configuration": [],
      "PDF Configuration": [],
      "Image Configuration": [],
      "Markdown Configuration": [],
      "DOCX Configuration": [],
      "MHTML Configuration": [],
      "Global Configuration": [],
    }

    for (const mapping of this.mappings) {
      if (mapping.configPath.startsWith("base.")) {
        grouped["Base Configuration"]!.push(mapping)
      } else if (mapping.configPath.startsWith("pdf.")) {
        grouped["PDF Configuration"]!.push(mapping)
      } else if (mapping.configPath.startsWith("image.")) {
        grouped["Image Configuration"]!.push(mapping)
      } else if (mapping.configPath.startsWith("markdown.")) {
        grouped["Markdown Configuration"]!.push(mapping)
      } else if (mapping.configPath.startsWith("docx.")) {
        grouped["DOCX Configuration"]!.push(mapping)
      } else if (mapping.configPath.startsWith("mhtml.")) {
        grouped["MHTML Configuration"]!.push(mapping)
      } else {
        grouped["Global Configuration"]!.push(mapping)
      }
    }

    return grouped
  }
}

/**
 * Convenience function to map environment variables
 */
export function mapEnvironmentVariables(env: NodeJS.ProcessEnv = process.env): EnvMappingResult {
  const mapper = new EnvironmentMapper()
  return mapper.mapEnvironmentVariables(env)
}

/**
 * Create environment mapper with custom prefix
 */
export function createEnvironmentMapper(prefix: string): EnvironmentMapper {
  return new EnvironmentMapper(prefix)
}

/**
 * Validate environment variables against mappings
 */
export function validateEnvironmentVariables(env: NodeJS.ProcessEnv = process.env): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const mapper = new EnvironmentMapper()
  const result = mapper.mapEnvironmentVariables(env)

  return {
    isValid: result.errors.length === 0,
    errors: result.errors.map(error => `${error.envVar}: ${error.message}`),
    warnings: result.warnings,
  }
}
