/**
 * Tests for MHTML Processor with Chrome DevTools Protocol integration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { CDPClient } from "../../../src/architecture/adapters/cdp/types.js"
import type { Logger } from "../../../src/architecture/strategies/types.js"
import { DependencyType, ExternalDependencyDetector, MHTMLProcessor } from "../../../src/core/engine/mhtml-processor.js"

// Mock logger
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Mock CDP client
const mockCDPClient: CDPClient = {
  connect: vi.fn(),
  close: vi.fn(),
  evaluate: vi.fn(),
  sendCommand: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  getStatus: vi.fn().mockReturnValue("connected"),
  getSessions: vi.fn().mockReturnValue([]),
  getSession: vi.fn(),
  getTargets: vi.fn().mockReturnValue([]),
  getTarget: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
}

describe("mHTMLProcessor", () => {
  let processor: MHTMLProcessor

  beforeEach(() => {
    vi.clearAllMocks()
    processor = new MHTMLProcessor(mockLogger)
    processor.setCDPClient(mockCDPClient)

    // Mock the client as already connected to avoid connection issues
    mockCDPClient.isConnected.mockReturnValue(true)
    mockCDPClient.connect.mockResolvedValue()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("capturePageAsMHTML", () => {
    it("should capture a page as MHTML successfully", async () => {
      // Mock CDP responses
      mockCDPClient.sendCommand
        .mockResolvedValueOnce({ success: true, result: { frameId: "test-frame" } })
        .mockResolvedValueOnce({ success: true, result: { result: { value: "Test Page" } } })
        .mockResolvedValueOnce({ success: true, result: { result: { value: "https://example.com" } } })
        .mockResolvedValueOnce({ success: true, result: { data: "mock-mhtml-content" } })

      // Mock page load event
      setTimeout(() => {
        const listeners = (mockCDPClient.addEventListener as any).mock.calls
        const loadListener = listeners.find(([event]) => event === "page.loadEventFired")
        if (loadListener) {
          loadListener[1]({ timestamp: Date.now() })
        }
      }, 10)

      const result = await processor.capturePageAsMHTML("https://example.com")

      expect(result).toBe("mock-mhtml-content")
      expect(mockCDPClient.sendCommand).toHaveBeenCalledWith("Page.navigate", {
        url: "https://example.com",
      })
      expect(mockCDPClient.sendCommand).toHaveBeenCalledWith("Page.captureSnapshot", {
        format: "mhtml",
      })
    })

    it("should handle page capture errors gracefully", async () => {
      mockCDPClient.sendCommand.mockRejectedValue(new Error("Navigation failed"))

      await expect(processor.capturePageAsMHTML("https://example.com")).rejects.toThrow(
        "MHTML capture failed: Navigation failed",
      )
    })

    it("should use custom options", async () => {
      const options = {
        userAgent: "TestAgent/1.0",
        viewport: { width: 1200, height: 800 },
        timeout: 60000,
        waitTime: 2000,
      }

      mockCDPClient.sendCommand
        .mockResolvedValue({ success: true, result: { frameId: "test-frame" } })
        .mockResolvedValue({ success: true, result: { data: "mock-mhtml" } })

      // Mock page load
      setTimeout(() => {
        const listeners = (mockCDPClient.addEventListener as any).mock.calls
        const loadListener = listeners.find(([event]) => event === "page.loadEventFired")
        if (loadListener) {
          loadListener[1]({ timestamp: Date.now() })
        }
      }, 10)

      await processor.capturePageAsMHTML("https://example.com", options)

      expect(mockCDPClient.sendCommand).toHaveBeenCalledWith("Network.setUserAgentOverride", {
        userAgent: "TestAgent/1.0",
      })
      expect(mockCDPClient.sendCommand).toHaveBeenCalledWith("Emulation.setDeviceMetricsOverride", {
        width: 1200,
        height: 800,
        deviceScaleFactor: 1,
        mobile: false,
      })
    })
  })

  describe("getPageInfo", () => {
    it("should get page information successfully", async () => {
      const mockPageInfo = {
        title: "Test Page",
        url: "https://example.com",
        resources: ["https://example.com/style.css", "https://example.com/script.js"],
      }

      mockCDPClient.sendCommand
        .mockResolvedValueOnce({ success: true, result: { frameId: "test-frame" } })
        .mockResolvedValueOnce({
          success: true,
          result: {
            result: {
              value: mockPageInfo,
            },
          },
        })

      // Mock page load
      setTimeout(() => {
        const listeners = (mockCDPClient.addEventListener as any).mock.calls
        const loadListener = listeners.find(([event]) => event === "page.loadEventFired")
        if (loadListener) {
          loadListener[1]({ timestamp: Date.now() })
        }
      }, 10)

      const result = await processor.getPageInfo("https://example.com")

      expect(result).toEqual(mockPageInfo)
      expect(mockLogger.info).toHaveBeenCalledWith("Page information retrieved", {
        url: "https://example.com",
        title: "Test Page",
        resourceCount: 2,
      })
    })

    it("should handle page info errors gracefully", async () => {
      mockCDPClient.sendCommand.mockRejectedValue(new Error("Failed to get page info"))

      await expect(processor.getPageInfo("https://example.com")).rejects.toThrow(
        "Failed to get page information: Failed to get page info",
      )
    })
  })

  describe("cDP client management", () => {
    it("should throw error when CDP client is not set", async () => {
      const processorWithoutClient = new MHTMLProcessor(mockLogger)

      await expect(processorWithoutClient.capturePageAsMHTML("https://example.com")).rejects.toThrow(
        "CDP client not available",
      )
    })

    it("should handle connection failures gracefully", async () => {
      mockCDPClient.isConnected.mockReturnValue(false)
      mockCDPClient.connect.mockRejectedValue(new Error("Connection failed"))

      await expect(processor.capturePageAsMHTML("https://example.com")).rejects.toThrow(
        "Failed to establish CDP connection",
      )
    })
  })

  describe("metadata extraction", () => {
    it("should extract page metadata correctly", async () => {
      mockCDPClient.sendCommand
        .mockResolvedValue({ success: true, result: { frameId: "test-frame" } })
        .mockResolvedValue({ success: true, result: { result: { value: "Test Page Title" } } })
        .mockResolvedValue({ success: true, result: { result: { value: "https://example.com" } } })
        .mockResolvedValue({ success: true, result: { result: { value: "Chrome/91.0" } } })
        .mockResolvedValue({ success: true, result: { result: { value: [] } } })
        .mockResolvedValue({ success: true, result: { data: "mock-mhtml" } })

      // Mock page load
      setTimeout(() => {
        const listeners = (mockCDPClient.addEventListener as any).mock.calls
        const loadListener = listeners.find(([event]) => event === "page.loadEventFired")
        if (loadListener) {
          loadListener[1]({ timestamp: Date.now() })
        }
      }, 10)

      await processor.capturePageAsMHTML("https://example.com")

      expect(mockCDPClient.sendCommand).toHaveBeenCalledWith("Runtime.evaluate", {
        expression: "document.title",
        returnByValue: true,
      })
      expect(mockCDPClient.sendCommand).toHaveBeenCalledWith("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true,
      })
    })
  })

  describe("resource detection", () => {
    it("should detect external resources correctly", async () => {
      const mockResources = [
        "https://example.com/style.css",
        "https://example.com/script.js",
        "https://example.com/image.png",
      ]

      mockCDPClient.sendCommand
        .mockResolvedValue({ success: true, result: { frameId: "test-frame" } })
        .mockResolvedValue({ success: true, result: { result: { value: "Test Page" } } })
        .mockResolvedValue({ success: true, result: { result: { value: mockResources } } })
        .mockResolvedValue({ success: true, result: { data: "mock-mhtml" } })

      // Mock page load
      setTimeout(() => {
        const listeners = (mockCDPClient.addEventListener as any).mock.calls
        const loadListener = listeners.find(([event]) => event === "page.loadEventFired")
        if (loadListener) {
          loadListener[1]({ timestamp: Date.now() })
        }
      }, 10)

      await processor.capturePageAsMHTML("https://example.com")

      expect(mockCDPClient.sendCommand).toHaveBeenCalledWith("Runtime.evaluate", {
        expression: expect.stringContaining("document.querySelectorAll"),
        returnByValue: true,
      })
    })
  })

  describe("externalDependencyDetector", () => {
    let detector: ExternalDependencyDetector

    beforeEach(() => {
      vi.clearAllMocks()
      detector = new ExternalDependencyDetector(mockLogger)
    })

    describe("detectExternalDependencies", () => {
      it("should detect all types of dependencies in HTML content", () => {
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Test Page</title>
            <link rel="stylesheet" href="https://example.com/style.css">
            <link rel="stylesheet" href="https://cdn.example.com/bootstrap.min.css" media="screen">
            <script src="https://example.com/script.js"></script>
            <link rel="icon" href="https://example.com/favicon.ico">
            <link rel="manifest" href="https://example.com/manifest.json">
            <style>
              @import url("https://fonts.googleapis.com/css?family=Roboto");
              @font-face {
                src: url("https://example.com/custom-font.woff2");
              }
            </style>
          </head>
          <body>
            <img src="https://example.com/image.jpg" alt="Test Image">
            <img srcset="https://example.com/image-small.jpg 480w, https://example.com/image-large.jpg 1024w"
                 src="https://example.com/image-default.jpg" alt="Responsive Image">
            <iframe src="https://example.com/embedded.html"></iframe>
            <embed src="https://example.com/content.swf" type="application/x-shockwave-flash">
            <object data="https://example.com/object.pdf" type="application/pdf"></object>
            <video src="https://example.com/video.mp4" poster="https://example.com/poster.jpg">
              <source src="https://example.com/video.webm" type="video/webm">
            </video>
            <audio>
              <source src="https://example.com/audio.mp3" type="audio/mpeg">
            </audio>
            <link rel="prefetch" href="https://example.com/next-page.html">
            <link rel="preload" href="https://example.com/important.css" as="style">
            <a href="https://external.com/link">External Link</a>
          </body>
          </html>
        `

        const dependencies = detector.detectExternalDependencies(html, "https://example.com")

        expect(dependencies.length).toBeGreaterThanOrEqual(15) // Allow for some variation in detection

        // Check stylesheet dependencies
        const stylesheets = dependencies.filter(dep => dep.type === DependencyType.STYLESHEET)
        expect(stylesheets).toHaveLength(2)
        expect(stylesheets.map(s => s.url)).toContain("https://example.com/style.css")
        expect(stylesheets.map(s => s.url)).toContain("https://cdn.example.com/bootstrap.min.css")

        // Check script dependencies
        const scripts = dependencies.filter(dep => dep.type === DependencyType.SCRIPT)
        expect(scripts).toHaveLength(1)
        expect(scripts[0].url).toBe("https://example.com/script.js")

        // Check image dependencies
        const images = dependencies.filter(dep => dep.type === DependencyType.IMAGE)
        expect(images).toHaveLength(4) // 1 img src + 3 srcset images

        // Check CSS imports
        const cssImports = dependencies.filter(dep => dep.type === DependencyType.CSS_IMPORT)
        expect(cssImports).toHaveLength(1)
        expect(cssImports[0].url).toBe("https://fonts.googleapis.com/css?family=Roboto")

        // Check font dependencies
        const fonts = dependencies.filter(dep => dep.type === DependencyType.FONT)
        expect(fonts).toHaveLength(1)
        expect(fonts[0].url).toBe("https://example.com/custom-font.woff2")

        // Check other dependency types
        expect(dependencies.some(dep => dep.type === DependencyType.IFRAME)).toBe(true)
        expect(dependencies.some(dep => dep.type === DependencyType.VIDEO)).toBe(true)
        expect(dependencies.some(dep => dep.type === DependencyType.AUDIO)).toBe(true)
        expect(dependencies.some(dep => dep.type === DependencyType.ICON)).toBe(true)
      })

      it("should handle relative URLs correctly", () => {
        const html = `
          <html>
          <head>
            <link rel="stylesheet" href="/styles/main.css">
            <script src="scripts/app.js"></script>
          </head>
          <body>
            <img src="images/logo.png" alt="Logo">
            <img srcset="images/logo-small.png 100w, images/logo-large.png 200w" src="images/logo.png">
          </body>
          </html>
        `

        const dependencies = detector.detectExternalDependencies(html, "https://example.com")

        expect(dependencies.length).toBeGreaterThanOrEqual(4)

        // Check that relative URLs are resolved correctly
        const stylesheetUrl = dependencies.find(dep => dep.type === DependencyType.STYLESHEET)?.url
        expect(stylesheetUrl).toBe("https://example.com/styles/main.css")

        const scriptUrl = dependencies.find(dep => dep.type === DependencyType.SCRIPT)?.url
        expect(scriptUrl).toBe("https://example.com/scripts/app.js")

        const imageUrls = dependencies.filter(dep => dep.type === DependencyType.IMAGE).map(dep => dep.url)
        expect(imageUrls).toContain("https://example.com/images/logo.png")
        expect(imageUrls).toContain("https://example.com/images/logo-small.png")
        expect(imageUrls).toContain("https://example.com/images/logo-large.png")
      })

      it("should ignore invalid URLs", () => {
        const html = `
          <html>
          <body>
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" alt="Embedded Image">
            <a href="mailto:test@example.com">Email</a>
            <script src="javascript:void(0)"></script>
            <link href="#section" rel="stylesheet">
            <img src="file:///local/file.jpg" alt="Local File">
          </body>
          </html>
        `

        const dependencies = detector.detectExternalDependencies(html, "https://example.com")

        expect(dependencies).toHaveLength(0)
      })

      it("should extract metadata correctly", () => {
        const html = `
          <html>
          <head>
            <link rel="stylesheet" href="https://example.com/style.css"
                  media="screen and (max-width: 768px)"
                  crossorigin="anonymous"
                  integrity="sha384-...">
          </head>
          <body>
            <img src="https://example.com/image.jpg" sizes="(max-width: 600px) 100vw, 50vw">
          </body>
          </html>
        `

        const dependencies = detector.detectExternalDependencies(html, "https://example.com")

        const stylesheet = dependencies.find(dep => dep.type === DependencyType.STYLESHEET)
        expect(stylesheet?.metadata).toEqual({
          media: "screen and (max-width: 768px)",
          crossorigin: "anonymous",
          integrity: "sha384-...",
          rel: "stylesheet",
        })

        const image = dependencies.find(dep => dep.type === DependencyType.IMAGE)
        expect(image?.metadata?.sizes).toBe("(max-width: 600px) 100vw, 50vw")
      })

      it("should deduplicate dependencies", () => {
        const html = `
          <html>
          <head>
            <link rel="stylesheet" href="https://example.com/style.css">
            <link rel="stylesheet" href="https://example.com/style.css"> <!-- Duplicate -->
            <script src="https://example.com/script.js"></script>
          </head>
          <body>
            <img src="https://example.com/image.jpg">
            <img src="https://example.com/image.jpg"> <!-- Duplicate -->
          </body>
          </html>
        `

        const dependencies = detector.detectExternalDependencies(html, "https://example.com")

        expect(dependencies).toHaveLength(3) // Only unique dependencies
      })
    })

    describe("utility methods", () => {
      const mockDependencies = [
        { url: "https://example.com/style.css", type: DependencyType.STYLESHEET, isRelative: false, isSecure: true },
        { url: "http://insecure.com/script.js", type: DependencyType.SCRIPT, isRelative: false, isSecure: false },
        { url: "/styles/local.css", type: DependencyType.STYLESHEET, isRelative: true, isSecure: true },
        { url: "images/local.png", type: DependencyType.IMAGE, isRelative: true, isSecure: false },
      ] as any

      it("should filter dependencies by type", () => {
        const stylesheets = detector.getDependenciesByType(mockDependencies, DependencyType.STYLESHEET)
        expect(stylesheets).toHaveLength(2)
        expect(stylesheets.every(s => s.type === DependencyType.STYLESHEET)).toBe(true)
      })

      it("should filter external dependencies only", () => {
        const external = detector.getExternalDependencies(mockDependencies)
        expect(external).toHaveLength(2)
        expect(external.every(e => !e.isRelative)).toBe(true)
      })

      it("should filter secure dependencies only", () => {
        const secure = detector.getSecureDependencies(mockDependencies)
        expect(secure).toHaveLength(2)
        expect(secure.every(s => s.isSecure)).toBe(true)
      })
    })

    describe("edge cases", () => {
      it("should handle malformed HTML gracefully", () => {
        const malformedHtml = `
          <html>
          <head>
            <link rel="stylesheet" href="https://example.com/style.css"
            <script src="https://example.com/script.js"  <!-- Missing closing tag -->
            <img src="https://example.com/image.jpg" alt="No closing quote
          </head>
          <body>
            <iframe src="https://example.com/frame.html"></iframe>
          </body>
        `

        expect(() => {
          detector.detectExternalDependencies(malformedHtml, "https://example.com")
        }).not.toThrow()
      })

      it("should handle empty HTML content", () => {
        const dependencies = detector.detectExternalDependencies("", "https://example.com")
        expect(dependencies).toHaveLength(0)
      })

      it("should handle HTML with no external dependencies", () => {
        const html = `
          <html>
          <head>
            <style>
              body { color: red; }
            </style>
            <script>
              console.log('inline script');
            </script>
          </head>
          <body>
            <h1>Internal Content</h1>
            <div>No external resources</div>
          </body>
          </html>
        `

        const dependencies = detector.detectExternalDependencies(html, "https://example.com")
        expect(dependencies).toHaveLength(0)
      })
    })
  })

  describe("external dependency analysis integration", () => {
    let processor: MHTMLProcessor

    beforeEach(() => {
      vi.clearAllMocks()
      processor = new MHTMLProcessor(mockLogger)
      processor.setCDPClient(mockCDPClient)
    })

    it("should analyze external dependencies in HTML content", async () => {
      const html = `
        <html>
        <head>
          <link rel="stylesheet" href="https://example.com/style.css">
          <script src="https://example.com/script.js"></script>
        </head>
        <body>
          <img src="https://example.com/image.jpg">
        </body>
        </html>
      `

      const result = await processor.analyzeExternalDependencies(html, "https://example.com")

      expect(result.dependencies).toHaveLength(3)
      expect(result.summary.total).toBe(3)
      expect(result.summary.byType[DependencyType.STYLESHEET]).toBe(1)
      expect(result.summary.byType[DependencyType.SCRIPT]).toBe(1)
      expect(result.summary.byType[DependencyType.IMAGE]).toBe(1)
      expect(result.summary.external).toBe(3)
      expect(result.summary.secure).toBe(3)
      expect(result.summary.relative).toBe(0)
    })

    it("should get dependencies by type from URL", async () => {
      const html = `
        <html>
        <head>
          <link rel="stylesheet" href="https://example.com/style.css">
          <script src="https://example.com/script.js"></script>
        </head>
        <body>
          <img src="https://example.com/image.jpg">
        </body>
        </html>
      `

      mockCDPClient.sendCommand
        .mockResolvedValueOnce({ success: true, result: { frameId: "test-frame" } })
        .mockResolvedValueOnce({
          success: true,
          result: { result: { value: html } },
        })

      // Mock page load
      setTimeout(() => {
        const listeners = (mockCDPClient.addEventListener as any).mock.calls
        const loadListener = listeners.find(([event]) => event === "page.loadEventFired")
        if (loadListener) {
          loadListener[1]({ timestamp: Date.now() })
        }
      }, 10)

      const dependencies = await processor.getDependenciesByType("https://example.com", DependencyType.STYLESHEET)

      expect(dependencies).toHaveLength(1)
      expect(dependencies[0].type).toBe(DependencyType.STYLESHEET)
      expect(dependencies[0].url).toBe("https://example.com/style.css")
    })
  })
})
