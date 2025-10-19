/**
 * E2E Test Helpers
 *
 * Utility functions for end-to-end testing of HTML conversion workflows
 */

import { Buffer } from "node:buffer"
import { exec } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export interface ConversionTestResult {
  success: boolean
  format: string
  data?: Buffer | string
  error?: string
  metadata?: {
    size: number
    duration: number
    timestamp: string
  }
}

export interface TestFixture {
  name: string
  html: string
  expectedFormat: string
  options?: any
}

/**
 * E2E Test Helper Class
 */
export class E2ETestHelpers {
  private tempDir: string
  private testResults: ConversionTestResult[] = []

  constructor() {
    this.tempDir = (globalThis as any).__E2E_TEMP_DIR__ || "/tmp/html-converter-e2e-tests"
    this.ensureTempDir()
  }

  private ensureTempDir() {
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true })
    }
  }

  /**
   * Get the temporary directory for test files
   */
  getTempDir(): string {
    return this.tempDir
  }

  /**
   * Create a temporary file with content
   */
  createTempFile(fileName: string, content: string | Buffer): string {
    const filePath = join(this.tempDir, fileName)
    writeFileSync(filePath, content)
    return filePath
  }

  /**
   * Read a temporary file
   */
  readTempFile(fileName: string): Buffer {
    const filePath = join(this.tempDir, fileName)
    return readFileSync(filePath)
  }

  /**
   * Execute CLI command for conversion
   */
  async executeCLICommand(args: string[]): Promise<{ stdout: string, stderr: string, exitCode: number }> {
    try {
      const cliPath = join(process.cwd(), "dist", "index.js")
      const command = `node ${cliPath} ${args.join(" ")}`

      console.log(`🔧 Executing CLI: ${command}`)

      const result = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 60000,
      })

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      }
    } catch (error: any) {
      return {
        stdout: error.stdout || "",
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
      }
    }
  }

  /**
   * Convert URL to specified format using the library directly
   */
  async convertURL(
    url: string,
    format: string,
    options: any = {},
  ): Promise<ConversionTestResult> {
    const startTime = Date.now()

    try {
      // Import the converter library
      const { convert } = await import("../../dist/index.js")

      console.log(`🔄 Converting ${url} to ${format}`)

      const result = await convert(url, format, options)

      const duration = Date.now() - startTime
      const testResult: ConversionTestResult = {
        success: true,
        format,
        data: result.data,
        metadata: {
          size: Buffer.isBuffer(result.data) ? result.data.length : Buffer.byteLength(result.data, "utf-8"),
          duration,
          timestamp: new Date().toISOString(),
        },
      }

      this.testResults.push(testResult)
      return testResult
    } catch (error) {
      const duration = Date.now() - startTime
      const testResult: ConversionTestResult = {
        success: false,
        format,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          size: 0,
          duration,
          timestamp: new Date().toISOString(),
        },
      }

      this.testResults.push(testResult)
      return testResult
    }
  }

  /**
   * Convert HTML content to specified format
   */
  async convertHTML(
    html: string,
    format: string,
    options: any = {},
  ): Promise<ConversionTestResult> {
    const startTime = Date.now()

    try {
      // Create temporary HTML file
      const tempHtmlFile = this.createTempFile(`test-${Date.now()}.html`, html)
      const fileUrl = `file://${tempHtmlFile}`

      const result = await this.convertURL(fileUrl, format, options)

      // Clean up temp file
      unlinkSync(tempHtmlFile)

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        success: false,
        format,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          size: 0,
          duration,
          timestamp: new Date().toISOString(),
        },
      }
    }
  }

  /**
   * Validate MHTML conversion result
   */
  validateMHTMLResult(result: ConversionTestResult): boolean {
    if (!result.success || !result.data) {
      return false
    }

    const content = Buffer.isBuffer(result.data)
      ? result.data.toString("utf-8")
      : result.data

    return content.includes("Content-Type: multipart/related")
      && content.includes("Content-Location:")
      && content.includes("Content-Transfer-Encoding:")
      && content.includes("<!DOCTYPE html")
  }

  /**
   * Validate PDF conversion result
   */
  validatePDFResult(result: ConversionTestResult): boolean {
    if (!result.success || !Buffer.isBuffer(result.data)) {
      return false
    }

    return result.data.length > 1000
      && result.data.toString("ascii", 0, 4) === "%PDF"
  }

  /**
   * Validate image conversion result
   */
  validateImageResult(result: ConversionTestResult, format: "png" | "jpeg" | "webp"): boolean {
    if (!result.success || !Buffer.isBuffer(result.data)) {
      return false
    }

    const expectedHeaders: Record<string, string> = {
      png: "%PNG",
      jpeg: "\xFF\xD8\xFF",
      webp: "RIFF",
    }

    const header = expectedHeaders[format]
    const actualHeader = result.data.toString("ascii", 0, header.length)
    return actualHeader === header
  }

  /**
   * Save test result to file
   */
  saveTestResult(result: ConversionTestResult, fileName: string): string {
    const filePath = join(this.tempDir, fileName)

    if (result.data) {
      writeFileSync(filePath, result.data)
    }

    // Save metadata
    const metadataPath = filePath + ".meta.json"
    writeFileSync(metadataPath, JSON.stringify(result.metadata, null, 2))

    return filePath
  }

  /**
   * Get all test results
   */
  getTestResults(): ConversionTestResult[] {
    return [...this.testResults]
  }

  /**
   * Clear test results
   */
  clearTestResults(): void {
    this.testResults = []
  }

  /**
   * Generate test report
   */
  generateTestReport(): string {
    const successful = this.testResults.filter(r => r.success).length
    const failed = this.testResults.filter(r => r.success === false).length
    const total = this.testResults.length

    const avgDuration = this.testResults.reduce((sum, r) => sum + (r.metadata?.duration || 0), 0) / total

    const report = `
# E2E Test Report

## Summary
- Total Tests: ${total}
- Successful: ${successful}
- Failed: ${failed}
- Success Rate: ${((successful / total) * 100).toFixed(2)}%
- Average Duration: ${avgDuration.toFixed(2)}ms

## Results
${this.testResults.map((result, index) => `
### Test ${index + 1}
- Format: ${result.format}
- Success: ${result.success}
- Size: ${result.metadata?.size || 0} bytes
- Duration: ${result.metadata?.duration || 0}ms
- Error: ${result.error || "None"}
`).join("")}
`

    return report
  }

  /**
   * Save test report to file
   */
  saveTestReport(fileName: string = "test-report.md"): string {
    const report = this.generateTestReport()
    const filePath = join(this.tempDir, fileName)
    writeFileSync(filePath, report)
    return filePath
  }

  /**
   * Wait for Chrome CDP to be available
   */
  async waitForChromeCDP(port: number = 9222, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/json/version`)
        if (response.ok) {
          return true
        }
      } catch {
        // Chrome not ready yet, continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return false
  }

  /**
   * Get Chrome process info
   */
  async getChromeProcesses(): Promise<any[]> {
    try {
      const { stdout } = await execAsync("ps aux | grep -i chrome | grep -v grep")
      return stdout.split("\n")
        .filter(line => line.trim())
        .map((line) => {
          const parts = line.trim().split(/\s+/)
          return {
            pid: parts[1],
            command: parts.slice(10).join(" "),
          }
        })
    } catch {
      return []
    }
  }

  /**
   * Cleanup Chrome processes
   */
  async cleanupChromeProcesses(): Promise<void> {
    try {
      await execAsync("pkill -f \"chrome.*remote-debugging-port\" || true")
      console.log("🧹 Cleaned up Chrome processes")
    } catch {
      console.error("❌ Error cleaning up Chrome processes")
    }
  }

  /**
   * Setup test environment
   */
  async setupTestEnvironment(): Promise<void> {
    console.log("🔧 Setting up E2E test environment...")

    // Ensure temp directory exists
    this.ensureTempDir()

    // Wait for Chrome to be ready
    const chromeReady = await this.waitForChromeCDP()
    if (!chromeReady) {
      console.warn("⚠️ Chrome CDP not available, some tests may fail")
    } else {
      console.log("✅ Chrome CDP is ready")
    }

    // Check test server health
    try {
      const response = await fetch("http://localhost:3001/health")
      if (response.ok) {
        console.log("✅ Test server is healthy")
      } else {
        console.warn("⚠️ Test server health check failed")
      }
    } catch {
      console.warn("⚠️ Test server not available")
    }
  }

  /**
   * Cleanup test environment
   */
  async cleanupTestEnvironment(): Promise<void> {
    console.log("🧹 Cleaning up E2E test environment...")

    // Clear test results
    this.clearTestResults()

    // Save final test report
    this.saveTestReport("final-test-report.md")

    // Cleanup Chrome processes (only in test environment)
    if (process.env.NODE_ENV === "test") {
      await this.cleanupChromeProcesses()
    }
  }
}

/**
 * Test fixtures for common conversion scenarios
 */
export const TestFixtures: Record<string, TestFixture> = {
  simple: {
    name: "simple",
    html: "<!DOCTYPE html><html><head><title>Simple</title></head><body><h1>Simple Test</h1><p>Basic content</p></body></html>",
    expectedFormat: "mhtml",
  },

  styled: {
    name: "styled",
    html: `<!DOCTYPE html>
<html>
<head>
  <title>Styled Page</title>
  <style>
    body { font-family: Arial; margin: 20px; }
    .highlight { background: yellow; padding: 5px; }
  </style>
</head>
<body>
  <h1>Styled Content</h1>
  <p class="highlight">This text is highlighted</p>
</body>
</html>`,
    expectedFormat: "mhtml",
  },

  withImages: {
    name: "with-images",
    html: `<!DOCTYPE html>
<html>
<head><title>Images</title></head>
<body>
  <h1>Image Test</h1>
  <img src="/test-image.png" alt="Test Image" />
</body>
</html>`,
    expectedFormat: "mhtml",
  },

  complex: {
    name: "complex",
    html: `<!DOCTYPE html>
<html>
<head>
  <title>Complex Page</title>
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>Complex Content</h1>
  <table>
    <thead><tr><th>Name</th><th>Value</th></tr></thead>
    <tbody><tr><td>Test</td><td>123</td></tr></tbody>
  </table>
  <ul><li>Item 1</li><li>Item 2</li></ul>
  <blockquote>This is a quote</blockquote>
</body>
</html>`,
    expectedFormat: "mhtml",
  },
}

/**
 * Default export for convenience
 */
export default E2ETestHelpers
