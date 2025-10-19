/**
 * Test utilities for HTML converter testing
 */

import { Buffer } from "node:buffer"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import type { ChromeRemoteInterface } from "chrome-remote-interface"

/**
 * Mock CDP implementation for testing
 */
export class MockCDPClient implements Partial<ChromeRemoteInterface> {
  private callbacks: Map<string, (...args: any[]) => void> = new Map()
  private _connected = true

  async Target() {
    return {
      setDiscoverTargets: () => Promise.resolve(),
      createTarget: () => Promise.resolve({ targetId: "mock-target-id" }),
      closeTarget: () => Promise.resolve(),
      activateTarget: () => Promise.resolve(),
      getTargets: () => Promise.resolve({
        targetInfos: [
          {
            targetId: "mock-target-id",
            type: "page",
            title: "Mock Page",
            url: "http://localhost:3000",
            attached: false,
            canAccessOpener: false,
          },
        ],
      }),
    }
  }

  async Page() {
    return {
      enable: () => Promise.resolve(),
      captureScreenshot: () => Promise.resolve({
        data: Buffer.from("mock-screenshot-data").toString("base64"),
      }),
      printToPDF: () => Promise.resolve({
        data: Buffer.from("mock-pdf-data").toString("base64"),
      }),
      navigate: () => Promise.resolve(),
      loadEventFired: () => Promise.resolve(),
      domContentEventFired: () => Promise.resolve(),
    }
  }

  async Runtime() {
    return {
      enable: () => Promise.resolve(),
      evaluate: () => Promise.resolve({ result: { value: "mock-result" } }),
      compileScript: () => Promise.resolve({ scriptId: "mock-script-id" }),
      runScript: () => Promise.resolve({ result: { value: "mock-result" } }),
    }
  }

  async Network() {
    return {
      enable: () => Promise.resolve(),
      disable: () => Promise.resolve(),
      setUserAgentOverride: () => Promise.resolve(),
      setCacheDisabled: () => Promise.resolve(),
      responseReceived: () => Promise.resolve(),
      loadingFinished: () => Promise.resolve(),
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.callbacks.set(event, callback)
  }

  off(_event: string, _callback: (...args: any[]) => void) {
    // Mock implementation
  }

  async close() {
    this.callbacks.clear()
    this._connected = false
  }

  isConnected(): boolean {
    return this._connected
  }

  connect(): Promise<void> {
    this._connected = true
    return Promise.resolve()
  }

  async evaluate(_expression: string, _options: any = {}): Promise<any> {
    return { result: { value: "mock-result" } }
  }

  async sendCommand(_method: string, _params: any = {}): Promise<any> {
    return {
      success: true,
      result: { data: "mock-data" },
      executionTime: 10,
    }
  }

  addEventListener<T extends keyof any>(event: T, handler: (params: any) => void): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set())
    }
    this.callbacks.get(event)!.add(handler)
  }

  removeEventListener<T extends keyof any>(event: T, handler: (params: any) => void): void {
    const handlers = this.callbacks.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.callbacks.delete(event)
      }
    }
  }
}

/**
 * Test HTTP server for remote URL testing
 */
export class TestHttpServer {
  private server: any
  private port: number

  constructor(port: number = 3001) {
    this.port = port
  }

  async start() {
    return new Promise<void>((resolve) => {
      this.server = createServer((req, res) => {
        const url = req.url || "/"

        if (url === "/") {
          res.writeHead(200, { "Content-Type": "text/html" })
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Test Page</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 20px; }
                  .highlight { background-color: yellow; }
                </style>
              </head>
              <body>
                <h1>Test HTML Page</h1>
                <p>This is a test page for conversion.</p>
                <div class="highlight">Highlighted content</div>
                <img src="/test-image.png" alt="Test Image" />
              </body>
            </html>
          `)
        } else if (url === "/test-image.png") {
          res.writeHead(200, { "Content-Type": "image/png" })
          res.end(Buffer.from("mock-image-data"))
        } else {
          res.writeHead(404)
          res.end("Not Found")
        }
      })

      this.server.listen(this.port, () => {
        // If port was 0, get the actual assigned port
        if (this.port === 0) {
          const address = this.server.address()
          if (address && typeof address === "object") {
            this.port = address.port
          }
        }
        resolve()
      })
    })
  }

  async stop() {
    return new Promise<void>((resolve) => {
      this.server.close(() => {
        resolve()
      })
    })
  }

  getUrl(path: string = "/") {
    return `http://localhost:${this.port}${path}`
  }
}

/**
 * File comparison utilities
 */
export class FileComparisonUtils {
  static async compareFiles(file1: string, file2: string): Promise<boolean> {
    const content1 = readFileSync(file1, "utf-8")
    const content2 = readFileSync(file2, "utf-8")
    return content1 === content2
  }

  static async compareBuffers(file1: string, file2: string): Promise<boolean> {
    const content1 = readFileSync(file1)
    const content2 = readFileSync(file2)
    return Buffer.compare(content1, content2) === 0
  }

  static normalizeLineEndings(content: string): string {
    return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  }

  static normalizeWhitespace(content: string): string {
    return content.replace(/\s+/g, " ").trim()
  }
}

/**
 * Assertion helpers for consistent testing patterns
 */
export class AssertionHelpers {
  static assertValidMHTML(mhtmlContent: string) {
    expect(mhtmlContent).toContain("Content-Type: multipart/related")
    expect(mhtmlContent).toContain("Content-Location:")
    expect(mhtmlContent).toContain("Content-Transfer-Encoding:")
    expect(mhtmlContent).toContain("<!DOCTYPE html>")
  }

  static assertValidPDF(pdfBuffer: Buffer) {
    expect(pdfBuffer.length).toBeGreaterThan(1000) // Minimum PDF size
    expect(pdfBuffer.toString("ascii", 0, 4)).toBe("%PDF") // PDF header
  }

  static assertValidImage(imageBuffer: Buffer, format: "png" | "jpeg" | "webp") {
    const expectedHeaders: Record<string, string> = {
      png: "%PNG",
      jpeg: "\xFF\xD8\xFF",
      webp: "RIFF",
    }

    const header = expectedHeaders[format]
    const actualHeader = imageBuffer.toString("ascii", 0, header.length)
    expect(actualHeader).toBe(header)
  }

  static assertValidMarkdown(markdownContent: string) {
    expect(markdownContent.length).toBeGreaterThan(0)
    // Should contain some markdown elements
    expect(markdownContent).toMatch(/^#+\s/m) // Headers
  }

  static assertValidDOCX(docxBuffer: Buffer) {
    expect(docxBuffer.length).toBeGreaterThan(1000)
    // DOCX files are ZIP files
    expect(docxBuffer.toString("ascii", 0, 2)).toBe("PK")
  }

  static assertConversionResult(result: any, expectedFormat: string) {
    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.format).toBe(expectedFormat)
    expect(result.data).toBeDefined()
  }

  static assertErrorResult(result: any, expectedErrorCode?: string) {
    expect(result).toBeDefined()
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()

    if (expectedErrorCode) {
      expect(result.error.code).toBe(expectedErrorCode)
    }
  }
}

/**
 * Test data generators
 */
export class TestDataGenerators {
  static generateHTML(options: {
    title?: string
    content?: string
    includeStyles?: boolean
    includeScripts?: boolean
    includeImages?: boolean
  } = {}): string {
    const {
      title = "Test HTML Document",
      content = "<p>This is a test HTML document for conversion testing.</p>",
      includeStyles = true,
      includeScripts = false,
      includeImages = false,
    } = options

    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
    `

    if (includeStyles) {
      html += `
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 40px;
            color: #333;
          }
          .highlight {
            background-color: #ffffcc;
            padding: 2px 4px;
            border-radius: 3px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
        </style>
      `
    }

    html += `
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          ${content}
    `

    if (includeImages) {
      html += `
        <img src="test-image.jpg" alt="Test Image" />
        <figure>
          <img src="diagram.png" alt="Test Diagram" />
          <figcaption>Test diagram caption</figcaption>
        </figure>
      `
    }

    if (includeScripts) {
      html += `
        <script>
          console.log('Test script executed');
          document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM loaded');
          });
        </script>
      `
    }

    html += `
        </div>
      </body>
      </html>
    `

    return html.trim()
  }

  static generateComplexHTML(): string {
    return this.generateHTML({
      title: "Complex Test Document",
      content: `
        <h2>Tables</h2>
        <table border="1">
          <thead>
            <tr><th>Name</th><th>Age</th><th>City</th></tr>
          </thead>
          <tbody>
            <tr><td>John Doe</td><td>30</td><td>New York</td></tr>
            <tr><td>Jane Smith</td><td>25</td><td>Los Angeles</td></tr>
          </tbody>
        </table>

        <h2>Lists</h2>
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ul>

        <h2>Form Elements</h2>
        <form>
          <input type="text" placeholder="Enter text" />
          <textarea placeholder="Enter long text"></textarea>
          <select>
            <option>Option 1</option>
            <option>Option 2</option>
          </select>
          <button type="button">Click me</button>
        </form>

        <h2>Media</h2>
        <video controls width="300">
          <source src="test-video.mp4" type="video/mp4">
        </video>
        <audio controls>
          <source src="test-audio.mp3" type="audio/mpeg">
        </audio>

        <h2>Advanced Content</h2>
        <div class="highlight">
          <strong>Bold text</strong>, <em>italic text</em>, and
          <a href="https://example.com">links</a>
        </div>

        <blockquote>
          "This is a blockquote for testing purposes."
        </blockquote>

        <pre><code>function test() {
  console.log('Code block test');
}</code></pre>
      `,
      includeStyles: true,
      includeScripts: true,
      includeImages: true,
    })
  }

  static generateMinimalHTML(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head><title>Minimal</title></head>
        <body><p>Simple content</p></body>
      </html>
    `
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private startTime: number = 0
  private measurements: Array<{ name: string, duration: number }> = []

  start(_label?: string) {
    this.startTime = Date.now()
  }

  measure(label: string): number {
    const duration = Date.now() - this.startTime
    this.measurements.push({ name: label, duration })
    return duration
  }

  getMeasurements() {
    return [...this.measurements]
  }

  reset() {
    this.measurements = []
    this.startTime = 0
  }

  assertMaxDuration(label: string, maxMs: number) {
    const measurement = this.measurements.find(m => m.name === label)
    if (!measurement) {
      throw new Error(`No measurement found for label: ${label}`)
    }
    expect(measurement.duration).toBeLessThanOrEqual(maxMs)
  }
}

/**
 * File system helpers for testing
 */
export class FileSystemHelpers {
  static ensureDir(filePath: string) {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  static writeFile(filePath: string, content: string | Buffer) {
    this.ensureDir(filePath)
    writeFileSync(filePath, content)
  }

  static createTempFile(prefix: string, suffix: string, content: string): string {
    const tempDir = tmpdir()
    const fileName = `${prefix}-${Date.now()}${suffix}`
    const filePath = join(tempDir, fileName)

    writeFileSync(filePath, content)
    return filePath
  }
}
