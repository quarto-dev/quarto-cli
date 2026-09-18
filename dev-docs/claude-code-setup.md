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

### `.claude/skills/<name>/SKILL.md`

Shared, tracked project skills contain procedures and decision logic for tasks such as making
a release or investigating a rendering bug. A skill is a
directory containing at least `SKILL.md`; it can also hold `references/` (material to load only
when needed), `scripts/`, and `assets/`. Every skill under this directory is model-invocable by
default — Claude Code can decide to use it from the conversation, not just when a contributor
types its slash form. Add `disable-model-invocation: true` to a skill's frontmatter for
anything task-like and consequential enough that it should only run when explicitly invoked
(e.g. cutting a release).

A shared skill must be usable by any contributor with just `git` and `gh` — it must not assume
personal tooling (a particular browser-automation CLI, a personal issue tracker, etc.) without
documenting a fallback.

`.claude/skills/` can also contain personal, repository-local skills that are excluded from
git in the same way as personal commands (see "What's Not Committed" below).
`.claude/skills/start-issue/` is one example in this repository. **Do not give a personal
repository-local skill the same name as a tracked shared skill.** If a shared skill is later
committed at the same path, Git may refuse to overwrite the untracked file, or local changes
may shadow the tracked file. Use unique names for personal skills.

### Where information belongs

Choose a location based on how often the information changes and how it is used:

- **`.claude/CLAUDE.md`** — short, always-loaded facts (architecture overview, setup, build
  commands).
- **`.claude/rules/**`** — path-scoped conventions, loaded only when matching files are touched.
- **`llm-docs/**`** — subsystem architecture, read on demand.
- **`.claude/skills/**`** — procedures and decision logic for a task, not facts about the
  codebase.

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

Two personal files are common enough to every contributor's setup that they're listed in the
tracked `.gitignore`: `CLAUDE.local.md` and `.claude/settings.local.json`.

Do not commit other personal files, such as slash commands under `.claude/commands/`,
repository-local skills such as `.claude/skills/start-issue/`, or notes under `.claude/docs/`.
Exclude them using your preferred local Git configuration. A skill becomes shared only when a
contributor stages and commits its `.claude/skills/<name>/` directory, including `SKILL.md` and
any required `references/`, `scripts/`, or `assets/`.

Avoid committing API keys, tokens, or credentials in any `.claude/` or `llm-docs/` file. Use environment variables or `.env` (also gitignored) for sensitive values.

## Further Reading

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Memory files reference](https://docs.anthropic.com/en/docs/claude-code/memory)
