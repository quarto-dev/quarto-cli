---@meta

quarto.format = {}

--[[
Return `true` if `el` is a RawInline or RawBlock Pandoc node.
]]
---@param el pandoc.Node Pandoc node
---@return boolean
function quarto.format.is_raw(el) end

--[[
Return `true` if `rawEl` is a RawInline or RawBlock of format `html`
]]
---@param rawEl pandoc.Node Pandoc node
---@return boolean
function quarto.format.is_raw_html(rawEl) end

--[[
Detect if the current format matches `name`

The name parameter can match an exact Pandoc format name (e.g. `docx`, `latex`, etc. or can match
based on an alias that groups commonly targeted formats together. Aliases include:

- **latex**: `latex`, `pdf`
- **pdf**: `latex`, `pdf`
- **epub**: `epub*`
- **html**: `html*`, `epub*`, `revealjs`
- **html:js**: `html*`, `revealjs`
- **markdown**: `markdown*`, `commonmark*`, `gfm`, `markua`

Note that the `html:js` alias indicates that the target format is capable of executing JavaScript (this maps to all HTML formats save for ePub).
]]
---@param name string Format name or alias
---@return boolean 
function quarto.format.is_format(name) end

--[[
Return `true` if format is `asciidoc` or `asciidoctor`.
]]
---@return string
function quarto.format.is_asciidoc_output() end


--[[
Return `true` if format is a `latex`-derived output format.
]]
---@return string
function quarto.format.is_latex_output() end


--[[
Return `true` if format is `beamer`.
]]
---@return string
function quarto.format.is_beamer_output() end


--[[
Return `true` if format is `docx`.
]]
---@return string
function quarto.format.is_docx_output() end


--[[
Return `true` if format is `rtf`.
]]
---@return string
function quarto.format.is_rtf_output() end


--[[
Return `true` if format is `odt`.
]]
---@return string
function quarto.format.is_odt_output() end


--[[
Return `true` if format is `docx` or `odt`.
]]
---@return string
function quarto.format.is_word_processor_output() end


--[[
Return `true` if format is `pptx`.
]]
---@return string
function quarto.format.is_powerpoint_output() end


--[[
Return `true` if format is `revealjs`.
]]
---@return string
function quarto.format.is_revealjs_output() end


--[[
Return `true` if format is `beamer`, `revealjs`, `s5`, `dzslides`, `slidy`, `slideous`, `revealjs` or `pptx`.
]]
---@return string
function quarto.format.is_slide_output() end


--[[
Return `true` if format is `epub`.
]]
---@return string
function quarto.format.is_epub_output() end


--[[
Return `true` if format is `gfm`.
]]
---@return string
function quarto.format.is_github_markdown_output() end


--[[
Return `true` if format is `hugo-md`.
]]
---@return string
function quarto.format.is_hugo_markdown_output() end


--[[
Return `true` if format is a markdown-derived output format.
]]
---@return string
function quarto.format.is_markdown_output() end


--[[
Return `true` if format is a markdown-derived output format that supports HTML code.
]]
---@return string
function quarto.format.is_markdown_with_html_output() end


--[[
Return `true` if format is `ipynb`.
]]
---@return string
function quarto.format.is_ipynb_output() end


--[[
Return `true` if format is an html-derived output format.
]]
---@return string
function quarto.format.is_html_output() end


--[[
Return `true` if format is `revealjs`, `s5`, `dzslides`, `slidy`, `slideous`, or `revealjs`.
]]
---@return string
function quarto.format.is_html_slide_output() end


--[[
Return `true` if format is `bib`.
]]
---@return string
function quarto.format.is_bibliography_output() end


--[[
Return `true` if format is `native`.
]]
---@return string
function quarto.format.is_native_output() end


--[[
Return `true` if format is `json`.
]]
---@return string
function quarto.format.is_json_output() end


--[[
Return `true` if format is `json` or `native`.
]]
---@return string
function quarto.format.is_ast_output() end


--[[
Return `true` if format is `jats`.
]]
---@return string
function quarto.format.is_jats_output() end


--[[
Return `true` if format is `typst`.
]]
---@return string
function quarto.format.is_typst_output() end


--[[
Return `true` if format is `confluence-xml`.
]]
---@return string
function quarto.format.is_confluence_output() end


--[[
Return `true` if format is `docusaurus-md`.
]]
---@return string
function quarto.format.is_docusaurus_output() end


--[[
Return `true` if format is `dashboard`.
]]
---@return string
function quarto.format.is_dashboard_output() end


--[[
Return `true` if format is `email`.
]]
---@return string
function quarto.format.is_email_output() end

---@class quarto.format.ParseFormatResult
---@field format string The base string of the formst
---@field extensions table<string, "-"|"+"> A table describing which extensions have been disabled (`-`) or enabled (`+`)

--[[
Returns an object with the format name and variants as would be interpreted by Pandoc
]]
---@param raw_format string The format's string
---@return quarto.format.ParseFormatResult
function quarto.format.parse_format(raw_format) end