/**
 * Core Utilities Index
 *
 * Exports all utility modules for file operations, memory management,
 * and enhanced MHTML processing.
 */

// Enhanced MHTML processor
export {
  type EnhancedMHTMLOptions,
  EnhancedMHTMLProcessor,
  type MHTMLProcessingResult,
} from "./EnhancedMHTMLProcessor.js"

// File operations manager
export {
  type BatchProcessingResult,
  FileOperationsManager,
  type FileProcessingOptions,
  type FileProcessingProgress,
  type IFileProcessor,
} from "./FileOperationsManager.js"

// Memory management (Note: MemoryManager, MemoryStats, MemoryThresholds exported from performance/index.js)
export {
  type ChunkProcessor,
  type IMemoryAwareProcessor,
  type MemoryOptimizationOptions,
  type MemoryPressureEvent,
} from "./MemoryManager.js"

// Secure file management
export {
  type FileInfo,
  FileOperationError,
  type FileOperationOptions,
  SecureFileManager,
  type StreamingOptions,
  type StreamResult,
  type TempFileOptions,
} from "./SecureFileManager.js"
