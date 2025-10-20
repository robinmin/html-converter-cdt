/**
 * Core Module - Core functionality and processing engines
 *
 * This module provides the core functionality including error handling,
 * Chrome DevTools Protocol integration, and utility functions.
 *
 * @example
 * ```typescript
 * import { ErrorHandler, ConversionError, ErrorCodes } from 'html-converter-cdt/core';
 *
 * const errorHandler = new ErrorHandler();
 *
 * try {
 *   // Some conversion operation
 * } catch (error) {
 *   const conversionError = errorHandler.normalizeError(error);
 *   console.error(`Error: ${conversionError.userMessage}`);
 * }
 * ```
 */

// Capability detection exports
export * from "./capability/index.js"

// Engine exports
export * from "./engine/index.js"
// Error handling exports
export { ConversionError, createConversionError, ErrorCategory, ErrorCode, ErrorSeverity, isConversionError } from "./errors/conversion-error.js"

export type { ErrorContext } from "./errors/conversion-error.js"

export { ERROR_MESSAGES, getErrorMessage } from "./errors/error-codes.js"
export type { ErrorMessage } from "./errors/error-codes.js"
export { createErrorHandler, defaultErrorHandler, ErrorHandler, handleError } from "./errors/error-handler.js"
export type { ErrorHandlerConfig, ErrorMetrics, ErrorNormalizationResult, ErrorSource } from "./errors/error-handler.js"
export { defaultRecoveryManager, RecoveryManager } from "./errors/error-recovery.js"
export type { CircuitBreakerConfig, ContextEnhancementConfig, RateLimiterConfig, RecoveryResult, RecoveryStrategy as RecoveryStrategyType, RetryConfig } from "./errors/error-recovery.js"
// Performance exports
export * from "./performance/index.js"

// Progressive enhancement exports
export { ProgressiveEnhancementManager } from "./ProgressiveEnhancementManager.js"

export type {
  ConversionPlugin,
  ProgressiveEnhancementConfig,
  UserFeedback,
} from "./ProgressiveEnhancementManager.js"

// Utility exports
export * from "./utils/index.js"
