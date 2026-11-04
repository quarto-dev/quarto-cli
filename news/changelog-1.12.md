All changes included in 1.12:

## Accessibility

- ([#15269](https://github.com/quarto-dev/quarto-cli/pull/15269)): Announce every link that opens a new tab to screen readers, not only links opened by `link-external-newwindow`. (author: @mcanouil)

## Formats

### `html`

- ([#15269](https://github.com/quarto-dev/quarto-cli/pull/15269)): Fix `link-external-newwindow` overriding a `target` set explicitly on a link. (author: @mcanouil)

### `pdf`

- ([#15251](https://github.com/quarto-dev/quarto-cli/pull/15251)): Fix algorithm blocks (`#alg-`) being set in italics. Their body is now upright, like definitions, examples and exercises. (author: @mcanouil)

### `typst`

- ([#15168](https://github.com/quarto-dev/quarto-cli/issues/15168)): Fix definitions, examples and exercises being set in italics in Typst output with the default `theorem-appearance: simple`. Their body is now upright, as in LaTeX output, while theorems, lemmas, corollaries, propositions and conjectures keep an italic body. (author: @mcanouil)
- ([#15251](https://github.com/quarto-dev/quarto-cli/pull/15251)): Fix algorithm blocks (`#alg-`) being set in italics with `theorem-appearance: simple` and using the colours of theorems with `theorem-appearance: fancy`. They now look like definitions, examples and exercises. (author: @mcanouil)

## Projects

### `website`

- ([#15269](https://github.com/quarto-dev/quarto-cli/pull/15269)): Fix listing `image-alt` values containing quotes or `&` rendering broken or double-escaped alt text. (author: @mcanouil)
- ([#15269](https://github.com/quarto-dev/quarto-cli/pull/15269)): Add `target` and `rel` options to listings and listing items, with the listing value as the default for its items. (author: @mcanouil)

## Commands

### `quarto preview`

- ([#14783](https://github.com/quarto-dev/quarto-cli/issues/14783)): Fix `quarto preview` ignoring project metadata contributed by an extension, such as `brand`. Contributed project metadata now applies to every command that builds a project context, `quarto inspect` included. (author: @mcanouil)
- ([#15266](https://github.com/quarto-dev/quarto-cli/issues/15266)): Fix `quarto preview` keeping the project metadata an extension contributed at startup, such as `brand`, after its `_extension.yml` changes.

## Extensions

- ([#15063](https://github.com/quarto-dev/quarto-cli/issues/15063)): Fix a format extension's own `language` file stopping the render with a "does not exist" error, and its `metadata-files` being ignored. Both now resolve relative to the extension's directory, and per-language files such as `_language-fr.yml` load beside the `language` file. (author: @mcanouil)

## Other fixes and improvements

- ([#14822](https://github.com/quarto-dev/quarto-cli/issues/14822)): Translate the `tools-share`, `tools-download`, and `skip-to-content` language keys in Greek. (author: @sogav21)
- ([#14822](https://github.com/quarto-dev/quarto-cli/issues/14822)): The Lithuanian search label and the Swedish caution callout title no longer fall back to English.
- ([#14822](https://github.com/quarto-dev/quarto-cli/issues/14822)): Translate the `title-block-modified` language key in Korean, and the `code-links-title`, `launch-binder-title`, `launch-dev-container-title`, `listing-page-field-wordcount` and `listing-page-words` language keys in Serbian (Latin), using reviewed machine translation.
- ([#15126](https://github.com/quarto-dev/quarto-cli/issues/15126)): Translate the `revealjs-menu-button-label` language key in Brazilian Portuguese (author: @bonijoao), and, using reviewed machine translation, in Azerbaijani, Basque, Bulgarian, Catalan, Chinese, Czech, Finnish, German, Hebrew, Icelandic, Indonesian, Italian, Japanese, Korean, Lithuanian, Norwegian Bokmål, Norwegian Nynorsk, Polish, Portuguese, Russian, Serbian (Latin), Slovak, Slovenian, Spanish, Swedish, Turkish and Ukrainian.
- ([#15225](https://github.com/quarto-dev/quarto-cli/pull/15225)): Fix several Brazilian Portuguese (`pt-BR`) translations, including the table of contents title (now "Sumário") and the proof title (now "Demonstração"), and translate the `link-external-newwindow-label` language key. (author: @bonijoao)
- ([#15260](https://github.com/quarto-dev/quarto-cli/issues/15260)): Translate the `link-external-newwindow-label` language key, the new-tab announcement for external links, in Basque, Catalan, Chinese (Simplified and Traditional), Czech, Danish, Dutch, Finnish, French, Hebrew, Icelandic, Indonesian, Italian, Japanese, Korean, Lithuanian, Norwegian Bokmål, Norwegian Nynorsk, Polish, Portuguese, Russian, Serbian (Latin), Slovak, Slovenian, Spanish, Swedish, Turkish and Ukrainian, using reviewed machine translation.
- ([#15268](https://github.com/quarto-dev/quarto-cli/issues/15268)): Translate the `skip-to-content` language key in Bulgarian, Catalan, Czech, Danish, Finnish, Hebrew, Indonesian, Korean, Lithuanian, Norwegian Bokmål, Norwegian Nynorsk, Polish, Russian, Serbian (Latin), Slovak, Slovenian, Swedish, Turkish and Ukrainian, using reviewed machine translation.
- ([#15271](https://github.com/quarto-dev/quarto-cli/issues/15271)): Translate the `tools-share` and `tools-download` language keys in Catalan, Chinese, Czech, Danish, Dutch, Finnish, French, German, Hebrew, Indonesian, Italian, Japanese, Korean, Lithuanian, Norwegian Bokmål, Norwegian Nynorsk, Polish, Portuguese, Russian, Slovak, Swedish, Turkish and Ukrainian, and `tools-share` in Serbian (Latin), using reviewed machine translation.
- ([#15289](https://github.com/quarto-dev/quarto-cli/issues/15289)): Translate the `announcement-dismiss-label` language key, the accessible name of the close button of a website announcement, in Azerbaijani, Basque, Bulgarian, Catalan, Chinese (Simplified and Traditional), Czech, Dutch, Finnish, French, German, Hebrew, Icelandic, Indonesian, Italian, Japanese, Korean, Lithuanian, Norwegian Nynorsk, Polish, Portuguese, Russian, Serbian (Latin), Slovak, Slovenian, Spanish, Swedish, Turkish and Ukrainian, using reviewed machine translation.
