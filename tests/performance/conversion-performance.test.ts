/**
 * Performance benchmark tests for HTML conversion operations
 */

import { expect, test } from "vitest"

import { ChromeCDPManager } from "../../src/core/engine/chrome-cdp-manager.js"
import { TestDataGenerators } from "../utils/test-helpers.js"

import { ConcurrencyBenchmark, PerformanceAssertions, PerformanceBenchmark } from "./utils/performance-benchmarks.js"

test.describe("HTML Conversion Performance", () => {
  let cdpManager: ChromeCDPManager

  test.beforeAll(async () => {
    cdpManager = new ChromeCDPManager({
      maxConcurrentSessions: 4,
      timeout: 60000,
    })
    await cdpManager.initialize()
  })

  test.afterAll(async () => {
    await cdpManager.shutdown()
  })

  test("pDF conversion performance benchmark @performance", async () => {
    const html = TestDataGenerators.generateComplexHTML()

    const result = await PerformanceBenchmark.benchmark(
      "pdf-conversion",
      async () => {
        return await cdpManager.convertToPDF({
          html,
          options: {
            format: "A4",
            printBackground: true,
            margin: { top: "1cm", bottom: "1cm", left: "1cm", right: "1cm" },
          },
        })
      },
      {
        iterations: 10,
        warmupIterations: 3,
        maxDuration: 5000, // 5 seconds
        maxMemory: 50 * 1024 * 1024, // 50MB
        regressionThreshold: 15, // 15%
      },
    )

    console.log(`PDF Conversion Performance:`)
    console.log(`  Mean Duration: ${result.stats.meanDuration.toFixed(2)}ms`)
    console.log(`  Median Duration: ${result.stats.medianDuration.toFixed(2)}ms`)
    console.log(`  P95: ${result.stats.p95.toFixed(2)}ms`)
    console.log(`  Peak Memory: ${(result.memoryStats.peakHeapUsed / 1024 / 1024).toFixed(2)}MB`)

    if (result.regression) {
      console.log(`  Regression: ${result.regression.percentageChange.toFixed(2)}%`)
    }

    // Performance assertions
    PerformanceAssertions.assertMaxDuration(result, 5000)
    PerformanceAssertions.assertMaxMemory(result, 50 * 1024 * 1024)
    PerformanceAssertions.assertLowVariance(result, 25)
    PerformanceAssertions.assertNoRegression(result)

    expect(result.passed).toBe(true)
  })

  test("pNG conversion performance benchmark @performance", async () => {
    const html = TestDataGenerators.generateComplexHTML()

    const result = await PerformanceBenchmark.benchmark(
      "png-conversion",
      async () => {
        return await cdpManager.convertToImage({
          html,
          options: {
            format: "png",
            fullPage: true,
            quality: 100,
          },
        })
      },
      {
        iterations: 15,
        warmupIterations: 5,
        maxDuration: 3000, // 3 seconds
        maxMemory: 30 * 1024 * 1024, // 30MB
        regressionThreshold: 20, // 20%
      },
    )

    console.log(`PNG Conversion Performance:`)
    console.log(`  Mean Duration: ${result.stats.meanDuration.toFixed(2)}ms`)
    console.log(`  Median Duration: ${result.stats.medianDuration.toFixed(2)}ms`)
    console.log(`  P95: ${result.stats.p95.toFixed(2)}ms`)
    console.log(`  Peak Memory: ${(result.memoryStats.peakHeapUsed / 1024 / 1024).toFixed(2)}MB`)

    if (result.regression) {
      console.log(`  Regression: ${result.regression.percentageChange.toFixed(2)}%`)
    }

    PerformanceAssertions.assertMaxDuration(result, 3000)
    PerformanceAssertions.assertMaxMemory(result, 30 * 1024 * 1024)
    PerformanceAssertions.assertLowVariance(result, 30)
    PerformanceAssertions.assertNoRegression(result)

    expect(result.passed).toBe(true)
  })

  test("mHTML conversion performance benchmark @performance", async () => {
    const html = TestDataGenerators.generateComplexHTML()

    const result = await PerformanceBenchmark.benchmark(
      "mhtml-conversion",
      async () => {
        return await cdpManager.convertToMHTML({
          html,
          options: {
            compress: true,
          },
        })
      },
      {
        iterations: 20,
        warmupIterations: 5,
        maxDuration: 2000, // 2 seconds
        maxMemory: 20 * 1024 * 1024, // 20MB
        regressionThreshold: 25, // 25%
      },
    )

    console.log(`MHTML Conversion Performance:`)
    console.log(`  Mean Duration: ${result.stats.meanDuration.toFixed(2)}ms`)
    console.log(`  Median Duration: ${result.stats.medianDuration.toFixed(2)}ms`)
    console.log(`  P95: ${result.stats.p95.toFixed(2)}ms`)
    console.log(`  Peak Memory: ${(result.memoryStats.peakHeapUsed / 1024 / 1024).toFixed(2)}MB`)

    if (result.regression) {
      console.log(`  Regression: ${result.regression.percentageChange.toFixed(2)}%`)
    }

    PerformanceAssertions.assertMaxDuration(result, 2000)
    PerformanceAssertions.assertMaxMemory(result, 20 * 1024 * 1024)
    PerformanceAssertions.assertLowVariance(result, 30)
    PerformanceAssertions.assertNoRegression(result)

    expect(result.passed).toBe(true)
  })

  test("concurrent conversion performance benchmark @performance", async () => {
    const html = TestDataGenerators.generateHTML({
      title: "Concurrent Test Document",
      content: "<p>Document for testing concurrent conversion performance.</p>",
      includeStyles: true,
    })

    const concurrencyLevels = [1, 2, 4, 8]

    const results = await ConcurrencyBenchmark.benchmarkConcurrency(
      "concurrent-pdf-conversion",
      async () => {
        return await cdpManager.convertToPDF({
          html,
          options: { format: "A4", printBackground: true },
        })
      },
      concurrencyLevels,
      {
        iterations: 5,
        warmupIterations: 2,
        maxDuration: 10000, // 10 seconds for concurrent operations
        maxMemory: 100 * 1024 * 1024, // 100MB for concurrent operations
        regressionThreshold: 30, // Higher threshold for concurrent
      },
    )

    console.log(`Concurrent PDF Conversion Performance:`)
    for (const { concurrency, result } of results) {
      console.log(`  Concurrency ${concurrency}: ${result.stats.meanDuration.toFixed(2)}ms avg`)
    }

    const analysis = ConcurrencyBenchmark.analyzeScalability(results)

    console.log(`Scalability Analysis:`)
    console.log(`  Is Scalable: ${analysis.isScalable}`)
    console.log(`  Throughput: ${analysis.throughput.map(t => t.toFixed(2)).join(", ")} ops/sec`)
    console.log(`  Efficiency: ${analysis.efficiency.map(e => (e * 100).toFixed(1)).join("%, ")}%`)

    if (analysis.bottlenecks.length > 0) {
      console.log(`  Bottlenecks:`)
      analysis.bottlenecks.forEach(bottleneck => console.log(`    - ${bottleneck}`))
    }

    // Assert that the system scales reasonably well
    expect(analysis.isScalable).toBe(true)
    expect(analysis.efficiency[analysis.efficiency.length - 1]).toBeGreaterThan(0.7) // 70% efficiency at highest concurrency
  })

  test("large document conversion performance @performance", async () => {
    // Generate a large HTML document
    let largeContent = ""
    for (let i = 0; i < 100; i++) {
      largeContent += `
        <section>
          <h2>Section ${i + 1}</h2>
          <p>This is paragraph ${i + 1} of the large document.</p>
          <ul>
            ${Array.from({ length: 10 }, (_, j) => `<li>List item ${j + 1}</li>`).join("")}
          </ul>
          <table>
            <thead>
              <tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr>
            </thead>
            <tbody>
              ${Array.from({ length: 5 }, (_, j) =>
                `<tr><td>Data ${i}-${j}-1</td><td>Data ${i}-${j}-2</td><td>Data ${i}-${j}-3</td></tr>`).join("")}
            </tbody>
          </table>
        </section>
      `
    }

    const largeHtml = TestDataGenerators.generateHTML({
      title: "Large Document Performance Test",
      content: largeContent,
      includeStyles: true,
    })

    const result = await PerformanceBenchmark.benchmark(
      "large-document-pdf-conversion",
      async () => {
        return await cdpManager.convertToPDF({
          html: largeHtml,
          options: {
            format: "A4",
            printBackground: true,
            margin: { top: "1cm", bottom: "1cm", left: "1cm", right: "1cm" },
          },
        })
      },
      {
        iterations: 5,
        warmupIterations: 2,
        maxDuration: 15000, // 15 seconds for large documents
        maxMemory: 200 * 1024 * 1024, // 200MB for large documents
        regressionThreshold: 20,
      },
    )

    console.log(`Large Document PDF Conversion Performance:`)
    console.log(`  Mean Duration: ${result.stats.meanDuration.toFixed(2)}ms`)
    console.log(`  Median Duration: ${result.stats.medianDuration.toFixed(2)}ms`)
    console.log(`  P95: ${result.stats.p95.toFixed(2)}ms`)
    console.log(`  Peak Memory: ${(result.memoryStats.peakHeapUsed / 1024 / 1024).toFixed(2)}MB`)

    if (result.regression) {
      console.log(`  Regression: ${result.regression.percentageChange.toFixed(2)}%`)
    }

    PerformanceAssertions.assertMaxDuration(result, 15000)
    PerformanceAssertions.assertMaxMemory(result, 200 * 1024 * 1024)
    PerformanceAssertions.assertNoRegression(result)

    expect(result.passed).toBe(true)
  })

  test("memory leak detection for repeated conversions @performance", async () => {
    const html = TestDataGenerators.generateHTML({
      title: "Memory Leak Test",
      content: "<p>Testing for memory leaks during repeated conversions.</p>",
      includeStyles: true,
    })

    const measurements: Array<{ iteration: number, memoryUsed: number }> = []

    // Run many iterations to detect memory leaks
    for (let i = 0; i < 50; i++) {
      // Force garbage collection if available
      if (globalThis.gc) {
        globalThis.gc()
      }

      await cdpManager.convertToPDF({
        html,
        options: { format: "A4", printBackground: true },
      })

      const finalMemory = process.memoryUsage().heapUsed
      measurements.push({
        iteration: i + 1,
        memoryUsed: finalMemory,
      })

      // Log every 10 iterations
      if ((i + 1) % 10 === 0) {
        console.log(`Iteration ${i + 1}: Memory usage: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`)
      }
    }

    // Analyze memory growth
    const memoryGrowth = measurements[measurements.length - 1].memoryUsed - measurements[0].memoryUsed
    const memoryGrowthPercent = (memoryGrowth / measurements[0].memoryUsed) * 100

    console.log(`Memory Leak Detection Results:`)
    console.log(`  Initial Memory: ${(measurements[0].memoryUsed / 1024 / 1024).toFixed(2)}MB`)
    console.log(`  Final Memory: ${(measurements[measurements.length - 1].memoryUsed / 1024 / 1024).toFixed(2)}MB`)
    console.log(`  Memory Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB (${memoryGrowthPercent.toFixed(1)}%)`)

    // Assert that memory growth is within reasonable bounds
    expect(memoryGrowthPercent).toBeLessThan(50) // Less than 50% growth over 50 iterations
  })

  test("different format conversion performance comparison @performance", async () => {
    const html = TestDataGenerators.generateComplexHTML()
    const formats = [
      { name: "PDF", converter: () => cdpManager.convertToPDF({ html, options: { format: "A4", printBackground: true } }) },
      { name: "PNG", converter: () => cdpManager.convertToImage({ html, options: { format: "png", fullPage: true, quality: 100 } }) },
      { name: "JPEG", converter: () => cdpManager.convertToImage({ html, options: { format: "jpeg", fullPage: true, quality: 90 } }) },
      { name: "WebP", converter: () => cdpManager.convertToImage({ html, options: { format: "webp", fullPage: true, quality: 90 } }) },
      { name: "MHTML", converter: () => cdpManager.convertToMHTML({ html, options: { compress: true } }) },
    ]

    const results: Array<{ format: string, meanDuration: number, memoryUsed: number }> = []

    for (const format of formats) {
      const result = await PerformanceBenchmark.benchmark(
        `${format.name.toLowerCase()}-conversion-comparison`,
        format.converter,
        {
          iterations: 10,
          warmupIterations: 3,
          saveResults: false, // Don't save comparison results as baselines
        },
      )

      results.push({
        format: format.name,
        meanDuration: result.stats.meanDuration,
        memoryUsed: result.memoryStats.meanHeapUsed,
      })
    }

    console.log(`Format Performance Comparison:`)
    results
      .sort((a, b) => a.meanDuration - b.meanDuration)
      .forEach((result) => {
        console.log(`  ${result.format}: ${result.meanDuration.toFixed(2)}ms avg, ${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB avg`)
      })

    // Assert that all formats complete within reasonable time
    results.forEach((result) => {
      expect(result.meanDuration).toBeLessThan(10000) // All formats under 10 seconds
    })
  })

  test("resource usage under load @performance", async () => {
    const html = TestDataGenerators.generateHTML({
      title: "Load Test Document",
      content: "<p>Document for testing resource usage under load.</p>",
      includeStyles: true,
    })

    // Simulate high load with concurrent conversions
    const concurrentPromises = Array.from({ length: 20 }, () =>
      cdpManager.convertToPDF({
        html,
        options: { format: "A4", printBackground: true },
      }))

    const startTime = Date.now()
    const startMemory = process.memoryUsage()

    const results = await Promise.all(concurrentPromises)

    const endTime = Date.now()
    const endMemory = process.memoryUsage()

    const totalTime = endTime - startTime
    const memoryUsed = endMemory.heapUsed - startMemory.heapUsed

    console.log(`Load Test Results:`)
    console.log(`  Concurrency: 20`)
    console.log(`  Total Time: ${totalTime}ms`)
    console.log(`  Average Time per Conversion: ${(totalTime / 20).toFixed(2)}ms`)
    console.log(`  Memory Used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`)
    console.log(`  Successful Conversions: ${results.filter(r => r.success).length}/20`)

    // Verify all conversions succeeded
    expect(results.every(r => r.success)).toBe(true)

    // Assert reasonable resource usage
    expect(totalTime).toBeLessThan(30000) // Under 30 seconds total
    expect(memoryUsed).toBeLessThan(150 * 1024 * 1024) // Under 150MB additional memory
  })
})
