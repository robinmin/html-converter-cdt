/**
 * Unit tests for MHTML Processor
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { CDPClient } from "../../../../src/architecture/adapters/cdp/CDPClient"
import type { Logger } from "../../../../src/architecture/strategies/types"
import { DependencyType, ExternalDependencyDetector, MHTMLProcessor } from "../../../../src/core/engine/mhtml-processor"
import { TestDataGenerators } from "../../../utils/test-helpers"

describe("mHTMLProcessor", () => {
  let mhtmlProcessor: MHTMLProcessor
  let mockLogger: Logger
  let mockCDPClient: CDPClient

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    mockCDPClient = {
      isConnected: () => true,
      connect: () => Promise.resolve(),
      close: () => Promise.resolve(),
      evaluate: (_expression: string) => Promise.resolve({ result: { value: "mock-result" } }),
      sendCommand: (_method: string, _params: any) => Promise.resolve({
        success: true,
        result: { data: "mock-data" },
        executionTime: 10,
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      getStatus: () => "connected",
      getSessions: () => [],
      getSession: () => undefined,
      getTargets: () => [],
      getTarget: () => undefined,
    }

    mhtmlProcessor = new MHTMLProcessor(mockLogger, {
      headless: true,
      connectionTimeout: 5000,
      pageTimeout: 5000,
    })
  })

  describe("constructor", () => {
    it("should initialize with default configuration", () => {
      void new MHTMLProcessor(mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith("MHTML Processor initialized", {
        headless: true,
        connectionTimeout: 30000,
        pageTimeout: 30000,
      })
    })

    it("should merge user configuration with defaults", () => {
      const customConfig = {
        headless: false,
        connectionTimeout: 10000,
        chromeArgs: ["--custom-flag"],
      }

      void new MHTMLProcessor(mockLogger, customConfig)

      expect(mockLogger.info).toHaveBeenCalledWith("MHTML Processor initialized", {
        headless: false,
        connectionTimeout: 10000,
        pageTimeout: 30000,
      })
    })
  })

  describe("setCDPClient", () => {
    it("should set CDP client and update connection status", () => {
      mhtmlProcessor.setCDPClient(mockCDPClient)

      expect(mockLogger.info).toHaveBeenCalledWith("CDP client instance set", {
        connected: true,
      })
    })

    it("should handle disconnected CDP client", () => {
      const disconnectedClient = { ...mockCDPClient, isConnected: () => false }
      mhtmlProcessor.setCDPClient(disconnectedClient)

      expect(mockLogger.info).toHaveBeenCalledWith("CDP client instance set", {
        connected: false,
      })
    })
  })

  describe("capturePageAsMHTML", () => {
    beforeEach(() => {
      mhtmlProcessor.setCDPClient(mockCDPClient)
    })

    it("should capture page as MHTML successfully", async () => {
      const mockMHTML = `
        From: <test@example.com>
        Subject: Test Page
        Content-Type: multipart/related; boundary="----=_boundary"

        ------=_boundary
        Content-Type: text/html; charset=utf-8
        Content-Location: http://example.com

        <!DOCTYPE html><html><head><title>Test</title></head><body><p>Test content</p></body></html>
        ------=_boundary--
      `

      let loadListener: ((params: any) => void) | null = null

      // Mock CDP client responses
      const enhancedMockClient = {
        ...mockCDPClient,
        sendCommand: vi.fn().mockImplementation((method, params) => {
          switch (method) {
            case "Page.navigate":
              // Simulate page load event firing shortly after navigation
              setTimeout(() => {
                if (loadListener) {
                  loadListener({ timestamp: Date.now() })
                }
              }, 10)
              return Promise.resolve({ success: true, result: { frameId: "frame-123" } })
            case "Page.captureSnapshot":
              return Promise.resolve({ success: true, result: { data: mockMHTML } })
            case "Runtime.evaluate":
              // Return different values based on the expression
              if (params?.expression?.includes("document.title")) {
                return Promise.resolve({ success: true, result: { value: "Test Title" } })
              } else if (params?.expression?.includes("window.location.href")) {
                return Promise.resolve({ success: true, result: { value: "https://example.com" } })
              } else if (params?.expression?.includes("navigator.userAgent")) {
                return Promise.resolve({ success: true, result: { value: "Mozilla/5.0 Test Browser" } })
              } else if (params?.expression?.includes("document.documentElement.outerHTML")) {
                return Promise.resolve({
                  success: true,
                  result: {
                    value: TestDataGenerators.generateHTML({
                      includeStyles: true,
                      includeScripts: true,
                      includeImages: true,
                    }),
                  },
                })
              } else if (params?.expression?.includes("title") && params?.expression?.includes("url") && params?.expression?.includes("html")) {
                return Promise.resolve({
                  success: true,
                  result: {
                    value: {
                      title: "Test Title",
                      url: "https://example.com",
                      html: TestDataGenerators.generateHTML({
                        includeStyles: true,
                        includeScripts: true,
                        includeImages: true,
                      }),
                    },
                  },
                })
              }
              return Promise.resolve({ success: true, result: { value: "Test Title" } })
            default:
              return Promise.resolve({ success: true, result: {} })
          }
        }),
        addEventListener: vi.fn().mockImplementation((event, handler) => {
          if (event === "page.loadEventFired") {
            loadListener = handler
          }
        }),
        removeEventListener: vi.fn(),
      }

      mhtmlProcessor.setCDPClient(enhancedMockClient)

      const result = await mhtmlProcessor.capturePageAsMHTML("https://example.com")

      expect(result).toBe(mockMHTML)
      expect(mockLogger.info).toHaveBeenCalledWith("MHTML capture completed", {
        url: "https://example.com",
        title: expect.any(String), // Title may be empty depending on mock implementation
        contentLength: mockMHTML.length,
        resourceCount: expect.any(Number),
      })
    }, 10000) // Increase timeout to 10 seconds

    it("should handle navigation failures", async () => {
      const failingClient = {
        ...mockCDPClient,
        sendCommand: vi.fn().mockResolvedValue({
          success: false,
          error: "Navigation failed",
        }),
      }

      mhtmlProcessor.setCDPClient(failingClient)

      await expect(mhtmlProcessor.capturePageAsMHTML("https://example.com"))
        .rejects.toThrow("MHTML capture failed: Navigation failed: Navigation failed")

      expect(mockLogger.error).toHaveBeenCalledWith("Failed to capture page as MHTML", expect.any(Error), {
        url: "https://example.com",
      })
    })

    it("should handle missing CDP client", async () => {
      const processor = new MHTMLProcessor(mockLogger)
      // Don't set CDP client

      await expect(processor.capturePageAsMHTML("https://example.com"))
        .rejects.toThrow("MHTML capture failed: CDP client not available. Please set a CDP client instance.")
    })
  })

  describe("analyzeExternalDependencies", () => {
    it("should analyze HTML dependencies correctly", async () => {
      const html = TestDataGenerators.generateComplexHTML()

      const result = await mhtmlProcessor.analyzeExternalDependencies(html, "https://example.com")

      expect(result.dependencies).toBeInstanceOf(Array)
      expect(result.summary).toEqual({
        total: expect.any(Number),
        byType: expect.any(Object),
        external: expect.any(Number),
        secure: expect.any(Number),
        relative: expect.any(Number),
      })

      expect(mockLogger.info).toHaveBeenCalledWith("External dependency analysis completed", result.summary)
    })

    it("should handle analysis errors", async () => {
      // Mock dependency detector to throw error
      const detector = new ExternalDependencyDetector(mockLogger)
      vi.spyOn(detector, "detectExternalDependencies").mockImplementation(() => {
        throw new Error("Detection failed")
      })

      mhtmlProcessor.dependencyDetector = detector

      await expect(mhtmlProcessor.analyzeExternalDependencies("<html></html>"))
        .rejects.toThrow("External dependency analysis failed: Detection failed")
    })
  })
})

describe("externalDependencyDetector", () => {
  let detector: ExternalDependencyDetector
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    detector = new ExternalDependencyDetector(mockLogger)
  })

  describe("detectExternalDependencies", () => {
    it("should detect basic dependencies in HTML", () => {
      const html = TestDataGenerators.generateHTML({
        includeStyles: true,
        includeScripts: true,
        includeImages: true,
      })

      const dependencies = detector.detectExternalDependencies(html)

      expect(dependencies).toBeInstanceOf(Array)
      // Should detect external images (test-image.jpg, diagram.png)
      expect(dependencies.length).toBeGreaterThanOrEqual(2)

      // Check that we have image dependencies (the only external resources in the generated HTML)
      const types = dependencies.map(dep => dep.type)
      expect(types).toContain(DependencyType.IMAGE)

      // Verify the specific image URLs are detected
      const urls = dependencies.map(dep => dep.url)
      expect(urls).toContain("test-image.jpg")
      expect(urls).toContain("diagram.png")
    })

    it("should handle empty HTML", () => {
      const dependencies = detector.detectExternalDependencies("")
      expect(dependencies).toHaveLength(0)
    })

    it("should handle malformed HTML gracefully", () => {
      const html = `
        <html>
          <head>
            <link rel="stylesheet" href=style.css>
          </head>
          <body>
            <p>Test content</p>
          </body>
        </html>
      `

      // Should not throw and should find valid URLs
      expect(() => detector.detectExternalDependencies(html)).not.toThrow()
    })
  })

  describe("utility methods", () => {
    it("should get dependencies by type", () => {
      const dependencies = [
        { type: DependencyType.STYLESHEET, url: "style.css" },
        { type: DependencyType.SCRIPT, url: "script.js" },
        { type: DependencyType.STYLESHEET, url: "theme.css" },
      ] as any[]

      const stylesheetDeps = detector.getDependenciesByType(dependencies, DependencyType.STYLESHEET)
      expect(stylesheetDeps).toHaveLength(2)
      expect(stylesheetDeps.map(dep => dep.url)).toEqual(["style.css", "theme.css"])
    })

    it("should get external dependencies only", () => {
      const dependencies = [
        { type: DependencyType.IMAGE, url: "https://example.com/image.jpg", isRelative: false },
        { type: DependencyType.IMAGE, url: "local-image.jpg", isRelative: true },
        { type: DependencyType.SCRIPT, url: "/script.js", isRelative: false },
      ] as any[]

      const externalDeps = detector.getExternalDependencies(dependencies)
      expect(externalDeps).toHaveLength(2)
      expect(externalDeps.map(dep => dep.url)).toEqual([
        "https://example.com/image.jpg",
        "/script.js",
      ])
    })

    it("should get secure dependencies only", () => {
      const dependencies = [
        { type: DependencyType.IMAGE, url: "https://example.com/image.jpg", isSecure: true },
        { type: DependencyType.IMAGE, url: "http://example.com/image2.jpg", isSecure: false },
        { type: DependencyType.SCRIPT, url: "https://example.com/script.js", isSecure: true },
      ] as any[]

      const secureDeps = detector.getSecureDependencies(dependencies)
      expect(secureDeps).toHaveLength(2)
      expect(secureDeps.map(dep => dep.url)).toEqual([
        "https://example.com/image.jpg",
        "https://example.com/script.js",
      ])
    })
  })

  describe("edge cases", () => {
    it("should filter out invalid URLs", () => {
      const html = `
        <html>
          <body>
            <img src="valid.jpg" />
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" />
            <img src="javascript:void(0)" />
            <img src="mailto:test@example.com" />
            <img src="#anchor" />
          </body>
        </html>
      `

      const dependencies = detector.detectExternalDependencies(html)

      expect(dependencies).toHaveLength(1)
      expect(dependencies[0].url).toBe("valid.jpg")
    })

    it("should deduplicate dependencies", () => {
      const html = `
        <html>
          <head>
            <link rel="stylesheet" href="style.css" />
            <link rel="stylesheet" href="style.css" />
            <script src="script.js"></script>
            <script src="script.js"></script>
          </head>
        </html>
      `

      const dependencies = detector.detectExternalDependencies(html)

      expect(dependencies).toHaveLength(2)
      expect(dependencies.map(dep => dep.url)).toEqual(["style.css", "script.js"])
    })
  })
})
