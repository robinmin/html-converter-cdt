# HTML Converter CDT - Usage Documentation

A TypeScript utility library to convert HTML to multiple formats using Chrome DevTools Protocol (CDT).

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Command Line Interface](#command-line-interface)
- [Programmatic API](#programmatic-api)
- [Configuration](#configuration)
- [Conversion Formats](#conversion-formats)
- [Progressive Enhancement](#progressive-enhancement)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)

## Installation

### NPM
```bash
npm install html-converter-cdt
```

### Yarn
```bash
yarn add html-converter-cdt
```

### PNPM
```bash
pnpm add html-converter-cdt
```

### Global CLI Installation
```bash
npm install -g html-converter-cdt
```

### Development Setup
```bash
git clone https://github.com/robinmin/html-converter-cdt.git
cd html-converter-cdt
pnpm install
pnpm build
```

## Quick Start

### Command Line
```bash
# Convert a webpage to PDF
html-converter-cdt convert https://example.com --format pdf --output example.pdf

# Convert local HTML file
html-converter-cdt convert ./input.html --format mhtml --output archive.mhtml

# Convert from stdin
cat index.html | html-converter-cdt convert --format pdf --output output.pdf
```

### Programmatic API
```typescript
import { convert, convertToPDF, HTMLConverter } from "html-converter-cdt"

// Simple conversion
const result = await convert("https://example.com", "pdf")

// Format-specific function
const pdfResult = await convertToPDF("https://example.com", {
  pageSize: "A4",
  margin: "20px",
  printBackground: true
})

// Advanced usage with HTMLConverter class
const converter = new HTMLConverter()
converter.on("progress", (event) => {
  console.log(`Progress: ${event.data.percentage}%`)
})

const advancedResult = await converter.convert("https://example.com", "pdf", {
  pageSize: "A4",
  printBackground: true,
  displayHeaderFooter: true
})
```

## Command Line Interface

### Basic Usage

```bash
# Show help
html-converter-cdt --help

# Show version
html-converter-cdt --version

# Convert with default options
html-converter-cdt convert <input> --format <format> --output <file>
```

### Format-Specific Conversion

```bash
# PDF Conversion
html-converter-cdt convert https://example.com --format pdf \
  --page-size A4 \
  --margin 20mm \
  --print-background

# Image Conversion
html-converter-cdt convert https://example.com --format png \
  --quality 90 \
  --full-page \
  --omit-background

# MHTML Conversion
html-converter-cdt convert https://example.com --format mhtml \
  --save-resources \
  --timeout 30000

# Markdown Conversion
html-converter-cdt convert https://example.com --format markdown \
  --images embed \
  --code-blocks syntax

# DOCX Conversion
html-converter-cdt convert https://example.com --format docx \
  --preserve-styling \
  --include-images
```

### Advanced Options

```bash
# Dry run to preview conversion
html-converter-cdt convert https://example.com --format pdf \
  --dry-run \
  --verbose

# Set custom timeout
html-converter-cdt convert https://example.com --format pdf \
  --timeout 60000

# Custom Chrome user agent
html-converter-cdt convert https://example.com --format pdf \
  --user-agent "Custom Bot/1.0"

# Set custom viewport
html-converter-cdt convert https://example.com --format png \
  --viewport "1920,1080" \
  --full-page

# Use custom Chrome path
html-converter-cdt convert https://example.com --format pdf \
  --chrome-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

### Batch Processing

```bash
# Multiple URLs
html-converter-cdt convert https://example1.com https://example2.com \
  --format pdf --batch

# Multiple formats for same input
html-converter-cdt convert https://example.com \
  --format pdf,mhtml,png \
  --batch
```

### Stream Processing

```bash
# Convert from stdin
curl https://example.com | html-converter-cdt convert --format pdf \
  --output output.pdf

# Pipe multiple conversions
echo "https://example.com" | html-converter-cdt convert --format pdf \
  --output page1.pdf
echo "https://example.org" | html-converter-cdt convert --format pdf \
  --output page2.pdf
```

## Programmatic API

### Simple Conversion Functions

```typescript
import {
  convert,
  convertToDOCX,
  convertToJPEG,
  convertToMarkdown,
  convertToMHTML,
  convertToPDF,
  convertToPNG
} from "html-converter-cdt"

// Basic conversion
const result = await convert(input, "pdf")
console.log(result.filePath) // Path to output file

// Format-specific conversion with options
const pdfResult = await convertToPDF("https://example.com", {
  pageSize: "A4",
  margin: {
    top: "20px",
    bottom: "20px",
    left: "20px",
    right: "20px"
  },
  printBackground: true,
  displayHeaderFooter: true
})

// Image conversion
const imageResult = await convertToPNG("https://example.com", {
  quality: 90,
  fullPage: true,
  omitBackground: false,
  clip: { x: 0, y: 0, width: 800, height: 600 }
})

// Markdown conversion
const markdownResult = await convertToMarkdown("https://example.com", {
  images: "embed",
  codeBlocks: "syntax",
  tables: true,
  links: "reference"
})
```

### Advanced HTMLConverter Class

```typescript
import { ConversionError, HTMLConverter } from "html-converter-cdt"

// Create converter instance
const converter = new HTMLConverter({
  defaultFormat: "pdf",
  timeout: 30000,
  retries: 3,
  logger: console
})

// Listen to progress events
converter.on("progress", (event) => {
  console.log(`Progress: ${event.data.percentage}%`)
  console.log(`Stage: ${event.data.stage}`)
})

converter.on("error", (event) => {
  console.error("Conversion error:", event.data.error)
})

converter.on("complete", (event) => {
  console.log("Conversion completed:", event.data.result)
})

// Convert with progress tracking
try {
  const result = await converter.convert("https://example.com", "pdf", {
    pageSize: "A4",
    printBackground: true
  })

  console.log("Conversion successful:", result.filePath)
  console.log("Metadata:", result.metadata)
} catch (error) {
  if (error instanceof ConversionError) {
    console.error(`Error ${error.code}: ${error.message}`)
    console.error("Recovery suggestions:", error.recoverySuggestions)
  }
}

// Clean up resources
converter.dispose()
```

### Factory Functions

```typescript
import {
  createBrowserHTMLConverter,
  createHTMLConverter,
  createServerHTMLConverter,
  createSimpleHTMLConverter
} from "html-converter-cdt"

// Create standard converter
const converter = createHTMLConverter({
  logger: console,
  enableAutoRecovery: true
})

// Create server-optimized converter
const serverConverter = createServerHTMLConverter({
  concurrency: 10,
  memoryLimit: "512MB",
  timeout: 60000
})

// Create browser-optimized converter
const browserConverter = createBrowserHTMLConverter({
  useSharedChrome: true,
  preferCDP: true
})
```

### Batch Processing

```typescript
import { HTMLConverter } from "html-converter-cdt"

const converter = new HTMLConverter()

// Batch convert multiple URLs
const urls = [
  "https://example.com/page1",
  "https://example.com/page2",
  "https://example.com/page3"
]

const batchPromises = urls.map(url =>
  converter.convert(url, "pdf", {
    output: `${new URL(url).pathname}.pdf`
  })
)

const results = await Promise.all(batchPromises)
results.forEach((result, index) => {
  console.log(`Converted ${urls[index]} to: ${result.filePath}`)
})

// Convert with batch options
const batchResult = await converter.convertBatch(urls, "pdf", {
  concurrency: 3,
  onProgress: (completed, total) => {
    console.log(`Progress: ${Math.round((completed / total) * 100)}%`)
  }
})
```

## Configuration

### Environment Variables

```bash
# Chrome Configuration
export HTML_CONVERTER_CHROME_PATH="/usr/bin/google-chrome"
export HTML_CONVERTER_CHROME_ARGS="--no-sandbox --disable-dev-shm-usage"

# Performance Settings
export HTML_CONVERTER_TIMEOUT=30000
export HTML_CONVERTER_CONCURRENCY=5
export HTML_CONVERTER_MEMORY_LIMIT=512000000

# Security Settings
export HTML_CONVERTER_ALLOW_PRIVATE_IPS=false
export HTML_CONVERTER_MAX_FILE_SIZE=10485760

# Logging
export HTML_CONVERTER_LOG_LEVEL=info
export HTML_CONVERTER_ENABLE_DEBUG=false
```

### Configuration File

Create `html-converter.config.json`:

```json
{
  "chrome": {
    "path": "/usr/bin/google-chrome",
    "args": ["--no-sandbox", "--disable-dev-shm-usage"],
    "timeout": 30000
  },
  "performance": {
    "timeout": 30000,
    "concurrency": 5,
    "memoryLimit": 524288000,
    "maxFileSize": 10485760
  },
  "security": {
    "allowPrivateIPs": false,
    "sandboxLevel": "standard",
    "validateSSLCertificates": true
  },
  "logging": {
    "level": "info",
    "enableDebug": false,
    "enableColors": true
  }
}
```

### Programmatic Configuration

```typescript
import { ConfigLoader } from "html-converter-cdt"

// Load configuration from multiple sources
const config = await ConfigLoader.create({
  configFile: "./html-converter.config.json",
  environment: "production",
  overrides: {
    performance: {
      timeout: 60000
    }
  }
})

// Use configuration
const converter = new HTMLConverter({
  config
})
```

## Conversion Formats

### PDF (Portable Document Format)

```typescript
import { convertToPDF } from "html-converter-cdt"

// Basic PDF conversion
const pdfResult = await convertToPDF("https://example.com", {
  pageSize: "A4",
  margin: "20mm",
  printBackground: true
})

// Advanced PDF options
const advancedPDF = await convertToPDF("https://example.com", {
  layout: "single-page",
  pageSize: {
    width: "210mm",
    height: "297mm"
  },
  margin: {
    top: "20mm",
    bottom: "20mm",
    left: "20mm",
    right: "20mm"
  },
  scale: 1.0,
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<div style=\"font-size:10px\">Page <span class=\"pageNumber\"></span></div>",
  footerTemplate: "<div style=\"font-size:10px\">Page <span class=\"pageNumber\"></span></div>",
  preferCSSPageSize: false
})
```

### Images (PNG, JPEG, WebP)

```typescript
import { convertToJPEG, convertToPNG } from "html-converter-cdt"

// PNG conversion
const pngResult = await convertToPNG("https://example.com", {
  quality: 90,
  fullPage: true,
  omitBackground: false,
  viewport: { width: 1920, height: 1080 },
  clip: { x: 0, y: 0, width: 800, height: 600 }
})

// JPEG conversion
const jpegResult = await convertToJPEG("https://example.com", {
  quality: 85,
  fullPage: true,
  omitBackground: true
})

// WebP conversion
const webpResult = await convertToWebP("https://example.com", {
  quality: 80,
  fullPage: true
})
```

### MHTML (MIME HTML)

```typescript
import { convertToMHTML } from "html-converter-cdt"

// MHTML conversion
const mhtmlResult = await convertToMHTML("https://example.com", {
  saveResources: true,
  timeout: 60000,
  includeExternal: true
})
```

### Markdown

```typescript
import { convertToMarkdown } from "html-converter-cdt"

// Markdown conversion
const markdownResult = await convertToMarkdown("https://example.com", {
  images: "embed",
  codeBlocks: "syntax",
  tables: true,
  links: "reference",
  headings: "atx",
  emphasis: "underscore"
})
```

### DOCX (Microsoft Word)

```typescript
import { convertToDOCX } from "html-converter-cdt"

// DOCX conversion
const docxResult = await convertToDOCX("https://example.com", {
  preserveStyling: true,
  includeImages: true,
  fontSize: 11,
  fontFamily: "Arial",
  margin: "1in"
})
```

## Progressive Enhancement

The library automatically selects the best available conversion method:

1. **Tier 1: Chrome CDP** - Highest quality conversion using Chrome DevTools Protocol
2. **Tier 2: Canvas Rendering** - Fallback when CDP is unavailable
3. **Tier 3: Server-Side** - External service integration when local conversion fails
4. **Tier 4: Basic Export** - Ultimate fallback with HTML-only export

### Capability Detection

```typescript
import { BrowserCapabilityDetector } from "html-converter-cdt"

const detector = new BrowserCapabilityDetector()

// Check capabilities
const capabilities = detector.detectCapabilities()
console.log("Chrome CDP available:", capabilities.chromeCDP)
console.log("Canvas support:", capabilities.canvas)
console.log("Network access:", capabilities.network)

// Check specific capability
const canUseCDP = detector.supportsChromeCDP()
const canUseCanvas = detector.supportsCanvas()

// Get capability score
const score = detector.getCapabilityScore()
console.log("Capability score:", score)
```

### Manual Tier Selection

```typescript
import { ProgressiveEnhancementManager } from "html-converter-cdt"

const manager = new ProgressiveEnhancementManager()

// Force specific tier
manager.setPreferredTier("chrome-cdp")
manager.setPreferredTier("canvas")
manager.setPreferredTier("server-side")
manager.setPreferredTier("basic")

// Get available tiers
const availableTiers = manager.getAvailableTiers()
console.log("Available tiers:", availableTiers)

// Convert with automatic tier selection
const result = await manager.convert("https://example.com", "pdf")
console.log("Used tier:", result.metadata.tier)
```

## Examples

### Web Page to PDF

```typescript
import { convertToPDF } from "html-converter-cdt"

async function convertWebpageToPDF(url: string, outputPath: string) {
  try {
    const result = await convertToPDF(url, {
      pageSize: "A4",
      margin: "20mm",
      printBackground: true,
      displayHeaderFooter: true
    })

    console.log(`PDF saved to: ${result.filePath}`)
    return result.filePath
  } catch (error) {
    console.error("Conversion failed:", error)
    throw error
  }
}

// Usage
convertWebpageToPDF("https://example.com", "./output.pdf")
```

### Batch URL Processing

```typescript
import { HTMLConverter } from "html-converter-cdt"

async function batchConvertURLs(urls: string[], format: string) {
  const converter = new HTMLConverter({
    concurrency: 3,
    timeout: 60000
  })

  const results = []

  for (const url of urls) {
    try {
      const result = await converter.convert(url, format, {
        output: `${new URL(url).pathname}.${format}`
      })
      results.push({ url, success: true, result })
    } catch (error) {
      results.push({ url, success: false, error: error.message })
    }
  }

  converter.dispose()
  return results
}

// Usage
const urls = [
  "https://example.com/page1",
  "https://example.com/page2",
  "https://example.com/page3"
]

const results = await batchConvertURLs(urls, "pdf")
console.log("Batch results:", results)
```

### Stream Processing with Progress

```typescript
import { createReadStream, createWriteStream } from "node:fs"

import { HTMLConverter } from "html-converter-cdt"

async function convertStreamWithProgress(
  inputStream: NodeJS.ReadableStream,
  outputPath: string,
  format: string
) {
  const converter = new HTMLConverter()
  const outputStream = createWriteStream(outputPath)

  converter.on("progress", (event) => {
    const { percentage, stage, bytesProcessed, totalBytes } = event.data
    console.log(`Progress: ${percentage}% - ${stage}`)

    if (totalBytes > 0) {
      const mbProcessed = (bytesProcessed / 1024 / 1024).toFixed(2)
      const mbTotal = (totalBytes / 1024 / 1024).toFixed(2)
      console.log(`Size: ${mbProcessed}/${mbTotal} MB`)
    }
  })

  try {
    const result = await converter.convert(inputStream, format)
    outputStream.write(result.buffer)
    console.log(`Stream conversion completed: ${outputPath}`)
    return outputPath
  } finally {
    converter.dispose()
  }
}

// Usage
const readStream = createReadStream("./input.html")
await convertStreamWithProgress(readStream, "./output.pdf", "pdf")
```

### Error Handling and Recovery

```typescript
import { ConversionError, convert } from "html-converter-cdt"

async function robustConversion(url: string, format: string, retries = 3): Promise<string> {
  let lastError: Error

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${retries}...`)
      const result = await convert(url, format, {
        timeout: 30000,
        retries: 0 // Disable automatic retries, we handle them manually
      })
      return result.filePath
    } catch (error) {
      lastError = error

      if (error instanceof ConversionError) {
        console.log(`Attempt ${attempt} failed: ${error.code} - ${error.message}`)

        if (error.canRetry && attempt < retries) {
          const delay = 2 ** (attempt - 1) * 1000 // Exponential backoff
          console.log(`Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }

      throw error
    }
  }

  throw lastError
}

// Usage
try {
  const outputPath = await robustConversion("https://example.com", "pdf", 3)
  console.log("Conversion successful:", outputPath)
} catch (error) {
  console.error("All conversion attempts failed:", error.message)
}
```

### Performance Monitoring

```typescript
import { HTMLConverter } from "html-converter-cdt"

async function convertWithMetrics(url: string, format: string) {
  const converter = new HTMLConverter({
    enableMetrics: true
  })

  converter.on("metrics", (event) => {
    const { stage, duration, memoryUsage, chromeMetrics } = event.data
    console.log(`Stage: ${stage}, Duration: ${duration}ms, Memory: ${memoryUsage}MB`)
    console.log("Chrome metrics:", chromeMetrics)
  })

  try {
    const result = await converter.convert(url, format)
    console.log("Conversion completed in:", result.metadata.duration)
    return result
  } finally {
    converter.dispose()
  }
}
```

## Error Handling

### Common Error Types

```typescript
import { ConversionError, convert } from "html-converter-cdt"

try {
  const result = await convert("https://example.com", "pdf")
} catch (error) {
  if (error instanceof ConversionError) {
    console.error(`Conversion failed: ${error.code}`)
    console.error(`Message: ${error.message}`)
    console.error(`Category: ${error.category}`)

    if (error.recoverySuggestions.length > 0) {
      console.error("Recovery suggestions:")
      error.recoverySuggestions.forEach((suggestion, index) => {
        console.error(`  ${index + 1}. ${suggestion}`)
      })
    }
  } else {
    console.error("Unexpected error:", error.message)
  }
}
```

### Error Codes and Recovery

```typescript
import { ConversionError } from "html-converter-cdt"

async function handleError(error: ConversionError): Promise<void> {
  switch (error.code) {
    case "TIMEOUT":
      console.error("Conversion timed out. Try increasing timeout or checking network connectivity.")
      break

    case "NETWORK_ERROR":
      console.error("Network error. Check URL accessibility and network configuration.")
      break

    case "CHROME_LAUNCH_FAILED":
      console.error("Chrome launch failed. Check Chrome installation and permissions.")
      break

    case "INVALID_INPUT":
      console.error("Invalid input. Check file format and accessibility.")
      break

    case "CONVERSION_ERROR":
      console.error("Conversion failed. Check HTML content and conversion options.")
      break

    default:
      console.error("Unknown error occurred:", error.message)
  }
}
```

## Performance

### Memory Management

```typescript
import { HTMLConverter } from "html-converter-cdt"

const converter = new HTMLConverter({
  performance: {
    memoryLimit: 512 * 1024 * 1024, // 512MB
    concurrency: 3,
    timeout: 30000
  }
})
```

### Concurrency Control

```typescript
import { HTMLConverter } from "html-converter-cdt"

const converter = new HTMLConverter({
  performance: {
    concurrency: 5,
    maxConcurrent: 10
  }
})

// Convert multiple URLs in parallel
const urls = [
  "https://example.com/page1",
  "https://example.com/page2",
  "https://example.com/page3",
  "https://example.com/page4",
  "https://example.com/page5"
]

const promises = urls.map(url => converter.convert(url, "pdf"))
const results = await Promise.allSettled(promises)
```

### Streaming Large Files

```typescript
import { HTMLConverter } from "html-converter-cdt"

const converter = new HTMLConverter({
  streaming: {
    chunkSize: 1024 * 1024, // 1MB chunks
    enableBackpressure: true
  }
})
```

## Troubleshooting

### Common Issues

#### Chrome Installation Issues

```bash
# Check Chrome installation
google-chrome --version

# Chrome not found error solution:
# Ubuntu/Debian:
sudo apt-get update
sudo apt-get install google-chrome-stable

# macOS:
# Chrome should be installed by default
# If not, download from google.com/chrome

# Windows:
# Download and install Chrome from google.com/chrome
```

#### Permission Issues

```bash
# Linux/macOS: Fix Chrome permissions
sudo chmod +x /usr/bin/google-chrome

# Windows: Run as administrator or adjust permissions
```

#### Memory Issues

```typescript
// Reduce concurrency for memory-constrained environments
const converter = new HTMLConverter({
  performance: {
    concurrency: 1,
    memoryLimit: 256 * 1024 * 1024 // 256MB
  }
})

// Monitor memory usage
converter.on("memory-warning", (event) => {
  console.warn("High memory usage detected:", event.data.usage)
})
```

#### Timeout Issues

```typescript
// Increase timeout for slow conversions
const result = await convert("https://example.com", "pdf", {
  timeout: 60000 // 60 seconds
})
```

### Debug Mode

```typescript
import { HTMLConverter } from "html-converter-cdt"

const converter = new HTMLConverter({
  logging: {
    level: "debug",
    enableDebug: true
  }
})

converter.on("debug", (event) => {
  console.log("Debug:", event.data.message)
})
```

### Getting Help

```bash
# Command line help
html-converter-cdt --help

# Show version
html-converter-cdt --version

# Check configuration
html-converter-cdt --dry-run --verbose --format pdf
```

---

For more detailed information, please refer to the [API documentation](./API.md) and [Architecture Guide](./ARCHITECTURE.md).
