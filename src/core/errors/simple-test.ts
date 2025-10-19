import { ConversionError } from "./conversion-error.js"
import { ErrorHandler } from "./error-handler.js"

const errorHandler = new ErrorHandler()

console.log("Testing ErrorHandler.normalizeError...")

try {
  const error = new Error("Test error")
  const result = errorHandler.normalizeError(error)
  console.log("Result type:", typeof result)
  console.log("Result instance:", result.constructor.name)
  console.log("Is ConversionError?", result instanceof ConversionError)
} catch (error) {
  console.error("Error:", error)
}
