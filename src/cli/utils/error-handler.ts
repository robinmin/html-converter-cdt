/**
 * CLI Error Handler
 *
 * Provides centralized error handling for the CLI with user-friendly
 * error messages, exit codes, and verbose mode support.
 */

import process from "node:process"

import chalk from "chalk"
import type { Command } from "commander"

import { ConversionError } from "../../core/errors/conversion-error.js"

/**
 * Handle CLI errors with appropriate formatting and exit codes
 */
export function handleCliError(error: unknown, program: Command): never {
  if (error instanceof ConversionError) {
    handleConversionError(error, program)
  } else if (error instanceof Error) {
    handleGenericError(error, program)
  } else {
    handleUnknownError(error, program)
  }

  // Exit with error code
  process.exit(1)
}

/**
 * Handle conversion errors with detailed information
 */
function handleConversionError(error: ConversionError, program: Command): void {
  const isVerbose = program.opts().verbose

  console.error(chalk.red.bold(`\n✗ Conversion failed: ${error.code}`))
  console.error(chalk.red(error.message))

  // Show recovery suggestions if available
  if ("recoverySuggestions" in error && Array.isArray((error as any).recoverySuggestions) && (error as any).recoverySuggestions.length > 0) {
    console.error(chalk.yellow("\n💡 Recovery suggestions:"))
    ;(error as any).recoverySuggestions.forEach((suggestion: string, index: number) => {
      console.error(chalk.yellow(`  ${index + 1}. ${suggestion}`))
    })
  }

  // Show context in verbose mode
  if (isVerbose && error.context) {
    console.error(chalk.gray("\n📋 Error context:"))
    Object.entries(error.context).forEach(([key, value]) => {
      console.error(chalk.gray(`  ${key}: ${JSON.stringify(value)}`))
    })
  }

  // Show stack trace in verbose mode
  if (isVerbose && error.stack) {
    console.error(chalk.gray("\n🔍 Stack trace:"))
    console.error(chalk.gray(error.stack))
  }
}

/**
 * Handle generic errors
 */
function handleGenericError(error: Error, program: Command): void {
  const isVerbose = program.opts().verbose

  console.error(chalk.red.bold("\n✗ Error:"))
  console.error(chalk.red(error.message))

  // Show stack trace in verbose mode
  if (isVerbose && error.stack) {
    console.error(chalk.gray("\n🔍 Stack trace:"))
    console.error(chalk.gray(error.stack))
  }
}

/**
 * Handle unknown errors
 */
function handleUnknownError(error: unknown, program: Command): void {
  console.error(chalk.red.bold("\n✗ Unknown error occurred"))
  console.error(chalk.red("An unexpected error occurred during conversion."))

  const isVerbose = program.opts().verbose
  if (isVerbose) {
    console.error(chalk.gray("\n🔍 Error details:"))
    console.error(chalk.gray(String(error)))
  }
}

/**
 * Show validation errors for command options
 */
export function showValidationError(message: string, _program: Command): never {
  console.error(chalk.red.bold("\n✗ Validation Error:"))
  console.error(chalk.red(message))
  console.error(chalk.gray("\nUse --help for usage information."))

  process.exit(1)
}

/**
 * Show configuration errors
 */
export function showConfigError(error: Error, configPath?: string): never {
  console.error(chalk.red.bold("\n✗ Configuration Error:"))

  if (configPath) {
    console.error(chalk.red(`Failed to load configuration from: ${configPath}`))
  }

  console.error(chalk.red(error.message))
  console.error(chalk.gray("\nPlease check your configuration file and try again."))

  process.exit(1)
}
