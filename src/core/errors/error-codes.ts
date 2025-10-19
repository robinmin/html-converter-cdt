/**
 * Error Codes and Recovery Strategies
 *
 * Comprehensive error code definitions organized by category with severity levels
 * and recovery strategy mappings for the HTML conversion system.
 */

/**
 * Error severity levels that determine priority and user impact
 */
export enum ErrorSeverity {
  LOW = "low", // Minor issues that don't prevent operation
  MEDIUM = "medium", // Significant issues affecting user experience
  HIGH = "high", // Serious issues preventing successful operation
  CRITICAL = "critical", // System-level failures requiring immediate attention
}

/**
 * Error categories for organized classification and routing
 */
export enum ErrorCategory {
  NETWORK_ERROR = "NETWORK_ERROR", // Network connectivity and communication
  TIMEOUT = "TIMEOUT", // Operation timeout scenarios
  INVALID_INPUT = "INVALID_INPUT", // Invalid user input or parameters
  INVALID_FORMAT = "INVALID_FORMAT", // Unsupported or malformed formats
  VALIDATION_ERROR = "VALIDATION_ERROR", // Data validation failures
  CDP_ERROR = "CDP_ERROR", // Chrome DevTools Protocol issues
  FILE_SYSTEM_ERROR = "FILE_SYSTEM_ERROR", // File I/O and storage problems
  MEMORY_ERROR = "MEMORY_ERROR", // Memory management issues
  CONVERSION_FAILED = "CONVERSION_FAILED", // Conversion process failures
  RENDERING_ERROR = "RENDERING_ERROR", // Page rendering and execution issues
  EXPORT_ERROR = "EXPORT_ERROR", // File export and saving problems
  RESOURCE_ERROR = "RESOURCE_ERROR", // External resource loading issues
  PERMISSION_ERROR = "PERMISSION_ERROR", // Access and privilege problems
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR", // Configuration and setup issues
}

/**
 * Standardized error codes with specific identification
 */
export enum ErrorCode {
  // Network errors (NETWORK_ERROR category)
  NETWORK_CONNECTION_FAILED = "NETWORK_CONNECTION_FAILED",
  NETWORK_DNS_ERROR = "NETWORK_DNS_ERROR",
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  NETWORK_SSL_ERROR = "NETWORK_SSL_ERROR",
  NETWORK_PROXY_ERROR = "NETWORK_PROXY_ERROR",

  // Timeout errors (TIMEOUT category)
  OPERATION_TIMEOUT = "OPERATION_TIMEOUT",
  CDP_TIMEOUT = "CDP_TIMEOUT",
  CONVERSION_TIMEOUT = "CONVERSION_TIMEOUT",
  RENDERING_TIMEOUT = "RENDERING_TIMEOUT",

  // Input validation errors (INVALID_INPUT category)
  INVALID_FILE_PATH = "INVALID_FILE_PATH",
  INVALID_URL = "INVALID_URL",
  INVALID_HTML = "INVALID_HTML",
  INVALID_OPTIONS = "INVALID_OPTIONS",
  MALFORMED_INPUT = "MALFORMED_INPUT",

  // Format errors (INVALID_FORMAT category)
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  FORMAT_CONVERSION_FAILED = "FORMAT_CONVERSION_FAILED",
  INVALID_OUTPUT_FORMAT = "INVALID_OUTPUT_FORMAT",

  // Validation errors (VALIDATION_ERROR category)
  VALIDATION_FAILED = "VALIDATION_FAILED",
  OPTION_VALIDATION_FAILED = "OPTION_VALIDATION_FAILED",
  RESOURCE_VALIDATION_FAILED = "RESOURCE_VALIDATION_FAILED",

  // CDP errors (CDP_ERROR category)
  CDP_CONNECTION_FAILED = "CDP_CONNECTION_FAILED",
  CDP_PROTOCOL_ERROR = "CDP_PROTOCOL_ERROR",
  CDP_TARGET_NOT_FOUND = "CDP_TARGET_NOT_FOUND",
  CDP_COMMAND_FAILED = "CDP_COMMAND_FAILED",
  CHROME_NOT_FOUND = "CHROME_NOT_FOUND",
  CHROME_LAUNCH_FAILED = "CHROME_LAUNCH_FAILED",

  // File system errors (FILE_SYSTEM_ERROR category)
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_ACCESS_DENIED = "FILE_ACCESS_DENIED",
  FILE_ALREADY_EXISTS = "FILE_ALREADY_EXISTS",
  DISK_FULL = "DISK_FULL",
  INVALID_PATH = "INVALID_PATH",

  // Memory errors (MEMORY_ERROR category)
  OUT_OF_MEMORY = "OUT_OF_MEMORY",
  MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED",
  BUFFER_OVERFLOW = "BUFFER_OVERFLOW",

  // Conversion errors (CONVERSION_FAILED category)
  CONVERSION_FAILED = "CONVERSION_FAILED",
  CONVERSION_ABORTED = "CONVERSION_ABORTED",
  CONVERSION_CORRUPTED = "CONVERSION_CORRUPTED",

  // Rendering errors (RENDERING_ERROR category)
  RENDERING_FAILED = "RENDERING_FAILED",
  RENDERING_CRASHED = "RENDERING_CRASHED",
  JAVASCRIPT_ERROR = "JAVASCRIPT_ERROR",

  // Export errors (EXPORT_ERROR category)
  EXPORT_FAILED = "EXPORT_FAILED",
  EXPORT_PERMISSION_DENIED = "EXPORT_PERMISSION_DENIED",
  EXPORT_INVALID_PATH = "EXPORT_INVALID_PATH",

  // Resource errors (RESOURCE_ERROR category)
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_LOAD_FAILED = "RESOURCE_LOAD_FAILED",
  RESOURCE_BLOCKED = "RESOURCE_BLOCKED",
  RESOURCE_TIMEOUT = "RESOURCE_TIMEOUT",

  // Permission errors (PERMISSION_ERROR category)
  PERMISSION_DENIED = "PERMISSION_DENIED",
  INSUFFICIENT_PRIVILEGES = "INSUFFICIENT_PRIVILEGES",
  SANDBOX_VIOLATION = "SANDBOX_VIOLATION",

  // Configuration errors (CONFIGURATION_ERROR category)
  CONFIG_INVALID = "CONFIG_INVALID",
  CONFIG_MISSING = "CONFIG_MISSING",
  CONFIG_INCOMPATIBLE = "CONFIG_INCOMPATIBLE",
}

/**
 * Recovery strategy interface for automated error handling
 */
export interface RecoveryStrategy {
  /** Whether the error is retryable */
  canRetry: boolean
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Backoff delay in milliseconds between retries */
  backoffMs?: number
  /** Whether to use exponential backoff */
  exponentialBackoff?: boolean
  /** User-friendly suggestions for manual resolution */
  suggestions: string[]
  /** Alternative actions to try */
  alternatives?: string[]
}

/**
 * User-friendly error messages with context and guidance
 */
export interface ErrorMessage {
  /** Main error message */
  message: string
  /** Detailed explanation */
  details?: string
  /** Technical information (for logs) */
  technical?: string
  /** Recovery strategy */
  recovery: RecoveryStrategy
}

/**
 * Comprehensive error message mapping for all error codes
 */
export const ERROR_MESSAGES: Record<ErrorCode, ErrorMessage> = {
  // Network error messages
  [ErrorCode.NETWORK_CONNECTION_FAILED]: {
    message: "Network connection failed",
    details: "Unable to establish a connection to the remote server or resource.",
    technical: "TCP/UDP connection establishment failed",
    recovery: {
      canRetry: true,
      maxRetries: 3,
      backoffMs: 1000,
      exponentialBackoff: true,
      suggestions: [
        "Check your internet connection",
        "Verify the URL is correct and accessible",
        "Try again in a few moments",
        "Check if a firewall is blocking the connection",
      ],
      alternatives: [
        "Use a different network connection",
        "Try a different URL if available",
      ],
    },
  },

  [ErrorCode.NETWORK_DNS_ERROR]: {
    message: "DNS resolution failed",
    details: "Unable to resolve the hostname to an IP address.",
    technical: "DNS lookup failed or timed out",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      backoffMs: 2000,
      suggestions: [
        "Check if the domain name is spelled correctly",
        "Verify your DNS settings",
        "Try using a different DNS server",
        "Check if the domain is accessible from other devices",
      ],
    },
  },

  [ErrorCode.NETWORK_TIMEOUT]: {
    message: "Network request timed out",
    details: "The server did not respond within the expected time frame.",
    technical: "HTTP request timeout exceeded",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      backoffMs: 1500,
      suggestions: [
        "Increase the timeout setting",
        "Check your internet connection speed",
        "Try again when the server is less busy",
      ],
    },
  },

  [ErrorCode.NETWORK_SSL_ERROR]: {
    message: "SSL/TLS connection error",
    details: "Unable to establish a secure connection due to certificate or protocol issues.",
    technical: "SSL/TLS handshake failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check if the website's SSL certificate is valid",
        "Verify your system's date and time are correct",
        "Update your system's SSL certificates",
        "Contact the website administrator about certificate issues",
      ],
    },
  },

  [ErrorCode.NETWORK_PROXY_ERROR]: {
    message: "Proxy connection error",
    details: "Unable to connect through the configured proxy server.",
    technical: "HTTP proxy connection failed",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      suggestions: [
        "Check proxy server configuration",
        "Verify proxy server is accessible",
        "Try disabling proxy temporarily",
        "Contact your network administrator",
      ],
    },
  },

  // Timeout error messages
  [ErrorCode.OPERATION_TIMEOUT]: {
    message: "Operation timed out",
    details: "The operation took longer than the allowed time limit.",
    technical: "Generic operation timeout",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      backoffMs: 1000,
      suggestions: [
        "Increase the timeout settings",
        "Reduce the content size or complexity",
        "Check system resources and performance",
        "Try again with simpler content",
      ],
    },
  },

  [ErrorCode.CDP_TIMEOUT]: {
    message: "Chrome DevTools Protocol timeout",
    details: "Communication with Chrome timed out during the operation.",
    technical: "CDP command or response timeout",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      backoffMs: 2000,
      suggestions: [
        "Increase CDP timeout settings",
        "Check Chrome process performance",
        "Restart Chrome if needed",
        "Reduce page complexity",
      ],
    },
  },

  [ErrorCode.CONVERSION_TIMEOUT]: {
    message: "Conversion process timed out",
    details: "The HTML conversion took longer than the allowed time.",
    technical: "Conversion pipeline timeout",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      backoffMs: 3000,
      suggestions: [
        "Increase conversion timeout",
        "Simplify the HTML content",
        "Disable resource loading if not needed",
        "Check system memory usage",
      ],
    },
  },

  [ErrorCode.RENDERING_TIMEOUT]: {
    message: "Page rendering timed out",
    details: "The web page took too long to render completely.",
    technical: "Page load/render timeout",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      backoffMs: 5000,
      suggestions: [
        "Wait for the page to fully load",
        "Disable JavaScript if not needed",
        "Block unnecessary resources",
        "Try a simpler version of the page",
      ],
    },
  },

  // Input validation error messages
  [ErrorCode.INVALID_FILE_PATH]: {
    message: "Invalid file path",
    details: "The provided file path is not valid or cannot be accessed.",
    technical: "File path validation failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check if the file path is correct",
        "Verify the file exists and is accessible",
        "Use absolute paths instead of relative paths",
        "Check file permissions",
      ],
    },
  },

  [ErrorCode.INVALID_URL]: {
    message: "Invalid URL",
    details: "The provided URL is malformed or cannot be processed.",
    technical: "URL format validation failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check the URL format and spelling",
        "Include the protocol (http:// or https://)",
        "Verify the URL is properly encoded",
        "Test the URL in a web browser",
      ],
    },
  },

  [ErrorCode.INVALID_HTML]: {
    message: "Invalid HTML content",
    details: "The provided HTML is malformed and cannot be processed.",
    technical: "HTML parsing/validation failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Validate the HTML using an HTML validator",
        "Check for missing closing tags",
        "Fix malformed HTML structure",
        "Use well-formed HTML markup",
      ],
    },
  },

  [ErrorCode.INVALID_OPTIONS]: {
    message: "Invalid options provided",
    details: "One or more configuration options are invalid or incompatible.",
    technical: "Option validation failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check the documentation for valid options",
        "Verify option values are within acceptable ranges",
        "Remove incompatible option combinations",
        "Use the default options as a reference",
      ],
    },
  },

  [ErrorCode.MALFORMED_INPUT]: {
    message: "Malformed input data",
    details: "The input data structure is not in the expected format.",
    technical: "Input data structure validation failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check the input data format",
        "Verify all required fields are present",
        "Ensure data types are correct",
        "Consult the API documentation",
      ],
    },
  },

  // Format error messages
  [ErrorCode.UNSUPPORTED_FORMAT]: {
    message: "Unsupported format",
    details: "The requested format is not supported by the converter.",
    technical: "Format compatibility check failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check supported formats in the documentation",
        "Use a supported output format",
        "Convert to an intermediate format first",
        "Update to the latest version for new format support",
      ],
    },
  },

  [ErrorCode.FORMAT_CONVERSION_FAILED]: {
    message: "Format conversion failed",
    details: "Unable to convert between the specified formats.",
    technical: "Format-specific conversion failed",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Check if the input format is valid",
        "Try a different output format",
        "Simplify the content for conversion",
        "Verify format compatibility",
      ],
    },
  },

  [ErrorCode.INVALID_OUTPUT_FORMAT]: {
    message: "Invalid output format",
    details: "The specified output format is not recognized or valid.",
    technical: "Output format validation failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Use a supported output format",
        "Check the format spelling",
        "Refer to documentation for valid formats",
        "Use format constants when available",
      ],
    },
  },

  // Validation error messages
  [ErrorCode.VALIDATION_FAILED]: {
    message: "Validation failed",
    details: "The provided data failed validation checks.",
    technical: "Data validation error",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check input data format and structure",
        "Verify all required fields are present",
        "Ensure data values are within acceptable ranges",
        "Consult validation documentation",
      ],
    },
  },

  [ErrorCode.OPTION_VALIDATION_FAILED]: {
    message: "Option validation failed",
    details: "One or more configuration options failed validation.",
    technical: "Configuration option validation error",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check option values against documentation",
        "Verify option compatibility",
        "Use default option values",
        "Remove invalid options",
      ],
    },
  },

  [ErrorCode.RESOURCE_VALIDATION_FAILED]: {
    message: "Resource validation failed",
    details: "A resource failed validation checks and cannot be used.",
    technical: "Resource validation error",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Check resource URL and accessibility",
        "Verify resource format is supported",
        "Use alternative resources if available",
        "Bypass resource validation if safe",
      ],
    },
  },

  // CDP error messages
  [ErrorCode.CDP_CONNECTION_FAILED]: {
    message: "Chrome DevTools Protocol connection failed",
    details: "Unable to establish a connection with Chrome's debugging interface.",
    technical: "CDP WebSocket connection failed",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      backoffMs: 2000,
      suggestions: [
        "Ensure Chrome is installed and running",
        "Check Chrome debugging port is accessible",
        "Restart Chrome with debugging enabled",
        "Verify Chrome installation is not corrupted",
      ],
    },
  },

  [ErrorCode.CDP_PROTOCOL_ERROR]: {
    message: "CDP protocol error",
    details: "Invalid or unsupported Chrome DevTools Protocol command.",
    technical: "CDP protocol violation",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check CDP command compatibility with Chrome version",
        "Update Chrome to the latest version",
        "Verify CDP protocol implementation",
        "Use supported CDP commands only",
      ],
    },
  },

  [ErrorCode.CDP_TARGET_NOT_FOUND]: {
    message: "CDP target not found",
    details: "The specified Chrome debugging target could not be located.",
    technical: "CDP target lookup failed",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Verify the target tab or page exists",
        "Check if the target was closed",
        "Refresh the page and try again",
        "Use a different target if available",
      ],
    },
  },

  [ErrorCode.CDP_COMMAND_FAILED]: {
    message: "CDP command execution failed",
    details: "A Chrome DevTools Protocol command failed to execute.",
    technical: "CDP command execution error",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Check command parameters",
        "Verify target is responsive",
        "Retry with different parameters",
        "Check Chrome console for errors",
      ],
    },
  },

  [ErrorCode.CHROME_NOT_FOUND]: {
    message: "Chrome installation not found",
    details: "Unable to locate a valid Chrome installation.",
    technical: "Chrome binary detection failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Install Google Chrome or Chromium",
        "Add Chrome to system PATH",
        "Specify Chrome path in configuration",
        "Use Chrome Portable if needed",
      ],
    },
  },

  [ErrorCode.CHROME_LAUNCH_FAILED]: {
    message: "Chrome launch failed",
    details: "Unable to start a new Chrome process.",
    technical: "Chrome process startup failed",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      suggestions: [
        "Check Chrome installation integrity",
        "Close existing Chrome processes",
        "Verify system resources are available",
        "Check Chrome permissions and security settings",
      ],
    },
  },

  // File system error messages
  [ErrorCode.FILE_NOT_FOUND]: {
    message: "File not found",
    details: "The specified file could not be located.",
    technical: "File system lookup failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Verify the file path is correct",
        "Check if the file exists",
        "Use absolute file paths",
        "Check file permissions",
      ],
    },
  },

  [ErrorCode.FILE_ACCESS_DENIED]: {
    message: "File access denied",
    details: "Permission denied when trying to access the file.",
    technical: "File system permission error",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check file permissions",
        "Run with appropriate privileges",
        "Ensure file is not in use by another process",
        "Check parent directory permissions",
      ],
    },
  },

  [ErrorCode.FILE_ALREADY_EXISTS]: {
    message: "File already exists",
    details: "A file with the specified name already exists.",
    technical: "File system conflict",
    recovery: {
      canRetry: false,
      suggestions: [
        "Choose a different file name",
        "Delete the existing file if not needed",
        "Use overwrite option if available",
        "Check if the existing file can be overwritten",
      ],
    },
  },

  [ErrorCode.DISK_FULL]: {
    message: "Insufficient disk space",
    details: "Not enough disk space available for the operation.",
    technical: "File system space error",
    recovery: {
      canRetry: false,
      suggestions: [
        "Free up disk space",
        "Choose a different drive or location",
        "Compress or delete unnecessary files",
        "Use external storage if available",
      ],
    },
  },

  [ErrorCode.INVALID_PATH]: {
    message: "Invalid file path",
    details: "The specified path is not valid or accessible.",
    technical: "Path validation failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check path format and syntax",
        "Verify path exists",
        "Use valid path separators",
        "Check for special characters",
      ],
    },
  },

  // Memory error messages
  [ErrorCode.OUT_OF_MEMORY]: {
    message: "Out of memory",
    details: "The system ran out of available memory.",
    technical: "Memory allocation failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Close other applications",
        "Increase system RAM",
        "Reduce content size or complexity",
        "Restart the application",
      ],
    },
  },

  [ErrorCode.MEMORY_LIMIT_EXCEEDED]: {
    message: "Memory limit exceeded",
    details: "Operation exceeded the configured memory limit.",
    technical: "Memory quota exceeded",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Increase memory limit settings",
        "Reduce operation size",
        "Process data in smaller chunks",
        "Enable memory optimization features",
      ],
    },
  },

  [ErrorCode.BUFFER_OVERFLOW]: {
    message: "Buffer overflow",
    details: "Data exceeded the allocated buffer size.",
    technical: "Buffer capacity exceeded",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Increase buffer size",
        "Process data in smaller portions",
        "Check for memory leaks",
        "Use streaming instead of buffering",
      ],
    },
  },

  // Conversion error messages
  [ErrorCode.CONVERSION_FAILED]: {
    message: "Conversion failed",
    details: "The HTML conversion process could not be completed.",
    technical: "Generic conversion failure",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      backoffMs: 1000,
      suggestions: [
        "Check input content validity",
        "Try different conversion options",
        "Simplify the HTML content",
        "Verify system resources",
      ],
    },
  },

  [ErrorCode.CONVERSION_ABORTED]: {
    message: "Conversion aborted",
    details: "The conversion process was terminated before completion.",
    technical: "Conversion interruption",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Restart the conversion process",
        "Check for stable network connection",
        "Ensure sufficient system resources",
        "Avoid interrupting the process",
      ],
    },
  },

  [ErrorCode.CONVERSION_CORRUPTED]: {
    message: "Conversion output corrupted",
    details: "The generated output file is corrupted or invalid.",
    technical: "Output corruption detected",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Retry the conversion process",
        "Check available disk space",
        "Verify output file permissions",
        "Try different output format",
      ],
    },
  },

  // Rendering error messages
  [ErrorCode.RENDERING_FAILED]: {
    message: "Page rendering failed",
    details: "Unable to render the web page content properly.",
    technical: "Page rendering error",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      backoffMs: 2000,
      suggestions: [
        "Check JavaScript console for errors",
        "Disable problematic scripts",
        "Try rendering without external resources",
        "Verify HTML structure is valid",
      ],
    },
  },

  [ErrorCode.RENDERING_CRASHED]: {
    message: "Rendering process crashed",
    details: "The page rendering process terminated unexpectedly.",
    technical: "Renderer process crash",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Restart the conversion process",
        "Check for memory issues",
        "Simplify the page content",
        "Update Chrome to latest version",
      ],
    },
  },

  [ErrorCode.JAVASCRIPT_ERROR]: {
    message: "JavaScript execution error",
    details: "An error occurred while executing JavaScript on the page.",
    technical: "JavaScript runtime error",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Check browser console for details",
        "Disable JavaScript if not needed",
        "Fix script errors in the page",
        "Try rendering without script execution",
      ],
    },
  },

  // Export error messages
  [ErrorCode.EXPORT_FAILED]: {
    message: "File export failed",
    details: "Unable to save the converted content to a file.",
    technical: "File export operation failed",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      suggestions: [
        "Check output directory permissions",
        "Verify sufficient disk space",
        "Try a different output location",
        "Check file name validity",
      ],
    },
  },

  [ErrorCode.EXPORT_PERMISSION_DENIED]: {
    message: "Export permission denied",
    details: "Permission denied when trying to save the output file.",
    technical: "File write permission error",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check directory write permissions",
        "Run with appropriate privileges",
        "Choose a different output directory",
        "Check file system permissions",
      ],
    },
  },

  [ErrorCode.EXPORT_INVALID_PATH]: {
    message: "Invalid export path",
    details: "The specified output path is not valid or accessible.",
    technical: "Output path validation failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Verify the output path exists",
        "Check path format and syntax",
        "Use absolute paths",
        "Ensure path is writable",
      ],
    },
  },

  // Resource error messages
  [ErrorCode.RESOURCE_NOT_FOUND]: {
    message: "Resource not found",
    details: "Unable to locate a required external resource.",
    technical: "External resource lookup failed",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Check resource URLs in HTML",
        "Verify resources are accessible",
        "Use local copies of resources",
        "Disable external resource loading",
      ],
    },
  },

  [ErrorCode.RESOURCE_LOAD_FAILED]: {
    message: "Resource loading failed",
    details: "Failed to load an external resource referenced by the page.",
    technical: "Resource fetch failed",
    recovery: {
      canRetry: true,
      maxRetries: 2,
      suggestions: [
        "Check network connectivity",
        "Verify resource URLs are correct",
        "Bypass problematic resources",
        "Use cached versions if available",
      ],
    },
  },

  [ErrorCode.RESOURCE_BLOCKED]: {
    message: "Resource blocked",
    details: "A resource was blocked by security policies or settings.",
    technical: "Resource blocked by policy",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check content security policies",
        "Disable resource blocking if safe",
        "Use HTTPS for all resources",
        "Verify CORS headers",
      ],
    },
  },

  [ErrorCode.RESOURCE_TIMEOUT]: {
    message: "Resource loading timeout",
    details: "A resource took too long to load and was abandoned.",
    technical: "Resource fetch timeout",
    recovery: {
      canRetry: true,
      maxRetries: 1,
      suggestions: [
        "Increase resource timeout",
        "Optimize resource sizes",
        "Load resources in parallel",
        "Skip slow-loading resources",
      ],
    },
  },

  // Permission error messages
  [ErrorCode.PERMISSION_DENIED]: {
    message: "Permission denied",
    details: "Insufficient permissions to perform the requested operation.",
    technical: "System permission error",
    recovery: {
      canRetry: false,
      suggestions: [
        "Run with appropriate privileges",
        "Check file and directory permissions",
        "Verify user account permissions",
        "Contact system administrator",
      ],
    },
  },

  [ErrorCode.INSUFFICIENT_PRIVILEGES]: {
    message: "Insufficient privileges",
    details: "The current user lacks the required privileges for this operation.",
    technical: "Elevated privileges required",
    recovery: {
      canRetry: false,
      suggestions: [
        "Run as administrator or root",
        "Check user group memberships",
        "Request elevated privileges",
        "Use a different user account",
      ],
    },
  },

  [ErrorCode.SANDBOX_VIOLATION]: {
    message: "Sandbox violation",
    details: "Operation violates security sandbox restrictions.",
    technical: "Security policy violation",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check security policies",
        "Adjust sandbox settings if safe",
        "Use different security level",
        "Contact security administrator",
      ],
    },
  },

  // Configuration error messages
  [ErrorCode.CONFIG_INVALID]: {
    message: "Invalid configuration",
    details: "The provided configuration is invalid or contains errors.",
    technical: "Configuration validation failed",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check configuration syntax",
        "Verify configuration values",
        "Use default configuration",
        "Consult configuration documentation",
      ],
    },
  },

  [ErrorCode.CONFIG_MISSING]: {
    message: "Missing configuration",
    details: "Required configuration values are missing.",
    technical: "Incomplete configuration",
    recovery: {
      canRetry: false,
      suggestions: [
        "Provide all required configuration values",
        "Use configuration template",
        "Check configuration file location",
        "Verify configuration loading",
      ],
    },
  },

  [ErrorCode.CONFIG_INCOMPATIBLE]: {
    message: "Incompatible configuration",
    details: "Configuration settings are incompatible with each other or the system.",
    technical: "Configuration incompatibility",
    recovery: {
      canRetry: false,
      suggestions: [
        "Check configuration compatibility",
        "Remove conflicting settings",
        "Update configuration format",
        "Verify system requirements",
      ],
    },
  },
}

/**
 * Get error category and severity from error code
 */
export function getErrorMetadata(errorCode: ErrorCode): {
  category: ErrorCategory
  severity: ErrorSeverity
} {
  // Determine category based on error code pattern
  let category: ErrorCategory
  let severity: ErrorSeverity = ErrorSeverity.MEDIUM

  if (errorCode.startsWith("NETWORK_")) {
    category = ErrorCategory.NETWORK_ERROR
    severity = ErrorSeverity.HIGH
  } else if (errorCode.startsWith("TIMEOUT_") || errorCode.includes("TIMEOUT")) {
    category = ErrorCategory.TIMEOUT
    severity = ErrorSeverity.MEDIUM
  } else if (errorCode.startsWith("INVALID_") || errorCode.startsWith("MALFORMED")) {
    category = ErrorCategory.INVALID_INPUT
    severity = ErrorSeverity.MEDIUM
  } else if (errorCode.includes("FORMAT")) {
    category = ErrorCategory.INVALID_FORMAT
    severity = ErrorSeverity.MEDIUM
  } else if (errorCode.startsWith("VALIDATION_")) {
    category = ErrorCategory.VALIDATION_ERROR
    severity = ErrorSeverity.MEDIUM
  } else if (errorCode.startsWith("CDP_") || errorCode.startsWith("CHROME_")) {
    category = ErrorCategory.CDP_ERROR
    severity = ErrorSeverity.HIGH
  } else if (errorCode.startsWith("FILE_") || errorCode.includes("DISK") || errorCode.includes("PATH")) {
    category = ErrorCategory.FILE_SYSTEM_ERROR
    severity = ErrorSeverity.HIGH
  } else if (errorCode.includes("MEMORY") || errorCode.includes("BUFFER")) {
    category = ErrorCategory.MEMORY_ERROR
    severity = errorCode === ErrorCode.OUT_OF_MEMORY
      ? ErrorSeverity.CRITICAL
      : errorCode.includes("CRITICAL") ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH
  } else if (errorCode.startsWith("CONVERSION_")) {
    category = ErrorCategory.CONVERSION_FAILED
    severity = errorCode.includes("CORRUPTED") ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM
  } else if (errorCode.startsWith("RENDERING_") || errorCode.includes("JAVASCRIPT")) {
    category = ErrorCategory.RENDERING_ERROR
    severity = errorCode.includes("CRASHED") ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM
  } else if (errorCode.startsWith("EXPORT_")) {
    category = ErrorCategory.EXPORT_ERROR
    severity = ErrorSeverity.MEDIUM
  } else if (errorCode.startsWith("RESOURCE_")) {
    category = ErrorCategory.RESOURCE_ERROR
    severity = ErrorSeverity.MEDIUM
  } else if (errorCode.startsWith("PERMISSION_") || errorCode.includes("SANDBOX")) {
    category = ErrorCategory.PERMISSION_ERROR
    severity = ErrorSeverity.HIGH
  } else if (errorCode.startsWith("CONFIG_")) {
    category = ErrorCategory.CONFIGURATION_ERROR
    severity = ErrorSeverity.MEDIUM
  } else {
    category = ErrorCategory.CONVERSION_FAILED
    severity = ErrorSeverity.MEDIUM
  }

  return { category, severity }
}

/**
 * Get user-friendly error message for an error code
 */
export function getErrorMessage(errorCode: ErrorCode): ErrorMessage {
  return ERROR_MESSAGES[errorCode] || {
    message: "Unknown error occurred",
    details: "An unexpected error was encountered.",
    technical: `Unknown error code: ${errorCode}`,
    recovery: {
      canRetry: false,
      suggestions: ["Contact support if the problem persists"],
    },
  }
}

/**
 * Check if an error code represents a retryable error
 */
export function isRetryableError(errorCode: ErrorCode): boolean {
  const errorMessage = ERROR_MESSAGES[errorCode]
  return errorMessage?.recovery.canRetry ?? false
}

/**
 * Get recovery strategy for an error code
 */
export function getRecoveryStrategy(errorCode: ErrorCode): RecoveryStrategy {
  const errorMessage = ERROR_MESSAGES[errorCode]
  return errorMessage?.recovery ?? {
    canRetry: false,
    suggestions: ["Contact support if the problem persists"],
  }
}
