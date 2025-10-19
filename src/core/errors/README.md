# Error Handling Documentation

## Overview

The HTML Converter CDT library includes a comprehensive error handling system designed to provide clear, actionable error messages and robust recovery mechanisms. This system ensures that users receive helpful feedback when things go wrong, while developers get detailed debugging information.

## Architecture

### Core Components

1. **ConversionError** - Structured error class with standardized error codes
2. **ErrorHandler** - Normalizes errors from various sources and generates user-friendly messages
3. **ErrorCodes** - Comprehensive error code definitions with categories and recovery suggestions
4. **ErrorRecovery** - Automated recovery strategies for common error scenarios
5. **ErrorIntegration** - Utilities for integrating error handling throughout the application

## Quick Start

### Basic Error Handling

```typescript
import { ConversionError, ErrorHandler } from "html-converter-cdt/core"

const errorHandler = new ErrorHandler()

try {
  // Your conversion logic here
  await convertUrl("https://example.com")
} catch (error) {
  const conversionError = errorHandler.normalizeError(error)
  console.error(`Error: ${conversionError.userMessage}`)
  console.error(`Suggestions: ${conversionError.recoverySuggestions.join(", ")}`)
}
```

### Error Classification

```typescript
import { ConversionError, ErrorCodes } from "html-converter-cdt/core"

// Check error type
if (error instanceof ConversionError) {
  switch (error.category) {
    case "NETWORK_ERROR":
      console.log("Network-related issue")
      break
    case "TIMEOUT":
      console.log("Operation timed out")
      break
    case "INVALID_INPUT":
      console.log("Input validation failed")
      break
  }
}
```

## Error Categories

### Network Errors

These occur when the library cannot connect to external resources.

**Error Codes:**
- `NETWORK_ERROR` - General connection failures
- `TIMEOUT` - Operation timeouts
- `RESOURCE_ERROR` - Failed to load external resources

**Common Causes:**
- No internet connection
- DNS resolution failures
- SSL/TLS certificate issues
- Remote server unavailability

**Recovery Strategies:**
- Retry with exponential backoff
- Check network connectivity
- Verify URL validity
- Use alternative endpoints

### Input Errors

These occur when provided input is invalid or malformed.

**Error Codes:**
- `INVALID_INPUT` - Malformed file paths, URLs, or HTML
- `INVALID_FORMAT` - Unsupported output format
- `VALIDATION_ERROR` - Option validation failures

**Common Causes:**
- Invalid URL format
- Non-existent file paths
- Unsupported output formats
- Invalid configuration options

**Recovery Strategies:**
- Validate input format
- Check file/directory existence
- Verify format support
- Provide input examples

### System Errors

These occur due to system-level issues.

**Error Codes:**
- `CDP_ERROR` - Chrome DevTools Protocol failures
- `FILE_SYSTEM_ERROR` - File I/O failures
- `MEMORY_ERROR` - Out of memory conditions

**Common Causes:**
- Chrome not installed or running
- Insufficient file permissions
- Disk space limitations
- Memory constraints

**Recovery Strategies:**
- Check Chrome installation
- Verify file permissions
- Free up disk space
- Increase memory limits

### Conversion Errors

These occur during the conversion process.

**Error Codes:**
- `CONVERSION_FAILED` - General conversion failures
- `RENDERING_ERROR` - Page rendering issues
- `EXPORT_ERROR` - File export failures

**Common Causes:**
- Complex JavaScript execution
- Large page sizes
- Unsupported content types
- Export format limitations

**Recovery Strategies:**
- Simplify page content
- Increase timeout values
- Disable JavaScript
- Use alternative formats

## Advanced Usage

### Custom Error Handling

```typescript
import { ConversionError, ErrorHandler } from "html-converter-cdt/core"

class CustomErrorHandler extends ErrorHandler {
  normalizeError(error: Error, context?: ErrorContext): ConversionError {
    const conversionError = super.normalizeError(error, context)

    // Add custom context
    conversionError.addContext("userId", getCurrentUserId())
    conversionError.addContext("sessionId", getSessionId())

    // Custom logging
    this.logToService(conversionError)

    return conversionError
  }

  private logToService(error: ConversionError): void {
    // Send error to monitoring service
    fetch("/api/errors", {
      method: "POST",
      body: JSON.stringify(error.toJSON()),
    }).catch((fetchError) => {
      console.error("Failed to log error to service:", fetchError)
    })
  }
}
```

### Error Recovery

```typescript
import { ConversionError, ErrorRecovery } from "html-converter-cdt/core"

async function convertWithRetry(url: string): Promise<string> {
  try {
    return await convertUrl(url)
  } catch (error) {
    const conversionError = error as ConversionError

    // Attempt automatic recovery
    const recovered = await ErrorRecovery.attemptRecovery(conversionError)

    if (recovered) {
      console.log("Error recovery successful, retrying...")
      return await convertUrl(url)
    }

    throw conversionError
  }
}
```

### Integration with Express.js

```typescript
import express from "express"
import { ErrorIntegration } from "html-converter-cdt/core"

const app = express()
const errorIntegration = new ErrorIntegration({
  enableRecovery: true,
  maxRetries: 3,
  logger: (error, context) => {
    console.error(`[${context}] ${error.code}: ${error.userMessage}`)
  }
})

// Error middleware
app.use(errorIntegration.createMiddleware())

// Route with error handling
app.post("/convert", async (req, res, next) => {
  try {
    const result = await errorIntegration.wrapOperation(
      () => convertUrl(req.body.url),
      { context: "POST /convert" }
    )

    res.json({ success: true, result })
  } catch (error) {
    next(error)
  }
})
```

### Testing Error Scenarios

```typescript
import { assert } from "chai"
import { ErrorScenarios, ErrorSimulator } from "html-converter-cdt/core"

describe("Error Handling", () => {
  it("should handle network errors", async () => {
    const simulator = new ErrorSimulator()
    const networkError = simulator.simulateNetworkError({
      url: "https://example.com",
      cause: "timeout"
    })

    assert.equal(networkError.code, "TIMEOUT")
    assert.isTrue(networkError.context.has("url"))
    assert.isTrue(networkError.recoverable)
  })

  it("should process error chains", () => {
    const simulator = new ErrorSimulator()
    const errorChain = simulator.simulateErrorChain([
      "NETWORK_ERROR",
      "TIMEOUT",
      "CONVERSION_FAILED"
    ])

    assert.equal(errorChain.length, 3)
    assert.equal(errorChain[0].context.get("chainIndex"), 0)
    assert.equal(errorChain[2].context.get("chainIndex"), 2)
  })
})
```

## Error Message Examples

### Network Errors

```
Network connection failed. Please check your internet connection and try again.

Recovery suggestions:
- Check your network connection
- Verify the URL is correct
- Try again in a few moments
```

### Timeout Errors

```
The conversion took too long and was cancelled after 30 seconds.

Recovery suggestions:
- Try increasing the timeout value
- Simplify the page content
- Disable JavaScript execution
- Check if the page is extremely large
```

### Invalid Input Errors

```
The provided URL is invalid: "not-a-url".

Recovery suggestions:
- Ensure the URL starts with http:// or https://
- Check for typos in the URL
- Verify the URL points to an accessible webpage
```

### Chrome DevTools Protocol Errors

```
Failed to communicate with Chrome: "Target not found".

Recovery suggestions:
- Make sure Chrome is installed and up to date
- Try closing other Chrome instances
- Check if Chrome is being blocked by security software
- Restart the application
```

## Best Practices

### 1. Always Handle Errors Explicitly

```typescript
// Good
try {
  await convertUrl(url)
} catch (error) {
  if (error instanceof ConversionError) {
    handleConversionError(error)
  } else {
    handleUnexpectedError(error)
  }
}

// Avoid
try {
  await convertUrl(url)
} catch (error) {
  // Generic error handling
}
```

### 2. Provide Context When Normalizing Errors

```typescript
// Good
const error = errorHandler.normalizeError(originalError, {
  operation: "URL conversion",
  url: inputUrl,
  userAgent: req.headers["user-agent"],
  timestamp: new Date().toISOString(),
})

// Less useful
const error = errorHandler.normalizeError(originalError)
```

### 3. Use Error Recovery Strategically

```typescript
// Good - recoverable errors
if (error.category === "NETWORK_ERROR" || error.category === "TIMEOUT") {
  const recovered = await ErrorRecovery.attemptRecovery(error)
  if (recovered) {
    return await retryOperation()
  }
}

// Don't recover from validation errors
if (error.category === "INVALID_INPUT") {
  throw error // Let user fix input
}
```

### 4. Log Errors with Appropriate Detail

```typescript
// Development - full detail
if (process.env.NODE_ENV === "development") {
  console.error("Full error details:", {
    error: error.toJSON(),
    stack: error.stack,
    context: Object.fromEntries(error.context),
  })
}

// Production - user-friendly
console.error(`Conversion failed: ${error.userMessage}`)
```

## Configuration Options

### ErrorHandler Options

```typescript
const errorHandler = new ErrorHandler({
  enableSanitization: true, // Sanitize error messages for security
  includeStackTrace: false, // Include stack traces in user messages
  recoveryEnabled: true, // Enable automatic recovery suggestions
  logLevel: "error", // Minimum error level to log
})
```

### ErrorIntegration Options

```typescript
const integration = new ErrorIntegration({
  errorHandler: customHandler,
  defaultContext: "HTML conversion",
  enableRecovery: true,
  maxRetries: 3,
  logger: (_error, _context) => {
    // Custom logging implementation
  },
})
```

## TypeScript Support

The error handling system is fully typed with TypeScript. All error codes, categories, and recovery suggestions are strongly typed.

```typescript
import type { ConversionError, ErrorContext } from "html-converter-cdt/core"

function handleError(error: ConversionError): void {
  // TypeScript knows about all error properties
  console.log(error.code) // keyof typeof ErrorCodes
  console.log(error.category) // 'NETWORK_ERROR' | 'TIMEOUT' | etc.
  console.log(error.severity) // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}
```

## Migration Guide

### From Plain Error Objects

```typescript
// Before
try {
  await convertUrl(url)
} catch (error) {
  console.error("Conversion failed:", error.message)
}

// After
try {
  await convertUrl(url)
} catch (error) {
  const conversionError = errorHandler.normalizeError(error)
  console.error(`Conversion failed: ${conversionError.userMessage}`)
  console.error(`Error code: ${conversionError.code}`)
  console.error(`Recovery: ${conversionError.recoverySuggestions.join(", ")}`)
}
```

### From Manual Error Handling

```typescript
// Before
if (error.code === "ENOTFOUND") {
  throw new Error("Network error: could not resolve hostname")
} else if (error.code === "ETIMEDOUT") {
  throw new Error("Request timed out")
}

// After
const conversionError = errorHandler.normalizeError(error)
// Error is automatically classified and handled
```

## Troubleshooting

### Common Issues

1. **Errors not being normalized**: Make sure to use `errorHandler.normalizeError()`
2. **Missing recovery suggestions**: Check if recovery is enabled in configuration
3. **Verbose error messages**: Adjust log level and sanitization settings
4. **Type errors**: Ensure you're importing from the correct module paths

### Debug Mode

Enable debug mode for detailed error information:

```typescript
process.env.NODE_ENV = "development"
const errorHandler = new ErrorHandler({
  includeStackTrace: true,
  enableSanitization: false,
})
```
