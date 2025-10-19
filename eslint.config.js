// @ts-check

import { defineConfig } from "@ilyasemenov/eslint-config"

export default defineConfig({
  ignores: ["**/*.md"],
}).append({
  files: ["**/*.{js,ts,cjs}"],
  rules: {
    "no-console": "off",
  },
})
