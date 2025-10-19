/**
 * Stream Handlers for Stdin/Stdout Processing
 *
 * Implements stdin and stdout handlers for reading HTML from pipes
 * and outputting binary data to stdout, supporting continuous stream
 * processing and buffer management.
 */

import { Buffer } from "node:buffer"
import process from "node:process"
import { createInterface } from "node:readline"

import { showError } from "./output.js"

/**
 * Read HTML content from stdin
 */
export async function readFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error("No input provided from stdin. Use pipe or redirect input."))
      return
    }

    const chunks: Buffer[] = []
    let totalSize = 0
    const maxSize = 50 * 1024 * 1024 // 50MB limit

    process.stdin.on("readable", () => {
      let chunk: Buffer | null
      while (true) {
        chunk = process.stdin.read()
        if (chunk === null) {
          break
        }
        chunks.push(chunk)
        totalSize += chunk.length

        if (totalSize > maxSize) {
          reject(new Error(`Input too large (${formatFileSize(totalSize)}). Maximum size is ${formatFileSize(maxSize)}.`))
          return
        }
      }
    })

    process.stdin.on("end", () => {
      try {
        const content = Buffer.concat(chunks).toString("utf8")
        resolve(content)
      } catch (error) {
        reject(new Error(`Failed to process stdin content: ${error instanceof Error ? error.message : "Unknown error"}`))
      }
    })

    process.stdin.on("error", (error) => {
      reject(new Error(`Stdin error: ${error.message}`))
    })
  })
}

/**
 * Read HTML content from stdin with progress indication
 */
export async function readFromStdinWithProgress(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error("No input provided from stdin. Use pipe or redirect input."))
      return
    }

    const chunks: Buffer[] = []
    let totalSize = 0
    const maxSize = 50 * 1024 * 1024 // 50MB limit
    let lastProgressUpdate = 0

    process.stdin.on("readable", () => {
      let chunk: Buffer | null
      while (true) {
        chunk = process.stdin.read()
        if (chunk === null) {
          break
        }
        chunks.push(chunk)
        totalSize += chunk.length

        // Update progress every 1MB or every 5 seconds
        const now = Date.now()
        if (totalSize > 0 && (totalSize % (1024 * 1024) === 0 || now - lastProgressUpdate > 5000)) {
          process.stderr.write(`\rReading from stdin: ${formatFileSize(totalSize)}`)
          lastProgressUpdate = now
        }

        if (totalSize > maxSize) {
          process.stderr.write("\n")
          reject(new Error(`Input too large (${formatFileSize(totalSize)}). Maximum size is ${formatFileSize(maxSize)}.`))
          return
        }
      }
    })

    process.stdin.on("end", () => {
      process.stderr.write(`\rReading from stdin: ${formatFileSize(totalSize)} - Complete!\n`)

      try {
        const content = Buffer.concat(chunks).toString("utf8")
        resolve(content)
      } catch (error) {
        reject(new Error(`Failed to process stdin content: ${error instanceof Error ? error.message : "Unknown error"}`))
      }
    })

    process.stdin.on("error", (error) => {
      reject(new Error(`Stdin error: ${error.message}`))
    })
  })
}

/**
 * Write binary data to stdout
 */
export async function writeToStdout(buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.stdout.isTTY) {
      showError("Cannot output binary data to terminal. Redirect output to a file or pipe to another command.")
      reject(new Error("Binary output to TTY not supported"))
      return
    }

    const uint8Array = new Uint8Array(buffer)

    process.stdout.write(uint8Array, (error) => {
      if (error) {
        reject(new Error(`Failed to write to stdout: ${error.message}`))
      } else {
        resolve()
      }
    })
  })
}

/**
 * Write binary data to stdout with progress indication
 */
export async function writeToStdoutWithProgress(buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.stdout.isTTY) {
      showError("Cannot output binary data to terminal. Redirect output to a file or pipe to another command.")
      reject(new Error("Binary output to TTY not supported"))
      return
    }

    const uint8Array = new Uint8Array(buffer)
    const totalSize = uint8Array.length
    let writtenSize = 0
    const chunkSize = 64 * 1024 // 64KB chunks
    let lastProgressUpdate = 0

    const writeChunk = () => {
      const remainingSize = totalSize - writtenSize
      const currentChunkSize = Math.min(chunkSize, remainingSize)

      if (currentChunkSize === 0) {
        process.stderr.write(`\rWriting to stdout: ${formatFileSize(totalSize)} - Complete!\n`)
        resolve()
        return
      }

      const chunk = uint8Array.subarray(writtenSize, writtenSize + currentChunkSize)

      process.stdout.write(chunk, (error) => {
        if (error) {
          reject(new Error(`Failed to write to stdout: ${error.message}`))
          return
        }

        writtenSize += currentChunkSize

        // Update progress every 1MB or every 5 seconds
        const now = Date.now()
        if (writtenSize > 0 && (writtenSize % (1024 * 1024) === 0 || now - lastProgressUpdate > 5000)) {
          const percentage = Math.round((writtenSize / totalSize) * 100)
          process.stderr.write(`\rWriting to stdout: ${formatFileSize(writtenSize)} (${percentage}%)`)
          lastProgressUpdate = now
        }

        // Continue writing
        setImmediate(writeChunk)
      })
    }

    writeChunk()
  })
}

/**
 * Read lines from stdin with timeout
 */
export async function readLinesFromStdin(timeoutMs: number = 30000): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error("No input provided from stdin. Use pipe or redirect input."))
      return
    }

    const lines: string[] = []
    const rl = createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    })

    const timeout = setTimeout(() => {
      rl.close()
      reject(new Error(`Stdin read timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    rl.on("line", (line) => {
      lines.push(line)
    })

    rl.on("close", () => {
      clearTimeout(timeout)
      resolve(lines)
    })

    rl.on("error", (error) => {
      clearTimeout(timeout)
      reject(new Error(`Stdin error: ${error.message}`))
    })
  })
}

/**
 * Check if data is being piped to stdin
 */
export function hasStdinData(): boolean {
  return !process.stdin.isTTY
}

/**
 * Check if stdout is connected to a terminal
 */
export function isStdoutTTY(): boolean {
  return process.stdout.isTTY
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Create a readable stream from stdin
 */
export function createStdinStream(): NodeJS.ReadableStream {
  if (process.stdin.isTTY) {
    throw new Error("No input stream available from stdin.")
  }

  return process.stdin
}

/**
 * Create a writable stream to stdout
 */
export function createStdoutStream(): NodeJS.WritableStream {
  if (process.stdout.isTTY) {
    throw new Error("Cannot create binary output stream to terminal.")
  }

  return process.stdout
}

/**
 * Pipe stdin to stdout with optional transformation
 */
export async function pipeStdinToStdout(transform?: (chunk: Buffer) => Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error("No input available from stdin."))
      return
    }

    if (process.stdout.isTTY) {
      reject(new Error("Cannot output binary data to terminal."))
      return
    }

    process.stdin.on("error", (error) => {
      reject(new Error(`Stdin error: ${error.message}`))
    })

    process.stdout.on("error", (error) => {
      reject(new Error(`Stdout error: ${error.message}`))
    })

    process.stdin.on("end", () => {
      resolve()
    })

    if (transform) {
      process.stdin.on("data", (chunk) => {
        try {
          const transformed = transform(chunk)
          process.stdout.write(transformed)
        } catch (error) {
          reject(error)
        }
      })
    } else {
      process.stdin.pipe(process.stdout)
    }
  })
}
