## Updating the bundled version of Pandoc

Updating Pandoc happens in two phases. Phase 1 (prep) needs no S3 access and can be done by anyone; Phase 2 (archival) is done by whoever holds S3 write credentials, right before merge.

### Phase 1 - prep (no S3, anyone)

Regenerate the reference copies and `src/core/pandoc/format-extension.ts`, port relevant changes to Quarto's templates, and verify rendering. Keep `configuration`'s `export PANDOC=` line at the archived version so `./configure.sh`/`.cmd` continues to work.

Run the template/variant regeneration with `--skip-archive`, pointing `QUARTO_PANDOC` at an executable of the target version:

```bash
QUARTO_PANDOC=/path/to/pandoc-3.10.1/bin/pandoc \
  ./package/src/quarto-bld update-pandoc 3.10.1 --skip-archive
```

`--skip-archive` skips S3 archival, the `configureDependency` download, and the `configuration` rewrite. It still runs `writePandocTemplates` to regenerate the mapped template files and `writeVariants` to regenerate `format-extension.ts`.

`QUARTO_PANDOC` is required: `writeVariants` uses that binary to enumerate formats and extensions. The command checks its version before regenerating files. Review and commit the resulting working-tree diff.

`writePandocTemplates` overwrites the reference copies and mapped Pandoc partials such as `fonts.latex` and `hypersetup.latex`. Port relevant changes to Quarto's templates using the [file list below](#pandoc-templates). Review generated changes to `format-extension.ts` as well. The same review applies to the full Phase 2 run.

To smoke-test rendering before archival, dispatch `.github/workflows/test-smokes.yml` with `pandoc-override-version` set to the new release tag (e.g. `3.10.1`). The workflow downloads Pandoc from GitHub and uses it via `QUARTO_PANDOC` for that run, without S3 access. Limit `buckets` to the relevant smoke-all directories (e.g. `typst`, `latex`, `table`) for a faster run. A full-suite run also works: the action exports the requested version as `QUARTO_TEST_EXPECTED_PANDOC`, and the `check versions` smoke test then verifies Pandoc reports exactly that version (as the strict-mismatch note, or as OK when it equals the bundled constraint) instead of failing on the note.

### Phase 2 - archival (S3 credential holder, before merge)

Whoever holds S3 write credentials does this last, right before merging:

- [ ] Bump `configuration`'s `export PANDOC=` line and the `Pandoc` entry in `src/command/check/check.ts`'s `versionConstraints` array to the new version (this constraint tracks the bundled version exactly).
- [ ] Ensure archives are upgraded.
- [ ] Run `AWS_PROFILE=... ./package/src/quarto-bld update-pandoc PANDOC_VERSION` (without `--skip-archive`) to archive the binary to S3, configure it locally, and regenerate templates/variants.
- [ ] Look at `git diff`, specifically for changes in Pandoc templates, and adjust as needed. As in Phase 1, a diff on an already-patched file means something was missed.
- [ ] Run the `create-release.yml` dry-run signing/notarization gate (see `dev-docs/upgrade-dependencies.md`), then merge.

Quarto's templates share directories with the Pandoc reference copies, but use different names. Review the reference-copy diffs and port relevant changes manually; the templates have diverged too much to use `patch`.

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

Typst keeps Pandoc's `template.typst` partial under its original name alongside the renamed `typst.template`. See `llm-docs/pandoc-quarto-typst-templates.md` for Quarto's partials.

The files labelled "Pandoc's" are reference copies used to review upstream changes. Rendering uses the corresponding "Ours" files and their partials, such as `tables.tex` and `toc.tex`.

- Regenerate reference copies from upstream with `writePandocTemplates`; apply rendering changes to Quarto's templates and partials.
- Keep reference copies identical to upstream, including any upstream typos. Manual edits are overwritten on regeneration. Fix upstream bugs in Quarto's templates.
- List the directory without filtering by extension when checking the files: `*.latex` excludes `latex.common`, which ends in `.common`.

## Manual steps

- [ ] Update schemas by inspecting [their changelog](https://github.com/jgm/pandoc/blob/main/changelog.md) for new commands, deprecation removals, etc
  - A template change that introduces a variable or option that didn't exist before is a new Pandoc capability, not a fix. Port the template plumbing for parity in the bump, but file the Quarto-side schema exposure as separate work: research how it fits Quarto, and test for clashes with Quarto features that already cover the same ground (Quarto sometimes deliberately blocks or replaces a Pandoc feature).
- [ ] Update lua-types if needed by inspecting the diff of [lua-filters.md](https://github.com/jgm/pandoc/commits/main/doc/lua-filters.md)
- [ ] Check [`quarto-dev/quarto`](https://github.com/quarto-dev/quarto) (the visual-editor / VS Code tooling repo) for roundtrip **snapshot** test breakage on the next **prerelease**. Pandoc Markdown-*writer* changes — e.g. display-math newline handling, bullet/definition-list indentation — change visual-editor roundtrip output and break `apps/vscode/src/test/examples/generated_snapshots/*.qmd`. If output changed, open a companion PR there to regenerate the affected snapshots. Before regenerating, confirm each change is *intended* Pandoc behavior and not a transient regression (a bad snapshot can freeze a bug — see [quarto-dev/quarto#944](https://github.com/quarto-dev/quarto/pull/944)). Cross-ref: [`cross-project-dependencies.md`](cross-project-dependencies.md).
