import type { ConversionResult, ConverterStrategy, Logger, ValidationResult } from "../architecture/strategies/types"

/**
 * Server-side conversion service configuration
 */
export interface ServerSideTierConfig {
  /** Maximum file size for conversion (bytes) */
  maxFileSize?: number
  /** Conversion timeout in milliseconds */
  timeout?: number
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Base delay for exponential backoff (ms) */
  retryBaseDelay?: number
  /** Maximum delay for exponential backoff (ms) */
  retryMaxDelay?: number
  /** Service endpoints configuration */
  services?: {
    /** HTML to PDF conversion services */
    pdf?: ConversionService[]
    /** HTML to Image conversion services */
    image?: ConversionService[]
    /** HTML to MHTML conversion services */
    mhtml?: ConversionService[]
  }
  /** Authentication configuration */
  authentication?: {
    /** API keys for different services */
    apiKeys?: Record<string, string>
    /** Bearer tokens for OAuth */
    bearerTokens?: Record<string, string>
    /** Custom headers for authentication */
    customHeaders?: Record<string, Record<string, string>>
  }
  /** Health checking configuration */
  healthCheck?: {
    /** Enable/disable health checking */
    enabled?: boolean
    /** Health check interval (ms) */
    interval?: number
    /** Health check timeout (ms) */
    timeout?: number
    /** Failure threshold before marking service as unhealthy */
    failureThreshold?: number
  }
  /** Fallback behavior configuration */
  fallback?: {
    /** Whether to try multiple services */
    tryMultipleServices?: boolean
    /** Whether to cache service health status */
    cacheHealthStatus?: boolean
    /** Cache TTL for health status (ms) */
    healthCacheTTL?: number
  }
}

/**
 * External conversion service configuration
 */
export interface ConversionService {
  /** Unique service identifier */
  id: string
  /** Service name */
  name: string
  /** Base URL for the service */
  url: string
  /** API endpoint for conversion */
  endpoint: string
  /** HTTP method to use */
  method: "POST" | "PUT" | "GET"
  /** Request headers */
  headers?: Record<string, string>
  /** Request format (json, form-data, raw) */
  requestFormat?: "json" | "form-data" | "raw"
  /** Response format expected */
  responseFormat?: "json" | "base64" | "binary"
  /** Supported formats */
  supportedFormats?: string[]
  /** Priority for service selection (lower = higher priority) */
  priority?: number
  /** Quality score (0-1, higher = better quality) */
  qualityScore?: number
  /** Cost per conversion (if applicable) */
  costPerConversion?: number
  /** Rate limiting configuration */
  rateLimit?: {
    /** Requests per minute */
    requestsPerMinute?: number
    /** Concurrent requests */
    maxConcurrent?: number
  }
}

/**
 * Service health status
 */
export interface ServiceHealth {
  /** Service identifier */
  serviceId: string
  /** Health status */
  status: "healthy" | "degraded" | "unhealthy"
  /** Last health check timestamp */
  lastChecked: Date
  /** Response time in milliseconds */
  responseTime?: number
  /** Error message if unhealthy */
  error?: string
  /** Success rate (0-1) */
  successRate?: number
  /** Number of successful requests */
  successCount?: number
  /** Number of failed requests */
  failureCount?: number
}

/**
 * Conversion request context
 */
export interface ConversionContext {
  /** Target conversion format */
  format: string
  /** Input HTML content */
  htmlContent: string
  /** Conversion options */
  options?: Record<string, any>
  /** Request timestamp */
  timestamp: Date
  /** Request ID for tracking */
  requestId: string
}

/**
 * API response wrapper for consistent format handling
 */
export interface APIResponse<T = any> {
  /** Success status */
  success: boolean
  /** Response data */
  data?: T
  /** Error information */
  error?: {
    code?: string
    message?: string
    details?: any
  }
  /** Response metadata */
  metadata?: {
    serviceId?: string
    responseTime?: number
    requestId?: string
    [key: string]: any
  }
}

/**
 * Server Side Tier - Tier 3 Progressive Enhancement Implementation
 *
 * Provides server-side fallback integration using external conversion services with:
 * - HTTP client using fetch API for service communication
 * - Configurable service endpoints with authentication support
 * - Retry mechanisms with exponential backoff
 * - Service discovery patterns and health checking
 * - Graceful degradation when services are unavailable
 * - API wrapper interfaces for popular conversion services
 * - Consistent response formats across different providers
 * - Rate limiting and cost optimization
 * - Performance monitoring and service selection optimization
 */
export class ServerSideTier implements ConverterStrategy {
  private logger: Logger
  private config: Required<ServerSideTierConfig>
  private serviceHealth: Map<string, ServiceHealth> = new Map()
  private requestCounters: Map<string, number> = new Map()
  private lastRequestTimes: Map<string, number> = new Map()

  constructor(logger: Logger, config: ServerSideTierConfig = {}) {
    this.logger = logger

    // Default configuration
    this.config = {
      maxFileSize: 25 * 1024 * 1024, // 25MB
      timeout: 45000, // 45 seconds
      maxRetries: 3,
      retryBaseDelay: 1000, // 1 second
      retryMaxDelay: 10000, // 10 seconds
      services: {
        pdf: this.getDefaultPDFServices(),
        image: this.getDefaultImageServices(),
        mhtml: this.getDefaultMHTMLServices(),
      },
      authentication: {
        apiKeys: {},
        bearerTokens: {},
        customHeaders: {},
      },
      healthCheck: {
        enabled: true,
        interval: 300000, // 5 minutes
        timeout: 5000, // 5 seconds
        failureThreshold: 3,
      },
      fallback: {
        tryMultipleServices: true,
        cacheHealthStatus: true,
        healthCacheTTL: 600000, // 10 minutes
      },
      ...config,
    }

    // Merge user-provided services with defaults
    if (config.services) {
      this.config.services = {
        pdf: [...(this.config.services.pdf || []), ...(config.services.pdf || [])],
        image: [...(this.config.services.image || []), ...(config.services.image || [])],
        mhtml: [...(this.config.services.mhtml || []), ...(config.services.mhtml || [])],
      }
    }

    // Initialize service health tracking
    this.initializeServiceHealth()

    // Start health checking if enabled
    if (this.config.healthCheck.enabled) {
      this.startHealthChecking()
    }

    this.logger.info("Server Side Tier initialized", {
      maxFileSize: this.config.maxFileSize,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      servicesConfigured: this.getTotalServicesCount(),
      healthCheckEnabled: this.config.healthCheck.enabled,
    })
  }

  /**
   * Convert HTML document using external services
   *
   * @param input - HTML document to convert
   * @returns Promise resolving to conversion result
   */
  async convert(input: HTMLDocument): Promise<ConversionResult> {
    const startTime = Date.now()
    const inputHTML = this.serializeHTMLDocument(input)
    const format = this.detectTargetFormat(inputHTML)
    const requestId = this.generateRequestId()

    this.logger.info("Starting Server Side conversion", {
      format,
      inputSize: inputHTML.length,
      timeout: this.config.timeout,
      requestId,
    })

    try {
      // Validate input size
      if (inputHTML.length > this.config.maxFileSize) {
        throw new Error(`Input exceeds maximum file size: ${inputHTML.length} > ${this.config.maxFileSize}`)
      }

      // Get available services for the target format
      const services = this.getAvailableServices(format)
      if (services.length === 0) {
        throw new Error(`No available services for format: ${format}`)
      }

      // Create conversion context
      const context: ConversionContext = {
        format,
        htmlContent: inputHTML,
        timestamp: new Date(),
        requestId,
      }

      // Map service category to actual output format for metadata
      const outputFormat = this.mapServiceCategoryToFormat(format)

      // Try services in order of priority and health
      let lastError: Error | null = null
      for (const service of services) {
        try {
          this.logger.debug("Attempting conversion with service", {
            serviceId: service.id,
            serviceName: service.name,
            requestId,
          })

          const result = await this.convertWithService(service, context)

          // Update service health on success
          this.updateServiceHealth(service.id, true, Date.now() - startTime)

          const executionTime = Date.now() - startTime
          const contentSize = result.content.length

          const conversionResult: ConversionResult = {
            content: result.content,
            mimeType: result.mimeType,
            metadata: {
              sourceType: "text/html",
              targetFormat: outputFormat,
              timestamp: new Date(),
              size: contentSize,
              executionTime,
              tier: 3,
              conversionMethod: "server-side",
              serviceUsed: service.id,
              serviceName: service.name,
              requestId,
              serviceResponseTime: result.metadata?.responseTime,
              serviceQuality: service.qualityScore,
            },
          }

          this.logger.info("Server Side conversion completed", {
            format: outputFormat,
            size: contentSize,
            executionTime,
            serviceUsed: service.id,
            requestId,
          })

          return conversionResult
        } catch (error) {
          lastError = error as Error
          this.logger.warn("Service conversion failed", {
            serviceId: service.id,
            serviceName: service.name,
            error: (error as Error).message,
            requestId,
          })

          // Update service health on failure
          this.updateServiceHealth(service.id, false, Date.now() - startTime, (error as Error).message)

          // Continue to next service if fallback is enabled
          if (this.config.fallback.tryMultipleServices) {
            continue
          } else {
            throw error
          }
        }
      }

      // All services failed
      throw lastError || new Error("All conversion services failed")
    } catch (error) {
      const executionTime = Date.now() - startTime

      this.logger.error("Server Side conversion failed", error as Error, {
        format,
        executionTime,
        inputSize: inputHTML.length,
        requestId,
      })

      throw new Error(`Server Side conversion failed: ${(error as Error).message}`)
    }
  }

  /**
   * Validate HTML document before server-side conversion
   *
   * @param input - HTML document to validate
   * @returns Validation result with any errors or warnings
   */
  validate(input: HTMLDocument): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      const htmlContent = this.serializeHTMLDocument(input)

      // Check for empty document
      if (!htmlContent || htmlContent.trim().length === 0) {
        errors.push("HTML document is empty")
      }

      // Check file size limits
      if (htmlContent.length > this.config.maxFileSize) {
        errors.push(`HTML document exceeds maximum size: ${htmlContent.length} bytes > ${this.config.maxFileSize} bytes`)
      }

      // Check for valid HTML structure
      if (!htmlContent.includes("<html") || !htmlContent.includes("</html>")) {
        warnings.push("HTML document may be missing proper HTML structure")
      }

      // Check network access availability
      if (typeof fetch === "undefined") {
        errors.push("Fetch API is not available in this environment")
      }

      // Check service availability
      const totalServices = this.getTotalServicesCount()
      if (totalServices === 0) {
        errors.push("No conversion services are configured")
      } else {
        const healthyServices = this.getHealthyServicesCount()
        if (healthyServices === 0) {
          warnings.push("No services are currently healthy - conversion may fail")
        } else if (healthyServices < totalServices * 0.5) {
          warnings.push("More than 50% of services are unhealthy - conversion may be slow")
        }
      }

      // Check for potentially problematic content
      const complexElements = this.countComplexElements(htmlContent)
      if (complexElements.externalResources > 20) {
        warnings.push("High number of external resources - conversion may be slow or expensive")
      }
      if (htmlContent.length > 10 * 1024 * 1024) { // 10MB
        warnings.push("Large document detected - conversion may take longer")
      }

      // Always include context, even when there are errors
      const context = {
        contentType: "text/html",
        size: htmlContent.length,
        complexElements,
        availableServices: totalServices,
        healthyServices: this.getHealthyServicesCount(),
        estimatedConversionTime: this.estimateConversionTime(htmlContent.length, complexElements),
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        context,
      }
    } catch (error) {
      // Even in error cases, try to provide basic context
      return {
        isValid: false,
        errors: [`Validation error: ${(error as Error).message}`],
        warnings,
        context: {
          contentType: "text/html",
          size: 0,
          complexElements: { externalResources: 0 },
          availableServices: this.getTotalServicesCount(),
          healthyServices: this.getHealthyServicesCount(),
          estimatedConversionTime: 0,
        },
      }
    }
  }

  /**
   * Check if this strategy can handle the given content type
   *
   * @param contentType - MIME type to check
   * @returns True if this strategy can handle the content type
   */
  canHandle(contentType: string): boolean {
    return contentType === "text/html" || contentType === "application/xhtml+xml"
  }

  /**
   * Get the name of this converter strategy
   *
   * @returns Strategy name
   */
  getName(): string {
    return "Server Side Tier"
  }

  /**
   * Get supported content types
   *
   * @returns Array of supported MIME types
   */
  getSupportedContentTypes(): string[] {
    return ["text/html", "application/xhtml+xml"]
  }

  /**
   * Get output format MIME type
   *
   * @returns Output MIME type
   */
  getOutputFormat(): string {
    return "application/pdf" // Default output format
  }

  // Private helper methods

  /**
   * Serialize HTML document to string
   */
  private serializeHTMLDocument(document: HTMLDocument): string {
    // In a browser environment, we can use document.documentElement.outerHTML
    if (typeof document !== "undefined" && document.documentElement) {
      return document.documentElement.outerHTML
    }

    // Fallback for environments without full DOM support
    if (document.body) {
      return `<!DOCTYPE html><html><head><title>Document</title></head><body>${document.body.innerHTML}</body></html>`
    }

    throw new Error("Cannot serialize HTML document: unsupported environment")
  }

  /**
   * Detect the target conversion format based on document content
   */
  private detectTargetFormat(htmlContent: string): string {
    // Check for format hints in the HTML
    if (htmlContent.includes("data-export=\"pdf\"") || htmlContent.includes("export-pdf")) {
      return "pdf"
    }
    if (htmlContent.includes("data-export=\"image\"") || htmlContent.includes("export-image")) {
      return "image" // Use service category key
    }
    if (htmlContent.includes("data-export=\"mhtml\"") || htmlContent.includes("export-mhtml")) {
      return "mhtml"
    }

    // Default to PDF for documents with significant content
    return "pdf"
  }

  /**
   * Get available services for a specific format
   */
  private getAvailableServices(format: string): ConversionService[] {
    const services = this.config.services[format as keyof typeof this.config.services] || []

    return services
      .filter(service => this.isServiceHealthy(service.id))
      .sort((a, b) => {
        // Sort by priority first, then by quality score
        if (a.priority !== b.priority) {
          return (a.priority || 999) - (b.priority || 999)
        }
        return (b.qualityScore || 0) - (a.qualityScore || 0)
      })
  }

  /**
   * Map service category to actual output format
   */
  private mapServiceCategoryToFormat(category: string): string {
    switch (category) {
      case "image":
        return "png" // Default image format
      case "pdf":
        return "pdf"
      case "mhtml":
        return "mhtml"
      default:
        return "pdf"
    }
  }

  /**
   * Convert HTML using a specific service
   */
  private async convertWithService(service: ConversionService, context: ConversionContext): Promise<{ content: string, mimeType: string, metadata?: any }> {
    // Check rate limiting
    await this.checkRateLimit(service)

    const startTime = Date.now()

    try {
      // Prepare request payload
      const payload = this.prepareRequestPayload(service, context)

      // Make HTTP request with retry logic
      const response = await this.makeRequestWithRetry(service, payload)

      // Debug log to help with test debugging
      this.logger.debug(`Service ${service.name} response received`, {
        hasResponse: !!response,
        responseOk: response?.ok,
        statusCode: response?.status,
        serviceId: service.id,
        requestId: context.requestId,
      })

      // Process response
      const result = await this.processResponse(service, response, context)

      const responseTime = Date.now() - startTime

      return {
        ...result,
        metadata: {
          ...result.metadata,
          responseTime,
          serviceId: service.id,
        },
      }
    } catch (error) {
      this.logger.error("Service conversion failed", error as Error, {
        serviceId: service.id,
        requestId: context.requestId,
      })
      throw error
    }
  }

  /**
   * Check and enforce rate limiting for a service
   */
  private async checkRateLimit(service: ConversionService): Promise<void> {
    if (!service.rateLimit) {
      return
    }

    const now = Date.now()
    const serviceId = service.id

    // Check concurrent request limit
    if (service.rateLimit.maxConcurrent) {
      const currentCount = this.requestCounters.get(serviceId) || 0
      if (currentCount >= service.rateLimit.maxConcurrent) {
        throw new Error(`Service ${service.name} has reached maximum concurrent requests`)
      }
    }

    // Check requests per minute limit
    if (service.rateLimit.requestsPerMinute) {
      const lastRequestTime = this.lastRequestTimes.get(serviceId) || 0
      const timeSinceLastRequest = now - lastRequestTime
      const minInterval = 60000 / service.rateLimit.requestsPerMinute

      if (timeSinceLastRequest < minInterval) {
        const waitTime = minInterval - timeSinceLastRequest
        this.logger.debug(`Rate limiting service ${service.name}, waiting ${waitTime}ms`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    // Update counters
    this.requestCounters.set(serviceId, (this.requestCounters.get(serviceId) || 0) + 1)
    this.lastRequestTimes.set(serviceId, Date.now())
  }

  /**
   * Prepare request payload for a service
   */
  private prepareRequestPayload(service: ConversionService, context: ConversionContext): any {
    const { htmlContent, format, options } = context

    switch (service.requestFormat) {
      case "json":
        return {
          html: htmlContent,
          format,
          options: options || {},
          timestamp: context.timestamp.toISOString(),
          requestId: context.requestId,
        }

      case "form-data": {
        const formData = new FormData()
        formData.append("html", htmlContent)
        formData.append("format", format)
        formData.append("requestId", context.requestId)
        if (options) {
          formData.append("options", JSON.stringify(options))
        }
        return formData
      }

      case "raw":
      default:
        return htmlContent
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequestWithRetry(service: ConversionService, payload: any): Promise<Response> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.makeSingleRequest(service, payload)

        if (response.ok) {
          return response
        }

        // If response is not ok, check if we should retry
        if (!this.shouldRetry(response.status, attempt)) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
      } catch (error) {
        lastError = error as Error

        // For network errors, always retry
        // Only stop retrying if it's a non-retryable error
        const errorMessage = (error as Error).message
        const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("timeout") || errorMessage.includes("AbortError")
        if (!isNetworkError && !this.shouldRetry(0, attempt)) {
          throw error
        }
      }

      // Wait before retrying
      if (attempt < this.config.maxRetries) {
        const delay = this.calculateRetryDelay(attempt)
        this.logger.debug(`Retrying service ${service.name} after ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // Ensure we always throw an error and never return undefined
    throw lastError || new Error("Max retries exceeded")
  }

  /**
   * Make a single HTTP request
   */
  private async makeSingleRequest(service: ConversionService, payload: any): Promise<Response> {
    const url = `${service.url.replace(/\/$/, "")}/${service.endpoint.replace(/^\//, "")}`

    // Prepare headers
    const headers = {
      "Content-Type": this.getContentType(service.requestFormat),
      "User-Agent": "html-converter-cdt/3.0.0",
      ...service.headers,
      ...this.getAuthenticationHeaders(service),
    }

    // Prepare request options
    const options: RequestInit = {
      method: service.method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    }

    // Add body for non-GET requests
    if (service.method !== "GET") {
      if (payload instanceof FormData) {
        options.body = payload
        // FormData will set its own Content-Type header
        if ("Content-Type" in headers) {
          delete (headers as any)["Content-Type"]
        }
      } else if (typeof payload === "string") {
        options.body = payload
      } else {
        options.body = JSON.stringify(payload)
      }
    }

    const response = await fetch(url, options)
    return response
  }

  /**
   * Process service response
   */
  private async processResponse(service: ConversionService, response: Response, context: ConversionContext): Promise<{ content: string, mimeType: string, metadata?: any }> {
    // Validate response object
    if (!response) {
      throw new Error("Service returned no response")
    }

    // Check if response has required methods
    if (typeof response.ok !== "boolean") {
      throw new TypeError("Service returned invalid response object")
    }

    const contentType = response.headers.get("content-type") || ""

    try {
      switch (service.responseFormat) {
        case "json": {
          const jsonResponse: APIResponse = await response.json()
          if (!jsonResponse.success) {
            throw new Error(jsonResponse.error?.message || "Service returned error")
          }
          const outputFormat = this.mapServiceCategoryToFormat(context.format)

          // Handle different response structures
          let content, mimeType
          if (jsonResponse.data) {
            content = jsonResponse.data.content
            mimeType = jsonResponse.data.mimeType || this.getDefaultMimeType(outputFormat)
          } else {
            // Handle cases where data is missing (error responses)
            throw new Error("Service response missing data field")
          }

          return {
            content,
            mimeType,
            metadata: jsonResponse.metadata,
          }
        }

        case "base64": {
          const base64Content = await response.text()
          const outputFormat = this.mapServiceCategoryToFormat(context.format)
          return {
            content: base64Content,
            mimeType: this.getDefaultMimeType(outputFormat),
          }
        }

        case "binary": {
          const arrayBuffer = await response.arrayBuffer()
          const base64String = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
          return {
            content: base64String,
            mimeType: contentType.split(";")[0] || "application/octet-stream",
          }
        }

        default: {
          // Assume text response
          const textContent = await response.text()
          return {
            content: textContent,
            mimeType: contentType.split(";")[0] || "text/plain",
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to process service response: ${(error as Error).message}`)
    }
  }

  /**
   * Get default PDF services
   */
  private getDefaultPDFServices(): ConversionService[] {
    return [
      {
        id: "html-pdf-service",
        name: "HTML to PDF Service",
        url: "https://api.html2pdf-service.com",
        endpoint: "v1/convert",
        method: "POST",
        requestFormat: "json",
        responseFormat: "json",
        priority: 1,
        qualityScore: 0.9,
      },
      {
        id: "pdf-generator-api",
        name: "PDF Generator API",
        url: "https://api.pdfgenerator.com",
        endpoint: "generate",
        method: "POST",
        requestFormat: "json",
        responseFormat: "base64",
        priority: 2,
        qualityScore: 0.85,
      },
    ]
  }

  /**
   * Get default image services
   */
  private getDefaultImageServices(): ConversionService[] {
    return [
      {
        id: "html-image-service",
        name: "HTML to Image Service",
        url: "https://api.html2img-service.com",
        endpoint: "v1/screenshot",
        method: "POST",
        requestFormat: "json",
        responseFormat: "base64",
        priority: 1,
        qualityScore: 0.88,
      },
    ]
  }

  /**
   * Get default MHTML services
   */
  private getDefaultMHTMLServices(): ConversionService[] {
    return [
      {
        id: "mhtml-converter",
        name: "MHTML Converter Service",
        url: "https://api.mhtml-converter.com",
        endpoint: "convert",
        method: "POST",
        requestFormat: "json",
        responseFormat: "json",
        priority: 1,
        qualityScore: 0.82,
      },
    ]
  }

  /**
   * Initialize service health tracking
   */
  private initializeServiceHealth(): void {
    const allServices = [
      ...(this.config.services.pdf || []),
      ...(this.config.services.image || []),
      ...(this.config.services.mhtml || []),
    ]

    for (const service of allServices) {
      this.serviceHealth.set(service.id, {
        serviceId: service.id,
        status: "healthy", // Start with healthy until proven otherwise
        lastChecked: new Date(),
        successRate: 1.0,
        successCount: 0,
        failureCount: 0,
      })
    }
  }

  /**
   * Start health checking for services
   */
  private startHealthChecking(): void {
    setInterval(async () => {
      await this.performHealthChecks()
    }, this.config.healthCheck.interval)
  }

  /**
   * Perform health checks on all services
   */
  private async performHealthChecks(): Promise<void> {
    const allServices = [
      ...(this.config.services.pdf || []),
      ...(this.config.services.image || []),
      ...(this.config.services.mhtml || []),
    ]

    const healthCheckPromises = allServices.map(service =>
      this.healthCheckService(service).catch((error) => {
        this.logger.warn("Health check failed for service", {
          serviceId: service.id,
          error: error.message,
        })
      }),
    )

    await Promise.allSettled(healthCheckPromises)
  }

  /**
   * Health check a single service
   */
  private async healthCheckService(service: ConversionService): Promise<void> {
    const startTime = Date.now()
    const healthUrl = `${service.url.replace(/\/$/, "")}/health`

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        headers: this.getAuthenticationHeaders(service),
        signal: AbortSignal.timeout(this.config.healthCheck.timeout ?? 5000),
      })

      const responseTime = Date.now() - startTime
      const isHealthy = response.ok

      this.updateServiceHealth(service.id, isHealthy, responseTime, isHealthy ? undefined : `HTTP ${response.status}`)
    } catch (error) {
      this.updateServiceHealth(service.id, false, Date.now() - startTime, (error as Error).message)
    }
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(serviceId: string, success: boolean, responseTime?: number, error?: string): void {
    const current = this.serviceHealth.get(serviceId)
    if (!current) {
      return
    }

    current.lastChecked = new Date()
    current.responseTime = responseTime

    if (success) {
      current.successCount = (current.successCount || 0) + 1
      current.failureCount = current.failureCount || 0
      current.error = undefined
    } else {
      current.failureCount = (current.failureCount || 0) + 1
      current.successCount = current.successCount || 0
      current.error = error
    }

    // Calculate success rate
    const total = current.successCount + current.failureCount
    current.successRate = total > 0 ? current.successCount / total : 0

    // Update status based on success rate and recent failures
    if (current.failureCount >= (this.config.healthCheck.failureThreshold ?? 3)) {
      current.status = "unhealthy"
    } else if (current.successRate < 0.7) {
      current.status = "degraded"
    } else {
      current.status = "healthy"
    }

    // Decrease request counter on success
    if (success) {
      const currentCount = this.requestCounters.get(serviceId) || 0
      if (currentCount > 0) {
        this.requestCounters.set(serviceId, currentCount - 1)
      }
    }

    this.serviceHealth.set(serviceId, current)
  }

  /**
   * Check if a service is healthy
   */
  private isServiceHealthy(serviceId: string): boolean {
    const health = this.serviceHealth.get(serviceId)
    if (!health) {
      return true // Assume healthy if no health info
    }

    // Check cache TTL
    if (this.config.fallback.cacheHealthStatus) {
      const timeSinceLastCheck = Date.now() - health.lastChecked.getTime()
      if (timeSinceLastCheck > (this.config.fallback.healthCacheTTL ?? 60000)) {
        return true // Assume healthy if cache expired
      }
    }

    return health.status !== "unhealthy"
  }

  /**
   * Get authentication headers for a service
   */
  private getAuthenticationHeaders(service: ConversionService): Record<string, string> {
    const headers: Record<string, string> = {}

    // API key authentication
    const apiKey = this.config.authentication.apiKeys?.[service.id]
    if (apiKey) {
      headers["X-API-Key"] = apiKey
    }

    // Bearer token authentication
    const bearerToken = this.config.authentication.bearerTokens?.[service.id]
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`
    }

    // Custom headers
    const customHeaders = this.config.authentication.customHeaders?.[service.id]
    if (customHeaders) {
      Object.assign(headers, customHeaders)
    }

    return headers
  }

  /**
   * Get content type for request
   */
  private getContentType(requestFormat?: string): string {
    switch (requestFormat) {
      case "json":
        return "application/json"
      case "form-data":
        return "multipart/form-data"
      case "raw":
      default:
        return "text/html"
    }
  }

  /**
   * Check if request should be retried
   */
  private shouldRetry(statusCode: number, attempt: number): boolean {
    if (attempt >= this.config.maxRetries) {
      return false
    }

    // Retry on network errors (status code 0) and 5xx errors
    return statusCode === 0 || (statusCode >= 500 && statusCode < 600)
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.config.retryBaseDelay * 2 ** attempt
    const jitter = Math.random() * 0.1 * delay // Add 10% jitter
    return Math.min(delay + jitter, this.config.retryMaxDelay)
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `ss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get default MIME type for format
   */
  private getDefaultMimeType(format: string): string {
    switch (format) {
      case "pdf":
        return "application/pdf"
      case "png":
      case "jpeg":
      case "webp":
        return `image/${format}`
      case "mhtml":
        return "multipart/related"
      default:
        return "application/octet-stream"
    }
  }

  /**
   * Get total number of configured services
   */
  private getTotalServicesCount(): number {
    return [
      ...(this.config.services.pdf || []),
      ...(this.config.services.image || []),
      ...(this.config.services.mhtml || []),
    ].length
  }

  /**
   * Get number of healthy services
   */
  private getHealthyServicesCount(): number {
    return Array.from(this.serviceHealth.values()).filter(health =>
      health.status === "healthy",
    ).length
  }

  /**
   * Count complex elements in HTML content
   */
  private countComplexElements(htmlContent: string): { externalResources: number } {
    const externalResourcePatterns = [
      /<link[^>]+href=["']http[^"']*["']/gi,
      /<script[^>]+src=["']http[^"']*["']/gi,
      /<img[^>]+src=["']http[^"']*["']/gi,
      /url\(["']?http[^"')]*["']?\)/gi,
    ]

    const externalResources = externalResourcePatterns.reduce((total, pattern) => {
      const matches = htmlContent.match(pattern)
      return total + (matches?.length || 0)
    }, 0)

    return { externalResources }
  }

  /**
   * Estimate conversion time based on content complexity
   */
  private estimateConversionTime(contentSize: number, complexElements: { externalResources: number }): number {
    let baseTime = 2000 // 2 seconds base time for network latency

    // Add time for content upload
    baseTime += Math.ceil(contentSize / 1024) * 50 // 50ms per KB

    // Add time for external resources
    baseTime += complexElements.externalResources * 200

    // Add processing time
    baseTime += 3000

    // Add retry overhead
    baseTime += this.config.maxRetries * this.config.retryBaseDelay

    return baseTime
  }
}
