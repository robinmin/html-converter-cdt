import type { ConversionResult, ConverterStrategy, Logger, ValidationResult } from "../architecture/strategies/types"
import { BasicHTMLTier } from "../tiers/BasicHTMLTier"
import { CanvasTier } from "../tiers/CanvasTier"
import { ChromeCDPTier } from "../tiers/ChromeCDPTier"
import { ServerSideTier } from "../tiers/ServerSideTier"

import type { BrowserCapabilityAssessment, IBrowserCapabilityDetector } from "./capability/types"
import type { ChromeCDPManager } from "./engine/chrome-cdp-manager"

/**
 * Progressive Enhancement Manager configuration options
 */
export interface ProgressiveEnhancementConfig {
  /** Maximum timeout for tier selection attempts */
  tierSelectionTimeout?: number
  /** Maximum number of fallback attempts */
  maxFallbackAttempts?: number
  /** Whether to enable user feedback system */
  enableUserFeedback?: boolean
  /** Whether to cache capability assessments */
  cacheCapabilityAssessment?: boolean
  /** Custom tier priority order (default: [1, 2, 3, 4]) */
  tierPriority?: number[]
  /** Plugin extensions for additional conversion capabilities */
  plugins?: ConversionPlugin[]
  /** User feedback configuration */
  feedbackConfig?: {
    /** Show capability limitations to user */
    showCapabilityLimitations?: boolean
    /** Show conversion progress */
    showProgress?: boolean
    /** Show fallback transitions */
    showFallbackTransitions?: boolean
  }
}

/**
 * Conversion plugin interface for extending capabilities
 */
export interface ConversionPlugin {
  /** Plugin name */
  name: string
  /** Plugin version */
  version: string
  /** Plugin priority */
  priority: number
  /** Check if plugin can handle the conversion */
  canHandle(input: HTMLDocument, format: string): boolean
  /** Execute conversion using plugin */
  convert(input: HTMLDocument, format: string): Promise<ConversionResult>
  /** Validate plugin can handle input */
  validate(input: HTMLDocument): ValidationResult
}

/**
 * User feedback information
 */
export interface UserFeedback {
  /** Current tier being used */
  currentTier: number
  /** Capability limitations encountered */
  capabilityLimitations: string[]
  /** Conversion progress information */
  progress?: {
    /** Progress percentage (0-100) */
    percentage: number
    /** Current operation description */
    operation: string
    /** Estimated remaining time (ms) */
    estimatedTimeRemaining?: number
  }
  /** Fallback transition information */
  fallbackTransition?: {
    /** Previous tier that failed */
    fromTier: number
    /** New tier being used */
    toTier: number
    /** Reason for fallback */
    reason: string
  }
  /** Recommended actions for user */
  recommendations?: string[]
}

/**
 * Progressive Enhancement Manager
 *
 * Orchestrates tier selection using BrowserCapabilityDetector results and provides
 * graceful degradation with unified API interface across all tiers.
 */
export class ProgressiveEnhancementManager {
  private logger: Logger
  private config: Required<ProgressiveEnhancementConfig>
  private capabilityDetector: IBrowserCapabilityDetector
  private chromeManager: ChromeCDPManager
  private currentAssessment: BrowserCapabilityAssessment | null = null
  private currentTier: ConverterStrategy | null = null
  private plugins: ConversionPlugin[] = []
  private userFeedbackCallbacks: ((feedback: UserFeedback) => void)[] = []

  constructor(
    logger: Logger,
    capabilityDetector: IBrowserCapabilityDetector,
    chromeManager: ChromeCDPManager,
    config: ProgressiveEnhancementConfig = {},
  ) {
    this.logger = logger
    this.capabilityDetector = capabilityDetector
    this.chromeManager = chromeManager

    // Default configuration
    this.config = {
      tierSelectionTimeout: 10000,
      maxFallbackAttempts: 3,
      enableUserFeedback: config.enableUserFeedback ?? true,
      cacheCapabilityAssessment: true,
      tierPriority: config.tierPriority ?? [1, 2, 3, 4],
      plugins: [],
      feedbackConfig: {
        showCapabilityLimitations: true,
        showProgress: true,
        showFallbackTransitions: true,
        ...config.feedbackConfig,
      },
      ...config,
    }

    // Initialize plugins
    if (config.plugins) {
      this.plugins = [...config.plugins]
    }

    this.logger.info("Progressive Enhancement Manager initialized", {
      maxFallbackAttempts: this.config.maxFallbackAttempts,
      tierPriority: this.config.tierPriority,
      userFeedbackEnabled: this.config.enableUserFeedback,
      pluginCount: this.plugins.length,
    })
  }

  /**
   * Convert HTML document using optimal available tier
   *
   * @param input - HTML document to convert
   * @param targetFormat - Target conversion format
   * @returns Promise resolving to conversion result
   */
  async convert(input: HTMLDocument, targetFormat?: string): Promise<ConversionResult> {
    const startTime = Date.now()
    let lastError: Error | null = null
    let fallbackAttempts = 0
    let usedTier = 0

    this.logger.info("Starting progressive enhancement conversion", {
      targetFormat: targetFormat ?? "auto",
      maxFallbackAttempts: this.config.maxFallbackAttempts,
    })

    try {
      // Get or refresh capability assessment
      await this.refreshCapabilityAssessment()

      // Select optimal tier based on capabilities
      const optimalTierId = await this.selectOptimalTier(input, targetFormat)
      this.currentTier = await this.createTierInstance(optimalTierId)
      usedTier = optimalTierId

      this.logger.info("Selected optimal conversion tier", {
        tier: optimalTierId,
        tierName: this.currentTier.getName(),
        capabilityScore: this.currentAssessment?.overallScore,
      })

      // Notify user about selected tier if feedback is enabled
      if (this.config.enableUserFeedback) {
        this.notifyUserFeedback({
          currentTier: optimalTierId,
          capabilityLimitations: this.getCapabilityLimitations(optimalTierId),
          recommendations: this.getRecommendations(optimalTierId),
        })
      }

      // Validate input with current tier
      this.notifyProgress("Validating input document", 10)
      const validation = this.currentTier.validate(input)

      if (!validation.isValid) {
        throw new Error(`Input validation failed: ${validation.errors.join(", ")}`)
      }

      // Warn about validation warnings
      if (validation.warnings.length > 0) {
        this.logger.warn("Input validation warnings", validation.warnings)
      }

      // Attempt conversion with fallback
      this.notifyProgress("Converting document", 30)

      while (fallbackAttempts <= this.config.maxFallbackAttempts) {
        try {
          // Attempt conversion with current tier
          const result = await this.currentTier.convert(input)

          const executionTime = Date.now() - startTime

          this.logger.info("Conversion completed successfully", {
            tier: usedTier,
            executionTime,
            fallbackAttempts,
            outputFormat: result.mimeType,
            outputSize: result.metadata.size,
          })

          // Return result with enhanced metadata
          return {
            ...result,
            metadata: {
              ...result.metadata,
              executionTime,
              tier: usedTier,
              fallbackAttempts,
              capabilityScore: this.currentAssessment?.overallScore ?? 0,
              progressiveEnhancement: true,
            },
          }
        } catch (error) {
          lastError = error as Error
          fallbackAttempts++

          this.logger.warn(`Tier ${usedTier} conversion failed, attempting fallback`, {
            error: (error as Error).message,
            attempt: fallbackAttempts,
            maxAttempts: this.config.maxFallbackAttempts,
          })

          // If we have fallback attempts remaining, try next tier
          if (fallbackAttempts <= this.config.maxFallbackAttempts) {
            const nextTierId = await this.selectNextTier(usedTier)
            if (nextTierId && nextTierId !== usedTier) {
              const previousTier = usedTier
              usedTier = nextTierId
              this.currentTier = await this.createTierInstance(nextTierId)

              // Notify about fallback transition
              if (this.config.enableUserFeedback) {
                this.notifyUserFeedback({
                  currentTier: nextTierId,
                  capabilityLimitations: this.getCapabilityLimitations(nextTierId),
                  fallbackTransition: {
                    fromTier: previousTier,
                    toTier: nextTierId,
                    reason: (error as Error).message,
                  },
                  recommendations: this.getRecommendations(nextTierId),
                })
              }

              this.notifyProgress(`Retrying with tier ${nextTierId}`, 30 + (fallbackAttempts * 10))
              continue
            }
          }

          // No more fallback options available
          break
        }
      }

      // All conversion attempts failed
      throw lastError || new Error("Conversion failed after all fallback attempts")
    } catch (error) {
      const executionTime = Date.now() - startTime

      this.logger.error("Progressive enhancement conversion failed", error as Error, {
        executionTime,
        fallbackAttempts,
        usedTier,
      })

      throw new Error(`Progressive enhancement conversion failed: ${(error as Error).message}`)
    }
  }

  /**
   * Validate input document using the best available tier
   *
   * @param input - HTML document to validate
   * @returns Validation result with tier-specific insights
   */
  async validate(input: HTMLDocument): Promise<ValidationResult> {
    try {
      await this.refreshCapabilityAssessment()
      const optimalTierId = await this.selectOptimalTier(input)
      const tier = await this.createTierInstance(optimalTierId)

      this.logger.debug("Validating with optimal tier", { tier: optimalTierId, tierName: tier.getName() })

      const validation = tier.validate(input)

      // Add progressive enhancement context
      return {
        ...validation,
        context: {
          ...validation.context,
          validationTier: optimalTierId,
          validationTierName: tier.getName(),
          capabilityScore: this.currentAssessment?.overallScore ?? 0,
          alternativeTiers: await this.getAlternativeTiers(optimalTierId),
        },
      }
    } catch (error) {
      this.logger.error("Validation failed", error as Error)
      return {
        isValid: false,
        errors: [`Validation error: ${(error as Error).message}`],
        warnings: [],
      }
    }
  }

  /**
   * Get current capability assessment
   *
   * @returns Current capability assessment or null
   */
  getCurrentCapabilityAssessment(): BrowserCapabilityAssessment | null {
    return this.currentAssessment
  }

  /**
   * Get current active tier
   *
   * @returns Current tier instance or null
   */
  getCurrentTier(): ConverterStrategy | null {
    return this.currentTier
  }

  /**
   * Force refresh of capability assessment
   */
  async refreshCapabilityAssessment(): Promise<void> {
    this.logger.debug("Refreshing capability assessment")

    try {
      this.currentAssessment = await this.capabilityDetector.getCompleteAssessment({
        cache: this.config.cacheCapabilityAssessment,
        timeout: this.config.tierSelectionTimeout,
      })

      this.logger.info("Capability assessment refreshed", {
        overallScore: this.currentAssessment.overallScore,
        recommendedTier: this.currentAssessment.recommendedTier,
        chromeAvailable: this.currentAssessment.chromeCDP.available,
        canvasAvailable: this.currentAssessment.canvas.available,
        networkAvailable: this.currentAssessment.network.available,
      })
    } catch (error) {
      this.logger.error("Failed to refresh capability assessment", error as Error)
      throw error
    }
  }

  /**
   * Add user feedback callback
   *
   * @param callback - Function to call with user feedback updates
   */
  addUserFeedbackCallback(callback: (feedback: UserFeedback) => void): void {
    this.userFeedbackCallbacks.push(callback)
  }

  /**
   * Remove user feedback callback
   *
   * @param callback - Function to remove from callbacks
   */
  removeUserFeedbackCallback(callback: (feedback: UserFeedback) => void): void {
    const index = this.userFeedbackCallbacks.indexOf(callback)
    if (index > -1) {
      this.userFeedbackCallbacks.splice(index, 1)
    }
  }

  /**
   * Register a conversion plugin
   *
   * @param plugin - Plugin to register
   */
  registerPlugin(plugin: ConversionPlugin): void {
    this.plugins.push(plugin)
    this.plugins.sort((a, b) => b.priority - a.priority)

    this.logger.info("Conversion plugin registered", {
      name: plugin.name,
      version: plugin.version,
      priority: plugin.priority,
      totalPlugins: this.plugins.length,
    })
  }

  /**
   * Unregister a conversion plugin
   *
   * @param pluginName - Name of plugin to unregister
   */
  unregisterPlugin(pluginName: string): void {
    const index = this.plugins.findIndex(p => p.name === pluginName)
    if (index > -1) {
      this.plugins.splice(index, 1)
      this.logger.info("Conversion plugin unregistered", {
        name: pluginName,
        remainingPlugins: this.plugins.length,
      })
    }
  }

  /**
   * Get supported output formats across all available tiers
   *
   * @returns Array of supported MIME types
   */
  async getSupportedFormats(): Promise<string[]> {
    await this.refreshCapabilityAssessment()
    const formats = new Set<string>()

    // Check each tier for supported formats
    for (const tierId of [1, 2, 3, 4]) {
      try {
        const tier = await this.createTierInstance(tierId)
        if (tier) {
          formats.add(tier.getOutputFormat())
        }
      } catch {
        // Tier not available, skip
      }
    }

    // Add plugin formats
    for (const _plugin of this.plugins) {
      // Plugins typically support multiple formats, but we'd need to extend the interface
      // to query them directly
    }

    return Array.from(formats)
  }

  /**
   * Reset manager state (clear caches, current tier, etc.)
   */
  reset(): void {
    this.currentAssessment = null
    this.currentTier = null
    this.capabilityDetector.clearCache()

    this.logger.debug("Progressive Enhancement Manager reset")
  }

  // Private helper methods

  /**
   * Select optimal tier based on capabilities and requirements
   */
  private async selectOptimalTier(input: HTMLDocument, targetFormat?: string): Promise<number> {
    if (!this.currentAssessment) {
      throw new Error("Capability assessment not available")
    }

    // Start with recommended tier from capability detector
    let recommendedTier = this.currentAssessment.recommendedTier

    // Check if any plugins can handle this conversion better
    if (this.plugins.length > 0 && targetFormat) {
      for (const plugin of this.plugins) {
        if (plugin.canHandle(input, targetFormat)) {
          // Plugin has higher priority than built-in tiers
          this.logger.debug("Plugin can handle conversion", {
            plugin: plugin.name,
            format: targetFormat,
          })
          return 0 // Use plugin tier (0 = plugins)
        }
      }
    }

    // Apply custom tier priority if specified
    if (this.config.tierPriority.length > 0) {
      for (const priorityTier of this.config.tierPriority) {
        if (this.isTierAvailable(priorityTier)) {
          recommendedTier = priorityTier as 1 | 2 | 3 | 4
          break
        }
      }
    }

    // Validate tier availability
    if (!this.isTierAvailable(recommendedTier)) {
      // Find next available tier
      const nextTier = await this.selectNextTier(recommendedTier)
      if (nextTier) {
        recommendedTier = nextTier as 1 | 2 | 3 | 4
      } else {
        throw new Error("No suitable conversion tier available")
      }
    }

    return recommendedTier
  }

  /**
   * Check if a tier is available based on current capabilities
   */
  private isTierAvailable(tierId: number): boolean {
    if (!this.currentAssessment) {
      return false
    }

    switch (tierId) {
      case 1: // Chrome CDP
        return this.currentAssessment.chromeCDP.available
          && this.currentAssessment.chromeCDP.performance > 0.6
      case 2: // Canvas
        return this.currentAssessment.canvas.available
          && this.currentAssessment.canvas.performance > 0.3
      case 3: // Server-side
        return this.currentAssessment.network.available
          && this.currentAssessment.network.corsEnabled
      case 4: // Basic HTML export
        return true // Always available as last resort
      default:
        return false
    }
  }

  /**
   * Select next available tier for fallback
   */
  private async selectNextTier(currentTierId: number): Promise<number | null> {
    const tierOrder = [1, 2, 3, 4]
    const currentIndex = tierOrder.indexOf(currentTierId)

    // If current tier not found, start from beginning
    const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0

    // Try tiers in order, starting from current
    for (let i = startIndex; i < tierOrder.length; i++) {
      const tierId = tierOrder[i]
      if (tierId !== undefined && this.isTierAvailable(tierId)) {
        return tierId
      }
    }

    return null
  }

  /**
   * Create tier instance by ID
   */
  private async createTierInstance(tierId: number): Promise<ConverterStrategy> {
    switch (tierId) {
      case 0: // Plugin tier
        throw new Error("Plugin conversion should be handled separately")
      case 1: // Chrome CDP
        return new ChromeCDPTier(this.logger, this.chromeManager)
      case 2: // Canvas
        return new CanvasTier(this.logger)
      case 3: // Server-side
        return new ServerSideTier(this.logger)
      case 4: // Basic HTML export
        return new BasicHTMLTier(this.logger)
      default:
        throw new Error(`Unknown tier ID: ${tierId}`)
    }
  }

  /**
   * Get capability limitations for a tier
   */
  private getCapabilityLimitations(tierId: number): string[] {
    const limitations: string[] = []

    if (!this.currentAssessment) {
      return limitations
    }

    switch (tierId) {
      case 1: // Chrome CDP
        if (!this.currentAssessment.chromeCDP.available) {
          limitations.push("Chrome DevTools Protocol not available")
        } else if (this.currentAssessment.chromeCDP.performance < 0.8) {
          limitations.push("Chrome CDP performance is limited")
        }
        break
      case 2: // Canvas
        if (!this.currentAssessment.canvas.webgl) {
          limitations.push("WebGL acceleration not available")
        }
        if (this.currentAssessment.canvas.maxSize.width < 1920) {
          limitations.push("Maximum canvas size is limited")
        }
        break
      case 3: // Server-side
        if (!this.currentAssessment.network.corsEnabled) {
          limitations.push("CORS restrictions may affect server-side conversion")
        }
        if (this.currentAssessment.network.concurrentLimit < 6) {
          limitations.push("Network concurrency is limited")
        }
        break
      case 4: // Basic HTML
        limitations.push("Limited to basic HTML export")
        limitations.push("No advanced formatting or styling")
        break
    }

    return limitations
  }

  /**
   * Get recommendations for a tier
   */
  private getRecommendations(tierId: number): string[] {
    const recommendations: string[] = []

    switch (tierId) {
      case 1: // Chrome CDP
        recommendations.push("Ensure Chrome is updated for best compatibility")
        recommendations.push("Close unnecessary tabs to improve performance")
        break
      case 2: // Canvas
        recommendations.push("Simplify complex layouts for better canvas rendering")
        recommendations.push("Avoid external resources for faster conversion")
        break
      case 3: // Server-side
        recommendations.push("Check network connection stability")
        recommendations.push("Ensure firewall allows external service access")
        break
      case 4: // Basic HTML
        recommendations.push("Consider upgrading browser for enhanced features")
        recommendations.push("Enable JavaScript for better functionality")
        break
    }

    return recommendations
  }

  /**
   * Get alternative tiers
   */
  private async getAlternativeTiers(currentTierId: number): Promise<number[]> {
    const alternatives: number[] = []

    for (const tierId of [1, 2, 3, 4]) {
      if (tierId !== currentTierId && this.isTierAvailable(tierId)) {
        alternatives.push(tierId)
      }
    }

    return alternatives
  }

  /**
   * Notify user feedback callbacks
   */
  private notifyUserFeedback(feedback: UserFeedback): void {
    if (!this.config.enableUserFeedback) {
      return
    }

    for (const callback of this.userFeedbackCallbacks) {
      try {
        callback(feedback)
      } catch (error) {
        this.logger.warn("User feedback callback failed", error)
      }
    }
  }

  /**
   * Notify progress update
   */
  private notifyProgress(operation: string, percentage: number): void {
    if (!this.config.enableUserFeedback || !this.config.feedbackConfig.showProgress) {
      return
    }

    this.notifyUserFeedback({
      currentTier: this.currentTier ? 1 : 0, // Simplified for now
      capabilityLimitations: [],
      progress: {
        percentage,
        operation,
      },
    })
  }
}
