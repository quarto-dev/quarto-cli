## Jupyter Notebooks

- Add support for embedding cell outputs in quarto documents using `{{< embed >}}`. You can address cells by Id, Tag, or label, such as `{{< embed mynotebook.ipynb#fig-output >}}` which would embed the output of a cell with the label `fig-output`). You can also provide a list of ids like `{{< embed mynotebook.ipynb#fig-output,tbl-out >}}`.
- Only attempt to postprocess `text/plain` output if it's nonempty ([#3896](https://github.com/quarto-dev/quarto-cli/issues/3896)).
- Fix output of bokeh plots so the right number of cells is generated ([#2107](https://github.com/quarto-dev/quarto-cli/issues/2107)).
- Fix output of code cells that contain triple backticks (or more) ([#3179](https://github.com/quarto-dev/quarto-cli/issues/3179)).

## Code Annotation

- Add support for annotation of code cells (executable or non-executable). You can read more about code annotation at [https://www.quarto.org/docs/prerelease/1.3.html](https://www.quarto.org/docs/prerelease/1.3.html).

## HTML Format

- Improved handling of margin references that appear within a callout. ([#3003](https://github.com/quarto-dev/quarto-cli/issues/3003))
- Add support for customizing the baseline widths of grid columns using yaml or scss. For more information, see [https://www.quarto.org/docs/prerelease/1.3.html](https://www.quarto.org/docs/prerelease/1.3.html).
- Fix wrapping of long `code` entries inside table cells ([#3221](https://github.com/quarto-dev/quarto-cli/issues/3221))
- Fix author display to use the `url` for an author even when there is no affiliation.
- Add support for linking to other formats, when more than one format is produced. Alternate formats will appear with the TOC. Control using `format-links`.
- Add support for linking to source notebooks that provide embedded content. Control using `notebook-links`
- Improve callout wrapping behavior for long strings with no word breaks.
- Add overflow to tables generated from SQL code cells ([#3497](https://github.com/quarto-dev/quarto-cli/issues/3497)).
- Fix support for parquet files in OJS code cells ([#3630](https://github.com/quarto-dev/quarto-cli/issues/3630)).

## Article Layout

- Improve positioning of margin content defined within tabsets. (#3280)

## Revealjs Format

- reduce font size of `df-print: paged` tables ([#3380](https://github.com/quarto-dev/quarto-cli/issues/3380))

## Dates

- Properly fall back to language only locale when a supported language-region locale isn't available. (#3059)

## PDF Format

- Fix wrong page number in the TOC for appendices ([#3164](https://github.com/quarto-dev/quarto-cli/issues/3164)) (Thank you, @iusgit!)
- Add support for automatically converting SVG images to PDF ([#2575](https://github.com/quarto-dev/quarto-cli/issues/2575))
- Previously, if the `pdf-engine` was set to `latexmk`, we would bypass many features of Quarto and use Pandoc to produce the PDF output. Starting in in Quarto 1.3, all Quarto features will be enabled for the `latexmk` engine and `latexmk` will be used to run the PDF generation loop.
- Fix author processing in default PDFs for complex author names (#3483)
- Remove excessive vertical space between theorem type blocks ([#3776](https://github.com/quarto-dev/quarto-cli/issues/3776)).
- Fix temporary `.tex` filenames in the presence of multiple variants ([#3762](https://github.com/quarto-dev/quarto-cli/issues/3762)).
  - Note that this fix changes the filenames used for PDF files with variants. In quarto 1.3, the automatic output names for PDF files include format variants and modifiers.

## Beamer Format

- Document `theme` format metadata option ([#3377](https://github.com/quarto-dev/quarto-cli/issues/3377))

## Mermaid diagrams

- Upgrade to mermaid 9.2.2
- Add support for theming mermaid diagrams in Javascript formats ([#2165](https://github.com/quarto-dev/quarto-cli/issues/2165)). See the [prerelease documentation notes](https://quarto.org/docs/prerelease/1.3.html) for details.
- Allow `%%| label` mermaid cell option that control the `id` of the resulting SVG, to facilitate CSS overrides.
- Use `htmlLabels: false` in mermaid flowcharts.
- Remove support for tooltips, which appear to not be working in mermaid 9.2.2.
- Add support for `fig-align` in mermaid diagrams in HTML format ([#3294](https://github.com/quarto-dev/quarto-cli/issues/3294))

## Dates

- Properly fall back to language only locale when a supported language-region locale isn't available. ([#3059](https://github.com/quarto-dev/quarto-cli/issues/3059))

## About Pages

- Add support for `image-alt` which provides alternate text for the about page image. ([#3010](https://github.com/quarto-dev/quarto-cli/issues/3010))

## Article Layout

- Improve the performance of extremely large documents with margin elements by improving the efficiency of positioning the elements.

## Listings

- Listings now support `template-params`, which will be passed to custom EJS templates in a variable called `templateParams` when a listing is rendered.
- Custom listing objects now resolve `path: ` fields into the metadata that would be generated by standard listings, giving custom listing access to computed metadata like `reading-time`, etc.
- Improve support for `date-modified` in listings
- Improve support for `yml` based listings by supporting usage of title and description from `yml`.
- Allow listings in project to point directly to non-input files (such as `yml` files) to use for contents.
- Allow `sort: false` to disable any sorting, allowing items to appear in their original / natural order. (#3296)

## Websites

- Fix issue assigning specific sidebar to a specific page using `sidebar:` (#3389)
- Change behavior of `publish gh-pages` to always render into a clean directory.
  Previous behavior was to add to existing contents of `gh-pages` branch. ([#3199](https://github.com/quarto-dev/quarto-cli/discussions/3199), @ijlyttle)

## Books

- Remove chapter number of HTML head title when `number-sections` is `false` (#3304).

## Preview

- Correct redirect for VS Code Server (#3352) (Thank you, @benz0li!)

## LUA

- `quarto.version()` now returns `Version` object that simplifies comparison (thank you @tarleb)

## HTML Output

- HTML output will not decorate links within source code (for example, from `code-link: true`) with external icons. (#3755)

## Miscellaneous

- Work around pandoc strict checking of `number-offset` type. ([#3126](https://github.com/quarto-dev/quarto-cli/issues/3126))
- Warn instead of crash on bad URI ([#3220](https://github.com/quarto-dev/quarto-cli/issues/3220))
- ensure `video` shortcode works with `embed-resources` and `self-contained` ([#3310](https://github.com/quarto-dev/quarto-cli/issues/3310))
- Add optional `rel` attribute to navigation links ([#3212](https://github.com/quarto-dev/quarto-cli/issues/3212))
- Use the right port when CRI is initialized multiple times ([#3066](https://github.com/quarto-dev/quarto-cli/issues/3066))
- Allow custom themes for giscus ([#3105](https://github.com/quarto-dev/quarto-cli/issues/3105))
- Add new `kbd` shortcode, to describe keyboard keys ([#3384](https://github.com/quarto-dev/quarto-cli/issues/3384)). See the [pre-release documentation](https://quarto.org/docs/prerelease/1.3.html) for details.
- Replace default style for date picker component in OJS ([#2863](https://github.com/quarto-dev/quarto-cli/issues/2863)).
- `quarto check` now supports `quarto check versions` for checking binary dependency versions in the case of custom binaries ([#3602](https://github.com/quarto-dev/quarto-cli/issues/3602)).
- the API for shortcode handlers in lua now accepts a fourth parameter `raw_args` which hold the unparsed arguments in a table ([#3833](https://github.com/quarto-dev/quarto-cli/issues/3833)).
- remove scaffolding div from conditional content in final output ([#3847](https://github.com/quarto-dev/quarto-cli/issues/3847)).
- ensure proof titles are appended to paragraph nodes ([#3772](https://github.com/quarto-dev/quarto-cli/issues/3772)).
- Support parsing markdown in table captions in LaTeX and HTML tables ([#2573](https://github.com/quarto-dev/quarto-cli/issues/2573)).
- Improve parsing of include shortcodes ([#3159](https://github.com/quarto-dev/quarto-cli/issues/3159)).

## Pandoc filter changes

- Quarto 1.3 introduces the notion of Custom AST nodes to Pandoc filters. If you use Lua filters for processing callouts, tabsets, or conditional blocks, consult the [pre-release documentation](https://quarto.org/docs/prerelease/1.3.html) for how to change your filters to support the new syntax.
- Quarto 1.3 now processes HTML tables (in Markdown input) into Pandoc AST nodes, which can be processed by user filters and output into non-HTML formats. In addition, it supports "embedded Markdown content" which will be resolved by quarto's processing, including shortcode and crossref resolution. See the [prerelease documentation](https://quarto.org/docs/prerelease/1.3.html) for more.
