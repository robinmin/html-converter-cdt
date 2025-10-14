// @ts-check

import { defineConfig } from "@ilyasemenov/eslint-config"

export default defineConfig().append({
  files: ["**/*.{js,ts}", "**/*.md/*.{js,ts}"],
  rules: {
    "no-console": "off",
  },
})
