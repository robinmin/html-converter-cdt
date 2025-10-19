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
export { ConversionError } from "./conversion-error.js"
export type { ConversionErrorOptions, ErrorContext } from "./conversion-error.js"

// Error codes and definitions
export { ERROR_MESSAGES, ErrorCode } from "./error-codes.js"
export type { ErrorInfo, RecoveryStrategy } from "./error-codes.js"

// Error handling and normalization
export { ErrorHandler } from "./error-handler.js"
export type { ErrorHandlerOptions } from "./error-handler.js"

// Error recovery mechanisms
export { ErrorRecovery } from "./error-recovery.js"
export type { RecoveryOptions, RecoveryResult } from "./error-recovery.js"

// Error simulation utilities for testing
export { createMockChromeError, createMockFileSystemError, createMockNetworkError, ErrorScenarios, ErrorSimulator } from "./error-simulation.js"
export type { ChromeDPError, ErrorSimulationConfig, FileSystemError } from "./error-simulation.js"

// Integration utilities
export { createErrorAwareOperation, ErrorIntegration, withErrorContext, withRetry } from "./integration.js"
export type { ErrorIntegrationConfig } from "./integration.js"
