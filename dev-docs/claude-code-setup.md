# Claude Code Setup for Quarto Contributors

This project includes shared [Claude Code](https://docs.anthropic.com/en/docs/claude-code) memory files that help AI assistants understand the Quarto codebase. These files are committed to the repository so all contributors benefit from consistent AI-assisted development.

## What's Included

### `.claude/CLAUDE.md`

Always loaded by Claude Code. Contains the project overview: architecture, setup, build commands, conventions, and key file paths.

### `.claude/rules/`

Path-scoped rule files that load conditionally based on what files you're working with. For example, when editing Lua filters, Claude Code automatically loads filter-specific conventions.

Current rule areas:
- `changelog.md` — Changelog entry format
- `filters/` — Lua filter coding conventions and system overview
- `formats/` — Format handler patterns
- `rendering/` — Render pipeline architecture
- `schemas/` — Zod schema patterns
- `testing/` — Test infrastructure, smoke-all format, Playwright, anti-patterns
- `typescript/` — Deno essentials, RAL, Cliffy commands
- `dev-tools/` — Development commands reference
- `llm-docs-maintenance.md` — LLM documentation staleness checking

Each rule file has a `paths:` frontmatter that controls when it loads:

```yaml
---
paths:
  - "src/resources/filters/**"
---
```

This means the file only loads when Claude Code is working with files matching those paths.

### `llm-docs/`

Architectural deep-dive documentation for AI assistants. These are NOT auto-loaded — they're read on demand when Claude Code needs detailed understanding of a subsystem. Topics include template systems, error messages, testing patterns, and Lua API reference.

Each llm-doc has staleness metadata in its frontmatter so Claude Code can check if the documented code has changed since the analysis was done.

## Personal Overrides

Create `CLAUDE.local.md` at the repository root for personal overrides. This file is gitignored and won't be committed. Use it for:

- Preferred shell syntax or platform-specific notes
- Personal workflow customizations
- References to personal tools or configurations

Claude Code loads `CLAUDE.local.md` alongside the project `CLAUDE.md`.

## Adding or Updating Rules

### New rule file

1. Create `.claude/rules/<area>/rule-name.md`
2. Add `paths:` frontmatter listing glob patterns relative to the repo root (e.g., `"src/resources/filters/**"`)
3. Keep rules focused and concise (50-250 lines is typical)

### Update existing rule

Edit the relevant file in `.claude/rules/`. The path scoping ensures changes only affect sessions working with matching files.

### New llm-doc

1. Create `llm-docs/topic-name.md`
2. Add staleness frontmatter (`main_commit`, `analyzed_date`, `key_files`)
3. Reference from relevant rule files if helpful

## What's NOT Committed

The `.gitignore` excludes personal Claude Code files:

```
CLAUDE.local.md           # Personal overrides
.claude/commands/         # Personal slash commands
.claude/docs/             # Personal documentation
.claude/settings.local.json  # Local settings
```

These stay personal to each developer.

## Further Reading

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Memory files reference](https://docs.anthropic.com/en/docs/claude-code/memory)
