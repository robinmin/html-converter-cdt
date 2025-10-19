/**
 * Visual regression tests for image outputs
 */

import { Buffer } from "node:buffer"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "@playwright/test"

import { ChromeCDPManager } from "../../src/core/engine/chrome-cdp-manager.js"
import { TestDataGenerators } from "../utils/test-helpers.js"

import { VisualAssertions, VisualRegressionUtils } from "./utils/visual-regression.js"

test.describe("Image Visual Regression", () => {
  let cdpManager: ChromeCDPManager

  test.beforeAll(async () => {
    cdpManager = new ChromeCDPManager({
      maxConcurrentSessions: 1,
      timeout: 30000,
    })
    await cdpManager.initialize()
  })

  test.afterAll(async () => {
    await cdpManager.shutdown()
  })

  test("basic HTML to PNG conversion @visual", async () => {
    const testName = "basic-html-png"
    const html = TestDataGenerators.generateHTML({
      title: "Basic Test Document",
      content: "<p>This is a basic HTML document for PNG visual regression testing.</p>",
      includeStyles: true,
    })

    // Convert to PNG
    const result = await cdpManager.convertToImage({
      html,
      options: {
        format: "png",
        fullPage: true,
        quality: 100,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const imageBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "png")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.png`)

    // Save current output for inspection
    writeFileSync(currentPath, imageBuffer)

    // Check if baseline exists, create if not
    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(imageBuffer, baselinePath, {
        testName,
        format: "png",
        html: html.substring(0, 200) + "...",
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    // Compare with baseline
    await VisualAssertions.assertImagesMatch(baselinePath, imageBuffer, {
      pixelTolerance: 0.01,
      maxDiffPixels: 500,
    })
  })

  test("complex HTML to PNG conversion @visual", async () => {
    const testName = "complex-html-png"
    const html = TestDataGenerators.generateComplexHTML()

    const result = await cdpManager.convertToImage({
      html,
      options: {
        format: "png",
        fullPage: true,
        quality: 100,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const imageBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "png")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.png`)

    writeFileSync(currentPath, imageBuffer)

    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(imageBuffer, baselinePath, {
        testName,
        format: "png",
        complexity: "complex",
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    await VisualAssertions.assertImagesMatch(baselinePath, imageBuffer, {
      pixelTolerance: 0.02, // Higher tolerance for complex content
      maxDiffPixels: 1500,
    })
  })

  test("HTML with tables to PNG conversion @visual", async () => {
    const testName = "tables-html-png"
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h1>Table Test Document</h1>
          <p>This document tests table rendering in PNG conversion.</p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>City</th>
                <th>Occupation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>John Doe</td>
                <td>30</td>
                <td>New York</td>
                <td>Developer</td>
              </tr>
              <tr>
                <td>Jane Smith</td>
                <td>25</td>
                <td>Los Angeles</td>
                <td>Designer</td>
              </tr>
              <tr>
                <td>Bob Johnson</td>
                <td>35</td>
                <td>Chicago</td>
                <td>Manager</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `

    const result = await cdpManager.convertToImage({
      html,
      options: {
        format: "png",
        fullPage: true,
        quality: 100,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const imageBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "png")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.png`)

    writeFileSync(currentPath, imageBuffer)

    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(imageBuffer, baselinePath, {
        testName,
        format: "png",
        contentType: "tables",
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    await VisualAssertions.assertImagesMatch(baselinePath, imageBuffer)
  })

  test("HTML with different viewport sizes @visual", async () => {
    const viewportSizes = [
      { width: 800, height: 600, name: "desktop" },
      { width: 375, height: 667, name: "mobile" },
      { width: 1024, height: 768, name: "tablet" },
    ]

    for (const viewport of viewportSizes) {
      const testName = `viewport-${viewport.name}`
      const html = TestDataGenerators.generateHTML({
        title: `Viewport Test - ${viewport.name}`,
        content: `
          <h1>Viewport Test: ${viewport.name}</h1>
          <p>Testing responsive design with viewport ${viewport.width}x${viewport.height}</p>
          <div style="display: flex; gap: 20px;">
            <div style="flex: 1; background: #f0f0f0; padding: 20px;">Column 1</div>
            <div style="flex: 1; background: #e0e0e0; padding: 20px;">Column 2</div>
          </div>
        `,
        includeStyles: true,
      })

      const result = await cdpManager.convertToImage({
        html,
        options: {
          format: "png",
          fullPage: true,
          quality: 100,
          viewport: {
            width: viewport.width,
            height: viewport.height,
          },
        },
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const imageBuffer = Buffer.from(result.data, "base64")
      const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "png")
      const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.png`)

      writeFileSync(currentPath, imageBuffer)

      if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
        console.log(`Creating baseline for ${testName}`)
        VisualRegressionUtils.generateBaseline(imageBuffer, baselinePath, {
          testName,
          format: "png",
          viewport: `${viewport.width}x${viewport.height}`,
        })
        test.skip(true, "Baseline created - test will pass on next run")
        return
      }

      await VisualAssertions.assertImagesMatch(baselinePath, imageBuffer)
    }
  })

  test("Image quality variations @visual", async () => {
    const qualityLevels = [50, 80, 100]

    for (const quality of qualityLevels) {
      const testName = `png-quality-${quality}`
      const html = TestDataGenerators.generateHTML({
        title: `Quality Test - ${quality}`,
        content: `
          <h1>Image Quality Test</h1>
          <p>Testing PNG quality at ${quality}%</p>
          <div style="background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff); padding: 20px; color: white;">
            Gradient Test
          </div>
        `,
        includeStyles: true,
      })

      const result = await cdpManager.convertToImage({
        html,
        options: {
          format: "png",
          fullPage: true,
          quality,
        },
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const imageBuffer = Buffer.from(result.data, "base64")
      const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "png")
      const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.png`)

      writeFileSync(currentPath, imageBuffer)

      if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
        console.log(`Creating baseline for ${testName}`)
        VisualRegressionUtils.generateBaseline(imageBuffer, baselinePath, {
          testName,
          format: "png",
          quality,
        })
        test.skip(true, "Baseline created - test will pass on next run")
        return
      }

      await VisualAssertions.assertImagesMatch(baselinePath, imageBuffer)
    }
  })

  test("JPEG format conversion @visual", async () => {
    const testName = "html-to-jpeg"
    const html = TestDataGenerators.generateHTML({
      title: "JPEG Test Document",
      content: "<p>This is a test document for JPEG conversion.</p>",
      includeStyles: true,
    })

    const result = await cdpManager.convertToImage({
      html,
      options: {
        format: "jpeg",
        fullPage: true,
        quality: 90,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const imageBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "jpeg")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.jpeg`)

    writeFileSync(currentPath, imageBuffer)

    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(imageBuffer, baselinePath, {
        testName,
        format: "jpeg",
        quality: 90,
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    await VisualAssertions.assertImagesMatch(baselinePath, imageBuffer, {
      pixelTolerance: 0.05, // Higher tolerance for JPEG compression
      maxDiffPixels: 2000,
    })
  })

  test("WebP format conversion @visual", async () => {
    const testName = "html-to-webp"
    const html = TestDataGenerators.generateHTML({
      title: "WebP Test Document",
      content: "<p>This is a test document for WebP conversion.</p>",
      includeStyles: true,
    })

    const result = await cdpManager.convertToImage({
      html,
      options: {
        format: "webp",
        fullPage: true,
        quality: 90,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const imageBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "webp")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.webp`)

    writeFileSync(currentPath, imageBuffer)

    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(imageBuffer, baselinePath, {
        testName,
        format: "webp",
        quality: 90,
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    await VisualAssertions.assertImagesMatch(baselinePath, imageBuffer, {
      pixelTolerance: 0.03, // Moderate tolerance for WebP compression
      maxDiffPixels: 1500,
    })
  })

  test("HTML with CSS animations and transitions @visual", async () => {
    const testName = "css-animations-png"
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .animated-box {
              width: 100px;
              height: 100px;
              background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
              border-radius: 10px;
              animation: pulse 2s infinite;
              transition: transform 0.3s ease;
            }
            .animated-box:hover {
              transform: scale(1.1);
            }
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.7; }
              100% { opacity: 1; }
            }
            .fade-in {
              animation: fadeIn 1s ease-in;
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          </style>
        </head>
        <body>
          <h1>CSS Animations Test</h1>
          <p>This document tests CSS animations and transitions.</p>
          <div class="animated-box"></div>
          <div class="fade-in" style="margin-top: 20px; padding: 20px; background: #f0f0f0;">
            This content fades in
          </div>
        </body>
      </html>
    `

    // Wait a moment for animations to settle
    await new Promise(resolve => setTimeout(resolve, 100))

    const result = await cdpManager.convertToImage({
      html,
      options: {
        format: "png",
        fullPage: true,
        quality: 100,
        waitDelay: 1000, // Wait for animations to complete
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const imageBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "png")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.png`)

    writeFileSync(currentPath, imageBuffer)

    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(imageBuffer, baselinePath, {
        testName,
        format: "png",
        features: ["css-animations", "transitions"],
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    await VisualAssertions.assertImagesMatch(baselinePath, imageBuffer, {
      pixelTolerance: 0.03, // Some tolerance for animation timing
      maxDiffPixels: 1000,
    })
  })
})
