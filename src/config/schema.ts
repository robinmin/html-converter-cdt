/**
 * Configuration Schema and Type Definitions
 *
 * Provides comprehensive JSON schema validation and TypeScript types
 * for the HTML converter configuration system.
 */

import { z } from "zod"

/**
 * Base configuration options that apply to all conversion formats
 */
export const BaseConfigSchema = z.object({
  // Core conversion settings
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(1000).max(300000).default(30000),
  verbose: z.boolean().default(false),

  // Chrome/Chromium settings
  chromePath: z.string().optional(),
  chromeArgs: z.array(z.string()).default([]),
  headless: z.boolean().default(true),

  // Security settings
  enableSandbox: z.boolean().default(true),
  allowInsecureConnections: z.boolean().default(false),

  // Performance settings
  concurrency: z.number().int().min(1).max(10).default(3),
  memoryLimit: z.number().int().min(128).max(2048).default(512), // MB
})

/**
 * PDF-specific configuration options
 */
export const PDFConfigSchema = z.object({
  layout: z.enum(["standard", "single-page"]).default("standard"),
  pageSize: z.enum(["A4", "A3", "A5", "Letter", "Legal", "Tabloid"]).default("A4"),
  margins: z.object({
    top: z.string().default("1cm"),
    right: z.string().default("1cm"),
    bottom: z.string().default("1cm"),
    left: z.string().default("1cm"),
  }).default({
    top: "1cm",
    right: "1cm",
    bottom: "1cm",
    left: "1cm",
  }),
  scale: z.number().min(0.1).max(3.0).default(1.0),
  printBackground: z.boolean().default(true),
  displayHeaderFooter: z.boolean().default(false),
  headerTemplate: z.string().default("<div></div>"),
  footerTemplate: z.string().default("<div></div>"),
  preferCSSPageSize: z.boolean().default(false),
  generateTaggedPDF: z.boolean().default(false),
})

/**
 * Image-specific configuration options
 */
export const ImageConfigSchema = z.object({
  format: z.enum(["png", "jpeg", "webp"]).default("png"),
  quality: z.number().int().min(1).max(100).default(80),
  layout: z.enum(["standard", "single-page"]).default("standard"),
  viewport: z.object({
    width: z.number().int().min(100).max(4000).default(1920),
    height: z.number().int().min(100).max(4000).default(1080),
    deviceScaleFactor: z.number().min(0.5).max(4.0).default(1.0),
  }).default({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1.0,
  }),
  clip: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
  omitBackground: z.boolean().default(false),
  captureBeyondViewport: z.boolean().default(false),
})

/**
 * Markdown-specific configuration options
 */
export const MarkdownConfigSchema = z.object({
  flavor: z.enum(["gfm", "commonmark", "original"]).default("gfm"),
  embedImages: z.boolean().default(true),
  headingStyle: z.enum(["atx", "setext"]).default("atx"),
  bulletMarker: z.enum(["-", "*", "+"]).default("-"),
  codeBlockStyle: z.enum(["fenced", "indented"]).default("fenced"),
  fence: z.string().default("```"),
  emDelimiter: z.string().default("*"),
  strongDelimiter: z.string().default("**"),
  linkStyle: z.enum(["inlined", "referenced"]).default("inlined"),
  imageAssetPath: z.string().default("./assets"),
  preserveWhitespace: z.boolean().default(false),
  strikethrough: z.boolean().default(true),
  tables: z.boolean().default(true),
  tasklists: z.boolean().default(true),
})

/**
 * DOCX-specific configuration options
 */
export const DOCXConfigSchema = z.object({
  preserveStyle: z.boolean().default(true),
  fontFamily: z.string().default("Arial"),
  fontSize: z.number().int().min(8).max(72).default(12),
  pageLayout: z.object({
    size: z.enum(["A4", "A3", "A5", "Letter", "Legal"]).default("A4"),
    orientation: z.enum(["portrait", "landscape"]).default("portrait"),
    margins: z.object({
      top: z.number().default(1.0), // inches
      right: z.number().default(1.0),
      bottom: z.number().default(1.0),
      left: z.number().default(1.0),
    }).default({
      top: 1.0,
      right: 1.0,
      bottom: 1.0,
      left: 1.0,
    }),
  }).default({
    size: "A4",
    orientation: "portrait",
    margins: {
      top: 1.0,
      right: 1.0,
      bottom: 1.0,
      left: 1.0,
    },
  }),
  lineSpacing: z.number().min(1.0).max(3.0).default(1.15),
  paragraphSpacing: z.number().min(0).max(72).default(6),
  embedImages: z.boolean().default(true),
  convertTables: z.boolean().default(true),
  convertLists: z.boolean().default(true),
  preserveLinks: z.boolean().default(true),
})

/**
 * MHTML-specific configuration options
 */
export const MHTMLConfigSchema = z.object({
  preserveOriginal: z.boolean().default(true),
  compressResources: z.boolean().default(false),
  includeMetadata: z.boolean().default(true),
  encoding: z.enum(["utf-8", "base64", "quoted-printable"]).default("utf-8"),
  boundaryPrefix: z.string().default("----=_NextPart_"),
  maxResourceSize: z.number().int().min(1024).max(10485760).default(1048576), // 1MB
  timeoutPerResource: z.number().int().min(1000).max(60000).default(10000),
})

/**
 * Main configuration schema combining all format-specific options
 */
export const ConfigSchema = z.object({
  // Base configuration
  base: BaseConfigSchema.default({}),

  // Format-specific configurations
  pdf: PDFConfigSchema.default({}),
  image: ImageConfigSchema.default({}),
  markdown: MarkdownConfigSchema.default({}),
  docx: DOCXConfigSchema.default({}),
  mhtml: MHTMLConfigSchema.default({}),

  // Global settings
  defaultFormat: z.enum(["pdf", "image", "markdown", "docx", "mhtml"]).default("pdf"),
  outputPath: z.string().optional(),
  outputFilename: z.string().optional(),

  // Advanced settings
  experimental: z.boolean().default(false),
  debugMode: z.boolean().default(false),
  logLevel: z.enum(["error", "warn", "info", "debug", "trace"]).default("info"),
})

// Export TypeScript types derived from schemas
export type BaseConfig = z.infer<typeof BaseConfigSchema>
export type PDFConfig = z.infer<typeof PDFConfigSchema>
export type ImageConfig = z.infer<typeof ImageConfigSchema>
export type MarkdownConfig = z.infer<typeof MarkdownConfigSchema>
export type DOCXConfig = z.infer<typeof DOCXConfigSchema>
export type MHTMLConfig = z.infer<typeof MHTMLConfigSchema>
export type Config = z.infer<typeof ConfigSchema>

/**
 * JSON Schema for validation
 */
export const ConfigJSONSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  title: "HTML Converter Configuration",
  description: "Configuration schema for HTML to various formats converter",

  properties: {
    base: {
      type: "object",
      description: "Base configuration settings",
      properties: {
        maxRetries: {
          type: "integer",
          minimum: 0,
          maximum: 10,
          default: 3,
          description: "Maximum number of retry attempts for failed conversions",
        },
        timeout: {
          type: "integer",
          minimum: 1000,
          maximum: 300000,
          default: 30000,
          description: "Timeout in milliseconds for conversion operations",
        },
        verbose: {
          type: "boolean",
          default: false,
          description: "Enable verbose logging output",
        },
        chromePath: {
          type: "string",
          description: "Path to Chrome/Chromium executable",
        },
        chromeArgs: {
          type: "array",
          items: { type: "string" },
          default: [],
          description: "Additional command line arguments for Chrome",
        },
        headless: {
          type: "boolean",
          default: true,
          description: "Run Chrome in headless mode",
        },
        enableSandbox: {
          type: "boolean",
          default: true,
          description: "Enable Chrome sandboxing for security",
        },
        allowInsecureConnections: {
          type: "boolean",
          default: false,
          description: "Allow connections to insecure HTTPS sites",
        },
        concurrency: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          default: 3,
          description: "Maximum number of concurrent conversions",
        },
        memoryLimit: {
          type: "integer",
          minimum: 128,
          maximum: 2048,
          default: 512,
          description: "Memory limit in MB for conversion processes",
        },
      },
    },

    pdf: {
      type: "object",
      description: "PDF conversion settings",
      properties: {
        layout: { enum: ["standard", "single-page"], default: "standard" },
        pageSize: { enum: ["A4", "A3", "A5", "Letter", "Legal", "Tabloid"], default: "A4" },
        scale: { type: "number", minimum: 0.1, maximum: 3.0, default: 1.0 },
        printBackground: { type: "boolean", default: true },
        displayHeaderFooter: { type: "boolean", default: false },
        headerTemplate: { type: "string", default: "<div></div>" },
        footerTemplate: { type: "string", default: "<div></div>" },
        preferCSSPageSize: { type: "boolean", default: false },
        generateTaggedPDF: { type: "boolean", default: false },
        margins: {
          type: "object",
          properties: {
            top: { type: "string", default: "1cm" },
            right: { type: "string", default: "1cm" },
            bottom: { type: "string", default: "1cm" },
            left: { type: "string", default: "1cm" },
          },
          default: {
            top: "1cm",
            right: "1cm",
            bottom: "1cm",
            left: "1cm",
          },
        },
      },
    },

    image: {
      type: "object",
      description: "Image conversion settings",
      properties: {
        format: { enum: ["png", "jpeg", "webp"], default: "png" },
        quality: { type: "integer", minimum: 1, maximum: 100, default: 80 },
        layout: { enum: ["standard", "single-page"], default: "standard" },
        omitBackground: { type: "boolean", default: false },
        captureBeyondViewport: { type: "boolean", default: false },
        viewport: {
          type: "object",
          properties: {
            width: { type: "integer", minimum: 100, maximum: 4000, default: 1920 },
            height: { type: "integer", minimum: 100, maximum: 4000, default: 1080 },
            deviceScaleFactor: { type: "number", minimum: 0.5, maximum: 4.0, default: 1.0 },
          },
          default: {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1.0,
          },
        },
      },
    },

    markdown: {
      type: "object",
      description: "Markdown conversion settings",
      properties: {
        flavor: { enum: ["gfm", "commonmark", "original"], default: "gfm" },
        embedImages: { type: "boolean", default: true },
        headingStyle: { enum: ["atx", "setext"], default: "atx" },
        bulletMarker: { enum: ["-", "*", "+"], default: "-" },
        codeBlockStyle: { enum: ["fenced", "indented"], default: "fenced" },
        fence: { type: "string", default: "```" },
        emDelimiter: { type: "string", default: "*" },
        strongDelimiter: { type: "string", default: "**" },
        linkStyle: { enum: ["inlined", "referenced"], default: "inlined" },
        imageAssetPath: { type: "string", default: "./assets" },
        preserveWhitespace: { type: "boolean", default: false },
        strikethrough: { type: "boolean", default: true },
        tables: { type: "boolean", default: true },
        tasklists: { type: "boolean", default: true },
      },
    },

    docx: {
      type: "object",
      description: "DOCX conversion settings",
      properties: {
        preserveStyle: { type: "boolean", default: true },
        fontFamily: { type: "string", default: "Arial" },
        fontSize: { type: "integer", minimum: 8, maximum: 72, default: 12 },
        embedImages: { type: "boolean", default: true },
        convertTables: { type: "boolean", default: true },
        convertLists: { type: "boolean", default: true },
        preserveLinks: { type: "boolean", default: true },
        lineSpacing: { type: "number", minimum: 1.0, maximum: 3.0, default: 1.15 },
        paragraphSpacing: { type: "integer", minimum: 0, maximum: 72, default: 6 },
        pageLayout: {
          type: "object",
          properties: {
            size: { enum: ["A4", "A3", "A5", "Letter", "Legal"], default: "A4" },
            orientation: { enum: ["portrait", "landscape"], default: "portrait" },
            margins: {
              type: "object",
              properties: {
                top: { type: "number", default: 1.0 },
                right: { type: "number", default: 1.0 },
                bottom: { type: "number", default: 1.0 },
                left: { type: "number", default: 1.0 },
              },
              default: { top: 1.0, right: 1.0, bottom: 1.0, left: 1.0 },
            },
          },
          default: {
            size: "A4",
            orientation: "portrait",
            margins: { top: 1.0, right: 1.0, bottom: 1.0, left: 1.0 },
          },
        },
      },
    },

    mhtml: {
      type: "object",
      description: "MHTML conversion settings",
      properties: {
        preserveOriginal: { type: "boolean", default: true },
        compressResources: { type: "boolean", default: false },
        includeMetadata: { type: "boolean", default: true },
        encoding: { enum: ["utf-8", "base64", "quoted-printable"], default: "utf-8" },
        boundaryPrefix: { type: "string", default: "----=_NextPart_" },
        maxResourceSize: { type: "integer", minimum: 1024, maximum: 10485760, default: 1048576 },
        timeoutPerResource: { type: "integer", minimum: 1000, maximum: 60000, default: 10000 },
      },
    },

    defaultFormat: {
      enum: ["pdf", "image", "markdown", "docx", "mhtml"],
      default: "pdf",
      description: "Default output format when not specified",
    },

    outputPath: {
      type: "string",
      description: "Default output directory for converted files",
    },

    outputFilename: {
      type: "string",
      description: "Default filename pattern for converted files",
    },

    experimental: {
      type: "boolean",
      default: false,
      description: "Enable experimental features",
    },

    debugMode: {
      type: "boolean",
      default: false,
      description: "Enable debug mode for development",
    },

    logLevel: {
      enum: ["error", "warn", "info", "debug", "trace"],
      default: "info",
      description: "Logging level for output",
    },
  },

  additionalProperties: false,
}

/**
 * Custom validation functions for complex scenarios
 */

/**
 * Validates file paths to ensure they are properly formatted
 */
export function validateFilePath(path: string): boolean {
  if (typeof path !== "string" || path.trim() === "") {
    return false
  }

  // Check for invalid characters (Windows-specific)
  const invalidChars = /[<>:"|?*]/
  if (invalidChars.test(path)) {
    return false
  }

  // Check for path traversal attempts
  if (path.includes("..") || path.includes("~")) {
    return false
  }

  return true
}

/**
 * Validates URLs to ensure they are properly formatted
 */
export function validateURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ["http:", "https:", "file:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Validates Chrome executable path by checking if it exists and is executable
 */
export async function validateChromePath(path: string): Promise<boolean> {
  try {
    if (!validateFilePath(path)) {
      return false
    }

    // Check if file exists (basic check)
    const fs = await import("node:fs/promises")
    await fs.access(path, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Main schema validation function with detailed error messages
 */
export function validateConfig(config: unknown): {
  isValid: boolean
  errors: string[]
  config?: Config
} {
  const errors: string[] = []

  try {
    const result = ConfigSchema.safeParse(config)

    if (result.success) {
      // Perform additional custom validations
      const validatedConfig = result.data

      // Validate Chrome path if provided
      if (validatedConfig.base.chromePath && !validateFilePath(validatedConfig.base.chromePath)) {
        errors.push("Invalid Chrome path: path contains invalid characters or is malformed")
      }

      // Validate output path if provided
      if (validatedConfig.base.outputPath && !validateFilePath(validatedConfig.base.outputPath)) {
        errors.push("Invalid output path: path contains invalid characters or is malformed")
      }

      // Validate image asset path
      if (validatedConfig.markdown.imageAssetPath && !validateFilePath(validatedConfig.markdown.imageAssetPath)) {
        errors.push("Invalid image asset path: path contains invalid characters or is malformed")
      }

      return {
        isValid: errors.length === 0,
        errors,
        config: validatedConfig,
      }
    } else {
      // Extract Zod validation errors
      result.error.issues.forEach((issue) => {
        const path = issue.path.join(".")
        errors.push(`${path}: ${issue.message}`)
      })

      return {
        isValid: false,
        errors,
      }
    }
  } catch (error) {
    errors.push(`Unexpected validation error: ${error instanceof Error ? error.message : "Unknown error"}`)
    return {
      isValid: false,
      errors,
    }
  }
}

/**
 * Utility function to create a default valid configuration
 */
export function createDefaultConfig(): Config {
  return ConfigSchema.parse({})
}

/**
 * Utility function to validate individual format configurations
 */
export function validateFormatConfig<T>(
  format: "pdf" | "image" | "markdown" | "docx" | "mhtml",
  config: unknown,
  schema: z.ZodSchema<T>,
): { isValid: boolean, errors: string[], config?: T } {
  const errors: string[] = []

  try {
    const result = schema.safeParse(config)

    if (result.success) {
      return {
        isValid: true,
        errors: [],
        config: result.data,
      }
    } else {
      result.error.issues.forEach((issue) => {
        const path = issue.path.join(".")
        errors.push(`${format}.${path}: ${issue.message}`)
      })

      return {
        isValid: false,
        errors,
      }
    }
  } catch (error) {
    errors.push(`Unexpected ${format} validation error: ${error instanceof Error ? error.message : "Unknown error"}`)
    return {
      isValid: false,
      errors,
    }
  }
}
