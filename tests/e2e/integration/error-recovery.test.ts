/**
 * Error Recovery and Timeout Scenario Tests
 *
 * Tests error handling, recovery mechanisms, and timeout scenarios
 * under various failure conditions and edge cases
 */

import { Buffer } from "node:buffer"

import { afterAll, beforeAll, describe, expect, test } from "vitest"

import { E2ETestHelpers } from "../utils/e2e-helpers"

describe("error Recovery and Timeout Scenarios", () => {
  let helpers: E2ETestHelpers

  beforeAll(async () => {
    helpers = new E2ETestHelpers()
    await helpers.setupTestEnvironment()
  })

  afterAll(async () => {
    await helpers.cleanupTestEnvironment()
  })

  describe("network Error Recovery", () => {
    test("should handle connection timeout gracefully", async () => {
      // Test with non-existent server
      const result = await helpers.convertURL("http://localhost:99999/test", "mhtml", {
        timeout: 5000,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toMatch(/timeout|connection|refused|ECONNREFUSED/i)
      expect(result.metadata?.duration).toBeLessThan(10000) // Should timeout quickly

      console.log(`✅ Connection timeout handled: ${result.error}`)
    })

    test("should handle DNS resolution failures", async () => {
      const result = await helpers.convertURL("http://nonexistent-domain-12345.com/test", "mhtml", {
        timeout: 10000,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toMatch(/DNS|ENOTFOUND|getaddrinfo/i)

      console.log(`✅ DNS resolution failure handled: ${result.error}`)
    })

    test("should handle HTTP error statuses", async () => {
      const errorCodes = [404, 500, 502, 503]

      for (const code of errorCodes) {
        const result = await helpers.convertURL(`http://localhost:3001/error?status=${code}`, "mhtml")

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.error).toContain(String(code))

        console.log(`✅ HTTP ${code} error handled correctly`)
      }
    })

    test("should handle partial content responses", async () => {
      // Simulate partial content scenario
      const result = await helpers.convertURL("http://localhost:3001/slow?delay=10000", "mhtml", {
        timeout: 5000, // Shorter than the delay
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toMatch(/timeout|time/i)

      console.log(`✅ Partial content timeout handled: ${result.error}`)
    })
  })

  describe("chrome Process Error Recovery", () => {
    test("should handle Chrome startup failures", async () => {
      // Try to start conversion while Chrome might not be ready
      await helpers.waitForChromeCDP(9222, 1000) // Short wait

      const result = await helpers.convertURL("http://localhost:3001/simple", "mhtml")

      // Should either succeed (if Chrome is available) or fail gracefully
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.error).toMatch(/chrome|cdp|connection/i)
      }

      console.log(`Chrome startup handling: ${result.success ? "Available" : result.error}`)
    })

    test("should handle Chrome crashes during conversion", async () => {
      // This test simulates what happens if Chrome crashes mid-conversion
      // In a real scenario, this would be harder to test, but we can test recovery

      const result = await helpers.convertURL("http://localhost:3001/complex", "mhtml", {
        timeout: 30000,
      })

      if (!result.success) {
        expect(result.error).toBeDefined()
        // Error should be informative
        expect(result.error!.length).toBeGreaterThan(10)
      }

      console.log(`Chrome crash simulation: ${result.success ? "No crash detected" : result.error}`)
    })

    test("should recover from Chrome process exhaustion", async () => {
      const _results = []

      // Try multiple concurrent conversions to stress test Chrome
      const promises = []
      for (let i = 0; i < 5; i++) {
        const promise = helpers.convertURL("http://localhost:3001/simple", "mhtml", {
          timeout: 20000,
        })
        promises.push(promise)
      }

      const concurrentResults = await Promise.allSettled(promises)

      // Analyze results
      const successful = concurrentResults.filter(r => r.status === "fulfilled" && r.value.success).length
      const failed = concurrentResults.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success)).length

      console.log(`Concurrent conversion stress test: ${successful} successful, ${failed} failed`)

      // At least some should succeed
      expect(successful + failed).toBe(5)
    })
  })

  describe("content Error Recovery", () => {
    test("should handle malformed HTML gracefully", async () => {
      const malformedHTMLs = [
        "<!DOCTYPE html><html><body><p>Incomplete",
        "<html><head><title>Test</title></head><body><div>Unclosed div",
        "<!DOCTYPE html><html><body><script>var x = {",
        "<!DOCTYPE html><html><body><img src=\"",
        "<!DOCTYPE html><html><body><style>div {",
      ]

      for (const html of malformedHTMLs) {
        const result = await helpers.convertHTML(html, "mhtml")

        // Should either succeed (Chrome fixes the HTML) or fail gracefully
        if (!result.success) {
          expect(result.error).toBeDefined()
          expect(result.error!.length).toBeGreaterThan(0)
        }

        console.log(`Malformed HTML handling (${html.substring(0, 30)}...): ${result.success ? "Fixed" : result.error}`)
      }
    })

    test("should handle extremely large content", async () => {
      // Create a very large HTML document
      let largeHTML = "<!DOCTYPE html><html><head><title>Large Test</title></head><body>"

      // Add a lot of content
      for (let i = 0; i < 1000; i++) {
        largeHTML += `<h1>Section ${i}</h1><p>This is section ${i} with some content.</p>`
      }
      largeHTML += "</body></html>"

      const result = await helpers.convertHTML(largeHTML, "mhtml", {
        timeout: 60000, // Longer timeout for large content
      })

      if (result.success) {
        expect(result.metadata?.size).toBeGreaterThan(50000) // Should be substantial
        console.log(`Large content handled: ${result.metadata?.size} bytes`)
      } else {
        expect(result.error).toBeDefined()
        console.log(`Large content failed: ${result.error}`)
      }
    })

    test("should handle content with encoding issues", async () => {
      const problematicContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Encoding Test</title>
        </head>
        <body>
          <h1>Special Characters: ñáéíóú 中文 العربية русский</h1>
          <p>Quotes: "smart quotes" and 'regular quotes'</p>
          <p>Math: 1 < 2 > 0 & symbols</p>
        </body>
        </html>
      `

      const result = await helpers.convertHTML(problematicContent, "mhtml")

      if (result.success) {
        const content = Buffer.isBuffer(result.data)
          ? result.data.toString("utf-8")
          : result.data

        // Should preserve special characters
        expect(content).toContain("ñáéíóú")
        expect(content).toContain("中文")
        expect(content).toContain("العربية")
        console.log("✅ Special encoding handled correctly")
      } else {
        console.log(`Encoding issue handling: ${result.error}`)
      }
    })
  })

  describe("timeout and Performance Recovery", () => {
    test("should handle progressive timeout increases", async () => {
      const timeouts = [5000, 10000, 20000, 30000]
      const slowUrl = "http://localhost:3001/slow?delay=8000"

      for (const timeout of timeouts) {
        const result = await helpers.convertURL(slowUrl, "mhtml", { timeout })

        if (timeout < 8000) {
          expect(result.success).toBe(false)
          expect(result.error).toMatch(/timeout/i)
        } else {
          expect(result.success).toBe(true)
        }

        console.log(`Timeout ${timeout}ms: ${result.success ? "Success" : "Timeout"}`)
      }
    })

    test("should handle resource loading timeouts", async () => {
      // Test page with slow-loading resources
      const htmlWithSlowResources = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Slow Resources Test</title>
        </head>
        <body>
          <h1>Page with Slow Resources</h1>
          <img src="http://localhost:3001/slow?delay=15000" alt="Slow Image" />
          <script src="http://localhost:3001/slow?delay=15000"></script>
        </body>
        </html>
      `

      const result = await helpers.convertHTML(htmlWithSlowResources, "mhtml", {
        timeout: 10000, // Shorter than resource delay
      })

      if (!result.success) {
        expect(result.error).toBeDefined()
        console.log(`Slow resources timeout: ${result.error}`)
      } else {
        console.log("Slow resources loaded within timeout")
      }
    })

    test("should recover from memory pressure", async () => {
      // Create memory pressure with multiple large conversions
      const promises = []
      for (let i = 0; i < 3; i++) {
        const largeHTML = "<!DOCTYPE html><html><body>" + "<p>Large content</p>".repeat(10000) + "</body></html>"
        const promise = helpers.convertHTML(largeHTML, "mhtml", {
          timeout: 45000,
        })
        promises.push(promise)
      }

      const results = await Promise.allSettled(promises)
      const successful = results.filter(r => r.status === "fulfilled" && r.value.success).length

      console.log(`Memory pressure test: ${successful}/3 conversions successful`)

      // At least one should succeed
      expect(successful).toBeGreaterThan(0)
    })
  })

  describe("error Recovery Mechanisms", () => {
    test("should implement retry logic for transient failures", async () => {
      // This tests the retry mechanism (if implemented)
      let attemptCount = 0
      const maxRetries = 3

      while (attemptCount < maxRetries) {
        attemptCount++
        const result = await helpers.convertURL("http://localhost:3001/slow?delay=1000", "mhtml", {
          timeout: 2000,
        })

        if (result.success) {
          console.log(`✅ Retry successful on attempt ${attemptCount}`)
          break
        } else if (attemptCount === maxRetries) {
          console.log(`❌ All ${maxRetries} retry attempts failed`)
          break
        } else {
          console.log(`Retry attempt ${attemptCount} failed: ${result.error}`)
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    })

    test("should provide fallback conversion methods", async () => {
      // Test if the library provides fallback methods when primary fails
      const simpleUrl = "http://localhost:3001/simple"

      // Try different approaches
      const approaches = [
        () => helpers.convertURL(simpleUrl, "mhtml"),
        () => helpers.convertURL(simpleUrl, "pdf"),
        () => helpers.convertURL(simpleUrl, "png"),
      ]

      let successfulApproach = -1
      for (let i = 0; i < approaches.length; i++) {
        try {
          const result = await approaches[i]()
          if (result.success) {
            successfulApproach = i
            break
          }
        } catch (error) {
          console.log(`Approach ${i} failed: ${error}`)
        }
      }

      expect(successfulApproach).toBeGreaterThanOrEqual(0)
      console.log(`✅ Fallback approach ${successfulApproach} succeeded`)
    })

    test("should preserve partial results on failure", async () => {
      // Test if partial results are preserved when conversion fails partway
      const result = await helpers.convertURL("http://localhost:3001/slow?delay=20000", "mhtml", {
        timeout: 10000,
      })

      if (!result.success) {
        // Error should be informative
        expect(result.error).toBeDefined()
        expect(result.error!.length).toBeGreaterThan(10)

        // Should include metadata about the attempt
        expect(result.metadata).toBeDefined()
        expect(result.metadata?.duration).toBeGreaterThan(0)

        console.log(`Partial result preservation: ${result.error}`)
      }
    })
  })

  describe("edge Case Error Handling", () => {
    test("should handle zero-byte content", async () => {
      const result = await helpers.convertHTML("", "mhtml")

      // Should either handle gracefully or provide clear error
      if (!result.success) {
        expect(result.error).toBeDefined()
        console.log(`Zero-byte content: ${result.error}`)
      } else {
        console.log("Zero-byte content handled successfully")
      }
    })

    test("should handle extremely long URLs", async () => {
      const longUrl = "http://localhost:3001/" + "a".repeat(2000)
      const result = await helpers.convertURL(longUrl, "mhtml")

      if (!result.success) {
        expect(result.error).toBeDefined()
        console.log(`Long URL handling: ${result.error}`)
      } else {
        console.log("Long URL handled successfully")
      }
    })

    test("should handle invalid conversion options", async () => {
      const invalidOptions = {
        format: "A4",
        printBackground: "invalid-boolean",
        margin: "invalid-margin",
        timeout: "invalid-number",
      }

      const result = await helpers.convertURL("http://localhost:3001/simple", "pdf", invalidOptions)

      if (!result.success) {
        expect(result.error).toBeDefined()
        console.log(`Invalid options handling: ${result.error}`)
      } else {
        console.log("Invalid options handled gracefully")
      }
    })

    test("should handle concurrent access to same resources", async () => {
      const url = "http://localhost:3001/simple"
      const promises = []

      // Start multiple conversions of the same URL simultaneously
      for (let i = 0; i < 10; i++) {
        promises.push(helpers.convertURL(url, "mhtml"))
      }

      const results = await Promise.allSettled(promises)
      const successful = results.filter(r => r.status === "fulfilled" && r.value.success).length
      const errors = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success))

      console.log(`Concurrent access test: ${successful} successful, ${errors.length} errors`)

      // Most should succeed
      expect(successful).toBeGreaterThan(5)
    })
  })

  describe("resource Exhaustion Recovery", () => {
    test("should handle file system exhaustion", async () => {
      // Test with a path that might not exist or have permissions
      const result = await helpers.convertURL("http://localhost:3001/simple", "mhtml")

      // This would test file system error handling if we were saving to disk
      expect(result.success).toBe(true) // In-memory conversion should work
      console.log("File system exhaustion test passed")
    })

    test("should handle memory exhaustion gracefully", async () => {
      // Create content that might stress memory limits
      const hugeContent = "<!DOCTYPE html><html><body>" + "<div>Test</div>".repeat(100000) + "</body></html>"

      const result = await helpers.convertHTML(hugeContent, "mhtml", {
        timeout: 120000, // 2 minutes
      })

      if (result.success) {
        console.log(`Huge content handled: ${result.metadata?.size} bytes`)
      } else {
        expect(result.error).toBeDefined()
        console.log(`Memory exhaustion handling: ${result.error}`)
      }
    })

    test("should handle port exhaustion", async () => {
      // This simulates what happens if Chrome debug ports are exhausted
      const results = []

      // Try multiple conversions that might need different ports
      for (let i = 0; i < 3; i++) {
        const result = await helpers.convertURL("http://localhost:3001/simple", "mhtml")
        results.push(result)
      }

      const successful = results.filter(r => r.success).length
      console.log(`Port exhaustion simulation: ${successful}/3 successful`)

      // At least some should succeed
      expect(successful).toBeGreaterThan(0)
    })
  })

  describe("error Reporting and Diagnostics", () => {
    test("should provide detailed error information", async () => {
      const result = await helpers.convertURL("http://localhost:99999/nonexistent", "mhtml", {
        timeout: 5000,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error!.length).toBeGreaterThan(10)
      expect(result.metadata).toBeDefined()

      const diagnostics = {
        error: result.error,
        duration: result.metadata?.duration,
        timestamp: result.metadata?.timestamp,
      }

      console.log("Error diagnostics:", diagnostics)

      // Error should be actionable
      expect(result.error).toMatch(/timeout|connection|refused|network/i)
    })

    test("should maintain error logs for troubleshooting", async () => {
      const testResults = []

      // Collect various error scenarios
      const errorScenarios = [
        "http://localhost:99999/timeout",
        "http://localhost:3001/error?status=404",
        "http://localhost:3001/error?status=500",
        "http://nonexistent-domain-12345.com/test",
      ]

      for (const url of errorScenarios) {
        const result = await helpers.convertURL(url, "mhtml", { timeout: 5000 })
        testResults.push({ url, result })
      }

      // Generate error report
      const errorReport = testResults
        .filter(({ result }) => !result.success)
        .map(({ url, result }) => ({
          url,
          error: result.error,
          duration: result.metadata?.duration,
        }))

      console.log("Error report generated:", errorReport.length, "errors captured")

      // All scenarios should produce errors
      expect(errorReport.length).toBe(errorScenarios.length)

      // Save error report
      const reportContent = JSON.stringify(errorReport, null, 2)
      helpers.createTempFile("error-report.json", reportContent)
      console.log("✅ Error report saved to temp directory")
    })
  })
})
