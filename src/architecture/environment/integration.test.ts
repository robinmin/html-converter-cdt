import { describe, expect, it } from "vitest"

import { EnvironmentDetector } from "./EnvironmentDetector"
import {
  getBrowserName,
  getEnvironmentSummary,
  getOperatingSystem,
  getUserAgent,
  isBrowser,
  isBrowserLike,
  isCDPAvailable,
  isDevelopment,
  isHeadlessBrowser,
  isNode,
  isProduction,
  isServiceWorker,
  isSSR,
  isTest,
  isWebWorker,
  supportsCanvas,
  supportsFetch,
  supportsWebWorkers,
} from "./utils"

describe("environment Detection Integration", () => {
  it("should create EnvironmentDetector instance", () => {
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }

    const detector = new EnvironmentDetector(mockLogger)
    expect(detector).toBeDefined()
    expect(typeof detector.detectRuntime).toBe("function")
    expect(typeof detector.getEnvironmentInfo).toBe("function")
  })

  it("should detect runtime environment", () => {
    const runtime = isBrowser()
      ? "browser"
      : isNode()
        ? "node"
        : isWebWorker()
          ? "web-worker"
          : isServiceWorker()
            ? "service-worker"
            : "unknown"

    expect(typeof runtime).toBe("string")
    expect(["browser", "node", "web-worker", "service-worker", "unknown"]).toContain(runtime)
  })

  it("should detect environment type", () => {
    const isDev = isDevelopment()
    const isTestEnv = isTest()
    const isProd = isProduction()

    // Should be one of these environments
    const envCount = [isDev, isTestEnv, isProd].filter(Boolean).length
    expect(envCount).toBeGreaterThanOrEqual(1)
  })

  it("should get user agent information", () => {
    const userAgent = getUserAgent()
    expect(typeof userAgent).toBe("string")
    expect(userAgent.length).toBeGreaterThan(0)

    const browserName = getBrowserName()
    expect(typeof browserName).toBe("string")
    expect(browserName.length).toBeGreaterThan(0)
  })

  it("should detect headless browser status", () => {
    const isHeadless = isHeadlessBrowser()
    expect(typeof isHeadless).toBe("boolean")
  })

  it("should detect CDP availability", () => {
    const hasCDP = isCDPAvailable()
    expect(typeof hasCDP).toBe("boolean")
  })

  it("should get operating system information", () => {
    const os = getOperatingSystem()
    expect(typeof os).toBe("string")
    expect(os.length).toBeGreaterThan(0)
  })

  it("should detect SSR context", () => {
    const ssr = isSSR()
    expect(typeof ssr).toBe("boolean")
  })

  it("should provide environment summary", () => {
    const summary = getEnvironmentSummary()
    expect(summary).toBeDefined()
    expect(typeof summary.runtime).toBe("string")
    expect(typeof summary.browser).toBe("string")
    expect(typeof summary.os).toBe("string")
    expect(typeof summary.isHeadless).toBe("boolean")
    expect(typeof summary.hasCDP).toBe("boolean")
    expect(typeof summary.environment).toBe("string")
  })

  it("should detect basic features", () => {
    // These should not throw errors
    expect(() => {
      supportsCanvas()
      supportsWebWorkers()
      supportsFetch()
    }).not.toThrow()

    // Return types should be boolean
    expect(typeof supportsCanvas()).toBe("boolean")
    expect(typeof supportsWebWorkers()).toBe("boolean")
    expect(typeof supportsFetch()).toBe("boolean")
  })

  it("should detect browser-like environment", () => {
    const browserLike = isBrowserLike()
    expect(typeof browserLike).toBe("boolean")
  })

  it("should get complete environment info from detector", () => {
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }

    const detector = new EnvironmentDetector(mockLogger)
    const envInfo = detector.getEnvironmentInfo({ cache: false })

    expect(envInfo).toBeDefined()
    expect(envInfo.runtime).toBeDefined()
    expect(envInfo.features).toBeDefined()
    expect(envInfo.ssr).toBeDefined()
    expect(envInfo.timestamp).toBeInstanceOf(Date)
  })
})
