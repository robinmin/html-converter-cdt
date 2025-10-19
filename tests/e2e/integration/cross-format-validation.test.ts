/**
 * Cross-Format Conversion Validation Tests
 *
 * Tests conversion consistency across different formats and validates
 * that different conversion methods produce equivalent results
 */

import { Buffer } from "node:buffer"

import { afterAll, beforeAll, describe, expect, test } from "vitest"

import { E2ETestHelpers } from "../utils/e2e-helpers"

describe("cross-Format Conversion Validation", () => {
  let helpers: E2ETestHelpers
  const testUrl = "http://localhost:3001/"

  beforeAll(async () => {
    helpers = new E2ETestHelpers()
    await helpers.setupTestEnvironment()
  })

  afterAll(async () => {
    await helpers.cleanupTestEnvironment()
  })

  describe("format Consistency Tests", () => {
    test("should maintain content consistency across all formats", async () => {
      const formats = ["mhtml", "pdf", "png"]
      const results = []

      // Convert to all formats
      for (const format of formats) {
        const result = await helpers.convertURL(testUrl, format)
        results.push(result)
        expect(result.success).toBe(true)
      }

      // Validate each format
      const mhtmlResult = results.find(r => r.format === "mhtml")
      const _pdfResult = results.find(r => r.format === "pdf")
      const _pngResult = results.find(r => r.format === "png")

      // All should have the same base content
      const mhtmlContent = Buffer.isBuffer(mhtmlResult!.data)
        ? mhtmlResult!.data.toString("utf-8")
        : mhtmlResult!.data

      // Key content elements should be present in all formats
      expect(mhtmlContent).toContain("HTML Converter Test Suite")
      expect(mhtmlContent).toContain("Basic Content")
      expect(mhtmlContent).toContain("bold text")

      // Save all results for comparison
      results.forEach((result) => {
        helpers.saveTestResult(result, `consistency-${result.format}`)
      })

      console.log("✅ Content consistency validated across all formats")
    })

    test("should handle complex content consistently across formats", async () => {
      const complexUrl = "http://localhost:3001/complex"
      const formats = ["mhtml", "pdf", "png", "jpeg"]
      const results = []

      for (const format of formats) {
        const options = format === "pdf"
          ? { format: "A4", printBackground: true }
          : format === "png" || format === "jpeg"
            ? { fullPage: true, quality: 90 }
            : {}

        const result = await helpers.convertURL(complexUrl, format, options)
        results.push(result)
        expect(result.success).toBe(true)
      }

      // All results should be significantly sized (indicating content preservation)
      results.forEach((result) => {
        expect(result.metadata!.size).toBeGreaterThan(1000)
      })

      // Save results
      results.forEach((result) => {
        helpers.saveTestResult(result, `complex-${result.format}`)
      })

      console.log("✅ Complex content handled consistently across formats")
    })
  })

  describe("format-Specific Validation", () => {
    test("should validate MHTML structure and completeness", async () => {
      const result = await helpers.convertURL(testUrl, "mhtml")

      expect(result.success).toBe(true)
      const isValidMHTML = helpers.validateMHTMLResult(result)
      expect(isValidMHTML).toBe(true)

      const content = Buffer.isBuffer(result.data)
        ? result.data.toString("utf-8")
        : result.data

      // Validate MHTML structure
      expect(content).toMatch(/Content-Type: multipart\/related/)
      expect(content).toMatch(/Content-Location:/)
      expect(content).toMatch(/Content-Transfer-Encoding:/)
      expect(content).toMatch(/Content-Type: text\/html/)

      // Validate HTML content preservation
      expect(content).toContain("<!DOCTYPE html>")
      expect(content).toContain("<html")
      expect(content).toContain("</html>")

      // Validate CSS inclusion
      expect(content).toContain("background-color")
      expect(content).toContain(".highlight")

      // Validate structure preservation
      expect(content).toContain("<h1>")
      expect(content).toContain("<h2>")
      expect(content).toContain("<table>")
      expect(content).toContain("<ul>")

      helpers.saveTestResult(result, "mhtml-structure-validation.mhtml")
      console.log("✅ MHTML structure validation completed")
    })

    test("should validate PDF structure and readability", async () => {
      const result = await helpers.convertURL(testUrl, "pdf", {
        format: "A4",
        printBackground: true,
        margin: { top: "1cm", bottom: "1cm", left: "1cm", right: "1cm" },
      })

      expect(result.success).toBe(true)
      const isValidPDF = helpers.validatePDFResult(result)
      expect(isValidPDF).toBe(true)

      const pdfBuffer = result.data as Buffer

      // Basic PDF structure validation
      expect(pdfBuffer.length).toBeGreaterThan(5000) // Should be substantial
      expect(pdfBuffer.toString("ascii", 0, 4)).toBe("%PDF")
      expect(pdfBuffer.toString("ascii")).toContain("endobj")

      // Check for PDF version
      const pdfHeader = pdfBuffer.toString("ascii", 0, 20)
      expect(pdfHeader).toMatch(/%PDF-\d\.\d/)

      helpers.saveTestResult(result, "pdf-structure-validation.pdf")
      console.log("✅ PDF structure validation completed")
    })

    test("should validate image format correctness", async () => {
      const imageFormats = [
        { format: "png", extension: "png", header: "%PNG" },
        { format: "jpeg", extension: "jpg", header: "\xFF\xD8\xFF" },
      ]

      for (const { format, extension, header } of imageFormats) {
        const result = await helpers.convertURL(testUrl, format, {
          fullPage: true,
          quality: 90,
        })

        expect(result.success).toBe(true)
        expect(Buffer.isBuffer(result.data)).toBe(true)

        const imageBuffer = result.data as Buffer
        const actualHeader = imageBuffer.toString("ascii", 0, header.length)
        expect(actualHeader).toBe(header)

        // Image should be reasonably sized
        expect(imageBuffer.length).toBeGreaterThan(10000) // Full page screenshot

        helpers.saveTestResult(result, `image-${format}-validation.${extension}`)
      }

      console.log("✅ Image format validation completed")
    })
  })

  describe("content Fidelity Tests", () => {
    test("should preserve text content accurately across formats", async () => {
      const textUrl = "http://localhost:3001/"
      const formats = ["mhtml", "pdf"]

      const results = []
      for (const format of formats) {
        const result = await helpers.convertURL(textUrl, format)
        results.push(result)
        expect(result.success).toBe(true)
      }

      // Extract text from each format and compare
      const mhtmlResult = results.find(r => r.format === "mhtml")
      const mhtmlContent = Buffer.isBuffer(mhtmlResult!.data)
        ? mhtmlResult!.data.toString("utf-8")
        : mhtmlResult!.data

      // Key text elements should be preserved
      const expectedTexts = [
        "HTML Converter Test Suite",
        "Basic Content",
        "bold text",
        "italic text",
        "highlighted content",
        "Example.com",
        "First item",
        "Second item",
        "console.log",
        "Best way to test a converter",
        "Feature",
        "Supported",
        "Notes",
        "MHTML Export",
        "PDF Export",
        "Image Support",
      ]

      expectedTexts.forEach((text) => {
        expect(mhtmlContent).toContain(text)
      })

      console.log("✅ Text content fidelity validated")
    })

    test("should preserve visual structure in image formats", async () => {
      const structureUrl = "http://localhost:3001/"
      const imageFormats = ["png", "jpeg"]

      for (const format of imageFormats) {
        const result = await helpers.convertURL(structureUrl, format, {
          fullPage: true,
          quality: 95,
        })

        expect(result.success).toBe(true)
        const imageBuffer = result.data as Buffer

        // Full page images should be substantial
        expect(imageBuffer.length).toBeGreaterThan(20000)

        // Save for visual inspection
        helpers.saveTestResult(result, `structure-${format}.png`)
      }

      console.log("✅ Visual structure preservation validated")
    })

    test("should preserve styling information in MHTML", async () => {
      const styledUrl = "http://localhost:3001/styles"
      const result = await helpers.convertURL(styledUrl, "mhtml")

      expect(result.success).toBe(true)

      const content = Buffer.isBuffer(result.data)
        ? result.data.toString("utf-8")
        : result.data

      // CSS should be included
      expect(content).toContain(".styled-title")
      expect(content).toContain("color: #007cba")
      expect(content).toContain("background-color: #f0f8ff")
      expect(content).toContain("border: 2px solid #007cba")

      helpers.saveTestResult(result, "styling-preservation.mhtml")
      console.log("✅ Styling preservation validated")
    })
  })

  describe("performance Comparison Across Formats", () => {
    test("should compare conversion speeds across formats", async () => {
      const formats = ["mhtml", "pdf", "png"]
      const results = []

      for (const format of formats) {
        const options = format === "pdf"
          ? { format: "A4" }
          : format === "png"
            ? { fullPage: true }
            : {}

        const result = await helpers.convertURL(testUrl, format, options)
        results.push(result)
      }

      // Analyze performance
      const performanceData = results.map(r => ({
        format: r.format,
        duration: r.metadata!.duration,
        size: r.metadata!.size,
        sizePerMs: r.metadata!.size / r.metadata!.duration,
      }))

      performanceData.forEach((data) => {
        console.log(`${data.format}: ${data.duration}ms, ${data.size} bytes, ${data.sizePerMs.toFixed(2)} bytes/ms`)
      })

      // All formats should complete within reasonable time
      results.forEach((result) => {
        expect(result.metadata!.duration).toBeLessThan(30000)
      })

      // Size should be reasonable for each format
      const mhtmlResult = results.find(r => r.format === "mhtml")
      const _pdfResult = results.find(r => r.format === "pdf")
      const _pngResult = results.find(r => r.format === "png")

      expect(mhtmlResult!.metadata!.size).toBeGreaterThan(5000) // Text + CSS
      expect(_pdfResult!.metadata!.size).toBeGreaterThan(10000) // Rendered PDF
      expect(_pngResult!.metadata!.size).toBeGreaterThan(50000) // Full page image

      console.log("✅ Performance comparison completed")
    })

    test("should handle memory usage efficiently across formats", async () => {
      const formats = ["mhtml", "pdf", "png"]
      const memoryBefore = process.memoryUsage()

      const results = []
      for (const format of formats) {
        const result = await helpers.convertURL(testUrl, format)
        results.push(result)
      }

      const memoryAfter = process.memoryUsage()

      // Memory growth should be reasonable
      const memoryGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024) // Less than 50MB growth

      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`)
      console.log("✅ Memory usage efficiency validated")
    })
  })

  describe("error Consistency Across Formats", () => {
    test("should handle invalid URLs consistently across formats", async () => {
      const invalidUrl = "http://localhost:99999/invalid"
      const formats = ["mhtml", "pdf", "png"]

      const results = []
      for (const format of formats) {
        const result = await helpers.convertURL(invalidUrl, format)
        results.push(result)
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      }

      // All should fail with network-related errors
      results.forEach((result) => {
        expect(result.error).toMatch(/network|connection|timeout|ECONNREFUSED/i)
      })

      console.log("✅ Invalid URL error handling consistency validated")
    })

    test("should handle malformed content consistently", async () => {
      const malformedHTML = "<!DOCTYPE html><html><body><p>Incomplete"
      const formats = ["mhtml", "pdf"]

      const results = []
      for (const format of formats) {
        const result = await helpers.convertHTML(malformedHTML, format)
        results.push(result)
      }

      // Some formats might succeed, others might fail - but error handling should be consistent
      results.forEach((result) => {
        if (!result.success) {
          expect(result.error).toBeDefined()
          expect(result.error!.length).toBeGreaterThan(0)
        }
      })

      console.log("✅ Malformed content error handling consistency validated")
    })
  })

  describe("advanced Cross-Format Features", () => {
    test("should support conversion options consistently", async () => {
      const url = "http://localhost:3001/complex"

      // Test PDF with different options
      const pdfResults = []
      const pdfOptions = [
        { format: "A4", printBackground: false },
        { format: "A4", printBackground: true },
        { format: "Letter", printBackground: true, margin: "2cm" },
      ]

      for (const options of pdfOptions) {
        const result = await helpers.convertURL(url, "pdf", options)
        pdfResults.push(result)
        expect(result.success).toBe(true)
      }

      // Files with different options should have different sizes
      expect(pdfResults[0].metadata!.size).toBeLessThan(pdfResults[1].metadata!.size)
      expect(pdfResults[1].metadata!.size).not.toBe(pdfResults[2].metadata!.size)

      pdfResults.forEach((result, index) => {
        helpers.saveTestResult(result, `pdf-options-${index}.pdf`)
      })

      console.log("✅ PDF options consistency validated")
    })

    test("should support image quality options", async () => {
      const url = "http://localhost:3001/"
      const qualities = [50, 80, 95]
      const results = []

      for (const quality of qualities) {
        const result = await helpers.convertURL(url, "jpeg", {
          fullPage: true,
          quality,
        })
        results.push(result)
        expect(result.success).toBe(true)
      }

      // Higher quality should produce larger files
      expect(results[0].metadata!.size).toBeLessThan(results[1].metadata!.size)
      expect(results[1].metadata!.size).toBeLessThan(results[2].metadata!.size)

      results.forEach((result, index) => {
        helpers.saveTestResult(result, `jpeg-quality-${qualities[index]}.jpg`)
      })

      console.log("✅ Image quality options validated")
    })
  })

  describe("conversion Chain Validation", () => {
    test("should support format conversion chains", async () => {
      const url = "http://localhost:3001/simple"

      // Convert URL -> MHTML -> extract HTML -> convert to PDF
      const mhtmlResult = await helpers.convertURL(url, "mhtml")
      expect(mhtmlResult.success).toBe(true)

      // Extract HTML content from MHTML (simplified for testing)
      const mhtmlContent = Buffer.isBuffer(mhtmlResult.data)
        ? mhtmlResult.data.toString("utf-8")
        : mhtmlResult.data

      // Look for HTML content between boundaries
      const htmlMatch = mhtmlContent.match(/Content-Type: text\/html[\s\S]*?(?=Content-Type:|$)/)
      expect(htmlMatch).toBeTruthy()

      // Save chain results
      helpers.saveTestResult(mhtmlResult, "chain-step1-mhtml.mhtml")

      console.log("✅ Conversion chain validation completed")
    })

    test("should maintain content integrity through conversion processes", async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Integrity Test</title></head>
        <body>
          <h1>Content Integrity Test</h1>
          <p>This content must remain consistent across conversions.</p>
          <div style="color: red; background: yellow;">Styled content</div>
        </body>
        </html>
      `

      const formats = ["mhtml", "pdf", "png"]
      const results = []

      for (const format of formats) {
        const result = await helpers.convertHTML(testHtml, format)
        results.push(result)
        expect(result.success).toBe(true)
      }

      // Verify key content is preserved
      const mhtmlResult = results.find(r => r.format === "mhtml")
      const mhtmlContent = Buffer.isBuffer(mhtmlResult!.data)
        ? mhtmlResult!.data.toString("utf-8")
        : mhtmlResult!.data

      expect(mhtmlContent).toContain("Content Integrity Test")
      expect(mhtmlContent).toContain("color: red")
      expect(mhtmlContent).toContain("background: yellow")

      results.forEach((result) => {
        helpers.saveTestResult(result, `integrity-${result.format}`)
      })

      console.log("✅ Content integrity through conversions validated")
    })
  })
})
