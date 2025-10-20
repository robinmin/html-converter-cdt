export default {
  // Run ESLint with auto-fix on staged files
  // TypeScript type checking is handled by pre-commit hook (runs on entire codebase)
  // Use explicit path to ensure local project ESLint is used (not global version)
  "*.{cjs,js,ts,json,yaml,toml}": "pnpm exec eslint --fix",
}
