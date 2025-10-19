/**
 * Format-Specific API Functions
 *
 * This module provides dedicated functions for each conversion format,
 * offering a simple and intuitive API for common use cases.
 */

import type { Buffer } from "node:buffer"

import type { ConversionError } from "../core/errors/conversion-error.js"
import type {
  ConversionInput,
  DOCXOptions,
  EnhancedConversionResult,
  ImageOptions,
  MarkdownOptions,
  MHTMLOptions,
  PDFOptions,
} from "../types/public-api.js"

import { createHTMLConverter } from "./html-converter-factory.js"

/**
 * Convert HTML to MHTML format
 *
 * @param input - Input source (URL, file path, or content)
 * @param options - MHTML-specific conversion options
 * @returns Promise resolving to MHTML conversion result
 *
 * @example
 * ```typescript
 * import { convertToMHTML } from 'html-converter-cdt'
 *
 * const result = await convertToMHTML('https://example.com', {
 *   inlineResources: true,
 *   maxInlineResourceSize: 1024 * 1024 // 1MB
 * })
 * console.log(result.content) // MHTML content
 * console.log(result.suggestedFileName) // e.g., "example.mhtml"
 * ```
 */
export async function convertToMHTML(
  input: ConversionInput,
  options: MHTMLOptions = {},
): Promise<EnhancedConversionResult> {
  const converter = createHTMLConverter()
  try {
    return await converter.convert(input, "mhtml", options)
  } finally {
    converter.dispose()
  }
}

/**
 * Convert HTML to PDF format
 *
 * @param input - Input source (URL, file path, or content)
 * @param options - PDF-specific conversion options
 * @returns Promise resolving to PDF conversion result
 *
 * @example
 * ```typescript
 * import { convertToPDF } from 'html-converter-cdt'
 *
 * const result = await convertToPDF('https://example.com', {
 *   format: 'A4',
 *   orientation: 'portrait',
 *   printBackground: true,
 *   margin: 1 // 1 inch margins
 * })
 * console.log(result.content) // PDF binary content
 * ```
 */
export async function convertToPDF(
  input: ConversionInput,
  options: PDFOptions = {},
): Promise<EnhancedConversionResult> {
  const converter = createHTMLConverter()
  try {
    return await converter.convert(input, "pdf", options)
  } finally {
    converter.dispose()
  }
}

/**
 * Convert HTML to PNG format
 *
 * @param input - Input source (URL, file path, or content)
 * @param options - Image-specific conversion options
 * @returns Promise resolving to PNG conversion result
 *
 * @example
 * ```typescript
 * import { convertToPNG } from 'html-converter-cdt'
 *
 * const result = await convertToPNG('https://example.com', {
 *   fullPage: true,
 *   omitBackground: false,
 *   dimensions: { width: 1200, height: 800 }
 * })
 * console.log(result.content) // PNG binary content
 * ```
 */
export async function convertToPNG(
  input: ConversionInput,
  options: ImageOptions = {},
): Promise<EnhancedConversionResult> {
  const converter = createHTMLConverter()
  try {
    return await converter.convert(input, "png", options)
  } finally {
    converter.dispose()
  }
}

/**
 * Convert HTML to JPEG format
 *
 * @param input - Input source (URL, file path, or content)
 * @param options - Image-specific conversion options
 * @returns Promise resolving to JPEG conversion result
 *
 * @example
 * ```typescript
 * import { convertToJPEG } from 'html-converter-cdt'
 *
 * const result = await convertToJPEG('https://example.com', {
 *   quality: 90,
 *   fullPage: true
 * })
 * console.log(result.content) // JPEG binary content
 * ```
 */
export async function convertToJPEG(
  input: ConversionInput,
  options: ImageOptions = {},
): Promise<EnhancedConversionResult> {
  const converter = createHTMLConverter()
  try {
    return await converter.convert(input, "jpeg", options)
  } finally {
    converter.dispose()
  }
}

/**
 * Convert HTML to Markdown format
 *
 * @param input - Input source (URL, file path, or content)
 * @param options - Markdown-specific conversion options
 * @returns Promise resolving to Markdown conversion result
 *
 * @example
 * ```typescript
 * import { convertToMarkdown } from 'html-converter-cdt'
 *
 * const result = await convertToMarkdown('https://example.com', {
 *   preserveComments: false,
 *   maxLineLength: 80,
 *   includeFrontmatter: true
 * })
 * console.log(result.content) // Markdown text content
 * ```
 */
export async function convertToMarkdown(
  input: ConversionInput,
  options: MarkdownOptions = {},
): Promise<EnhancedConversionResult> {
  const converter = createHTMLConverter()
  try {
    return await converter.convert(input, "markdown", options)
  } finally {
    converter.dispose()
  }
}

/**
 * Convert HTML to DOCX format
 *
 * @param input - Input source (URL, file path, or content)
 * @param options - DOCX-specific conversion options
 * @returns Promise resolving to DOCX conversion result
 *
 * @example
 * ```typescript
 * import { convertToDOCX } from 'html-converter-cdt'
 *
 * const result = await convertToDOCX('https://example.com', {
 *   pageSize: 'A4',
 *   orientation: 'portrait',
 *   fontFamily: 'Calibri',
 *   fontSize: 11,
 *   includeImages: true
 * })
 * console.log(result.content) // DOCX binary content
 * ```
 */
export async function convertToDOCX(
  input: ConversionInput,
  options: DOCXOptions = {},
): Promise<EnhancedConversionResult> {
  const converter = createHTMLConverter()
  try {
    return await converter.convert(input, "docx", options)
  } finally {
    converter.dispose()
  }
}

/**
 * Type guard to check if result is a conversion error
 *
 * @param error - Error to check
 * @returns True if result is a ConversionError
 *
 * @example
 * ```typescript
 * import { convertToPDF, isConversionError } from 'html-converter-cdt'
 *
 * try {
 *   const result = await convertToPDF('https://example.com')
 *   // Process result...
 * } catch (error) {
 *   if (isConversionError(error)) {
 *     console.error(`Conversion failed: ${error.code}`)
 *     console.error(`Suggestions: ${error.recoverySuggestions.join(', ')}`)
 *   }
 * }
 * ```
 */
export function isConversionError(error: any): error is ConversionError {
  return error && typeof error === "object" && "code" in error && "category" in error
}

/**
 * Create a conversion result that can be saved to a file
 *
 * @param result - Conversion result
 * @param fileName - Optional custom filename (without extension)
 * @returns Object with filename and content ready for file saving
 *
 * @example
 * ```typescript
 * import { convertToPDF, prepareForFileSave } from 'html-converter-cdt'
 * import { writeFile } from 'fs/promises'
 *
 * const result = await convertToPDF('https://example.com')
 * const fileData = prepareForFileSave(result, 'my-document')
 *
 * await writeFile(fileData.fileName, fileData.content)
 * console.log(`Saved to ${fileData.fileName}`)
 * ```
 */
export function prepareForFileSave(
  result: EnhancedConversionResult,
  fileName?: string,
): {
  fileName: string
  content: string | Buffer
  mimeType: string
} {
  const finalFileName = fileName || result.suggestedFileName

  // Ensure the filename has the correct extension based on format
  const extension = getFileExtension(result.format)
  const baseName = finalFileName.replace(/\.[^.]+$/, "") // Remove existing extension
  const fullFileName = extension ? `${baseName}.${extension}` : baseName

  return {
    fileName: fullFileName,
    content: result.content,
    mimeType: result.mimeType,
  }
}

/**
 * Get file extension for conversion format
 *
 * @param format - Conversion format
 * @returns File extension (without dot)
 */
function getFileExtension(format: string): string {
  const extensions: Record<string, string> = {
    mhtml: "mhtml",
    pdf: "pdf",
    png: "png",
    jpeg: "jpg",
    markdown: "md",
    docx: "docx",
  }
  return extensions[format] || "txt"
}

/**
 * Batch convert to the same format
 *
 * @param inputs - Array of input sources
 * @param format - Target format
 * @param options - Conversion options (applied to all conversions)
 * @param progressCallback - Optional progress callback
 * @returns Promise resolving to array of conversion results
 *
 * @example
 * ```typescript
 * import { batchConvertToPDF } from 'html-converter-cdt'
 *
 * const urls = [
 *   'https://example1.com',
 *   'https://example2.com',
 *   'https://example3.com'
 * ]
 *
 * const results = await batchConvertToPDF(urls, 'pdf', {
 *   format: 'A4',
 *   printBackground: true
 * }, (progress) => {
 *   console.log(`Progress: ${progress.percentage}%`)
 * })
 *
 * console.log(`Converted ${results.length} documents`)
 * ```
 */
export async function batchConvertToFormat<T extends "mhtml" | "pdf" | "png" | "jpeg" | "markdown" | "docx">(
  inputs: ConversionInput[],
  format: T,
  options: any = {},
  progressCallback?: (progress: { current: number, total: number, percentage: number }) => void,
): Promise<EnhancedConversionResult[]> {
  const converter = createHTMLConverter()

  try {
    const results: EnhancedConversionResult[] = []

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      if (!input) {
        continue
      }

      try {
        const result = await converter.convert(input, format, options)
        results.push(result)
      } catch (error) {
        // Convert errors to a consistent format and add to results
        const errorResult: EnhancedConversionResult = {
          content: "",
          mimeType: "",
          metadata: {
            sourceType: "unknown",
            targetFormat: format,
            timestamp: new Date(),
            size: 0,
          },
          format,
          suggestedFileName: `conversion-error-${i + 1}`,
          usedFallback: false,
          conversionTier: "chrome-cdp",
          performance: {
            conversionTime: 0,
            memoryUsage: 0,
            resourcesProcessed: 0,
          },
          validationWarnings: [`Conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`],
        }
        results.push(errorResult)
      }

      // Report progress
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: inputs.length,
          percentage: Math.round(((i + 1) / inputs.length) * 100),
        })
      }
    }

    return results
  } finally {
    converter.dispose()
  }
}
