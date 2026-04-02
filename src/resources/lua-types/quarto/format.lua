---@meta

quarto.format = {}

--[[
Return `true` if `rawEl` is a RawInline or RawBlock of format `html`
]]
---@param rawEl pandoc.Node Pandoc node
---@return boolean
function quarto.format.is_raw_html(rawEl) end

--[[
Return `true` if `rawEl` is a RawInline or RawBlock of format `tex` or `latex`.
]]
---@param rawEl pandoc.Node Pandoc node
---@return boolean
function quarto.format.is_raw_latex(rawEl) end

--[[
Detect if the current format matches `name`

The name parameter can match an exact Pandoc format name (e.g. `docx`, `latex`, etc. or can match
based on an alias that groups commonly targeted formats together. Aliases include:

- **latex**: `latex`, `pdf`
- **pdf**: `latex`, `pdf`
- **odt**: `odt`, `opendocument`
- **epub**: `epub*`
- **html**: `html*`, `epub*`, `revealjs`
- **html:js**: `html*`, `revealjs`
- **markdown**: `markdown*`, `commonmark*`, `gfm`, `markua`
- **asciidoc**: `asciidoc`, `asciidoctor`
- **confluence**: Confluence XML output
- **docusaurus**: `docusaurus`, `docusaurus-md`
- **email**: Email output
- **dashboard**: Dashboard output
- **gfm**: GitHub Flavored Markdown
- **hugo-md**: `hugo-md`, `hugo`

Note that the `html:js` alias indicates that the target format is capable of executing JavaScript (this maps to all HTML formats save for ePub).
]]
---@param name string Format name or alias
---@return boolean
function quarto.format.is_format(name) end

--[[
Return `true` if format is `asciidoc` or `asciidoctor`.
]]
---@return boolean
function quarto.format.is_asciidoc_output() end


--[[
Return `true` if format is a `latex`-derived output format.
]]
---@return boolean
function quarto.format.is_latex_output() end


--[[
Return `true` if format is `beamer`.
]]
---@return boolean
function quarto.format.is_beamer_output() end


--[[
Return `true` if format is `docx`.
]]
---@return boolean
function quarto.format.is_docx_output() end


--[[
Return `true` if format is `rtf`.
]]
---@return boolean
function quarto.format.is_rtf_output() end


--[[
Return `true` if format is `odt` or `opendocument`.
]]
---@return boolean
function quarto.format.is_odt_output() end


--[[
Return `true` if format is `docx`, `rtf`, or `odt`.
]]
---@return boolean
function quarto.format.is_word_processor_output() end


--[[
Return `true` if format is `pptx`.
]]
---@return boolean
function quarto.format.is_powerpoint_output() end


--[[
Return `true` if format is `revealjs`.
]]
---@return boolean
function quarto.format.is_revealjs_output() end


--[[
Return `true` if format is `beamer`, `s5`, `dzslides`, `slidy`, `slideous`, `revealjs`, or `pptx`.
]]
---@return boolean
function quarto.format.is_slide_output() end


--[[
Return `true` if format is `epub`, `epub2`, or `epub3`.
]]
---@return boolean
function quarto.format.is_epub_output() end


--[[
Return `true` if format is `gfm`.
]]
---@return boolean
function quarto.format.is_github_markdown_output() end


--[[
Return `true` if format is `hugo-md`.
]]
---@return boolean
function quarto.format.is_hugo_markdown_output() end


--[[
Return `true` if format is a markdown-derived output format.
]]
---@return boolean
function quarto.format.is_markdown_output() end


--[[
Return `true` if format is a markdown-derived output format that supports HTML code.
]]
---@return boolean
function quarto.format.is_markdown_with_html_output() end


--[[
Return `true` if format is `ipynb`.
]]
---@return boolean
function quarto.format.is_ipynb_output() end


--[[
Return `true` if format is an html-derived output format.
]]
---@return boolean
function quarto.format.is_html_output() end


--[[
Return `true` if format is `s5`, `dzslides`, `slidy`, `slideous`, or `revealjs`.
]]
---@return boolean
function quarto.format.is_html_slide_output() end


--[[
Return `true` if format is `bibtex`, `biblatex`, or `csljson`.
]]
---@return boolean
function quarto.format.is_bibliography_output() end


--[[
Return `true` if format is `native`.
]]
---@return boolean
function quarto.format.is_native_output() end


--[[
Return `true` if format is `json`.
]]
---@return boolean
function quarto.format.is_json_output() end


--[[
Return `true` if format is `json` or `native`.
]]
---@return boolean
function quarto.format.is_ast_output() end


--[[
Return `true` if format is `jats`, `jats_archiving`, `jats_articleauthoring`, or `jats_publishing`.
]]
---@return boolean
function quarto.format.is_jats_output() end


--[[
Return `true` if format is `typst`.
]]
---@return boolean
function quarto.format.is_typst_output() end


--[[
Return `true` if format is `confluence-xml`.
]]
---@return boolean
function quarto.format.is_confluence_output() end


--[[
Return `true` if format is `docusaurus-md`.
]]
---@return boolean
function quarto.format.is_docusaurus_output() end


--[[
Return `true` if format is `dashboard`.
]]
---@return boolean
function quarto.format.is_dashboard_output() end


--[[
Return `true` if format is `email`.
]]
---@return boolean
function quarto.format.is_email_output() end

---@class quarto.format.ParseFormatResult
---@field format string The base string of the format
---@field extensions table<string, boolean> A table describing which extensions have been disabled (`-`) or enabled (`+`)

--[[
Returns an object with the format name and variants as would be interpreted by Pandoc
]]
---@param raw_format string The format's string
---@return quarto.format.ParseFormatResult
function quarto.format.parse_format(raw_format) end

--[[
Returns a table with the format identifier information, including:
- `target-format`: The full target format name, e.g. `html+variant`
- `base-format`: The base format name, e.g. `html`
- `display-name`: A human-readable display name for the format, e.g. `HTML`
- `extension`: The name of the extension that exposes the format, if present
]]
---@return table
function quarto.format.format_identifier() end
