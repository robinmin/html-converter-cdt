/**
 * Performance Module - Comprehensive performance optimization and monitoring
 *
 * This module provides:
 * - Memory management and monitoring
 * - Batch conversion with concurrency control
 * - Streaming MHTML processing for large files
 * - Chrome instance pooling for resource efficiency
 * - Performance configuration and metrics tracking
 */

export type {
  // From MHTML Types
  MHTMLOptions,
} from "../../converters/mhtml/types.js"

// Batch Conversion
export {
  type BatchConfig,
  BatchConverter,
  type BatchInput,
  type BatchProgress,
  type BatchResult,
  convertUrlsInBatch,
  createBatchConverter,
} from "../engine/batch-converter.js"

export type {
  ChromeCDPManagerConfig,
  // From Chrome CDP Manager
  ChromeProcess,
} from "../engine/chrome-cdp-manager.js"

// Re-export commonly used types
export type {
  CDPCaptureConfig,
  DependencyType,
  // From MHTML Processor
  ExternalDependency,
  PageCaptureMetadata,
} from "../engine/mhtml-processor.js"

// Chrome Instance Pooling
export {
  ChromeInstancePool,
  type ChromePoolConfig,
  createChromePool,
  type PooledChromeInstance,
  type PoolStats,
} from "./chrome-pool.js"

// Memory Management
export {
  type BufferConfig,
  MemoryManager,
  memoryManager,
  type MemoryStats,
  type MemoryThresholds,
  withMemoryMonitoring,
} from "./memory-manager.js"

// Performance Configuration and Monitoring
export {
  createPerformanceMonitor,
  type PerformanceAlert,
  type PerformanceConfig,
  type PerformanceMetrics,
  PerformanceMonitor,
  type PerformanceStats,
} from "./performance-config.js"

// Streaming Processing
export {
  type ConversionContext,
  createStreamingProcessor,
  type ParsedInput,
  type ProcessedResource,
  type StreamingConfig,
  StreamingMHTMLProcessor,
  type StreamingProgress,
} from "./streaming-mhtml-processor.js"
