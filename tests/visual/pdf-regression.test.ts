/**
 * Visual regression tests for PDF outputs
 */

import { Buffer } from "node:buffer"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "@playwright/test"

import { ChromeCDPManager } from "../../src/core/engine/chrome-cdp-manager.js"
import { TestDataGenerators } from "../utils/test-helpers.js"

import { VisualAssertions, VisualRegressionUtils } from "./utils/visual-regression.js"

test.describe("PDF Visual Regression", () => {
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

  test("basic HTML to PDF conversion @visual", async () => {
    const testName = "basic-html-pdf"
    const html = TestDataGenerators.generateHTML({
      title: "Basic Test Document",
      content: "<p>This is a basic HTML document for PDF visual regression testing.</p>",
      includeStyles: true,
    })

    // Convert to PDF
    const result = await cdpManager.convertToPDF({
      html,
      options: {
        format: "A4",
        printBackground: true,
        margin: {
          top: "1cm",
          bottom: "1cm",
          left: "1cm",
          right: "1cm",
        },
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const pdfBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "pdf")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.pdf`)

    // Save current output for inspection
    writeFileSync(currentPath, pdfBuffer)

    // Check if baseline exists, create if not
    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(pdfBuffer, baselinePath, {
        testName,
        format: "pdf",
        html: html.substring(0, 200) + "...",
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    // Compare with baseline
    await VisualAssertions.assertPDFMatches(baselinePath, pdfBuffer, {
      pixelTolerance: 0.01,
      maxDiffPixels: 1000,
    })
  })

  test("complex HTML to PDF conversion @visual", async () => {
    const testName = "complex-html-pdf"
    const html = TestDataGenerators.generateComplexHTML()

    const result = await cdpManager.convertToPDF({
      html,
      options: {
        format: "A4",
        printBackground: true,
        margin: {
          top: "1cm",
          bottom: "1cm",
          left: "1cm",
          right: "1cm",
        },
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const pdfBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "pdf")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.pdf`)

    writeFileSync(currentPath, pdfBuffer)

    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(pdfBuffer, baselinePath, {
        testName,
        format: "pdf",
        complexity: "complex",
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    await VisualAssertions.assertPDFMatches(baselinePath, pdfBuffer, {
      pixelTolerance: 0.02, // Slightly higher tolerance for complex content
      maxDiffPixels: 2000,
    })
  })

  test("HTML with tables to PDF conversion @visual", async () => {
    const testName = "tables-html-pdf"
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Table Test Document</h1>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>City</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>John Doe</td>
                <td>30</td>
                <td>New York</td>
              </tr>
              <tr>
                <td>Jane Smith</td>
                <td>25</td>
                <td>Los Angeles</td>
              </tr>
              <tr>
                <td>Bob Johnson</td>
                <td>35</td>
                <td>Chicago</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `

    const result = await cdpManager.convertToPDF({
      html,
      options: {
        format: "A4",
        printBackground: true,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const pdfBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "pdf")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.pdf`)

    writeFileSync(currentPath, pdfBuffer)

    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(pdfBuffer, baselinePath, {
        testName,
        format: "pdf",
        contentType: "tables",
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    await VisualAssertions.assertPDFMatches(baselinePath, pdfBuffer)
  })

  test("PDF conversion with different page sizes @visual", async () => {
    const pageSizes = ["A4", "A3", "Letter", "Legal"] as const

    for (const pageSize of pageSizes) {
      const testName = `pdf-page-size-${pageSize.toLowerCase()}`
      const html = TestDataGenerators.generateHTML({
        title: `Page Size Test - ${pageSize}`,
        content: `<p>This document tests PDF generation with ${pageSize} page size.</p>`,
      })

      const result = await cdpManager.convertToPDF({
        html,
        options: {
          format: pageSize,
          printBackground: true,
        },
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const pdfBuffer = Buffer.from(result.data, "base64")
      const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "pdf")
      const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.pdf`)

      writeFileSync(currentPath, pdfBuffer)

      if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
        console.log(`Creating baseline for ${testName}`)
        VisualRegressionUtils.generateBaseline(pdfBuffer, baselinePath, {
          testName,
          format: "pdf",
          pageSize,
        })
        test.skip(true, "Baseline created - test will pass on next run")
        return
      }

      await VisualAssertions.assertPDFMatches(baselinePath, pdfBuffer)
    }
  })

  test("PDF conversion with landscape orientation @visual", async () => {
    const testName = "pdf-landscape"
    const html = TestDataGenerators.generateHTML({
      title: "Landscape Test Document",
      content: "<p>This document tests landscape orientation for PDF generation.</p>",
    })

    const result = await cdpManager.convertToPDF({
      html,
      options: {
        format: "A4",
        landscape: true,
        printBackground: true,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const pdfBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "pdf")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.pdf`)

    writeFileSync(currentPath, pdfBuffer)

    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(pdfBuffer, baselinePath, {
        testName,
        format: "pdf",
        orientation: "landscape",
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    await VisualAssertions.assertPDFMatches(baselinePath, pdfBuffer)
  })

  test("PDF conversion with custom margins @visual", async () => {
    const testName = "pdf-custom-margins"
    const html = TestDataGenerators.generateHTML({
      title: "Custom Margins Test",
      content: "<p>This document tests custom margins for PDF generation.</p>",
    })

    const result = await cdpManager.convertToPDF({
      html,
      options: {
        format: "A4",
        margin: {
          top: "2cm",
          bottom: "2cm",
          left: "3cm",
          right: "1cm",
        },
        printBackground: true,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const pdfBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "pdf")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.pdf`)

    writeFileSync(currentPath, pdfBuffer)

    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(pdfBuffer, baselinePath, {
        testName,
        format: "pdf",
        margins: "custom",
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    await VisualAssertions.assertPDFMatches(baselinePath, pdfBuffer)
  })

  test("PDF conversion with header and footer @visual", async () => {
    const testName = "pdf-header-footer"
    const html = TestDataGenerators.generateHTML({
      title: "Header Footer Test",
      content: `
        <p>This document tests custom headers and footers in PDF generation.</p>
        <div style="page-break-after: always;"></div>
        <p>This is the second page with header and footer.</p>
      `,
    })

    const result = await cdpManager.convertToPDF({
      html,
      options: {
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size:10px; width:100%; text-align:center; padding: 0 20px;">
            HTML Converter Test - Page <span class="pageNumber"></span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size:10px; width:100%; text-align:center; padding: 0 20px;">
            Generated on <span class="date"></span>
          </div>
        `,
      },
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    const pdfBuffer = Buffer.from(result.data, "base64")
    const baselinePath = VisualRegressionUtils.getBaselinePath(testName, "pdf")
    const currentPath = join(process.cwd(), "tests", "visual", "current", `${testName}.pdf`)

    writeFileSync(currentPath, pdfBuffer)

    if (!VisualRegressionUtils.validateBaseline(baselinePath)) {
      console.log(`Creating baseline for ${testName}`)
      VisualRegressionUtils.generateBaseline(pdfBuffer, baselinePath, {
        testName,
        format: "pdf",
        features: ["header", "footer"],
      })
      test.skip(true, "Baseline created - test will pass on next run")
      return
    }

    await VisualAssertions.assertPDFMatches(baselinePath, pdfBuffer)
  })
})
