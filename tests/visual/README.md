# Visual Regression Testing

This directory contains visual regression tests for the HTML Converter CDT project.

## Overview

Visual regression testing ensures that the visual output of HTML conversions remains consistent across changes. This includes:

- PDF output visual verification
- Image format comparison (PNG, JPEG, WebP)
- Layout and rendering validation
- Cross-format consistency checks

## Structure

```
tests/visual/
├── baselines/              # Reference images/files for comparison
│   ├── basic-html-pdf/     # Baseline PDF files
│   ├── complex-html-png/   # Baseline PNG files
│   └── ...
├── current/                # Current test outputs (auto-generated)
├── diffs/                  # Visual differences (auto-generated)
├── utils/                  # Utility functions
│   ├── visual-regression.ts
│   └── baseline-manager.ts
├── pdf-regression.test.ts  # PDF visual regression tests
├── image-regression.test.ts # Image visual regression tests
└── README.md               # This file
```

## Running Tests

### Run Visual Tests
```bash
pnpm test:visual
```

### Update Baselines
```bash
pnpm test:visual:update
# or
UPDATE_BASELINE=true pnpm test:visual
```

### Run Specific Visual Tests
```bash
# PDF tests only
npx playwright test --project=visual-tests pdf-regression.test.ts

# Image tests only
npx playwright test --project=visual-tests image-regression.test.ts
```

## Baseline Management

### Using the Baseline Manager

The `baseline-manager.ts` script provides utilities for managing visual baselines:

```bash
# Update all baselines from current test outputs
node tests/visual/utils/baseline-manager.ts update

# Analyze baseline statistics
node tests/visual/utils/baseline-manager.ts analyze

# Validate baseline integrity
node tests/visual/utils/baseline-manager.ts validate

# Clean up old baselines (older than 30 days)
node tests/visual/utils/baseline-manager.ts cleanup 30

# List all baselines
node tests/visual/utils/baseline-manager.ts list

# List baselines with filters
node tests/visual/utils/baseline-manager.ts list --format pdf
node tests/visual/utils/baseline-manager.ts list --test basic
```

### Baseline Creation Process

1. **Initial Run**: When a test runs for the first time, it creates a baseline if none exists
2. **Test Skips**: The test is marked as "skipped" with a message indicating baseline creation
3. **Subsequent Runs**: Tests compare against existing baselines

### Updating Baselines

When intentional changes are made to the output format:

1. Run tests with `UPDATE_BASELINE=true` or use the baseline manager
2. Review the generated baselines manually if needed
3. Commit the updated baselines to version control

## Test Categories

### PDF Regression Tests (`pdf-regression.test.ts`)

- **Basic HTML**: Simple document conversion
- **Complex HTML**: Documents with tables, lists, and styling
- **Page Sizes**: Different PDF page formats (A4, A3, Letter, Legal)
- **Orientation**: Portrait vs landscape
- **Margins**: Custom margin configurations
- **Headers/Footers**: Page headers and footers

### Image Regression Tests (`image-regression.test.ts`)

- **Basic HTML**: Simple document to image conversion
- **Complex HTML**: Rich content with styling
- **Tables**: Table rendering verification
- **Viewport Sizes**: Responsive design testing
- **Image Quality**: Different quality settings
- **Multiple Formats**: PNG, JPEG, WebP comparison
- **CSS Animations**: Animated content handling

## Configuration

### Tolerance Settings

Visual comparison tolerances can be configured per test:

```typescript
await VisualAssertions.assertImagesMatch(baselinePath, imageBuffer, {
  pixelTolerance: 0.01, // 1% pixel difference tolerance
  maxDiffPixels: 1000, // Maximum allowed different pixels
})
```

### Test Annotations

Visual tests use Playwright annotations:

- `@visual`: Marks tests as visual regression tests
- Tests can be filtered by annotation: `npx playwright test --grep "@visual"`

## Troubleshooting

### Test Failures

1. **False Positives**: Sometimes legitimate changes trigger failures
   - Review the visual differences in `tests/visual/current/`
   - Update baselines if changes are intentional

2. **Missing Baselines**: Tests will skip and create baselines automatically
   - Run tests again after baseline creation

3. **Environment Differences**: Visual output may vary across systems
   - Use consistent testing environments
   - Consider platform-specific baselines if needed

### Baseline Corruption

If baselines become corrupted:

```bash
# Validate all baselines
node tests/visual/utils/baseline-manager.ts validate

# Update corrupted baselines
node tests/visual/utils/baseline-manager.ts update
```

### Large Baseline Files

Large baseline files can cause performance issues:

```bash
# Analyze baseline sizes
node tests/visual/utils/baseline-manager.ts analyze

# Clean up old/large baselines
node tests/visual/utils/baseline-manager.ts cleanup
```

## Best Practices

1. **Commit Baselines**: Always commit approved baselines to version control
2. **Review Changes**: Manually review baseline updates before committing
3. **Descriptive Names**: Use clear, descriptive test names
4. **Consistent Formatting**: Maintain consistent test structure
5. **Minimal Changes**: Update only the specific baselines that changed
6. **Documentation**: Document significant visual changes in commit messages

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Run Visual Tests
  run: pnpm test:visual

- name: Upload Visual Artifacts
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: visual-test-results
    path: tests/visual/current/
```

### Environment Variables

- `UPDATE_BASELINE`: Set to "true" to update baselines instead of comparing
- `VISUAL_DEBUG`: Enable detailed logging for visual tests
- `GENERATE_DIFFS`: Generate difference images for failed tests

## Performance Considerations

Visual tests can be slower than unit tests due to:

- Browser startup time
- Image generation and comparison
- File I/O operations

Mitigation strategies:
- Run visual tests in dedicated CI jobs
- Use caching for browser instances
- Limit visual test frequency in development
- Use selective test execution when possible

## Future Enhancements

Potential improvements to consider:

1. **Advanced Image Comparison**: Pixel-level vs structural comparison
2. **Cross-Platform Testing**: Multiple operating system baselines
3. **Cloud Storage**: External baseline storage
4. **Automated Review**: AI-powered visual difference analysis
5. **Parallel Processing**: Concurrent visual test execution
