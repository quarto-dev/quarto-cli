# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quarto is an open-source scientific and technical publishing system built on Pandoc. The CLI is written in TypeScript/Deno with Lua filters for document processing.

### Versions

Latest stable is the version at: <https://quarto.org/docs/download/_download.json>. Latest prerelease is at: <https://quarto.org/docs/download/_prerelease.json>

## Setup & Configuration

### Initial Setup

```bash
# Clone and configure (downloads Deno, dependencies, and sets up symlink)
./configure.sh         # Linux/macOS
./configure.cmd        # Windows

# The configure script:
# - Downloads and installs Deno to package/dist/bin/tools/
# - Downloads Deno standard library
# - Runs quarto-bld configure
# - Vendors TypeScript dependencies
# - Creates symlink to quarto in your PATH
```

After configuration, the development version can be run via:

- `quarto` command (if symlink configured)
- `package/dist/bin/quarto` (Linux/macOS) or `package/dist/bin/quarto.cmd` (Windows)

### Configuration Files

- `configuration` - Version numbers for all binary and JavaScript dependencies (Deno, Pandoc, Dart Sass, etc.)
- `deno.jsonc` - Auto-generated Deno configuration (see dev-docs/update-deno_jsonc.md)
- `src/import_map.json` - Deno import mappings
- `src/dev_import_map.json` - Development import mappings

## Building & Testing

### Build Commands

```bash
# Run the build script (TypeScript-based)
package/src/quarto-bld configure    # Configure/bootstrap
package/src/quarto-bld prepare      # Prepare distribution
```

### Building Schemas and Artifacts

Use the `dev-call` command with `build-artifacts` argument:

```bash
# Linux/macOS
package/dist/bin/quarto dev-call build-artifacts

# Windows
package/dist/bin/quarto.cmd dev-call build-artifacts
```

This command regenerates:

- JSON schemas in `src/resources/schema/json-schemas.json`
- Zod schemas in `src/resources/types/zod/schema-types.ts`
- TypeScript type definitions in `src/resources/types/schema-types.ts`
- Editor tooling files (VSCode IntelliSense, YAML intelligence)

### Running Tests

Tests live in `tests/` and require R, Python, and Julia. See `.claude/rules/testing/overview.md` for commands, test types, dependencies, and debugging tips.

```bash
cd tests
./run-tests.sh smoke/render/render.test.ts  # Linux/macOS
.\run-tests.ps1 smoke/render/render.test.ts # Windows
```

### Feature Format Matrix

The feature format matrix in `dev-docs/feature-format-matrix/` documents and tests feature support across all output formats.

- Test documents organized by feature in `qmd-files/` subdirectories
- Quality ratings in format metadata: `0` (broken/partial), `1` (good), `2` (excellent)
- Runs on CI via `.github/workflows/test-ff-matrix.yml`

## Architecture

### Entry Point & Commands

- `src/quarto.ts` - Main CLI entry point
- `src/command/command.ts` - Command registration
- Commands are organized in `src/command/*/cmd.ts` files:
  - `render/` - Core rendering functionality
  - `preview/` - Live preview server
  - `publish/` - Publishing to various platforms
  - `create/` and `add/` - Project/extension scaffolding
  - `tools/`, `install/`, `check/` - Utilities

### Core Systems

**Project System** (`src/project/`)

- `types/` - Project type implementations (book, website, manuscript, etc.)
- Project types are registered via `project/types/register.ts`
- Each type defines metadata, rendering behavior, and output structure

**Format System** (`src/format/`)

- Format handlers for different output types (HTML, PDF, DOCX, reveal.js, etc.)
- `formats.ts` - Format registry and resolution
- `format-handlers.ts` - Common format handling logic

**Filter System** (`src/resources/filters/`)

- Lua filters process Pandoc AST during rendering
- `main.lua` - Entry point for filter chain
- Organized by function: `crossref/`, `layout/`, `quarto-pre/`, `quarto-post/`, `quarto-finalize/`
- Custom AST nodes in `customnodes/`
- Common utilities in `common/`

**Execution Engines** (`src/execute/`)

- Integration with Jupyter, Knitr, and Observable for code execution
- Engine-specific handling for Python, R, Julia, and JavaScript

**Resources** (`src/resources/`)

- Static assets, templates, and bundled libraries
- Format-specific resources (HTML, PDF, reveal.js templates)
- Extensions (Confluence, Docusaurus, etc.)
- Pandoc datadir customizations

### Key Subsystems

**Preview System** (`src/preview/`)

- Development server with live reload
- Watches for file changes and re-renders

**Publishing System** (`src/publish/`)

- Platform-specific publishers (Netlify, GitHub Pages, Confluence, etc.)
- Account management and deployment logic

**Extension System** (`src/extension/`)

- Quarto extensions (filters, formats, shortcodes)
- Extension discovery, installation, and management

### Package/Distribution

- `package/` - Packaging and distribution scripts
- `package/src/quarto-bld` - Build orchestration script (TypeScript)
- Platform-specific packaging in `package/src/{linux,macos,windows}/`

## Development Patterns

### Debugging Flaky Tests

Comprehensive methodology for debugging flaky tests documented in [dev-docs/debugging-flaky-tests.md](../dev-docs/debugging-flaky-tests.md).

Key phases:
1. Reproduce locally (outside CI)
2. Binary search to isolate culprit test
3. Narrow down within test file
4. Understand state change
5. Identify root cause
6. Verify solution

### TypeScript/Deno Conventions

- Use Deno-native APIs (avoid Node.js APIs)
- Import maps resolve dependencies (see `src/import_map.json`)
- Cliffy library used for CLI parsing
- File paths in imports must include `.ts` extension

### Lua Filter Development

- Filters run during Pandoc processing pipeline
- Use `quarto` Lua module for Quarto-specific APIs
- Common utilities in `src/resources/filters/common/`
- Filters are chained together in `main.lua`
- Documentation: <https://quarto.org/docs/extensions/lua-api.html>

### Adding New Commands

1. Create command file in `src/command/<name>/cmd.ts`
2. Export command using Cliffy's `Command` API
3. Register in `src/command/command.ts`

### Adding New Project Types

1. Create implementation in `src/project/types/<name>/`
2. Implement `ProjectType` interface
3. Register in `src/project/types/register.ts`

### Adding New Formats

1. Create format definition in `src/format/<name>/`
2. Implement format handler
3. Register in `src/format/imports.ts`

### LaTeX Error Detection

LaTeX error pattern maintenance is documented in [dev-docs/tinytex-pattern-maintenance.md](../dev-docs/tinytex-pattern-maintenance.md).

- Patterns inspired by TinyTeX's comprehensive regex.json
- Automated daily verification workflow checks for TinyTeX pattern updates
- Pattern location: `src/command/render/latexmk/parse-error.ts`
- Verification workflow: `.github/workflows/verify-tinytex-patterns.yml`

## Important Conventions

- Main branch: `main`
- Version defined in `configuration` file in `QUARTO_VERSION` field
- Binary dependencies (Deno, Pandoc, etc.) versions in `configuration`
- Use `quarto-bld` for build operations, not direct Deno commands
- Lua filters use Pandoc's filter infrastructure
- TypeScript types for Lua APIs in `src/resources/lua-types/`

### Changelog Conventions

- Changelog files live in `news/changelog-{version}.md` (e.g., `changelog-1.9.md`)
- Check `configuration` file for current `QUARTO_VERSION`
- See `.claude/rules/changelog.md` for comprehensive conventions (section hierarchy, entry format, backports, regression fixes)

## Key File Paths

- Quarto binary: `package/dist/bin/quarto` (Linux/macOS) or `package/dist/bin/quarto.cmd` (Windows)
- Deno binary: `package/dist/bin/tools/<arch>/deno`
- Distribution output: `package/dist/`
- Vendored dependencies: `src/vendor/`

## Documentation

- Documentation is at <https://quarto.org> with a sitemap at <https://quarto.org/sitemap.xml>
- Prerelease docs: <https://prerelease.quarto.org/> for features in dev versions
- Dev documentation in `dev-docs/` includes:
  - Checklists for releases and backports
  - Dependency update procedures
  - Internals guides
  - Performance monitoring

## Contributing

See CONTRIBUTING.md for pull request guidelines. Significant changes require a signed contributor agreement (individual or corporate).

## Maintaining Memory Files

This project uses Claude Code memory files for AI-assisted development. When updating memory files:

- **Add new feature area?** Create `.claude/rules/<feature>/feature-name.md` with `paths:` frontmatter
- **Update existing feature?** Edit the relevant rule file
- **Deep dive doc needed?** Place it in `llm-docs/` and reference from rules

**Memory file types:**

| Location | When Loaded | Use For |
|----------|-------------|---------|
| `.claude/CLAUDE.md` | Always | Project overview, essential commands |
| `.claude/rules/<feature>/` | When paths match | Feature-specific conventions |
| `llm-docs/` | When explicitly read | Architectural deep dives |

**Personal overrides:** Create `CLAUDE.local.md` (gitignored) for personal preferences like preferred shell syntax or workflow customizations. This file is loaded alongside the project CLAUDE.md but won't be committed.

For setup details, see [dev-docs/claude-code-setup.md](../dev-docs/claude-code-setup.md).

## Additional Resources

- **LLM Documentation**: `llm-docs/` contains AI-specific guidance for working with the codebase
- **Rules Files**: `.claude/rules/` contains conditional guidance for specific file patterns
- **DeepWiki**: <https://deepwiki.com/quarto-dev/quarto-cli> for AI-indexed documentation
