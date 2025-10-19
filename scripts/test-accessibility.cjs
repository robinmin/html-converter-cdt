#!/usr/bin/env node

/**
 * Accessibility Testing CLI Script
 *
 * This script provides command-line accessibility testing for the HTML Converter CDT
 * using axe-core and can be integrated into CI/CD pipelines.
 */

const fs = require("node:fs")
const path = require("node:path")
const process = require("node:process")

const axeSource = fs.readFileSync(path.join(__dirname, "../node_modules/axe-core/axe.js"), "utf8")
const { JSDOM } = require("jsdom")

// Configuration
const CONFIG = {
  htmlPath: path.join(__dirname, "../web/index.html"),
  outputPath: path.join(__dirname, "../accessibility-report.json"),
  verbose: process.argv.includes("--verbose"),
  critical: process.argv.includes("--critical"),
  outputFormat: process.argv.includes("--junit") ? "junit" : "json",
}

/**
 * Load HTML content for testing
 */
function loadHTMLContent() {
  try {
    const htmlContent = fs.readFileSync(CONFIG.htmlPath, "utf8")
    return htmlContent
  } catch (error) {
    console.warn("❌ Error loading HTML file:", error.message)
    process.exit(1)
  }
}

/**
 * Create DOM environment for testing
 */
function createTestDOM(htmlContent) {
  const dom = new JSDOM(htmlContent, {
    url: "http://localhost:3000",
    pretendToBeVisual: true,
    resources: "usable",
    runScripts: "dangerously",
  })

  // Inject axe-core source code
  try {
    dom.window.eval(axeSource)
    if (!dom.window.axe) {
      throw new Error("axe-core not properly initialized")
    }
  } catch (error) {
    throw new Error(`Failed to load axe-core library: ${error.message}`)
  }

  return dom
}

/**
 * Get axe configuration based on options
 */
function getAxeConfig() {
  if (CONFIG.critical) {
    return {
      rules: {
        "color-contrast": { enabled: true },
        "focus-order-semantics": { enabled: true },
        "button-name": { enabled: true },
        "link-name": { enabled: true },
        "aria-input-field-name": { enabled: true },
        "image-alt": { enabled: true },
        "landmark-one-main": { enabled: true },
        "document-title": { enabled: true },
        "html-has-lang": { enabled: true },
        "duplicate-id": { enabled: true },
        "tabindex": { enabled: true },
      },
      tags: ["wcag2a", "wcag21aa", "critical"],
      reporter: "v2",
      resultTypes: ["violations"],
    }
  }

  return {
    tags: ["wcag2a", "wcag21aa"],
    reporter: "v2",
    resultTypes: ["violations", "incomplete", "inapplicable", "passes"],
  }
}

/**
 * Run accessibility audit
 */
async function runAccessibilityAudit() {
  console.warn("🔍 Starting accessibility audit...\n")

  // Load HTML content
  const htmlContent = loadHTMLContent()
  console.warn("📄 HTML file loaded successfully")

  // Create DOM environment
  const dom = createTestDOM(htmlContent)
  console.warn("🌐 DOM environment created")

  // Get axe configuration
  const axeConfig = getAxeConfig()
  const testType = CONFIG.critical ? "Critical" : "Full"
  console.warn(`⚙️  Running ${testType} WCAG 2.1 AA compliance test`)

  try {
    // Run axe-core
    const results = await dom.window.axe.run(dom.window.document.body, axeConfig)

    console.warn("✅ Accessibility audit completed\n")

    return results
  } catch (error) {
    console.error("❌ Error running accessibility audit:", error.message)
    process.exit(1)
  } finally {
    dom.window.close()
  }
}

/**
 * Format results for console output
 */
function formatResultsForConsole(results) {
  const { violations, passes, incomplete, inapplicable } = results

  console.warn("📊 Accessibility Test Results")
  console.warn("================================")
  console.warn(`✅ Passed: ${passes.length}`)
  console.warn(`❌ Violations: ${violations.length}`)
  console.warn(`⚠️  Incomplete: ${incomplete.length}`)
  console.warn(`ℹ️  Inapplicable: ${inapplicable.length}`)
  console.warn("")

  if (violations.length > 0) {
    console.warn("🚨 Accessibility Violations Found:")
    console.warn("===============================")

    violations.forEach((violation, index) => {
      console.warn(`\n${index + 1}. ${violation.id.toUpperCase()}`)
      console.warn(`   Impact: ${violation.impact || "unknown"}`)
      console.warn(`   Description: ${violation.description}`)
      console.warn(`   Help: ${violation.help}`)
      console.warn(`   Help URL: ${violation.helpUrl}`)

      if (violation.nodes.length > 0) {
        console.warn(`   Affected elements: ${violation.nodes.length}`)

        if (CONFIG.verbose) {
          violation.nodes.forEach((node, nodeIndex) => {
            console.warn(`     ${nodeIndex + 1}. ${node.html}`)
            console.warn(`        Target: ${node.target.join(", ")}`)
            console.warn(`        Failure: ${node.failureSummary}`)
          })
        }
      }
    })

    console.warn("")
  } else {
    console.warn("🎉 No accessibility violations found!")
  }

  if (incomplete.length > 0) {
    console.warn("⚠️  Incomplete Checks (Manual Review Required):")
    console.warn("===============================================")

    incomplete.forEach((incomplete, index) => {
      console.warn(`\n${index + 1}. ${incomplete.id.toUpperCase()}`)
      console.warn(`   Description: ${incomplete.description}`)
      console.warn(`   Reason: ${incomplete.reason}`)
    })

    console.warn("")
  }
}

/**
 * Format results as JSON
 */
function formatResultsAsJSON(results) {
  return {
    timestamp: new Date().toISOString(),
    testType: CONFIG.critical ? "critical" : "full",
    wcagLevel: "2.1 AA",
    summary: {
      total: results.violations.length + results.incomplete.length,
      violations: results.violations.length,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
      critical: results.violations.filter(v => v.impact === "critical").length,
      serious: results.violations.filter(v => v.impact === "serious").length,
      moderate: results.violations.filter(v => v.impact === "moderate").length,
      minor: results.violations.filter(v => v.impact === "minor").length,
    },
    violations: results.violations.map(v => ({
      rule: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map(n => ({
        html: n.html,
        target: n.target,
        failureSummary: n.failureSummary,
      })),
    })),
    incomplete: results.incomplete.map(i => ({
      rule: i.id,
      description: i.description,
      reason: i.reason,
      help: i.help,
      helpUrl: i.helpUrl,
    })),
    compliant: results.violations.length === 0,
  }
}

/**
 * Format results as JUnit XML
 */
function formatResultsAsJUnitXML(results) {
  const timestamp = new Date().toISOString()
  let xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
  xml += `<testsuites name="Accessibility Tests" tests="${results.violations.length}" failures="${results.violations.length}" time="0" timestamp="${timestamp}">\n`
  xml += `  <testsuite name="WCAG 2.1 AA Compliance" tests="${results.violations.length}" failures="${results.violations.length}" time="0">\n`

  results.violations.forEach((violation, _index) => {
    xml += `    <testcase name="${violation.id}" classname="accessibility" time="0">\n`
    xml += `      <failure message="${escapeXML(violation.description)}">\n`
    xml += `        <![CDATA[\n`
    xml += `Impact: ${violation.impact}\n`
    xml += `Help: ${violation.help}\n`
    xml += `Help URL: ${violation.helpUrl}\n`
    xml += `\n`

    violation.nodes.forEach((node, nodeIndex) => {
      xml += `Element ${nodeIndex + 1}:\n`
      xml += `HTML: ${node.html}\n`
      xml += `Target: ${node.target.join(", ")}\n`
      xml += `Failure: ${node.failureSummary}\n\n`
    })

    xml += `        ]]>\n`
    xml += `      </failure>\n`
    xml += `    </testcase>\n`
  })

  xml += "  </testsuite>\n"
  xml += "</testsuites>\n"

  return xml
}

/**
 * Escape XML special characters
 */
function escapeXML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * Save results to file
 */
function saveResults(results, format) {
  let content
  let filename

  if (format === "junit") {
    content = formatResultsAsJUnitXML(results)
    filename = CONFIG.outputPath.replace(".json", ".xml")
  } else {
    content = JSON.stringify(formatResultsAsJSON(results), null, 2)
    filename = CONFIG.outputPath
  }

  try {
    fs.writeFileSync(filename, content, "utf8")
    console.warn(`💾 Results saved to: ${filename}`)
  } catch (error) {
    console.error("❌ Error saving results:", error.message)
  }
}

/**
 * Set exit code based on results
 */
function setExitCode(results) {
  const hasViolations = results.violations.length > 0
  const hasIncomplete = results.incomplete.length > 0

  if (hasViolations) {
    process.exit(1) // Fail for violations
  } else if (hasIncomplete) {
    process.exit(2) // Special exit code for incomplete checks
  } else {
    process.exit(0) // Success
  }
}

/**
 * Show help information
 */
function showHelp() {
  console.warn(`
HTML Converter CDT - Accessibility Testing CLI

Usage:
  node test-accessibility.js [options]

Options:
  --critical     Run only critical accessibility rules
  --verbose      Show detailed violation information
  --junit        Output results in JUnit XML format
  --help         Show this help message

Examples:
  node test-accessibility.js                    # Run full accessibility audit
  node test-accessibility.js --critical          # Run critical rules only
  node test-accessibility.js --verbose           # Show detailed results
  node test-accessibility.js --junit             # Output JUnit XML format

Exit Codes:
  0 - Success (no violations)
  1 - Failed (violations found)
  2 - Warning (incomplete checks found)

The accessibility audit tests the web interface for WCAG 2.1 AA compliance.
Results are saved to accessibility-report.json (or .xml for JUnit format).
`)
}

/**
 * Main function
 */
async function main() {
  // Check for help flag
  if (process.argv.includes("--help")) {
    showHelp()
    return
  }

  console.warn("🚀 HTML Converter CDT - Accessibility Testing\n")

  try {
    // Run accessibility audit
    const results = await runAccessibilityAudit()

    // Display results
    formatResultsForConsole(results)

    // Save results
    saveResults(results, CONFIG.outputFormat)

    // Set exit code
    setExitCode(results)
  } catch (error) {
    console.error("❌ Fatal error:", error.message)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
}

module.exports = {
  runAccessibilityAudit,
  formatResultsForConsole,
  formatResultsAsJSON,
  formatResultsAsJUnitXML,
}
