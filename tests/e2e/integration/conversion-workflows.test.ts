/**
 * Integration Tests for Complete Conversion Workflows
 *
 * Tests end-to-end conversion scenarios using real Chrome instances
 * and validates the complete conversion pipeline
 */

import { Buffer } from "node:buffer"

import { afterAll, beforeAll, describe, expect, test } from "vitest"

import { E2ETestHelpers, TestFixtures } from "../utils/e2e-helpers"

describe("conversion Workflows Integration Tests", () => {
  let helpers: E2ETestHelpers

  beforeAll(async () => {
    helpers = new E2ETestHelpers()
    await helpers.setupTestEnvironment()
  })

  afterAll(async () => {
    await helpers.cleanupTestEnvironment()
  })

  describe("basic URL Conversion", () => {
    test("should convert simple HTML page to MHTML", async () => {
      const result = await helpers.convertURL("http://localhost:3001/simple", "mhtml")

      expect(result.success).toBe(true)
      expect(result.format).toBe("mhtml")
      expect(result.data).toBeDefined()
      expect(result.metadata?.size).toBeGreaterThan(0)
      expect(result.metadata?.duration).toBeLessThan(30000)

      const isValidMHTML = helpers.validateMHTMLResult(result)
      expect(isValidMHTML).toBe(true)

      // Save result for inspection
      const savedFile = helpers.saveTestResult(result, "simple-page.mhtml")
      console.log(`✅ Saved MHTML result to: ${savedFile}`)
    })

    test("should convert complex HTML page to MHTML", async () => {
      const result = await helpers.convertURL("http://localhost:3001/", "mhtml")

      expect(result.success).toBe(true)
      expect(result.format).toBe("mhtml")
      expect(result.metadata?.size).toBeGreaterThan(1000) // Complex page should be larger

      const isValidMHTML = helpers.validateMHTMLResult(result)
      expect(isValidMHTML).toBe(true)

      const savedFile = helpers.saveTestResult(result, "complex-page.mhtml")
      console.log(`✅ Saved complex MHTML result to: ${savedFile}`)
    })

    test("should convert HTML page to PDF", async () => {
      const result = await helpers.convertURL("http://localhost:3001/", "pdf", {
        format: "A4",
        printBackground: true,
        margin: {
          top: "1cm",
          bottom: "1cm",
          left: "1cm",
          right: "1cm",
        },
      })

      expect(result.success).toBe(true)
      expect(result.format).toBe("pdf")
      expect(Buffer.isBuffer(result.data)).toBe(true)

      const isValidPDF = helpers.validatePDFResult(result)
      expect(isValidPDF).toBe(true)

      const savedFile = helpers.saveTestResult(result, "page.pdf")
      console.log(`✅ Saved PDF result to: ${savedFile}`)
    })

    test("should convert HTML page to PNG", async () => {
      const result = await helpers.convertURL("http://localhost:3001/", "png", {
        fullPage: true,
        quality: 90,
      })

      expect(result.success).toBe(true)
      expect(result.format).toBe("png")
      expect(Buffer.isBuffer(result.data)).toBe(true)

      const isValidPNG = helpers.validateImageResult(result, "png")
      expect(isValidPNG).toBe(true)

      const savedFile = helpers.saveTestResult(result, "page.png")
      console.log(`✅ Saved PNG result to: ${savedFile}`)
    })
  })

  describe("content-Specific Conversions", () => {
    test("should handle pages with images correctly", async () => {
      const result = await helpers.convertURL("http://localhost:3001/images", "mhtml")

      expect(result.success).toBe(true)
      const isValidMHTML = helpers.validateMHTMLResult(result)
      expect(isValidMHTML).toBe(true)

      // MHTML with images should include image content
      const content = Buffer.isBuffer(result.data)
        ? result.data.toString("utf-8")
        : result.data
      expect(content).toContain("test-image.png")
      expect(content).toContain("Content-Type: image/png")

      const savedFile = helpers.saveTestResult(result, "page-with-images.mhtml")
      console.log(`✅ Saved image page MHTML to: ${savedFile}`)
    })

    test("should handle styled pages correctly", async () => {
      const result = await helpers.convertURL("http://localhost:3001/styles", "mhtml")

      expect(result.success).toBe(true)
      const isValidMHTML = helpers.validateMHTMLResult(result)
      expect(isValidMHTML).toBe(true)

      // Should include CSS content
      const content = Buffer.isBuffer(result.data)
        ? result.data.toString("utf-8")
        : result.data
      expect(content).toContain("test-styles.css")
      expect(content).toContain("styled-title")

      const savedFile = helpers.saveTestResult(result, "styled-page.mhtml")
      console.log(`✅ Saved styled page MHTML to: ${savedFile}`)
    })

    test("should handle pages with scripts", async () => {
      const result = await helpers.convertURL("http://localhost:3001/scripts", "mhtml")

      expect(result.success).toBe(true)
      const isValidMHTML = helpers.validateMHTMLResult(result)
      expect(isValidMHTML).toBe(true)

      // Should include script content
      const content = Buffer.isBuffer(result.data)
        ? result.data.toString("utf-8")
        : result.data
      expect(content).toContain("test-script.js")

      const savedFile = helpers.saveTestResult(result, "scripted-page.mhtml")
      console.log(`✅ Saved scripted page MHTML to: ${savedFile}`)
    })

    test("should handle pages with tables", async () => {
      const result = await helpers.convertURL("http://localhost:3001/tables", "pdf", {
        format: "A4",
        printBackground: true,
      })

      expect(result.success).toBe(true)
      const isValidPDF = helpers.validatePDFResult(result)
      expect(isValidPDF).toBe(true)

      const savedFile = helpers.saveTestResult(result, "tables-page.pdf")
      console.log(`✅ Saved tables PDF to: ${savedFile}`)
    })
  })

  describe("cross-Format Conversions", () => {
    const testUrl = "http://localhost:3001/simple"

    test("should convert same URL to multiple formats consistently", async () => {
      const formats = ["mhtml", "pdf", "png"]
      const results = []

      for (const format of formats) {
        const result = await helpers.convertURL(testUrl, format)
        results.push(result)

        expect(result.success).toBe(true)
        expect(result.format).toBe(format)
        expect(result.metadata?.size).toBeGreaterThan(0)
      }

      // Validate each format
      const mhtmlResult = results.find(r => r.format === "mhtml")
      const pdfResult = results.find(r => r.format === "pdf")
      const pngResult = results.find(r => r.format === "png")

      expect(helpers.validateMHTMLResult(mhtmlResult!)).toBe(true)
      expect(helpers.validatePDFResult(pdfResult!)).toBe(true)
      expect(helpers.validateImageResult(pngResult!, "png")).toBe(true)

      // Save all results
      results.forEach((result) => {
        const savedFile = helpers.saveTestResult(result, `cross-format-${result.format}`)
        console.log(`✅ Saved cross-format ${result.format} to: ${savedFile}`)
      })
    })

    test("should handle conversion options correctly", async () => {
      // Test PDF with different options
      const result1 = await helpers.convertURL(testUrl, "pdf", {
        format: "A4",
        printBackground: false,
      })

      const result2 = await helpers.convertURL(testUrl, "pdf", {
        format: "A4",
        printBackground: true,
      })

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)

      // Files with background should be larger
      expect(result2.metadata!.size).toBeGreaterThan(result1.metadata!.size)

      // Save both for comparison
      helpers.saveTestResult(result1, "pdf-no-background.pdf")
      helpers.saveTestResult(result2, "pdf-with-background.pdf")
      console.log("✅ Saved PDF comparison files")
    })
  })

  describe("error Handling and Edge Cases", () => {
    test("should handle 404 pages gracefully", async () => {
      const result = await helpers.convertURL("http://localhost:3001/nonexistent", "mhtml")

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain("404") || expect(result.error).toContain("Not Found")
    })

    test("should handle server errors gracefully", async () => {
      const result = await helpers.convertURL("http://localhost:3001/error?status=500", "mhtml")

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test("should handle slow-loading pages", async () => {
      const result = await helpers.convertURL("http://localhost:3001/slow?delay=2000", "mhtml", {
        timeout: 10000, // 10 second timeout
      })

      expect(result.success).toBe(true)
      expect(result.metadata?.duration).toBeGreaterThan(2000)
      expect(result.metadata?.duration).toBeLessThan(15000)

      const savedFile = helpers.saveTestResult(result, "slow-loading-page.mhtml")
      console.log(`✅ Saved slow page MHTML to: ${savedFile}`)
    })

    test("should handle redirects correctly", async () => {
      const result = await helpers.convertURL("http://localhost:3001/redirect?to=/simple", "mhtml")

      expect(result.success).toBe(true)
      const isValidMHTML = helpers.validateMHTMLResult(result)
      expect(isValidMHTML).toBe(true)

      // Should contain the redirected content
      const content = Buffer.isBuffer(result.data)
        ? result.data.toString("utf-8")
        : result.data
      expect(content).toContain("Simple Test")

      const savedFile = helpers.saveTestResult(result, "redirected-page.mhtml")
      console.log(`✅ Saved redirected page MHTML to: ${savedFile}`)
    })
  })

  describe("performance and Resource Management", () => {
    test("should complete conversions within reasonable time", async () => {
      const startTime = Date.now()
      const result = await helpers.convertURL("http://localhost:3001/", "mhtml")
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(30000) // 30 seconds max
      expect(result.metadata?.duration).toBeLessThan(30000)
    })

    test("should handle multiple concurrent conversions", async () => {
      const urls = [
        "http://localhost:3001/simple",
        "http://localhost:3001/images",
        "http://localhost:3001/styles",
        "http://localhost:3001/forms",
      ]

      const startTime = Date.now()
      const promises = urls.map(url => helpers.convertURL(url, "mhtml"))
      const results = await Promise.all(promises)
      const endTime = Date.now()

      expect(results.length).toBe(urls.length)
      results.forEach((result) => {
        expect(result.success).toBe(true)
        expect(helpers.validateMHTMLResult(result)).toBe(true)
      })

      // Concurrent operations should be faster than sequential
      const totalTime = endTime - startTime
      expect(totalTime).toBeLessThan(60000) // 60 seconds max for all 4

      console.log(`✅ Completed ${results.length} concurrent conversions in ${totalTime}ms`)
    })

    test("should manage memory efficiently for large pages", async () => {
      const result = await helpers.convertURL("http://localhost:3001/", "mhtml")

      expect(result.success).toBe(true)
      expect(result.metadata?.size).toBeLessThan(10 * 1024 * 1024) // Less than 10MB

      const _savedFile = helpers.saveTestResult(result, "large-page-memory-test.mhtml")
      console.log(`✅ Memory test completed, file size: ${result.metadata?.size} bytes`)
    })
  })

  describe("hTML Content Conversions", () => {
    test("should convert HTML string content directly", async () => {
      const htmlContent = TestFixtures.styled.html
      const result = await helpers.convertHTML(htmlContent, "mhtml")

      expect(result.success).toBe(true)
      expect(result.format).toBe("mhtml")
      const isValidMHTML = helpers.validateMHTMLResult(result)
      expect(isValidMHTML).toBe(true)

      // Should contain the styled content
      const content = Buffer.isBuffer(result.data)
        ? result.data.toString("utf-8")
        : result.data
      expect(content).toContain("Styled Content")
      expect(content).toContain("highlight")

      const savedFile = helpers.saveTestResult(result, "html-string-content.mhtml")
      console.log(`✅ Saved HTML string conversion to: ${savedFile}`)
    })

    test("should handle complex HTML string with multiple elements", async () => {
      const htmlContent = TestFixtures.complex.html
      const result = await helpers.convertHTML(htmlContent, "pdf", {
        format: "A4",
        printBackground: true,
      })

      expect(result.success).toBe(true)
      expect(result.format).toBe("pdf")
      const isValidPDF = helpers.validatePDFResult(result)
      expect(isValidPDF).toBe(true)

      const savedFile = helpers.saveTestResult(result, "complex-html-content.pdf")
      console.log(`✅ Saved complex HTML PDF to: ${savedFile}`)
    })
  })

  describe("integration Test Summary", () => {
    test("should generate comprehensive test report", async () => {
      const allResults = helpers.getTestResults()

      expect(allResults.length).toBeGreaterThan(0)

      const successful = allResults.filter(r => r.success).length
      const failed = allResults.filter(r => r.success === false).length

      console.log(`📊 Test Summary: ${successful} successful, ${failed} failed out of ${allResults.length} total tests`)

      // Generate and save report
      const reportPath = helpers.saveTestReport("integration-test-report.md")
      console.log(`📄 Integration test report saved to: ${reportPath}`)

      // At least 80% success rate
      expect(successful / allResults.length).toBeGreaterThan(0.8)
    })
  })
})
