# AI Agent Collaboration Guide

## Document Information
- **Project**: html-converter-cdt v2.0
- **Purpose**: Essential guidelines for AI agents collaborating on this project
- **Last Updated**: 2025-10-14
- **Repository**: https://github.com/robinmin/html-converter-cdt

---

## Key Principles

**ALL agents MUST follow these principles before and during any work:**

### 0. **Philosophical Principles for All**
- ✅ **KISS**: Keep It Simple, Stupid
- ✅ **YAGNI**: You Aren't Gonna Need It
- ✅ **Occam's Razor**: Entities should not be multiplied beyond necessity
- ✅ **Solid Principles (SOLID):**
  - ✅ **S (Single Responsibility):** Each entity(Including but not limited to component, class, or function) should have only one well-defined responsibility.
  - ✅ **O (Open/Closed):** Extend functionality without modifying existing code.
  - ✅ **L (Liskov Substitution Principle):** Subtypes should seamlessly replace their base types.
  - ✅ **I (Interface Segregation):** Interfaces should be specialized, avoiding “fat interfaces.”
  - ✅ **D (Dependency Inversion):** Depend on abstractions, not concrete implementations.
- ✅ **DRY**: Don't Repeat Yourself
- ✅ **Integrity**: Abandon flattery, maintain integrity, and speak the truth

### 1. **Documentation First**
- Read `docs/prd-v2.md` and `docs/fsd-v2.md` BEFORE starting any task
- Understand context from existing code and related issues
- When in doubt, ask clarifying questions

### 2. **Task Management (task-master)**
**Required workflow:**
- Update task status to `wip` when starting work
- Update task status to `finished` when successfully completed
- Add notes/blockers if encountered

### 3. **Code Quality Non-Negotiables**
- TypeScript strict mode - no implicit `any`
- Every public API must have JSDoc with examples
- Structured errors only (use `ConversionError` with error codes)
- Always clean up resources (CDP connections, temp files) in `finally` blocks
- Write tests alongside code, not after

### 4. **Security First**
- **NEVER** use `--no-sandbox` flag for Chrome
- **ALWAYS** sanitize file paths (prevent path traversal)
- **ALWAYS** validate inputs before processing
- Use secure temp directories with proper permissions

### 5. **Pattern Consistency**
- Follow existing patterns in the codebase
- Don't refactor unnecessarily - focus on the task
- Reuse existing utilities instead of creating new ones
- Leave code better than you found it (Boy Scout Rule)

### 6. **Performance & Memory**
- Chrome extensions have ~50MB heap limit
- Use streams for files >10MB
- Always close CDP connections
- Use `Promise.all()` for parallel independent operations

### 7. **Error Handling Strategy**
- Use error codes: `NETWORK_ERROR`, `TIMEOUT`, `INVALID_INPUT`, `CDP_ERROR`, `RESOURCE_ERROR`, `UNKNOWN`
- Implement retry logic with exponential backoff for network operations
- Provide actionable error messages with context

### 8. **Testing Requirements**
- Unit tests: >90% coverage
- Integration tests: >80% coverage
- Test error paths and edge cases
- Regression test for every fixed bug

### 9. **Avoid to use git/gh commands**
- 🚫: Never using all other git commands except `git diff` and `git log`.

---

## ⚙️ MCP Integration

### Context7 (Library Documentation)
**Use for external library documentation and code examples:**

```bash
# Resolve library ID first
mcp context7 resolve-library-id <library-name>

# Get library documentation
mcp context7 get-library-docs <context7-library-id> --topic <topic>
```

**When to use:**
- Looking up API documentation for external libraries
- Finding code examples and usage patterns
- Understanding third-party library configurations
- Verifying latest library features and updates

**Required integration points:**
- **Start of task**: Update to `wip` before any code changes
- **During work**: Add progress notes and blockers
- **End of task**: Update to `finished` with completion summary
- **Code review**: Verify task status updated in checklist

---

## Essential Commands

### Development
```bash
pnpm install              # Install dependencies
pnpm test                # Run all tests
pnpm test --coverage     # Run tests with coverage report
pnpm test --watch        # Run tests in watch mode
pnpm test <file>         # Run specific test file
pnpm build               # Build library for production
pnpm lint                # Lint and fix code
```

### Task Management
```bash
tm status <id> --status wip        # Start working on task
tm update <id> "note"              # Add progress note
tm status <id> --status finished   # Mark task complete
tm next                            # Get next available task
tm get <id>                        # Get task details
```

### Git Workflow
```bash
git checkout -b feat/description   # Create feature branch
git checkout -b fix/description    # Create bugfix branch
git commit -m "type(scope): msg"   # Conventional commit
git push origin <branch-name>      # Push to remote
```

### Debugging
```bash
node --prof vitest run                    # Profile Node.js
node --prof-process isolate-*.log > profile.txt  # Process profile
node --inspect-brk your-script.js        # Debug with DevTools
```

### Dependency Management
```bash
pnpm outdated            # Check for outdated packages
pnpm update <package>    # Update specific package
pnpm update              # Update all packages
```

---

## Project Overview

**html-converter-cdt** is a TypeScript library converting HTML to multiple formats (MHTML, PDF, PNG, JPEG, Markdown, DOCX) using Chrome DevTools Protocol (CDP). Works in both Node.js and Chrome extensions without Playwright/Puppeteer.

### Core Goals
1. **Simplicity**: <3 lines of code for basic conversions
2. **Reliability**: >99.9% success rate
3. **Performance**: <2s for typical conversions (P95)
4. **Extensibility**: Easy to add formats/environments
5. **Developer Experience**: Comprehensive docs and intuitive APIs

### Prerequisites
- Node.js ≥18.0.0 (ESM required)
- pnpm ≥10.14.0
- Chrome/Chromium ≥90
- TypeScript ≥5.0

### Project Structure
```
src/
  core/         # Conversion engine and context
  converters/   # Format-specific converters
  adapters/     # CDP environment abstractions
  services/     # Shared utilities
  types/        # TypeScript definitions
docs/
  prd-v2.md    # Product Requirements Document
  fsd-v2.md    # Functional Specification Document
  AGENTS.md    # This file
tests/          # Test suites
examples/       # Usage examples
```

---

## Architecture Essentials

### Layered Architecture
| Layer | Responsibility | Location |
|-------|----------------|----------|
| Interface | API/CLI entry points | Public APIs, CLI |
| Core | Business logic, orchestration | `src/core/` |
| Services | Shared utilities | `src/services/` |
| Converters | Format-specific logic | `src/converters/` |
| CDP | Chrome protocol abstraction | `src/adapters/` |

### Design Patterns
- **Strategy**: Format converters (`src/converters/*`)
- **Factory**: Converter instantiation (`src/core/engine/`)
- **Adapter**: CDP abstraction (`src/adapters/*`)
- **Singleton**: Logger, Config (`src/core/utils/`)

### Core Interfaces
```typescript
// CDP Manager
interface CDPManager {
  connect(): Promise<void>
  disconnect(): Promise<void>
  execute<T>(command: string, params: any): Promise<T>
  getEnvironment(): "node" | "extension"
}

// Converter
interface Converter {
  convert(input: ConversionInput, options: FormatOptions): Promise<ConversionResult>
  validate(options: FormatOptions): void
  cleanup(): Promise<void>
}
```

### Data Flow
Input Processing → Dependency Detection → MHTML Caching (if needed) → Format Conversion → Post-Processing → Cleanup

---

## Coding Standards

### TypeScript
- **Strict types**: No implicit `any`, use explicit types
- **Interfaces** for object shapes, **type aliases** for unions/primitives
- **Null safety**: Use optional chaining (`?.`) and nullish coalescing (`??`)

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `pdf-converter.ts` |
| Classes/Interfaces | PascalCase | `PDFConverter`, `ConversionOptions` |
| Functions | camelCase | `convertToPDF()` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT` |
| Private fields | _camelCase | `_cdpManager` |

### File Organization
```typescript
// 1. Imports (external, internal, types)
import { readFile } from "node:fs/promises"

import { CDPManager } from "@/adapters/cdp-manager"
import type { ConversionOptions } from "@/types"

// 2. Constants
const DEFAULT_TIMEOUT = 30000

// 3. Types/Interfaces
interface LocalOptions extends ConversionOptions { /* ... */ }

// 4. Main implementation
export class Converter { /* ... */ }

// 5. Utility functions
function validateOptions(options: LocalOptions): void { /* ... */ }
```

### Error Handling Pattern
```typescript
class ConversionError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any,
  ) {
    super(message)
    this.name = "ConversionError"
    this.timestamp = new Date().toISOString()
  }
}

// Usage
throw new ConversionError("NETWORK_ERROR", "Failed to fetch URL", { url, statusCode })
```

### Resource Cleanup Pattern
```typescript
import { Buffer } from "node:buffer"

async function convert(): Promise<Buffer> {
  const cdp = await createCDPManager()
  try {
    await cdp.connect()
    return await performConversion(cdp)
  } finally {
    await cdp.disconnect() // Always cleanup
    await cleanupTempFiles()
  }
}
```

### Documentation Requirements
```typescript
/**
 * Converts HTML to PDF with customizable options.
 *
 * @param input - HTML file path, URL, or raw HTML
 * @param options - PDF options (page size, margins, etc.)
 * @returns Conversion result with buffer and metadata
 * @throws {ConversionError} If conversion fails
 *
 * @example
 * ```typescript
 * const result = await convertToPDF('https://example.com', {
 *   pageSize: 'A4',
 *   margins: { top: 20, bottom: 20 }
 * })
 * ```
 */
export async function convertToPDF(
  input: string,
  options?: PDFOptions,
): Promise<ConversionResult>
```

---

## Testing Strategy

### Coverage Targets
| Type | Target | Framework | Location |
|------|--------|-----------|----------|
| Unit | >90% | Vitest | `src/**/*.test.ts` |
| Integration | >80% | Vitest | `tests/integration/` |
| E2E | Key workflows | Vitest | `tests/e2e/` |

### Test Structure
```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest"

describe("ComponentName", () => {
  let component: Component
  let mockDependency: Dependency

  beforeEach(() => {
    mockDependency = createMock()
    component = new Component(mockDependency)
  })

  afterEach(async () => {
    await component.cleanup()
  })

  describe("methodName", () => {
    it("should handle normal case", async () => {
      // Test implementation
    })

    it("should throw on error condition", async () => {
      await expect(component.method()).rejects.toThrow(ConversionError)
    })
  })
})
```

---

## Git Workflow

### Branch Naming
- `feat/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation
- `test/description` - Tests

### Commit Message Format (Conventional Commits)
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

**Example**:
```
feat(pdf): add custom header/footer support

Implement HTML-based header/footer templates.
Supports dynamic content via template variables.

Closes #42
```

### Code Review Checklist
- [ ] All tests pass
- [ ] Linter passes
- [ ] No TypeScript errors
- [ ] Documentation updated
- [ ] Task status updated in task-master
- [ ] No breaking changes (or documented)

---

## Key Technical Patterns

### CDP Connection Management
```typescript
// Always use try-finally
async function performConversion() {
  const cdp = await CDPManager.create()
  try {
    await cdp.connect()
    return await convert(cdp)
  } finally {
    await cdp.disconnect() // Always disconnect
  }
}

// Environment detection
const environment = typeof chrome !== "undefined" && chrome.debugger
  ? "extension"
  : "node"
```

### MHTML Caching Strategy
```typescript
function shouldUseMHTML(html: string): boolean {
  return /https?:\/\//.test(html)
    || /<link[^>]*href=["']https?:\/\//.test(html)
    || /<img[^>]*src=["']https?:\/\//.test(html)
}
```

### Memory Management (Chrome Extensions)
```typescript
if (environment === "extension") {
  const MAX_BUFFER_SIZE = 10 * 1024 * 1024 // 10MB
  if (buffer.length > MAX_BUFFER_SIZE) {
    throw new ConversionError(
      "RESOURCE_ERROR",
      "File too large for Chrome extension environment",
    )
  }
}
```

### Retry Logic Pattern
```typescript
async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  let lastError: Error
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url)
    } catch (error) {
      lastError = error
      await sleep(2 ** i * 1000) // Exponential backoff
    }
  }
  throw new ConversionError("NETWORK_ERROR", "Max retries exceeded", { url })
}
```

### Security Requirements
```typescript
// ✅ GOOD: Always use sandbox
const chrome = spawn("chrome", ["--headless", "--disable-gpu"])

// ❌ BAD: Never disable sandbox
const chrome = spawn("chrome", ["--no-sandbox"]) // FORBIDDEN

// Path sanitization
function sanitizePath(input: string): string {
  const normalized = path.normalize(input)
  if (normalized.includes("..")) {
    throw new ConversionError("INVALID_INPUT", "Path traversal detected")
  }
  return normalized
}
```

---

## Common Workflows

### Adding a New Format Converter
1. Create converter class in `src/converters/`
2. Implement `Converter` interface
3. Add format types in `src/types/`
4. Export from `src/index.ts`
5. Write tests (unit + integration)
6. Update documentation + examples
7. Update task status in task-master

### Fixing a Bug
1. Update task status: `tm status <id> --status wip`
2. Create branch: `git checkout -b fix/bug-description`
3. Write failing test that reproduces bug
4. Fix the bug
5. Ensure test passes
6. Add regression test
7. Commit: `fix(scope): description`
8. Update task: `tm status <id> --status finished`
9. Create PR

---

## Troubleshooting

### Common Issues

**"Chrome not found"**
```bash
# macOS: brew install chromium
# Linux: sudo apt-get install chromium-browser
export CHROME_PATH=/path/to/chrome
```

**"CDP connection timeout"**
```typescript
const result = await convertToPDF(input, { verbose: true })
```

**"Memory leak in tests"**
```typescript
afterEach(async () => {
  await cdp?.disconnect()
  await cleanupTempFiles()
})
```

**"MHTML resources not loading"**
```typescript
const result = await convertToPDF(input, { captureNetworkLog: true })
console.log(result.metadata.networkLog)
```

### Debugging Tools
```typescript
// Enable debug logging
import { setLogLevel } from "html-converter-cdt"

setLogLevel("debug")

// Custom logger
const logger = {
  info: console.log,
  error: console.error,
  debug: (msg, meta) => {
    if (meta?.cdpCommand) {
      console.log("CDP:", meta.cdpCommand)
    }
  },
}
const result = await convertToPDF(input, { logger })

// Save intermediate files
const result = await convertToPDF(input, { keepIntermediateFiles: true })
console.log("MHTML path:", result.metadata.mhtmlPath)
```

---

## Agent Communication Protocol

### When Starting a Task
1. Read `docs/prd-v2.md` and `docs/fsd-v2.md`
2. Update task status to `wip` in task-master
3. Understand context (issues, existing implementations)
4. Plan approach (design, testing, documentation)
5. Ask clarifying questions if unclear

### During Work
- Explain reasoning in commit messages
- Document non-obvious decisions in comments
- Update relevant docs immediately
- Add TODOs with context for future work
- Update task with progress notes

### When Completing Tasks
- Update task status to `finished` in task-master
- Add completion notes with key details
- Ensure all tests pass
- Update documentation
- Create PR with checklist

---

## Quick Reference

### Important Constants
```typescript
DEFAULT_TIMEOUT = 30000 // 30 seconds
CDP_CONNECT_TIMEOUT = 10000 // 10 seconds
MAX_TEMP_FILES = 100
MAX_BUFFER_SIZE_EXTENSION = "10MB" // 10 MB
MAX_RETRIES = 3
BACKOFF_MULTIPLIER = 2
```

### Error Codes
- `NETWORK_ERROR`: Remote URL fetch failed
- `TIMEOUT`: Operation exceeded timeout
- `INVALID_INPUT`: Malformed input or options
- `CDP_ERROR`: Chrome protocol communication failed
- `RESOURCE_ERROR`: External resource loading failed
- `UNKNOWN`: Unexpected error

### File Locations
| What | Where |
|------|-------|
| Public APIs | `src/index.ts` |
| Converters | `src/converters/` |
| Types | `src/types/` |
| Tests | `src/**/*.test.ts`, `tests/` |
| Examples | `examples/` |
| Docs | `docs/` |

---

**Remember**: Focus on simplicity, performance, and developer experience. When in doubt, refer to PRD/FSD for direction. Always update task status in task-master when starting and completing work. Follow YAGNI, KISS, DRY principles ruthlessly.
