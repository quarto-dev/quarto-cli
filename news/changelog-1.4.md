## Giscus Dark Mode Themes

- ([#4820](https://github.com/quarto-dev/quarto-cli/issues/4820)): Add support for setting the Giscus light/dark themes.

## Table of Contents - side and body

- Add support for `body-right` and `body-left` layouts for Website Table of Contents ([#3473](https://github.com/quarto-dev/quarto-cli/issues/3473))

## Languages

- Add Slovak translation (author: @tom67)
- Improve Italian translation of 'proof' (author: @espinielli)

## HTML Format

- Add support for showing cross reference contents on hover (use `crossrefs-hover: false` to disable).
- ([#5189](https://github.com/quarto-dev/quarto-cli/issues/5189)): Ensure appendix shows even when `page-layout` is custom.
- ([#5393](https://github.com/quarto-dev/quarto-cli/issues/5393)): Properly set color of headings without using opacity.
- ([#5431](https://github.com/quarto-dev/quarto-cli/issues/5431)): Properly apply column positioning to title metadata.

## Website Listings

- ([#5371](https://github.com/quarto-dev/quarto-cli/issues/5371)): Properly compute the trimmed length of descriptions included in listings.

## Websites

- ([#5389](https://github.com/quarto-dev/quarto-cli/issues/5389)): Allow a a website project to provide a default image used in social metadata tags.
- Add support for `navbar > toggle-position` to control whether the responsive navbar toggle appears on the right or the left.

## Miscellaneous

- ([#2214](https://github.com/quarto-dev/quarto-cli/issues/2214), reopened): don't report a non-existing version of Google Chrome in macOS.
- ([#5377](https://github.com/quarto-dev/quarto-cli/issues/5377)): support `from: ` formats correctly.

## Docusaurus Format

- ([#5152](https://github.com/quarto-dev/quarto-cli/issues/5152)): Support for `code-line-numbers` in Docusaurus output.

## Beamer Format

- [#5536](https://github.com/quarto-dev/quarto-cli/issues/5536): Correctly support Code Filename feature for Beamer output by fixing issue with float environment.

## OJS engine

- Update observablehq's runtime to version 5.6.0.

## Mermaid diagrams

- Upgrade to 10.2.0-rc.2
- ([#5426](https://github.com/quarto-dev/quarto-cli/issues/5426)): Don't escape mermaid output in markdown formats (author: @rcannood).

## Lua filters

- ([#5466](https://github.com/quarto-dev/quarto-cli/issues/5466)): Provide global environment `_G` to user filters.
- ([#5461](https://github.com/quarto-dev/quarto-cli/issues/5461)): ensure return type of `stripTrailingSpace` is always `pandoc.List`.
- Add support for relative paths in `require()` calls.
- ([#5242](https://github.com/quarto-dev/quarto-cli/issues/5242)): Add line numbers to error messages.
