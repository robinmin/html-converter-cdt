/**
 * CLI Options System
 *
 * Comprehensive CLI option definitions with format-specific options,
 * validation, type conversion, and help text generation.
 */

import chalk from "chalk"

import type { ConversionFormat } from "../api/index.js"
import type { Config, DOCXOptions, ImageOptions, MarkdownOptions, MHTMLOptions, PDFOptions } from "../config/schema.js"

/**
 * Parse output format from options or file extension
 */
export function parseOutputFormat(
  formatOption?: string,
  outputPath?: string,
  useStdout?: boolean,
): ConversionFormat {
  // Priority: explicit format option > file extension > default
  if (formatOption) {
    const format = formatOption.toLowerCase() as ConversionFormat
    if (isValidFormat(format)) {
      return format
    }
    throw new Error(`Invalid format: ${formatOption}. Valid formats: ${getValidFormats().join(", ")}`)
  }

  if (outputPath && !useStdout) {
    const extension = outputPath.split(".").pop()?.toLowerCase()
    if (extension) {
      const format = extensionToFormat(extension)
      if (format) {
        return format
      }
    }
    throw new Error(`Cannot determine format from output path: ${outputPath}. Use --format option.`)
  }

  if (useStdout) {
    return "pdf" // Default format for stdout
  }

  throw new Error("Cannot determine output format. Use --format option or provide output file with appropriate extension.")
}

/**
 * Build conversion options from CLI arguments and config
 */
export function buildConversionOptions(
  format: ConversionFormat,
  cliOptions: any,
  config: Config,
): any {
  const baseOptions = {
    timeout: Number.parseInt(cliOptions.timeout) || config.conversion.timeout || 30000,
    maxRetries: Number.parseInt(cliOptions.maxRetries) || config.conversion.maxRetries || 3,
    keepMhtml: cliOptions.keepMhtml || config.conversion.keepMhtml || false,
    mhtmlPath: cliOptions.mhtmlPath || config.conversion.mhtmlPath,
  }

  switch (format) {
    case "pdf":
      return buildPDFOptions(cliOptions, config.pdf || {}, baseOptions)
    case "png":
    case "jpeg":
      return buildImageOptions(format, cliOptions, config.image || {}, baseOptions)
    case "md":
      return buildMarkdownOptions(cliOptions, config.markdown || {}, baseOptions)
    case "docx":
      return buildDOCXOptions(cliOptions, config.docx || {}, baseOptions)
    case "mhtml":
      return buildMHTMLOptions(cliOptions, config.mhtml || {}, baseOptions)
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

/**
 * Build PDF-specific options
 */
function buildPDFOptions(cliOptions: any, config: PDFOptions, baseOptions: any): any {
  return {
    ...baseOptions,
    format: cliOptions.pageSize || config.format || "A4",
    landscape: cliOptions.landscape || config.landscape || false,
    printBackground: !cliOptions.noBackground && (config.printBackground !== false),
    scale: Number.parseFloat(cliOptions.scale) || config.scale || 1.0,
    margin: parseMargin(cliOptions.margin || config.margin || "20px"),
    pageRanges: cliOptions.pageRanges || config.pageRanges,
    headerTemplate: cliOptions.headerTemplate || config.headerTemplate,
    footerTemplate: cliOptions.footerTemplate || config.footerTemplate,
    preferCSSPageSize: cliOptions.preferCSSPageSize || config.preferCSSPageSize || false,
  }
}

/**
 * Build image-specific options
 */
function buildImageOptions(format: ConversionFormat, cliOptions: any, config: ImageOptions, baseOptions: any): any {
  const [width, height] = parseViewport(cliOptions.viewport || config.viewport || "1920x1080")

  return {
    ...baseOptions,
    quality: Math.min(100, Math.max(1, Number.parseInt(cliOptions.quality) || config.quality || 90)),
    type: format.toUpperCase() as "PNG" | "JPEG",
    omitBackground: cliOptions.omitBackground || config.omitBackground || false,
    clip: parseClip(cliOptions.clip || config.clip),
    viewport: { width, height },
    fullPage: cliOptions.fullPage || config.fullPage !== false,
  }
}

/**
 * Build markdown-specific options
 */
function buildMarkdownOptions(cliOptions: any, config: MarkdownOptions, baseOptions: any): any {
  return {
    ...baseOptions,
    flavor: cliOptions.flavor || config.flavor || "gfm",
    embedImages: !cliOptions.noEmbedImages && (config.embedImages !== false),
    imageAssetPath: cliOptions.imageAssetPath || config.imageAssetPath,
    preserveFormatting: cliOptions.preserveFormatting || config.preserveFormatting !== false,
    codeBlockStyle: cliOptions.codeBlockStyle || config.codeBlockStyle || "fenced",
    fence: cliOptions.fence || config.fence || "```",
  }
}

/**
 * Build DOCX-specific options
 */
function buildDOCXOptions(cliOptions: any, config: DOCXOptions, baseOptions: any): any {
  return {
    ...baseOptions,
    preserveStyle: cliOptions.preserveStyle || config.preserveStyle || false,
    fontFamily: cliOptions.fontFamily || config.fontFamily || "Arial",
    fontSize: Number.parseInt(cliOptions.fontSize) || config.fontSize || 11,
    orientation: cliOptions.orientation || config.orientation || "portrait",
    pageSize: cliOptions.pageSize || config.pageSize || "A4",
    margins: parseMargin(cliOptions.margins || config.margins || "20px"),
  }
}

/**
 * Build MHTML-specific options
 */
function buildMHTMLOptions(cliOptions: any, config: MHTMLOptions, baseOptions: any): any {
  return {
    ...baseOptions,
    embedResources: cliOptions.embedResources !== false && (config.embedResources !== false),
    maxResourceSize: cliOptions.maxResourceSize || config.maxResourceSize || 10 * 1024 * 1024, // 10MB
    timeout: cliOptions.resourceTimeout || config.resourceTimeout || 30000,
    userAgent: cliOptions.userAgent || config.userAgent,
    excludeExternalResources: cliOptions.excludeExternalResources || config.excludeExternalResources || false,
  }
}

/**
 * Parse margin value (e.g., "20px", "1cm")
 */
function parseMargin(margin: string): any {
  if (!margin) {
    return { top: "20px", right: "20px", bottom: "20px", left: "20px" }
  }

  const match = margin.match(/^(\d+(?:\.\d+)?)(px|cm|mm|in|pt)$/)
  if (!match) {
    throw new Error(`Invalid margin format: ${margin}. Use format like "20px", "1cm", etc.`)
  }

  const value = match[1]
  const unit = match[2]

  return {
    top: `${value}${unit}`,
    right: `${value}${unit}`,
    bottom: `${value}${unit}`,
    left: `${value}${unit}`,
  }
}

/**
 * Parse viewport size (e.g., "1920x1080")
 */
function parseViewport(viewport: string): [number, number] {
  const match = viewport.match(/^(\d+)x(\d+)$/)
  if (!match) {
    throw new Error(`Invalid viewport format: ${viewport}. Use format like "1920x1080".`)
  }

  const width = Number.parseInt(match[1])
  const height = Number.parseInt(match[2])

  if (width <= 0 || height <= 0) {
    throw new Error(`Viewport dimensions must be positive numbers.`)
  }

  return [width, height]
}

/**
 * Parse clip region (e.g., "10,20,300,400")
 */
function parseClip(clip?: string): any {
  if (!clip) {
    return undefined
  }

  const parts = clip.split(",").map(p => Number.parseInt(p.trim()))
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid clip format: ${clip}. Use format like "x,y,width,height".`)
  }

  const [x, y, width, height] = parts
  if (width <= 0 || height <= 0) {
    throw new Error(`Clip dimensions must be positive numbers.`)
  }

  return { x, y, width, height }
}

/**
 * Convert file extension to format
 */
function extensionToFormat(extension: string): ConversionFormat | null {
  const extensionMap: Record<string, ConversionFormat> = {
    pdf: "pdf",
    png: "png",
    jpg: "jpeg",
    jpeg: "jpeg",
    md: "md",
    markdown: "md",
    docx: "docx",
    mhtml: "mhtml",
    mht: "mhtml",
  }

  return extensionMap[extension] || null
}

/**
 * Check if format is valid
 */
function isValidFormat(format: string): format is ConversionFormat {
  return getValidFormats().includes(format as ConversionFormat)
}

/**
 * Get list of valid formats
 */
function getValidFormats(): ConversionFormat[] {
  return ["pdf", "png", "jpeg", "md", "docx", "mhtml"]
}

/**
 * Generate help text for format-specific options
 */
export function generateFormatHelp(format: ConversionFormat): string {
  const helps: Record<ConversionFormat, string> = {
    pdf: `
${chalk.cyan("PDF Options:")}
  --layout <mode>         Layout mode (standard, single-page) [default: standard]
  --page-size <size>      Page size (A4, Letter, Legal, etc.) [default: A4]
  --margin <value>        Margin (e.g., 20px, 1cm) [default: 20px]
  --scale <factor>        Scale factor (e.g., 0.9) [default: 1.0]
  --no-background         Disable background graphics
  --header-template <t>   Custom header template
  --footer-template <t>   Custom footer template`,

    png: `
${chalk.cyan("PNG Options:")}
  --quality <n>           Image quality (1-100) [default: 90]
  --viewport <WxH>        Viewport size (e.g., 1920x1080) [default: 1920x1080]
  --omit-background       Omit background
  --clip <x,y,w,h>        Clip region`,

    jpeg: `
${chalk.cyan("JPEG Options:")}
  --quality <n>           Image quality (1-100) [default: 90]
  --viewport <WxH>        Viewport size (e.g., 1920x1080) [default: 1920x1080]
  --clip <x,y,w,h>        Clip region`,

    md: `
${chalk.cyan("Markdown Options:")}
  --flavor <type>         Markdown flavor (gfm, commonmark) [default: gfm]
  --no-embed-images       Don't embed images as base64
  --image-asset-path <p>  Directory for saved images`,

    docx: `
${chalk.cyan("DOCX Options:")}
  --preserve-style        Preserve HTML styling
  --font-family <font>    Default font family [default: Arial]
  --font-size <size>      Default font size in points [default: 11]`,

    mhtml: `
${chalk.cyan("MHTML Options:")}
  --embed-resources       Embed external resources [default: true]
  --max-resource-size <n> Max resource size in bytes
  --exclude-external      Exclude external resources`,
  }

  return helps[format] || ""
}
