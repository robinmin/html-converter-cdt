import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  entry: ["src/index.ts", "src/cli/index.ts"],
  format: ["cjs", "esm"],
  sourcemap: true,
  dts: true,
  cli: {
    entry: "src/cli/index.ts",
    target: "node14",
    format: "cjs",
  },
})
