/**
 * Output Formatting and Display Utilities
 *
 * Provides progress spinner management, colored console output,
 * file size formatting, metadata display, and error message styling.
 */

import process from "node:process"

import chalk from "chalk"
import type { Ora } from "ora"
import ora from "ora"

/**
 * Progress spinner management
 */
export class ProgressSpinner {
  private spinner: Ora

  constructor(text?: string) {
    this.spinner = ora(text || "Processing...")
  }

  start(text?: string): void {
    this.spinner.start(text)
  }

  succeed(text?: string): void {
    this.spinner.succeed(text)
  }

  fail(text?: string): void {
    this.spinner.fail(text)
  }

  warn(text?: string): void {
    this.spinner.warn(text)
  }

  info(text?: string): void {
    this.spinner.info(text)
  }

  update(text: string): void {
    this.spinner.text = text
  }

  stop(): void {
    this.spinner.stop()
  }
}

/**
 * Colored console output functions
 */
export function showSuccess(message: string): void {
  console.log(chalk.green("✓"), message)
}

export function showError(message: string): void {
  console.log(chalk.red("✗"), message)
}

export function showWarning(message: string): void {
  console.log(chalk.yellow("⚠"), message)
}

export function showInfo(message: string): void {
  console.log(chalk.blue("ℹ"), message)
}

export function showDebug(message: string): void {
  console.log(chalk.gray("🔍"), message)
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Format output buffer size
 */
export function formatOutput(bytes: number): string {
  return formatFileSize(bytes)
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }

  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

/**
 * Display conversion result summary
 */
export function showConversionSummary(result: {
  format: string
  outputPath: string
  duration: number
  fileSize: number
  metadata?: any
}): void {
  console.log(chalk.blue.bold("\n📊 Conversion Summary"))
  console.log(chalk.gray("─".repeat(40)))

  console.log(chalk.cyan("Format:"), result.format.toUpperCase())
  console.log(chalk.cyan("Output:"), result.outputPath)
  console.log(chalk.cyan("Size:"), formatFileSize(result.fileSize))
  console.log(chalk.cyan("Duration:"), formatDuration(result.duration))

  if (result.metadata) {
    console.log(chalk.cyan("Metadata:"))
    Object.entries(result.metadata).forEach(([key, value]) => {
      console.log(chalk.gray(`  ${key}:`), chalk.white(value))
    })
  }

  console.log(chalk.gray("─".repeat(40)))
  console.log(chalk.green("✓ Conversion completed successfully!"))
}

/**
 * Display error with context and suggestions
 */
export function showErrorWithContext(
  error: Error,
  context?: string,
  suggestions?: string[],
): void {
  console.log(chalk.red.bold("\n❌ Error:"), error.message)

  if (context) {
    console.log(chalk.yellow("\n📋 Context:"), context)
  }

  if (suggestions && suggestions.length > 0) {
    console.log(chalk.yellow("\n💡 Suggestions:"))
    suggestions.forEach((suggestion, index) => {
      console.log(chalk.yellow(`  ${index + 1}. ${suggestion}`))
    })
  }
}

/**
 * Display validation errors
 */
export function showValidationErrors(errors: string[]): void {
  console.log(chalk.red.bold("\n❌ Validation Errors:"))

  errors.forEach((error, index) => {
    console.log(chalk.red(`  ${index + 1}. ${error}`))
  })

  console.log(chalk.gray("\nPlease fix these issues and try again."))
}

/**
 * Display configuration preview
 */
export function showConfigurationPreview(config: any): void {
  console.log(chalk.blue.bold("\n⚙️  Configuration Preview"))
  console.log(chalk.gray("─".repeat(50)))

  Object.entries(config).forEach(([key, value]) => {
    if (typeof value === "object" && value !== null) {
      console.log(chalk.cyan(`${key}:`))
      Object.entries(value).forEach(([subKey, subValue]) => {
        console.log(chalk.gray(`  ${subKey}:`), chalk.white(subValue))
      })
    } else {
      console.log(chalk.cyan(`${key}:`), chalk.white(value))
    }
  })

  console.log(chalk.gray("─".repeat(50)))
}

/**
 * Display batch conversion progress
 */
export function showBatchProgress(
  current: number,
  total: number,
  currentItem?: string,
): void {
  const percentage = Math.round((current / total) * 100)
  const progressBar = "█".repeat(Math.floor(percentage / 5)) + "░".repeat(20 - Math.floor(percentage / 5))

  process.stdout.write(`\r${chalk.cyan("Progress:")} [${chalk.green(progressBar)}] ${percentage}% (${current}/${total})`)

  if (currentItem) {
    process.stdout.write(` ${chalk.gray("—")} ${chalk.white(currentItem)}`)
  }

  if (current === total) {
    process.stdout.write("\n")
  }
}

/**
 * Display available formats with descriptions
 */
export function showAvailableFormats(): void {
  console.log(chalk.blue.bold("\n📄 Available Formats:"))
  console.log(chalk.gray("─".repeat(30)))

  const formats = [
    { name: "PDF", ext: ".pdf", desc: "Portable Document Format" },
    { name: "PNG", ext: ".png", desc: "Portable Network Graphics" },
    { name: "JPEG", ext: ".jpg", desc: "Joint Photographic Experts Group" },
    { name: "Markdown", ext: ".md", desc: "Markdown markup language" },
    { name: "DOCX", ext: ".docx", desc: "Microsoft Word document" },
    { name: "MHTML", ext: ".mhtml", desc: "MIME HTML archive format" },
  ]

  formats.forEach((format) => {
    console.log(chalk.cyan(`  ${format.name.padEnd(10)} (${format.ext})`), chalk.gray(format.desc))
  })
}

/**
 * Display usage examples
 */
export function showUsageExamples(): void {
  console.log(chalk.blue.bold("\n💡 Usage Examples:"))
  console.log(chalk.gray("─".repeat(30)))

  const examples = [
    {
      cmd: "html-converter-cdt convert https://example.com output.pdf",
      desc: "Convert webpage to PDF",
    },
    {
      cmd: "html-converter-cdt convert input.html -f png --quality 95",
      desc: "Convert HTML file to PNG with high quality",
    },
    {
      cmd: "cat input.html | html-converter-cdt convert - --stdout -f md",
      desc: "Convert HTML from stdin to Markdown to stdout",
    },
    {
      cmd: "html-converter-cdt convert https://example.com --page-size Letter --margin 1cm",
      desc: "Convert with custom page size and margins",
    },
    {
      cmd: "html-converter-cdt convert input.html --dry-run -v",
      desc: "Preview conversion configuration without converting",
    },
  ]

  examples.forEach((example) => {
    console.log(chalk.cyan(`  ${example.cmd}`))
    console.log(chalk.gray(`    ${example.desc}\n`))
  })
}

/**
 * Create a styled header
 */
export function showHeader(title: string): void {
  const line = chalk.blue("═".repeat(title.length + 4))
  console.log(`\n${line}`)
  console.log(chalk.blue(`║ ${chalk.bold(title)} ║`))
  console.log(`${line}\n`)
}

/**
 * Create a styled separator
 */
export function showSeparator(): void {
  console.log(chalk.gray("─".repeat(50)))
}
