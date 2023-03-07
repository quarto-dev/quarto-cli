---@meta

---@module 'pandoc.format'
pandoc.format = {}

---@alias pandoc.FormatExtensions table<string, boolean>

--[[
Returns the list of all valid extensions for a format. No
distinction is made between input and output; an extension can
have an effect when reading a format but not when writing it, or
*vice versa*.
]]

---@param format string Format name
---@return pandoc.FormatExtensions
function pandoc.format.all_extensions(format) end

--[[
Returns the list of default extensions of the given format; this
function does not check if the format is supported, it will return
a fallback list of extensions even for unknown formats.
]]
---@param format string Format name
---@return pandoc.FormatExtensions
function pandoc.format.default_extensions(format) end

--[[
Returns the extension configuration for the given format.
The configuration is represented as a table with all supported
extensions as keys and their default status as value, with
`true` indicating that the extension is enabled by default,
while `false` marks a supported extension that's disabled.

This function can be used to assign a value to the `Extensions`
global in custom readers and writers.
]]
---@param format string Format name
---@return pandoc.FormatExtensions
function pandoc.format.extensions(format) end