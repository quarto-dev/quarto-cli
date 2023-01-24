---@meta

--[[

Command line options and argument parsing.

]]
---@module 'pandoc.cli'
pandoc.cli = {}
--[[

Parses command line arguments into pandoc options. Typically this
function will be used in stand-alone pandoc Lua scripts, taking the list
of arguments from the global `arg`.

Parameters:

`args`
:   list of command line arguments ({string,...})

Returns:

-   parsed options, using their JSON-like representation. (table)

]]
---@param args string[] list of command line arguments
---@return table # parsed options, using their JSON-like representation.
function pandoc.cli.parse_options(args) end


---@type table
pandoc.cli.default_options = {}


return pandoc.cli
