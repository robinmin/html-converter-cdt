# Product Requirements Document: html-converter-cdt v2.0

## Document Information
- **Product Name**: html-converter-cdt
- **Version**: 2.0
- **Date**: 2025-10-14
- **Status**: Approved
- **Author**: Robin Min
- **Reviewers**: Engineering Team

---

## 1. Executive Summary

**html-converter-cdt** is a TypeScript library that converts HTML content into multiple formats (MHTML, PDF, PNG, JPEG, Markdown, DOCX) using Chrome DevTools Protocol (CDP). It serves as a foundational dependency for both Node.js applications and Chrome extensions, eliminating the need for Playwright or Puppeteer while maintaining cross-platform compatibility.

### Value Proposition
- **Zero Native Dependencies**: Pure JavaScript/TypeScript implementation for maximum portability
- **Dual Environment Support**: Works in both Node.js and Chrome extension contexts
- **Resource Intelligence**: Automatically manages external dependencies via MHTML caching
- **Production Ready**: Comprehensive error handling, retry logic, and security hardening

---

## 2. Product Vision & Goals

### Vision
Become the de facto standard library for HTML-to-format conversion in JavaScript/TypeScript ecosystems, particularly for automated workflows and browser extensions.

### Primary Goals
1. **Simplicity**: < 3 lines of code for basic conversions
2. **Reliability**: > 99.9% success rate for well-formed HTML
3. **Performance**: < 2s for typical page conversions (P95)
4. **Extensibility**: Easy to add new formats or environments
5. **Developer Experience**: Comprehensive documentation and intuitive APIs

---

## 3. Target Users & Use Cases

### User Personas

| Persona | Needs | Pain Points |
|---------|-------|-------------|
| **Backend Developer** | PDF reports, automated documentation | Heavy dependencies, complex setup |
| **Extension Developer** | Browser-based conversions | No good CDP-based libraries |
| **DevOps Engineer** | CI/CD report generation | Docker compatibility issues |
| **Content Creator** | Web archiving, offline reading | Missing resources in saved files |
| **QA Engineer** | Test report generation | Inconsistent rendering across tools |

### Key Use Cases

1. **Automated Report Generation** (NEW)
   - Test reports, analytics dashboards, business intelligence
   - CI/CD pipelines generating PDFs from HTML reports

2. **Web Archiving**
   - Complete page preservation with all assets
   - MHTML export for long-term storage

3. **Documentation Publishing**
   - Convert HTML docs to PDF, Markdown, or DOCX
   - Support for technical documentation workflows

4. **Content Export**
   - Browser extension for "Save as..." functionality
   - Batch conversion of web content

5. **Screenshot & Image Generation**
   - Automated thumbnails and previews
   - Social media card generation

---

## 4. Functional Requirements

### 4.1 Core Conversion Formats

| Format | Priority | Use Case | Key Options |
|--------|----------|----------|-------------|
| **MHTML** | P0 | Web archiving, intermediate storage | N/A |
| **PDF** | P0 | Reports, documentation | Page size, margins, layout modes |
| **PNG** | P0 | Screenshots, thumbnails | Quality, viewport, full-page |
| **JPEG** | P0 | Photos, optimized images | Quality, compression |
| **Markdown** | P0 | Documentation, version control | Image handling, GFM support |
| **DOCX** | P0 | Editable documents | Style preservation, layout |

### 4.2 Input Sources

- **Local Files**: Absolute and relative file paths
- **Remote URLs**: HTTP/HTTPS with retry logic
- **HTML Strings**: Direct HTML content (programmatic only)
- **stdin**: Command-line piping support (NEW)

### 4.3 Layout Modes

| Mode | Description | Formats |
|------|-------------|---------|
| **Standard** | Normal pagination with breaks | PDF, PNG, JPEG, DOCX |
| **Single-Page** | One continuous page | PDF, PNG, JPEG |
| **Auto-Page** (Future) | Explicit page break markers | PDF, DOCX |

### 4.4 Resource Management

- **Intelligent Detection**: Automatically identify external dependencies (CSS, JS, images, fonts)
- **MHTML Caching**: Generate intermediate MHTML for deterministic conversions
- **Cleanup**: Automatic temp file removal with graceful error handling
- **Retry Logic**: Configurable retry with exponential backoff for poor network conditions

### 4.5 API Requirements

#### Programmatic API

```typescript
function convertToMHTML(input: any, options?: any): ConversionResult
function convertToPDF(input: any, options?: any): ConversionResult
function convertToPNG(input: any, options?: any): ConversionResult
function convertToJPEG(input: any, options?: any): ConversionResult
function convertToMarkdown(input: any, options?: any): ConversionResult
function convertToDOCX(input: any, options?: any): ConversionResult
```

**Unified API** (NEW):
```typescript
function convert(input: any, options: { format: "pdf" | "png" | string, [key: string]: any }): ConversionResult
```

**Return Type**:
- Buffer output (default) or file path
- Comprehensive metadata (duration, size, format-specific details)
- Optional intermediate MHTML path

**Output Modes** (NEW):
- Buffer (default)
- File path
- Stream (for large files)

**Configuration**:
- JSON config file support (`html-converter.config.json`)
- Environment variables
- Programmatic options (highest priority)

#### CLI Requirements

**Command Structure**:
```bash
npx html-converter-cdt <input> [output] [options]
```

**Input Sources**:
- File path or URL
- stdin via `-` convention (NEW)

**Output Targets**:
- File path (format inferred from extension)
- stdout via `--stdout` flag (NEW)

**Global Options** (NEW):
- `--format`: Explicit format specification
- `--stdout`: Output to stdout
- `--dry-run`: Configuration preview
- `--verbose`: Detailed logging
- `--version`, `--help`: Standard CLI flags

**UX Requirements**:
- Progress spinner for long operations
- Duration and success/failure summary
- Clear, actionable error messages
- Colorized output (when appropriate)

### 4.6 Error Handling (NEW)

**Structured Error Model**:
```typescript
interface ConversionError extends Error {
  code: "NETWORK_ERROR" | "TIMEOUT" | "INVALID_INPUT"
    | "CDP_ERROR" | "RESOURCE_ERROR" | "UNKNOWN"
  details?: any
  timestamp: string
}
```

**Error Codes**:
- `NETWORK_ERROR`: Remote URL fetch failed
- `TIMEOUT`: Operation exceeded timeout
- `INVALID_INPUT`: Malformed input or options
- `CDP_ERROR`: Chrome protocol communication failed
- `RESOURCE_ERROR`: External resource loading failed
- `UNKNOWN`: Unexpected error

### 4.7 Logging & Observability (NEW)

**Custom Logger Support**:
```typescript
interface Logger {
  info(message: string, meta?: any): void
  error(message: string, meta?: any): void
  debug(message: string, meta?: any): void
}
```

**Built-in Logging**:
- Quiet mode (default)
- Verbose mode (via `--verbose` or `verbose: true`)
- Pluggable logger interface

---

## 5. Format-Specific Requirements

### 5.1 PDF
- Page sizes: A4, A3, A5, Letter, Legal, Tabloid, Custom
- Margins: Uniform or per-side (top, right, bottom, left)
- Scale factor: 0.1 - 2.0
- Background graphics: Optional
- Header/footer templates: HTML-based
- Viewport optimization for single-page mode

### 5.2 Images (PNG/JPEG)
- Quality: 1-100 (JPEG) or 0-100 (PNG compression)
- Layout: Viewport (standard) or full-page (single-page)
- Omit background: Transparent PNGs
- Custom clip regions
- **Limitations** (NEW): Document maximum texture size (~16,384px)

### 5.3 Markdown
- Flavor: GitHub Flavored Markdown (GFM) or CommonMark
- Image handling (NEW):
  - **base64**: Embedded images (default)
  - **relative**: External image files with relative paths
- Code language detection
- Heading styles: atx (`#`) or setext
- Bullet markers: `-`, `*`, or `+`

### 5.4 DOCX
- Style preservation: Optional (default: clean, readable)
- Image embedding: Always enabled
- Page layout: Size, orientation, margins
- Font customization: Family and size

### 5.5 MHTML
- RFC 2557 compliant
- All resources embedded (CSS, JS, images, fonts)
- Compatible with Chrome/Edge browsers

---

## 6. Chrome Extension Integration

**Library Role**: Dependency library for extension projects (not a standalone extension)

**Requirements**:
- **Manifest V3** compatibility
- **chrome.debugger** API integration
- **Buffer-only output** (no file writing in browser context)
- **Memory-efficient** (respect ~50MB heap limits)
- **Clear examples** for content scripts and background workers

**Developer Experience**:
- Example extension in documentation
- Clear content script vs background script guidance
- Permission management best practices

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Small page (<100KB) | < 2s | P95 latency |
| Medium page (100KB-1MB) | < 5s | P95 latency |
| Large page (>1MB) | < 15s | P95 latency |
| Memory usage | < 500MB | Peak for single conversion |
| Concurrent conversions | 10+ | Without degradation |
| Startup time (CLI) | < 500ms | First conversion |

### 7.2 Reliability

- **Success Rate**: > 99.9% for valid inputs
- **Error Recovery**: Automatic retry with backoff
- **Resource Cleanup**: 100% cleanup even on failure
- **Crash Recovery**: No orphaned Chrome processes

### 7.3 Compatibility

| Environment | Minimum Version | Notes |
|-------------|----------------|-------|
| Node.js | 18.0.0 | ESM required |
| Chrome/Chromium | 90+ | CDP protocol compatibility |
| npm | 8.0.0 | For installation |
| TypeScript (dev) | 5.0+ | For contributors |

**Operating Systems**: Windows 10+, macOS 11+, Linux (Ubuntu 20.04+, Debian 11+)

### 7.4 Security

- **Sandbox Enforcement**: No `--no-sandbox` flag in spawned Chrome
- **No Exposed Ports**: CDP over WebSocket, not TCP
- **Input Sanitization**: Prevent path traversal and injection attacks
- **Secure Temp Files**: Isolated temp directories with proper permissions
- **Dependency Security**: Regular audits with Dependabot

### 7.5 Usability

- **API Simplicity**: < 3 lines for basic conversion
- **Setup Time**: < 5 minutes from install to first conversion
- **Error Messages**: Clear, actionable, with suggestions
- **Documentation**: Comprehensive with examples for every feature
- **IntelliSense**: Full TypeScript type definitions

---

## 8. Success Metrics

### 8.1 Technical Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| Test coverage | > 95% | Launch |
| Performance benchmarks | All targets met | Launch |
| Zero critical CVEs | 0 | Ongoing |
| Build warnings | < 10 | Launch |
| Bundle size | < 3MB (minified) | Launch |

### 8.2 User Experience Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| Setup to first conversion | < 5 min | Launch |
| API usability | < 3 lines basic code | Launch |
| Error clarity | 100% actionable | Launch |
| Documentation completeness | 100% API coverage | Launch |

### 8.3 Adoption Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| npm downloads | 1,000+ | Month 1 |
| GitHub stars | 50+ | Month 1 |
| Critical issues resolved | < 1 week | Ongoing |
| Community contributions | 5+ | Quarter 1 |

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- CDP connection management (Node.js and Extension)
- Input handling (local, remote, string, stdin)
- MHTML processor and caching
- Core conversion engine and context
- Error handling infrastructure

### Phase 2: Core Formats (Weeks 3-5)
- MHTML converter
- PDF converter (standard + single-page)
- Image converters (PNG, JPEG)
- Network retry logic
- Progress tracking

### Phase 3: Advanced Formats (Weeks 6-7)
- Markdown converter (with relative image support)
- DOCX converter
- Style preservation options
- Metadata extensibility

### Phase 4: CLI & Integration (Week 8)
- CLI implementation with all flags
- Configuration file support
- Progress indicators and UX polish
- Chrome extension examples
- Documentation

### Phase 5: Testing & Release (Weeks 9-10)
- Comprehensive test suite (unit, integration, E2E)
- Visual regression testing
- Performance benchmarking
- Security audit
- Documentation completion
- v1.0.0 release

---

## 10. Risk Management

### 10.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| CDP protocol changes | High | Low | Version pinning, regular testing |
| Chrome incompatibility | High | Medium | Support multiple versions (90+) |
| Memory leaks (Node.js) | High | Low | Automated leak testing, profiling |
| Extension size limits | Medium | Medium | Bundle optimization, code splitting |

### 10.2 Market Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low adoption | Medium | Medium | Strong docs, examples, marketing |
| Competing libraries | Low | High | Focus on CDP + Extension niche |
| Breaking Chrome changes | Medium | Low | Graceful degradation, version support |

---

## 11. Future Enhancements (Post v1.0)

### Phase 2 Features
- **Batch Conversion**: Process multiple files in parallel
- **Watch Mode**: Auto-convert on file changes
- **Progress Callbacks**: Real-time conversion status
- **Partial Conversions**: Convert specific page ranges (PDF)

### Phase 3 Features
- **Additional Formats**: SVG, WebP, EPUB
- **Advanced Layout**: Auto-page mode with explicit break markers
- **Resource Filtering**: Include/exclude specific resource types
- **Custom CSS Injection**: User-provided styling
- **Wait Conditions**: Selector-based render completion

### Phase 4 Features
- **REST API Wrapper**: Microservice for cloud deployments
- **WebAssembly**: Performance-critical operations (NEW)
- **Electron Support**: Desktop application integration
- **GUI Wrapper**: Cross-platform desktop app
- **Cloud Service**: Hosted conversion API

---

## 12. Out of Scope (v1.0)

- Native mobile apps (iOS, Android)
- Server-side rendering (SSR) framework integration
- Real-time collaborative editing
- OCR or text extraction
- Video/animation capture
- Accessibility auditing
- SEO analysis tools

---

## 13. Appendix: Consolidated Review Feedback

### Review 1 - Key Enhancements Adopted
✅ CDPManager abstraction
✅ Structured error model with codes
✅ Unified `convert()` API
✅ Stream output support
✅ Custom logging interface
✅ CLI flags: `--format`, `--stdout`, `--dry-run`
✅ Test matrix (Node + Chrome versions)
✅ Golden file / visual regression testing
✅ Security: sandbox enforcement, no exposed ports
✅ Documentation structure (API, CLI, Extension guides)

### Review 2 - Key Enhancements Adopted
✅ Use case: Automated Report Generation
✅ stdin/stdout support with `-` convention
✅ Markdown: relative image path option
✅ Image: document texture size limits
✅ API: explicit format flag
✅ Future: WebAssembly consideration
✅ Testing: visual regression strategy
✅ Architecture: existing Chrome instance connection (future)

---

## 14. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Robin Min | Initial PRD |
| 1.0.1 | 2025-10-20 | Robin Min | Review feedback incorporation |
| 2.0 | 2025-10-14 | Robin Min | Consolidated reviews, concise product focus |

---

**Approved By**: Engineering Team
**Next Step**: Functional Specification Document (FSD)

---

**End of PRD**
