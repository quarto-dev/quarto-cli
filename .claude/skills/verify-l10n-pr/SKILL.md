---
name: verify-l10n-pr
description: Use when reviewing a PR that adds or modifies a `_language-<code>.yml` localization file in `src/resources/language/`. Runs structural checks that need no translation tool, plus an optional MT spot-check when a translation MCP is connected.
---

# Verify a Localization PR

Most quarto-cli maintainers cannot read most of the 30+ languages `src/resources/language/*.yml` covers. This skill separates what's checkable without any language knowledge (structural correctness) from what benefits from a machine-translation second opinion (semantic plausibility) — and treats the second part as optional, since not every reviewer has a translation tool connected.

## Step 1 — Structural checks (always run, no tool dependency)

```bash
uv run .claude/skills/verify-l10n-pr/scripts/structural_check.py \
  src/resources/language/_language.yml \
  src/resources/language/_language-<code>.yml
```

Catches: missing/extra keys vs. the base English file, `{0}`/`{1}`-style placeholder mismatches, empty values where the base has content, raw trailing whitespace on the line (what `git diff --check` flags), and a heuristic check for quarto's accessibility rule that `navigation-*-label` values must not contain the language's word for "navigation" (screen readers already announce the landmark role — see the rule comment around `src/resources/language/_language.yml:87-96`). That last check is language-agnostic: it compares each label value's words against the same file's `toggle-navigation` value, which is expected to contain the word. A shared stem is a likely violation worth a look, not a certain one — always confirm before commenting on the PR.

On Windows, run via PowerShell or Git Bash with `PYTHONIOENCODING=utf-8` set — `uv run` scripts printing non-Latin script (Cyrillic, Arabic, CJK, etc.) hit `UnicodeEncodeError` on Windows' default console codepage otherwise.

## Step 2 — MT spot-check (optional, only if a translation MCP is connected)

Check whether `mcp__lara-translate__translate` (or an equivalent translation MCP) is available in this session. If not, **say so plainly in the review and stop here** — the structural checks above still stand on their own; don't attempt MT verification with tools known to be unreliable for this (see `references/why-not-libretranslate.md`).

If Lara (or similar) is available, read `references/mt-spot-check.md` before running it — it covers the `context` parameter, how to read the results, and a real false-positive this technique produces (`navigation-*-label` again) that you must not miss.

## Step 3 — Writing up findings

If this produces PR review comments, use the `gh-issue-style` skill for voice before drafting. Don't reference this skill, its scripts, or any MCP/tool name in the public comment — describe findings by what they are (a missing placeholder, a possible accessibility-rule conflict), not how you found them.
