// @ts-check

import { defineConfig } from "@ilyasemenov/eslint-config"

export default defineConfig({
  ignores: ["**/*.md"],
}).append({
  files: ["**/*.{js,ts,cjs}"],
  rules: {
    "no-console": "off",
    // Disable unicorn/error-message due to incompatibility with current ESLint version
    // See: https://github.com/sindresorhus/eslint-plugin-unicorn/issues/2497
    "unicorn/error-message": "off",
  },
})
