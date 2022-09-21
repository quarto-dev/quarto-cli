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

return pandoc.template
