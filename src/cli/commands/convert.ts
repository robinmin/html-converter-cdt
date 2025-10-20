/**
 * Convert Command
 *
 * Main conversion command implementation with progress indicators,
 * colored output, format detection, and comprehensive option handling.
 */

import { Buffer } from "node:buffer"

import chalk from "chalk"
import { Command } from "commander"
import type { Ora } from "ora"
import ora from "ora"

import type { ConversionFormat } from "../../api/index.js"
import { convert, convertWithProgress } from "../../api/index.js"
import { loadConfig } from "../../config/loader.js"
import { buildConversionOptions, parseOutputFormat } from "../options.js"
import { formatOutput, showInfo, showSuccess } from "../output.js"
import { readFromStdin, writeToStdout } from "../stream-handlers.js"
import { handleCliError, showValidationError } from "../utils/error-handler.js"

/**
 * Create the convert command
 */
export const convertCommand = new Command("convert")
  .description("Convert HTML to various formats")
  .argument("<input>", "Input HTML file, URL, or \"-\" for stdin")
  .argument("[output]", "Output file (format inferred from extension)")
  .option("-f, --format <format>", "Output format (pdf, png, jpeg, md, docx, mhtml)")
  .option("--stdout", "Output to stdout instead of file")
  .option("--dry-run", "Show configuration without converting")
  .option("-v, --verbose", "Enable verbose logging")
  .option("--keep-mhtml", "Keep intermediate MHTML file")
  .option("--mhtml-path <path>", "Custom path for MHTML file")
  .option("--max-retries <n>", "Maximum retry attempts", "3")
  .option("--timeout <ms>", "Timeout in milliseconds", "30000")

  // PDF-specific options
  .option("--layout <mode>", "Layout mode (standard, single-page)", "standard")
  .option("--page-size <size>", "Page size (A4, Letter, Legal, etc.)", "A4")
  .option("--margin <value>", "Margin (e.g., 20px, 1cm)", "20px")
  .option("--scale <factor>", "Scale factor (e.g., 0.9)", "1.0")
  .option("--no-background", "Disable background graphics")
  .option("--header-template <template>", "Custom header template")
  .option("--footer-template <template>", "Custom footer template")

  // Image-specific options
  .option("--quality <n>", "Image quality (1-100)", "90")
  .option("--viewport <WxH>", "Viewport size (e.g., 1920x1080)", "1920x1080")
  .option("--omit-background", "Omit background (PNG only)")
  .option("--clip <x,y,width,height>", "Clip region")

  // Markdown-specific options
  .option("--flavor <type>", "Markdown flavor (gfm, commonmark)", "gfm")
  .option("--no-embed-images", "Don't embed images as base64")
  .option("--image-asset-path <path>", "Directory for saved images")

  // DOCX-specific options
  .option("--preserve-style", "Preserve HTML styling")
  .option("--font-family <font>", "Default font family", "Arial")
  .option("--font-size <size>", "Default font size in points", "11")

  .action(async (input: string, output: string | undefined, options, command) => {
    try {
      await executeConvert(input, output, options, command)
    } catch (error) {
      handleCliError(error, command.parent)
    }
  })

/**
 * Execute the convert command
 */
async function executeConvert(
  input: string,
  output: string | undefined,
  options: any,
  command: Command,
): Promise<void> {
  const spinner = ora()
  const globalOpts = command.parent?.opts() || {}

  // Merge global and command-specific options
  const mergedOptions = { ...globalOpts, ...options }

  // Validate input
  if (!input) {
    showValidationError("Input is required", command.parent || command)
  }

  // Handle stdin input
  let htmlContent: string
  if (input === "-") {
    htmlContent = await readFromStdin()
    if (!htmlContent.trim()) {
      showValidationError("No HTML content received from stdin", command.parent || command)
    }
  } else {
    htmlContent = input // URL or file path
  }

  // Determine output format
  const format = parseOutputFormat(mergedOptions.format, output, mergedOptions.stdout)

  // Dry run mode
  if (mergedOptions.dryRun) {
    showDryRunOutput(input, output, format, mergedOptions)
    return
  }

  // Load configuration
  let config
  try {
    config = await loadConfig(mergedOptions.config)
  } catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Configuration error: ${error.message}`)
    }
    throw error
  }

  // Build conversion options
  const conversionOptions = buildConversionOptions(format, mergedOptions, config.config)

  // Convert CLI format to API format - handle all CLI format mappings
  const apiFormat: ConversionFormat = format === ("md" as any) ? "markdown" : (format as ConversionFormat)

  // Show verbose information
  if (mergedOptions.verbose) {
    showInfo(`Converting ${input === "-" ? "stdin" : input} to ${format.toUpperCase()}`)
    if (output) {
      showInfo(`Output file: ${output}`)
    } else if (!mergedOptions.stdout) {
      showInfo("Output file: Auto-generated filename")
    } else {
      showInfo("Output: stdout")
    }
  }

  // Start conversion with progress
  spinner.start("Initializing conversion...")

  try {
    let result

    // Start conversion
    const conversionPromise = convert(htmlContent, apiFormat as ConversionFormat, conversionOptions)

    if (mergedOptions.verbose) {
      // Use progress tracking in verbose mode
      result = await convertWithProgress(conversionPromise, (progress) => {
        updateSpinnerProgress(spinner, progress)
      })
    } else {
      // Simple conversion
      result = await conversionPromise
    }

    spinner.succeed("Conversion completed successfully!")

    // Handle output
    let outputBuffer: ArrayBuffer
    if (typeof result.content === "string") {
      const buffer = Buffer.from(result.content)
      outputBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
    } else if (Buffer.isBuffer(result.content)) {
      const buffer = result.content as Buffer
      outputBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
    } else {
      outputBuffer = result.content as ArrayBuffer
    }

    if (mergedOptions.stdout) {
      await writeToStdout(outputBuffer)
      if (mergedOptions.verbose) {
        showInfo(`Output ${format.toUpperCase()} data to stdout (${formatOutput(outputBuffer.byteLength)})`)
      }
    } else {
      const outputPath = output || result.suggestedFileName
      await writeOutputFile(outputPath, outputBuffer)
      showSuccess(`Successfully converted to ${outputPath}`)
    }

    // Show metadata in verbose mode
    if (mergedOptions.verbose && result.metadata) {
      showConversionMetadata(result.metadata)
    }
  } catch (error) {
    spinner.fail("Conversion failed")
    throw error
  }
}

/**
 * Update spinner with progress information
 */
function updateSpinnerProgress(spinner: Ora, progress: any): void {
  const { percentage, message, step } = progress
  const progressText = `${step} (${Math.round(percentage)}%)`

  if (message) {
    spinner.text = `${progressText}: ${message}`
  } else {
    spinner.text = progressText
  }
}

/**
 * Show dry run output
 */
function showDryRunOutput(input: string, output: string | undefined, format: ConversionFormat, options: any): void {
  console.log(chalk.blue.bold("\n🔍 Dry Run - Configuration Preview"))
  console.log(chalk.gray("─".repeat(50)))

  console.log(chalk.cyan("Input:"), input === "-" ? "stdin" : input)
  console.log(chalk.cyan("Format:"), format.toUpperCase())

  if (output) {
    console.log(chalk.cyan("Output:"), output)
  } else if (options.stdout) {
    console.log(chalk.cyan("Output:"), "stdout")
  } else {
    console.log(chalk.cyan("Output:"), "Auto-generated filename")
  }

  console.log(chalk.cyan("Options:"))
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && key !== "verbose" && key !== "dryRun") {
      console.log(chalk.gray(`  ${key}:`), chalk.white(value))
    }
  })

  console.log(chalk.gray("─".repeat(50)))
  console.log(chalk.green("✓ Configuration is valid. Remove --dry-run to perform conversion."))
}

/**
 * Write output file
 */
async function writeOutputFile(filePath: string, buffer: ArrayBuffer): Promise<void> {
  const { writeFile } = await import("node:fs/promises")
  await writeFile(filePath, new Uint8Array(buffer))
}

/**
 * Show conversion metadata
 */
function showConversionMetadata(metadata: any): void {
  console.log(chalk.blue.bold("\n📊 Conversion Metadata:"))
  console.log(chalk.gray("─".repeat(30)))

  Object.entries(metadata).forEach(([key, value]) => {
    console.log(chalk.cyan(`${key}:`), chalk.white(value))
  })
}
