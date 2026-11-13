---
name: updating-pandoc
description: Use when bumping the bundled Pandoc version in quarto-cli (the `export PANDOC=` line in `configuration`), planning or scoping such a bump, triaging test failures or snapshot changes caused by one, or deciding what to do when a new jgm/pandoc release appears while a bump is in progress.
---

# Updating the Bundled Pandoc

`dev-docs/update-pandoc-checklist.md` is the procedure for the mechanical part of a bump. It covers the two phases (prep with `--skip-archive`, then S3 archival by the credential holder), the reference-copy vs Quarto-template file map, schema and Lua type updates, the `create-release.yml` signing dry-run, and the quarto-dev/quarto snapshot check. Read it first. This skill sequences the bump around it and adds the steps that previous bumps missed: writer changes that shipped unnoticed, tests rewritten to match a regression, a merge before S3 archival, and downstream breakage found only after release.

## Stages

| # | Stage | What to do | Reference |
|---|-------|------------|-----------|
| 1 | Scope | Run the version-to-version probes before porting anything: Lua API version, formats and extensions, CLI options, template diff, writer probes. | `references/version-probes.md` |
| 2 | Changelog triage | Read the Pandoc changelog for every release in the range. Track one work item per risk (a GitHub issue, or your own tracker linked from the bump PR), each with a repro rendered on old and new Pandoc. A regression blocks the merge until fixed, in the bump PR or a PR stacked on it. A pre-existing Quarto bug found along the way is tracked separately as discovered during the bump, not as part of it, so it does not hold the bump open. | `version-probes.md`, "Changelog triage" |
| 3 | Prep (Phase 1) | Regenerate the reference copies, port the templates, update schemas and Lua types. | `dev-docs/update-pandoc-checklist.md`; `llm-docs/pandoc-quarto-latex-templates.md`; `llm-docs/pandoc-quarto-typst-templates.md` |
| 4 | CLI options | For each Pandoc CLI option added, renamed or deprecated in the range, check how `quarto render` handles it in `parseRenderFlags` (`src/command/render/flags.ts`). An option Quarto does not detect still reaches Pandoc, but Quarto's own handling (math method, output detection) then works from the wrong value. | `version-probes.md`, "CLI options" |
| 5 | Test triage | Classify every failure as drift or regression **against the old Pandoc** before touching any expected output. | Skill `triage-ci-failures`, plus "Drift or regression" below |
| 6 | Merge gates | In this order: Phase 2 archival by the credential holder, and its commit pushed to the PR; the S3 archives confirmed by URL; all PR CI green on the archived version, including the packaged-bundle job (`test-bundle.yml`, the only job that catches the 200-local Lua limit after filter ports, see `llm-docs/lua-filter-bundle-local-limit.md`) and the feature-format matrix on Windows (`test-ff-matrix.yml`); then the `create-release.yml` dry-run. The release jobs run `configure`, so the dry-run only tests the new binary once it is archived. | "Merge gates" below |
| 7 | Changelog and docs | Add a `news/changelog-<version>.md` entry, plus a quarto-web PR to the `prerelease` branch for `docs/prerelease/<version>/_highlights.qmd` and the format pages that changed. | `.claude/rules/changelog.md`; "Changelog entry" below |
| 8 | After the prerelease ships | Check the `quarto-dev/quarto` pre-release CI leg and the extension templates. | "Downstream checks" below |

A stage is done when its output exists: probe results recorded, one work item per risk, a drift-or-regression verdict with evidence per failure, and green gates.

## Drift or regression

`triage-ci-failures` defines the two verdicts. For a Pandoc bump the evidence is a render of the same document on both versions:

```bash
QUARTO_PANDOC=/path/to/pandoc-<old>/bin/pandoc package/dist/bin/quarto render doc.qmd -o old.html
package/dist/bin/quarto render doc.qmd -o new.html   # bundled = new version
```

Copy the old bundled binary to a scratch directory at stage 1: Phase 2's `configure` replaces it. `QUARTO_PANDOC` keeps everything except Pandoc fixed. Use the previous Quarto release only when the old binary is gone, and then rule out Quarto changes before blaming Pandoc. A changelog entry that explains a change makes it a candidate for drift, not a proven case: confirm that the new output is still correct for users (links resolve, crossrefs work, content is present). Update an assertion only after that check, and name the upstream change in the commit.

## Merge gates

The S3 archive must exist before `configuration` names the version, because `configure` downloads from the archive URL whatever `QUARTO_PANDOC` did locally. Check every platform file:

```bash
v=3.13
for f in windows-x86_64.zip linux-amd64.tar.gz x86_64-macOS.zip linux-arm64.tar.gz arm64-macOS.zip; do
  printf '%s ' "$f"; curl -sI -o /dev/null -w "%{http_code}\n" \
    "https://s3.amazonaws.com/rstudio-buildtools/quarto/pandoc/$v/pandoc-$v-$f"
done   # 200 = archived; 403 = missing
```

A deadline does not move this gate. If the credential holder is unavailable, the bump waits; say so to the maintainer rather than editing `configuration`.

## Changelog entry

Write one `Update pandoc to X` bullet under Dependencies. Give a Pandoc change its own sub-bullet only if it closes a Quarto issue, or if it makes a working document fail or change visibly without an error. Leave other upstream changes to the Pandoc changelog. Format-specific consequences (template ports, a theme that intentionally does not adopt an upstream feature) go under that format's section.

## Downstream checks

- **quarto-dev/quarto (visual editor).** Its `test.yaml` runs a `pre-release` matrix leg against the latest Quarto prerelease. Roundtrip snapshots under `apps/vscode/src/test/examples/generated_snapshots/` break when the Markdown writer output changes, and that leg fails on every quarto-dev/quarto PR from the day the prerelease ships. Check it that day (`gh run list -R quarto-dev/quarto -w test.yaml`, then open the latest run and look at the `Test (Quarto pre-release)` job). A plain `pandoc -t markdown` probe can miss the change, because the editor passes its own options and extensions. The companion-PR procedure is the last item of `dev-docs/update-pandoc-checklist.md`. This check is part of the bump even when the task framing says the editor is someone else's concern.
- **Extension templates.** quarto-journals formats and typst templates ship their own partials, which override the Quarto partials just ported. Render a few of each (LaTeX journals, typst templates) on the new build and on the previous release, using a document that exercises the changed areas (tables with captions and footnotes, horizontal rules, definition lists, citations), and diff the `.tex`/`.typ` output.

## A new Pandoc release mid-cycle

When Pandoc releases again before the bump merges, either stay on the current target or move to the new release. Decide by what the new release changes in templates and writers (run stage 1 on it). Staying is the default once porting is done. Record what a later bump will need as its own work item, with a command that proves the need still exists (for example a template diff against current Pandoc), so the next bump starts from it.

## Environment gotchas

- On Windows, run `configure.cmd` from PowerShell or cmd, not Git Bash. Git Bash's PATH resolves `tar` to GNU tar, which cannot extract the Dart Sass `.zip`.
- `quarto-bld update-pandoc` without `--skip-archive` runs `aws s3 ls` on every platform file, even for a version already archived, so it needs a live AWS session. Any error text other than `Unable to locate credentials` is read as "already archived" (`package/src/common/archive-binary-dependencies.ts`), so run the URL check above after the command.
- `gh api repos/jgm/pandoc/compare/A...B` lists at most 300 files without `--paginate`. Template changes go missing silently in a multi-release range.

## Common mistakes

| Mistake | Instead |
|---------|---------|
| Scoping from the changelog alone | Run the probes too; writer changes are not always listed under the writer's changelog heading. |
| One tracking item for the whole bump | One item per risk, each with an old-vs-new repro. |
| Calling a failure drift because the changelog explains it | Render on old and new Pandoc and check that the new output is correct for users. |
| Treating quarto-dev/quarto as out of scope | Its pre-release leg is part of the bump's fallout; check it when the prerelease ships. |
| Pointing `configuration` at an unarchived version because local configure worked | Local runs used `QUARTO_PANDOC`; CI and contributors download from S3. Check the URLs first. |
