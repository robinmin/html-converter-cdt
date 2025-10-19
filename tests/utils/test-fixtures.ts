/**
 * Test Fixtures Utility
 *
 * Provides utilities for loading test fixtures and creating mock HTML documents.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import type { HTMLDocument } from "../../architecture/strategies/types.js"

const FIXTURES_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "../fixtures")

/**
 * Load a test fixture file and convert it to HTMLDocument
 */
export function loadFixture(filename: string): HTMLDocument {
  const content = readFileSync(join(FIXTURES_DIR, filename), "utf-8")
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, "text/html")

  return {
    title: doc.title,
    URL: `file://${filename}`,
    documentElement: {
      outerHTML: content,
    },
    location: {
      href: `file://${filename}`,
    },
  } as HTMLDocument
}

/**
 * Check if a fixture file exists
 */
export function hasFixture(filename: string): boolean {
  try {
    readFileSync(join(FIXTURES_DIR, filename), "utf-8")
    return true
  } catch {
    return false
  }
}
