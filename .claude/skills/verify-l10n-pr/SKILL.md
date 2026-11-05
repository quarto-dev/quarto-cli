---
name: verify-l10n-pr
description: Use when reviewing or landing a PR that adds or modifies a `_language-<code>.yml` localization file in `src/resources/language/`. Checks the file against current main, reviews the contributor's values, fills keys added since the PR was opened with reviewed machine translation, and finishes the PR.
---

# Verify a Localization PR

Most quarto-cli maintainers cannot read most of the 30+ languages `src/resources/language/*.yml` covers. This skill separates what is checkable without any language knowledge (structure, parity with main) from what needs a translation second opinion (the meaning of each value), and keeps the contributor's human translations as the authority: machine translation is a reviewer for their values and a filler only for keys they never saw.

Before judging any value, read `src/resources/language/README.md` and `src/resources/language/AGENTS.md`, and the translator note above each key in `_language.yml`. Those notes are the rules contributors were asked to follow.

## Step 1: Duplicates and open questions

List every open PR touching the same file:

```bash
gh pr list --repo quarto-dev/quarto-cli --state open --search "_language-<code>" --json number,title,author,createdAt
```

Several PRs for one language happen (Arabic had two, a month apart, both unreviewed). Compare them key by key and keep one: prefer the one with a native-speaker review or an engaged author, carry over any value from the other that settles an open question, and close the other with thanks and a pointer. Read the whole thread of the one you keep, inline review comments included, and note earlier maintainer questions and suggestion blocks that never got an answer.

Step 1 is done when one PR is chosen and every open question and unapplied suggestion on it is listed.

## Step 2: Structure against current main

Language PRs often sit for months while keys are added to `_language.yml`. Check against main, not the PR's base:

```bash
git fetch upstream main
git show upstream/main:src/resources/language/_language.yml > /tmp/_language-main.yml
uv run .claude/skills/verify-l10n-pr/scripts/structural_check.py \
  /tmp/_language-main.yml \
  src/resources/language/_language-<code>.yml
```

Catches: missing/extra keys, `{0}`/`{1}` placeholder mismatches, empty values where the base has content, trailing whitespace, and a heuristic for the rule that `navigation-*-label` values must not contain the language's word for "navigation" (it compares each label's words against the same file's `toggle-navigation` value; a shared stem is a lead to confirm, not a verdict). On Windows, set `PYTHONIOENCODING=utf-8`, or non-Latin output raises `UnicodeEncodeError`.

`tests/unit/language-parity.test.ts` is the gate CI applies: it fails on any missing key not listed for that language in `tests/unit/language-known-gaps.yml`. Every key Step 2 reports missing ends up either translated (Step 4) or in that list before merge.

## Step 3: Review the contributor's values

Needs a context-aware translation MCP (e.g. `mcp__lara-translate__translate`). If none is connected, say so in the review and rely on Steps 1-2 and native-speaker review; plain free MT fails on this content (`references/why-not-libretranslate.md`).

Read `references/mt-spot-check.md` before running it: it covers the `context` parameter, how to tell a meaning difference from translator variation, and the `navigation-*-label` false positive. Back-translate any value a reviewer or Copilot questioned too, and settle terminology questions with evidence the reader can check (how other language files handle the same pair of keys, an encyclopedia article in that language), not with MT alone.

Step 3 is done when every value is either accepted or listed with a concrete question.

## Step 4: Fill missing keys (when maintainers finish the PR)

Only for keys the contributor never had the chance to translate, typically ones added to `_language.yml` after the PR was opened. Follow `references/fill-missing-keys.md`: translation with each key's translator note as context, two blind reviewers, and only values both accept get committed.

## Step 5: Finish the PR

- Maintainers push the fixup to the contributor branch (maintainer edits are usually allowed): merge main, resolve `README.md` conflicts by taking main's table and adding the language row, add the Step 4 values in `_language.yml` key order and any known-gaps entries, and add the changelog entry to the `news/changelog-<version>.md` matching `QUARTO_VERSION` in `configuration`, crediting the author (`(author: @login)`). Run `unit/language-parity.test.ts` before pushing.
- A native speaker's suggestion from the review goes into that fixup, with a `Co-authored-by:` trailer for the reviewer and a reply in its thread.
- The PR comment lists every machine-translated value in a table, with a plain statement that they are AI-generated and how they were checked. Write it in the maintainer's voice (`gh-issue-style` skill if available) and describe findings by what they are, without naming this skill, its scripts, or any MCP.
- Questions to a silent author do not block the merge. Answer what evidence can settle, keep the contributor's value otherwise, and invite a follow-up PR for anything else.
- A community review of an existing file gets a short approval; the maintainer moves its changelog entry to the current version file if needed.
