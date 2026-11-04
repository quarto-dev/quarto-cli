All changes included in 1.12:

## Accessibility

- ([#13126](https://github.com/quarto-dev/quarto-cli/pull/13126)): Label the pagination control of website listings for screen readers: the control has a localised name, each page link is named "Page n", the current page is marked, and the "..." gaps are no longer focusable. (author: @mcanouil)

## Formats

### `pdf`

- ([#15251](https://github.com/quarto-dev/quarto-cli/pull/15251)): Fix algorithm blocks (`#alg-`) being set in italics. Their body is now upright, like definitions, examples and exercises. (author: @mcanouil)

### `typst`

- ([#15168](https://github.com/quarto-dev/quarto-cli/issues/15168)): Fix definitions, examples and exercises being set in italics in Typst output with the default `theorem-appearance: simple`. Their body is now upright, as in LaTeX output, while theorems, lemmas, corollaries, propositions and conjectures keep an italic body. (author: @mcanouil)
- ([#15251](https://github.com/quarto-dev/quarto-cli/pull/15251)): Fix algorithm blocks (`#alg-`) being set in italics with `theorem-appearance: simple` and using the colours of theorems with `theorem-appearance: fancy`. They now look like definitions, examples and exercises. (author: @mcanouil)

## Projects

### Websites

- ([#13126](https://github.com/quarto-dev/quarto-cli/pull/13126)): Add `pagination` options to listings to set how many page links are shown (`inner-window`, `outer-window`, `outer-window-left`, `outer-window-right`). (author: @mcanouil)

## Commands

### `quarto preview`

- ([#14783](https://github.com/quarto-dev/quarto-cli/issues/14783)): Fix `quarto preview` ignoring project metadata contributed by an extension, such as `brand`. Contributed project metadata now applies to every command that builds a project context, `quarto inspect` included. (author: @mcanouil)
- ([#15266](https://github.com/quarto-dev/quarto-cli/issues/15266)): Fix `quarto preview` keeping the project metadata an extension contributed at startup, such as `brand`, after its `_extension.yml` changes.

## Other fixes and improvements

- ([#14822](https://github.com/quarto-dev/quarto-cli/issues/14822)): Translate the `tools-share`, `tools-download`, and `skip-to-content` language keys in Greek. (author: @sogav21)
- ([#14822](https://github.com/quarto-dev/quarto-cli/issues/14822)): The Lithuanian search label and the Swedish caution callout title no longer fall back to English.
- ([#15126](https://github.com/quarto-dev/quarto-cli/issues/15126)): Translate the `revealjs-menu-button-label` language key in Brazilian Portuguese. (author: @bonijoao)
- ([#15223](https://github.com/quarto-dev/quarto-cli/pull/15223)): Directories are now read in a fixed order (sorted by name in character-code order, not by locale) on every platform.
  Extension discovery, the theme list of `quarto capabilities`, and the items of a MECA bundle no longer depend on the file system's listing order; when two extensions share an id, which one wins can differ from earlier versions.
- ([#15225](https://github.com/quarto-dev/quarto-cli/pull/15225)): Fix several Brazilian Portuguese (`pt-BR`) translations, including the table of contents title (now "Sumário") and the proof title (now "Demonstração"), and translate the `link-external-newwindow-label` language key. (author: @bonijoao)
- ([#15268](https://github.com/quarto-dev/quarto-cli/issues/15268)): Translate the `skip-to-content` language key in Bulgarian, Catalan, Czech, Danish, Finnish, Hebrew, Indonesian, Korean, Lithuanian, Norwegian Bokmål, Norwegian Nynorsk, Polish, Russian, Serbian (Latin), Slovak, Slovenian, Swedish, Turkish and Ukrainian, using reviewed machine translation.
- ([#15271](https://github.com/quarto-dev/quarto-cli/issues/15271)): Translate the `tools-share` and `tools-download` language keys in Catalan, Chinese, Czech, Danish, Dutch, Finnish, French, German, Hebrew, Indonesian, Italian, Japanese, Korean, Lithuanian, Norwegian Bokmål, Norwegian Nynorsk, Polish, Portuguese, Russian, Slovak, Swedish, Turkish and Ukrainian, and `tools-share` in Serbian (Latin), using reviewed machine translation.
