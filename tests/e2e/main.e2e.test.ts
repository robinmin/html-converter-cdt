/**
 * Main E2E Test Entry Point
 *
 * This file serves as the main entry point for E2E tests and includes
 * smoke tests to verify the overall system functionality
 */

import { describe, expect, test } from "vitest"

import { E2ETestHelpers } from "./utils/e2e-helpers"

describe("hTML Converter CDT - E2E Smoke Tests", () => {
  let helpers: E2ETestHelpers

  test.beforeAll(async () => {
    helpers = new E2ETestHelpers()
    await helpers.setupTestEnvironment()
  })

  test.afterAll(async () => {
    await helpers.cleanupTestEnvironment()
  })

  test("should perform basic end-to-end conversion workflow", async () => {
    // Test the most basic conversion scenario
    const result = await helpers.convertURL("http://localhost:3001/simple", "mhtml")

    expect(result.success).toBe(true)
    expect(result.format).toBe("mhtml")
    expect(result.metadata?.size).toBeGreaterThan(0)
    expect(result.metadata?.duration).toBeLessThan(30000)

    const isValidMHTML = helpers.validateMHTMLResult(result)
    expect(isValidMHTML).toBe(true)

    helpers.saveTestResult(result, "smoke-test-basic.mhtml")
    console.log("✅ Basic E2E conversion workflow successful")
  })

  test("should handle multiple format conversions", async () => {
    const testUrl = "http://localhost:3001/simple"
    const formats = ["mhtml", "pdf", "png"]

    for (const format of formats) {
      const result = await helpers.convertURL(testUrl, format)
      expect(result.success).toBe(true)
      expect(result.format).toBe(format)

      // Format-specific validation
      if (format === "mhtml") {
        expect(helpers.validateMHTMLResult(result)).toBe(true)
      } else if (format === "pdf") {
        expect(helpers.validatePDFResult(result)).toBe(true)
      } else if (format === "png") {
        expect(helpers.validateImageResult(result, "png")).toBe(true)
      }

      helpers.saveTestResult(result, `smoke-test-${format}`)
    }

    console.log("✅ Multiple format conversions successful")
  })

  test("should handle complex content conversion", async () => {
    const result = await helpers.convertURL("http://localhost:3001/", "mhtml")

    expect(result.success).toBe(true)
    expect(helpers.validateMHTMLResult(result)).toBe(true)
    expect(result.metadata?.size).toBeGreaterThan(5000) // Complex content should be larger

    helpers.saveTestResult(result, "smoke-test-complex.mhtml")
    console.log("✅ Complex content conversion successful")
  })

  test("should complete all smoke tests within reasonable time", async () => {
    const startTime = Date.now()

    // Run a quick conversion
    const result = await helpers.convertURL("http://localhost:3001/simple", "mhtml")

    const endTime = Date.now()
    const duration = endTime - startTime

    expect(result.success).toBe(true)
    expect(duration).toBeLessThan(15000) // 15 seconds max for smoke test

    console.log(`✅ Smoke tests completed in ${duration}ms`)
  })
})
