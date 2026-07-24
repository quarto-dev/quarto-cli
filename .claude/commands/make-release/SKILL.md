---
name: make-release
description: Drive a Quarto release end-to-end from the dev-docs release checklists. Invoke explicitly with /make-release — do not auto-invoke from ambient conversation, a release cut is high-stakes. Detects whether this is the first stable release of a new major.minor cycle or a patch release on an existing stable branch, then follows the matching checklist, verifying real git/gh state at each step and pausing for explicit human confirmation before every irreversible or externally-visible action.
---

# Make Release

Command-only helper that drives an existing release checklist. **Do not auto-invoke** — only run when the user explicitly asks (e.g. `/make-release`). This skill does not restate the release steps; the checklists below are the source of truth. Your job is to read the right one and drive it with real-state verification and confirmation gates.

## 1. Detect which checklist applies (verify, don't trust self-report)

Check real repo state, not the user's description:

```bash
git ls-remote --heads origin v1.x   # substitute the target major.minor, e.g. v1.10
```

- Branch **absent** → first stable release of a new cycle → drive
  `dev-docs/checklist-make-a-new-quarto-release.md`
- Branch **present** → patch release on an existing stable branch → drive
  `dev-docs/checklist-make-a-new-stable-quarto-release.md`

If it's still ambiguous (e.g. the user's target version is unclear), ask before proceeding.

## 2. Drive the checklist top to bottom, verifying real state

Read the matching checklist and work it in order. At each step, confirm the real state with `git`/`gh` rather than trusting the checklist text or the user's word that something happened — e.g. that a branch/tag exists, a workflow run actually succeeded (`gh run view <id>`), a release's flags are set, a version field is what it should be. A step isn't done until real state confirms it.

## 3. Hard-confirm gates (stop and get explicit human OK before running)

Never fire these on your own — state exactly what you're about to do, to which repo, and wait for an explicit go:

- Pushing the new stable branch (`git push origin v1.x`)
- Pushing version-bump / release-checklist commits to `main`
- Any `workflow_dispatch` carrying a publish flag (e.g. `publish-release=true`, chocolatey publish checkbox, Cloudsmith `dry-run=false`)
- Editing a live GitHub release's flags (pre-release / "Set as latest release")
- Pushing the release tag
- Production package-registry publishes: pypi (`Production Release`), chocolatey, Cloudsmith manual publish

Dry-runs and read-only verification don't need a gate — run them freely.

## 4. Cross-repo flow

Three repos are involved, with real ordering dependencies:

- `quarto-dev/quarto-cli` — the release build and tag
- `quarto-dev/quarto-web` — quarto.org site, downloads, highlights, announcement
- `quarto-dev/quarto-cli-pypi` — pypi publish

Ordering matters: e.g. quarto-cli's release build must fully publish before quarto-web's `update-downloads.yml` will pick it up, and chocolatey waits on the quarto.org download page updating. State which repo each step targets. Use `gh --repo <owner>/<name> ...` so verification works even without a local clone of every repo.

**No local quarto-web clone:** if a step needs local content edits to quarto-web (e.g. the `docs/prerelease/<version>/` highlights `.qmd` files, or `_quarto.yml` edits) and no local quarto-web clone is present, stop and ask the user for the clone path or to make the edit themselves. Do not attempt the edit through the GitHub API and do not silently skip the step.

**Release announcement:** the announcement post is published on the Posit Open Source site (opensource.posit.co), not via a quarto-web blog PR (blog migrated June 2026). Point the user there; do not name any internal publishing tool.

## 5. When the checklist doesn't match reality

If a step's described state doesn't match what you find (stale path, wrong ordering, already done, renamed workflow), surface the discrepancy and get a human decision. Don't silently work around it, and don't edit the checklist mid-release — suggest a follow-up doc-fix PR instead.

## 6. Non-blocking gaps found along the way

If you spot a non-blocking gap during the release (e.g. a CI automation that only covers one branch, a doc-archival gap), don't try to fix it inline. Tell the user to track it in whatever task tracker they/their project use, and continue the release.
