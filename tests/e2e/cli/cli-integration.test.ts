/**
 * CLI Integration Tests
 *
 * Tests the command-line interface with real Chrome processes
 * and validates CLI functionality end-to-end
 */

import { exec } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { promisify } from "node:util"

import { afterAll, beforeAll, describe, expect, test } from "vitest"

const execAsync = promisify(exec)

describe("cLI Integration Tests", () => {
  const tempDir = (globalThis as any).__E2E_TEMP_DIR__ || "/tmp/html-converter-e2e-tests"
  let testServerPort: number

  beforeAll(async () => {
    // Ensure temp directory exists
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }

    // Test server should already be running on port 3001
    testServerPort = 3001

    // Build the project if not already built
    try {
      await execAsync("pnpm build", { cwd: process.cwd() })
      console.log("✅ Project built for CLI testing")
    } catch (error) {
      console.error("❌ Failed to build project for CLI tests:", error)
      throw error
    }
  })

  afterAll(async () => {
    // Clean up any temporary files created during tests
    try {
      if (existsSync(tempDir)) {
        const files = readdirSync(tempDir)
        for (const file of files) {
          if (file.startsWith("cli-test-")) {
            unlinkSync(join(tempDir, file))
          }
        }
      }
    } catch (error) {
      console.error("❌ Error cleaning up CLI test files:", error)
    }
  })

  describe("basic CLI Commands", () => {
    test("should show help information", async () => {
      const result = await executeCLICommand(["--help"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Usage:")
      expect(result.stdout).toContain("Options:")
      expect(result.stdout).toContain("Commands:")
    })

    test("should show version information", async () => {
      const result = await executeCLICommand(["--version"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/) // Version number pattern
    })

    test("should handle missing arguments gracefully", async () => {
      const result = await executeCLICommand([])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("error") || expect(result.stderr).toContain("usage")
    })
  })

  describe("uRL Conversion Commands", () => {
    test("should convert URL to MHTML via CLI", async () => {
      const outputFile = join(tempDir, "cli-test-output.mhtml")
      const url = `http://localhost:${testServerPort}/simple`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "mhtml",
        "--output",
        outputFile,
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Conversion completed")
      expect(existsSync(outputFile)).toBe(true)

      // Validate the MHTML file
      const content = readFileSync(outputFile, "utf-8")
      expect(content).toContain("Content-Type: multipart/related")
      expect(content).toContain("<!DOCTYPE html")

      console.log(`✅ CLI MHTML conversion successful: ${outputFile}`)
    })

    test("should convert URL to PDF via CLI", async () => {
      const outputFile = join(tempDir, "cli-test-output.pdf")
      const url = `http://localhost:${testServerPort}/simple`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "pdf",
        "--output",
        outputFile,
        "--pdf-format",
        "A4",
        "--pdf-background",
      ])

      expect(result.exitCode).toBe(0)
      expect(existsSync(outputFile)).toBe(true)

      // Validate the PDF file
      const content = readFileSync(outputFile)
      expect(content.length).toBeGreaterThan(1000)
      expect(content.toString("ascii", 0, 4)).toBe("%PDF")

      console.log(`✅ CLI PDF conversion successful: ${outputFile}`)
    })

    test("should convert URL to PNG via CLI", async () => {
      const outputFile = join(tempDir, "cli-test-output.png")
      const url = `http://localhost:${testServerPort}/simple`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "png",
        "--output",
        outputFile,
        "--png-full-page",
      ])

      expect(result.exitCode).toBe(0)
      expect(existsSync(outputFile)).toBe(true)

      // Validate the PNG file
      const content = readFileSync(outputFile)
      expect(content.length).toBeGreaterThan(100)
      expect(content.toString("ascii", 0, 4)).toBe("%PNG")

      console.log(`✅ CLI PNG conversion successful: ${outputFile}`)
    })
  })

  describe("file Input Commands", () => {
    test("should convert local HTML file via CLI", async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
<head><title>CLI Test File</title></head>
<body>
  <h1>CLI Test Page</h1>
  <p>This page was created for CLI testing.</p>
</body>
</html>`

      const inputFile = join(tempDir, "cli-test-input.html")
      const outputFile = join(tempDir, "cli-test-output-file.mhtml")

      writeFileSync(inputFile, htmlContent)

      const result = await executeCLICommand([
        "convert",
        inputFile,
        "--format",
        "mhtml",
        "--output",
        outputFile,
      ])

      expect(result.exitCode).toBe(0)
      expect(existsSync(outputFile)).toBe(true)

      // Validate output
      const content = readFileSync(outputFile, "utf-8")
      expect(content).toContain("CLI Test Page")
      expect(content).toContain("Content-Type: multipart/related")

      console.log(`✅ CLI file conversion successful: ${outputFile}`)
    })

    test("should handle non-existent input file", async () => {
      const result = await executeCLICommand([
        "convert",
        "/non/existent/file.html",
        "--format",
        "mhtml",
        "--output",
        join(tempDir, "output.mhtml"),
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("error") || expect(result.stderr).toContain("not found")
    })
  })

  describe("cLI Options and Configuration", () => {
    test("should respect output directory option", async () => {
      const outputDir = join(tempDir, "cli-output-subdir")
      const url = `http://localhost:${testServerPort}/simple`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "mhtml",
        "--output-dir",
        outputDir,
      ])

      expect(result.exitCode).toBe(0)
      expect(existsSync(outputDir)).toBe(true)

      // Should create a file in the output directory
      const files = readdirSync(outputDir)
      expect(files.length).toBeGreaterThan(0)
      expect(files[0]).toMatch(/\.mhtml$/)

      console.log(`✅ CLI output directory option working: ${outputDir}`)
    })

    test("should respect custom filename pattern", async () => {
      const url = `http://localhost:${testServerPort}/simple`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "mhtml",
        "--filename-pattern",
        "custom-{timestamp}-{format}",
        "--output-dir",
        tempDir,
      ])

      expect(result.exitCode).toBe(0)

      // Should create a file with custom pattern
      const files = readdirSync(tempDir)
      const customFile = files.find(f => f.startsWith("custom-") && f.includes("-mhtml"))
      expect(customFile).toBeDefined()

      console.log(`✅ CLI custom filename pattern working: ${customFile}`)
    })

    test("should handle timeout option", async () => {
      const url = `http://localhost:${testServerPort}/slow?delay=3000`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "mhtml",
        "--timeout",
        "10000", // 10 seconds
        "--output",
        join(tempDir, "timeout-test.mhtml"),
      ])

      expect(result.exitCode).toBe(0)
      expect(existsSync(join(tempDir, "timeout-test.mhtml"))).toBe(true)

      console.log("✅ CLI timeout option working correctly")
    })

    test("should fail with insufficient timeout", async () => {
      const url = `http://localhost:${testServerPort}/slow?delay=5000`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "mhtml",
        "--timeout",
        "2000", // 2 seconds (less than delay)
        "--output",
        join(tempDir, "timeout-fail.mhtml"),
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("timeout") || expect(result.stderr).toContain("time")

      console.log("✅ CLI timeout failure handling working correctly")
    })
  })

  describe("batch Conversion Commands", () => {
    test("should convert multiple URLs in batch", async () => {
      const urlsFile = join(tempDir, "batch-urls.txt")
      const outputDir = join(tempDir, "batch-output")

      // Create URLs file
      const urls = [
        `http://localhost:${testServerPort}/simple`,
        `http://localhost:${testServerPort}/images`,
        `http://localhost:${testServerPort}/styles`,
      ]
      writeFileSync(urlsFile, urls.join("\n"))

      const result = await executeCLICommand([
        "batch",
        urlsFile,
        "--format",
        "mhtml",
        "--output-dir",
        outputDir,
      ])

      expect(result.exitCode).toBe(0)

      // Should create output directory with multiple files
      expect(existsSync(outputDir)).toBe(true)
      const files = readdirSync(outputDir)
      expect(files.length).toBe(urls.length)

      console.log(`✅ CLI batch conversion successful: ${files.length} files created`)
    })

    test("should handle batch conversion with different formats", async () => {
      const configFile = join(tempDir, "batch-config.json")
      const outputDir = join(tempDir, "batch-multi-format")

      // Create batch configuration
      const config = {
        conversions: [
          { url: `http://localhost:${testServerPort}/simple`, format: "mhtml" },
          { url: `http://localhost:${testServerPort}/simple`, format: "pdf" },
          { url: `http://localhost:${testServerPort}/simple`, format: "png" },
        ],
        outputDir,
      }
      writeFileSync(configFile, JSON.stringify(config, null, 2))

      const result = await executeCLICommand([
        "batch",
        "--config",
        configFile,
      ])

      expect(result.exitCode).toBe(0)
      expect(existsSync(outputDir)).toBe(true)

      const files = readdirSync(outputDir)
      expect(files.length).toBe(3) // Should have mhtml, pdf, and png files

      console.log(`✅ CLI multi-format batch conversion successful`)
    })
  })

  describe("error Handling and Validation", () => {
    test("should handle invalid URLs gracefully", async () => {
      const result = await executeCLICommand([
        "convert",
        "not-a-valid-url",
        "--format",
        "mhtml",
        "--output",
        join(tempDir, "invalid-url.mhtml"),
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("error") || expect(result.stderr).toContain("invalid")
    })

    test("should handle unsupported formats gracefully", async () => {
      const url = `http://localhost:${testServerPort}/simple`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "unsupported-format",
        "--output",
        join(tempDir, "unsupported.mhtml"),
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("format") || expect(result.stderr).toContain("supported")
    })

    test("should handle network errors gracefully", async () => {
      const result = await executeCLICommand([
        "convert",
        "http://localhost:99999/nonexistent", // Invalid port
        "--format",
        "mhtml",
        "--output",
        join(tempDir, "network-error.mhtml"),
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("error") || expect(result.stderr).toContain("network")
    })

    test("should handle permission errors", async () => {
      const restrictedPath = "/root/cli-test-output.mhtml" // Assuming no write access

      const result = await executeCLICommand([
        "convert",
        `http://localhost:${testServerPort}/simple`,
        "--format",
        "mhtml",
        "--output",
        restrictedPath,
      ])

      // Should either fail with permission error or succeed if running as root
      if (result.exitCode !== 0) {
        expect(result.stderr).toContain("permission")
        || expect(result.stderr).toContain("denied")
        || expect(result.stderr).toContain("access")
      }
    })
  })

  describe("cLI Performance and Resource Management", () => {
    test("should complete simple conversion within reasonable time", async () => {
      const startTime = Date.now()
      const url = `http://localhost:${testServerPort}/simple`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "mhtml",
        "--output",
        join(tempDir, "performance-test.mhtml"),
      ])

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.exitCode).toBe(0)
      expect(duration).toBeLessThan(30000) // 30 seconds max

      console.log(`✅ CLI performance test completed in ${duration}ms`)
    })

    test("should handle concurrent CLI processes", async () => {
      const promises = []
      const url = `http://localhost:${testServerPort}/simple`

      // Start multiple CLI processes concurrently
      for (let i = 0; i < 3; i++) {
        const promise = executeCLICommand([
          "convert",
          url,
          "--format",
          "mhtml",
          "--output",
          join(tempDir, `concurrent-${i}.mhtml`),
        ])
        promises.push(promise)
      }

      const startTime = Date.now()
      const results = await Promise.all(promises)
      const endTime = Date.now()

      expect(results.length).toBe(3)
      results.forEach((result) => {
        expect(result.exitCode).toBe(0)
      })

      // Check that all files were created
      for (let i = 0; i < 3; i++) {
        expect(existsSync(join(tempDir, `concurrent-${i}.mhtml`))).toBe(true)
      }

      const totalTime = endTime - startTime
      console.log(`✅ CLI concurrent processes completed in ${totalTime}ms`)
    })
  })

  describe("cLI Output and Logging", () => {
    test("should provide verbose output when requested", async () => {
      const url = `http://localhost:${testServerPort}/simple`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "mhtml",
        "--output",
        join(tempDir, "verbose-test.mhtml"),
        "--verbose",
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout.length).toBeGreaterThan(100) // Verbose output should be longer
      expect(result.stdout).toContain("Starting") || expect(result.stdout).toContain("Loading")

      console.log("✅ CLI verbose output working correctly")
    })

    test("should provide quiet output when requested", async () => {
      const url = `http://localhost:${testServerPort}/simple`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "mhtml",
        "--output",
        join(tempDir, "quiet-test.mhtml"),
        "--quiet",
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout.trim()).toBe("") // Quiet mode should have minimal output

      console.log("✅ CLI quiet output working correctly")
    })

    test("should output progress for long operations", async () => {
      const url = `http://localhost:${testServerPort}/slow?delay=2000`

      const result = await executeCLICommand([
        "convert",
        url,
        "--format",
        "mhtml",
        "--output",
        join(tempDir, "progress-test.mhtml"),
        "--progress",
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Loading")
      || expect(result.stdout).toContain("Processing")
      || expect(result.stdout).toContain("Converting")

      console.log("✅ CLI progress output working correctly")
    })
  })
})

/**
 * Helper function to execute CLI commands
 */
async function executeCLICommand(args: string[]): Promise<{ stdout: string, stderr: string, exitCode: number }> {
  try {
    const cliPath = join(process.cwd(), "dist", "index.js")
    const command = `node ${cliPath} ${args.join(" ")}`

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
