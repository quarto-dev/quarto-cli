All changes included in 1.5:

## HTML Format

- ([#8118](https://github.com/quarto-dev/quarto-cli/issues/8118)): Add support for `body-classes` to add classes to the document body.
- ([#8311](https://github.com/quarto-dev/quarto-cli/issues/8311)): Correct z-order for margins with no contents

## PDF Format:

- ([#8299](https://github.com/quarto-dev/quarto-cli/issues/8299)): Don't use `rsvg-convert` to convert an SVG to PDF when the PDF is already available; add `use-rsvg-convert` option to control this behavior.

## Website

- ([#7318](https://github.com/quarto-dev/quarto-cli/issues/7318)): Don't improperly overwrite page titles
- ([#8108](https://github.com/quarto-dev/quarto-cli/issues/8108)): Individual pages can suppress breadcrumbs using `bread-crumbs: false`
- ([#8267](https://github.com/quarto-dev/quarto-cli/issues/8267)): Improve responsive layout of `page-footer`
- ([#8294](https://github.com/quarto-dev/quarto-cli/issues/8294)): Add support for website announcements, using the `announcement` key under `website`.
- ([#8426](https://github.com/quarto-dev/quarto-cli/issues/8426)): Ignore invalid dates for references when generating Google Scholar data.

## OJS

- ([#8327](https://github.com/quarto-dev/quarto-cli/issues/8327)): Issue error messages on console so they're visible in the case of hidden OJS cells.

## Jupyter

- ([#8433](https://github.com/quarto-dev/quarto-cli/issues/8433)): Escape jupyter widget states that contain `</script>` so they can be embedded in HTML documents.

## Website Listings

- ([#8147](https://github.com/quarto-dev/quarto-cli/issues/8147)): Ensure that listings don't include the contents of the output directory
- ([#8435](https://github.com/quarto-dev/quarto-cli/issues/8435)): Improve listing filtering using special characters

## Manuscripts

- ([#8277](https://github.com/quarto-dev/quarto-cli/issues/8277)): Improve notebook ordering within Manuscript projects

## Extensions

- ([#8385](https://github.com/quarto-dev/quarto-cli/issues/8385)): Properly copy project resources when extensions are installed at project level.
- ([#8547](https://github.com/quarto-dev/quarto-cli/issues/8547)): Support installing extensions from github branch with forward slash in the name.

## Shortcodes

- ([#8316](https://github.com/quarto-dev/quarto-cli/issues/8316)): Add fallback value for the `env` shortcode

## Filters

- ([#8417](https://github.com/quarto-dev/quarto-cli/issues/8417)): Maintain a single AST element in the output cells when parsing HTML from RawBlock elements.

## Engines

- ([#8388](https://github.com/quarto-dev/quarto-cli/issues/8388)): add `QUARTO_PROJECT_ROOT` and `QUARTO_DOCUMENT_PATH` to the environment when invoking execution engines.

## Other Fixes

- ([#8119](https://github.com/quarto-dev/quarto-cli/issues/8119)): More intelligently detect when ejs templates are modified during development, improving quality of life during preview.
- ([#8177](https://github.com/quarto-dev/quarto-cli/issues/8177)): Use an explicit path to `sysctl` when detecting MacOS architecture. (author: @kevinushey)
- ([#8274](https://github.com/quarto-dev/quarto-cli/issues/8274)): set `LUA_CPATH` to '' if unset, avoiding accidentally loading incompatible system-wide libraries.
- ([#8401](https://github.com/quarto-dev/quarto-cli/issues/8401)): Ensure that files created with `quarto create <project_name>` have lowercase filenames.
- ([#8438](https://github.com/quarto-dev/quarto-cli/issues/8438)): Ensure that sub commands properly support logging control flags (e.g. `--quiet`, etc).
- ([#8422](https://github.com/quarto-dev/quarto-cli/issues/8422)): Improve dashboard validation and sauto-completion support for external tools
- ([#8486](https://github.com/quarto-dev/quarto-cli/issues/8486)): Improve arrow theme differentation of Keywords and Control Flow elements

- Add support for `{{< lipsum >}}` shortcode, which is useful for emitting placeholder text. Specify a specific number of paragraphs (`{{< lipsum 3 >}}`).
- Increase v8's max heap size by default, to avoid out-of-memory errors when rendering large documents (also cf. https://github.com/denoland/deno/issues/18935).
