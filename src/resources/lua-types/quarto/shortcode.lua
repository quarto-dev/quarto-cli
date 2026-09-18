---@meta

quarto.shortcode = {}

--[[
Read the `n`-th shortcode argument from the passed `args` table.
]]
---@param args string[] arguments from the handler
---@param n number|nil index of the argument to read (default: 1)
---@return string|nil
function quarto.shortcode.read_arg(args, n) end

--[[
Produce output for a shortcode that failed to execute properly.

This is useful for shortcode developers to provide error output
consistent with how Quarto shortcodes provide error output.
]]
---@param name string Name of the shortcode
---@param message_or_args string[]|string shortcode args or optional error message to display
---@param context "block"|"inline"|"text" context of the shortcode
---@return pandoc.Blocks|pandoc.Inlines|string
function quarto.shortcode.error_output(name, message_or_args, context) end
