import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    pool: "threads",
    define: {
      "process.env.NODE_ENV": JSON.stringify("test"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.config.*",
        "**/*.d.ts",
        "dist/",
        "coverage/",
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
    include: [
      "src/**/*.test.ts",
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
    exclude: [
      "node_modules/",
      "dist/",
      "coverage/",
      "tests/visual/**/*.test.ts",
      "tests/performance/**/*.test.ts",
      "tests/e2e/**/*.test.ts",
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
