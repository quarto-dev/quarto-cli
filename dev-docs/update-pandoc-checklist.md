## Updating the bundled version of Pandoc

Template and rendering changes can be smoke-tested before archival: dispatch `.github/workflows/test-smokes.yml` with the `pandoc-override-version` input set to the new release tag (e.g. `3.10.1`). It downloads that Pandoc release directly from GitHub, points `quarto` at it via `QUARTO_PANDOC` for that run only, and leaves the archived/configured version untouched - no S3 access needed. Scope `buckets` to the relevant smoke-all dirs (e.g. `typst`, `latex`, `table`) for a faster signal.

Carlos needs to run this:

- [ ] Ensure archives are upgraded
- [ ] Run `AWS_PROFILE=... ./package/src/quarto-bld update-pandoc PANDOC_VERSION`
- [ ] look at `git diff`, specifically for changes in Pandoc templates, and adjust as needed.

As a reminder, our templates are kept in the same directories as Pandoc's templates, but with different names. `git diff` will show the diff in Pandoc's template; we have to manually patch
ours. (We can't just use `patch` because the templates have diverged too much)

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

**All of the "Pandoc's" files above are dev-reference-only**: none of them are read by any TypeScript code path (confirmed via `grep -rn "<filename>" src/ --include="*.ts"` returning zero matches for each, across every format listed here). They exist purely so `git diff` against a fresh Pandoc checkout shows what changed upstream - patch the corresponding "Ours" file (or its own sub-partials, e.g. `tables.tex`, `toc.tex`) to actually change rendered behavior, and update the "Pandoc's" copy too so the next resync's diff stays meaningful. It's easy to update one and miss the other (or vice versa) since the filenames differ only by which segment comes first - use an unfiltered `ls`/`Glob **/*` on the directory when checking what's there, not an extension-filtered glob (e.g. `*.latex` silently excludes `latex.common`, which ends in `.common`).

## Manual steps

- [ ] Update schemas by inspecting [their changelog](https://github.com/jgm/pandoc/blob/main/changelog.md) for new commands, deprecation removals, etc
- [ ] Update lua-types if needed by inspecting the diff of [lua-filters.md](https://github.com/jgm/pandoc/commits/main/doc/lua-filters.md)
