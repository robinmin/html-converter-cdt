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

// Memory management
export {
  type ChunkProcessor,
  type IMemoryAwareProcessor,
  MemoryManager,
  type MemoryOptimizationOptions,
  type MemoryPressureEvent,
  type MemoryStats,
  type MemoryThresholds,
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
