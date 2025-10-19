#!/usr/bin/env node

/**
 * Visual baseline management utilities
 *
 * This script provides utilities for managing visual regression baselines,
 * including updating baselines, cleaning old baselines, and analyzing changes.
 */

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import process from "node:process"

export interface BaselineInfo {
  testName: string
  format: string
  variant: string
  filePath: string
  metadata: BaselineMetadata
  size: number
  hash: string
  lastModified: Date
}

export interface BaselineMetadata {
  created: string
  size: number
  hash: string
  testName: string
  format: string
  [key: string]: any
}

/**
 * Visual baseline manager class
 */
export class BaselineManager {
  private readonly baselinesDir: string

  constructor() {
    this.baselinesDir = join(process.cwd(), "tests", "visual", "baselines")
  }

  /**
   * Update all baselines from current test outputs
   */
  async updateAllBaselines(): Promise<void> {
    console.log("🔄 Updating all visual baselines...")

    const currentDir = join(process.cwd(), "tests", "visual", "current")
    if (!existsSync(currentDir)) {
      console.log("❌ No current outputs found. Run visual tests first.")
      return
    }

    const currentFiles = this.scanDirectory(currentDir)
    let updatedCount = 0

    for (const filePath of currentFiles) {
      if (this.isImageFile(filePath) || this.isPDFFile(filePath)) {
        const relativePath = filePath.replace(currentDir + "/", "")
        const baselinePath = join(this.baselinesDir, relativePath)

        // Update baseline
        this.updateBaseline(filePath, baselinePath)
        updatedCount++
        console.log(`✅ Updated baseline: ${relativePath}`)
      }
    }

    console.log(`🎉 Updated ${updatedCount} baselines`)
  }

  /**
   * Clean up old baselines
   */
  async cleanupOldBaselines(daysOld: number = 30): Promise<void> {
    console.log(`🧹 Cleaning up baselines older than ${daysOld} days...`)

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const removedCount = await this.removeOldBaselines(this.baselinesDir, cutoffDate)

    console.log(`🗑️  Removed ${removedCount} old baselines`)
  }

  /**
   * Analyze baseline changes
   */
  async analyzeBaselines(): Promise<void> {
    console.log("📊 Analyzing visual baselines...")

    const baselines = this.getAllBaselines()

    if (baselines.length === 0) {
      console.log("❌ No baselines found")
      return
    }

    // Group by format
    const byFormat = baselines.reduce((acc, baseline) => {
      if (!acc[baseline.format]) {
        acc[baseline.format] = []
      }
      acc[baseline.format].push(baseline)
      return acc
    }, {} as Record<string, BaselineInfo[]>)

    // Group by test name
    const byTest = baselines.reduce((acc, baseline) => {
      if (!acc[baseline.testName]) {
        acc[baseline.testName] = []
      }
      acc[baseline.testName].push(baseline)
      return acc
    }, {} as Record<string, BaselineInfo[]>)

    console.log("\n📈 Baseline Summary:")
    console.log(`  Total baselines: ${baselines.length}`)
    console.log(`  Formats: ${Object.keys(byFormat).join(", ")}`)
    console.log(`  Test suites: ${Object.keys(byTest).length}`)

    console.log("\n📋 By Format:")
    for (const [format, files] of Object.entries(byFormat)) {
      const totalSize = files.reduce((sum, f) => sum + f.size, 0)
      console.log(`  ${format}: ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB`)
    }

    console.log("\n📋 By Test Suite:")
    for (const [testName, files] of Object.entries(byTest)) {
      const totalSize = files.reduce((sum, f) => sum + f.size, 0)
      console.log(`  ${testName}: ${files.length} baselines, ${(totalSize / 1024 / 1024).toFixed(2)}MB`)
    }

    // Check for large baselines
    const largeBaselines = baselines.filter(b => b.size > 5 * 1024 * 1024) // > 5MB
    if (largeBaselines.length > 0) {
      console.log("\n⚠️  Large baselines (>5MB):")
      largeBaselines.forEach((baseline) => {
        console.log(`  ${baseline.testName}/${baseline.variant}: ${(baseline.size / 1024 / 1024).toFixed(2)}MB`)
      })
    }

    // Check for old baselines
    const oldBaselines = baselines.filter((b) => {
      const daysOld = (Date.now() - b.lastModified.getTime()) / (1000 * 60 * 60 * 24)
      return daysOld > 90
    })

    if (oldBaselines.length > 0) {
      console.log("\n⚠️  Old baselines (>90 days):")
      oldBaselines.forEach((baseline) => {
        const daysOld = Math.floor((Date.now() - baseline.lastModified.getTime()) / (1000 * 60 * 60 * 24))
        console.log(`  ${baseline.testName}/${baseline.variant}: ${daysOld} days old`)
      })
    }
  }

  /**
   * Validate baseline integrity
   */
  async validateBaselines(): Promise<void> {
    console.log("🔍 Validating baseline integrity...")

    const baselines = this.getAllBaselines()
    let validCount = 0
    let invalidCount = 0

    for (const baseline of baselines) {
      const isValid = this.validateBaselineIntegrity(baseline)
      if (isValid) {
        validCount++
      } else {
        invalidCount++
        console.log(`❌ Invalid baseline: ${baseline.testName}/${baseline.variant}`)
      }
    }

    console.log(`✅ Valid baselines: ${validCount}`)
    console.log(`❌ Invalid baselines: ${invalidCount}`)

    if (invalidCount > 0) {
      console.log("\n💡 Run tests to regenerate invalid baselines")
    }
  }

  /**
   * List all baselines
   */
  async listBaselines(filter?: { format?: string, testName?: string }): Promise<void> {
    console.log("📋 Listing visual baselines...")

    let baselines = this.getAllBaselines()

    if (filter) {
      if (filter.format) {
        baselines = baselines.filter(b => b.format === filter.format)
      }
      if (filter.testName) {
        baselines = baselines.filter(b => b.testName.includes(filter.testName!))
      }
    }

    if (baselines.length === 0) {
      console.log("❌ No baselines found")
      return
    }

    baselines.sort((a, b) => a.testName.localeCompare(b.testName))

    console.log(`\nFound ${baselines.length} baselines:\n`)

    for (const baseline of baselines) {
      const daysOld = Math.floor((Date.now() - baseline.lastModified.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`  ${baseline.testName}/${baseline.variant}.${baseline.format}`)
      console.log(`    Size: ${(baseline.size / 1024).toFixed(2)}KB`)
      console.log(`    Age: ${daysOld} days`)
      console.log(`    Path: ${baseline.filePath}`)
      console.log("")
    }
  }

  /**
   * Get all baselines with metadata
   */
  private getAllBaselines(): BaselineInfo[] {
    if (!existsSync(this.baselinesDir)) {
      return []
    }

    const baselines: BaselineInfo[] = []

    this.scanDirectoryRecursive(this.baselinesDir, (filePath) => {
      if (this.isImageFile(filePath) || this.isPDFFile(filePath)) {
        const baseline = this.parseBaselineInfo(filePath)
        if (baseline) {
          baselines.push(baseline)
        }
      }
    })

    return baselines
  }

  /**
   * Parse baseline information from file path and metadata
   */
  private parseBaselineInfo(filePath: string): BaselineInfo | null {
    try {
      const relativePath = filePath.replace(this.baselinesDir + "/", "")
      const pathParts = relativePath.split("/")
      const fileName = pathParts[pathParts.length - 1]
      const [name, ...variantParts] = pathParts.slice(0, -1)
      const format = fileName.split(".").pop()!

      const stats = statSync(filePath)
      const buffer = readFileSync(filePath)
      const hash = createHash("sha256").update(buffer).digest("hex")

      // Load metadata if available
      let metadata: BaselineMetadata = {
        created: stats.mtime.toISOString(),
        size: buffer.length,
        hash,
        testName: name,
        format,
      }

      const metadataPath = filePath.replace(/\.[^.]+$/, ".meta.json")
      if (existsSync(metadataPath)) {
        try {
          const metadataContent = readFileSync(metadataPath, "utf-8")
          metadata = { ...metadata, ...JSON.parse(metadataContent) }
        } catch {
          // Use default metadata if parsing fails
        }
      }

      return {
        testName: name,
        format,
        variant: variantParts.join("/") || "default",
        filePath,
        metadata,
        size: buffer.length,
        hash,
        lastModified: stats.mtime,
      }
    } catch {
      return null
    }
  }

  /**
   * Validate baseline integrity
   */
  private validateBaselineIntegrity(baseline: BaselineInfo): boolean {
    try {
      if (!existsSync(baseline.filePath)) {
        return false
      }

      const buffer = readFileSync(baseline.filePath)
      const currentHash = createHash("sha256").update(buffer).digest("hex")

      // Check if file size matches metadata
      if (baseline.size !== buffer.length) {
        return false
      }

      // Check if hash matches metadata
      if (baseline.hash !== currentHash) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * Update a single baseline
   */
  private updateBaseline(currentPath: string, baselinePath: string): void {
    const buffer = readFileSync(currentPath)
    this.ensureDir(baselinePath)

    // Create backup of existing baseline
    if (existsSync(baselinePath)) {
      const backupPath = baselinePath.replace(/\.[^.]+$/, `.backup.${Date.now()}$1`)
      writeFileSync(backupPath, readFileSync(baselinePath))
    }

    // Write new baseline
    writeFileSync(baselinePath, buffer)

    // Generate metadata
    const hash = createHash("sha256").update(buffer).digest("hex")
    const metadata = {
      created: new Date().toISOString(),
      size: buffer.length,
      hash,
      updated: true,
    }

    const metadataPath = baselinePath.replace(/\.[^.]+$/, ".meta.json")
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  }

  /**
   * Remove old baselines recursively
   */
  private async removeOldBaselines(dir: string, cutoffDate: Date): Promise<number> {
    let removedCount = 0

    if (!existsSync(dir)) {
      return 0
    }

    const items = readdirSync(dir)

    for (const item of items) {
      const itemPath = join(dir, item)
      const stats = statSync(itemPath)

      if (stats.isDirectory()) {
        removedCount += await this.removeOldBaselines(itemPath, cutoffDate)
      } else if (stats.isFile() && stats.mtime < cutoffDate) {
        // Remove old backup files
        if (item.includes(".backup.")) {
          unlinkSync(itemPath)
          removedCount++
        }
      }
    }

    return removedCount
  }

  /**
   * Scan directory recursively
   */
  private scanDirectoryRecursive(dir: string, callback: (filePath: string) => void): void {
    if (!existsSync(dir)) {
      return
    }

    const items = readdirSync(dir)

    for (const item of items) {
      const itemPath = join(dir, item)
      const stats = statSync(itemPath)

      if (stats.isDirectory()) {
        this.scanDirectoryRecursive(itemPath, callback)
      } else if (stats.isFile()) {
        callback(itemPath)
      }
    }
  }

  /**
   * Scan directory and return file paths
   */
  private scanDirectory(dir: string): string[] {
    if (!existsSync(dir)) {
      return []
    }

    const files: string[] = []
    this.scanDirectoryRecursive(dir, (filePath) => {
      files.push(filePath)
    })

    return files
  }

  /**
   * Check if file is an image
   */
  private isImageFile(filePath: string): boolean {
    const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]
    const ext = filePath.toLowerCase().split(".").pop()
    return imageExtensions.includes(`.${ext}`)
  }

  /**
   * Check if file is a PDF
   */
  private isPDFFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith(".pdf")
  }

  /**
   * Ensure directory exists
   */
  private ensureDir(filePath: string): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}

// CLI functionality
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  const manager = new BaselineManager()

  switch (command) {
    case "update":
      await manager.updateAllBaselines()
      break

    case "cleanup": {
      const days = Number.parseInt(args[1]) || 30
      await manager.cleanupOldBaselines(days)
      break
    }

    case "analyze":
      await manager.analyzeBaselines()
      break

    case "validate":
      await manager.validateBaselines()
      break

    case "list": {
      const filter: any = {}
      if (args.includes("--format")) {
        const formatIndex = args.indexOf("--format") + 1
        filter.format = args[formatIndex]
      }
      if (args.includes("--test")) {
        const testIndex = args.indexOf("--test") + 1
        filter.testName = args[testIndex]
      }
      await manager.listBaselines(filter)
      break
    }

    default:
      console.log(`
Visual Baseline Manager

Usage:
  node baseline-manager.js <command> [options]

Commands:
  update                 Update all baselines from current test outputs
  cleanup [days]         Remove baselines older than specified days (default: 30)
  analyze                Analyze and report on baseline statistics
  validate               Validate baseline integrity
  list [options]         List baselines with optional filtering

List Options:
  --format <format>      Filter by file format (png, pdf, etc.)
  --test <name>          Filter by test name (contains match)

Examples:
  node baseline-manager.js update
  node baseline-manager.js cleanup 60
  node baseline-manager.js analyze
  node baseline-manager.js list --format pdf
  node baseline-manager.js list --test basic
      `)
      process.exit(1)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error.message)
    process.exit(1)
  })
}

export { BaselineManager }
