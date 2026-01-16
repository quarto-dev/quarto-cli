# Quarto Test Patterns

This document describes the standard patterns for writing smoke tests in the Quarto CLI test suite.

## Test Structure Overview

Quarto uses Deno for testing with custom verification helpers located in:
- `tests/test.ts` - Core test runner (`testQuartoCmd`)
- `tests/verify.ts` - Verification helpers (`fileExists`, `pathDoNotExists`, etc.)
- `tests/utils.ts` - Utility functions (`docs()`, `outputForInput()`, etc.)

## Common Test Patterns

### Project Rendering Tests

For testing project rendering (especially website projects):

```typescript
import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { fileExists, pathDoNotExists, noErrors } from "../../verify.ts";

const projectDir = docs("project/my-test");        // Relative path via docs()
const outputDir = join(projectDir, "_site");       // Append output dir for websites

testQuartoCmd(
  "render",
  [projectDir],
  [
    noErrors,                                       // Check for no errors
    fileExists(join(outputDir, "index.html")),    // Verify expected file exists
    pathDoNotExists(join(outputDir, "ignored.html")), // Verify file doesn't exist
  ],
  {
    teardown: async () => {
      if (existsSync(outputDir)) {
        await Deno.remove(outputDir, { recursive: true });
      }
    },
  },
);
```

**Key points:**
- Use `docs()` helper to create relative paths from `tests/docs/`
- For website projects, output goes to `_site` subdirectory
- Use absolute paths with `join()` for file verification
- Clean up output directories in teardown

### Extension Template Tests

For testing `quarto use template`:

```typescript
import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrorsOrWarnings, pathDoNotExists } from "../../verify.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";

const tempDir = Deno.makeTempDirSync();

// Create mock template source
const templateSourceDir = join(tempDir, "template-source");
ensureDirSync(templateSourceDir);
Deno.writeTextFileSync(join(templateSourceDir, "template.qmd"), "...");
Deno.writeTextFileSync(join(templateSourceDir, "config.yml"), "...");

const templateFolder = "my-test-template";
const workingDir = join(tempDir, templateFolder);
ensureDirSync(workingDir);

testQuartoCmd(
  "use",
  ["template", templateSourceDir, "--no-prompt"],
  [
    noErrorsOrWarnings,
    fileExists(`${templateFolder}.qmd`),             // Relative - template file renamed to folder name
    pathDoNotExists(join(workingDir, "README.md")), // Absolute - excluded file
  ],
  {
    cwd: () => workingDir,                           // Set working directory
    teardown: () => {
      try {
        Deno.removeSync(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      return Promise.resolve();
    }
  }
);
```

**Key points:**
- Use `Deno.makeTempDirSync()` for isolated test environment
- Create mock template source with test files
- Template files get renamed to match target directory name
- Use `cwd()` function to set working directory for command execution
- Clean up entire temp directory including source files
- File verification uses relative paths when checking files in `cwd()`

## Verification Helpers

### Core Verifiers

```typescript
// No errors in output
noErrors

// No errors or warnings
noErrorsOrWarnings

// File exists at path
fileExists(path: string)

// Path does not exist
pathDoNotExists(path: string)

// Folder exists at path
folderExists(path: string)

// Directory contains only allowed paths
directoryEmptyButFor(dir: string, allowedFiles: string[])
```

### Path Helpers

```typescript
// Create relative path from tests/docs/
docs(path: string): string
// Example: docs("project/site") → "tests/docs/project/site"

// Get expected output for input file
outputForInput(input: string, to: string, projectOutDir?: string, projectRoot?: string)

// Find project directory
findProjectDir(input: string, until?: RegExp)

// Find project output directory (_site, _book, etc.)
findProjectOutputDir(projectdir: string)
```

## Output Directory Patterns

Different project types use different output directories:

```typescript
// Website project
const outputDir = join(projectDir, "_site");

// Book project
const outputDir = join(projectDir, "_book");

// Manuscript project
const outputDir = join(projectDir, "_manuscript");

// Plain project (no type specified)
// Output goes directly in project directory
const outputDir = projectDir;
```

## Test File Organization

Tests follow this directory structure:

```
tests/
├── docs/                          # Test fixtures
│   └── project/
│       └── my-test/
│           ├── _quarto.yml
│           ├── index.qmd
│           └── other-files.qmd
├── smoke/                         # Smoke tests
│   ├── project/
│   │   └── project-my-test.test.ts
│   ├── render/
│   ├── use/
│   └── ...
├── test.ts                        # Test runner
├── verify.ts                      # Verification helpers
└── utils.ts                       # Utility functions
```

## Common Patterns

### Cleanup Pattern

Always clean up generated files in teardown:

```typescript
teardown: async () => {
  if (existsSync(outputPath)) {
    await Deno.remove(outputPath, { recursive: true });
  }
}
```

### Multiple Test Cases

When testing multiple scenarios, declare constants at module level:

```typescript
const tempDir = Deno.makeTempDirSync();

// Test case 1
const folder1 = "test-case-1";
const workingDir1 = join(tempDir, folder1);
ensureDirSync(workingDir1);
testQuartoCmd(...);

// Test case 2
const folder2 = "test-case-2";
const workingDir2 = join(tempDir, folder2);
ensureDirSync(workingDir2);
testQuartoCmd(...);
```

### Path Construction

- **Absolute paths**: Use `join()` for all path operations
- **Relative to docs**: Use `docs()` helper
- **Relative to cwd**: Use plain strings or template literals in template tests

## Examples from Codebase

### Project Ignore Test
See `tests/smoke/project/project-ignore-dirs.test.ts` for testing directory exclusion patterns.

### Website Rendering Test
See `tests/smoke/project/project-website.test.ts` for website project rendering patterns.

### Template Usage Test
See `tests/smoke/use/template.test.ts` for extension template patterns.

## Best Practices

1. **Always clean up**: Use teardown to remove generated files
2. **Use helpers**: Leverage `docs()`, `fileExists()`, etc. instead of manual checks
3. **Absolute paths**: Use `join()` for all path construction to handle platform differences
4. **Test isolation**: Use temp directories for tests that create files
5. **Clear names**: Use descriptive variable names like `projectDir`, `outputDir`, `templateFolder`
6. **Comment intent**: Add comments explaining what should/shouldn't happen
7. **Handle errors**: Wrap cleanup in try-catch to avoid test suite failures from cleanup issues

## Testing File Exclusion

When testing that files are excluded (like AI config files):

```typescript
// Test that files are NOT rendered
testQuartoCmd(
  "render",
  [projectDir],
  [
    noErrors,
    fileExists(join(outputDir, "expected.html")),      // Should exist
    pathDoNotExists(join(outputDir, "excluded.html")), // Should NOT exist
  ],
  // ...
);
```

Run test **without fix** first to verify it fails, then verify it passes with fix.
