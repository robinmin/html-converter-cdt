# Performance Testing

This directory contains performance benchmark tests for the HTML Converter CDT project.

## Overview

Performance testing ensures that conversion operations meet performance requirements and detect regressions early. This includes:

- Conversion speed benchmarks
- Memory usage monitoring
- Concurrency testing
- Scalability analysis
- Resource utilization tracking

## Structure

```
tests/performance/
├── benchmarks/              # Performance baseline data
├── reports/                 # Generated performance reports
├── utils/                   # Utility functions
│   ├── performance-benchmarks.ts
│   └── generate-report.js
├── conversion-performance.test.ts # Main performance tests
└── README.md               # This file
```

## Running Tests

### Run Performance Tests
```bash
pnpm test:performance
```

### Generate Performance Report
```bash
pnpm test:performance:report
```

### Run Specific Performance Tests
```bash
# PDF conversion performance
npx playwright test --project=performance-tests conversion-performance.test.ts --grep "PDF conversion performance"

# Concurrency testing
npx playwright test --project=performance-tests conversion-performance.test.ts --grep "concurrent"
```

## Test Categories

### Conversion Performance Benchmarks

#### PDF Conversion Performance
- **Complex HTML**: Large document conversion speed
- **Memory Usage**: Peak memory consumption tracking
- **Regression Detection**: Automatic comparison with baselines

#### Image Conversion Performance
- **Format Comparison**: PNG, JPEG, WebP performance
- **Quality Settings**: Impact of quality on performance
- **Viewport Variations**: Different viewport sizes

#### MHTML Conversion Performance
- **Compression Impact**: Effect of compression on speed
- **Large Documents**: Scalability with document size

### Concurrency Testing

#### Concurrent Operations
- **Multiple Sessions**: 1, 2, 4, 8 concurrent conversions
- **Resource Contention**: Memory and CPU usage under load
- **Scalability Analysis**: Efficiency at different concurrency levels

#### Load Testing
- **High Volume**: 20+ simultaneous conversions
- **Resource Limits**: System behavior under stress
- **Throughput Measurement**: Operations per second

### Specialized Performance Tests

#### Large Document Testing
- **Size Impact**: Performance scaling with document size
- **Memory Leaks**: Detection of memory leaks over iterations
- **Timeout Handling**: Graceful handling of long-running operations

#### Format Comparison
- **Speed Analysis**: Relative performance of different formats
- **Resource Usage**: Memory and CPU comparison
- **Quality vs Speed**: Trade-offs between quality and performance

## Performance Metrics

### Key Metrics Tracked

1. **Duration Metrics**
   - Mean duration
   - Median duration
   - 95th percentile (P95)
   - 99th percentile (P99)
   - Standard deviation

2. **Memory Metrics**
   - Mean heap used
   - Peak heap used
   - Mean heap total
   - Mean external memory

3. **Concurrency Metrics**
   - Throughput (operations/second)
   - Efficiency percentage
   - Bottleneck identification

4. **Regression Metrics**
   - Percentage change from baseline
   - Regression threshold monitoring
   - Trend analysis

### Performance Thresholds

Default performance thresholds (configurable per test):

```typescript
const thresholds = {
  maxDuration: 5000, // 5 seconds
  maxMemory: 50 * 1024 * 1024, // 50MB
  regressionThreshold: 15, // 15% regression threshold
  maxVariance: 25, // 25% variance threshold
}
```

## Benchmark Configuration

### Test Configuration Options

```typescript
const options = {
  iterations: 10, // Number of test iterations
  warmupIterations: 3, // Warmup iterations
  maxDuration: 5000, // Maximum allowed duration (ms)
  maxMemory: 50 * 1024 * 1024, // Maximum memory (bytes)
  regressionThreshold: 15, // Regression detection (%)
  saveResults: true, // Save benchmark results
  customMetrics: [] // Custom metrics to collect
}
```

### Baseline Management

Performance baselines are automatically stored in `tests/performance/benchmarks/`:

- **Automatic Creation**: Baselines created on first run
- **Regression Detection**: Automatic comparison with stored baselines
- **Version Tracking**: Baselines tied to project version
- **Update Strategy**: Manual baseline updates for intentional changes

## Performance Reports

### Generated Reports

1. **HTML Reports**: Interactive charts and analysis
2. **JSON Data**: Machine-readable performance data
3. **Trend Analysis**: Performance trends over time
4. **Regression Alerts**: Automatic regression detection

### Report Features

- **Performance Charts**: Duration and memory usage visualization
- **Distribution Analysis**: Scatter plots of performance metrics
- **Summary Statistics**: Overview of performance characteristics
- **Trend Identification**: Performance improvement/degradation trends

### Report Generation

```bash
# Generate latest performance report
pnpm test:performance:report

# Custom report generation
node tests/performance/utils/generate-report.js
```

## Performance Assertions

### Built-in Assertions

```typescript
// Duration assertions
PerformanceAssertions.assertMaxDuration(result, 5000)

// Memory assertions
PerformanceAssertions.assertMaxMemory(result, 50 * 1024 * 1024)

// Regression assertions
PerformanceAssertions.assertNoRegression(result)

// Variance assertions
PerformanceAssertions.assertLowVariance(result, 25)
```

### Custom Assertions

You can define custom performance assertions:

```typescript
class CustomPerformanceAssertions {
  static assertMinThroughput(result: BenchmarkResult, minOpsPerSec: number) {
    const throughput = 1000 / result.stats.meanDuration
    if (throughput < minOpsPerSec) {
      throw new Error(`Throughput ${throughput} below threshold ${minOpsPerSec}`)
    }
  }
}
```

## Performance Profiling

### Memory Leak Detection

The framework includes automatic memory leak detection:

```typescript
// Run many iterations to detect memory leaks
for (let i = 0; i < 50; i++) {
  await conversionOperation()
  if (globalThis.gc) {
    globalThis.gc()
  } // Force garbage collection
  measurements.push({ iteration: i + 1, memoryUsed: process.memoryUsage().heapUsed })
}

// Analyze memory growth
const memoryGrowth = measurements[measurements.length - 1].memoryUsed - measurements[0].memoryUsed
const memoryGrowthPercent = (memoryGrowth / measurements[0].memoryUsed) * 100
```

### CPU Usage Monitoring

CPU usage is tracked during benchmarks:

```typescript
const cpuUsage = process.cpuUsage()
// ... perform operation ...
const cpuUsageAfter = process.cpuUsage(cpuUsage)
```

## Troubleshooting

### Performance Degradation

1. **Check Baselines**: Compare with previous performance baselines
2. **Environment Factors**: Consider system load and resource availability
3. **Code Changes**: Review recent changes that might impact performance
4. **Memory Leaks**: Check for memory leaks in long-running tests

### Test Flakiness

1. **Consistent Environment**: Use dedicated testing environments
2. **Resource Isolation**: Ensure tests don't interfere with each other
3. **Timing Variations**: Allow for reasonable timing variations
4. **Retry Logic**: Implement appropriate retry mechanisms

### High Memory Usage

1. **Garbage Collection**: Force garbage collection between tests
2. **Memory Cleanup**: Ensure proper resource cleanup
3. **Baseline Comparison**: Compare with expected memory usage patterns
4. **Leak Detection**: Use built-in memory leak detection

## Best Practices

### Test Design

1. **Isolated Tests**: Each test should be independent
2. **Consistent Data**: Use consistent test data across runs
3. **Warmup Periods**: Include warmup iterations
4. **Multiple Metrics**: Measure multiple performance aspects

### Performance Thresholds

1. **Realistic Limits**: Set thresholds based on real requirements
2. **Environment Considerations**: Account for testing environment differences
3. **Regular Reviews**: Review and update thresholds periodically
4. **Gradual Changes**: Make gradual threshold adjustments

### Continuous Integration

1. **Performance Gates**: Include performance checks in CI/CD
2. **Baseline Updates**: Regular baseline maintenance
3. **Regression Alerts**: Automated regression notifications
4. **Performance Trends**: Track performance over time

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Run Performance Tests
  run: pnpm test:performance

- name: Generate Performance Report
  run: pnpm test:performance:report

- name: Upload Performance Artifacts
  uses: actions/upload-artifact@v3
  with:
    name: performance-reports
    path: tests/performance/reports/

- name: Performance Comment
  if: failure()
  uses: actions/github-script@v6
  with:
    script: |
      // Add performance regression comment to PR
```

### Environment Variables

- `PERFORMANCE_DEBUG`: Enable detailed performance logging
- `GENERATE_REPORTS`: Auto-generate reports after tests
- `UPDATE_BASELINES`: Update performance baselines
- `PERFORMANCE_THRESHOLD`: Custom performance threshold multiplier

## Future Enhancements

Potential improvements to consider:

1. **Advanced Profiling**: Integration with profilers like clinic.js
2. **Cloud Testing**: Performance testing across different cloud providers
3. **Load Testing Tools**: Integration with dedicated load testing tools
4. **Real-time Monitoring**: Continuous performance monitoring
5. **Machine Learning**: AI-powered performance anomaly detection
