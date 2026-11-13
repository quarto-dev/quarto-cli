All changes included in 1.12:

## Dependencies

- ([#15275](https://github.com/quarto-dev/quarto-cli/pull/15275)): Update dependencies:
  - Update `dart-sass` to 1.107.1.
  - Update `esbuild` to 0.28.2 (fixes a CSS minification bug involving `&` and a TypeScript import-alias tree-shaking bug).
  - Update `typst-gather` to 0.2.4.
  - Update `verapdf` to 1.30.3 (used by `quarto install verapdf` for PDF/A validation).
- ([#15320](https://github.com/quarto-dev/quarto-cli/pull/15320)): Update `pandoc` to 3.13. Pandoc changes that alter existing documents:
  - A duplicated key in a YAML bibliography file, such as two `title` fields in one reference, or in a YAML metadata block after the front matter, now stops the render with an error. Before, the last value was kept.
  - In Word output, cross-reference targets are hidden bookmarks with generated names. Links inside the document still work, but a link from outside it to a Quarto id, such as `report.docx#fig-plot`, no longer finds the target.
  - In Word output, an image width given as a percentage is now a percentage of the text width, so small images can get larger.
  - In PowerPoint output, a slide with text followed by a table now uses the "Title and Content" layout instead of "Content with Caption", and a slide with bullets, a table and more bullets is no longer split in two.
  - HTML without the Bootstrap theme (`minimal: true`, `theme: none`, `theme: pandoc`) and Pandoc's other HTML formats now render math as MathML when no `html-math-method` is set, instead of plain text. Set `html-math-method: plain` for the previous output.
  - The `--katex`, `--mathjax`, `--mathml` and `--webtex` options of `quarto render` still work but now print a deprecation warning pointing to `--math-method`.
  - In citeproc bibliographies, a lowercase particle written in a `family` name, such as `de Gaulle`, now stays part of it, so the entry sorts under "d". Use the `non-dropping-particle` field to keep the previous sorting.
  - YAML metadata blocks after the front matter are now read as YAML 1.2, so `yes` and `no` there are strings, as they already were in the front matter.
  - In Typst output, a Div with a `typst-label` attribute now gets that Typst label, and a Span with `lang` sets the text language.
  - A nested ordered list must now start at 1. An item `1. one` followed by an indented `3. sub3` no longer starts a sublist: `3. sub3` is plain text in the parent item.
  - ([#14987](https://github.com/quarto-dev/quarto-cli/issues/14987)): Fix Typst compilation failing on math such as `$[x]^T \in A$`, where the space after an escaped expression was dropped (`unknown variable: Tin`).

## Accessibility

- ([#15269](https://github.com/quarto-dev/quarto-cli/pull/15269)): Announce every link that opens a new tab to screen readers, not only links opened by `link-external-newwindow`. (author: @mcanouil)
- ([#15306](https://github.com/quarto-dev/quarto-cli/issues/15306)): Fix the notebook preview title taking the theme's heading color on the primary-colored header bar, which left it low-contrast or unreadable with themes such as `lux` or a custom `$headings-color`. The title now uses the same color as the header buttons. (author: @SabyaXSachi)

## Formats

### All Formats

- ([#15344](https://github.com/quarto-dev/quarto-cli/pull/15344)): A Div with an id that starts with a heading now renders as that heading's section, which takes the Div's classes, so CSS such as `div.myclass > section` no longer matches. Quarto keeps the heading id on the section, so crossrefs and table of contents links still target the heading; in beamer, DocBook, ConTeXt, AsciiDoc and revealjs the Div's id is no longer written.

### `html`

- ([#9606](https://github.com/quarto-dev/quarto-cli/issues/9606)): Fix `format-links` entries written as `{format, text}` adding a second, default link for the same format instead of renaming its link.
- ([#15269](https://github.com/quarto-dev/quarto-cli/pull/15269)): Fix `link-external-newwindow` overriding a `target` set explicitly on a link. (author: @mcanouil)
- ([#15297](https://github.com/quarto-dev/quarto-cli/issues/15297)): Fix the table of contents highlight not following the scroll position when a heading id contains a `%` or a `:`. (author: @chenyangsu)
- ([#15320](https://github.com/quarto-dev/quarto-cli/pull/15320)): Update `theme: pandoc` to Pandoc 3.13's styles:
  - Links inherit the text color unless `linkcolor` is set, and horizontal rules and table borders follow the text color.
  - Printed output drops backgrounds and uses the 11pt print size of the other Quarto HTML themes.
  - Pandoc 3.13's automatic dark mode is not enabled.

### `pdf`

- ([#15251](https://github.com/quarto-dev/quarto-cli/pull/15251)): Fix algorithm blocks (`#alg-`) being set in italics. Their body is now upright, like definitions, examples and exercises. (author: @mcanouil)
- ([#15320](https://github.com/quarto-dev/quarto-cli/pull/15320)): Update to Pandoc's LaTeX template following Pandoc 3.13 support:
  - Table captions are set with the `caption` package, with a 6pt gap to the table.
  - Footnotes in long tables are placed after the table by Pandoc, and no longer rely on `footnotehyper`.

### `revealjs`

- ([#7378](https://github.com/quarto-dev/quarto-cli/issues/7378)): Add `code-line-fragment-indices` to set the fragment index of each step of stepped `code-line-numbers` highlighting. (author: @mcanouil)

### `typst`

- ([#15168](https://github.com/quarto-dev/quarto-cli/issues/15168)): Fix definitions, examples and exercises being set in italics in Typst output with the default `theorem-appearance: simple`. Their body is now upright, as in LaTeX output, while theorems, lemmas, corollaries, propositions and conjectures keep an italic body. (author: @mcanouil)
- ([#15251](https://github.com/quarto-dev/quarto-cli/pull/15251)): Fix algorithm blocks (`#alg-`) being set in italics with `theorem-appearance: simple` and using the colours of theorems with `theorem-appearance: fancy`. They now look like definitions, examples and exercises. (author: @mcanouil)
- ([#15320](https://github.com/quarto-dev/quarto-cli/pull/15320)): Update to Pandoc's Typst template following Pandoc 3.13 support:
  - Horizontal rules are full-width, using Typst 0.15's native `divider`. A Typst binary set with `QUARTO_TYPST` must be 0.15 or later.
  - In a tight definition list, a one-paragraph definition now sits on the same line as its term.
  - Bibliographies apply the hanging indent and entry spacing of the CSL style, which were dropped before.

## Projects

### `website`

- ([#15269](https://github.com/quarto-dev/quarto-cli/pull/15269)): Fix listing `image-alt` values containing quotes or `&` rendering broken or double-escaped alt text. (author: @mcanouil)
- ([#15269](https://github.com/quarto-dev/quarto-cli/pull/15269)): Add `target` and `rel` options to listings and listing items, with the listing value as the default for its items. (author: @mcanouil)

## Commands

### `quarto preview`

- ([#14783](https://github.com/quarto-dev/quarto-cli/issues/14783)): Fix `quarto preview` ignoring project metadata contributed by an extension, such as `brand`. Contributed project metadata now applies to every command that builds a project context, `quarto inspect` included. (author: @mcanouil)
- ([#15266](https://github.com/quarto-dev/quarto-cli/issues/15266)): Fix `quarto preview` keeping the project metadata an extension contributed at startup, such as `brand`, after its `_extension.yml` changes.

### `quarto render`

- ([#15321](https://github.com/quarto-dev/quarto-cli/pull/15321)): Support Pandoc's `--math-method` option, so `--math-method=katex` works with `--embed-resources` and in `llms.md` output, as `--katex` does.
- ([#15358](https://github.com/quarto-dev/quarto-cli/pull/15358)): Fix equation numbers missing from HTML output when the math method is chosen with `--mathml` or `--math-method`.

## Extensions

- ([#15063](https://github.com/quarto-dev/quarto-cli/issues/15063)): Fix a format extension's own `language` file stopping the render with a "does not exist" error, and its `metadata-files` being ignored. Both now resolve relative to the extension's directory, and per-language files such as `_language-fr.yml` load beside the `language` file. (author: @mcanouil)

## Engines

### `jupyter`

- ([#15361](https://github.com/quarto-dev/quarto-cli/issues/15361)): Fix a render failing with `[Errno 2] No such file or directory: '<name>.quarto_ipynb'` when `quarto inspect` runs on the same document at the same time, as the Posit Publisher extension in Positron does on every save. (author: @EnginKarahan)

## Other fixes and improvements

- ([#14389](https://github.com/quarto-dev/quarto-cli/pull/14389)): Add `ar` (Arabic) language translation. The `skip-to-content`, `navigation-*-label`, `scrollable-*-label`, `link-external-newwindow-label`, `announcement-dismiss-label` and `revealjs-menu-button-label` keys use reviewed machine translation. (author: @ezAldinWaez)
- ([#14822](https://github.com/quarto-dev/quarto-cli/issues/14822)): Translate the `tools-share`, `tools-download`, and `skip-to-content` language keys in Greek. (author: @sogav21)
- ([#14822](https://github.com/quarto-dev/quarto-cli/issues/14822)): The Lithuanian search label and the Swedish caution callout title no longer fall back to English.
- ([#14822](https://github.com/quarto-dev/quarto-cli/issues/14822)): Translate the `title-block-modified` language key in Korean, and the `code-links-title`, `launch-binder-title`, `launch-dev-container-title`, `listing-page-field-wordcount` and `listing-page-words` language keys in Serbian (Latin), using reviewed machine translation.
- ([#15126](https://github.com/quarto-dev/quarto-cli/issues/15126)): Translate the `revealjs-menu-button-label` language key in Brazilian Portuguese (author: @bonijoao), and, using reviewed machine translation, in Azerbaijani, Basque, Bulgarian, Catalan, Chinese, Czech, Finnish, German, Hebrew, Icelandic, Indonesian, Italian, Japanese, Korean, Lithuanian, Norwegian Bokmål, Norwegian Nynorsk, Polish, Portuguese, Russian, Serbian (Latin), Slovak, Slovenian, Spanish, Swedish, Turkish and Ukrainian.
- ([#15225](https://github.com/quarto-dev/quarto-cli/pull/15225)): Fix several Brazilian Portuguese (`pt-BR`) translations, including the table of contents title (now "Sumário") and the proof title (now "Demonstração"), and translate the `link-external-newwindow-label` language key. (author: @bonijoao)
- ([#15260](https://github.com/quarto-dev/quarto-cli/issues/15260)): Translate the `link-external-newwindow-label` language key, the new-tab announcement for external links, in Basque, Catalan, Chinese (Simplified and Traditional), Czech, Danish, Dutch, Finnish, French, Hebrew, Icelandic, Indonesian, Italian, Japanese, Korean, Lithuanian, Norwegian Bokmål, Norwegian Nynorsk, Polish, Portuguese, Russian, Serbian (Latin), Slovak, Slovenian, Spanish, Swedish, Turkish and Ukrainian, using reviewed machine translation.
- ([#15268](https://github.com/quarto-dev/quarto-cli/issues/15268)): Translate the `skip-to-content` language key in Bulgarian, Catalan, Czech, Danish, Finnish, Hebrew, Indonesian, Korean, Lithuanian, Norwegian Bokmål, Norwegian Nynorsk, Polish, Russian, Serbian (Latin), Slovak, Slovenian, Swedish, Turkish and Ukrainian, using reviewed machine translation.
- ([#15271](https://github.com/quarto-dev/quarto-cli/issues/15271)): Translate the `tools-share` and `tools-download` language keys in Catalan, Chinese, Czech, Danish, Dutch, Finnish, French, German, Hebrew, Indonesian, Italian, Japanese, Korean, Lithuanian, Norwegian Bokmål, Norwegian Nynorsk, Polish, Portuguese, Russian, Slovak, Swedish, Turkish and Ukrainian, and `tools-share` in Serbian (Latin), using reviewed machine translation.
- ([#15289](https://github.com/quarto-dev/quarto-cli/issues/15289)): Translate the `announcement-dismiss-label` language key, the accessible name of the close button of a website announcement, in Azerbaijani, Basque, Bulgarian, Catalan, Chinese (Simplified and Traditional), Czech, Dutch, Finnish, French, German, Hebrew, Icelandic, Indonesian, Italian, Japanese, Korean, Lithuanian, Norwegian Nynorsk, Polish, Portuguese, Russian, Serbian (Latin), Slovak, Slovenian, Spanish, Swedish, Turkish and Ukrainian, using reviewed machine translation.
- ([#15325](https://github.com/quarto-dev/quarto-cli/issues/15325)): Validate and offer completion for `column`, `fig-column` and `tbl-column` in document front matter. They already took effect there, but an invalid value was silently accepted.
- ([#15341](https://github.com/quarto-dev/quarto-cli/issues/15341)): Fix non-ASCII characters in large output from external tools such as Pandoc, knitr or LaTeX occasionally turning into `�`.
