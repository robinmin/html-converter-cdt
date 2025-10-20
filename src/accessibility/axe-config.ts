/**
 * Axe-core Configuration for HTML Converter CDT
 *
 * This configuration defines the accessibility rules and tags for automated
 * accessibility testing using axe-core to ensure WCAG 2.1 AA compliance.
 */

import type { AxeResults, RunOptions } from "axe-core"

/**
 * Axe-core configuration for WCAG 2.1 AA compliance
 */
export const axeConfig: Partial<RunOptions> = {
  // Enable all WCAG 2.1 AA rules
  rules: {
    // Color and contrast
    "color-contrast": {
      enabled: true,
    },

    // Keyboard and navigation
    "keyboard": {
      enabled: true,
    },
    "tabindex": {
      enabled: true,
    },
    "focus-order-semantics": {
      enabled: true,
    },
    "focus-trap": {
      enabled: true,
    },

    // ARIA and semantic HTML
    "aria-labels": {
      enabled: true,
    },
    "aria-input-field-name": {
      enabled: true,
    },
    "aria-required-attr": {
      enabled: true,
    },
    "aria-allowed-attr": {
      enabled: true,
    },
    "aria-hidden-body": {
      enabled: true,
    },
    "aria-hidden-focus": {
      enabled: true,
    },
    "aria-dialog-name": {
      enabled: true,
    },
    "aria-valid-attr-value": {
      enabled: true,
    },

    // Form accessibility
    "button-name": {
      enabled: true,
    },
    "link-name": {
      enabled: true,
    },
    "form-field-multiple-labels": {
      enabled: true,
    },
    "label-title-only": {
      enabled: true,
    },
    "input-button-name": {
      enabled: true,
    },
    "select-name": {
      enabled: true,
    },
    "textarea-name": {
      enabled: true,
    },
    "checkboxgroup": {
      enabled: true,
    },
    "radiogroup": {
      enabled: true,
    },
    "legend": {
      enabled: true,
    },
    "fieldset": {
      enabled: true,
    },
    "fieldset-legend": {
      enabled: true,
    },

    // Images and media
    "image-alt": {
      enabled: true,
    },
    "image-redundant-alt": {
      enabled: true,
    },
    "input-image-alt": {
      enabled: true,
    },
    "area-alt": {
      enabled: true,
    },
    "object-alt": {
      enabled: true,
    },
    "embed": {
      enabled: true,
    },
    "video-caption": {
      enabled: true,
    },
    "audio-caption": {
      enabled: true,
    },

    // Headings and structure
    "heading-order": {
      enabled: true,
    },
    "landmark-one-main": {
      enabled: true,
    },
    "page-has-heading-one": {
      enabled: true,
    },
    "region": {
      enabled: true,
    },
    "no-heading-level-skip": {
      enabled: true,
    },

    // Lists and tables
    "list": {
      enabled: true,
    },
    "listitem": {
      enabled: true,
    },
    "definition-list": {
      enabled: true,
    },
    "dlitem": {
      enabled: true,
    },
    "table-headers": {
      enabled: true,
    },
    "th-has-data-cells": {
      enabled: true,
    },
    "td-headers-attr": {
      enabled: true,
    },

    // Frames and iframes
    "frame-title": {
      enabled: true,
    },
    "frame-title-unique": {
      enabled: true,
    },

    // Document structure
    "document-title": {
      enabled: true,
    },
    "html-has-lang": {
      enabled: true,
    },
    "html-lang-valid": {
      enabled: true,
    },
    "meta-viewport": {
      enabled: true,
    },
    "meta-viewport-large": {
      enabled: true,
    },

    // Links and navigation
    "link-in-text-block": {
      enabled: true,
    },
    "focus-management-semantics": {
      enabled: true,
    },
    "skip-link": {
      enabled: true,
    },

    // Error handling and validation
    "aria-errormessage": {
      enabled: true,
    },
    "aria-required-children": {
      enabled: true,
    },
    "aria-required-parent": {
      enabled: true,
    },

    // Interactive elements
    "duplicate-id": {
      enabled: true,
    },
    "duplicate-id-active": {
      enabled: true,
    },
    "duplicate-id-aria": {
      enabled: true,
    },
    "aria-owns": {
      enabled: true,
    },
    "role-img-alt": {
      enabled: true,
    },

    // Mobile and touch
    "bypass": {
      enabled: true,
    },
    "target-size": {
      enabled: true,
    },

    // Cognitive accessibility
    "aria-roledescription": {
      enabled: true,
    },
    "identical-links-same-purpose": {
      enabled: true,
    },
  },

  // Target WCAG 2.1 AA compliance
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag21aa", "wcag412", "best-practice"],
  },

  // Reporter configuration
  reporter: "v2" as const,

  // Note: include/exclude should be passed as context parameter when running axe, not in RunOptions
  // Example: axe.run(document, { include: [["main"]], exclude: [["script"]] }, runOptions)

  // Configure result types
  resultTypes: ["violations", "incomplete", "inapplicable"] as const,

  // Performance optimizations
  pingWaitTime: 500,

  // Note: Additional rule configurations were removed as 'configuredRules' is not a valid RunOptions property
  // These were already covered in the 'rules' object above (lines 17-244)
  // If you need to add more rule-specific configurations, add them to the 'rules' object
}

/**
 * Axe-core configuration for critical rules only (faster testing)
 */
export const criticalAxeConfig: Partial<RunOptions> = {
  rules: {
    // Enable only critical rules for quick testing
    "color-contrast": { enabled: true },
    "keyboard": { enabled: true },
    "focus-order-semantics": { enabled: true },
    "button-name": { enabled: true },
    "link-name": { enabled: true },
    "aria-input-field-name": { enabled: true },
    "image-alt": { enabled: true },
    "landmark-one-main": { enabled: true },
    "document-title": { enabled: true },
    "html-has-lang": { enabled: true },
    "duplicate-id": { enabled: true },
  },

  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag21aa", "best-practice"],
  },

  reporter: "v2" as const,

  resultTypes: ["violations"] as const,
}

/**
 * Custom rule configurations for HTML Converter CDT specific scenarios
 */
export const customRulesConfig = {
  // Progress bar accessibility
  progressbarAccessibility: {
    rule: {
      id: "progressbar-accessibility",
      selector: "[role=\"progressbar\"]",
      enabled: true,
      description: "Progress bars must be properly labeled and announce updates",
      help: "Progress elements must have accessible names and provide status updates",
      helpUrl: "https://www.w3.org/TR/wai-aria-1.1/#progressbar",
    },
    check: (node: Element, _options: any) => {
      // Custom check for progress bar accessibility
      const ariaLabel = node.getAttribute("aria-label")
      const ariaLabelledBy = node.getAttribute("aria-labelledby")
      const ariaValueNow = node.getAttribute("aria-valuenow")
      const ariaValueMin = node.getAttribute("aria-valuemin")
      const ariaValueMax = node.getAttribute("aria-valuemax")

      return {
        passes: [
          {
            node,
            result: (
              ariaLabel !== null
              || ariaLabelledBy !== null
              || (node as HTMLElement).textContent?.trim().length > 0
            ) && (
              ariaValueNow !== null
              && ariaValueMin !== null
              && ariaValueMax !== null
            ),
          },
        ],
        violations: [],
        incomplete: [],
      }
    },
  },

  // Live region accessibility
  liveRegionAccessibility: {
    rule: {
      id: "live-region-accessibility",
      selector: "[aria-live]",
      enabled: true,
      reviewOnFail: false,
      description: "Live regions must be properly configured for screen readers",
      help: "Live regions should announce important status changes",
      helpUrl: "https://www.w3.org/TR/wai-aria-1.1/#live_regions",
    },
    check: (node: Element, _options: any) => {
      const ariaLive = node.getAttribute("aria-live")
      const _ariaAtomic = node.getAttribute("aria-atomic")

      return {
        passes: [
          {
            node,
            result: ["polite", "assertive"].includes(ariaLive || ""),
          },
        ],
        violations: [],
        incomplete: [],
      }
    },
  },

  // File input accessibility
  fileInputAccessibility: {
    rule: {
      id: "file-input-accessibility",
      selector: "input[type=\"file\"]",
      enabled: true,
      reviewOnFail: false,
      description: "File inputs must have accessible labels and error handling",
      help: "File inputs should be properly labeled and provide clear instructions",
      helpUrl: "https://www.w3.org/WAI/WCAG21/Understanding/identify-input-purpose.html",
    },
    check: (node: Element, _options: any) => {
      const hasLabel = document.querySelector(`label[for="${node.id}"]`)
        || node.hasAttribute("aria-label")
        || node.hasAttribute("aria-labelledby")

      return {
        passes: [
          {
            node,
            result: hasLabel || false,
          },
        ],
        violations: [],
        incomplete: [],
      }
    },
  },
}

/**
 * Default axe-core run options for the HTML Converter CDT
 */
export const defaultRunOptions: RunOptions = {
  ...axeConfig,
  // Additional configuration for CI/CD
  pingWaitTime: 1000,
  frameWaitTime: 10000,
  // Configure for automated testing
  absolutePaths: false,
  // Include iframes
  iframes: false,
}

/**
 * Run accessibility audit with custom rules
 */
export function runAccessibilityAudit(context?: Element | Document, options: Partial<RunOptions> = {}): Promise<AxeResults> {
  const mergedOptions = {
    ...defaultRunOptions,
    ...options,
  }

  return (window as any).axe.run(context || document, mergedOptions)
}

/**
 * Run critical accessibility rules only
 */
export function runCriticalAccessibilityAudit(context?: Element | Document): Promise<AxeResults> {
  return (window as any).axe.run(context || document, criticalAxeConfig)
}

/**
 * Run accessibility audit with detailed reporting
 */
export function runDetailedAccessibilityAudit(context?: Element | Document): Promise<AxeResults> {
  const detailedConfig = {
    ...defaultRunOptions,
    resultTypes: ["violations", "incomplete", "inapplicable", "passes"] as const,
  }

  return (window as any).axe.run(context || document, detailedConfig)
}

/**
 * Impact severity levels
 */
type ImpactValue = "minor" | "moderate" | "serious" | "critical" | null

/**
 * Format accessibility results for reporting
 */
export function formatAccessibilityResults(results: AxeResults): {
  summary: {
    total: number
    critical: number
    serious: number
    moderate: number
    minor: number
  }
  violations: Array<{
    rule: string
    description: string
    impact: ImpactValue
    help: string
    helpUrl: string
    nodes: Array<{
      html: string
      target: any[]
      failureSummary: string | undefined
    }>
  }>
} {
  const summary = {
    total: results.violations.length,
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  }

  const violations = results.violations.map((violation) => {
    const impact = violation.impact || "moderate"
    if (impact === "critical") {
      summary.critical++
    } else if (impact === "serious") {
      summary.serious++
    } else if (impact === "moderate") {
      summary.moderate++
    } else {
      summary.minor++
    }

    return {
      rule: violation.id,
      description: violation.description,
      impact,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map(node => ({
        html: node.html,
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    }
  })

  return { summary, violations }
}

/**
 * Check if accessibility results meet WCAG 2.1 AA compliance
 */
export function checkWCAGCompliance(results: AxeResults): {
  compliant: boolean
  issues: string[]
  criticalIssues: string[]
} {
  const issues: string[] = []
  const criticalIssues: string[] = []

  // Check for violations
  results.violations.forEach((violation) => {
    const issueDescription = `${violation.id}: ${violation.description}`
    issues.push(issueDescription)

    if (violation.impact === "critical") {
      criticalIssues.push(issueDescription)
    }
  })

  // Check for incomplete results (might hide violations)
  if (results.incomplete.length > 0) {
    issues.push(`${results.incomplete.length} incomplete rule checks need manual review`)
  }

  return {
    compliant: criticalIssues.length === 0 && issues.length === 0,
    issues,
    criticalIssues,
  }
}

// Export types for TypeScript
export type { AxeResults, NodeResult, Result, Rule, RunOptions, Spec } from "axe-core"

// Export ImpactValue type for use in other modules
export type { ImpactValue }
