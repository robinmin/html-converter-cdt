/**
 * Error Handling Module
 *
 * Comprehensive error handling system for HTML conversion operations.
 * Provides structured error classes, normalization, recovery mechanisms,
 * and integration utilities for consistent error handling across the application.
 *
 * @example
 * ```typescript
 * import {
 *   ErrorHandler,
 *   ConversionError,
 *   ErrorCodes,
 *   ErrorIntegration,
 *   ErrorSimulator
 * } from 'html-converter-cdt/core/errors';
 *
 * // Handle errors consistently
 * const errorHandler = new ErrorHandler();
 * const integration = new ErrorIntegration();
 *
 * try {
 *   await convertUrl('https://example.com');
 * } catch (error) {
 *   const normalizedError = errorHandler.normalizeError(error);
 *   console.error(`Error: ${normalizedError.userMessage}`);
 * }
 *
 * // Simulate errors for testing
 * const simulator = new ErrorSimulator();
 * const networkError = simulator.simulateNetworkError();
 * ```
 */

// Core error classes
export { ConversionError, createConversionError, getCategoryFromCode, getSeverityFromCode, isConversionError } from "./conversion-error.js"
export type { ErrorCategory, ErrorCode, ErrorContext, ErrorSeverity } from "./conversion-error.js"

// Error codes and definitions
export { ERROR_MESSAGES, ErrorCategory as ErrorCategoryEnum, ErrorCode as ErrorCodeEnum, ErrorSeverity as ErrorSeverityEnum, getErrorMessage, getErrorMetadata, getRecoveryStrategy, isRetryableError } from "./error-codes.js"
export type { ErrorMessage, RecoveryStrategy } from "./error-codes.js"

// Error handling and normalization
export { createErrorHandler, defaultErrorHandler, ErrorHandler, ErrorSource, handleError } from "./error-handler.js"
export type { ErrorHandlerConfig, ErrorMetrics, ErrorNormalizationResult } from "./error-handler.js"

// Error recovery mechanisms
export { CircuitState, ContextManager, defaultContextManager, defaultRecoveryManager, ErrorRecovery, RecoveryManager, RecoveryStrategy as RecoveryStrategyEnum } from "./error-recovery.js"
export type { CircuitBreakerConfig, ContextEnhancementConfig, RateLimiterConfig, RecoveryResult, RetryConfig } from "./error-recovery.js"

// Error simulation utilities for testing
export { createMockChromeError, createMockFileSystemError, createMockNetworkError, ErrorScenarios, ErrorSimulator } from "./error-simulation.js"
export type { ChromeDPError, ErrorSimulationConfig, FileSystemError } from "./error-simulation.js"

// Integration utilities
export { createErrorAwareOperation, ErrorIntegration, withErrorContext, withRetry } from "./integration.js"
export type { ErrorIntegrationConfig } from "./integration.js"
