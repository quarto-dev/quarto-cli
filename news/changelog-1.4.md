## Giscus Dark Mode Themes

- ([#4820](https://github.com/quarto-dev/quarto-cli/issues/4820)): Add support for setting the Giscus light/dark themes.

## Table of Contents - side and body

- Add support for `body-right` and `body-left` layouts for Website Table of Contents ([#3473](https://github.com/quarto-dev/quarto-cli/issues/3473))

## Languages

- Add Slovak translation (author: @tom67)
- Improve Italian translation of 'proof' (author: @espinielli)
- Add Greek translation (author: @cultab)
- Add Norwegian translation (author: @lektorodd)
- Add Lithuanian translation (author: @GegznaV)

## HTML Format

- Add support for showing cross reference contents on hover (use `crossrefs-hover: false` to disable).
- ([#5189](https://github.com/quarto-dev/quarto-cli/issues/5189)): Ensure appendix shows even when `page-layout` is custom.
- ([#5393](https://github.com/quarto-dev/quarto-cli/issues/5393)): Properly set color of headings without using opacity.
- ([#5431](https://github.com/quarto-dev/quarto-cli/issues/5431)): Properly apply column positioning to title metadata.
- ([#5700](https://github.com/quarto-dev/quarto-cli/issues/5700)): Don't show scrollbars on Windows when hovering over hover code annotations.
- ([#5708](https://github.com/quarto-dev/quarto-cli/issues/5708)): Fix hang when viewing pages with specific query parameter
- ([#5794](https://github.com/quarto-dev/quarto-cli/issues/5794)): Fix incorrect caching behavior when `import` is used in scss themes.
- ([#5798](https://github.com/quarto-dev/quarto-cli/issues/5798)): Improve the layout consistency of HTML callouts.
- ([#5856](https://github.com/quarto-dev/quarto-cli/issues/5856)): Always render the title block of HTML pages (previously would only render when title or subtitle was provided).
- ([#5957](https://github.com/quarto-dev/quarto-cli/issues/5957)): Fix layout issues when margin footnotes are contained in headings or other formatted text.

## RevealJS Format

- ([#5546](https://github.com/quarto-dev/quarto-cli/issues/5546)): Images inside links can't be stretched, and so auto-stretch feature now ignores them.
- ([#5783](https://github.com/quarto-dev/quarto-cli/issues/5783)): Ensure fenced code blocks work with line numbers.

## Website Listings

- ([#5371](https://github.com/quarto-dev/quarto-cli/issues/5371)): Properly compute the trimmed length of descriptions included in listings.
- ([#5805](https://github.com/quarto-dev/quarto-cli/pull/5805)): Update the inherited `word-break: break-word` style (Bootstrap) to `word-break: keep-all` to prevent hyphenation of words in listings.
- ([#5802](https://github.com/quarto-dev/quarto-cli/pull/5802)): Don't display the string `undefined` for date values if a listing table displays items without a date.

## Websites

- ([#5389](https://github.com/quarto-dev/quarto-cli/issues/5389)): Allow a website project to provide a default image used in social metadata tags.
- Add support for `navbar > toggle-position` to control whether the responsive navbar toggle appears on the right or the left.
- ([#5604](https://github.com/quarto-dev/quarto-cli/issues/5604)): Process footer content as blocks.
- ([#5624](https://github.com/quarto-dev/quarto-cli/issues/5624)): Add support for localized Cookie Consent (using either the document's language or by specifying the language explicitly under the cookie consent key).
- ([#5756](https://github.com/quarto-dev/quarto-cli/issues/5756)): Add `rel="..."` resolution to navbar tools.
- ([#5763](https://github.com/quarto-dev/quarto-cli/issues/5763)): Add support for a keyboard shortcut to launch search (defaults to `f` or `/`). Use `search` > `keyboard-shortcut` to override with your own key(s).
- Add support for setting `page-navigation: true|false` in either a page or in `_metadata.yml`. This allows individual pages or sections of a website to control whether `page-navigaation` appears.
- ([#5625](https://github.com/quarto-dev/quarto-cli/issues/5625)): Prefer the website image (if specified) over undecorated images that appear in the page.
- ([#5932](https://github.com/quarto-dev/quarto-cli/issues/5932)): Correct Open Graph metadata key name for `og:site_name`

## Preview

- Display render output/progress for previews that take longer than 2 seconds
- Ability to cancel an executing preview from within the progress UI
- Automatically render missing formats (e.g. PDF, MS Word) on the fly
- ([#5882](https://github.com/quarto-dev/quarto-cli/issues/5882)): Disable browser cache using `Cache-Control` header config in the viewer redirect for PDF preview, correctly allowing a HTML preview later on same port.

## Miscellaneous

- ([#2214](https://github.com/quarto-dev/quarto-cli/issues/2214), reopened): don't report a non-existing version of Google Chrome in macOS.
- ([#5377](https://github.com/quarto-dev/quarto-cli/issues/5377)): support `from: ` formats correctly.
- Exit if project pre or post render script fails
- Use InternalError in typescript code, and offer a more helpful error message when an internal error happens.

## Docusaurus Format

- ([#5152](https://github.com/quarto-dev/quarto-cli/issues/5152)): Support for `code-line-numbers` in Docusaurus output.

## Beamer Format

- [#5536](https://github.com/quarto-dev/quarto-cli/issues/5536): Correctly support Code Filename feature for Beamer output by fixing issue with float environment.

## OJS engine

- Update observablehq's runtime to version 5.6.0.
- [#5215](https://github.com/quarto-dev/quarto-cli/issues/5215): Report CORS requests as plain text when serving single-file previews.

## Mermaid diagrams

- Upgrade to 10.2.0-rc.2
- ([#5426](https://github.com/quarto-dev/quarto-cli/issues/5426)): Don't escape mermaid output in markdown formats (author: @rcannood).

## Lua filters

- ([#5466](https://github.com/quarto-dev/quarto-cli/issues/5466)): Provide global environment `_G` to user filters.
- ([#5461](https://github.com/quarto-dev/quarto-cli/issues/5461)): ensure return type of `stripTrailingSpace` is always `pandoc.List`.
- Add support for relative paths in `require()` calls.
- ([#5242](https://github.com/quarto-dev/quarto-cli/issues/5242)): Add line numbers to error messages.
- Add support `quarto.doc.add_resource` and `quarto.doc.add_supporting`. `add_resource` will add a resource file to the current render, copying that file to the same relative location in the output directory. `add_supporting` will add a supporting file to the current render, moving that file file to the same relative location in the output directory.

## Books

- ([#5630](https://github.com/quarto-dev/quarto-cli/issues/5630)): Properly form sharing URL for books
- ([#5454](https://github.com/quarto-dev/quarto-cli/issues/5454)): Fix errors previewing with formats such as `asciidoc` are added to book projects.

## Other Fixes and Improvements

- ([#5785](https://github.com/quarto-dev/quarto-cli/issues/5785)): Don't process juptyer notebook markdown into metadata when embedding notebooks into documents.
- ([#5902](https://github.com/quarto-dev/quarto-cli/issues/5902)): Support paired shortcode syntax.
