/**
 * Configuration System Index
 *
 * Main entry point for the HTML converter configuration system.
 * Exports all configuration-related functionality.
 */

// Default configurations
export * from "./defaults"

export { getDefaults, getEnvironmentConfig } from "./defaults"

// Environment variable mapping
export * from "./env-mapper"

export { mapEnvironmentVariables, validateEnvironmentVariables } from "./env-mapper"

// Main configuration loader
export * from "./loader"

export { createConfigLoader, loadConfig, loadConfigOnly } from "./loader"
// Configuration merging
export * from "./merger"
export { mergeConfigs, mergeConfigsWithPriority } from "./merger"
// Core configuration types and validation
export * from "./schema"
// Re-export commonly used types and functions
export type { BaseConfig, Config, DOCXConfig, ImageConfig, MarkdownConfig, MHTMLConfig, PDFConfig } from "./schema"
