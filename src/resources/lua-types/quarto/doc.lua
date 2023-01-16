---@meta

quarto.doc = {}

---@type string Full path to input file for the current render
quarto.doc.input_file = ""

---@type string Full path to output file for the current render
quarto.doc.output_file = ""

--[[
Add an HTML dependency (additional resources and content) to a document. 

HTML Dependencies can bundle together JavaScript, CSS, and even arbitrary content
to inject into the `<head>` of the document. These dependencies have a `name` and
a `version`, which is used to ensure that the same dependency isn’t bundled into 
the document more than once.

See the documentation on [HTML Dependencies](https://quarto.org/docs/extensions/lua.html#html-dependencies) in Quarto Extensions for additional details.
]]
---@param dependency table Dependency object (see [HTML Dependency](https://quarto.org/docs/extensions/lua.html#html-dependencies))
function quarto.doc.add_html_dependency(dependency) end

--[[
Include a file within the output directory for an HTML dependency
]]
---@param name string HTML dependency name
---@param file string|{ path: string, name: string } File path relative to Lua filter or table with `path` and `name` for renaming the file as its copied.
function quarto.doc.attach_to_dependency(name, file) end

--[[
Adds a `\usepackage` statement to the LaTeX output

If appropriate, include package options using the `options` parameter.
]]
---@param package string LaTeX package name
---@param options? string (Optional) LaTeX package options
function quarto.doc.use_latex_package(package, options) end

--[[
Add a format resource to the document. The path to the file should relative to the Lua script calling this function.

Format resources will be copied into the directory next 
to the rendered file. This is useful, for example, if your format references a bst or cls file 
which must be copied into the LaTeX output directory.
]]
---@param file string Format resource file (relative path from Lua script)
function quarto.doc.add_format_resource(file) end

--[[
Include text at the specified location (`in-header`, `before-body`, or `after-body`). 
]]
---@param location 'in-header'|'before-body'|'after-body' Location for include
---@param text string Text to include
function quarto.doc.include_text(location, text) end

--[[
Include file at the specified location (`in-header`, `before-body`, or `after-body`). 

The path to the file should relative to the Lua script calling this function.
]]
---@param location 'in-header'|'before-body'|'after-body' Location for include
---@param file string File to include (relative path from Lua script)
function quarto.doc.include_file(location, file) end


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
function quarto.doc.is_format(name) end

--[[
Cite method (`citeproc`, `natbib`, or `biblatex`) for the current render
]]
---@return 'citeproc'|'natbib'|'biblatex'
function quarto.doc.cite_method() end

--[[
PDF engine (e.g. `pdflatex`) for the current render
]]
---@return string
function quarto.doc.pdf_engine() end

--[[
Does the current output format include Bootstrap themed HTML
]]
---@return boolean
function quarto.doc.has_bootstrap() end

--[[
Provides the project relative path to the current input
if this render is in the context of a project (otherwise `nil`)
]]
---@return string|nil
function quarto.doc.project_output_file() end
