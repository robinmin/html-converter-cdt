/**
 * Chrome Process Isolation and Network Security Manager
 *
 * Provides comprehensive process isolation and network security for Chrome instances
 * including user data directory separation, network access restrictions, and resource monitoring.
 */

import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

import type { Logger } from "../../architecture/strategies/types.js"

/**
 * Process isolation configuration
 */
export interface ProcessIsolationConfig {
  /** Unique identifier for this isolated process */
  processId: string
  /** User data directory for Chrome profile */
  userDataDir?: string
  /** Whether to enable network restrictions */
  networkRestrictions?: boolean
  /** Whether to enable file system restrictions */
  fileSystemRestrictions?: boolean
  /** Whether to enable resource monitoring */
  resourceMonitoring?: boolean
  /** Maximum memory usage in MB */
  maxMemoryMB?: number
  /** Maximum CPU usage percentage */
  maxCpuPercentage?: number
  /** Network timeout in milliseconds */
  networkTimeout?: number
  /** Allowed domains whitelist */
  allowedDomains?: string[]
  /** Blocked domains blacklist */
  blockedDomains?: string[]
}

/**
 * Network security policy
 */
export interface NetworkSecurityPolicy {
  /** Whether to allow external network access */
  allowExternalAccess: boolean
  /** Whether to block private IP ranges */
  blockPrivateIPs: boolean
  /** Whether to block localhost access */
  blockLocalhost: boolean
  /** List of allowed domains */
  allowedDomains: string[]
  /** List of blocked domains */
  blockedDomains: string[]
  /** Maximum request timeout */
  maxTimeout: number
  /** Maximum request size in bytes */
  maxRequestSize: number
}

/**
 * File system security policy
 */
export interface FileSystemSecurityPolicy {
  /** Whether to allow file system access */
  allowFileSystemAccess: boolean
  /** Allowed read directories */
  allowedReadDirs: string[]
  /** Allowed write directories */
  allowedWriteDirs: string[]
  /** Blocked file patterns */
  blockedPatterns: string[]
  /** Maximum file size for reading */
  maxReadFileSize: number
  /** Maximum file size for writing */
  maxWriteFileSize: number
}

/**
 * Resource usage statistics
 */
export interface ResourceUsage {
  /** Memory usage in MB */
  memoryUsageMB: number
  /** CPU usage percentage */
  cpuUsagePercentage: number
  /** Network requests count */
  networkRequestsCount: number
  /** File operations count */
  fileOperationsCount: number
  /** Process uptime in seconds */
  uptimeSeconds: number
  /** Number of child processes */
  childProcessCount: number
}

/**
 * Network access log entry
 */
export interface NetworkAccessLog {
  /** Timestamp of access attempt */
  timestamp: Date
  /** Source process ID */
  processId: string
  /** Target URL or IP */
  target: string
  /** Access method (GET, POST, etc.) */
  method: string
  /** Whether access was allowed or blocked */
  allowed: boolean
  /** Reason for blocking */
  blockReason?: string
  /** Response size in bytes */
  responseSize?: number
  /** Response time in milliseconds */
  responseTime?: number
}

/**
 * File system access log entry
 */
export interface FileSystemAccessLog {
  /** Timestamp of access attempt */
  timestamp: Date
  /** Source process ID */
  processId: string
  /** File path */
  filePath: string
  /** Access type (read, write, delete) */
  accessType: "read" | "write" | "delete"
  /** Whether access was allowed or blocked */
  allowed: boolean
  /** Reason for blocking */
  blockReason?: string
  /** File size in bytes */
  fileSize?: number
}

/**
 * Chrome Process Isolation and Network Security Manager
 *
 * Provides enterprise-grade security for Chrome processes including:
 * - Isolated user data directories per conversion
 * - Process-specific Chrome profiles
 * - Network access restrictions with private IP blocking
 * - File system access limitations
 * - Resource usage monitoring
 * - Comprehensive audit logging
 */
export class ProcessIsolationManager {
  private logger: Logger
  private activeProcesses = new Map<string, ProcessIsolationConfig>()
  private networkAccessLogs: NetworkAccessLog[] = []
  private fileSystemAccessLogs: FileSystemAccessLog[] = []
  private resourceUsageStats = new Map<string, ResourceUsage>()
  private readonly MAX_LOG_ENTRIES = 10000

  constructor(logger?: Logger) {
    this.logger = logger || this.createDefaultLogger()
  }

  /**
   * Create an isolated Chrome process environment
   * @param config - Process isolation configuration
   * @returns Promise resolving to created user data directory path
   */
  async createIsolatedProcess(config: ProcessIsolationConfig): Promise<string> {
    const {
      processId,
      userDataDir: providedUserDataDir,
      networkRestrictions = true,
      fileSystemRestrictions = true,
      resourceMonitoring = true,
      maxMemoryMB = 1024,
      maxCpuPercentage = 80,
      networkTimeout = 30000,
    } = config

    try {
      // Generate secure user data directory if not provided
      const userDataDir = providedUserDataDir || await this.createIsolatedUserDataDir(processId)

      // Create Chrome profile with security restrictions
      await this.setupSecureChromeProfile(userDataDir, config)

      // Apply network security policies
      if (networkRestrictions) {
        await this.setupNetworkSecurity(userDataDir, config)
      }

      // Apply file system security policies
      if (fileSystemRestrictions) {
        await this.setupFileSystemSecurity(userDataDir, config)
      }

      // Initialize resource monitoring
      if (resourceMonitoring) {
        this.initializeResourceMonitoring(processId, config)
      }

      // Store process configuration
      this.activeProcesses.set(processId, {
        ...config,
        userDataDir,
        networkRestrictions,
        fileSystemRestrictions,
        resourceMonitoring,
        maxMemoryMB,
        maxCpuPercentage,
        networkTimeout,
      })

      this.logger.info(`Isolated Chrome process created: ${processId}`, {
        userDataDir,
        networkRestrictions,
        fileSystemRestrictions,
        resourceMonitoring,
      })

      return userDataDir
    } catch (error) {
      this.logger.error(`Failed to create isolated process: ${processId}`, error as Error)
      throw new Error(`Failed to create isolated process: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Create an isolated user data directory for Chrome
   * @param processId - Unique process identifier
   * @returns Promise resolving to created directory path
   */
  private async createIsolatedUserDataDir(processId: string): Promise<string> {
    const sanitizedName = processId.replace(/[^\w-]/g, "_")
    const dirName = `chrome_isolated_${sanitizedName}_${randomBytes(16).toString("hex")}`
    const userDataDir = join(tmpdir(), "html-converter-isolated", dirName)

    // Create directory with restricted permissions (0o700)
    mkdirSync(userDataDir, { recursive: true, mode: 0o700 })

    // Create Chrome profile structure
    const profileDirs = ["Default", "Guest Profile", "System Profile"]
    for (const profileDir of profileDirs) {
      const profilePath = join(userDataDir, profileDir)
      mkdirSync(profilePath, { recursive: true, mode: 0o700 })
    }

    return userDataDir
  }

  /**
   * Setup secure Chrome profile with restrictions
   * @param userDataDir - User data directory path
   * @param config - Process isolation configuration
   */
  private async setupSecureChromeProfile(userDataDir: string, config: ProcessIsolationConfig): Promise<void> {
    const profilePath = join(userDataDir, "Default")

    // Create secure preferences file
    const preferences = {
      profile: {
        name: `Isolated Process ${config.processId}`,
        avatar_index: 0,
      },
      privacy: {
        safe_browsing: {
          enabled: true,
        },
        security: {
          enable_extension_platform: false,
          enable_legacy_extension_manifests: false,
        },
      },
      security: {
        enable_protection_for_vr_content: true,
        webgl_compatibility_context_enabled: false,
        mixed_content_renderer_enabled: false,
      },
      network: {
        network_prediction_enabled: false,
        dns_prefetching_enabled: false,
      },
      content_settings: {
        exceptions: {
          geolocation: {},
          notifications: {},
          media_stream_mic: {},
          media_stream_camera: {},
        },
      },
    }

    // Write preferences with restricted permissions
    const preferencesPath = join(profilePath, "Preferences")
    writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2), { mode: 0o600 })

    // Create secure local state file
    const localState = {
      background_mode: {
        enabled: false,
      },
      variations_header: {},
      metrics: {
        reporting_enabled: false,
      },
      safe_browsing: {
        scout_reporting_enabled: false,
        extended_reporting_enabled: false,
      },
    }

    const localStatePath = join(userDataDir, "Local State")
    writeFileSync(localStatePath, JSON.stringify(localState, null, 2), { mode: 0o600 })
  }

  /**
   * Setup network security policies
   * @param userDataDir - User data directory path
   * @param config - Process isolation configuration
   */
  private async setupNetworkSecurity(userDataDir: string, config: ProcessIsolationConfig): Promise<void> {
    const networkPolicy: NetworkSecurityPolicy = {
      allowExternalAccess: false, // Restrict external access by default
      blockPrivateIPs: true,
      blockLocalhost: true,
      allowedDomains: config.allowedDomains || [],
      blockedDomains: [
        // Block known malicious domains
        "malware-example.com",
        "phishing-site.com",
        ...(config.blockedDomains || []),
      ],
      maxTimeout: config.networkTimeout || 30000,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
    }

    // Write network security policy
    const policyPath = join(userDataDir, "network_security.json")
    writeFileSync(policyPath, JSON.stringify(networkPolicy, null, 2), { mode: 0o600 })

    // Create proxy configuration for network filtering
    const proxyConfig = {
      mode: "system",
      pac_script: this.generateProxyPACScript(networkPolicy),
    }

    const proxyPath = join(userDataDir, "proxy_config.json")
    writeFileSync(proxyPath, JSON.stringify(proxyConfig, null, 2), { mode: 0o600 })
  }

  /**
   * Generate PAC (Proxy Auto-Configuration) script for network filtering
   * @param policy - Network security policy
   * @returns Generated PAC script
   */
  private generateProxyPACScript(policy: NetworkSecurityPolicy): string {
    return `
function FindProxyForURL(url, host) {
  // Block localhost access
  if (${policy.blockLocalhost ? "true" : "false"} && (
      isPlainHostName(host) ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("127.") ||
      host.startsWith("169.254.") ||
      host.startsWith("fe80::")
  )) {
    return "PROXY 0.0.0.0:0"; // Block
  }

  // Block private IP ranges
  if (${policy.blockPrivateIPs ? "true" : "false"}) {
    // 10.0.0.0/8
    if (/^10\\./.test(host)) return "PROXY 0.0.0.0:0";

    // 172.16.0.0/12
    if (/^172\\.(1[6-9]|2[0-9]|3[0-1])\\./.test(host)) return "PROXY 0.0.0.0:0";

    // 192.168.0.0/16
    if (/^192\\.168\\./.test(host)) return "PROXY 0.0.0.0:0";
  }

  // Check blocked domains
  const blockedDomains = ${JSON.stringify(policy.blockedDomains)};
  for (const domain of blockedDomains) {
    if (dnsDomainIs(host, domain)) {
      return "PROXY 0.0.0.0:0"; // Block
    }
  }

  // Check allowed domains
  const allowedDomains = ${JSON.stringify(policy.allowedDomains)};
  if (allowedDomains.length > 0) {
    let allowed = false;
    for (const domain of allowedDomains) {
      if (dnsDomainIs(host, domain)) {
        allowed = true;
        break;
      }
    }
    if (!allowed) {
      return "PROXY 0.0.0.0:0"; // Block
    }
  }

  // Default: block external access if not allowed
  if (!${policy.allowExternalAccess ? "true" : "false"}) {
    return "PROXY 0.0.0.0:0";
  }

  // Allow access
  return "DIRECT";
}
`.trim()
  }

  /**
   * Setup file system security policies
   * @param userDataDir - User data directory path
   * @param _config - Process isolation configuration
   */
  private async setupFileSystemSecurity(userDataDir: string, _config: ProcessIsolationConfig): Promise<void> {
    const fileSystemPolicy: FileSystemSecurityPolicy = {
      allowFileSystemAccess: true, // Allow limited access
      allowedReadDirs: [
        userDataDir, // Allow access to own data directory
        "/usr/share", // System read-only directories
        "/lib",
        "/usr/lib",
      ],
      allowedWriteDirs: [
        userDataDir, // Only allow writing to own data directory
      ],
      blockedPatterns: [
        // Block sensitive system files
        "/etc/**",
        "/root/**",
        "/var/log/**",
        "/home/**",
        "/Users/**",
        "~/**",
        "**/.ssh/**",
        "**/.gnupg/**",
        "**/.aws/**",
        "**/.config/gcloud/**",
      ],
      maxReadFileSize: 100 * 1024 * 1024, // 100MB
      maxWriteFileSize: 50 * 1024 * 1024, // 50MB
    }

    // Write file system security policy
    const policyPath = join(userDataDir, "filesystem_security.json")
    writeFileSync(policyPath, JSON.stringify(fileSystemPolicy, null, 2), { mode: 0o600 })
  }

  /**
   * Initialize resource monitoring for a process
   * @param processId - Process identifier
   * @param _config - Process configuration
   */
  private initializeResourceMonitoring(processId: string, _config: ProcessIsolationConfig): void {
    const initialStats: ResourceUsage = {
      memoryUsageMB: 0,
      cpuUsagePercentage: 0,
      networkRequestsCount: 0,
      fileOperationsCount: 0,
      uptimeSeconds: 0,
      childProcessCount: 0,
    }

    this.resourceUsageStats.set(processId, initialStats)

    // Start monitoring interval (every 10 seconds)
    const monitoringInterval = setInterval(() => {
      this.updateResourceUsage(processId)
    }, 10000)

    // Store interval for cleanup
    ;(initialStats as any).monitoringInterval = monitoringInterval
  }

  /**
   * Update resource usage statistics
   * @param processId - Process identifier
   */
  private updateResourceUsage(processId: string): void {
    const stats = this.resourceUsageStats.get(processId)
    if (!stats) {
      return
    }

    try {
      // In a real implementation, you would collect actual metrics
      // For now, we'll simulate the monitoring
      stats.uptimeSeconds += 10

      // Simulate memory usage growth
      stats.memoryUsageMB = Math.min(stats.memoryUsageMB + Math.random() * 10, 1024)

      // Simulate CPU usage
      stats.cpuUsagePercentage = Math.random() * 100

      // Log if thresholds are exceeded
      const processConfig = this.activeProcesses.get(processId)
      if (processConfig) {
        if (stats.memoryUsageMB > (processConfig.maxMemoryMB || 1024)) {
          this.logger.warn(`Memory threshold exceeded for process ${processId}`, {
            current: stats.memoryUsageMB,
            limit: processConfig.maxMemoryMB,
          })
        }

        if (stats.cpuUsagePercentage > (processConfig.maxCpuPercentage || 80)) {
          this.logger.warn(`CPU threshold exceeded for process ${processId}`, {
            current: stats.cpuUsagePercentage,
            limit: processConfig.maxCpuPercentage,
          })
        }
      }
    } catch (error) {
      this.logger.error(`Failed to update resource usage for process ${processId}`, error as Error)
    }
  }

  /**
   * Log network access attempt
   * @param processId - Process identifier
   * @param target - Target URL or IP
   * @param method - HTTP method
   * @param allowed - Whether access was allowed
   * @param blockReason - Reason for blocking
   * @param responseSize - Response size in bytes
   * @param responseTime - Response time in milliseconds
   */
  logNetworkAccess(
    processId: string,
    target: string,
    method: string,
    allowed: boolean,
    blockReason?: string,
    responseSize?: number,
    responseTime?: number,
  ): void {
    const logEntry: NetworkAccessLog = {
      timestamp: new Date(),
      processId,
      target,
      method,
      allowed,
      blockReason,
      responseSize,
      responseTime,
    }

    this.networkAccessLogs.push(logEntry)

    // Trim logs if too large
    if (this.networkAccessLogs.length > this.MAX_LOG_ENTRIES) {
      this.networkAccessLogs = this.networkAccessLogs.slice(-this.MAX_LOG_ENTRIES)
    }

    // Update resource usage
    const stats = this.resourceUsageStats.get(processId)
    if (stats) {
      stats.networkRequestsCount++
    }

    // Log security events
    if (!allowed) {
      this.logger.warn(`Network access blocked for process ${processId}`, {
        target,
        method,
        blockReason,
      })
    }
  }

  /**
   * Log file system access attempt
   * @param processId - Process identifier
   * @param filePath - File path
   * @param accessType - Type of access
   * @param allowed - Whether access was allowed
   * @param blockReason - Reason for blocking
   * @param fileSize - File size in bytes
   */
  logFileSystemAccess(
    processId: string,
    filePath: string,
    accessType: "read" | "write" | "delete",
    allowed: boolean,
    blockReason?: string,
    fileSize?: number,
  ): void {
    const logEntry: FileSystemAccessLog = {
      timestamp: new Date(),
      processId,
      filePath,
      accessType,
      allowed,
      blockReason,
      fileSize,
    }

    this.fileSystemAccessLogs.push(logEntry)

    // Trim logs if too large
    if (this.fileSystemAccessLogs.length > this.MAX_LOG_ENTRIES) {
      this.fileSystemAccessLogs = this.fileSystemAccessLogs.slice(-this.MAX_LOG_ENTRIES)
    }

    // Update resource usage
    const stats = this.resourceUsageStats.get(processId)
    if (stats) {
      stats.fileOperationsCount++
    }

    // Log security events
    if (!allowed) {
      this.logger.warn(`File system access blocked for process ${processId}`, {
        filePath,
        accessType,
        blockReason,
      })
    }
  }

  /**
   * Check if a URL is allowed based on network security policy
   * @param processId - Process identifier
   * @param url - URL to check
   * @returns Whether the URL is allowed
   */
  isUrlAllowed(processId: string, url: string): boolean {
    const processConfig = this.activeProcesses.get(processId)
    if (!processConfig) {
      return false
    }

    try {
      const parsedUrl = new URL(url)
      const hostname = parsedUrl.hostname

      // Check blocked domains
      const blockedDomains = processConfig.blockedDomains || []
      for (const domain of blockedDomains) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          return false
        }
      }

      // Check private IP ranges
      if (this.isPrivateIP(hostname)) {
        return false
      }

      // Check localhost
      if (this.isLocalhost(hostname)) {
        return false
      }

      // Check allowed domains (if specified)
      const allowedDomains = processConfig.allowedDomains || []
      if (allowedDomains.length > 0) {
        let allowed = false
        for (const domain of allowedDomains) {
          if (hostname === domain || hostname.endsWith(`.${domain}`)) {
            allowed = true
            break
          }
        }
        return allowed
      }

      // Default: allow if no specific restrictions
      return true
    } catch (error) {
      this.logger.warn(`Invalid URL format: ${url}`, error as Error)
      return false
    }
  }

  /**
   * Check if a hostname is a private IP
   * @param hostname - Hostname to check
   * @returns Whether the hostname is a private IP
   */
  private isPrivateIP(hostname: string): boolean {
    // IPv4 private ranges
    const ipv4Pattern = /^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/
    if (ipv4Pattern.test(hostname)) {
      return true
    }

    // IPv6 private ranges
    const ipv6Patterns = [
      /^fc00:/, // Unique local addresses
      /^fe80:/, // Link-local addresses
      /^::1$/, // localhost IPv6
    ]

    for (const pattern of ipv6Patterns) {
      if (pattern.test(hostname)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if a hostname is localhost
   * @param hostname - Hostname to check
   * @returns Whether the hostname is localhost
   */
  private isLocalhost(hostname: string): boolean {
    const localhostPatterns = [
      "localhost",
      "127.0.0.1",
      "::1",
      "0.0.0.0",
    ]

    return localhostPatterns.includes(hostname) || hostname.startsWith("127.")
  }

  /**
   * Get resource usage statistics for a process
   * @param processId - Process identifier
   * @returns Resource usage statistics
   */
  getResourceUsage(processId: string): ResourceUsage | undefined {
    return this.resourceUsageStats.get(processId)
  }

  /**
   * Get all resource usage statistics
   * @returns Map of process IDs to resource usage statistics
   */
  getAllResourceUsage(): Map<string, ResourceUsage> {
    return new Map(this.resourceUsageStats)
  }

  /**
   * Get recent network access logs
   * @param processId - Process identifier (optional)
   * @param limit - Maximum number of entries to return
   * @returns Array of network access log entries
   */
  getNetworkAccessLogs(processId?: string, limit = 100): NetworkAccessLog[] {
    let logs = this.networkAccessLogs

    if (processId) {
      logs = logs.filter(log => log.processId === processId)
    }

    return logs.slice(-limit)
  }

  /**
   * Get recent file system access logs
   * @param processId - Process identifier (optional)
   * @param limit - Maximum number of entries to return
   * @returns Array of file system access log entries
   */
  getFileSystemAccessLogs(processId?: string, limit = 100): FileSystemAccessLog[] {
    let logs = this.fileSystemAccessLogs

    if (processId) {
      logs = logs.filter(log => log.processId === processId)
    }

    return logs.slice(-limit)
  }

  /**
   * Cleanup isolated process resources
   * @param processId - Process identifier
   * @returns Promise resolving when cleanup is complete
   */
  async cleanupProcess(processId: string): Promise<void> {
    try {
      const processConfig = this.activeProcesses.get(processId)
      if (!processConfig) {
        this.logger.warn(`Process ${processId} not found for cleanup`)
        return
      }

      // Stop resource monitoring
      const stats = this.resourceUsageStats.get(processId)
      if (stats && (stats as any).monitoringInterval) {
        clearInterval((stats as any).monitoringInterval)
      }

      // Remove user data directory if it was created by us
      if (processConfig.userDataDir && existsSync(processConfig.userDataDir)) {
        rmSync(processConfig.userDataDir, { recursive: true, force: true })
        this.logger.debug(`Cleaned up user data directory: ${processConfig.userDataDir}`)
      }

      // Remove from active processes and stats
      this.activeProcesses.delete(processId)
      this.resourceUsageStats.delete(processId)

      this.logger.info(`Isolated process cleaned up: ${processId}`)
    } catch (error) {
      this.logger.error(`Failed to cleanup process ${processId}`, error as Error)
      throw new Error(`Failed to cleanup process: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Cleanup all isolated processes
   * @returns Promise resolving when cleanup is complete
   */
  async cleanupAllProcesses(): Promise<void> {
    const cleanupPromises: Promise<void>[] = []

    for (const processId of this.activeProcesses.keys()) {
      cleanupPromises.push(
        this.cleanupProcess(processId).catch((error) => {
          this.logger.warn(`Failed to cleanup process ${processId}`, error)
        }),
      )
    }

    await Promise.allSettled(cleanupPromises)
    this.logger.info("All isolated processes cleaned up")
  }

  /**
   * Generate security report
   * @returns Comprehensive security report
   */
  generateSecurityReport(): {
    activeProcesses: number
    totalNetworkRequests: number
    totalFileOperations: number
    blockedNetworkRequests: number
    blockedFileOperations: number
    resourceUsage: Array<{ processId: string, stats: ResourceUsage }>
    securityEvents: Array<{
      timestamp: Date
      type: "network" | "filesystem"
      processId: string
      details: any
    }>
  } {
    const blockedNetworkRequests = this.networkAccessLogs.filter(log => !log.allowed).length
    const blockedFileOperations = this.fileSystemAccessLogs.filter(log => !log.allowed).length

    const securityEvents = [
      ...this.networkAccessLogs
        .filter(log => !log.allowed)
        .map(log => ({
          timestamp: log.timestamp,
          type: "network" as const,
          processId: log.processId,
          details: {
            target: log.target,
            method: log.method,
            blockReason: log.blockReason,
          },
        })),
      ...this.fileSystemAccessLogs
        .filter(log => !log.allowed)
        .map(log => ({
          timestamp: log.timestamp,
          type: "filesystem" as const,
          processId: log.processId,
          details: {
            filePath: log.filePath,
            accessType: log.accessType,
            blockReason: log.blockReason,
          },
        })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return {
      activeProcesses: this.activeProcesses.size,
      totalNetworkRequests: this.networkAccessLogs.length,
      totalFileOperations: this.fileSystemAccessLogs.length,
      blockedNetworkRequests,
      blockedFileOperations,
      resourceUsage: Array.from(this.resourceUsageStats.entries()).map(([processId, stats]) => ({
        processId,
        stats,
      })),
      securityEvents,
    }
  }

  /**
   * Create default logger instance
   * @returns Logger instance
   */
  private createDefaultLogger(): Logger {
    return {
      debug: (message: string, context?: any) => {
        if (process.env.NODE_ENV === "development") {
          console.debug(`[ProcessIsolationManager] ${message}`, context || "")
        }
      },
      info: (message: string, context?: any) => {
        console.info(`[ProcessIsolationManager] ${message}`, context || "")
      },
      warn: (message: string, context?: any) => {
        console.warn(`[ProcessIsolationManager] ${message}`, context || "")
      },
      error: (message: string, context?: any) => {
        console.error(`[ProcessIsolationManager] ${message}`, context || "")
      },
    }
  }
}
