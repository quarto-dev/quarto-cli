---@meta

---@module 'pandoc.template'
pandoc.template = {}

--[[
Opaque type holding a compiled template.
]]
---@class pandoc.Template
pandoc.Template = {}

--[[
Compiles a template string into a `Template` object usable by pandoc.

If the `templates_path` parameter is specified, should be the
file path associated with the template. It is used when checking
for partials. Partials will be taken only from the default data
files if this parameter is omitted.

An error is raised if compilation fails.
]]
---@param template string Template string
---@param templates_path? string Parameter to determine a default path and extension for partials; uses the data files templates path by default
---@return pandoc.Template # Compiled template
function pandoc.template.compile(template, templates_path) end

--[[
Returns the default template for a given writer as a string. An
error if no such template can be found.
]]
---@param writer? string Name of the writer for which the template should be retrieved; defaults to the global `FORMAT`.
---@return string # Raw template
function pandoc.template.default(writer) end


--[[
Applies a context with variable assignments to a template,
returning the rendered template. The `context` parameter must be a
table with variable names as keys and [Doc], string, boolean, or
table as values, where the table can be either be a list of the
aforementioned types, or a nested context.
]]
---@param template pandoc.Template Template to apply
---@param context table<string,any> Variable values
---@return pandoc.Doc # Rendered template
function pandoc.template.apply(template, context) end


--[[
Creates template context from the document's [Meta]{#type-meta}
data, using the given functions to convert [Blocks] and [Inlines]
to [Doc] values.
]]
---@param meta pandoc.Meta Document metadata
---@param blocks_writer fun(blocks: pandoc.Blocks):pandoc.Doc # Converter from [Blocks] to [Doc] values
---@param inlines_writer fun(inlines: pandoc.Inlines):pandoc.Doc # Converter from [Inlines] to [Doc] values
---@return table<string,any> # Template context
function pandoc.template.meta_to_context(meta, blocks_writer, inlines_writer) end

--[[
Retrieve text for a template.

This function first checks the resource paths for a file of this
name; if none is found, the `templates` directory in the user data
directory is checked. Returns the content of the file, or throws
an error if no file is found.
]]
---@param filename string name of the template
---@return string # content of the template
function pandoc.template.get(filename) end

return pandoc.template
