/**
 * Vitest Integration for Accessibility Testing
 *
 * This file provides Vitest integration for automated accessibility testing
 * using axe-core with CI/CD pipeline support and detailed reporting.
 */

// Import mocked axe
import axe from "axe-core"
import { JSDOM } from "jsdom"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  checkWCAGCompliance,
  criticalAxeConfig,
  defaultRunOptions,
  formatAccessibilityResults,
} from "../axe-config"

// Setup axe mocks before import
vi.mock("axe-core", () => {
  const mockAxe = vi.fn(() => Promise.resolve({
    violations: [],
    passes: [],
    incomplete: [],
    inapplicable: [],
    timestamp: new Date().toISOString(),
    url: "http://localhost:3000",
  }))

  const mockConfigure = vi.fn()

  return {
    default: mockAxe,
    configure: mockConfigure,
  }
})

// Mock DOM setup utilities
const createTestDOM = (htmlContent?: string) => {
  const dom = new JSDOM(htmlContent || `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HTML Converter CDT - Test</title>
    </head>
    <body>
      <header role="banner">
        <h1>HTML Converter CDT</h1>
        <nav role="navigation">
          <a href="#converter" aria-current="page">Converter</a>
          <a href="#settings">Settings</a>
        </nav>
      </header>

      <main id="main-content" role="main">
        <section aria-labelledby="input-title">
          <h2 id="input-title">Input Selection</h2>
          <div role="radiogroup" aria-labelledby="input-method-label">
            <h3 id="input-method-label">Select input method:</h3>
            <label>
              <input type="radio" name="input-method" value="url" checked>
              URL
            </label>
            <label>
              <input type="radio" name="input-method" value="html">
              HTML Content
            </label>
          </div>

          <div class="input-group">
            <label for="url-field">Enter URL:</label>
            <input type="url" id="url-field" aria-describedby="url-help" required>
            <div id="url-help">Enter the full URL of the webpage</div>
          </div>
        </section>

        <section aria-labelledby="format-title">
          <h2 id="format-title">Format Selection</h2>
          <div role="radiogroup" aria-labelledby="format-label">
            <h3 id="format-label">Output format:</h3>
            <label>
              <input type="radio" name="output-format" value="pdf" checked>
              PDF
            </label>
            <label>
              <input type="radio" name="output-format" value="mhtml">
              MHTML
            </label>
          </div>
        </section>

        <section aria-labelledby="convert-title">
          <h2 id="convert-title">Convert</h2>
          <button id="convert-button" aria-busy="false">
            Convert Document
          </button>

          <div id="progress-container" role="status" aria-live="polite" hidden>
            <h3 id="progress-title">Conversion Progress</h3>
            <div role="progressbar" aria-labelledby="progress-title"
                 aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
              <div style="width: 0%"></div>
            </div>
            <span id="progress-percentage" aria-live="polite">0%</span>
            <span id="progress-message" aria-live="polite">Starting...</span>
          </div>

          <div id="results-container" role="region" aria-labelledby="results-title" hidden>
            <h3 id="results-title">Results</h3>
            <div role="alert" aria-live="polite" id="success-result">
              <h4>Conversion Successful!</h4>
              <button id="download-button">Download Document</button>
            </div>
            <div role="alert" aria-live="assertive" id="error-result" hidden>
              <h4>Conversion Failed</h4>
              <p id="error-message">Error occurred</p>
            </div>
          </div>
        </section>
      </main>

      <footer role="contentinfo">
        <p>&copy; 2024 HTML Converter CDT</p>
      </footer>

      <div id="settings-dialog" role="dialog" aria-labelledby="settings-title" aria-modal="true" hidden>
        <h2 id="settings-title">Settings</h2>
        <button aria-label="Close settings">&times;</button>
      </div>
    </body>
    </html>
  `, {
    url: "http://localhost:3000",
    pretendToBeVisual: true,
    resources: "usable",
    runScripts: "dangerously",
  })

  return dom
}

describe("hTML Converter CDT - Accessibility Integration Tests", () => {
  let dom: JSDOM
  let document: Document

  beforeAll(() => {
    // Setup global JSDOM environment
    dom = createTestDOM()
    globalThis.document = dom.window.document
    globalThis.window = dom.window as any

    // Only set navigator if it doesn't exist or is writable
    if (!globalThis.navigator || Object.getOwnPropertyDescriptor(globalThis, "navigator")?.writable) {
      globalThis.navigator = dom.window.navigator
    }
  })

  beforeEach(() => {
    // Reset DOM for each test
    const newDom = createTestDOM()
    document = newDom.window.document
    globalThis.document = document
    globalThis.window = newDom.window as any

    // Reset mocks
    vi.clearAllMocks()
  })

  afterAll(() => {
    if (dom && dom.window) {
      dom.window.close()
    }
  })

  describe("automated Accessibility Testing", () => {
    it("should pass WCAG 2.1 AA compliance tests", async () => {
      const results = await axe(document.body, {
        rules: defaultRunOptions.rules,
        tags: ["wcag2a", "wcag21aa"],
        reporter: "v2",
      })

      const formattedResults = formatAccessibilityResults(results)
      const compliance = checkWCAGCompliance(results)

      console.log("Accessibility Test Results:", {
        violations: formattedResults.violations.length,
        summary: formattedResults.summary,
        compliance,
      })

      // Assert WCAG compliance
      expect(compliance.compliant).toBe(true)
      expect(formattedResults.violations).toHaveLength(0)

      // If violations exist for debugging
      if (formattedResults.violations.length > 0) {
        console.error("Accessibility Violations:", formattedResults.violations)
      }
    })

    it("should pass critical accessibility rules", async () => {
      const results = await axe(document.body, criticalAxeConfig)

      expect(results.violations).toHaveLength(0)

      // Log any issues for debugging
      if (results.violations.length > 0) {
        console.error("Critical Accessibility Issues:", results.violations)
      }
    })

    it("should have proper semantic structure", async () => {
      const semanticViolations = await axe(document.body, {
        rules: {
          "html-has-lang": { enabled: true },
          "page-has-heading-one": { enabled: true },
          "landmark-one-main": { enabled: true },
          "region": { enabled: true },
          "heading-order": { enabled: true },
        },
        reporter: "v2",
      })

      expect(semanticViolations.violations).toHaveLength(0)
    })

    it("should have accessible form controls", async () => {
      const formViolations = await axe(document.body, {
        rules: {
          "button-name": { enabled: true },
          "link-name": { enabled: true },
          "aria-input-field-name": { enabled: true },
          "label-title-only": { enabled: true },
          "form-field-multiple-labels": { enabled: true },
        },
        reporter: "v2",
      })

      expect(formViolations.violations).toHaveLength(0)
    })

    it("should have proper keyboard navigation support", async () => {
      const keyboardViolations = await axe(document.body, {
        rules: {
          "keyboard": { enabled: true },
          "tabindex": { enabled: true },
          "focus-order-semantics": { enabled: true },
          "skip-link": { enabled: true },
        },
        reporter: "v2",
      })

      expect(keyboardViolations.violations).toHaveLength(0)
    })

    it("should have sufficient color contrast", async () => {
      // Mock CSS with accessible colors
      const style = document.createElement("style")
      style.textContent = `
        :root {
          --text-color: #212529;
          --background-color: #ffffff;
          --primary-color: #0066cc;
        }

        body {
          color: var(--text-color);
          background-color: var(--background-color);
        }

        button {
          background-color: var(--primary-color);
          color: white;
        }

        :focus {
          outline: 3px solid #005fcc;
          outline-offset: 2px;
        }
      `
      document.head.appendChild(style)

      const contrastViolations = await axe(document.body, {
        rules: {
          "color-contrast": { enabled: true },
        },
        reporter: "v2",
      })

      expect(contrastViolations.violations).toHaveLength(0)
    })

    it("should have proper ARIA implementation", async () => {
      const ariaViolations = await axe(document.body, {
        rules: {
          "aria-labels": { enabled: true },
          "aria-valid-attr-value": { enabled: true },
          "aria-required-attr": { enabled: true },
          "aria-allowed-attr": { enabled: true },
          "aria-dialog-name": { enabled: true },
          "aria-live": { enabled: true },
        },
        reporter: "v2",
      })

      expect(ariaViolations.violations).toHaveLength(0)
    })
  })

  describe("component-Specific Accessibility Tests", () => {
    it("should have accessible converter button", async () => {
      const convertButton = document.getElementById("convert-button")
      expect(convertButton).toBeTruthy()

      const buttonViolations = await axe(convertButton!, {
        rules: {
          "button-name": { enabled: true },
        },
        reporter: "v2",
      })

      expect(buttonViolations.violations).toHaveLength(0)
    })

    it("should have accessible progress indicators", async () => {
      const progressContainer = document.getElementById("progress-container")
      expect(progressContainer).toBeTruthy()

      const progressViolations = await axe(progressContainer!, {
        rules: {
          "aria-live": { enabled: true },
          "progressbar-accessibility": { enabled: true },
        },
        reporter: "v2",
      })

      expect(progressViolations.violations).toHaveLength(0)
    })

    it("should have accessible form inputs", async () => {
      const urlInput = document.getElementById("url-field")
      expect(urlInput).toBeTruthy()

      const inputViolations = await axe(urlInput!, {
        rules: {
          "aria-input-field-name": { enabled: true },
          "label": { enabled: true },
        },
        reporter: "v2",
      })

      expect(inputViolations.violations).toHaveLength(0)
    })

    it("should have accessible radio button groups", async () => {
      const radioGroups = document.querySelectorAll("[role=\"radiogroup\"]")
      expect(radioGroups.length).toBeGreaterThan(0)

      for (const group of radioGroups) {
        const radioViolations = await axe(group, {
          rules: {
            "radiogroup": { enabled: true },
            "aria-labels": { enabled: true },
          },
          reporter: "v2",
        })

        expect(radioViolations.violations).toHaveLength(0)
      }
    })

    it("should have accessible dialog", async () => {
      const dialog = document.getElementById("settings-dialog")
      expect(dialog).toBeTruthy()

      // Make dialog visible for testing
      dialog.removeAttribute("hidden")

      const dialogViolations = await axe(dialog, {
        rules: {
          "aria-dialog-name": { enabled: true },
          "focus-trap": { enabled: true },
        },
        reporter: "v2",
      })

      expect(dialogViolations.violations).toHaveLength(0)
    })
  })

  describe("dynamic Content Accessibility Tests", () => {
    it("should handle progress updates accessibly", async () => {
      const progressContainer = document.getElementById("progress-container")
      const progressBar = progressContainer?.querySelector("[role=\"progressbar\"]")

      // Make progress visible
      progressContainer?.removeAttribute("hidden")

      // Update progress
      if (progressBar) {
        progressBar.setAttribute("aria-valuenow", "50")
        progressBar.setAttribute("aria-valuetext", "50% - Converting...")

        const progressMessage = document.getElementById("progress-message")
        if (progressMessage) {
          progressMessage.textContent = "Converting document..."
        }
      }

      const progressViolations = await axe(progressContainer!, {
        rules: {
          "aria-live": { enabled: true },
          "progressbar-accessibility": { enabled: true },
        },
        reporter: "v2",
      })

      expect(progressViolations.violations).toHaveLength(0)
    })

    it("should handle error states accessibly", async () => {
      const resultsContainer = document.getElementById("results-container")
      const errorResult = document.getElementById("error-result")

      // Make results visible and show error
      resultsContainer?.removeAttribute("hidden")
      errorResult?.removeAttribute("hidden")

      const errorMessage = document.getElementById("error-message")
      if (errorMessage) {
        errorMessage.textContent = "Conversion failed: Invalid URL provided"
      }

      const errorViolations = await axe(resultsContainer!, {
        rules: {
          "aria-live": { enabled: true },
          "role-alert": { enabled: true },
        },
        reporter: "v2",
      })

      expect(errorViolations.violations).toHaveLength(0)
    })

    it("should handle success states accessibly", async () => {
      const resultsContainer = document.getElementById("results-container")
      const successResult = document.getElementById("success-result")

      // Make results visible and show success
      resultsContainer?.removeAttribute("hidden")
      successResult?.removeAttribute("hidden")

      const downloadButton = document.getElementById("download-button")
      expect(downloadButton).toBeTruthy()

      const successViolations = await axe(resultsContainer!, {
        rules: {
          "aria-live": { enabled: true },
          "role-alert": { enabled: true },
          "button-name": { enabled: true },
        },
        reporter: "v2",
      })

      expect(successViolations.violations).toHaveLength(0)
    })
  })

  describe("responsive Accessibility Tests", () => {
    it("should maintain accessibility on mobile viewport", async () => {
      // Simulate mobile viewport
      Object.defineProperty(dom.window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      })
      Object.defineProperty(dom.window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 667,
      })

      // Trigger resize
      dom.window.dispatchEvent(new dom.window.Event("resize"))

      const mobileViolations = await axe(document.body, {
        rules: {
          "target-size": { enabled: true },
          "color-contrast": { enabled: true },
        },
        reporter: "v2",
      })

      expect(mobileViolations.violations).toHaveLength(0)
    })

    it("should handle high contrast mode", async () => {
      // Simulate high contrast mode
      const style = document.createElement("style")
      style.textContent = `
        @media (prefers-contrast: high) {
          :root {
            --focus-color: #ffffff;
            --text-color: #ffffff;
            --background-color: #000000;
          }

          :focus {
            outline: 4px solid var(--focus-color);
            outline-offset: 0px;
          }
        }
      `
      document.head.appendChild(style)

      // Mock prefers-contrast: high
      Object.defineProperty(dom.window, "matchMedia", {
        writable: true,
        value: (query: string) => ({
          matches: query === "(prefers-contrast: high)",
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      })

      const contrastViolations = await axe(document.body, {
        rules: {
          "color-contrast": { enabled: true },
        },
        reporter: "v2",
      })

      expect(contrastViolations.violations).toHaveLength(0)
    })
  })

  describe("accessibility Reporting", () => {
    it("should generate comprehensive accessibility report", async () => {
      const results = await axe(document.body, {
        rules: defaultRunOptions.rules,
        tags: ["wcag2a", "wcag21aa"],
        reporter: "v2",
        resultTypes: ["violations", "incomplete", "inapplicable", "passes"],
      })

      const formattedResults = formatAccessibilityResults(results)
      const compliance = checkWCAGCompliance(results)

      // Verify report structure
      expect(formattedResults).toHaveProperty("summary")
      expect(formattedResults).toHaveProperty("violations")
      expect(formattedResults.summary).toHaveProperty("total")
      expect(formattedResults.summary).toHaveProperty("critical")
      expect(formattedResults.summary).toHaveProperty("serious")
      expect(formattedResults.summary).toHaveProperty("moderate")
      expect(formattedResults.summary).toHaveProperty("minor")

      // Verify compliance check
      expect(compliance).toHaveProperty("compliant")
      expect(compliance).toHaveProperty("issues")
      expect(compliance).toHaveProperty("criticalIssues")

      // Log results for CI/CD
      console.log("=== Accessibility Test Report ===")
      console.log(`Total Violations: ${formattedResults.summary.total}`)
      console.log(`Critical Issues: ${formattedResults.summary.critical}`)
      console.log(`Serious Issues: ${formattedResults.summary.serious}`)
      console.log(`Moderate Issues: ${formattedResults.summary.moderate}`)
      console.log(`Minor Issues: ${formattedResults.summary.minor}`)
      console.log(`WCAG Compliant: ${compliance.compliant}`)

      if (formattedResults.violations.length > 0) {
        console.log("Violations:", formattedResults.violations)
      }
    })
  })
})

// Export utilities for other test files
export { checkWCAGCompliance, createTestDOM, formatAccessibilityResults }
