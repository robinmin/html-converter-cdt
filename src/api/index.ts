/**
 * Public API Module
 *
 * This module provides the main public API exports for the HTML Converter CDT library.
 * It includes both high-level convenience functions and the full-featured converter class.
 */

// Strategy pattern exports for advanced usage
export { BaseConverter } from "../architecture/strategies/BaseConverter.js"

export type { ConverterStrategy, IConverter, IStrategyRegistry } from "../architecture/strategies/types.js"

export type { ConversionResult } from "../architecture/strategies/types.js"

// Re-export core functionality for advanced usage
export { ConversionError, createConversionError } from "../core/errors/conversion-error.js"
export type { ConversionError as ConversionErrorType } from "../core/errors/conversion-error.js"

export type { ErrorCategory, ErrorCode, ErrorContext, ErrorSeverity } from "../core/errors/conversion-error.js"
// Utility exports for advanced usage
export { createErrorHandler, defaultErrorHandler, handleError } from "../core/errors/error-handler.js"
export type { ErrorHandler, ErrorHandlerConfig } from "../core/errors/error-handler.js"

// Progressive enhancement exports for advanced usage
export { ProgressiveEnhancementManager } from "../core/ProgressiveEnhancementManager.js"
export type { ConversionPlugin, ProgressiveEnhancementConfig, UserFeedback } from "../core/ProgressiveEnhancementManager.js"

export { BasicHTMLTier } from "../tiers/BasicHTMLTier.js"
export { CanvasTier } from "../tiers/CanvasTier.js"
// Tier implementations for advanced usage
export { ChromeCDPTier } from "../tiers/ChromeCDPTier.js"
export type {
  BasicHTMLTierConfig,
  CanvasTierConfig,
  ChromeCDPTierConfig,
  ServerSideTierConfig,
} from "../tiers/index.js"

export { ServerSideTier } from "../tiers/ServerSideTier.js"

// Core types and interfaces
export type {
  BaseConversionOptions,
  BatchCompleteEventData,
  BatchConversionItem,
  BatchConversionResult,
  ConversionCompleteEventData,
  ConversionErrorEventData,
  // Conversion types
  ConversionFormat,
  ConversionInput,
  ConversionOptions,

  ConversionProgress,
  ConverterEvent,
  // Event types
  ConverterEventType,
  DOCXOptions,
  // Result types
  EnhancedConversionResult,

  EventListener,
  // Configuration types
  HTMLConverterConfig,

  HTMLConverterFactoryOptions,
  // Interface types
  IHTMLConverter,
  ImageOptions,
  MarkdownOptions,
  MHTMLOptions,
  PDFOptions,
  ProgressEventData,

  ValidationResult,
} from "../types/public-api.js"
// Format-specific functions
export {
  batchConvertToFormat,
  convertToDOCX,
  convertToJPEG,
  convertToMarkdown,
  convertToMHTML,
  convertToPDF,
  convertToPNG,
  isConversionError,
  prepareForFileSave,
} from "./format-specific.js"
// Factory functions
export {
  createBrowserHTMLConverter,
  createHTMLConverter,
  createServerHTMLConverter,
  createSimpleHTMLConverter,
} from "./html-converter-factory.js"

// Main converter class
export { HTMLConverter } from "./html-converter.js"
// Unified convert function
export {
  convert,
  convertBatch,
  convertToFile,
  convertWithProgress,
  convertWithRetry,
} from "./unified-convert.js"
