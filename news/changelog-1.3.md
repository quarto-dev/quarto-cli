## Confluence Publishing

- Add support for publishing both documents and projects to Atlassian Confluence spaces and as children to Confluence pages.

## Jupyter Notebooks

- Add support for embedding cell outputs in quarto documents using `{{< embed >}}`. You can address cells by Id, Tag, or label, such as `{{< embed mynotebook.ipynb#fig-output >}}` which would embed the output of a cell with the label `fig-output`). You can also provide a list of ids like `{{< embed mynotebook.ipynb#fig-output,tbl-out >}}`.
- Only attempt to postprocess `text/plain` output if it's nonempty ([#3896](https://github.com/quarto-dev/quarto-cli/issues/3896)).
- Fix output of bokeh plots so the right number of cells is generated ([#2107](https://github.com/quarto-dev/quarto-cli/issues/2107)).
- Fix output of code cells that contain triple backticks (or more) ([#3179](https://github.com/quarto-dev/quarto-cli/issues/3179)).
- Don't install SIGCHLD signal handler since it interferes with IJulia in Julia 1.8.4 and greater ([#2539](https://github.com/quarto-dev/quarto-cli/issues/2539)).
- Resolve full path to QUARTO_PYTHON binary

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
- Forward bootstrap table classes from caption to table element ([#4036](https://github.com/quarto-dev/quarto-cli/issues/4036)).
- Render code listings with names and captions correctly ([#2195](https://github.com/quarto-dev/quarto-cli/issues/2195)).
- Fix issue with interactivity of elements in mobile size dispay when `toc-left` is being used. ([#4244](https://github.com/quarto-dev/quarto-cli/issues/4244)).
- Allow control of the 'cite as' appendix in HTML documents using `appendix-cite-as` (pass `false`, `display`, or `bibtex`). ([#2625](https://github.com/quarto-dev/quarto-cli/issues/2625))
- Properly anchor custom appendix sections ([#3112](https://github.com/quarto-dev/quarto-cli/issues/3112)).
- Don't display custom appendix sections in the TOC ([#3113](https://github.com/quarto-dev/quarto-cli/issues/3113)).

## Article Layout

- Improve positioning of margin content defined within tabsets. (#3280)

## Revealjs Format

- reduce font size of `df-print: paged` tables ([#3380](https://github.com/quarto-dev/quarto-cli/issues/3380))
- `width` and `height` in percent are now correctly supported ([#4063](https://github.com/quarto-dev/quarto-cli/issues/4063))
- add better margins to numbered lists in the presence of many items and `.scrollable` ([#4283](https://github.com/quarto-dev/quarto-cli/issues/4063)).
- Properly support scss imports for RevealJS extensions ([#3414](https://github.com/quarto-dev/quarto-cli/issues/3414))
- Authors on the title slides now correctly object customization of the `$presentation-title-slide-text-align` scss variable ([#3843](https://github.com/quarto-dev/quarto-cli/issues/3843))
- Properly support `show-notes: separate-page` [#3996](https://github.com/quarto-dev/quarto-cli/issues/3996)

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
- Correctly download online image on Windows ([#3982](https://github.com/quarto-dev/quarto-cli/issues/3982)).
- Permissions of `.tex` file are now correct when `keep-tex: true` ([#4380](https://github.com/quarto-dev/quarto-cli/issues/4380)).

## Beamer Format

- Document `theme` format metadata option ([#3377](https://github.com/quarto-dev/quarto-cli/issues/3377))

## Markdown Formats

- Properly forward variants (e.g. `+yaml_metadata_block`) to `gfm` format.
- `gfm` format now supports a local browser based preview when using `quarto preview`. If you'd like to see the raw markdown in preview, you can add `preview-mode: raw` to your document front matter or project.

## Mermaid diagrams

- Upgrade to mermaid 9.2.2
- Add support for theming mermaid diagrams in Javascript formats ([#2165](https://github.com/quarto-dev/quarto-cli/issues/2165)). See the [prerelease documentation notes](https://quarto.org/docs/prerelease/1.3.html) for details.
- Allow `%%| label` mermaid cell option that control the `id` of the resulting SVG, to facilitate CSS overrides.
- Use `htmlLabels: false` in mermaid flowcharts.
- Remove support for tooltips, which appear to not be working in mermaid 9.2.2.
- Add support for `fig-align` in mermaid diagrams in HTML format ([#3294](https://github.com/quarto-dev/quarto-cli/issues/3294)).
- Add support for `%%| file` mermaid cell option ([#3665](https://github.com/quarto-dev/quarto-cli/issues/3665)).
- Fix `code-fold` support in mermaid (and dot) diagrams ([#4423](https://github.com/quarto-dev/quarto-cli/issues/4423)).

## Dates

- Properly fall back to language only locale when a supported language-region locale isn't available. ([#3059](https://github.com/quarto-dev/quarto-cli/issues/3059))

## About Pages

- Add support for `image-alt` which provides alternate text for the about page image. ([#3010](https://github.com/quarto-dev/quarto-cli/issues/3010))
- Add support for `image-title` on About pages ([#3077](https://github.com/quarto-dev/quarto-cli/issues/3077))

## Article Layout

- Improve the performance of extremely large documents with margin elements by improving the efficiency of positioning the elements.

## Listings

- Listings now support `template-params`, which will be passed to custom EJS templates in a variable called `templateParams` when a listing is rendered.
- Custom listing objects now resolve `path: ` fields into the metadata that would be generated by standard listings, giving custom listing access to computed metadata like `reading-time`, etc.
- Improve support for `date-modified` in listings
- Improve support for `yml` based listings by supporting usage of title and description from `yml`.
- Allow listings in project to point directly to non-input files (such as `yml` files) to use for contents.
- Allow `sort: false` to disable any sorting, allowing items to appear in their original / natural order. (#3296)
- Warn if listings are being used outside of a website ([#4267](https://github.com/quarto-dev/quarto-cli/issues/4267))
- Permit using computation outputs (plots/figures) as the preview image for an item in a listing ([#2324](https://github.com/quarto-dev/quarto-cli/issues/2324))
- Use alt text from preview image that is discovered for a page in a listing ([#3706](https://github.com/quarto-dev/quarto-cli/issues/3706))
- Add support for `includes:` and `excludes:` in listings, which will use filter the items included in a listing. ([#2577](https://github.com/quarto-dev/quarto-cli/issues/2577)).

## Websites

- Add suport for 'Back to top' navigational button. Controlled using `back-to-top-navigation:` under `website:`, can be disabled by setting `back-to-top-navigation: false` on individual pages.
- Fix issue assigning specific sidebar to a specific page using `sidebar:` (#3389)
- Change behavior of `publish gh-pages` to always render into a clean directory.
  Previous behavior was to add to existing contents of `gh-pages` branch. ([#3199](https://github.com/quarto-dev/quarto-cli/discussions/3199), @ijlyttle)
- Order sidebar entries using filename rather than title
- Position `repo-actions` in the page footer if there is nowhere else to position them ([#3998](https://github.com/quarto-dev/quarto-cli/issues/3998))
- Render `page-footer` even when a Navbar isn't present ([#4053](https://github.com/quarto-dev/quarto-cli/issues/4053))
- Don't treat links with no `href` as external when `link-external-icon` is enabled ([#3645](https://github.com/quarto-dev/quarto-cli/issues/3645))
- Escape HTML from code cells that appears inline in search results ([#4404](https://github.com/quarto-dev/quarto-cli/issues/4404))
- Use input last modified timestamp when updating sitemap ([#3251](https://github.com/quarto-dev/quarto-cli/issues/3251))
- Add support for overriding the url used to report an issue with a website using `issue-url` (which can be provided even if there is no repo provided for the website).

## Books

- Remove chapter number of HTML head title when `number-sections` is `false` (#3304).
- Non-HTML book output formats will now be placed in subdirectories (`book-<format>`) within the project output directory (`_books`)
- Don't discard the first chapter header when a chapter title is declared using YAML. ([#3653](https://github.com/quarto-dev/quarto-cli/issues/3653))
- Support for rendering to Asciidoc
- Support for rendering to LaTeX

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
- Add support for Youtube privacy-enhanced urls in `video` shortcodes ([#4060](https://github.com/quarto-dev/quarto-cli/issues/4060)).
- Don't emit empty cells ([#4034](https://github.com/quarto-dev/quarto-cli/issues/4034)).
- Resolve link tags correctly in html dependencies ([#4304](https://github.com/quarto-dev/quarto-cli/discussions/4304)) (Thank you, @jdlom!).
- use correct language code for Korean ([#4187](https://github.com/quarto-dev/quarto-cli/discussions/4187)).
- resolve YAML options correctly for comments with open+close syntax ([#3901](https://github.com/quarto-dev/quarto-cli/issues/3901)).
- Work around rare deno tempfile creation bug ([#4352](https://github.com/quarto-dev/quarto-cli/pull/4352)).
- Only open "safe ports" for Chromium ([#4514](https://github.com/quarto-dev/quarto-cli/pull/4514)).

## Pandoc filter changes

- Quarto 1.3 introduces the notion of Custom AST nodes to Pandoc filters. If you use Lua filters for processing callouts, tabsets, or conditional blocks, consult the [pre-release documentation](https://quarto.org/docs/prerelease/1.3.html) for how to change your filters to support the new syntax.
- Quarto 1.3 now processes HTML tables (in Markdown input) into Pandoc AST nodes, which can be processed by user filters and output into non-HTML formats. In addition, it supports "embedded Markdown content" which will be resolved by quarto's processing, including shortcode and crossref resolution. See the [prerelease documentation](https://quarto.org/docs/prerelease/1.3.html) for more.

## Project

- fix rendering of individual project files to stdout ([#4052](https://github.com/quarto-dev/quarto-cli/issues/4052)).
- fix previewing docusaurus project on Windows ([#4312](https://github.com/quarto-dev/quarto-cli/issues/4312)).

## Other

- fix error when running the command `quarto render -h` to receive help ([#3202](https://github.com/quarto-dev/quarto-cli/issues/3202)).
- Fix error when rendering a document with an extension which provides a directory as `format-resources` ([#4377](https://github.com/quarto-dev/quarto-cli/issues/4377)).
