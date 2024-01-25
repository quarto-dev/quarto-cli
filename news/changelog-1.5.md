All changes included in 1.5:

## HTML Format

- ([#8118](https://github.com/quarto-dev/quarto-cli/issues/8118)): Add support for `body-classes` to add classes to the document body.
- ([#8311](https://github.com/quarto-dev/quarto-cli/issues/8311)): Correct z-order for margins with no contents

## Website

- ([#7318](https://github.com/quarto-dev/quarto-cli/issues/7318)): Don't improperly overwrite page titles
- ([#8108](https://github.com/quarto-dev/quarto-cli/issues/8108)): Individual pages can suppress breadcrumbs using `bread-crumbs: false`
- ([#8267](https://github.com/quarto-dev/quarto-cli/issues/8267)): Improve responsive layout of `page-footer`
- ([#8294](https://github.com/quarto-dev/quarto-cli/issues/8294)): Add support for website announcements, using the `announcement` key under `website`.
- ([#8426](https://github.com/quarto-dev/quarto-cli/issues/8426)): Ignore invalid dates for references when generating Google Scholar data.

## Jupyter

- ([#8433](https://github.com/quarto-dev/quarto-cli/issues/8433)): Escape jupyter widget states that contain `</script>` so they can be embedded in HTML documents.

## Website Listings

- ([#8147](https://github.com/quarto-dev/quarto-cli/issues/8147)): Ensure that listings don't include the contents of the output directory
- ([#8435](https://github.com/quarto-dev/quarto-cli/issues/8435)): Improve listing filtering using special characters

## Manuscripts

- ([#8277](https://github.com/quarto-dev/quarto-cli/issues/8277)): Improve notebook ordering within Manuscript projects

## Extensions

- ([#8385](https://github.com/quarto-dev/quarto-cli/issues/8385)): Properly copy project resources when extensions are installed at project level.

## Filters

- ([#8417](https://github.com/quarto-dev/quarto-cli/issues/8417)): Maintain a single AST element in the output cells when parsing HTML from RawBlock elements.

## Other Fixes

- ([#8119](https://github.com/quarto-dev/quarto-cli/issues/8119)): More intelligently detect when ejs templates are modified during development, improving quality of life during preview.
- ([#8177](https://github.com/quarto-dev/quarto-cli/issues/8177)): Use an explicit path to `sysctl` when detecting MacOS architecture. (author: @kevinushey)
- ([#8438](https://github.com/quarto-dev/quarto-cli/issues/8438)): Ensure that sub commands properly support logging control flags (e.g. `--quiet`, etc).

- Add support for `{{< lipsum >}}` shortcode, which is useful for emitting placeholder text. Specify a specific number of paragraphs (`{{< lipsum 3 >}}`).
- Increase v8's max heap size by default, to avoid out-of-memory errors when rendering large documents (also cf. https://github.com/denoland/deno/issues/18935).
