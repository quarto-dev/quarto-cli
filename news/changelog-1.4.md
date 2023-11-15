## Languages

- Add Serbian-Latin translation (author: @n_grubor)
- Add Slovak translation (author: @tom67)
- Improve Italian translation of 'proof' (author: @espinielli)
- Add Greek translation (author: @cultab)
- Add Norwegian translation (author: @lektorodd)
- Add Lithuanian translation (author: @GegznaV)
- Add Traditional Chinese (Taiwan) translation (author: @bobby1030)
- Update Catalan translation (author: @jmaspons)

## Dependencies

- Update to Pandoc 3.1.9
- Update to Typst 0.9.0

## HTML Format

- Add support for showing cross reference contents on hover (use `crossrefs-hover: false` to disable).
- Add support for displaying `keywords` in HTML page title block, when present.
- ([#3473](https://github.com/quarto-dev/quarto-cli/issues/3473)): Add support for `body-right` and `body-left` layouts for Website Table of Contents.
- ([#5189](https://github.com/quarto-dev/quarto-cli/issues/5189)): Ensure appendix shows even when `page-layout` is custom.
- ([#5210](https://github.com/quarto-dev/quarto-cli/issues/5210)): Update to Bootstrap 5.2.2
- ([#5393](https://github.com/quarto-dev/quarto-cli/issues/5393)): Properly set color of headings without using opacity.
- ([#5403](https://github.com/quarto-dev/quarto-cli/issues/5403)): Fix accessibility issues with the `kbd` shortcode.
- ([#5431](https://github.com/quarto-dev/quarto-cli/issues/5431)): Properly apply column positioning to title metadata.
- ([#5700](https://github.com/quarto-dev/quarto-cli/issues/5700)): Don't show scrollbars on Windows when hovering over hover code annotations.
- ([#5708](https://github.com/quarto-dev/quarto-cli/issues/5708)): Fix hang when viewing pages with specific query parameter
- ([#5794](https://github.com/quarto-dev/quarto-cli/issues/5794)): Fix incorrect caching behavior when `import` is used in scss themes.
- ([#5798](https://github.com/quarto-dev/quarto-cli/issues/5798)): Improve the layout consistency of HTML callouts.
- ([#5856](https://github.com/quarto-dev/quarto-cli/issues/5856)): Always render the title block of HTML pages (previously would only render when title or subtitle was provided).
- ([#5929](https://github.com/quarto-dev/quarto-cli/issues/5929)): Split border-bottom properties to avoid invalid `inherit` entry in resulting CSS.
- ([#5955](https://github.com/quarto-dev/quarto-cli/issues/5955)): Correct HTML callout appearance when title isn't present.
- ([#5957](https://github.com/quarto-dev/quarto-cli/issues/5957)): Fix layout issues when margin footnotes are contained in headings or other formatted text.
- ([#6163](https://github.com/quarto-dev/quarto-cli/issues/6163)): Wrap `svg` output of `dot` cells in RawBlock `html` elements.
- ([#6430](https://github.com/quarto-dev/quarto-cli/issues/6430)): Fix layout issue with banner style title block authors when `page-layout:
- ([#6627](https://github.com/quarto-dev/quarto-cli/issues/6627)): Add a bit of margin-right to checkbox inputs.
- ([#6714](https://github.com/quarto-dev/quarto-cli/issues/6714)): Display title block for HTML when other (non-title/author/subtitle) metadata is present.
- ([#6833](https://github.com/quarto-dev/quarto-cli/issues/6833)): Handle partially-specified aspect ratio, width, and height attributes in `video` shortcode.
- ([#7137](https://github.com/quarto-dev/quarto-cli/discussions/7137)): Automatically set `rel="noopener"` when setting a target on external links
- ([#7187](https://github.com/quarto-dev/quarto-cli/issues/7187)): Add `html-table-processing: none` to document- and project-level metadata to disable HTML table processing. Add `{html-table-processing="none"}` to a fenced div to disable HTML table processing for the elements in that div. Add `html-table-processing: none` on knitr or jupyter cell to disable HTML table processing for the cell output content.
- ([#7441](https://github.com/quarto-dev/quarto-cli/issues/7441)): Links in hover box (e.g. links to DOI when hover for citations is opt-in) are now correctly process for external and new window processing (when `link-external-icon: true` and `link-external-newwindow: true`).

## Appendix

- ([#6783](https://github.com/quarto-dev/quarto-cli/issues/6783)): Add additional CC licenses, improve link text

## RevealJS Format

- ([#5546](https://github.com/quarto-dev/quarto-cli/issues/5546)): Images inside links can't be stretched, and so auto-stretch feature now ignores them.
- ([#5783](https://github.com/quarto-dev/quarto-cli/issues/5783)): Ensure fenced code blocks work with line numbers.
- ([#6120](https://github.com/quarto-dev/quarto-cli/issues/6120)): `pdf-max-pages-per-slide` is now correctly setting [`pdfMaxPagesPerSlide` config](https://revealjs.com/pdf-export/#page-size) for RevealJS.
- ([#6827](https://github.com/quarto-dev/quarto-cli/issues/6120)): Correctly layout callout in revealjs slides when changing appearance.
- ([#6853](https://github.com/quarto-dev/quarto-cli/issues/6853), [#5208](https://github.com/quarto-dev/quarto-cli/issues/5208)): Wrap callout in div when attr is non-empty.
- ([#7042](https://github.com/quarto-dev/quarto-cli/issues/7042)): Line highligthting now works correctly with code annotation.
- ([#7104](https://github.com/quarto-dev/quarto-cli/issues/7104)): Line highlighting progressive reveal now correctly has code annotation anchor on the right.
- ([#7366](https://github.com/quarto-dev/quarto-cli/issues/7366)): `smaller: true` now applies correctly on nested slides.

## PDF Format

- ([#4370](https://github.com/quarto-dev/quarto-cli/issues/4370)): Hoist code cells deep in the AST out of layout cells to avoid `\raisebox` issues with the `Shaded` environment.
- ([#5969](https://github.com/quarto-dev/quarto-cli/issues/5969)): Correctly detect a required rerun for biblatex when using backref link options.
- ([#6077](https://github.com/quarto-dev/quarto-cli/issues/6077)): Make sure proof environments are tight around contents.
- ([#6907](https://github.com/quarto-dev/quarto-cli/issues/6907)): Fix issue with footnote mark line processor not triggering.
- ([#6990](https://github.com/quarto-dev/quarto-cli/issues/6990)): Fix an issue where underscore in `filename` code cell attribute were not escaped.
- ([#7175](https://github.com/quarto-dev/quarto-cli/issues/7175)): Fix an issue with code annotations when more than one digit is used for annotation number.
- ([#7267](https://github.com/quarto-dev/quarto-cli/issues/7267)): Fix issue with longtable environments interfering with the `table` counter.

## Docusaurus Format

- ([#5152](https://github.com/quarto-dev/quarto-cli/issues/5152)): Support for `code-line-numbers: true` in Docusaurus output.
- ([#7201](https://github.com/quarto-dev/quarto-cli/issues/7201)): Support for [line highlighting](https://docusaurus.io/docs/markdown-features/code-blocks#highlighting-with-metadata-string) using `code-line-numbers`, as raw block attributes or code cell options.

## Beamer Format

- ([#3650](https://github.com/quarto-dev/quarto-cli/issues/3650)): Use `classoption=notheorems` to not conflict with Quarto's own theorem environments.
- ([#5536](https://github.com/quarto-dev/quarto-cli/issues/5536)): Correctly support Code Filename feature for Beamer output by fixing issue with float environment.
- ([#6041](https://github.com/quarto-dev/quarto-cli/issues/6041)): Correctly support code block appearance options (`code-block-bg` and `code-block-border-left`).
- ([#6226](https://github.com/quarto-dev/quarto-cli/issues/6226)): Correctly detect the need for an additional compilation for TOC layout when using `lualatex`

## Asciidoc Format

- ([#6589](https://github.com/quarto-dev/quarto-cli/issues/6589)): Don't crash when `format: asciidoc` with a missing title.

## Confluence Format

- ([#7256](https://github.com/quarto-dev/quarto-cli/issues/7256)): No undesired newline are created anymore in Callouts.

## Website Listings

- ([#4800](https://github.com/quarto-dev/quarto-cli/issues/4800)): Add support for including an `xml-stylesheet` in listings. Use the `xml-stylesheet: example.xsl` under `feed:` to provide a path to an XSL style sheet to style your RSS feed.
- ([#5371](https://github.com/quarto-dev/quarto-cli/issues/5371)): Properly compute the trimmed length of descriptions included in listings.
- ([#5463](https://github.com/quarto-dev/quarto-cli/issues/5463)): Error if the `contents` of a listing match no items.
- ([#5742](https://github.com/quarto-dev/quarto-cli/issues/5742)): Use any element to compute a description for the listing, even when there are no paragraphs.
- ([#5802](https://github.com/quarto-dev/quarto-cli/issues/5802)): Don't display the string `undefined` for date values if a listing table displays items without a date.
- ([#5805](https://github.com/quarto-dev/quarto-cli/issues/5805)): Update the inherited `word-break: break-word` style (Bootstrap) to `word-break: keep-all` to prevent hyphenation of words in listings.
- ([#6029](https://github.com/quarto-dev/quarto-cli/issues/6029)): Only use the `image-placeholder` for a listing if no other image is available.
- ([#6091](https://github.com/quarto-dev/quarto-cli/issues/6091)): Don't use remote / absolutes images when auto-discovering images.
- ([#6268](https://github.com/quarto-dev/quarto-cli/issues/6268)): Enable listings even when `theme: none`
- ([#6407](https://github.com/quarto-dev/quarto-cli/issues/6407)): Add supporting for the field `word-count` for listing items. It is not displayed by default.
- ([#6408](https://github.com/quarto-dev/quarto-cli/issues/6408)): Fix error on Windows when using yaml to create a listing with an external (e.g. `path: https://www.quarto.org`)
- ([#6447](https://github.com/quarto-dev/quarto-cli/issues/6447)): Fix image placholder for pages with more than one listing (or a single listing passed as an array item in yaml)
- ([#6777](https://github.com/quarto-dev/quarto-cli/issues/6777)): Add support for complex fields like `citaiton.container-title` when includes custom fields in listings.
- ([#6903](https://github.com/quarto-dev/quarto-cli/issues/6903)): Don't display the `path` field for external paths provided in metadata files.
- ([#6904](https://github.com/quarto-dev/quarto-cli/issues/6904)): Within feeds, remove `index.html` from urls which shouldn't include it.
- ([#7088](https://github.com/quarto-dev/quarto-cli/issues/7088)): Don't emit extraneous link or whitespace in default listing template.
- ([#7184](https://github.com/quarto-dev/quarto-cli/issues/7184)): Properly use the boostrap variable `pagination-active-color` for coloring pagination controls.
- ([#7345](https://github.com/quarto-dev/quarto-cli/issues/7345)): Improve display of categories in a table style listing

## Websites

- Add support for `navbar > toggle-position` to control whether the responsive navbar toggle appears on the right or the left.
- Add support for setting `page-navigation: true|false` in either a page or in `_metadata.yml`. This allows individual pages or sections of a website to control whether `page-navigaation` appears.
- Add support for `bread-crumbs: true|false` to control whether bread crumbs are displayed. Add support for display of breadcrumbs on full width (non-mobile) pages when `bread-crumbs` is true. Default value is true.
- Add support for setting `repo-actions: false` in a document to prevent the display of repository actions on a specific page.
- Add support for `show-item-context` key within the `search` key to control whether page parents are display next to items in search results. Pass `tree`, `parent`, `root`, or boolean (if you pass true, `tree` is the default).
- ([#5389](https://github.com/quarto-dev/quarto-cli/issues/5389)): Allow a website project to provide a default image used in social metadata tags.
- ([#5604](https://github.com/quarto-dev/quarto-cli/issues/5604)): Process footer content as blocks.
- ([#5624](https://github.com/quarto-dev/quarto-cli/issues/5624)): Add support for localized Cookie Consent (using either the document's language or by specifying the language explicitly under the cookie consent key).
- ([#5625](https://github.com/quarto-dev/quarto-cli/issues/5625)): Prefer the website image (if specified) over undecorated images that appear in the page.
- ([#5756](https://github.com/quarto-dev/quarto-cli/issues/5756)): Add `rel="..."` resolution to navbar tools.
- ([#5763](https://github.com/quarto-dev/quarto-cli/issues/5763)): Add support for a keyboard shortcut to launch search (defaults to `f` or `/`). Use `search` > `keyboard-shortcut` to override with your own key(s).
- ([#5932](https://github.com/quarto-dev/quarto-cli/issues/5932)): Correct Open Graph metadata key name for `og:site_name`
- ([#6432](https://github.com/quarto-dev/quarto-cli/issues/6432)): Don't decorate navigation tools with external link icon (we generally don't decorate navigation chrome in this way)
- ([#6708](https://github.com/quarto-dev/quarto-cli/issues/6708)): Prevent duplication of footnotes within the abstract or description within websites and books.
- ([#7447](https://github.com/quarto-dev/quarto-cli/issues/7447)): Changing the `$primary` color in a SCSS theme will now properly change the navigation bar background color.

## Website Search

- ([#7105](https://github.com/quarto-dev/quarto-cli/issues/7105)): Improve search results by raising default limit and fixing and removing warning that would appear for Algolia when limit was more than 20.
- ([#7150](https://github.com/quarto-dev/quarto-cli/issues/7150)): Search keyboard shortcut will not intercept keys directed at inputs.
- ([#7117](https://github.com/quarto-dev/quarto-cli/issues/7117)): Ensure that search works properly in mobile layouts when not scrolled to top of page (don't close search when scroll occurs because of keyboard being shown).

## Books

- ([#5454](https://github.com/quarto-dev/quarto-cli/issues/5454)): Fix errors previewing with formats such as `asciidoc` are added to book projects.
- ([#5630](https://github.com/quarto-dev/quarto-cli/issues/5630)): Properly form sharing URL for books
- ([#6708](https://github.com/quarto-dev/quarto-cli/issues/6708)): Prevent duplication of footnotes within the abstract or description within websites and books.

## Publishing

- ([#5436](https://github.com/quarto-dev/quarto-cli/issues/5436)): Add support for publishing to Posit Cloud.

## Video (and Audio)

- ([#5496](https://github.com/quarto-dev/quarto-cli/issues/5496), [#5847](https://github.com/quarto-dev/quarto-cli/issues/5847), [#5268](https://github.com/quarto-dev/quarto-cli/issues/5268)): Properly display local audio and video files with website projects (properly discover the `src` as a resource)

## Preview

- Display render output/progress for previews that take longer than 2 seconds
- Ability to cancel an executing preview from within the progress UI
- Automatically render missing formats (e.g. PDF, MS Word) on the fly
- Correct detection of Hugo project type from `hugo.toml` (in addition to already supported `config.toml`)
- Only re-use Jupyter kernels for languages that explicitly opt into it
- ([#5882](https://github.com/quarto-dev/quarto-cli/issues/5882)): Disable browser cache using `Cache-Control` header config in the viewer redirect for PDF preview, correctly allowing a HTML preview later on same port.

## Jupyter

- Support for executing inline expressions (e.g. `` `{python} x` ``)
- Improved detection/exclusion of spurious matplotlib plain text output
- Correctly exclude `id` fields when converting Colab notebooks to qmd.
- More thorough cleaning out of text artifacts created by matplotlib intermediate statements.
- Added `ipynb-shell-interactivity` option (enables specification of IPython [`InteractiveShell.ast_node_interactivity`](https://ipython.readthedocs.io/en/stable/config/options/terminal.html#configtrait-InteractiveShell.ast_node_interactivity) option)
- Only search for Julia conda installation when the engine language is Julia
- Support for `plotly-connected` option to determine where Plotly is embedded or loaded from CDN
- Reduce default margins for Plotly figures (t=30,r=0,b=0,l=0)
- Restart kernel daemon when non-package Python modules change
- ([#6344](https://github.com/quarto-dev/quarto-cli/issues/6344)): Somewhat improve the error message in case of YAML parsing errors in metadata of Python code cells.
- ([#6367](https://github.com/quarto-dev/quarto-cli/issues/6367)): Fix bug with nested code cells in the generation of Jupyter notebook from .qmd files.
- ([#6393](https://github.com/quarto-dev/quarto-cli/pull/6393)): Search `JULIA_HOME` for Julia-specific Python installations.
- ([#7512](https://github.com/quarto-dev/quarto-cli/issues/7512)): Improved error message listing known kernels, when a kernel set with `jupyter` key in YAML is not found.
- ([#7548](https://github.com/quarto-dev/quarto-cli/issues/7548)): Don't use `fig_format="png"` in Julia's CairoMakie because of interaction with `display()`

## Knitr

- ([#4735](https://github.com/quarto-dev/quarto-cli/pull/4735)): Special `verbatim` and `embed` language engine for knitr's chunk are now better supported, including with special quarto cell option like `echo: fenced`.
- ([#6775](https://github.com/quarto-dev/quarto-cli/pull/6775)): Avoid duplicating special internal `tools:quarto` R environment used for making `ojs_define()` accessible during knitting.
- ([#6792](https://github.com/quarto-dev/quarto-cli/issues/6792)): `fig-asp` provided at YAML config level now correctly work to set `fig.asp` chunk option in **knitr**.
- ([#7002](https://github.com/quarto-dev/quarto-cli/issues/7002)): `layout-valign` is correctly forwarded to HTML to tweak vertical figure layout alignment for computational figures.

## OJS engine

- Update observablehq's runtime to version 5.6.0.
- ([#5215](https://github.com/quarto-dev/quarto-cli/issues/5215)): Report CORS requests as plain text when serving single-file previews.
- ([#6267](https://github.com/quarto-dev/quarto-cli/issues/6267)): Fix error message when running in `file://`.

## Mermaid diagrams

- Upgrade to 10.2.0-rc.2
- ([#5426](https://github.com/quarto-dev/quarto-cli/issues/5426)): Don't escape mermaid output in markdown formats (author: @rcannood).

## Author and Affiliations

- Add support for specifying author `roles`, with optional support for degree of contribution and automatic normalization of CreDiT roles, when applicable.
- Improved support for affiliation metadata, including `ringgold`, `isni`, `ror`
- Add support for `funding`, including support for simple strings or funding including `source`, `recipient`, and `investigator`. `source` and `recipient` may be one or more simple strings, `ref`s to an author or affiliation id, or an object following the `institution` schema.
- ([#6138](https://github.com/quarto-dev/quarto-cli/issues/6138)): Add support for `degrees` to specify academic titles or professional certifications displayed following a personal name (for example, "MD", "PhD").

## Lua filters

- Add support for relative paths in `require()` calls.
- Add support `quarto.doc.add_resource` and `quarto.doc.add_supporting`. `add_resource` will add a resource file to the current render, copying that file to the same relative location in the output directory. `add_supporting` will add a supporting file to the current render, moving that file file to the same relative location in the output directory.
- ([#5242](https://github.com/quarto-dev/quarto-cli/issues/5242)): Add line numbers to error messages.
- ([#5461](https://github.com/quarto-dev/quarto-cli/issues/5461)): ensure return type of `stripTrailingSpace` is always `pandoc.List`.
- ([#5466](https://github.com/quarto-dev/quarto-cli/issues/5466)): Provide global environment `_G` to user filters.
- ([#6211](https://github.com/quarto-dev/quarto-cli/pull/6211)): Improve error message when a JSON filter (or a potentially misspelled Lua filter from an extension) is not found.
- ([#6215](https://github.com/quarto-dev/quarto-cli/issues/6215)): Add `quarto.utils.string_to_inlines` and `quarto.utils.string_to_blocks` to Lua API to convert a string to a list of inlines or blocks taking into account quarto's AST structure.
- ([#6289](https://github.com/quarto-dev/quarto-cli/issues/6289)): allow `markdownToInlines` to take empty string.
- ([#6935](https://github.com/quarto-dev/quarto-cli/issues/6935)): Add isGithubMarkdownOutput() to quarto.format API.
- ([#6935](https://github.com/quarto-dev/quarto-cli/issues/6935)): render callouts to `gfm` using GitHub's syntax.
- ([#7067](https://github.com/quarto-dev/quarto-cli/issues/7067)): Add new entry points to user Lua filters. See <https://quarto.org/docs/prerelease/1.4/lua_changes.html>.
- ([#7083](https://github.com/quarto-dev/quarto-cli/issues/7083)): Separate custom node handlers for Span and Div nodes, enabling conditional content spans (author: @knuesel)

## Debian Installer

- ([#3785](https://github.com/quarto-dev/quarto-cli/issues/3785)): Recommend installation of `unzip`, which is used when installed extensions.
- ([#5167](https://github.com/quarto-dev/quarto-cli/issues/5167)): Don't fail installation if symlink cannot be created in path.

## Citable Articles

- ([#6766](https://github.com/quarto-dev/quarto-cli/issues/6766)): Add `id` as valid CSL property when specifying a documents citation metadata.

## Crossrefs

- ([#2551](https://github.com/quarto-dev/quarto-cli/issues/2551)): Support crossreferenceable figures without captions.
- ([#6620](https://github.com/quarto-dev/quarto-cli/issues/6620)): Introduce `FloatRefTarget` AST nodes that generalize crossref targets to include figures, tables, and custom floating elements.
- ([#7200](https://github.com/quarto-dev/quarto-cli/issues/7200)): Support Unicode in subref labels.

## Input format

- ([#7905](https://github.com/quarto-dev/quarto-cli/issues/7905)): Use `html+raw_html` as input format when processing HTML rawblocks for tables to avoid Pandoc converting SVG elements to images.

## Other Fixes and Improvements

- Exit if project pre or post render script fails
- Support `--output-dir` for rendering individual files.
- Use InternalError in typescript code, and offer a more helpful error message when an internal error happens.
- ([#1392](https://github.com/quarto-dev/quarto-cli/issues/1392)): Add tools and LaTeX information to `quarto check` output.
- ([#2214](https://github.com/quarto-dev/quarto-cli/issues/2214), reopened): don't report a non-existing version of Google Chrome in macOS.
- ([#4820](https://github.com/quarto-dev/quarto-cli/issues/4820)): Add support for setting the Giscus light/dark themes.
- ([#5377](https://github.com/quarto-dev/quarto-cli/issues/5377)): support `from: ` formats correctly.
- ([#5748](https://github.com/quarto-dev/quarto-cli/issues/5748)): Don't cleanup shared lib_dir files when using `embed-resources` within a project
- ([#5755](https://github.com/quarto-dev/quarto-cli/pull/5755)): Allow document metadata to control conditional content.
- ([#5785](https://github.com/quarto-dev/quarto-cli/issues/5785)): Don't process juptyer notebook markdown into metadata when embedding notebooks into documents.
- ([#5902](https://github.com/quarto-dev/quarto-cli/issues/5902)): Support paired shortcode syntax.
- ([#6013](https://github.com/quarto-dev/quarto-cli/issues/6013)): Don't error if citation is passed as a boolean value in metadata via flags
- ([#6042](https://github.com/quarto-dev/quarto-cli/issues/6042)): Correctly support empty lines in YAML blocks.
- ([#6154](https://github.com/quarto-dev/quarto-cli/issues/6154)): `quarto check knitr` does not fail anymore when user's `.Rprofile` contains `cat()` calls.
- ([#6178](https://github.com/quarto-dev/quarto-cli/pull/6178)): When `QUARTO_LOG_LEVEL=DEBUG`, information about search for a R binary will be shown.
- ([#6207](https://github.com/quarto-dev/quarto-cli/issues/6207)): When QUARTO_R is set to a non-existing path, a warning is now thrown like with QUARTO_PYTHON. Quarto still fallback to search a working R version.
- ([#6244](https://github.com/quarto-dev/quarto-cli/issues/6244)): Code annotation now works for executable code cells using `echo: fenced`. Also it now supports HTML and Markdown code cells.
- ([#6269](https://github.com/quarto-dev/quarto-cli/issues/6259)): Fix issue with YAML validation where the annotated value was incorrectly built.
- ([#6487](https://github.com/quarto-dev/quarto-cli/discussions/6487)): Fix `serviceworkers` check in `htmlDependency` to look at the correct key.
- ([#6568](https://github.com/quarto-dev/quarto-cli/issues/6568)): Trim file extension in data URI that might have been inadvertently added by Pandoc.
- ([#6620](https://github.com/quarto-dev/quarto-cli/pull/6620)): Rewrite Crossreferenceable figure support. See the [prerelease documentation](https://quarto.org/docs/prerelease/1.4/) for more information.
- ([#6697](https://github.com/quarto-dev/quarto-cli/pull/6697)): Fix issue with outputing to stdout (`quarto render <file> -o -`) on Windows.
- ([#6705](https://github.com/quarto-dev/quarto-cli/pull/6705)): Fix issue with gfm output being removed when rendered with other formats.
- ([#6746](https://github.com/quarto-dev/quarto-cli/issues/6746)): Let stdout and stderr finish independently to avoid deadlock.
- ([#6807](https://github.com/quarto-dev/quarto-cli/pull/6807)): Improve sourcemapping reference cleanup in generated CSS files.
- ([#6825](https://github.com/quarto-dev/quarto-cli/issues/6825)): Show filename when YAML parsing error occurs.
- ([#6836](https://github.com/quarto-dev/quarto-cli/issues/6836)): Fix missing `docx` format for `abstract` key in reference schema.
- ([#7013](https://github.com/quarto-dev/quarto-cli/issues/7013)): Improve error message when there is an issue finding or running R and add more verbosity in [verbose mode](https://quarto.org/docs/troubleshooting/#verbose-mode).
- ([#7032](https://github.com/quarto-dev/quarto-cli/issues/7032)): `quarto` is now correctly working when installed in a folder with spaces in path.
- ([#7131](https://github.com/quarto-dev/quarto-cli/issues/7131)): Fix typo in ISBN entry for JATS subarticle template (author: @jasonaris).
- ([#3599](https://github.com/quarto-dev/quarto-cli/issues/3599), [#5870](https://github.com/quarto-dev/quarto-cli/issues/5870)): Fix hash issue causing unexpected render when `freeze` is activated on Windows but re-rendered on Linux (e.g. in Github Action).
- ([#7252](https://github.com/quarto-dev/quarto-cli/issues/7252)): Improve handling with `tlmgr` of some mismatched LaTeX support files, associated with `expl3.sty` loading.
