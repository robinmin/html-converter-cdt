#!/usr/bin/env node

/**
 * CLI Entry Point
 *
 * Main entry point for the HTML Converter CDT command-line interface.
 * Uses Commander.js to provide a comprehensive CLI with progress indicators,
 * colored output, and extensive option parsing.
 */

import process from "node:process"

import chalk from "chalk"
import { Command } from "commander"

import { convertCommand } from "./commands/convert.js"
import { handleCliError } from "./utils/error-handler.js"
// Version will be set at build time
const version = "0.0.0"

// Set up the main CLI program
const program = new Command()

// Configure the program
program
  .name("html-converter-cdt")
  .description("Convert HTML to various formats using Chrome DevTools Protocol")
  .version(version, "-V, --version", "Display version number")
  .helpOption("-h, --help", "Display help for command")
  .configureHelp({
    sortSubcommands: true,
    showGlobalOptions: true,
  })

// Global options
program
  .option("-v, --verbose", "Enable verbose logging with detailed output")
  .option("--dry-run", "Show configuration without performing conversion")
  .option("--config <path>", "Path to configuration file")
  .option("--format <format>", "Output format (pdf, png, jpeg, md, docx, mhtml)")
  .option("--stdout", "Output to stdout instead of file")
  .option("--keep-mhtml", "Keep intermediate MHTML file")
  .option("--mhtml-path <path>", "Custom path for MHTML file")
  .option("--max-retries <n>", "Maximum retry attempts", "3")
  .option("--timeout <ms>", "Timeout in milliseconds", "30000")

// Add the convert command
program.addCommand(convertCommand)

// Global error handling
program.configureOutput({
  writeErr: str => process.stderr.write(chalk.red(str)),
  writeOut: str => process.stdout.write(str),
})

// Handle unknown commands
program.on("command:*", (operands) => {
  console.error(chalk.red(`Error: Unknown command '${operands[0]}'`))
  console.log("See --help for a list of available commands.\n")
  process.exit(1)
})

// Main execution function
async function main(): Promise<void> {
  try {
    // Parse command line arguments
    await program.parseAsync(process.argv)
  } catch (error) {
    handleCliError(error, program)
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error(chalk.red("Unhandled Rejection at:"), promise)
  console.error(chalk.red("Reason:"), reason)
  process.exit(1)
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error(chalk.red("Uncaught Exception:"), error)
  process.exit(1)
})

// Run the CLI
if (require.main === module) {
  main()
}

export { program }
