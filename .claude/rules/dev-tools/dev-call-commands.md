---
description: "Development commands reference for Quarto CLI development"
paths:
  - "src/command/dev-call/**/*"
---

# Development Commands (dev-call)

The `dev-call` command provides access to internal development tools. These commands are hidden from regular help output but essential for CLI development.

## cli-info

Generate JSON information about the Quarto CLI structure and commands.

```bash
package/dist/bin/quarto dev-call cli-info        # Linux/macOS
package/dist/bin/quarto.cmd dev-call cli-info    # Windows
```

**Use cases**: Documentation generation, programmatic analysis of CLI structure, building CLI tooling.

## validate-yaml

Validate YAML files against Quarto's schema definitions.

```bash
# Validate against built-in schema
package/dist/bin/quarto dev-call validate-yaml config.yml --schema document
package/dist/bin/quarto dev-call validate-yaml _quarto.yml --schema project/project

# Validate against custom schema file
package/dist/bin/quarto dev-call validate-yaml custom.yml --schema my-schema.yml

# Get JSON output
package/dist/bin/quarto dev-call validate-yaml config.yml --schema document --json
```

**Use cases**: Testing schema changes, debugging YAML configuration issues, validating custom schemas, CI/CD pipelines.

**Schema names**: Reference definitions in `src/resources/schema/definitions.yml` (e.g., `document`, `project/project`, `format/html`).

## build-artifacts

Regenerate schemas, types, and editor tooling files.

```bash
package/dist/bin/quarto dev-call build-artifacts    # Linux/macOS
package/dist/bin/quarto.cmd dev-call build-artifacts  # Windows
```

**Regenerates**:
- JSON schemas in `src/resources/schema/json-schemas.json`
- Zod schemas in `src/resources/types/zod/schema-types.ts`
- TypeScript type definitions in `src/resources/types/schema-types.ts`
- Editor tooling files (VSCode IntelliSense, YAML intelligence)

## show-ast-trace

Launch interactive viewer to visualize how a document transforms through the Lua filter pipeline.

```bash
package/dist/bin/quarto dev-call show-ast-trace document.qmd
package/dist/bin/quarto dev-call show-ast-trace document.qmd --to html
```

**What it does**:

1. Renders document with AST tracing enabled
2. Generates `<basename>-quarto-ast-trace.json` in cache
3. Launches interactive trace viewer in browser

**Use cases**: Debugging Lua filter behavior, understanding AST transformations, investigating rendering issues, visualizing document structure changes.

**Alternative**: Manually set `QUARTO_TRACE_FILTERS` environment variable during render. See `dev-docs/lua-filter-trace-viewer.qmd` for detailed guide.

**Limitations**:

- Doesn't work well with website/book projects (env var doesn't differentiate per file)
- Shows only Pandoc AST, not postprocessor or writer behavior

## make-ast-diagram

Create a static visual diagram of the Pandoc AST structure for a document.

```bash
package/dist/bin/quarto dev-call make-ast-diagram document.qmd
package/dist/bin/quarto dev-call make-ast-diagram document.qmd --mode full
```

**Use cases**: Understanding document AST structure, debugging complex layouts, visualizing nested elements, teaching Pandoc AST concepts.

**Note**: Simpler than full trace - provides static snapshot rather than filter chain progression.

## Reference

See `dev-docs/dev-call-commands.md` for comprehensive reference and workflows.
