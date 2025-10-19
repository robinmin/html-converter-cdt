/**
 * HTML Converter CDT - Chrome DevTools Protocol-based HTML conversion library
 *
 * This library provides comprehensive HTML conversion capabilities using Chrome DevTools Protocol.
 * Supports conversion to MHTML, PDF, DOCX, and other formats with structured error handling.
 *
 * @example
 * ```typescript
 * // Simple conversion with automatic format detection
 * import { convert } from 'html-converter-cdt';
 *
 * const result = await convert('https://example.com', 'pdf');
 * console.log('PDF generated:', result.suggestedFileName);
 *
 * // Format-specific functions
 * import { convertToPDF, convertToMHTML } from 'html-converter-cdt';
 *
 * const pdfResult = await convertToPDF('https://example.com', {
 *   format: 'A4',
 *   printBackground: true
 * });
 *
 * // Advanced usage with full control
 * import { HTMLConverter, ConversionError } from 'html-converter-cdt';
 *
 * try {
 *   const converter = new HTMLConverter();
 *   const result = await converter.convert('https://example.com', 'mhtml');
 *   console.log('Conversion successful:', result);
 *
 *   // Listen to conversion events
 *   converter.on('conversion-progress', (event) => {
 *     console.log(`Progress: ${event.data.percentage}%`);
 *   });
 *
 *   converter.dispose();
 * } catch (error) {
 *   if (error instanceof ConversionError) {
 *     console.error(`Conversion failed: ${error.code} - ${error.message}`);
 *     console.error('Recovery suggestions:', error.recoverySuggestions);
 *   }
 * }
 * ```
 */

// Public API exports - primary interface for most users
export * from "./api"

// Export square for compatibility
export * from "./square"
