---@meta

---@type string Format of the pandoc writer being used (html5, latex, etc.),
FORMAT = "html"

---@type pandoc.types.Version
PANDOC_VERSION = pandoc.types.Version('2.9.2')

---@type pandoc.types.Version
PANDOC_API_VERSION = pandoc.types.Version('1.22.1')

---@type string The name used to involve the filter. This value can be used to find files relative to the script file. 
PANDOC_SCRIPT_FILE = 'file'

--[[
Pandoc reader options
]]
---@class pandoc.ReaderOptions
---@field abbreviations string[] Set of known abbreviations
---@field columns integer Number of columns in terminal 
---@field default_image_extension string 
---@field extensions string[] String representation of the syntax extensions bit field 
---@field indented_code_classes pandoc.List Default classes for indented code blocks
---@field standalone boolean Whether the input was a standalone document with header
---@field strip_comments boolean HTML comments are stripped instead of parsed as raw HTML 
---@field tab_stop integer Width (i.e. equivalent number of spaces) of tab stops
---@field track_changes track_changes Track changes setting for docx; one of `accept-changes`, `reject-changes`, and `all-changes`

---@type pandoc.ReaderOptions
PANDOC_READER_OPTIONS = {}

---@alias track_changes "accept-changes" | "reject-changes" | "all-changes"

