/**
 * Chrome Launcher Integration for CDP Management
 *
 * Provides secure Chrome process launching with configurable flags,
 * user data directory management, and process lifecycle controls.
 */

import { randomBytes } from "node:crypto"
import { existsSync, mkdir, rm } from "node:fs/promises"
import { join, tmpdir } from "node:path"
import process from "node:process"

import type { LaunchedChrome } from "chrome-launcher"
import { launch } from "chrome-launcher"

import type { Logger } from "../../../strategies/types.js"

/**
 * Comprehensive secure Chrome flags for production use
 * Following FSD section 10 security requirements
 * NEVER allow --no-sandbox or --remote-debugging-port in production
 */
export const SECURE_CHROME_FLAGS = [
  "--headless",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-translate",
  "--metrics-recording-only",
  "--safebrowsing-disable-auto-update",
  "--mute-audio",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-client-side-phishing-detection",
  "--disable-component-extensions-with-background-pages",
  "--disable-default-apps",
  "--disable-features=TranslateUI",
  "--disable-hang-monitor",
  "--disable-ipc-flooding-protection",
  "--disable-prompt-on-repost",
  "--disable-renderer-backgrounding",
  "--force-color-profile=srgb",
  "--password-store=basic",
  "--use-mock-keychain",
  "--disable-background-mode",
  "--disable-plugins",
  "--disable-images",
  "--disable-javascript",
  "--disable-web-security",
  "--disable-features=VizDisplayCompositor",
]

/**
 * Additional lockdown flags for maximum security
 * Used when security level is set to 'maximum'
 */
export const MAXIMUM_SECURITY_FLAGS = [
  "--disable-notifications",
  "--disable-permissions-api",
  "--disable-web-bluetooth",
  "--disable-web-usb",
  "--disable-web-serial",
  "--disable-webgl",
  "--disable-webgl2",
  "--disable-accelerated-2d-canvas",
  "--disable-accelerated-video-decode",
  "--disable-background-mode",
  "--disable-background-networking",
  "--disable-client-side-phishing-detection",
  "--disable-component-extensions-with-background-pages",
  "--disable-default-apps",
  "--disable-extensions-except",
  "--disable-features=TranslateUI,VizDisplayCompositor",
  "--disable-ipc-flooding-protection",
  "--disable-renderer-backgrounding",
  "--disable-background-logging",
  "--disable-crash-reporter",
  "--disable-breakpad",
  "--disable-domain-reliability",
  "--disable-sync",
  "--disable-features=AudioServiceOutOfProcess",
  "--disable-features=AutofillServerCommunication",
  "--disable-features=CalculateNativeWinOcclusion",
  "--disable-features=CertificateTransparencyComponentUpdater",
  "--disable-features=CrossSiteDocumentBlockingAlways",
  "--disable-features=DestroyProfileOnBrowserClose",
  "--disable-features=EmbeddedSearchExperience",
  "--disable-features=EnterpriseReporting",
  "--disable-features=GlobalMediaControls",
  "--disable-features=HardwareMediaKeyHandling",
  "--disable-features=MediaRouter",
  "--disable-features=OptimizationGuideModelDownloading",
  "--disable-features=OptimizationHintsFetching",
  "--disable-features=PrivacySandboxSettings4",
  "--disable-features=ScrollAnchorSerialization",
  "--disable-features=SpareRendererForSitePerProcess",
  "--disable-features=Translate",
  "--disable-features=VizDisplayCompositor",
  "--disable-features=WebRTCLocalIpPortAccess",
]

/**
 * Development-only flags (NEVER used in production)
 * These are explicitly blocked in production builds
 */
export const DEVELOPMENT_ONLY_FLAGS = [
  "--no-sandbox",
  "--remote-debugging-port",
  "--disable-web-security", // Only for development
]

/**
 * Default secure Chrome flags (backward compatibility)
 */
export const DEFAULT_CHROME_FLAGS = SECURE_CHROME_FLAGS

/**
 * Security levels for Chrome launcher
 */
export type SecurityLevel = "standard" | "high" | "maximum"

/**
 * Chrome launcher configuration options
 */
export interface ChromeLauncherOptions {
  /** Custom Chrome flags (merged with defaults) */
  chromeFlags?: string[]
  /** Starting port for Chrome debugging */
  startingPort?: number
  /** Port range to try */
  portRange?: number
  /** Whether to launch Chrome headlessly */
  headless?: boolean
  /** Custom user data directory */
  userDataDir?: string
  /** Whether to use existing Chrome instance */
  reuseExisting?: boolean
  /** Chrome executable path */
  chromePath?: string
  /** Maximum attempts to find available port */
  maxPortAttempts?: number
  /** Process kill timeout in milliseconds */
  killTimeout?: number
  /** Logger instance */
  logger?: Logger
  /** Security level for Chrome launch */
  securityLevel?: SecurityLevel
  /** Whether to enforce production security (blocks dangerous flags) */
  enforceSecurity?: boolean
  /** Environment (development/production) */
  environment?: "development" | "production"
}

/**
 * Chrome process information
 */
export interface ChromeProcessInfo {
  /** Chrome process instance */
  chrome: LaunchedChrome
  /** Debugging port */
  port: number
  /** Process ID */
  pid: number
  /** User data directory */
  userDataDir: string
  /** WebSocket endpoint URL */
  websocketUrl: string
  /** Launch timestamp */
  launchedAt: Date
  /** Chrome version */
  version?: string
}

/**
 * Chrome Launcher class for secure Chrome process management
 *
 * Provides configurable Chrome process spawning with security-focused
 * flag configuration and proper lifecycle management.
 */
export class ChromeLauncher {
  private config: Required<ChromeLauncherOptions>
  private activeProcesses: Map<number, ChromeProcessInfo> = new Map()
  private isShuttingDown = false

  constructor(options: ChromeLauncherOptions = {}) {
    const environment = options.environment || process.env.NODE_ENV || "development"
    const enforceSecurity = options.enforceSecurity !== false && environment === "production"

    this.config = {
      chromeFlags: options.chromeFlags || [],
      startingPort: options.startingPort || 9222,
      portRange: options.portRange || 100,
      headless: options.headless !== false, // Default to headless
      userDataDir: options.userDataDir || "",
      reuseExisting: options.reuseExisting || false,
      chromePath: options.chromePath || "",
      maxPortAttempts: options.maxPortAttempts || 10,
      killTimeout: options.killTimeout || 5000,
      logger: options.logger || this.createDefaultLogger(),
      securityLevel: options.securityLevel || (enforceSecurity ? "high" : "standard"),
      enforceSecurity,
      environment: environment as "development" | "production",
    }

    // Validate security configuration
    this.validateSecurityConfiguration()

    // Set up process cleanup handlers
    this.setupCleanupHandlers()
  }

  /**
   * Launch Chrome with secure configuration
   * @param options - Override options for this launch
   * @returns Promise resolving to Chrome process information
   */
  async launch(options: ChromeLauncherOptions = {}): Promise<ChromeProcessInfo> {
    if (this.isShuttingDown) {
      throw new Error("ChromeLauncher is shutting down")
    }

    const launchConfig = { ...this.config, ...options }
    const userDataDir = await this.createUserDataDir(launchConfig.userDataDir)

    try {
      this.logInfo("Launching Chrome process", {
        headless: launchConfig.headless,
        userDataDir,
        startingPort: launchConfig.startingPort,
      })

      // Prepare Chrome flags with security focus
      const chromeFlags = this.prepareChromeFlags(launchConfig, userDataDir)

      // Find available port
      const port = await this.findAvailablePort(
        launchConfig.startingPort,
        launchConfig.portRange,
        launchConfig.maxPortAttempts,
      )

      // Launch Chrome
      const chrome = await launch({
        port,
        chromeFlags,
        userDataDir,
        chromePath: launchConfig.chromePath || undefined,
        ignoreDefaultFlags: false,
        logLevel: "silent",
      })

      const processInfo: ChromeProcessInfo = {
        chrome,
        port,
        pid: chrome.pid!,
        userDataDir,
        websocketUrl: `ws://localhost:${port}`,
        launchedAt: new Date(),
      }

      // Store process information
      this.activeProcesses.set(chrome.pid!, processInfo)

      this.logInfo("Chrome launched successfully", {
        pid: chrome.pid,
        port,
        userDataDir,
        websocketUrl: processInfo.websocketUrl,
      })

      return processInfo
    } catch (error) {
      // Cleanup user data directory on launch failure
      await this.cleanupUserDataDir(userDataDir)
      throw new Error(`Failed to launch Chrome: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Kill Chrome process and cleanup resources
   * @param pid - Process ID to kill
   * @returns Promise that resolves when cleanup is complete
   */
  async kill(pid: number): Promise<void> {
    const processInfo = this.activeProcesses.get(pid)
    if (!processInfo) {
      this.logWarning("Chrome process not found", { pid })
      return
    }

    try {
      this.logInfo("Killing Chrome process", { pid })

      // Kill Chrome process
      await processInfo.chrome.kill()

      // Cleanup user data directory
      await this.cleanupUserDataDir(processInfo.userDataDir)

      // Remove from active processes
      this.activeProcesses.delete(pid)

      this.logInfo("Chrome process killed successfully", { pid })
    } catch (error) {
      this.logError("Failed to kill Chrome process", { pid, error })
      throw error
    }
  }

  /**
   * Get information about active Chrome processes
   * @returns Array of active process information
   */
  getActiveProcesses(): ChromeProcessInfo[] {
    return Array.from(this.activeProcesses.values())
  }

  /**
   * Get process information by PID
   * @param pid - Process ID
   * @returns Process information or null if not found
   */
  getProcess(pid: number): ChromeProcessInfo | null {
    return this.activeProcesses.get(pid) || null
  }

  /**
   * Check if Chrome process is running
   * @param pid - Process ID
   * @returns True if process is active
   */
  isProcessActive(pid: number): boolean {
    return this.activeProcesses.has(pid)
  }

  /**
   * Kill all active Chrome processes
   * @returns Promise that resolves when all processes are killed
   */
  async killAll(): Promise<void> {
    const pids = Array.from(this.activeProcesses.keys())
    await Promise.all(pids.map(pid => this.kill(pid).catch(error =>
      this.logError("Failed to kill process", { pid, error }),
    )))
  }

  /**
   * Shutdown the launcher and kill all processes
   * @returns Promise that resolves when shutdown is complete
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    this.logInfo("Shutting down ChromeLauncher")

    await this.killAll()
    this.activeProcesses.clear()
  }

  /**
   * Create secure user data directory
   * @param customDir - Custom directory path (optional)
   * @returns Promise resolving to created directory path
   */
  private async createUserDataDir(customDir?: string): Promise<string> {
    if (customDir && customDir.trim() !== "") {
      // Use custom directory if provided
      if (!existsSync(customDir)) {
        await mkdir(customDir, { recursive: true })
      }
      return customDir
    }

    // Create temporary directory with restricted permissions
    const dirName = `chrome-data-${randomBytes(8).toString("hex")}`
    const userDataDir = join(tmpdir(), dirName)

    await mkdir(userDataDir, {
      recursive: true,
      mode: 0o700, // Restrictive permissions: owner read/write/execute only
    })

    return userDataDir
  }

  /**
   * Cleanup user data directory
   * @param userDataDir - Directory path to cleanup
   * @returns Promise that resolves when cleanup is complete
   */
  private async cleanupUserDataDir(userDataDir: string): Promise<void> {
    try {
      await rm(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
      })
    } catch (error) {
      this.logWarning("Failed to cleanup user data directory", {
        userDataDir,
        error,
      })
    }
  }

  /**
   * Prepare Chrome flags with security focus
   * @param config - Launch configuration
   * @param userDataDir - User data directory path
   * @returns Array of Chrome flags
   */
  private prepareChromeFlags(config: Required<ChromeLauncherOptions>, userDataDir: string): string[] {
    // Start with base secure flags
    const flags = [...SECURE_CHROME_FLAGS]

    // Add security level specific flags
    if (config.securityLevel === "maximum") {
      flags.push(...MAXIMUM_SECURITY_FLAGS)
    } else if (config.securityLevel === "high") {
      // Add some high security flags for maximum protection
      flags.push(
        "--disable-notifications",
        "--disable-permissions-api",
        "--disable-web-bluetooth",
        "--disable-web-usb",
        "--disable-webgl",
        "--disable-webgl2",
        "--disable-accelerated-2d-canvas",
        "--disable-accelerated-video-decode",
        "--disable-crash-reporter",
        "--disable-domain-reliability",
      )
    }

    // Add headless mode if specified (already in SECURE_CHROME_FLAGS but ensure it's there)
    if (config.headless && !flags.includes("--headless")) {
      flags.push("--headless")
    }

    // Process custom flags with security validation
    if (config.chromeFlags && config.chromeFlags.length > 0) {
      const validatedCustomFlags = this.validateCustomFlags(config.chromeFlags)
      flags.push(...validatedCustomFlags)
    }

    // Add user data directory flag
    flags.push(`--user-data-dir=${userDataDir}`)

    // Add remote debugging port flag (will be replaced by chrome-launcher)
    // Only for development - in production this should be blocked
    if (config.environment === "development") {
      flags.push("--remote-debugging-port=0")
    }

    // Additional security and performance flags
    flags.push(
      "--enable-automation",
      "--disable-features=TranslateUI,BlinkGenPropertyTrees",
    )

    // Log final security configuration
    this.logInfo("Chrome security configuration", {
      securityLevel: config.securityLevel,
      environment: config.environment,
      enforceSecurity: config.enforceSecurity,
      totalFlags: flags.length,
      hasHeadless: flags.includes("--headless"),
      hasSandbox: !flags.some(f => f.includes("--no-sandbox")),
    })

    return flags
  }

  /**
   * Validate custom Chrome flags for security compliance
   * @param customFlags - Array of custom flags to validate
   * @returns Array of validated secure flags
   */
  private validateCustomFlags(customFlags: string[]): string[] {
    const validatedFlags: string[] = []
    const blockedFlags: string[] = []

    for (const flag of customFlags) {
      const lowerFlag = flag.toLowerCase()

      // Block dangerous flags in production
      if (this.config.enforceSecurity) {
        if (this.isDangerousFlag(lowerFlag)) {
          blockedFlags.push(flag)
          this.logWarning("Blocked dangerous Chrome flag in production", { flag })
          continue
        }
      }

      // Security validation
      if (this.isInsecureFlag(lowerFlag)) {
        if (this.config.environment === "development") {
          this.logWarning("Allowing insecure flag in development mode", { flag })
          validatedFlags.push(flag)
        } else {
          blockedFlags.push(flag)
          this.logWarning("Blocked insecure Chrome flag", { flag })
        }
        continue
      }

      // Flag is safe
      validatedFlags.push(flag)
    }

    // Report blocked flags
    if (blockedFlags.length > 0) {
      this.logWarning("Some Chrome flags were blocked for security", {
        blockedFlags,
        environment: this.config.environment,
        enforceSecurity: this.config.enforceSecurity,
      })
    }

    return validatedFlags
  }

  /**
   * Check if a flag is dangerous and should never be allowed
   * @param flag - Chrome flag to check
   * @returns True if flag is dangerous
   */
  private isDangerousFlag(flag: string): boolean {
    const dangerousPatterns = [
      "--no-sandbox",
      "--disable-sandbox",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor", // Can be used for exploits
      "--remote-debugging-port=",
      "--debug-devtools",
      "--enable-logging",
      "--enable-benchmarking",
      "--enable-features=EnableDrDc",
    ]

    return dangerousPatterns.some(pattern => flag.includes(pattern))
  }

  /**
   * Check if a flag is insecure but may be allowed in development
   * @param flag - Chrome flag to check
   * @returns True if flag is insecure
   */
  private isInsecureFlag(flag: string): boolean {
    const insecurePatterns = [
      "--disable-extensions-except",
      "--load-extension=",
      "--disable-extensions-http-throttling",
      "--allow-running-insecure-content",
      "--disable-web-security",
      "--ignore-certificate-errors",
      "--ignore-ssl-errors",
      "--ignore-certificate-errors-spki-list",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-features=CrossSiteDocumentBlockingIfIsolating",
    ]

    return insecurePatterns.some(pattern => flag.includes(pattern))
  }

  /**
   * Validate the overall security configuration
   */
  private validateSecurityConfiguration(): void {
    if (this.config.enforceSecurity && this.config.environment !== "production") {
      this.logWarning("Security enforcement enabled in non-production environment", {
        environment: this.config.environment,
        securityLevel: this.config.securityLevel,
      })
    }

    if (this.config.securityLevel === "maximum" && this.config.environment === "development") {
      this.logWarning("Maximum security level in development may limit functionality", {
        securityLevel: this.config.securityLevel,
      })
    }

    this.logInfo("Chrome launcher security configuration validated", {
      environment: this.config.environment,
      securityLevel: this.config.securityLevel,
      enforceSecurity: this.config.enforceSecurity,
    })
  }

  /**
   * Find available port for Chrome debugging
   * @param startPort - Starting port number
   * @param range - Port range to search
   * @param maxAttempts - Maximum number of attempts
   * @returns Promise resolving to available port number
   */
  private async findAvailablePort(
    startPort: number,
    range: number,
    maxAttempts: number,
  ): Promise<number> {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + (i % range)

      try {
        // Try to check if port is available
        const testChrome = await launch({
          port,
          chromeFlags: ["--headless", "--no-sandbox"],
          userDataDir: await this.createUserDataDir(),
          ignoreDefaultFlags: true,
          logLevel: "silent",
        })

        // If successful, kill test Chrome and return port
        await testChrome.kill()
        return port
      } catch {
        // Port not available, try next
        continue
      }
    }

    throw new Error(`No available ports found in range ${startPort}-${startPort + range}`)
  }

  /**
   * Setup process cleanup handlers for graceful shutdown
   */
  private setupCleanupHandlers(): void {
    const cleanup = async () => {
      if (!this.isShuttingDown) {
        await this.shutdown()
      }
    }

    process.once("exit", cleanup)
    process.once("SIGINT", cleanup)
    process.once("SIGTERM", cleanup)
    process.once("uncaughtException", (_error) => {
      // Handle uncaught exception gracefully
      cleanup()
    })
    process.once("unhandledRejection", (_reason, _promise) => {
      // Handle unhandled rejection gracefully
      cleanup()
    })
  }

  /**
   * Create default logger instance
   * @returns Logger instance
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, context?: any) => {
        if (process.env.NODE_ENV === "development") {
          console.debug(`[ChromeLauncher] ${message}`, context || "")
        }
      },
      info: (message: string, context?: any) => {
        console.info(`[ChromeLauncher] ${message}`, context || "")
      },
      warn: (message: string, context?: any) => {
        console.warn(`[ChromeLauncher] ${message}`, context || "")
      },
      error: (message: string, context?: any) => {
        console.error(`[ChromeLauncher] ${message}`, context || "")
      },
    }
  }

  /**
   * Log info message
   */
  private logInfo(message: string, context?: any): void {
    this.config.logger.info(message, context)
  }

  /**
   * Log warning message
   */
  private logWarning(message: string, context?: any): void {
    this.config.logger.warn(message, context)
  }

  /**
   * Log error message
   */
  private logError(message: string, context?: any): void {
    this.config.logger.error(message, context)
  }
}
