# Quarto LaTeX engine Pattern Maintenance

Quarto tracks **tinytex** R package's LaTeX error detection patterns to provide helpful diagnostics when LaTeX compilation fails. This document describes the automated verification process and manual adaptation workflow.

## Overview

The R package **tinytex** maintains a comprehensive database of LaTeX error patterns in its parsing error logic, and export this in `regex.json` in its daily release. It can detect missing packages and fonts. We track these patterns because:

- TinyTeX is the distribution maintain by Posit team actively maintains patterns based on user reports (@yihui and @cderv)
- It is used by Quarto (`quarto install tinytex`)
- Every problem will be fixed in the R package first
- Low update frequency (~4 changes/year) makes manual adaptation practical

**Our process:**

- Daily automated check detects when TinyTeX patterns change
- GitHub issue created/updated when changes detected
- Manual review and adaptation for Quarto's usage

## Pattern Differences

tinytex R package and Quarto LaTeX engine use patterns differently:

- R package: Matches patterns line-by-line against log array
- Quarto: Matches patterns against entire log file as string

### Common Adaptations

1. **Direct copy** (most common):

   ```typescript
   // TinyTeX: ".*! LaTeX Error: File [`']([^']+)' not found.*"
   // Quarto:
   /.*! LaTeX Error: File [`']([^']+)' not found.*/g;
   ```

2. **Anchored patterns** need multiline flag or anchor removal:

   ```typescript
   // TinyTeX: "^No file ([^`'. ]+[.]fd)[.].*"
   // Quarto options:
   /^No file ([^`'. ]+[.]fd)[.].*/gm  // multiline flag
   /.*No file ([^`'. ]+[.]fd)[.].*/g  // remove anchor
   ```

3. **Filter functions** for post-processing:

   ```typescript
   {
     regex: /.*! Font [^=]+=([^ ]+).+ not loadable.*/g,
     filter: formatFontFilter,  // Cleans font names
   }
   ```

## Manual Adaptation Process

When the automated workflow detects TinyTeX pattern changes, it creates/updates a GitHub issue with:

- Date of detection
- Category-by-category count changes
- Full diff of `regex.json` changes

### Adaptation Steps

1. Review the diff:

   - Identify added, modified, or removed patterns

2. Update [parse-error.ts](../src/command/render/latexmk/parse-error.ts):

   - Add new patterns to `packageMatchers` array
   - Convert TinyTeX string patterns to TypeScript regex with `/g` flag
   - Add multiline flag `/gm` if pattern uses `^` or `$` anchors
   - Add filter function if pattern needs post-processing

3. Test changes

   ```bash
   cd tests
   # Windows
   pwsh -Command '$env:QUARTO_TESTS_NO_CONFIG="true"; .\run-tests.ps1 unit\latexmk\parse-error.test.ts'
   # Linux/macOS
   QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh unit/latexmk/parse-error.test.ts
   ```

4. Commit and close issue

## Verification Workflow

The automated workflow runs daily:

1. Downloads `regex.tar.gz` from [TinyTeX releases](https://github.com/rstudio/tinytex-releases)
2. Extracts and compares `regex.json` with cached version
3. If changed: generates diff and creates/updates issue
4. If unchanged: exits early (no notification)

**Workflow location**: [.github/workflows/verify-tinytex-patterns.yml](../.github/workflows/verify-tinytex-patterns.yml)

**Manual trigger**: Run workflow from GitHub Actions tab when testing or after TinyTeX release announcement

## Current Coverage

**Pattern implementation:** 22 of 23 patterns from TinyTeX (96%)

**Not implemented:**
- `l3backend` pattern for LaTeX3 version mismatch detection
- Reason: Complex context-aware logic required, rare error case

**Test coverage:** All documented TinyTeX error examples are tested

**Important:** Patterns should support both backtick (`` ` ``) and single quote (`'`) for LaTeX error messages

## Resources

- [parse-error.ts](../src/command/render/latexmk/parse-error.ts) - Pattern implementation
- [parse-error.test.ts](../tests/unit/latexmk/parse-error.test.ts) - Unit tests
- [TinyTeX R source](https://github.com/rstudio/tinytex/blob/main/R/latex.R) - How patterns are used in R
- [TinyTeX releases](https://github.com/rstudio/tinytex-releases) - Source of regex.json
