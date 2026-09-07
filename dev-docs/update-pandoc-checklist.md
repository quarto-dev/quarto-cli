## Updating the bundled version of Pandoc

Updating Pandoc happens in two phases. Phase 1 (prep) needs no S3 access and can be done by anyone; Phase 2 (archival) is done by whoever holds S3 write credentials, right before merge.

### Phase 1 - prep (no S3, anyone)

Patch Quarto's wired-up template files and regenerate the dev-reference copies + `src/core/pandoc/format-extension.ts`, then verify rendering - all while `configuration`'s `export PANDOC=` line stays pinned at the currently-archived version, so plain `./configure.sh`/`.cmd` keeps working for everyone else.

Run the template/variant regeneration with `--skip-archive`, pointing `QUARTO_PANDOC` at a real binary of the target version:

```bash
QUARTO_PANDOC=/path/to/pandoc-3.10.1/bin/pandoc \
  ./package/src/quarto-bld update-pandoc 3.10.1 --skip-archive
```

`--skip-archive` skips the S3 archival, the `configureDependency` download, and the `configuration` rewrite. It still runs `writePandocTemplates` (regenerates every mapped template + dev-reference copy) and `writeVariants` (regenerates `format-extension.ts`). `QUARTO_PANDOC` is **required** with `--skip-archive`: `writeVariants` shells out to that binary to enumerate formats/extensions, and without the override it would silently regenerate `format-extension.ts` from the old configured Pandoc. The command leaves everything as an uncommitted working-tree diff for you to review and commit yourself; it never commits.

Running `update-pandoc ... --skip-archive` is itself a safety-net checkpoint: if it produces a diff on a template or dev-reference file that Phase 1 was supposed to have already hand-patched, Phase 1 missed that file - exactly the naming trap described below (this bit twice in one session, on `latex.common` and on the real `styles.html`). A diff limited to `format-extension.ts` is a normal generated change to review, not a miss. The same checkpoint applies to the full Phase 2 run.

Rendering changes can also be smoke-tested before archival: dispatch `.github/workflows/test-smokes.yml` with the `pandoc-override-version` input set to the new release tag (e.g. `3.10.1`). It downloads that Pandoc release directly from GitHub, points `quarto` at it via `QUARTO_PANDOC` for that run only, and leaves the archived/configured version untouched - no S3 access needed. Scope `buckets` to the relevant smoke-all dirs (e.g. `typst`, `latex`, `table`) for a faster signal.

### Phase 2 - archival (S3 credential holder, before merge)

Whoever holds S3 write credentials does this last, right before merging:

- [ ] Bump `configuration`'s `export PANDOC=` line and the `Pandoc` entry in `src/command/check/check.ts`'s `versionConstraints` array to the new version (this constraint tracks the bundled version exactly).
- [ ] Ensure archives are upgraded.
- [ ] Run `AWS_PROFILE=... ./package/src/quarto-bld update-pandoc PANDOC_VERSION` (without `--skip-archive`) to archive the binary to S3, configure it locally, and regenerate templates/variants.
- [ ] Look at `git diff`, specifically for changes in Pandoc templates, and adjust as needed. As in Phase 1, a diff on an already-patched file means something was missed.
- [ ] Run the `create-release.yml` dry-run signing/notarization gate (see `dev-docs/upgrade-dependencies.md`), then merge.

As a reminder, our templates are kept in the same directories as Pandoc's templates, but with different names. `git diff` will show the diff in Pandoc's template; we have to manually patch ours. (We can't just use `patch` because the templates have diverged too much)

### Pandoc templates

The general rule for the naming is that "format.template" indicates Pandoc naming, and "template.format" indicates ours. Examples below:

#### beamer

- Pandoc's: src/resources/formats/beamer/pandoc/beamer.template
- Ours: src/resources/formats/beamer/pandoc/template.tex

Partials:

- Pandoc's:
  - src/resources/formats/beamer/pandoc/latex.common
- Ours:
  - src/resources/formats/beamer/pandoc/common.latex

#### pdf / latex

- Pandoc's: src/resources/formats/pdf/pandoc/latex.template
- Ours: src/resources/formats/pdf/pandoc/template.tex (see `llm-docs/pandoc-quarto-latex-templates.md` for the full partial breakdown, including `latex.common`/`common.latex`)

#### html

- Pandoc's: src/resources/formats/html/pandoc/html.template, src/resources/formats/html/pandoc/html.styles
- Ours: src/resources/formats/html/pandoc/template.html, src/resources/formats/html/pandoc/styles.html

#### revealjs

- Pandoc's: src/resources/formats/revealjs/pandoc/revealjs.template
- Ours: src/resources/formats/revealjs/pandoc/template.html

#### asciidoc

- Pandoc's: src/resources/formats/asciidoc/pandoc/asciidoc.template
- Ours: src/resources/formats/asciidoc/pandoc/template.asciidoc

#### typst

See `llm-docs/pandoc-quarto-typst-templates.md` - typst has an extra wrinkle where Pandoc's own `template.typst` partial is also kept verbatim (same filename) alongside the renamed `typst.template`.

**All of the "Pandoc's" files above are dev-reference-only**: none of them are read by any TypeScript code path (confirmed via `grep -rn "<filename>" src/ --include="*.ts"` returning zero matches for each, across every format listed here). They exist purely so `git diff` against a fresh Pandoc checkout shows what changed upstream - patch the corresponding "Ours" file (or its own sub-partials, e.g. `tables.tex`, `toc.tex`) to actually change rendered behavior, and update the "Pandoc's" copy too so the next resync's diff stays meaningful. It's easy to update one and miss the other (or vice versa) since the filenames differ only by which segment comes first - use an unfiltered `ls`/`Glob **/*` on the directory when checking what's there, not an extension-filtered glob (e.g. `*.latex` silently excludes `latex.common`, which ends in `.common`). Because `writePandocTemplates` (in `package/src/common/update-pandoc.ts`) overwrites every "Pandoc's" copy wholesale on each run, never hand-fix an upstream bug in one of those reference copies - the change would silently vanish on the next resync, and the reference copy must stay byte-identical to upstream so the diff stays meaningful. (This session deliberately preserved a real upstream typo in `typst.template`'s divider-fallback polyfill for exactly this reason.) Behavioral fixes belong only in the corresponding "Ours" file (or its sub-partials).

## Manual steps

- [ ] Update schemas by inspecting [their changelog](https://github.com/jgm/pandoc/blob/main/changelog.md) for new commands, deprecation removals, etc
- [ ] Update lua-types if needed by inspecting the diff of [lua-filters.md](https://github.com/jgm/pandoc/commits/main/doc/lua-filters.md)
- [ ] Check [`quarto-dev/quarto`](https://github.com/quarto-dev/quarto) (the visual-editor / VS Code tooling repo) for roundtrip **snapshot** test breakage on the next **prerelease**. Pandoc Markdown-*writer* changes — e.g. display-math newline handling, bullet/definition-list indentation — change visual-editor roundtrip output and break `apps/vscode/src/test/examples/generated_snapshots/*.qmd`. If output changed, open a companion PR there to regenerate the affected snapshots. Before regenerating, confirm each change is *intended* Pandoc behavior and not a transient regression (a bad snapshot can freeze a bug — see [quarto-dev/quarto#944](https://github.com/quarto-dev/quarto/pull/944)). Cross-ref: [`cross-project-dependencies.md`](cross-project-dependencies.md).
