#!/usr/bin/env node

/**
 * Performance report generator
 *
 * This script reads performance benchmark data and generates HTML reports
 * with charts and analysis of performance trends.
 */

const fs = require("node:fs")
const path = require("node:path")
const process = require("node:process")

function generatePerformanceReport() {
  const benchmarksDir = path.join(process.cwd(), "tests", "performance", "benchmarks")
  const reportsDir = path.join(process.cwd(), "tests", "performance", "reports")

  // Ensure reports directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }

  // Read all benchmark files
  const benchmarkFiles = fs.readdirSync(benchmarksDir)
    .filter(file => file.endsWith(".json"))

  const benchmarks = []

  for (const file of benchmarkFiles) {
    try {
      const content = fs.readFileSync(path.join(benchmarksDir, file), "utf-8")
      const data = JSON.parse(content)
      benchmarks.push({
        name: file.replace(".json", ""),
        ...data,
      })
    } catch (error) {
      console.warn(`Failed to read benchmark file ${file}:`, error.message)
    }
  }

  // Sort benchmarks by name
  benchmarks.sort((a, b) => a.name.localeCompare(b.name))

  // Generate HTML report
  const htmlReport = generateHTMLReport(benchmarks)
  const reportPath = path.join(reportsDir, `performance-report-${new Date().toISOString().split("T")[0]}.html`)

  fs.writeFileSync(reportPath, htmlReport)
  console.log(`Performance report generated: ${reportPath}`)

  // Also generate latest report
  const latestPath = path.join(reportsDir, "latest-performance-report.html")
  fs.writeFileSync(latestPath, htmlReport)
  console.log(`Latest performance report: ${latestPath}`)

  return reportPath
}

function generateHTMLReport(benchmarks) {
  const timestamp = new Date().toLocaleString()

  // Calculate summary statistics
  const summary = {
    totalBenchmarks: benchmarks.length,
    averageDuration: benchmarks.reduce((sum, b) => sum + (b.stats?.meanDuration || 0), 0) / benchmarks.length,
    slowestBenchmark: benchmarks.reduce((slowest, b) =>
      (b.stats?.meanDuration || 0) > (slowest.stats?.meanDuration || 0) ? b : slowest, benchmarks[0]),
    fastestBenchmark: benchmarks.reduce((fastest, b) =>
      (b.stats?.meanDuration || 0) < (fastest.stats?.meanDuration || Infinity) ? b : fastest, benchmarks[0]),
    averageMemory: benchmarks.reduce((sum, b) => sum + (b.memoryStats?.meanHeapUsed || 0), 0) / benchmarks.length,
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Converter CDT - Performance Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        .header {
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 2.5em;
        }
        .header .timestamp {
            color: #7f8c8d;
            font-size: 0.9em;
            margin-top: 5px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 1.1em;
            opacity: 0.9;
        }
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
            margin: 0;
        }
        .summary-card .unit {
            font-size: 0.8em;
            opacity: 0.8;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #2c3e50;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .chart-container {
            position: relative;
            height: 400px;
            margin-bottom: 30px;
        }
        .benchmark-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .benchmark-table th,
        .benchmark-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        .benchmark-table th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }
        .benchmark-table tr:hover {
            background-color: #f8f9fa;
        }
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .status-passed {
            background-color: #d4edda;
            color: #155724;
        }
        .status-failed {
            background-color: #f8d7da;
            color: #721c24;
        }
        .performance-warning {
            background-color: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #ffc107;
        }
        .performance-good {
            background-color: #d1ecf1;
            color: #0c5460;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #17a2b8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>HTML Converter CDT - Performance Report</h1>
            <div class="timestamp">Generated on ${timestamp}</div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Benchmarks</h3>
                <div class="value">${summary.totalBenchmarks}</div>
                <div class="unit">tests</div>
            </div>
            <div class="summary-card">
                <h3>Average Duration</h3>
                <div class="value">${summary.averageDuration.toFixed(2)}</div>
                <div class="unit">milliseconds</div>
            </div>
            <div class="summary-card">
                <h3>Average Memory</h3>
                <div class="value">${(summary.averageMemory / 1024 / 1024).toFixed(2)}</div>
                <div class="unit">MB</div>
            </div>
            <div class="summary-card">
                <h3>Slowest Test</h3>
                <div class="value">${summary.slowestBenchmark?.name || "N/A"}</div>
                <div class="unit">${(summary.slowestBenchmark?.stats?.meanDuration || 0).toFixed(2)}ms</div>
            </div>
        </div>

        ${summary.averageDuration > 5000
          ? `
        <div class="performance-warning">
            <strong>⚠️ Performance Warning:</strong> Average test duration is above 5 seconds. Consider optimizing test performance.
        </div>
        `
          : `
        <div class="performance-good">
            <strong>✅ Performance Good:</strong> Average test duration is within acceptable limits.
        </div>
        `}

        <div class="section">
            <h2>Performance Overview</h2>
            <div class="chart-container">
                <canvas id="durationChart"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="memoryChart"></canvas>
            </div>
        </div>

        <div class="section">
            <h2>Detailed Benchmark Results</h2>
            <table class="benchmark-table">
                <thead>
                    <tr>
                        <th>Benchmark Name</th>
                        <th>Mean Duration (ms)</th>
                        <th>Median (ms)</th>
                        <th>P95 (ms)</th>
                        <th>Std Dev (ms)</th>
                        <th>Memory (MB)</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${benchmarks.map(benchmark => `
                        <tr>
                            <td><strong>${benchmark.name}</strong></td>
                            <td>${(benchmark.stats?.meanDuration || 0).toFixed(2)}</td>
                            <td>${(benchmark.stats?.medianDuration || 0).toFixed(2)}</td>
                            <td>${(benchmark.stats?.p95 || 0).toFixed(2)}</td>
                            <td>${(benchmark.stats?.stdDeviation || 0).toFixed(2)}</td>
                            <td>${((benchmark.memoryStats?.meanHeapUsed || 0) / 1024 / 1024).toFixed(2)}</td>
                            <td>
                                <span class="status-badge ${benchmark.passed !== false ? "status-passed" : "status-failed"}">
                                    ${benchmark.passed !== false ? "PASSED" : "FAILED"}
                                </span>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Performance Analysis</h2>
            <div class="chart-container">
                <canvas id="distributionChart"></canvas>
            </div>
        </div>
    </div>

    <script>
        // Performance data
        const benchmarkData = ${JSON.stringify(benchmarks, null, 2)};

        // Duration Chart
        const durationCtx = document.getElementById('durationChart').getContext('2d');
        new Chart(durationCtx, {
            type: 'bar',
            data: {
                labels: benchmarkData.map(b => b.name),
                datasets: [{
                    label: 'Mean Duration (ms)',
                    data: benchmarkData.map(b => b.stats?.meanDuration || 0),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Duration (ms)'
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Benchmark Duration Comparison'
                    }
                }
            }
        });

        // Memory Chart
        const memoryCtx = document.getElementById('memoryChart').getContext('2d');
        new Chart(memoryCtx, {
            type: 'bar',
            data: {
                labels: benchmarkData.map(b => b.name),
                datasets: [{
                    label: 'Mean Memory Usage (MB)',
                    data: benchmarkData.map(b => (b.memoryStats?.meanHeapUsed || 0) / 1024 / 1024),
                    backgroundColor: 'rgba(118, 75, 162, 0.8)',
                    borderColor: 'rgba(118, 75, 162, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Memory Usage (MB)'
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Memory Usage Comparison'
                    }
                }
            }
        });

        // Distribution Chart
        const distributionCtx = document.getElementById('distributionChart').getContext('2d');
        new Chart(distributionCtx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Performance Distribution',
                    data: benchmarkData.map(b => ({
                        x: b.stats?.meanDuration || 0,
                        y: (b.memoryStats?.meanHeapUsed || 0) / 1024 / 1024,
                        label: b.name
                    })),
                    backgroundColor: 'rgba(23, 162, 184, 0.8)',
                    borderColor: 'rgba(23, 162, 184, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Duration (ms)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Memory Usage (MB)'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Performance Distribution (Duration vs Memory)'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const point = context.raw;
                                return \`\${point.label}: \${point.x.toFixed(2)}ms, \${point.y.toFixed(2)}MB\`;
                            }
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>
  `
}

// Run the report generator
if (require.main === module) {
  try {
    generatePerformanceReport()
    process.exit(0)
  } catch (error) {
    console.error("Failed to generate performance report:", error)
    process.exit(1)
  }
}

module.exports = { generatePerformanceReport }
